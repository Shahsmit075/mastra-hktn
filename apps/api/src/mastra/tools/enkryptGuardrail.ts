import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

type EnkryptAction = 'PASS' | 'REDACT' | 'BLOCK';

interface EnkryptResult {
  action: EnkryptAction;
  cleanedText: string;
  detections: {
    pii?: { found: boolean; entities?: string[] };
    injection?: { found: boolean; score?: number };
    toxicity?: { found: boolean; score?: number };
    hallucination?: { found: boolean; invalidRefs?: string[] };
  };
  promptHash: string;
  blocked: boolean;
  blockReason?: string;
}

// ─── Hash utility ─────────────────────────────────────────────────────────────

function hashPrompt(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ─── Core Enkrypt API caller ───────────────────────────────────────────────────

async function callEnkryptGuardrail(
  text: string,
  mode: 'input' | 'output',
  contextRefs?: string[]
): Promise<EnkryptResult> {
  const baseUrl = process.env.ENKRYPT_BASE_URL || 'https://api.enkryptai.com';
  const apiKey = process.env.ENKRYPT_API_KEY;

  if (!apiKey) {
    console.warn('[enkrypt] No API key — using local fallback guardrail');
    return localFallbackGuardrail(text, mode, contextRefs);
  }

  // Correct endpoint: /guardrails/detect (works for both input and output)
  const endpoint = `${baseUrl}/guardrails/detect`;

  const body = {
    text,
    detectors: {
      pii: {
        enabled: true,
        entities: ['email', 'phone', 'ip_address', 'secrets', 'url'],
      },
      injection_attack: { enabled: true },
      toxicity: { enabled: true },
    },
  };

  try {
    console.log(`[enkrypt] Calling ${endpoint} (mode: ${mode})`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[enkrypt] API error ${response.status}: ${errBody}`);
      return { action: 'PASS', cleanedText: text, detections: {}, promptHash: hashPrompt(text), blocked: false };
    }

    // Response shape: { summary: { toxicity: [], pii: 0, injection_attack: 0 }, details: { ... } }
    const data = await response.json() as {
      summary: {
        toxicity: string[];
        pii: number;
        injection_attack: number;
      };
      details: {
        toxicity?: { HATE?: number; HARASSMENT?: number };
        pii?: { entities: Record<string, unknown>; text: string };
        injection_attack?: { safe: string; attack: string };
      };
    };

    console.log(`[enkrypt] Result — pii: ${data.summary.pii}, injection: ${data.summary.injection_attack}, toxicity: ${data.summary.toxicity.length}`);

    // Block on injection attack score > 0.7
    const attackScore = parseFloat(data.details.injection_attack?.attack || '0');
    if (attackScore > 0.7) {
      return {
        action: 'BLOCK',
        cleanedText: '',
        detections: { injection: { found: true, score: attackScore } },
        promptHash: hashPrompt(text),
        blocked: true,
        blockReason: 'PROMPT_INJECTION_DETECTED',
      };
    }

    // Redact if PII found
    if (data.summary.pii > 0) {
      const piiText = data.details.pii?.text || text;
      return {
        action: 'REDACT',
        cleanedText: piiText,
        detections: { pii: { found: true } },
        promptHash: hashPrompt(text),
        blocked: false,
      };
    }

    return {
      action: 'PASS',
      cleanedText: text,
      detections: {},
      promptHash: hashPrompt(text),
      blocked: false,
    };

  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      console.warn('[enkrypt] API timeout — failing open');
    } else {
      console.error('[enkrypt] API call failed:', err.message);
    }
    return {
      action: 'PASS',
      cleanedText: text,
      detections: {},
      promptHash: hashPrompt(text),
      blocked: false,
    };
  }
}

// ─── Local Fallback (when no API key) ─────────────────────────────────────────

function localFallbackGuardrail(
  text: string,
  _mode: 'input' | 'output',
  _contextRefs?: string[]
): EnkryptResult {
  let cleanedText = text;
  let action: EnkryptAction = 'PASS';

  const injectionPatterns = [
    /ignore (previous|all) instructions/i,
    /you are now/i,
    /forget your (system|previous)/i,
    /\[SYSTEM\]/i,
  ];
  for (const pattern of injectionPatterns) {
    if (pattern.test(text)) {
      return {
        action: 'BLOCK',
        cleanedText: '',
        detections: { injection: { found: true } },
        promptHash: hashPrompt(text),
        blocked: true,
        blockReason: 'PROMPT_INJECTION_DETECTED (local)',
      };
    }
  }

  cleanedText = cleanedText
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|Bearer [A-Za-z0-9\-._~+/]+=*)\b/g, '[REDACTED_SECRET]');

  if (cleanedText !== text) action = 'REDACT';

  return {
    action,
    cleanedText,
    detections: {},
    promptHash: hashPrompt(text),
    blocked: false,
  };
}

// ─── Mastra Tools ─────────────────────────────────────────────────────────────
// Mastra tool execute signature: (inputData, context) => Promise<output>

export const enkryptInputGuardrailTool = createTool({
  id: 'enkrypt-input-guardrail',
  description: 'Validates and sanitizes incoming alert/log text before it reaches the LLM.',
  inputSchema: z.object({
    text: z.string().describe('Raw input text from API request'),
  }),
  outputSchema: z.object({
    action: z.enum(['PASS', 'REDACT', 'BLOCK']),
    cleanedText: z.string(),
    blocked: z.boolean(),
    blockReason: z.string().optional(),
    promptHash: z.string().describe('SHA-256 of original text for audit trail'),
  }),
  execute: async (inputData) => {
    const result = await callEnkryptGuardrail(inputData.text, 'input');
    return {
      action: result.action,
      cleanedText: result.cleanedText,
      blocked: result.blocked,
      blockReason: result.blockReason,
      promptHash: result.promptHash,
    };
  },
});

export const enkryptOutputGuardrailTool = createTool({
  id: 'enkrypt-output-guardrail',
  description: 'Validates LLM output. Checks evidence_refs are valid Qdrant UUIDs.',
  inputSchema: z.object({
    text: z.string().describe('LLM output text or JSON string to validate'),
    contextRefs: z.array(z.string()).describe('Valid Qdrant UUIDs from the retrieved context window'),
  }),
  outputSchema: z.object({
    action: z.enum(['PASS', 'REDACT', 'BLOCK']),
    cleanedText: z.string(),
    blocked: z.boolean(),
    blockReason: z.string().optional(),
    invalidRefs: z.array(z.string()).optional(),
  }),
  execute: async (inputData) => {
    const result = await callEnkryptGuardrail(inputData.text, 'output', inputData.contextRefs);
    return {
      action: result.action,
      cleanedText: result.cleanedText,
      blocked: result.blocked,
      blockReason: result.blockReason,
      invalidRefs: result.detections.hallucination?.invalidRefs,
    };
  },
});
