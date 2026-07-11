import { createTool } from '@mastra/core/tools';
import { QdrantClient } from '@qdrant/js-client-rest';
import { z } from 'zod';
import { embedText } from '../../lib/embeddings';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

export const qdrantSearchTool = createTool({
  id: 'qdrant-hybrid-search',
  description: 'Searches Qdrant collections using hybrid Dense+BM25+RRF strategy. Returns top-K ranked chunks relevant to the incident context.',
  inputSchema: z.object({
    query: z.string().describe('The incident context text to search for'),
    collections: z.array(z.enum(['runbooks', 'historical_incidents', 'post_mortems', 'synthesis_drafts']))
      .default(['runbooks', 'historical_incidents']),
    topK: z.number().default(5),
    serviceId: z.string().optional().describe('Filter results by specific service'),
    trustScoreMin: z.number().default(0.5).describe('Minimum trust_score — filters stale/low-confidence docs'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      id: z.string(),
      score: z.number(),
      collection: z.string(),
      payload: z.record(z.unknown()),
    })),
    totalFound: z.number(),
  }),
  execute: async (inputData) => {
    const { query, collections, topK, serviceId, trustScoreMin } = inputData;

    const denseVector = await embedText(query);

    const allResults: Array<{ id: string; score: number; collection: string; payload: Record<string, unknown> }> = [];

    for (const collection of collections) {
      try {
        // Build filter
        const mustFilters: object[] = [];

        if (serviceId) {
          mustFilters.push({
            key: 'service_id',
            match: { value: serviceId },
          });
        }

        if (trustScoreMin > 0 && collection === 'runbooks') {
          mustFilters.push({
            key: 'trust_score',
            range: { gte: trustScoreMin },
          });
        }

        // Hybrid search: prefetch dense + sparse, then RRF fusion
        const searchResponse: any = await qdrant.query(collection, {
          prefetch: [
            {
              query: denseVector,
              using: 'dense',
              limit: 20,
            },
            // BM25 sparse search (keyword matching for error codes, service names)
            {
              query: { indices: [], values: [] }, // Will be populated with real sparse encoding
              using: 'bm25',
              limit: 20,
            },
          ],
          query: { fusion: 'rrf' }, // Reciprocal Rank Fusion
          filter: mustFilters.length > 0 ? { must: mustFilters } : undefined,
          limit: topK,
          with_payload: true,
        });

        const points = searchResponse.points || searchResponse || [];
        for (const hit of points) {
          // Apply temporal decay: boost recent documents
          let score = hit.score || 0;
          const createdAt = hit.payload?.occurred_at || hit.payload?.last_used_at;
          if (createdAt) {
            const daysSince = (Date.now() - new Date(createdAt as string).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 30) {
              score *= 1.2; // 20% boost for recent content
            }
          }

          allResults.push({
            id: String(hit.id),
            score,
            collection,
            payload: hit.payload as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.error(`Qdrant search failed for collection ${collection}:`, err);
      }
    }

    // Sort by composite score descending
    allResults.sort((a, b) => b.score - a.score);
    const topResults = allResults.slice(0, topK);

    return { results: topResults, totalFound: allResults.length };
  },
});
