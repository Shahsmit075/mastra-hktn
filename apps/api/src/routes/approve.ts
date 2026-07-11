import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { pool } from '../lib/db';
import { mastra } from '../mastra/index';

const router = Router();

// POST /v1/incidents/:id/approve — IC approves or rejects
router.post('/:id/approve',
  requireRole('incident_commander', 'sre_lead'),
  async (req, res) => {
    const { id: incidentId } = req.params;
    const { approved, reason } = z.object({
      approved: z.boolean(),
      reason: z.string().optional(),
    }).parse(req.body);

    // Get workflow run ID from DB
    const state = await pool.query(
      `SELECT result_json FROM workflow_state
       WHERE incident_id = $1 AND step_name = 'hitl_gate' AND status = 'suspended'`,
      [incidentId]
    );

    if (!state.rows.length) {
      res.status(404).json({ error: 'No pending approval found for this incident' });
      return;
    }

    // Resume the suspended Mastra workflow
    try {
      const workflow = mastra.getWorkflow('incident-response');
      // Get the run associated with this incident
      // NOTE: In production, store runId in workflow_state table for direct lookup
      const runs = await workflow.getRuns();
      const run = runs.find((r: any) => r.context?.inputData?.incidentId === incidentId);

      if (!run) {
        res.status(404).json({ error: 'Workflow run not found' });
        return;
      }

      await run.resume({
        step: 'hitl_gate',
        resumeData: {
          approved,
          approverId: req.user!.id,
          reason,
        },
      });

      res.json({
        incidentId,
        status: approved ? 'executing' : 'rejected',
        approvedBy: req.user!.id,
      });
    } catch (err) {
      console.error('Resume failed:', err);
      res.status(500).json({ error: 'Failed to resume workflow' });
    }
  }
);

export default router;
