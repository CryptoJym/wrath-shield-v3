Wrath Shield v3 — No‑Memory Boot & Handoff
==========================================

Systems & Ports
- Next.js app (UI + APIs): http://localhost:4242
- Agentic Grok (FastAPI tools/model proxy): http://localhost:8001
- EEG dashboard (Streamlit): http://localhost:8501
- Memory: Zep Cloud (primary) or SQLite fallback

Quick Boot (all‑in‑one)
- From repo root: `bash scripts/start-all.sh`
- Then open http://localhost:4242

Manual Boot (service‑by‑service)
- Next.js app (4242)
  - `npm install`
  - `npm run dev`
- Agentic Grok (8001)
  - `cd services/agentic-grok`
  - `python -m venv venv && source venv/bin/activate`
  - `pip install -r requirements.txt` (if present)
  - `python agentic_service.py`
- EEG Streamlit (8501)
  - `cd services/eeg-tokenizer`
  - `source venv/bin/activate` (or create one)
  - `pip install -r requirements.txt`
  - `streamlit run app.py`

Health Checks (fast)
- Core status JSON: `GET /api/system/status` → shows Grok health, DB counts, token expiry, Limitless last pull, Memory config
- EEG proof:
  - `GET /api/eeg/status` → `{ ok, connected, tokens, … }`
  - `/metrics` has “EEG Snapshot” iframe and tokens count; open full dashboard at `/eeg`
- Psych signals:
  - Latest and series: `GET /api/analysis/psych`
  - CSV export: `/api/analysis/psych?series=1&days=14&export=csv`
- WHOOP baselines:
  - `GET /api/metrics/baselines`
  - `/metrics` shows 30/90‑day baselines + deltas vs today

Minimal Config (env)
- File: `.env.local`
  - `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`
  - `WHOOP_REDIRECT_URI=http://localhost:4242/api/whoop/oauth/callback`
  - `OPENROUTER_API_KEY` (already set locally)
  - `DATABASE_ENCRYPTION_KEY` (base64 32‑byte key)
  - `AGENTIC_GROK_URL=http://localhost:8001`
  - `ZEP_API_KEY` (Zep Cloud memory)
  - `NEXT_PUBLIC_STREAMLIT_URL=http://localhost:8501` (EEG UI)
- WHOOP OAuth
  - Scope includes: `offline read:recovery read:cycles read:sleep`
  - Start OAuth: `/api/whoop/oauth/initiate`
- Limitless key
  - `/metrics` → set via the “Limitless API key” form or `POST /api/settings { provider:'limitless', key:'...' }`

Data Status (current)
- WHOOP historicals (SQLite):
  - cycles: 728 (2023‑06‑14 → 2025‑11‑11)
  - recoveries: 823 (2023‑06‑15 → 2025‑11‑12)
  - sleeps: 866 (2023‑06‑15 → 2025‑11‑11)
- Limitless lifelogs: 300+ rows (incremental sync working)
- Psych signals: computed/imported; visible on `/metrics` and `/metrics/psych`

Sync & Schedulers
- Manual sync: `/api/sync?days=3` (WHOOP + Limitless)
  - `/api/sync?start_date=YYYY‑MM‑DD&end_date=YYYY‑MM‑DD` (Limitless backfill)
- Nightly (03:00, optional via PM2):
  - `pm2 start ecosystem.config.js --only wrath-scheduler`

Chat Interface (integrated)
- `/chat` uses animated chat UI (`components/AnimatedAIChat.tsx`)
- Proxies to `/api/agentic/chat` → Agentic Grok backend

Key Paths
- `app/chat/page.tsx` (chat UI entry)
- `app/api/agentic/chat/route.ts` (chat proxy to Agentic Grok)
- `app/metrics/page.tsx` (health + psych + baselines + EEG iframe)
- `app/metrics/psych/page.tsx` (psych details)
- `app/api/system/status/route.ts` (expanded status)
- `app/api/eeg/status/route.ts` (EEG connection + tokens)
- `app/api/analysis/psych/route.ts` (psych API + CSV)
- `app/api/metrics/baselines/route.ts` (WHOOP baselines)
- `app/privacy/page.tsx` (renders docs/policies/privacy-policy.md for /privacy)
- `lib/WhoopClient.ts`, `lib/LimitlessClient.ts`, `lib/db/queries.ts`
- `scripts/*.ts` (WHOOP backfill, lifelog collect/analyze/import)
- `ecosystem.config.js` (PM2 app + nightly cron)

Known Warnings (safe to ignore)
- MemoryWrapper logs "Using SQLite memory store" if Zep unavailable. Does not block endpoints.

New Specialist Pods (stubs)
- LegalPod: filters legal contacts (Zach/Zachary Start @ MoodyBrown, Destiny Hyte), Utah 4th District Family context. To be paired with a dedicated orchestrator + Zep timeline per matter.
- FinancePod: for AI/tool spend + 30‑day utilization logs; awaits spend feeds (bank/cc/SaaS).

Policies (ReWrite LLC)
- `docs/policies/infosec-policy.md|pdf`
- `docs/policies/access-control-policy.md|pdf`
- `docs/policies/privacy-policy.md|pdf` (live at /privacy)
- `docs/policies/data-retention-policy.md|pdf`

Finance & Plaid
- Env: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (dev tier)
- Ingest: `npm run finance:ingest` (Plaid + CSV)
- Rollup: `npm run finance:rollup` (cycle 8→8)
- API snapshot: `/api/finance/summary`; shown on `/inbox`

Suggested First Tasks (next engineer)
- EEG 60‑minute sparkline (tokens/min) on `/metrics` + last token timestamp
- Baselines range toggle (7/30/90/365) and weekly trend charts
- Stream responses in chat; wire slash commands to real tools

Helpers
- Start all: `bash scripts/start-all.sh`
- Stop all:  `bash scripts/stop-all.sh`
- Health:    `bash scripts/check-health.sh`
