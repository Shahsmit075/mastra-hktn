# Guide 07 — Express API: Routes & Middleware

## File: `apps/api/src/server.ts`

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { correlationIdMiddleware } from './middleware/correlationId';
import { rateLimiterMiddleware } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import alertRoutes from './routes/alerts';
import incidentRoutes from './routes/incidents';
import approveRoutes from './routes/approve';
import analyticsRoutes from './routes/analytics';
import knowledgeRoutes from './routes/knowledge';
import { checkDbHealth } from './lib/db';
import { checkRedisHealth } from './lib/redis';

export function createApp() {
  const app = express();

  // ─── Security headers (OWASP) ─────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    frameguard: { action: 'deny' },
  }));

  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    credentials: true,
  }));

  app.use(express.json({ limit: '1mb' }));

  // ─── Request enrichment ────────────────────────────────────────────────────
  app.use(correlationIdMiddleware); // Injects x-correlation-id header
  app.use(rateLimiterMiddleware);   // Redis sliding window (100 req/min)

  // ─── Health check (no auth) ───────────────────────────────────────────────
  app.get('/health', async (_req, res) => {
    const [dbOk, redisOk] = await Promise.all([checkDbHealth(), checkRedisHealth()]);
    const status = dbOk && redisOk ? 'ok' : 'degraded';
    res.status(status === 'ok' ? 200 : 503).json({
      status,
      services: {
        db: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    });
  });

  // ─── Protected routes ─────────────────────────────────────────────────────
  app.use('/v1', authMiddleware);
  app.use('/v1/incidents', alertRoutes);      // POST /v1/incidents (ingest)
  app.use('/v1/incidents', incidentRoutes);   // GET /v1/incidents/:id
  app.use('/v1/incidents', approveRoutes);    // POST /v1/incidents/:id/approve
  app.use('/v1/analytics', analyticsRoutes);  // GET /v1/analytics/mttr
  app.use('/v1/knowledge', knowledgeRoutes);  // GET /v1/knowledge/conflicts

  app.use(errorHandler);
  return app;
}
```

## File: `apps/api/src/index.ts`

```typescript
import 'dotenv/config';
import './lib/otel'; // MUST be first — initializes OTel before any imports
import { createApp } from './server';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = createApp();
app.listen(PORT, () => {
  console.log(`Runbook Sentinel API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
```

## File: `apps/api/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  role: 'on_call_engineer' | 'incident_commander' | 'sre_lead' | 'audit_officer';
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// RBAC guard factory
export function requireRole(...roles: AuthenticatedUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
      return;
    }
    next();
  };
}
```

## File: `apps/api/src/middleware/rateLimiter.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

export async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = `rate_limit:${req.ip}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.pexpire(key, WINDOW_MS);
    const results = await pipeline.exec();

    const count = results?.[0]?.[1] as number;

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - count));

    if (count > MAX_REQUESTS) {
      res.status(429).json({ error: 'Too many requests. Please retry in 60 seconds.' });
      return;
    }

    next();
  } catch {
    // Redis unavailable — fail open
    next();
  }
}
```

## File: `apps/api/src/routes/alerts.ts`

```typescript
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
    workflow.createRun().then(run => {
      run.start({
        inputData: {
          rawPayload: JSON.stringify(payload),
          incidentId,
          correlationId,
          traceparent,
        },
      }).catch(err => console.error('Workflow error:', err));
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
```

## File: `apps/api/src/routes/approve.ts`

```typescript
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
      const run = runs.find(r => r.context?.inputData?.incidentId === incidentId);

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
```

## File: `apps/api/src/middleware/correlationId.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const existing = req.headers['x-correlation-id'] as string;
  const correlationId = existing || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
```

## File: `apps/api/src/middleware/errorHandler.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

## File: `apps/api/src/lib/redis.ts`

import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) return null; // Give up after 3 attempts
    return Math.min(times * 100, 3000);
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Log but never crash — rate limiter is designed to fail open
  console.error('Redis error:', err.message);
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

## File: `apps/api/src/routes/incidents.ts`

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
        remediationPlan: remediationStep?.result_json ?? null,
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

## File: `apps/api/src/routes/analytics.ts`

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

## File: `apps/api/src/routes/knowledge.ts`

import { Router } from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import { requireRole } from '../middleware/auth';

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
