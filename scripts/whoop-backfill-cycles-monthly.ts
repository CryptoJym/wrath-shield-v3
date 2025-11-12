/*
  Backfill WHOOP cycles month-by-month, as far back as we have other signals (recoveries/sleeps)
  Usage: npx tsx scripts/whoop-backfill-cycles-monthly.ts
*/
import path from 'path';
try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') }); } catch {}

import { getWhoopClient } from '../lib/WhoopClient';
import { insertCycles } from '../lib/db/queries';
import { Database } from '../lib/db/Database';

function monthBounds(year: number, monthIdx0: number) {
  const start = new Date(Date.UTC(year, monthIdx0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIdx0 + 1, 0, 23, 59, 59));
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { start: iso(start), end: iso(end) };
}

function toYearMonth(dateStr: string) {
  const [y, m] = dateStr.split('-').map(Number);
  return { y, m: m - 1 };
}

async function main() {
  const db = Database.getInstance().getRawDb() as any;
  const getMinD = (t: string) => (db.prepare(`SELECT MIN(date) as d FROM ${t}`).get() as any).d as string | null;
  const minRec = getMinD('recoveries');
  const minSleep = getMinD('sleeps');
  const anchor = [minRec, minSleep].filter(Boolean).sort()[0] || new Date(Date.now() - 365*24*3600*1000).toISOString().slice(0,10);

  const whoop = getWhoopClient();
  const today = new Date();
  const startYM = toYearMonth(anchor);
  console.log(`==> Cycles monthly backfill from ${anchor} to ${today.toISOString().slice(0,10)}`);

  let inserted = 0;
  for (let y = startYM.y; y <= today.getUTCFullYear(); y++) {
    const mStart = (y === startYM.y) ? startYM.m : 0;
    const mEnd = (y === today.getUTCFullYear()) ? today.getUTCMonth() : 11;
    for (let m = mStart; m <= mEnd; m++) {
      const { start, end } = monthBounds(y, m);
      console.log(`Fetching cycles: ${start.slice(0,10)}..${end.slice(0,10)}`);
      try {
        const recs = await whoop.fetchCyclesForDb(start, end);
        if (recs.length) { insertCycles(recs); inserted += recs.length; console.log(`  +${recs.length}`); }
      } catch (e) {
        console.warn(`  warn ${y}-${m+1}:`, (e as Error).message);
      }
    }
  }
  console.log(`==> Cycles monthly backfill done, inserted ${inserted}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

