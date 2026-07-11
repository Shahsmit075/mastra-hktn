import { Router } from 'express';
import { pool } from '../lib/db';

const router = Router();

// GET /v1/analytics/mttr — MTTR trend data for the dashboard chart
router.get('/mttr', async (_req, res) => {
  try {
    const weeklyTrend = await pool.query(
      `SELECT
         service_id,
         date_trunc('week', created_at) AS week,
         ROUND(AVG(mttr_minutes)) AS avg_mttr,
         COUNT(*) AS incident_count,
         COUNT(CASE WHEN severity = 'SEV1' THEN 1 END) AS sev1_count
       FROM incidents
       WHERE status = 'resolved'
         AND resolved_at > NOW() - INTERVAL '90 days'
         AND mttr_minutes IS NOT NULL
       GROUP BY service_id, date_trunc('week', created_at)
       ORDER BY week ASC`
    );

    const p50ByService = await pool.query(
      `SELECT
         service_id,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mttr_minutes) AS p50_mttr,
         COUNT(*) AS total_incidents
       FROM incidents
       WHERE status = 'resolved'
         AND resolved_at > NOW() - INTERVAL '90 days'
         AND mttr_minutes IS NOT NULL
       GROUP BY service_id`
    );

    res.json({
      weeklyTrend: weeklyTrend.rows,
      p50ByService: p50ByService.rows,
    });
  } catch (err) {
    console.error('Analytics query failed:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
