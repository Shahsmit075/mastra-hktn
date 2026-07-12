import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const activeProvider = process.env.AI_PROVIDER || 'openai';

// Featherless AI provider
export const featherlessProvider = createOpenAICompatible({
  name: 'featherless',
  baseURL: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
  apiKey: process.env.FEATHERLESS_API_KEY || '',
});

// Standard OpenAI provider
export const openaiProvider = createOpenAICompatible({
  name: 'openai',
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY || '',
});

const provider = activeProvider === 'openai' ? openaiProvider : featherlessProvider;

const primaryModelName = activeProvider === 'openai' 
  ? 'gpt-4o-mini' 
  : (process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-72B-Instruct');

// Primary model: gpt-4o-mini or Qwen2.5-72B
export const primaryModel = provider.chatModel(primaryModelName);

const fastModelName = activeProvider === 'openai'
  ? 'gpt-4o-mini'
  : 'Qwen/Qwen2.5-7B-Instruct';

// Fast model for lightweight tasks
export const fastModel = provider.chatModel(fastModelName);
