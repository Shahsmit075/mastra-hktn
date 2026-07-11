import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = process.env.NODE_ENV === 'development' ? 500 : 100;

export async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development') {
    next();
    return;
  }
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
