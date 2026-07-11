import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 500;

export async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = `rate_limit:${req.ip}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, WINDOW_MS);
    }

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
