#!/usr/bin/env tsx
/**
 * Finance rollup stub:
 * - Defines billing cycle as 8th->8th
 * - Placeholder to ingest spend feeds and compute utilization
 * - Writes an anchor to memory summarizing the cycle window
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { addAnchor } from '../lib/MemoryWrapper';
import { listByDateRange } from '../lib/finance/store';
import { cfg } from '../lib/config';

const USER_ID = process.env.MEMORY_USER_ID || 'james';
const CYCLE_START_DAY = parseInt(process.env.FINANCE_CYCLE_START_DAY || '8', 10);

function cycleWindow(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  // if before start day, window is previous month start -> this month start
  const start = new Date(y, d >= CYCLE_START_DAY ? m : m - 1, CYCLE_START_DAY);
  const end = new Date(y, d >= CYCLE_START_DAY ? m + 1 : m, CYCLE_START_DAY);
  return { start, end };
}

async function main() {
  const { start, end } = cycleWindow();
  const label = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;

  const rows = listByDateRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  const byBucket: Record<string, number> = {};
  for (const r of rows) {
    const b = r.bucket || 'unknown';
    byBucket[b] = (byBucket[b] || 0) + r.amount;
  }
  const bucketLine = Object.entries(byBucket)
    .map(([b, amt]) => `${b}: ${amt.toFixed(2)}`)
    .join(', ') || 'no data';

  const note = [`Finance rollup window: ${label}`, `Totals by bucket: ${bucketLine}`, `Transactions: ${rows.length}`].join('\n');

  // Mem0 API expects an array; guard for cloud/local differences
  const payload = note;
  try {
    await addAnchor(payload, 'finance', new Date().toISOString().slice(0, 10), USER_ID);
  } catch (e) {
    console.warn('[finance-rollup] failed to add anchor to memory (skipping):', (e as Error).message);
  }
  console.log(note);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
