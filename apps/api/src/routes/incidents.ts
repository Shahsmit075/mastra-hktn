import { Router } from 'express';
import { pool } from '../lib/db';

const router = Router();

// GET /v1/incidents — list all incidents, newest first
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, status, severity, service_id, correlation_id, created_at, resolved_at, mttr_minutes
       FROM incidents
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json({ incidents: result.rows });
  } catch (err) {
    console.error('Failed to list incidents:', err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /v1/incidents/:id — full incident detail with workflow state and agent outputs
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const incident = await pool.query(`SELECT * FROM incidents WHERE id = $1`, [id]);
    if (!incident.rows.length) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }

    const steps = await pool.query(
      `SELECT step_name, status, result_json, created_at, updated_at
       FROM workflow_state WHERE incident_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const audit = await pool.query(
      `SELECT action, user_id, timestamp FROM audit_logs
       WHERE incident_id = $1 ORDER BY timestamp ASC`,
      [id]
    );

    const triageStep = steps.rows.find(s => s.step_name === 'triage');
    const remediationStep = steps.rows.find(s => s.step_name === 'remediation');
    const postMortemStep = steps.rows.find(s => s.step_name === 'post_mortem');

    res.json({
      ...incident.rows[0],
      workflow: {
        steps: steps.rows,
        triageResult: triageStep?.result_json ?? null,
        remediationPlan: remediationStep?.result_json?.parsedPlan ?? remediationStep?.result_json ?? null,
        postMortem: postMortemStep?.result_json ?? null,
      },
      auditLog: audit.rows,
    });
  } catch (err) {
    console.error('Failed to fetch incident:', err);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

export default router;
