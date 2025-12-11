/**
 * Decision Queue API - Statistics
 *
 * GET: Get decision queue statistics for dashboard/monitoring
 */

import { NextResponse } from 'next/server';
import { getDecisionQueue } from '@/lib/cortex/decision-queue';

// GET /api/cortex/decisions/stats - Get queue statistics
export async function GET() {
  try {
    const queue = getDecisionQueue();
    const stats = await queue.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[API/Decisions] GET stats failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
