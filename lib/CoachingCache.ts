/**
 * Wrath Shield v3 - Coaching Response Cache
 *
 * Provides caching and deduplication for coaching responses to avoid
 * redundant LLM API calls when context hasn't meaningfully changed.
 *
 * Features:
 * - Cache by date + time period (AM/PM) + context hash
 * - Automatic cache invalidation after 24 hours
 * - Context-aware caching (different contexts get different responses)
 * - In-memory storage with TTL
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import type { CoachingResponse } from './OpenRouterClient';
import type { CoachingContext } from './CoachingEngine';
import crypto from 'crypto';

// Prevent client-side imports
ensureServerOnly('lib/CoachingCache');

/**
 * Cached coaching response with metadata
 */
interface CachedResponse {
  response: CoachingResponse;
  cachedAt: number; // Unix timestamp in milliseconds
  contextHash: string;
  timePeriod: 'AM' | 'PM';
  date: string; // YYYY-MM-DD
}

/**
 * Time period determination (AM = before noon, PM = noon and after)
 * Uses local hours for user's timezone context
 */
export function getTimePeriod(): 'AM' | 'PM' {
  const hour = new Date().getHours();
  return hour < 12 ? 'AM' : 'PM';
}

/**
 * Generate stable hash of coaching context for cache key
 *
 * Hash includes:
 * - WHOOP metrics (recovery, strain, sleep)
 * - Manipulation stats (count, wrath deployed)
 * - Memory IDs (for semantic context tracking)
 * - Anchor IDs (for grounding context tracking)
 *
 * @param context - Assembled coaching context
 * @returns SHA-256 hash of context (hex string)
 */
export function hashContext(context: CoachingContext): string {
  // Extract significant context fields that should trigger cache miss when changed
  const significantContext = {
    // WHOOP metrics (rounded to reduce hash churn from minor fluctuations)
    recovery: context.dailyContext.recovery
      ? Math.round(context.dailyContext.recovery.score ?? 0)
      : null,
    strain: context.dailyContext.cycle
      ? Math.round((context.dailyContext.cycle.strain ?? 0) * 10) / 10 // Round to 1 decimal
      : null,
    sleep: context.dailyContext.sleep
      ? Math.round(context.dailyContext.sleep.performance ?? 0)
      : null,

    // Manipulation detection results
    totalManipulations: context.dailyContext.totalManipulations,
    wrathDeployed: context.dailyContext.wrathDeployed,
    lifelogCount: context.dailyContext.lifelogs.length,

    // Memory context (IDs only, not full text - changes when different memories are retrieved)
    memoryIds: context.relevantMemories.map((m) => m.id).sort(),
    anchorIds: context.anchors.map((a) => a.id).sort(),

    // Date (included to ensure cache doesn't span multiple days)
    date: context.dailyContext.date,
  };

  // Generate stable JSON representation
  const contextString = JSON.stringify(significantContext);

  // SHA-256 hash for uniqueness and reasonable length
  return crypto.createHash('sha256').update(contextString).digest('hex');
}

/**
 * Coaching response cache with TTL and context-aware deduplication
 */
export class CoachingCache {
  private cache: Map<string, CachedResponse> = new Map();
  private readonly ttlMs: number;

  /**
   * @param ttlMs - Time-to-live in milliseconds (default: 24 hours)
   */
  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from date, time period, and context hash
   *
   * @param date - Date in YYYY-MM-DD format
   * @param timePeriod - AM or PM
   * @param contextHash - SHA-256 hash of coaching context
   * @returns Cache key string
   */
  private getCacheKey(date: string, timePeriod: 'AM' | 'PM', contextHash: string): string {
    return `${date}:${timePeriod}:${contextHash}`;
  }

  /**
   * Check if cached response exists and is still valid
   *
   * @param date - Date in YYYY-MM-DD format
   * @param timePeriod - AM or PM
   * @param contextHash - SHA-256 hash of coaching context
   * @returns Cached response if valid, null otherwise
   */
  get(date: string, timePeriod: 'AM' | 'PM', contextHash: string): CoachingResponse | null {
    const key = this.getCacheKey(date, timePeriod, contextHash);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check TTL
    const now = Date.now();
    const age = now - cached.cachedAt;

    if (age > this.ttlMs) {
      // Expired - remove from cache
      this.cache.delete(key);
      return null;
    }

    return cached.response;
  }

  /**
   * Store coaching response in cache
   *
   * @param date - Date in YYYY-MM-DD format
   * @param timePeriod - AM or PM
   * @param contextHash - SHA-256 hash of coaching context
   * @param response - Coaching response to cache
   */
  set(
    date: string,
    timePeriod: 'AM' | 'PM',
    contextHash: string,
    response: CoachingResponse
  ): void {
    const key = this.getCacheKey(date, timePeriod, contextHash);

    this.cache.set(key, {
      response,
      cachedAt: Date.now(),
      contextHash,
      timePeriod,
      date,
    });
  }

  /**
   * Get cached response for current context
   *
   * Convenience method that automatically determines time period and hashes context.
   *
   * @param context - Assembled coaching context
   * @returns Cached response if valid, null otherwise
   */
  getForContext(context: CoachingContext): CoachingResponse | null {
    const date = context.dailyContext.date;
    const timePeriod = getTimePeriod();
    const contextHash = hashContext(context);

    return this.get(date, timePeriod, contextHash);
  }

  /**
   * Store response for current context
   *
   * Convenience method that automatically determines time period and hashes context.
   *
   * @param context - Assembled coaching context
   * @param response - Coaching response to cache
   */
  setForContext(context: CoachingContext, response: CoachingResponse): void {
    const date = context.dailyContext.date;
    const timePeriod = getTimePeriod();
    const contextHash = hashContext(context);

    this.set(date, timePeriod, contextHash, response);
  }

  /**
   * Clear all cached responses
   *
   * Useful for testing or manual cache invalidation.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries from cache
   *
   * Should be called periodically to prevent unbounded memory growth.
   * Returns number of entries removed.
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, cached] of this.cache.entries()) {
      const age = now - cached.cachedAt;
      if (age > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics for observability
   *
   * @returns Cache stats (size, oldest entry age, etc.)
   */
  getStats(): {
    size: number;
    oldestEntryAge: number | null;
    newestEntryAge: number | null;
  } {
    const now = Date.now();
    let oldestAge: number | null = null;
    let newestAge: number | null = null;

    for (const cached of this.cache.values()) {
      const age = now - cached.cachedAt;

      if (oldestAge === null || age > oldestAge) {
        oldestAge = age;
      }

      if (newestAge === null || age < newestAge) {
        newestAge = age;
      }
    }

    return {
      size: this.cache.size,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge,
    };
  }
}

/**
 * Singleton cache instance for server-side use
 */
let cacheInstance: CoachingCache | null = null;

/**
 * Get singleton coaching cache instance
 *
 * @returns Singleton CoachingCache
 */
export function getCoachingCache(): CoachingCache {
  if (!cacheInstance) {
    cacheInstance = new CoachingCache();
  }
  return cacheInstance;
}
