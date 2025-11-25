#!/usr/bin/env tsx
/**
 * Apply heuristic classifier to all transactions; set status/confidence/bucket.
 * Low-confidence stays pending_review; high-confidence -> classified.
 */
import { TxnRow, upsertTransactionsFromRows, createContextRequest } from '../lib/finance/store';
import { classifyTxn } from '../lib/finance/classifier';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';

const CONFIRM_THRESHOLD = parseFloat(process.env.FINANCE_CLASSIFY_THRESHOLD ?? '0.9');
const CONTEXT_THRESHOLD = parseFloat(process.env.FINANCE_CONTEXT_THRESHOLD ?? '0.5');

function getAllRows(): TxnRow[] {
  const db = new BetterSqlite3(path.resolve(process.cwd(), '.data', 'finance', 'finance.db'));
  const rows = db.prepare('SELECT * FROM finance_transactions').all() as any[];
  db.close();
  return rows.map((r) => ({
    ...r,
    recurring: !!r.recurring,
    reimbursable: !!r.reimbursable,
    meta: r.meta ? safeParse(r.meta) : undefined,
  }));
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

async function main() {
  const rows = getAllRows();
  const updates: TxnRow[] = [];
  for (const r of rows) {
    const classified = classifyTxn(r);
    const status = classified.confidence >= CONFIRM_THRESHOLD ? 'classified' : 'pending_review';
    updates.push({
      ...r,
      bucket: classified.bucket,
      project: classified.project ?? r.project,
      reimbursable: classified.reimbursable,
      status,
      confidence: classified.confidence,
    });

    if (status === 'pending_review' || classified.confidence < CONTEXT_THRESHOLD || classified.bucket === 'unknown') {
      createContextRequest({
        txn_id: r.id,
        vendor: r.vendor,
        date: r.date,
        amount: r.amount,
        confidence: classified.confidence,
      });
    }
  }
  await upsertTransactionsFromRows(updates);
  const confirmed = updates.filter((u) => u.status === 'classified').length;
  const pending = updates.length - confirmed;
  console.log(`Classified ${updates.length} tx; high-confidence=${confirmed}, pending=${pending}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
