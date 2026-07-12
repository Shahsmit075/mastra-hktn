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
import demoRoutes from './routes/demo';
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

  // ─── Unprotected routes (Showcase Demo) ──────────────────────────────────
  app.use('/v1/demo', demoRoutes);

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
