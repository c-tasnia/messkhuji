import { Redis } from '@upstash/redis';
import { env } from './env';

// Upstash's REST-based client works over plain HTTPS, which is what makes it
// viable inside short-lived Vercel serverless functions (no long-lived TCP
// socket to manage/leak across invocations, unlike a classic ioredis client).
export const redis =
  env.upstashRedisUrl && env.upstashRedisToken
    ? new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
    : null;

export const CACHE_TTL_SECONDS = {
  listingDetail: 60 * 5, // 5 min
  listingSearch: 60 * 2, // 2 min
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch {
    // Cache is a performance optimization, never a hard dependency —
    // a Redis outage should degrade to DB reads, not break the API.
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // swallow — see cacheGet rationale
  }
}

export async function cacheDelByPrefix(prefix: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
  } catch {
    // swallow
  }
}
