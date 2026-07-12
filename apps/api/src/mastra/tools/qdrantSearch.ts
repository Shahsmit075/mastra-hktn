import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { embedText } from '../../lib/embeddings';
import { getQdrantClient } from '../../lib/qdrant';

// ─── Simple BM25 Sparse Encoder ──────────────────────────────────────────────
// Tokenizes text and builds a sparse vector using term frequencies.
// Token IDs are derived from a stable hash so the same term always maps to the
// same index across queries and documents.
function stableHash(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100_000; // Map into a 100k-dimensional sparse space
}

function buildSparseVector(text: string): { indices: number[]; values: number[] } {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const tf = new Map<number, number>();
  for (const token of tokens) {
    const idx = stableHash(token);
    tf.set(idx, (tf.get(idx) || 0) + 1);
  }

  const indices = [...tf.keys()].sort((a, b) => a - b);
  const values = indices.map(idx => {
    const freq = tf.get(idx)!;
    // BM25-style TF saturation: tf / (tf + 1.2)
    return freq / (freq + 1.2);
  });

  return { indices, values };
}

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

    const qdrant = getQdrantClient();
    const sparseVector = buildSparseVector(query);

    // Embedding is best-effort — if it fails, fall back to BM25-only search
    let denseVector: number[] | null = null;
    try {
      denseVector = await embedText(query);
    } catch (err) {
      console.warn('[qdrantSearch] Embedding unavailable, falling back to BM25-only search:', (err as Error).message);
    }

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

        // Build search — dense+sparse hybrid when embedding available, BM25-only fallback
        let searchResponse: any;
        if (denseVector) {
          searchResponse = await qdrant.query(collection, {
            prefetch: [
              { query: denseVector, using: 'dense', limit: 20 },
              { query: sparseVector, using: 'bm25', limit: 20 },
            ],
            query: { fusion: 'rrf' },
            filter: mustFilters.length > 0 ? { must: mustFilters } : undefined,
            limit: topK,
            with_payload: true,
          });
        } else {
          searchResponse = await qdrant.query(collection, {
            query: sparseVector,
            using: 'bm25',
            filter: mustFilters.length > 0 ? { must: mustFilters } : undefined,
            limit: topK,
            with_payload: true,
          });
        }

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
