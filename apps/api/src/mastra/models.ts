import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';

const hasFeatherless = !!process.env.FEATHERLESS_API_KEY;

// Dynamic provider (OpenAI or Featherless)
export const aiProvider = hasFeatherless
  ? createOpenAICompatible({
      name: 'featherless',
      baseURL: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
      apiKey: process.env.FEATHERLESS_API_KEY || '',
    })
  : createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

// Primary model: Qwen2.5-72B or gpt-4o
export const primaryModel = aiProvider(
  hasFeatherless 
    ? (process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-72B-Instruct')
    : 'gpt-4o'
);

// Fast model for lightweight tasks (MTTR calculation, summaries)
export const fastModel = aiProvider(
  hasFeatherless 
    ? 'Qwen/Qwen2.5-7B-Instruct'
    : 'gpt-4o-mini'
);
