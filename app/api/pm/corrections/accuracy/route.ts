/**
 * PM Corrections Accuracy API
 *
 * GET /api/pm/corrections/accuracy - Get accuracy metrics
 *
 * Returns AI suggestion accuracy statistics based on user corrections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import { getAccuracyMetrics } from '@/lib/pm/correction-feedback';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  ensureServerOnly('api/pm/corrections/accuracy');

  try {
    // Get accuracy metrics
    const metrics = await getAccuracyMetrics();

    return NextResponse.json({
      ok: true,
      ...metrics,
    });
  } catch (error) {
    console.error('[PM Corrections Accuracy API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
