import fetch from 'node-fetch';
global.fetch = fetch as any;
import { QdrantClient } from '@qdrant/js-client-rest';
const qdrant = new QdrantClient({
  url: 'http://localhost:6333',
  checkCompatibility: false
});
qdrant.getCollections().then(console.log).catch(console.error);
