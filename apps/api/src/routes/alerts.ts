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
    const workflow = mastra.getWorkflow('incidentWorkflow');
    workflow.createRun().then((run: any) => {
      run.start({
        inputData: {
          rawPayload: JSON.stringify(payload),
          incidentId,
          correlationId,
          traceparent,
        },
      }).catch((err: any) => {
        console.error(`[${correlationId}] Workflow error:`, err);
        // Fire-and-forget DB update for failure tracking
        pool.query(
          `UPDATE incidents SET status = 'failed', resolution_plan = $1 WHERE id = $2`,
          [`Workflow crashed: ${err.message}`, incidentId]
        ).catch(() => {});
      });
    });

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
