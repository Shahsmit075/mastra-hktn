const EMBED_MODEL = process.env.FEATHERLESS_EMBED_MODEL || 'nomic-ai/nomic-embed-text-v1.5';
const BASE_URL = process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1';
const API_KEY = process.env.FEATHERLESS_API_KEY || '';

export async function embedText(text: string): Promise<number[]> {
  if (!API_KEY) {
    return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
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
    console.warn(`Embedding API error: ${response.status} — falling back to random vector`);
    return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
  }

  const data = await response.json() as { data: { embedding: number[] }[] };
  return data.data[0]?.embedding || Array.from({ length: 768 }, () => Math.random() * 2 - 1);
}
