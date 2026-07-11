import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// Featherless AI provider — OpenAI-compatible
export const featherlessProvider = createOpenAICompatible({
  name: 'featherless',
  baseURL: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
  apiKey: process.env.FEATHERLESS_API_KEY || '',
});

// Primary model: Qwen2.5-72B — strong structured JSON output, 128k context
export const primaryModel = featherlessProvider.chatModel(
  process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-72B-Instruct'
);

// Fast model for lightweight tasks (MTTR calculation, summaries)
export const fastModel = featherlessProvider.chatModel(
  'Qwen/Qwen2.5-7B-Instruct'
);
