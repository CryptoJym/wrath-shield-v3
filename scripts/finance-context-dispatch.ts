import { listContextRequests } from '../lib/finance/store';

/**
 * Simple bridge for the comms agent.
 * - Prints pending finance context requests as JSON lines (vendor, date, amount, txn_id, id).
 * - Use alongside the /api/finance/context-requests POST endpoint to resolve with summaries.
 *
 * Usage:
 *   tsx scripts/finance-context-dispatch.ts            # show top 10 pending
 *   LIMIT=25 tsx scripts/finance-context-dispatch.ts  # change limit
 */

const limit = Number(process.env.LIMIT || 10);
const pending = listContextRequests('pending').slice(0, limit);

if (!pending.length) {
  console.log('No pending finance context requests.');
  process.exit(0);
}

for (const req of pending) {
  console.log(
    JSON.stringify({
      id: req.id,
      txn_id: req.txn_id,
      vendor: req.vendor,
      date: req.date,
      amount: req.amount,
      confidence: req.confidence,
    })
  );
}
