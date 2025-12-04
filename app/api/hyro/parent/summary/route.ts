/**
 * API Route: GET /api/hyro/parent/summary
 * Returns weekly parent dashboard summary
 */

import { NextResponse } from 'next/server';
import { getParentSummary } from '@/lib/hyro/forge-parent-dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getParentSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching parent summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch parent summary',
      },
      { status: 500 }
    );
  }
}
