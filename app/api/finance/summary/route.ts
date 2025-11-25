import { NextResponse } from 'next/server';
import { listByDateRange } from '../../../../lib/finance/store';
import { currentUserOrThrow } from '../../../../lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cycleWindow(today = new Date(), startDay = 8) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const start = new Date(y, d >= startDay ? m : m - 1, startDay);
  const end = new Date(y, d >= startDay ? m + 1 : m, startDay);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const qsStart = searchParams.get('start');
    const qsEnd = searchParams.get('end');
    const startDay = parseInt(process.env.FINANCE_CYCLE_START_DAY || '8', 10);
    const { start, end } = qsStart && qsEnd
      ? { start: new Date(qsStart), end: new Date(qsEnd) }
      : cycleWindow(new Date(), startDay);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const rows = listByDateRange(startStr, endStr, userId);
    const buckets: Record<string, number> = {};
    for (const r of rows) {
      const b = r.bucket || 'unknown';
      buckets[b] = (buckets[b] || 0) + r.amount;
    }

    // 90-day lookback for dashboards when current cycle is empty
    const back90Start = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const rows90 = listByDateRange(back90Start.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10), userId);
    const buckets90: Record<string, number> = {};
    for (const r of rows90) {
      const b = r.bucket || 'unknown';
      buckets90[b] = (buckets90[b] || 0) + r.amount;
    }

    return NextResponse.json({
      window: { start: startStr, end: endStr },
      buckets,
      count: rows.length,
      back90: { start: back90Start.toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10), buckets: buckets90, count: rows90.length },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'finance summary failed', buckets: {}, count: 0 }, { status: 200 });
  }
}
