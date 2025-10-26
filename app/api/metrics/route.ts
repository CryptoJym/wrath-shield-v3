/**
 * Wrath Shield v3 - Metrics API Endpoint
 *
 * Provides aggregated WHOOP and lifelog metrics for dashboard consumption.
 *
 * Features:
 * - Today's latest recovery, cycle, sleep, and lifelog data
 * - 7-day and 30-day aggregated averages and totals
 * - In-memory caching with 5-minute TTL for performance
 * - Server-side only rendering
 *
 * Performance target: <500ms total render with server-side data fetch
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestRecovery,
  getLatestCycle,
  getLatestSleep,
  getLifelogsForDate,
  getMetricsLastNDays,
  calculateUnbendingScore,
} from '@/lib/db/queries';
import type { Recovery, Cycle, Sleep, DailyMetrics } from '@/lib/db/types';

/**
 * Cached metrics response with TTL
 */
interface CachedMetrics {
  data: MetricsResponse;
  cachedAt: number; // Unix timestamp in milliseconds
}

/**
 * Metrics API response structure
 */
export interface MetricsResponse {
  today: {
    date: string;
    recovery: Recovery | null;
    cycle: Cycle | null;
    sleep: Sleep | null;
    lifelogs: {
      count: number;
      total_manipulations: number;
      wrath_deployed: boolean;
    };
    unbending_score: number | null;
  };
  last7Days: {
    averages: {
      recovery_score: number | null;
      strain: number | null;
      sleep_performance: number | null;
    };
    totals: {
      manipulation_count: number;
      wrath_deployed: number;
    };
    unbending_score_avg: number | null;
  };
  last30Days: {
    averages: {
      recovery_score: number | null;
      strain: number | null;
      sleep_performance: number | null;
    };
    totals: {
      manipulation_count: number;
      wrath_deployed: number;
    };
    unbending_score_avg: number | null;
  };
}

/**
 * In-memory cache with 5-minute TTL
 * Key format: "YYYY-MM-DD" (today's date)
 */
const metricsCache = new Map<string, CachedMetrics>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get current date in YYYY-MM-DD format
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if cached metrics are still valid
 */
function getCachedMetrics(date: string): MetricsResponse | null {
  const cached = metricsCache.get(date);

  if (!cached) {
    return null;
  }

  // Check TTL
  const now = Date.now();
  const age = now - cached.cachedAt;

  if (age > CACHE_TTL_MS) {
    // Expired - remove from cache
    metricsCache.delete(date);
    return null;
  }

  return cached.data;
}

/**
 * Store metrics in cache
 */
function setCachedMetrics(date: string, data: MetricsResponse): void {
  metricsCache.set(date, {
    data,
    cachedAt: Date.now(),
  });
}

/**
 * Clear all cached metrics
 *
 * Primarily used for testing to ensure cache isolation between tests.
 * Can also be used for manual cache invalidation if needed.
 */
export function clearMetricsCache(): void {
  metricsCache.clear();
}

/**
 * Calculate averages from daily metrics array
 */
function calculateAverages(
  metrics: DailyMetrics[]
): {
  recovery_score: number | null;
  strain: number | null;
  sleep_performance: number | null;
  unbending_score_avg: number | null;
} {
  if (metrics.length === 0) {
    return {
      recovery_score: null,
      strain: null,
      sleep_performance: null,
      unbending_score_avg: null,
    };
  }

  // Filter out null values and calculate averages
  const recovery_scores = metrics
    .map((m) => m.recovery_score)
    .filter((s): s is number => s !== null);
  const strains = metrics.map((m) => m.strain).filter((s): s is number => s !== null);
  const sleep_performances = metrics
    .map((m) => m.sleep_performance)
    .filter((s): s is number => s !== null);
  const unbending_scores = metrics
    .map((m) => m.unbending_score)
    .filter((s): s is number => s !== null);

  return {
    recovery_score:
      recovery_scores.length > 0
        ? Math.round(
            recovery_scores.reduce((sum, s) => sum + s, 0) / recovery_scores.length
          )
        : null,
    strain:
      strains.length > 0
        ? Math.round((strains.reduce((sum, s) => sum + s, 0) / strains.length) * 10) / 10
        : null,
    sleep_performance:
      sleep_performances.length > 0
        ? Math.round(
            sleep_performances.reduce((sum, s) => sum + s, 0) / sleep_performances.length
          )
        : null,
    unbending_score_avg:
      unbending_scores.length > 0
        ? Math.round(
            unbending_scores.reduce((sum, s) => sum + s, 0) / unbending_scores.length
          )
        : null,
  };
}

/**
 * Calculate totals from daily metrics array
 */
function calculateTotals(
  metrics: DailyMetrics[]
): {
  manipulation_count: number;
  wrath_deployed: number;
} {
  return {
    manipulation_count: metrics.reduce((sum, m) => sum + m.manipulation_count, 0),
    wrath_deployed: metrics.reduce((sum, m) => sum + m.wrath_deployed, 0),
  };
}

/**
 * GET /api/metrics
 *
 * Returns aggregated metrics for today, 7-day, and 30-day periods.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const today = getCurrentDate();

    // Check cache first
    const cached = getCachedMetrics(today);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=300', // 5 minutes
          'X-Cache': 'HIT',
        },
      });
    }

    // Fetch today's data
    const [recovery, cycle, sleep, lifelogs] = await Promise.all([
      getLatestRecovery(),
      getLatestCycle(),
      getLatestSleep(),
      getLifelogsForDate(today),
    ]);

    // Aggregate lifelog data for today
    const totalManipulations = lifelogs.reduce(
      (sum, log) => sum + log.manipulation_count,
      0
    );
    const wrathDeployed = lifelogs.some((log) => log.wrath_deployed === 1);

    // Get unbending score from today's lifelogs (if available)
    // Note: unbending_score is calculated from manipulation data in the scores table
    const todayUnbendingScore = await calculateUnbendingScore(today);

    // Fetch 7-day and 30-day aggregates
    const [last7DaysMetrics, last30DaysMetrics] = await Promise.all([
      getMetricsLastNDays(7),
      getMetricsLastNDays(30),
    ]);

    // Calculate aggregates
    const last7DaysAverages = calculateAverages(last7DaysMetrics);
    const last7DaysTotals = calculateTotals(last7DaysMetrics);

    const last30DaysAverages = calculateAverages(last30DaysMetrics);
    const last30DaysTotals = calculateTotals(last30DaysMetrics);

    // Construct response
    const response: MetricsResponse = {
      today: {
        date: today,
        recovery,
        cycle,
        sleep,
        lifelogs: {
          count: lifelogs.length,
          total_manipulations: totalManipulations,
          wrath_deployed: wrathDeployed,
        },
        unbending_score: todayUnbendingScore,
      },
      last7Days: {
        averages: {
          recovery_score: last7DaysAverages.recovery_score,
          strain: last7DaysAverages.strain,
          sleep_performance: last7DaysAverages.sleep_performance,
        },
        totals: last7DaysTotals,
        unbending_score_avg: last7DaysAverages.unbending_score_avg,
      },
      last30Days: {
        averages: {
          recovery_score: last30DaysAverages.recovery_score,
          strain: last30DaysAverages.strain,
          sleep_performance: last30DaysAverages.sleep_performance,
        },
        totals: last30DaysTotals,
        unbending_score_avg: last30DaysAverages.unbending_score_avg,
      },
    };

    // Cache the response
    setCachedMetrics(today, response);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
