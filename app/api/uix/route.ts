/**
 * Wrath Shield v3 - UIX Metrics API Route
 *
 * GET /api/uix - Retrieve comprehensive UIX (User Interface Experience) metrics
 *
 * Returns UIXMetrics interface:
 * {
 *   overall_score: number,        // 0-100 confidence score
 *   pillars: {
 *     word: number,               // 0-100, weight 0.4
 *     action: number,             // 0-100, weight 0.4
 *     body: number                // 0-100, weight 0.2
 *   },
 *   delta: number,                // Change from 24h ago
 *   open_flags: number,           // Count of pending flags
 *   penalties: {
 *     open_flags_penalty: number, // -1 per open flag
 *     recency_factor: number      // 0-1, average tweak recency
 *   },
 *   top_fixes: Array<{
 *     flag_id: string,
 *     original_text: string,
 *     suggested_lift: number      // Estimated UIX gain
 *   }>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getTweaksLastNHours,
  getAllFlags,
  getLatestRecovery,
} from '@/lib/db/queries';
import {
  calculateUIXMetrics,
  getPreviousUIXScore,
  type UIXMetrics,
} from '@/lib/metrics';

/**
 * GET /api/uix
 * Return comprehensive UIX metrics with pillars, delta, and suggestions
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch data needed for UIX calculation
    const [tweaks, flags, latestRecovery] = await Promise.all([
      getTweaksLastNHours(72), // Last 72 hours for recency weighting
      getAllFlags(), // All flags to count open ones
      getLatestRecovery(), // Latest WHOOP recovery for Body pillar
    ]);

    // Extract recovery score (0-100) from latest recovery data
    const recoveryScore = latestRecovery?.score ?? null;

    // Calculate previous UIX score (24h ago) for delta calculation
    const previousScore = await getPreviousUIXScore(tweaks, flags, recoveryScore);

    // Calculate current UIX metrics
    const metrics: UIXMetrics = calculateUIXMetrics(
      tweaks,
      flags,
      previousScore,
      recoveryScore
    );

    // Return comprehensive metrics
    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=60', // 1-minute cache
      },
    });
  } catch (error) {
    console.error('[UIX API] Error calculating metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error while calculating UIX metrics' },
      { status: 500 }
    );
  }
}
