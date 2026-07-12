import { Router } from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

// GET /v1/knowledge/conflicts — list synthesis_drafts pending SRE review
router.get('/conflicts', requireRole('sre_lead'), async (_req, res) => {
  try {
    const result = await qdrant.scroll('synthesis_drafts', {
      limit: 20,
      with_payload: true,
      filter: {
        must: [
          { key: 'conflict_score', range: { gte: 0.6 } },
          { key: 'resolution_status', match: { value: 'pending' } },
        ],
      },
    });

    res.json({
      conflicts: result.points.map(p => ({ id: p.id, ...p.payload })),
      total: result.points.length,
    });
  } catch (err: any) {
    // Collection may not exist before first seed run
    if (err?.message?.includes('Not found')) {
      res.json({ conflicts: [], total: 0 });
      return;
    }
    console.error('Knowledge conflicts query failed:', err);
    res.status(500).json({ error: 'Failed to fetch conflicts' });
  }
});

export default router;
