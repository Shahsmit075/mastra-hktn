const EMBED_MODEL = process.env.FEATHERLESS_EMBED_MODEL || 'nomic-ai/nomic-embed-text-v1.5';
const BASE_URL = process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1';
const API_KEY = process.env.FEATHERLESS_API_KEY || '';

export async function embedText(text: string): Promise<number[]> {
  if (!API_KEY) {
    throw new Error('Embedding API unavailable: FEATHERLESS_API_KEY not configured');
  }

  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Embedding API error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json() as { data: { embedding: number[] }[] };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('Embedding API returned empty embedding vector');
  }
  return embedding;
}
