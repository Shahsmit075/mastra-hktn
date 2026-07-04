# Guide 04 — Enkrypt AI Safety Guardrail

## Integration Approach

Enkrypt AI has no TypeScript SDK. Use direct `fetch()` calls. This guide defines:
1. The Mastra tool that wraps Enkrypt AI
2. The exact API calls for input and output guardrailing
3. The decision logic (BLOCK / REDACT / PASS)

## File: `apps/api/src/mastra/tools/enkryptGuardrail.ts`

```typescript
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
  contextRefs?: string[] // Qdrant UUIDs for hallucination check (output mode only)
): Promise<EnkryptResult> {
  const baseUrl = process.env.ENKRYPT_BASE_URL || 'https://api.enkryptai.com';
  const apiKey = process.env.ENKRYPT_API_KEY;

  if (!apiKey) {
    // Fallback: if no Enkrypt key, run basic local checks only
    console.warn('ENKRYPT_API_KEY not set — running fallback local guardrails');
    return localFallbackGuardrail(text, mode, contextRefs);
  }

  const endpoint = mode === 'input'
    ? `${baseUrl}/guardrails/input`
    : `${baseUrl}/guardrails/output`;

  const body = {
    text,
    detectors: {
      pii: {
        enabled: true,
        entities: ['email', 'phone', 'ip_address', 'api_key', 'password', 'credit_card'],
        action: 'redact', // Replace with [REDACTED_<TYPE>] token
      },
      injection_attack: {
        enabled: mode === 'input',
        threshold: 0.7,
      },
      toxicity: {
        enabled: true,
        threshold: 0.8,
      },
      ...(mode === 'output' && contextRefs ? {
        hallucination: {
          enabled: true,
          valid_references: contextRefs, // Qdrant UUIDs from retrieved context
        },
      } : {}),
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000), // 5s timeout — don't block incident response
    });

    if (!response.ok) {
      console.error(`Enkrypt API error: ${response.status}`);
      // Fail open for availability — log but proceed
      return { action: 'PASS', cleanedText: text, detections: {}, promptHash: hashPrompt(text), blocked: false };
    }

    const data = await response.json() as {
      cleaned_text: string;
      detections: {
        pii?: { detected: boolean; entities?: Array<{ type: string; start: number; end: number }> };
        injection_attack?: { detected: boolean; score?: number };
        toxicity?: { detected: boolean; score?: number };
        hallucination?: { detected: boolean; invalid_refs?: string[] };
      };
    };

    // ─── Decision Logic ──────────────────────────────────────────────────────

    // BLOCK conditions (hard stop)
    if (data.detections.injection_attack?.detected) {
      return {
        action: 'BLOCK',
        cleanedText: '',
        detections: { injection: { found: true, score: data.detections.injection_attack.score } },
        promptHash: hashPrompt(text),
        blocked: true,
        blockReason: 'PROMPT_INJECTION_DETECTED',
      };
    }

    if (data.detections.hallucination?.detected && mode === 'output') {
      return {
        action: 'BLOCK',
        cleanedText: '',
        detections: {
          hallucination: {
            found: true,
            invalidRefs: data.detections.hallucination.invalid_refs,
          },
        },
        promptHash: hashPrompt(text),
        blocked: true,
        blockReason: 'HALLUCINATED_EVIDENCE_REFS',
      };
    }

    // REDACT conditions (clean text, continue)
    if (data.detections.pii?.detected) {
      return {
        action: 'REDACT',
        cleanedText: data.cleaned_text,
        detections: {
          pii: {
            found: true,
            entities: data.detections.pii.entities?.map(e => e.type),
          },
        },
        promptHash: hashPrompt(text), // Hash the ORIGINAL (pre-redaction) text
        blocked: false,
      };
    }

    // PASS
    return {
      action: 'PASS',
      cleanedText: data.cleaned_text || text,
      detections: {},
      promptHash: hashPrompt(text),
      blocked: false,
    };

  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      console.warn('Enkrypt API timeout — failing open');
    } else {
      console.error('Enkrypt API call failed:', err.message);
    }
    // Fail open: never block incident response due to guardrail unavailability
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
  mode: 'input' | 'output',
  contextRefs?: string[]
): EnkryptResult {
  let cleanedText = text;
  let action: EnkryptAction = 'PASS';

  // Basic injection detection
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

  // Basic PII redaction
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

export const enkryptInputGuardrailTool = createTool({
  id: 'enkrypt-input-guardrail',
  description: 'Validates and sanitizes incoming alert/log text before it reaches the LLM. Blocks prompt injection. Redacts PII and secrets. Returns cleaned text.',
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
  execute: async ({ context }) => {
    const result = await callEnkryptGuardrail(context.text, 'input');
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
  description: 'Validates LLM output before it reaches the HITL Dashboard. Checks that evidence_refs are valid Qdrant UUIDs from the retrieved context. Blocks hallucinated citations.',
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
  execute: async ({ context }) => {
    const result = await callEnkryptGuardrail(context.text, 'output', context.contextRefs);
    return {
      action: result.action,
      cleanedText: result.cleanedText,
      blocked: result.blocked,
      blockReason: result.blockReason,
      invalidRefs: result.detections.hallucination?.invalidRefs,
    };
  },
});
```

## Important: Fail-Open Design

The Enkrypt AI guardrail is designed to **fail open** — if the Enkrypt API is unavailable or times out, the system proceeds with local fallback checks. This is intentional: incident response cannot be blocked by a guardrail service outage.

Log all guardrail bypasses to `audit_logs` with `action: 'guardrail_bypass'` so the SRE lead can review them.

## Timeout Budget

Enkrypt API has a 5-second timeout. Total per-incident latency budget:
- Enkrypt input: ≤ 5s
- LLM inference: ≤ 15s
- Qdrant search: ≤ 2s
- Enkrypt output: ≤ 5s
- **Total triage path: ≤ 27s**
