/**
 * PM Digest - Actionable Items API
 *
 * GET /api/pm/digest/actionable
 *
 * Returns just proposals and escalations (items needing attention).
 * Useful for dashboard widgets and notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionableItems } from '@/lib/pm/daily-digest';

export async function GET(request: NextRequest) {
  try {
    const actionable = await getActionableItems();

    return NextResponse.json({
      success: true,
      proposals: actionable.proposals,
      escalations: actionable.escalations,
      total_actionable: actionable.proposals.length + actionable.escalations.length,
    });
  } catch (error) {
    console.error('[Digest API] Error getting actionable items:', error);
    return NextResponse.json(
      { error: 'Failed to get actionable items', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
