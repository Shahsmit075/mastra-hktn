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
