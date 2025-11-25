import { listLegalContextRequests } from '../lib/legal/store';

/**
 * Simple bridge for the legal agent (mirrors finance-context-dispatch).
 * Prints pending legal context requests as JSON lines for external agents.
 *
 * Usage:
 *   tsx scripts/legal-context-dispatch.ts
 *   LIMIT=25 tsx scripts/legal-context-dispatch.ts
 */

const limit = Number(process.env.LIMIT || 10);
const pending = listLegalContextRequests('pending').slice(0, limit);

if (!pending.length) {
  console.log('No pending legal context requests.');
  process.exit(0);
}

for (const req of pending) {
  console.log(
    JSON.stringify({
      id: req.id,
      case_number: req.case_number,
      contact: req.contact,
      topic: req.topic,
      summary: req.summary,
      due_date: req.due_date,
      confidence: req.confidence,
    })
  );
}
