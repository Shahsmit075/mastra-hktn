# Guide 09 — OpenTelemetry Instrumentation

## File: `apps/api/src/lib/otel.ts`

This file MUST be imported FIRST in `apps/api/src/index.ts` before any other imports.

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

const useExternalExport = process.env.OTEL_EXPORT_ENABLED === 'true';

// ─── Exporter: Honeycomb (Phase 2) or Console (Phase 1 / local) ───────────────
const exporter = useExternalExport
  ? new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT!,
      headers: Object.fromEntries(
        (process.env.OTEL_EXPORTER_OTLP_HEADERS || '')
          .split(',')
          .map(h => h.split('='))
          .filter(parts => parts.length === 2)
      ),
    })
  : new ConsoleSpanExporter(); // Outputs to stdout for local dev

// ─── Processor: Batch for production, Simple for local ────────────────────────
const processor = useExternalExport
  ? new BatchSpanProcessor(exporter)
  : new SimpleSpanProcessor(exporter);

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'runbook-sentinel-api',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessor: processor,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // Too noisy
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('OTel SDK shut down gracefully'))
    .catch(err => console.error('OTel shutdown error:', err))
    .finally(() => process.exit(0));
});

console.log(`OTel initialized. Export: ${useExternalExport ? 'Honeycomb OTLP' : 'Console (local)'}`);
```

## GenAI Semantic Convention Attributes

Every agent call MUST emit a span with these attributes. Add this utility:

### File: `apps/api/src/lib/telemetry.ts`

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
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
  if (!span || !span.spanContext().isValid()) return null;

  const ctx = span.spanContext();
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags.toString(16).padStart(2, '0')}`;
}
```

## How to Instrument an Agent Call

Every agent execution should be wrapped like this:

```typescript
import { withSpan, GenAIAttributes, SentinelAttributes, hashPromptForTelemetry } from '../lib/telemetry';

// Inside a workflow step execute() function:
const result = await withSpan(
  'gen_ai.triage_agent',
  {
    [GenAIAttributes.REQUEST_MODEL]: process.env.FEATHERLESS_MODEL || 'Qwen/Qwen2.5-72B-Instruct',
    [GenAIAttributes.REQUEST_TEMPERATURE]: 0.1,
    [GenAIAttributes.SYSTEM]: 'featherless',
    [GenAIAttributes.PROMPT_HASH]: hashPromptForTelemetry(prompt),
    [SentinelAttributes.INCIDENT_ID]: incidentId,
    [SentinelAttributes.CORRELATION_ID]: correlationId,
    [SentinelAttributes.AGENT_NAME]: 'TriageAgent',
  },
  async () => {
    const response = await triageAgent.generate(prompt, { output: TriageSchema });
    return response;
  }
);
```

## HITL Trace Continuity: How It Works

When a workflow suspends at the `hitl_gate` step:

1. Call `getCurrentTraceparent()` and store the result in `workflow_state.traceparent`
2. The OTel span ends when the workflow suspends — this is by design
3. When the IC approves via the API, retrieve `traceparent` from `workflow_state`
4. Deserialize and inject it into the new request context:

```typescript
import { propagation, context, ROOT_CONTEXT } from '@opentelemetry/api';

function resumeWithTraceparent(traceparent: string) {
  const carrier = { traceparent };
  // Re-link to the original trace
  const ctx = propagation.extract(ROOT_CONTEXT, carrier);
  return context.with(ctx, () => {
    // All spans created inside this context will be children of the original trace
  });
}
```

## Phase 1 vs Phase 2 OTel Strategy

| Phase | Exporter | Processor | Where to See Traces |
|---|---|---|---|
| Phase 1 (local dev) | `ConsoleSpanExporter` | `SimpleSpanProcessor` | Terminal stdout |
| Phase 2 (live demo) | `OTLPTraceExporter` | `BatchSpanProcessor` | Honeycomb dashboard |

To switch: set `OTEL_EXPORT_ENABLED=true` and fill in Honeycomb env vars. No code changes needed.
