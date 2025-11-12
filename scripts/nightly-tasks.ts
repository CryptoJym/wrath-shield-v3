/*
  Nightly scheduler tasks for Wrath Shield v3
  - Pull WHOOP (yesterday & today)
  - Sync Limitless new lifelogs
  - Rebuild psych analysis and import to DB
*/
import { getWhoopClient } from '../lib/WhoopClient';
import { getLimitlessClient } from '../lib/LimitlessClient';
import { insertCycles, insertRecoveries, insertSleeps } from '../lib/db/queries';
import { execSync } from 'child_process';

function isoDaySpan(d: Date) {
  const date = d.toISOString().slice(0, 10); // YYYY-MM-DD
  return { start: date, end: date };
}

async function pullWhoopFor(date: string) {
  const whoop = getWhoopClient();
  try {
    const cycles = await whoop.fetchCyclesForDb(date, date);
    if (cycles.length) insertCycles(cycles);
  } catch (e) { console.error('[nightly] WHOOP cycles', date, e); }
  try {
    const recs = await whoop.fetchRecoveriesForDb(date, date);
    if (recs.length) insertRecoveries(recs);
  } catch (e) { console.error('[nightly] WHOOP recoveries', date, e); }
  try {
    const sleeps = await whoop.fetchSleepsForDb(date, date);
    if (sleeps.length) insertSleeps(sleeps);
  } catch (e) { console.error('[nightly] WHOOP sleeps', date, e); }
}

async function main() {
  console.log('==> Nightly tasks start');
  // WHOOP: yesterday + today
  const today = new Date();
  const y = new Date(Date.now() - 24*3600*1000);
  for (const d of [y, today]) {
    const day = d.toISOString().slice(0,10);
    console.log('Pulling WHOOP for', day);
    await pullWhoopFor(day);
  }

  // Limitless incremental sync
  try {
    console.log('Syncing Limitless new lifelogs...');
    const ll = getLimitlessClient();
    const n = await ll.syncNewLifelogs();
    console.log('Limitless synced:', n);
  } catch (e) { console.error('[nightly] Limitless sync', e); }

  // Psych analysis rebuild & import
  try {
    console.log('Rebuilding psych analysis...');
    execSync('npx -y tsx scripts/collect-lifelogs.ts', { stdio: 'inherit' });
    execSync('npx -y tsx scripts/analyze-lifelogs.ts', { stdio: 'inherit' });
    execSync('npx -y tsx scripts/import-analysis-to-db.ts', { stdio: 'inherit' });
  } catch (e) {
    console.error('[nightly] psych analysis/import failed', e);
  }

  console.log('==> Nightly tasks done');
}

main().catch((e) => { console.error(e); process.exit(1); });

