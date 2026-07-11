import { createTool } from '@mastra/core/tools';
import { QdrantClient } from '@qdrant/js-client-rest';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { embedText } from '../../lib/embeddings';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

// Chunk text into overlapping segments (512 tokens ≈ 2048 chars, 50 token overlap ≈ 200 chars)
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

export const qdrantUpsertTool = createTool({
  id: 'qdrant-upsert',
  description: 'Chunks and upserts a post-mortem report into the post_mortems Qdrant collection. Called by PostMortemAgent after report generation.',
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
      
      const vector = await embedText(chunks[i]);

      await qdrant.upsert(collection, {
        wait: true,
        points: [{
          id: pointId,
          vector: { dense: vector },
          payload: {
            ...metadata,
            chunk_index: i,
            chunk_count: chunks.length,
            content: chunks[i],
            indexed_at: new Date().toISOString(),
          },
        }],
      });

      pointIds.push(pointId);
    }

    return { upsertedCount: chunks.length, pointIds };
  },
});
