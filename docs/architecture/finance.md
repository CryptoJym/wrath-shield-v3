# Finance Architecture (ReWrite LLC)

## Overview
The Finance module provides comprehensive expense tracking, AI-powered classification, and reimbursement management with Zep-backed agent memory for continuous learning.

## Scope
- Ingest spend from Plaid (preferred) and CSV fallback.
- Bucket spend by purpose: work_reimbursable, work_nonreimbursable, personal_ai, family, personal_other.
- Billing cycle: 8th → 8th of each month.
- Company assignment for reimbursements: Vuplicity, Solution Stream, Utlyze, Kahoa.
- AI-powered transaction classification with memory-backed learning.
- Outputs: rollup, anomalies, reimbursable packet, inbox snapshot.

## Data Flow

### 1. Plaid Integration
- **Env**: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`development` for dev tier).
- **Commands**:
  - `npm run plaid:link` → open link token, complete bank auth.
  - `npm run plaid:exchange -- --public_token <token>` → stores access token.
- **API Routes**:
  - `POST /api/finance/plaid/link-token` - Generate Plaid Link token
  - `POST /api/finance/plaid/exchange` - Exchange public token for access
  - `POST /api/finance/plaid/items` - List connected accounts
  - `POST /api/finance/plaid/historical-sync` - Sync historical transactions

### 2. CSV Fallback
- Drop bank CSVs into `.data/finance/import/`.
- Filenames hint account (amex/usbank/afcu/wells).
- API: `POST /api/finance/csv-import` - Import CSV transactions

### 3. Ingest & Classify
- `npm run finance:ingest` pulls Plaid + CSV, normalizes, classifies vendors.
- Writes to `.data/finance/finance.db` (`finance_transactions` table).
- **Smart Classification**:
  - `POST /api/finance/smart-classify` - AI-powered batch classification
  - `POST /api/finance/classify-batch` - Rule-based batch classification
  - `POST /api/finance/reclassify` - Reclassify specific transactions

### 4. Rollup & Reporting
- `npm run finance:rollup` (cycle 8→8) aggregates by bucket.
- Writes anchor, feeds inbox snapshot.
- **API Routes**:
  - `GET /api/finance/reimbursement/cycles` - List expense cycles
  - `GET /api/finance/reimbursement/cycles?withTransactions=true` - With transaction details

### 5. Schedule
- PM2 job `finance-daily` runs `finance:ingest` + `finance:rollup` daily (cron 06:30).

## Reimbursement System

### Utlyze Expense Reimbursements
Full-featured reimbursement tracking at `/finance/reimbursements`:

**Features**:
- Cycle-based expense tracking (8th → 8th)
- Company assignment (Vuplicity, Solution Stream, Utlyze, Kahoa)
- Assignee tracking (James Brady, Josh Smith, Cody Vincent, etc.)
- Reimbursable/non-reimbursable toggle
- Usage notes for each transaction
- Summary by company and assignee
- CSV export with full report

**Key Components**:
- `app/finance/reimbursements/page.tsx` - Main reimbursements page
- `components/finance/ReimbursementTable.tsx` - Transaction table with inline editing
- `components/finance/FinanceChat.tsx` - AI agent chat interface

**API Routes**:
- `GET /api/finance/reimbursement/cycles` - List cycles with stats
- `GET /api/finance/transactions` - List transactions
- `PATCH /api/finance/transactions/[id]` - Update single transaction
- `POST /api/finance/transactions/bulk` - Bulk update transactions
- `POST /api/finance/reimbursement/ai-review` - AI-powered batch review

### AI-Powered Expense Review

The system can automatically review all transactions in a billing cycle and make reimbursement decisions:

**API**: `POST /api/finance/reimbursement/ai-review`
```json
{
  "cycleStart": "2025-11-08",
  "cycleEnd": "2025-12-08",
  "dryRun": true
}
```

**Features**:
- Batch processing (20 transactions per LLM call)
- Supports OpenAI (gpt-4o), OpenRouter, or xAI
- Determines: reimbursable (true/false), company assignment, assignee
- Dry run mode to preview decisions before applying
- Returns summary by company with totals

**Classification Criteria**:
- **Reimbursable**: AI/SaaS tools (OpenAI, Anthropic, Cursor), cloud infra, dev tools, work meals
- **Not Reimbursable**: Personal streaming, groceries, personal subscriptions
- **Company Assignment**: FCRA work → VUPLICITY, AI R&D → UTLYZE, consulting → SOLUTION_STREAM

