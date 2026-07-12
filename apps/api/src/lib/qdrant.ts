import { QdrantClient } from '@qdrant/js-client-rest';

// Shared singleton QdrantClient — eliminates multiple unmanaged connections
let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    _client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      timeout: 10_000, // 10s timeout for all operations
    });
  }
  return _client;
}
