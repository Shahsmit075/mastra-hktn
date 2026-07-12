import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';

const activeProvider = process.env.AI_PROVIDER || 'openai';

// Featherless AI provider (uses generic OpenAI-compatible — no native structured outputs)
export const featherlessProvider = createOpenAICompatible({
  name: 'featherless',
  baseURL: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
  headers: {
    Authorization: `Bearer ${process.env.FEATHERLESS_API_KEY || ''}`,
  },
});

// Standard OpenAI provider — uses native @ai-sdk/openai for structured output support
export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Primary model: gpt-4o-mini (native) or Qwen2.5-72B (OpenAI-compatible fallback)
export const primaryModel = activeProvider === 'openai'
  ? openaiProvider('gpt-4o-mini')
  : featherlessProvider.chatModel(process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-72B-Instruct');

// Fast model for lightweight tasks
export const fastModel = activeProvider === 'openai'
  ? openaiProvider('gpt-4o-mini')
  : featherlessProvider.chatModel('Qwen/Qwen2.5-7B-Instruct');
