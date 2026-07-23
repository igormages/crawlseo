import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

/** Lazy Upstash Redis client (KV_REST_API_* or UPSTASH_REDIS_REST_*). */
export function getRedis(): Redis | null {
  if (redis) return redis;

  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}
