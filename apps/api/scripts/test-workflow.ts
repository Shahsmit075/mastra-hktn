import 'dotenv/config';
import { mastra } from '../src/mastra/index';
import jwt from 'jsonwebtoken';
import { pool } from '../src/lib/db';

const token = jwt.sign(
  { id: 'test-ic-01', role: 'incident_commander', email: 'ic@test.com' },
  process.env.JWT_SECRET || 'test-secret',
  { expiresIn: '1h' }
);
console.log('TEST JWT:', token);

const testIncidentId = '33333333-3333-4444-5555-666666666666';

// Pre-insert the incident into the DB to satisfy foreign key constraints
await pool.query(
  `INSERT INTO incidents (id, service_id, correlation_id, raw_payload, status)
   VALUES ($1, 'payments-service', 'test-correlation-003', $2, 'open')
   ON CONFLICT (id) DO NOTHING`,
  [testIncidentId, JSON.stringify({ error_rate: 0.082 })]
);

const workflow = mastra.getWorkflow('incident-response');
const run = await workflow.createRun();
const result = await run.start({
  inputData: {
    rawPayload: JSON.stringify({
      source: 'prometheus',
      service_id: 'payments-service',
      alert_name: 'HighErrorRate',
      description: 'Error rate 8.2%. P99 4.2s. Connection pool exhausted.',
      metrics: { error_rate: 0.082, p99_latency_ms: 4200 }
    }),
    incidentId: testIncidentId,
    correlationId: 'test-correlation-003',
    traceparent: null,
  },
});
await pool.end();

console.log('Workflow result:', JSON.stringify(result, null, 2));
