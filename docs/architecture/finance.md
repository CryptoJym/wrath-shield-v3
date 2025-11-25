# Finance Architecture (ReWrite LLC) - Provisional

## Scope
- Ingest spend from Plaid (preferred) and CSV fallback.
- Bucket spend by purpose: work_reimbursable, work_nonreimbursable, personal_ai, family, personal_other.
- Billing cycle: 8th → 8th of each month.
- Outputs: rollup, anomalies, reimbursable packet, inbox snapshot.

## Data flow
1) **Plaid**  
   - Env: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`development` for dev tier).  
   - Commands:  
     - `npm run plaid:link` → open link token, complete bank auth.  
     - `npm run plaid:exchange -- --public_token <token>` → stores access token in `.data/finance/plaid-tokens.json`.
2) **CSV fallback**  
   - Drop bank CSVs into `.data/finance/import/`. Filenames hint account (amex/usbank/afcu/wells).  
3) **Ingest**  
   - `npm run finance:ingest` pulls Plaid + CSV, normalizes, classifies vendors, writes to `.data/finance/finance.db` (`finance_transactions` table).
4) **Rollup**  
   - `npm run finance:rollup` (cycle 8→8) aggregates by bucket, writes anchor, and feeds inbox snapshot.
5) **Schedule**  
   - PM2 job `finance-daily` runs `finance:ingest` + `finance:rollup` daily (cron 06:30).
6) **Classification + Context Requests**
   - `npm run finance:classify` assigns bucket/project/reimbursable with confidence; high-confidence auto-classifies; low/unknown opens a context request.
   - Context requests stored in `finance_context_requests` (fields: bucket, project, reimbursable, note, rationale, summary, confidence).
   - Resolution:
     - User UI on `/finance` or `/inbox`.
     - Comms agent pulls `/api/finance/context-requests/next?limit=10`, fetches receipts (Gmail/Outlook), then POSTs to `/api/finance/context-requests` with `{ comms: true, id, summary, confidence?, bucket?, project?, reimbursable?, note?, rationale? }`.
   - Resolution also updates the linked transaction (bucket/project/reimbursable/status=confirmed + meta note) to “teach” future decisions.

## Buckets (initial defaults)
- amex → work_reimbursable (AI R&D; reimbursable=true; project=ai_rnd)
- usbank → work_nonreimbursable
- afcu → family
- wellsfargo → family
- Vendor rules override defaults (see `lib/finance/rules.ts`).

## Key files
- Ingest: `scripts/ingest-transactions.ts`
- Plaid helpers: `scripts/plaid-link.ts`, `scripts/plaid-exchange.ts`, `lib/finance/plaid.ts`
- CSV parser: `lib/finance/csv.ts`
- Rules: `lib/finance/rules.ts`
- Store/DB: `lib/finance/store.ts` (SQLite at `.data/finance/finance.db`)
- Rollup: `scripts/finance-rollup.ts`
- Inbox snapshot: `/api/finance/summary` → shown on `/inbox`

## Outputs
- `/inbox` Finance Snapshot card (cycle window, totals by bucket).
- `/finance` dashboard with cycle/90d rollups, pending context requests (with note + reimbursement rationale fields), vendor leaderboard (filter: cycle/90d/all).
- Daily finance anchor in memory via `finance:rollup`.

## Next (optional)
- Reimbursable packet export (CSV/PDF).
- Anomaly detection vs 90d baseline.
- QBO connector (mirror expenses/bills).
