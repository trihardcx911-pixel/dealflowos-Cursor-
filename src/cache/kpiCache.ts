/**
 * Redis caching layer for KPI and Analytics queries
 * Caches expensive SQL queries for 30-60 seconds
 */

import Redis from "ioredis";
import { env } from "../config/env";

let redis: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedis(): Redis | null {
  if (!env.REDIS_URL) {
    console.warn("[cache] REDIS_URL not set, caching disabled");
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis(env.REDIS_URL);
      redis.on("error", (err: Error) => console.error("[cache] Redis error:", err));
    } catch (err) {
      console.error("[cache] Failed to connect to Redis:", err);
      redis = null;
    }
  }

  return redis;
}

/**
 * Get cached value by key
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;

    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("[cache] getCached error:", err);
    return null;
  }
}

/**
 * Set cached value with TTL (default 60 seconds)
 */
export async function setCached(key: string, value: any, ttl: number = 60): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    await client.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.error("[cache] setCached error:", err);
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    await client.del(key);
  } catch (err) {
    console.error("[cache] deleteCached error:", err);
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function deletePattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (err) {
    console.error("[cache] deletePattern error:", err);
  }
}

/**
 * Cache key generators for consistent key naming
 */
export const CacheKeys = {
  kpi: (orgId: string) => `kpi:${orgId}`,
  kpiFull: (orgId: string) => `kpi:full:${orgId}`,
  pipeline: (orgId: string) => `pipeline:${orgId}`,
  analytics: (orgId: string, days: number) => `analytics:${orgId}:${days}`,
  revenue: (orgId: string) => `revenue:${orgId}`,
  leadCount: (orgId: string) => `leads:count:${orgId}`,
  
  // Invalidate all org caches
  orgPattern: (orgId: string) => `*:${orgId}*`,
};

/**
 * Invalidate all caches for an organization
 * Call this when leads/deals are created/updated
 */
export async function invalidateOrgCache(orgId: string): Promise<void> {
  await deletePattern(CacheKeys.orgPattern(orgId));
}

/**
 * Wrapper to cache async function results
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  // Try to get from cache first
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await setCached(key, result, ttl);
  
  return result;
}
