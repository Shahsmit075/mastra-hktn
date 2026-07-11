import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

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

function chunkText(text: string, chunkSize = 2048, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
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

export const qdrantUpsertTool = createTool({
  id: 'qdrant-upsert',
  description: 'Chunks and upserts content into a Qdrant collection.',
  inputSchema: z.object({
    collection: z.enum(['post_mortems', 'runbooks', 'synthesis_drafts']),
    content: z.string().describe('Full text content to chunk and embed'),
    metadata: z.record(z.unknown()).describe('Payload metadata to attach to all chunks'),
    sourceId: z.string().optional().describe('Source document ID for deduplication'),
  }),
  outputSchema: z.object({
    upsertedCount: z.number(),
    pointIds: z.array(z.string()),
  }),
  execute: async (inputData) => {
    const { collection, content, metadata, sourceId } = inputData;
    const chunks = chunkText(content);
    const pointIds: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const pointId = sourceId ? `${sourceId}-chunk-${i}` : uuidv4();

      const vector = await getEmbedding(chunks[i]);

      await qdrantFetch(`/collections/${collection}/points?wait=true`, {
        method: 'PUT',
        body: JSON.stringify({
          points: [{
            id: pointId,
            vector,
            payload: {
              ...metadata,
              chunk_index: i,
              chunk_count: chunks.length,
              content: chunks[i],
              indexed_at: new Date().toISOString(),
            },
          }],
        }),
      });

      pointIds.push(pointId);
    }

    return { upsertedCount: chunks.length, pointIds };
  },
});
