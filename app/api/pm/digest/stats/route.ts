/**
 * PM Digest - Statistics API
 *
 * GET /api/pm/digest/stats
 *
 * Returns just statistics from the digest.
 * Useful for dashboard metrics and monitoring.
 *
 * Query params:
 * - since: ISO timestamp (optional, defaults to 24 hours ago)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDigestStats } from '@/lib/pm/daily-digest';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');

    // Parse since parameter
    let since: Date | undefined;
    if (sinceParam) {
      since = new Date(sinceParam);
      if (isNaN(since.getTime())) {
        return NextResponse.json(
          { error: 'Invalid since parameter. Must be valid ISO timestamp.' },
          { status: 400 }
        );
      }
    }

    const stats = await getDigestStats(since);

    return NextResponse.json({
      success: true,
      stats,
      period: {
        start: (since || new Date(Date.now() - 24 * 60 * 60 * 1000)).toISOString(),
        end: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Digest API] Error getting digest stats:', error);
    return NextResponse.json(
      { error: 'Failed to get digest stats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
