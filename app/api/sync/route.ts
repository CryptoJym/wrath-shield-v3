/**
 * Wrath Shield v3 - Sync API
 *
 * GET /api/sync?days=7&whoop=1&limitless=1
 * POST /api/sync { days?: number, start_date?: string, end_date?: string, whoop?: boolean, limitless?: boolean }
 *
 * Runs WHOOP pulls for last N days and/or Limitless backfill/sync, returns deltas and last dates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWhoopClient } from '@/lib/WhoopClient';
import { getLimitlessClient } from '@/lib/LimitlessClient';

function makeRange(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 86400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function getCounts() {
  const { Database } = await import('@/lib/db/Database');
  const db = Database.getInstance().getRawDb() as any;
  const c = (t: string) => (db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as any).c as number;
  const maxDate = (t: string) => (db.prepare(`SELECT MAX(date) as d FROM ${t}`).get() as any).d as string | null;
  return {
    cycles: c('cycles'), recoveries: c('recoveries'), sleeps: c('sleeps'), lifelogs: c('lifelogs'),
    cycles_last: maxDate('cycles'), recoveries_last: maxDate('recoveries'), sleeps_last: maxDate('sleeps'), lifelogs_last: maxDate('lifelogs'),
  };
}

async function runSync(params: { days?: number; start_date?: string; end_date?: string; whoop?: boolean; limitless?: boolean; }) {
  const days = Math.max(1, Math.min(31, params.days ?? 1));
  const doWhoop = params.whoop !== false; // default true
  const doLimitless = params.limitless !== false; // default true
  const before = await getCounts();
  let whoopPulled = 0;
  let limitlessPulled = 0;
  const errors: string[] = [];

  if (doWhoop) {
    try {
      const wc = getWhoopClient();
      const dates = makeRange(days);
      for (const d of dates) {
        try {
          const cycles = await wc.fetchCyclesForDb(d, d);
          const recs = await wc.fetchRecoveriesForDb(d, d);
          const sleeps = await wc.fetchSleepsForDb(d, d);
          const { insertCycles, insertRecoveries, insertSleeps } = await import('@/lib/db/queries');
          if (cycles.length) { insertCycles(cycles); whoopPulled += cycles.length; }
          if (recs.length) { insertRecoveries(recs); whoopPulled += recs.length; }
          if (sleeps.length) { insertSleeps(sleeps); whoopPulled += sleeps.length; }
        } catch (e: any) {
          errors.push(`WHOOP ${d}: ${String(e)}`);
        }
      }
    } catch (e: any) {
      errors.push(`WHOOP auth/client: ${String(e)}`);
    }
  }

  if (doLimitless) {
    try {
      const ll = getLimitlessClient();
      if (params.start_date) {
        limitlessPulled = await ll.backfillRangeForDb(params.start_date, params.end_date);
      } else {
        // incremental
        limitlessPulled = await ll.syncNewLifelogs();
      }
    } catch (e: any) {
      errors.push(`Limitless: ${String(e)}`);
    }
  }

  const after = await getCounts();
  return { before, after, whoopPulled, limitlessPulled, errors };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '1', 10) || 1;
  const whoop = (searchParams.get('whoop') ?? '1') !== '0';
  const limitless = (searchParams.get('limitless') ?? '1') !== '0';
  const start_date = searchParams.get('start_date') || undefined;
  const end_date = searchParams.get('end_date') || undefined;
  const result = await runSync({ days, whoop, limitless, start_date, end_date });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const days = Math.max(1, Math.min(31, Number(body?.days ?? 1)));
  const whoop = body?.whoop !== false;
  const limitless = body?.limitless !== false;
  const start_date = body?.start_date as string | undefined;
  const end_date = body?.end_date as string | undefined;
  const result = await runSync({ days, whoop, limitless, start_date, end_date });
  return NextResponse.json({ ok: true, ...result });
}

