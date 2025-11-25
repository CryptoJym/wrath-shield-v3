# Orchestration Overview (ReWrite LLC) - Provisional

## Components
- Executive orchestrator (GPT-5.1 default) with action approval + confidence gates.
- Specialist pods: comms, tasks, health, research, legal, finance (stubs present in `lib/pods`).
- Executors with per-channel live flags, approval gate, rate limits, dry-run toggle.
- Schedulers (PM2): pipeline-hourly, lifelog-hourly, digest-morning, shutdown-evening, legal-hourly, finance-daily.
- Memory: Qdrant + Mem0 wrapper (local fallback).
- Events DB: `.data/events.db` unified signals (email, calendar, iMessage, lifelog, outlook, gmail).
- Finance context bridge: finance pod raises low-confidence transactions as context requests; comms pod (with mailbox access) resolves them by posting summaries back. Resolution also updates the transaction (bucket/project/reimbursable/status=confirmed) to “teach” future classifications.

## Current routing
- Inbox shows actions, recent signals, finance snapshot.
- Legal runner hourly: filters legal contacts, pushes to Zep (legal-timeline), anchors to memory.
- Finance runner daily: ingests Plaid/CSV, rollup, anchors, inbox snapshot.
- Finance context queue available at `/api/finance/context-requests/next?limit=10`; comms agent responds to `/api/finance/context-requests` with `comms=true`.
- Finance UI at `/finance` includes vendor leaderboard (cycle/90d/all) and clarifications (note + reimbursement rationale).

## Approval & safety
- `EXECUTE_REQUIRE_APPROVAL=true` (env).  
- `EXECUTE_THRESHOLD=0.85`, per-channel live flags, rate limits, dry-run toggle.

## Data isolation
- Env-scoped tokens; plan to scope per-tenant once multi-tenant auth is in.
- Legal/finance pods intended to run under their own orchestrator contexts.

## Next
- Wire pods to the main orchestrator router with per-pod policies.
- Add per-tenant scoping once Clerk/orgs are wired.
- Add anomaly detection + reimbursable export to finance; richer legal timeline.
