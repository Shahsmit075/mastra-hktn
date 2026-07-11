import { trace, context, SpanStatusCode, isSpanContextValid } from '@opentelemetry/api';
import { createHash } from 'crypto';

const tracer = trace.getTracer('runbook-sentinel', '1.0.0');

// GenAI semantic convention attribute keys
// Ref: https://opentelemetry.io/docs/specs/semconv/gen-ai/
export const GenAIAttributes = {
  REQUEST_MODEL: 'gen_ai.request.model',
  REQUEST_TEMPERATURE: 'gen_ai.request.temperature',
  REQUEST_TOP_P: 'gen_ai.request.top_p',
  REQUEST_MAX_TOKENS: 'gen_ai.request.max_tokens',
  RESPONSE_MODEL: 'gen_ai.response.model',
  USAGE_INPUT_TOKENS: 'gen_ai.usage.input_tokens',
  USAGE_OUTPUT_TOKENS: 'gen_ai.usage.output_tokens',
  PROMPT_HASH: 'gen_ai.prompt.hash', // SHA-256 — no PII in traces
  SYSTEM: 'gen_ai.system',
} as const;

// Custom Runbook Sentinel attributes
export const SentinelAttributes = {
  INCIDENT_ID: 'incident.id',
  CORRELATION_ID: 'incident.correlation_id',
  SEVERITY: 'incident.severity',
  SERVICE_ID: 'incident.service_id',
  CONFIDENCE_SCORE: 'agent.confidence_score',
  AGENT_NAME: 'agent.name',
  HITL_STATUS: 'hitl.status',
  ENKRYPT_ACTION: 'enkrypt.action',
} as const;

// Sampling strategy:
// - SEV1 incidents: 100% sampled
// - SEV2/3 incidents: 20% sampled
// - Health checks: 0% sampled
export function getSamplingRate(severity?: string | null): number {
  if (!severity) return 0.1;
  if (severity === 'SEV1') return 1.0;
  if (severity === 'SEV2') return 0.2;
  return 0.05;
}

// Wrap any async function with an OTel span
export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // Set all attributes
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

// Hash a prompt string for audit without storing raw PII
export function hashPromptForTelemetry(prompt: string): string {
  return createHash('sha256').update(prompt, 'utf8').digest('hex');
}

// Extract or propagate OTel traceparent header
export function getCurrentTraceparent(): string | null {
  const span = trace.getActiveSpan();
  if (!span || !isSpanContextValid(span.spanContext())) return null;

  const ctx = span.spanContext();
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags.toString(16).padStart(2, '0')}`;
}
