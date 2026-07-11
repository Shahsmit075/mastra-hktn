import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../lib/db';
import { mastra } from '../mastra/index';

const router = Router();

// POST /v1/incidents — ingest a new alert
const AlertPayloadSchema = z.object({
  source: z.enum(['prometheus', 'pagerduty', 'webhook', 'manual']),
  service_id: z.string(),
  alert_name: z.string(),
  description: z.string(),
  metrics: z.record(z.unknown()).optional(),
  labels: z.record(z.string()).optional(),
  fired_at: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const payload = AlertPayloadSchema.parse(req.body);
    const incidentId = uuidv4();
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    const traceparent = req.headers['traceparent'] as string || null;

    // Create incident record
    await pool.query(
      `INSERT INTO incidents (id, correlation_id, service_id, raw_payload, status)
       VALUES ($1, $2, $3, $4, 'open')`,
      [incidentId, correlationId, payload.service_id, JSON.stringify(payload)]
    );

    // Start Mastra workflow (non-blocking)
    const workflow = mastra.getWorkflow('incident-response');
    const run = await workflow.createRun();
    // Store runId in workflow_state for resume
    const runIdJson = JSON.stringify({ runId: run.runId });
    await pool.query(
      `INSERT INTO workflow_state (incident_id, step_name, status, idempotency_key, traceparent, result_json)
       VALUES ($1, 'run_id', 'pending', $2, $3, $4)
       ON CONFLICT (idempotency_key) DO UPDATE SET result_json = $4, traceparent = $3`,
      [incidentId, `${incidentId}:run_id`, traceparent, runIdJson]
    );
    run.start({
      inputData: {
        rawPayload: JSON.stringify(payload),
        incidentId,
        correlationId,
        traceparent,
      },
    }).catch(err => console.error('Workflow error:', err));

    res.status(202).json({
      incidentId,
      correlationId,
      status: 'accepted',
      message: 'Incident ingested. Triage workflow started.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(422).json({ error: 'Invalid payload', details: err.issues });
      return;
    }
    throw err;
  }
});

export default router;
