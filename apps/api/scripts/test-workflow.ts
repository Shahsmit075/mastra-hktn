import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { mastra } from '../src/mastra/index';

async function main() {
  const token = jwt.sign(
    { id: 'test-ic-01', role: 'incident_commander', email: 'ic@test.com' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
  console.log('TEST JWT:', token);

  const incidentId = 'd3b07384-d113-4ec6-a558-450f6b4d3202';
  const correlationId = 'test-correlation-001';
  
  // Insert incident to database first
  const { pool } = await import('../src/lib/db');
  await pool.query(
    `INSERT INTO incidents (id, correlation_id, service_id, raw_payload, status)
     VALUES ($1, $2, $3, $4, 'open') ON CONFLICT DO NOTHING`,
    [incidentId, correlationId, 'payments-service', JSON.stringify({
      source: 'prometheus',
      service_id: 'payments-service',
      alert_name: 'HighErrorRate',
      description: 'Error rate 8.2%. P99 4.2s. Connection pool exhausted.',
      metrics: { error_rate: 0.082, p99_latency_ms: 4200 },
    })]
  );

  const workflow = mastra.getWorkflow('incidentWorkflow');
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: {
      rawPayload: JSON.stringify({
        source: 'prometheus',
        service_id: 'payments-service',
        alert_name: 'HighErrorRate',
        description: 'Error rate 8.2%. P99 4.2s. Connection pool exhausted.',
        metrics: { error_rate: 0.082, p99_latency_ms: 4200 },
      }),
      incidentId,
      correlationId,
      traceparent: null,
    },
  });
  console.log('Workflow result:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
