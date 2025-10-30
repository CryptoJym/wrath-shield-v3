/**
 * Wrath Shield v3 - Flags API Route
 *
 * Provides access to manipulation detection flags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingFlags, getResolvedFlags, getAllFlags } from '@/lib/db/queries';

/**
 * GET /api/flags
 * Returns flags based on status filter
 *
 * Query parameters:
 * - status: 'pending' | 'resolved' | 'all' (default: 'all')
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    let flags;
    if (status === 'pending') {
      flags = getPendingFlags();
    } else if (status === 'resolved') {
      flags = getResolvedFlags();
    } else {
      flags = getAllFlags();
    }

    return NextResponse.json(
      { flags },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=0' },
      }
    );
  } catch (error) {
    console.error('[Flags API] Error:', error);
    return NextResponse.json(
      { flags: [], error: 'Failed to fetch flags' },
      { status: 500 }
    );
  }
}
