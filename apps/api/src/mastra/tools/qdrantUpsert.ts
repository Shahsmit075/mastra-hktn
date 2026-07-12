import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { embedText } from '../../lib/embeddings.js';
import { getQdrantClient } from '../../lib/qdrant.js';

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
    const qdrant = getQdrantClient();
    const chunks = chunkText(content);

    // Batch embed all chunks in parallel — best-effort; skip if embedding unavailable
    let vectors: number[][];
    try {
      vectors = await Promise.all(chunks.map(chunk => embedText(chunk)));
    } catch (err) {
      console.warn('[qdrantUpsert] Embedding unavailable, skipping upsert:', (err as Error).message);
      return { upsertedCount: 0, pointIds: [] };
    }

    const pointIds = chunks.map((_, i) => sourceId ? `${sourceId}-chunk-${i}` : uuidv4());

    // Single batched upsert call instead of N sequential HTTP round-trips
    await qdrant.upsert(collection, {
      wait: true,
      points: chunks.map((chunk, i) => ({
        id: pointIds[i],
        vector: { dense: vectors[i] },
        payload: {
          ...metadata,
          chunk_index: i,
          chunk_count: chunks.length,
          content: chunk,
          indexed_at: new Date().toISOString(),
        },
      })),
    });

    return { upsertedCount: chunks.length, pointIds };
  },
});
