# EA Automation / Entropy Pass (Hourly)

Purpose: run a low-latency “entropy → coherence” pass every hour that turns fresh lifelogs into structured actions (tasks, drafts, reminders, events) logged in `agentic_actions`. Now includes a secondary “context enricher” layer to ask James for missing info when confidence is low.

### What it does
- Pulls new lifelogs from Limitless.
- Filters telemetry noise (aavm logs, HTTP traces).
- Sends the delta to Agentic Grok (`grok-4-1-fast-reasoning-latest`) with a strict JSON contract.
- Stores proposed actions with confidence + metadata in SQLite table `agentic_actions`.
- Persists last-run timestamp in `settings.ea_last_run_iso` for incremental scans.

### Run it
```
npx tsx scripts/run-entropy-pass.ts      # one-shot
```
(Scheduler wiring: `hourly-scan` in `lib/schedulers.ts` now calls the pass.)

### Table schema
`agentic_actions` (id, user_id, type, target, title, content, confidence, status, source, metadata, created_at, updated_at)  
Statuses: `proposed | queued | executed | failed | dismissed`.

### Model & prompt
- Model: `grok-4-1-fast-reasoning-latest` (set via `AGENTIC_MODEL`, default already set).
- System prompt encodes canonical priorities (taxes, custody 2025-12-15, Hyro, Cody check-ins, High Desert, CEO-of-One draft, Motion MCP bring-up, GitHub indexing, portfolio pillars).
- Output format requires JSON with `actions[]`.

### Confidence gating
- Default keep threshold: `>= 0.85` confidence → `status=proposed`; below → `dismissed`.
- Adjust via `runEntropyCoherencePass({ minConfidence })`.

### Bilayer reasoning
- Primary layer: Grok (`grok-4-1-fast-reasoning-latest`) produces actions.
- Secondary layer: Context Enricher (`SECONDARY_MODEL`, default `openai/gpt-5.1`) kicks in when no actions or any dismissed (low confidence). It generates outreach prompts to James (logged as `agentic_actions` with `source=context-enricher`) and writes private notes to `.data/context_enricher_mem.jsonl`.

### Executors
- Script: `npx tsx scripts/run-executors.ts`
- Threshold: `EXECUTE_THRESHOLD` env (default 0.85). Above threshold → auto-run; else queued.
- Wired targets:
  - `todoist/motion/task` → Todoist task (project `EA Inbox` by default).
  - `calendar_event` → `.data/ics/*.ics` draft, queued.
  - `email_draft` → sends immediately if SMTP_* env is set and recipient allowed; otherwise queued.
  - `text_message` → order controlled by `TEXT_SEND_ORDER` (`imessage-first` default, or `sms-first`/`twilio-first`). Uses Twilio SMS if configured; AppleScript iMessage as alternate; else queued.
  - others → queued with reason.

SMTP notes: set `SMTP_HOST/PORT/USER/PASS/SMTP_FROM`, optionally `SMTP_ALLOW_DOMAIN` to constrain recipients.
SMS notes: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` to enable SMS; otherwise iMessage is used when possible.

### Visual cortex
- Live status page: `/ea` (client-side SWR) shows proposed/queued/executed/failed plus sample cards for narrative visibility.

### Relationship Grok lane (new)
- Ingest script: `npx tsx scripts/ingest-relationships.ts` reads iMessage/SMS (`~/Library/Messages/chat.db`) and populates `.data/relationships.db`.
- API: `/api/relationships` lists top contacts; UI page `/relationships` (“People Graph”) shows recency, counts, last snippets.
- Executor: `text_message` target now tries AppleScript Messages send when confidence + recipient available; otherwise queued.
- Canonical merges: high-confidence phone/email canonicalization (>=0.90) applied automatically; lower-confidence suggestions stored at `.data/contact_merge_suggestions.jsonl`. Apply them via `npm run contacts:apply` (env `CONF_THRESHOLD` optional, default 0.85).

### Next steps (suggested)
1. Executors: build small workers for Gmail/Outlook, Calendar, Motion/Todoist that read `agentic_actions` where `status=proposed` and auto-execute ≥0.7 confidence or surface for review.
2. UI: add “EA Inbox” page to review/approve actions; batch approve/execute.
3. Memory: push `content` + outcomes into Mem0/Qdrant to tune future confidence.
4. Signals: feed WHOOP/Limitless psych signals to adjust prioritization (stress → reduce load, improve interpersonal scripts).
5. Safety: add redaction + rate limits before sending emails/texts; log execution outcomes back to `metadata`.
