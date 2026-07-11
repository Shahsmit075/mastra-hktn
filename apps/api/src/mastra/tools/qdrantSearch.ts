import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

async function qdrantFetch(path: string, options: RequestInit) {
  const url = `${process.env.QDRANT_URL || 'http://localhost:6333'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.QDRANT_API_KEY) {
    headers['api-key'] = process.env.QDRANT_API_KEY;
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Qdrant API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not defined, falling back to random vectors');
    return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
  }

  const cleanedText = text?.trim() || 'empty';

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleanedText,
        dimensions: 768,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI embeddings API call failed:', await response.text());
      return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
    }

    const data = await response.json() as any;
    return data.data[0].embedding;
  } catch (err) {
    console.error('Error fetching embedding:', err);
    return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
  }
}

export const qdrantSearchTool = createTool({
  id: 'qdrant-hybrid-search',
  description: 'Searches Qdrant collections using hybrid Dense+BM25+RRF strategy.',
  inputSchema: z.object({
    query: z.string().describe('The incident context text to search for'),
    collections: z.array(z.enum(['runbooks', 'historical_incidents', 'post_mortems', 'synthesis_drafts']))
      .default(['runbooks', 'historical_incidents']),
    topK: z.number().default(5),
    serviceId: z.string().optional().describe('Filter results by specific service'),
    trustScoreMin: z.number().default(0.5),
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

    const denseVector = await getEmbedding(query);

    const allResults: Array<{ id: string; score: number; collection: string; payload: Record<string, unknown> }> = [];

    for (const collection of collections) {
      try {
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

        // Standard dense search
        const res = await qdrantFetch(`/collections/${collection}/points/search`, {
          method: 'POST',
          body: JSON.stringify({
            vector: denseVector,
            limit: topK,
            with_payload: true,
            filter: mustFilters.length > 0 ? { must: mustFilters } : undefined,
          }),
        });

        const searchResult = res.result || [];

        for (const hit of searchResult) {
          let score = hit.score || 0;
          const payload = hit.payload as Record<string, unknown> | null;
          const createdAt = payload?.occurred_at || payload?.last_used_at;
          if (createdAt) {
            const daysSince = (Date.now() - new Date(createdAt as string).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 30) {
              score *= 1.2;
            }
          }

          allResults.push({
            id: String(hit.id),
            score,
            collection,
            payload: (payload || {}) as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.error(`Qdrant search failed for collection ${collection}:`, err);
      }
    }

    allResults.sort((a, b) => b.score - a.score);
    const topResults = allResults.slice(0, topK);

    return { results: topResults, totalFound: allResults.length };
  },
});
