export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getBaselines, getTodaySnapshot } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rangeStr = searchParams.get('range');
    const n = rangeStr ? Math.max(1, Math.min(365, parseInt(rangeStr, 10) || 30)) : null;
    const today = getTodaySnapshot();

    if (n) {
      const b = getBaselines(n);
      return NextResponse.json({ ok: true, b, today, range: n });
    }

    // Backward-compatible shape
    const b30 = getBaselines(30);
    const b90 = getBaselines(90);
    return NextResponse.json({ ok: true, b30, b90, today });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
