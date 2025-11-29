/**
 * PM Dashboard API
 *
 * GET /api/pm/dashboard - Returns complete PM dashboard data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPMDashboardData } from '@/lib/pm/integration';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const dashboardData = await getPMDashboardData();

    return NextResponse.json({
      ok: true,
      ...dashboardData,
    });
  } catch (error) {
    console.error('[PM Dashboard API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