**Response**:
```json
{
  "reviewed": 127,
  "updated": 127,
  "summary": {
    "reimbursable": 40,
    "nonReimbursable": 87,
    "byCompany": {
      "UTLYZE": { "count": 36, "total": 2015.98 },
      "VUPLICITY": { "count": 2, "total": 203.38 }
    }
  }
}
```

## Finance Agent with Zep Memory

### Agent Chat Interface
The Finance Agent is accessible via a floating chat panel on the reimbursements page. It has persistent memory powered by Zep Cloud.

**Capabilities**:
1. Answer questions about transactions and totals
2. Suggest marking items as reimbursable
3. Assign transactions to companies
4. Learn and remember user preferences
5. Propose organizational rule changes

**Three Tabs**:
1. **Chat**: Conversation with the agent
2. **Memory**: View agent's private and org-council knowledge
3. **Teach**: Manually add learnings or propose org policies

### Memory Architecture
- **Private Graph** (`wrath-shield-finance-agent`): Agent's personal learnings
- **Org-Council Graph** (`wrath-shield-org-council`): Shared policies requiring approval

**API**: `/api/finance/agent-memory`
- `GET ?type=all` - Retrieve all memories
- `GET ?type=private` - Private memories only
- `GET ?type=org` - Org-council memories only
- `GET ?type=proposals` - Pending council proposals
- `POST { action: 'learn', text }` - Add to private memory
- `POST { action: 'propose', text }` - Submit org policy proposal

### Learning Triggers
The agent automatically learns when you:
- Say "remember" or "learn" in chat
- Make corrections to classifications
- Add usage notes to transactions

## Buckets & Classification

### Default Buckets
- `work_reimbursable` - AI R&D expenses (reimbursable=true)
- `work_nonreimbursable` - Work expenses not reimbursed
- `personal_ai` - Personal AI tool subscriptions
- `family` - Family expenses
- `personal_other` - Other personal expenses

### Company Assignment
For reimbursable items, assign to billing company:
- `VUPLICITY` - FCRA/Background check work
- `SOLUTION_STREAM` - Consulting work
- `UTLYZE` - Core platform work
- `KAHOA` - Kahoa projects
- `PERSONAL` - Personal (non-reimbursable)
- `NEW_REWARD` - New Reward projects

### Vendor Rules
Defined in `lib/finance/rules.ts`:
- OpenAI, Anthropic, Cursor → AI tools
- Vercel, Railway, Supabase → Infrastructure
- Domain registrars → Business expenses
- Specific vendor → company mappings

## Key Files

### Core
- `lib/finance/plaid.ts` - Plaid API integration
- `lib/finance/store.ts` - SQLite database operations
- `lib/finance/rules.ts` - Classification rules
- `lib/finance/csv.ts` - CSV parser

### API Routes
- `app/api/finance/` - All finance API endpoints
- `app/api/finance/agent-memory/route.ts` - Agent memory API
- `app/api/finance/reimbursement/` - Reimbursement endpoints
- `app/api/finance/reimbursement/ai-review/route.ts` - AI-powered batch review
- `app/api/finance/transactions/` - Transaction CRUD

### Components
- `components/finance/FinanceChat.tsx` - AI agent chat with Zep memory
- `components/finance/ReimbursementTable.tsx` - Transaction table
- `components/finance/PlaidLink.tsx` - Plaid connection component

### Pages
- `app/finance/page.tsx` - Main finance dashboard
- `app/finance/reimbursements/page.tsx` - Utlyze reimbursements

## Outputs

### UI Pages
- `/finance` - Main dashboard with cycle/90d rollups
- `/finance/reimbursements` - Utlyze expense reimbursements
- `/inbox` - Finance snapshot card

### Exports
- CSV export with:
  - Report header (period, total)
  - Summary by company
  - Summary by assignee
  - Transaction details

### Memory & Learning
- Daily finance anchor in Zep memory
- Agent learnings from user corrections
- Council-approved organizational policies

## Environment Variables

```bash
# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=development

# Zep (for agent memory)
ZEP_API_KEY=

# Database
# SQLite at .data/finance/finance.db (auto-created)
```

## Future Enhancements
- [x] Reimbursable packet export (CSV)
- [x] AI-powered batch expense review
- [ ] PDF export with company letterhead
- [ ] Anomaly detection vs 90d baseline
- [ ] QBO connector (mirror expenses/bills)
- [ ] Receipt image attachment via Comms agent
- [ ] Automated reimbursement submission workflow
- [ ] UI button to trigger AI review from reimbursements page
