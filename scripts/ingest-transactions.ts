#!/usr/bin/env tsx
/**
 * Transaction ingest (Plaid + CSV fallback)
 */
import fs from 'fs';
import path from 'path';
import { upsertTransactionsFromRows } from '../lib/finance/store';
import { fetchPlaidTransactions } from '../lib/finance/plaid';
import { parseCsvFiles } from '../lib/finance/csv';

async function main() {
  const rows: any[] = [];

  // Plaid fetch (if keys present)
  try {
    const plaidRows = await fetchPlaidTransactions();
    rows.push(...plaidRows);
  } catch (e) {
    console.warn('[ingest] plaid fetch skipped/failed:', (e as Error).message);
  }

  // CSV fallback from .data/finance/import
  const csvDir = path.resolve(process.cwd(), '.data', 'finance', 'import');
  if (fs.existsSync(csvDir)) {
    const csvRows = await parseCsvFiles(csvDir);
    rows.push(...csvRows);
  }

  await upsertTransactionsFromRows(rows);
  console.log(`[ingest-transactions] upserted rows: ${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
