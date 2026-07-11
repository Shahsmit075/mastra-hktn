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
