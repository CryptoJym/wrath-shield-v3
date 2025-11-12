/*
  Backfill ALL historical WHOOP data into the app DB.
  - Cycles (strain/activity)
  - Recoveries
  - Sleeps

  Usage: npx tsx scripts/whoop-backfill-all.ts
*/
import { getWhoopClient } from '../lib/WhoopClient';
import { insertCycles, insertRecoveries, insertSleeps } from '../lib/db/queries';
import path from 'path';

// Load environment from .env.local so cfg() works in scripts
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {}

async function main() {
  const whoop = getWhoopClient();
  console.log('==> WHOOP backfill (all history) start');

  // Cycles
  try {
    console.log('Fetching cycles (all history)...');
    const cycles = await whoop.fetchCyclesForDbAll();
    console.log(`Inserting ${cycles.length} cycles...`);
    if (cycles.length) insertCycles(cycles);
  } catch (e) {
    console.error('Cycles backfill error:', e);
  }

  // Recoveries
  try {
    console.log('Fetching recoveries (all history)...');
    const recs = await whoop.fetchRecoveriesForDb(); // no dates => full
    console.log(`Inserting ${recs.length} recoveries...`);
    if (recs.length) insertRecoveries(recs);
  } catch (e) {
    console.error('Recoveries backfill error:', e);
  }

  // Sleeps
  try {
    console.log('Fetching sleeps (all history)...');
    const sleeps = await whoop.fetchSleepsForDb(); // no dates => full
    console.log(`Inserting ${sleeps.length} sleeps...`);
    if (sleeps.length) insertSleeps(sleeps);
  } catch (e) {
    console.error('Sleeps backfill error:', e);
  }

  console.log('==> WHOOP backfill done');
}

main().catch((e) => { console.error(e); process.exit(1); });
