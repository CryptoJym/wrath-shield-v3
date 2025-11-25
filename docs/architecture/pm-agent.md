# PM Agent Integration Plan (GitHub + Motion)

Goal: Project-management agent that consumes comms/legal/finance signals, creates/updates Motion tasks and GitHub issues, and writes concise anchors to Zep. Runs scheduled syncs daily.

Secrets & safety (must follow)
- Never commit secrets. Actual values live in `~/.secrets/legal.env` (git-ignored). Inject at runtime via `./scripts/run-with-op.sh <command>` (wraps `op run --env-file ...`).
- Keep session cookies (if any) in a git-ignored cache. No credentials in code.

Key repo paths
- Context queues (REST):
  - Legal: `app/api/legal/context-requests/route.ts`, `app/api/legal/context-requests/next/route.ts`
  - Finance: `app/api/finance/context-requests/route.ts`, `app/api/finance/context-requests/next/route.ts`
  - Comms: future queue should mirror the same shape at `/api/comms/context-requests`.
- Stores:
  - Legal: `.data/legal/legal.db`, code in `lib/legal/store.ts`
  - Finance: `.data/finance/finance.db`, code in `lib/finance/store.ts`
- Helpers: `scripts/run-with-op.sh` (secret injection), `scripts/legal-sync-imessage.sh` (example sync pattern)
- Logs: use `./logs/pm-agent.log` (ensure logs/ stays git-ignored)

Env vars (set in ~/.secrets/legal.env)
- GitHub: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
- Motion: `MOTION_API_KEY`, `MOTION_WORKSPACE_ID` (or equivalent per Motion API)
- Zep: `ZEP_API_URL`, `ZEP_API_KEY`
- Base URLs: `LEGAL_API_BASE` / `NEXT_API_BASE_URL` (default http://localhost:4242)
- Optional: `DRY_RUN=true` for safe mode

Data flow
1) Inputs: context requests from comms/legal/finance queues (`/api/*/context-requests`).
2) PM agent polls pending items, maps them to tasks/issues:
   - Motion: create/update task (title=summary, due=parsed date, notes=source, link back to context request URL).
   - GitHub: create/update issue when code-related; link Motion task ↔ GitHub issue URL.
3) Memory: after each sync, write one short anchor to Zep summarizing processed items, new tasks/issues, blockers, next actions.

Polling / cadence
- Run syncs at 05:00, 09:00, 12:00, 15:00, 17:00, 19:00, 21:00 local time.
- Each run: fetch pending context, map/apply, push updates, write a Zep anchor.

Cron example
```
# local user cron
0 5,9,12,15,17,19,21 * * * cd /Users/jamesbrady/Projects/apps/wrath-shield-v3 && ./scripts/run-with-op.sh npm run pm-agent:sync >> /tmp/pm-agent.log 2>&1
```

Mapping rules (initial)
- Context → Motion task: title=summary; due=detected date; description=source, links back to `/api/...` item.
- If code-related: also create/update GitHub issue; store cross-links in both systems.
- Status: when Motion task done or GitHub issue closed, mark context request resolved; write “done” anchor to Zep.

Anchoring (Zep)
- Project: `pm-agent`
- Payload: minimal text (top 5 items) with timestamp, items processed, blockers, next actions.

Suggested file layout to implement
- `lib/pm-agent/sources.ts` — fetch legal/finance (and future comms) context via REST.
- `lib/pm-agent/mapper.ts` — deterministic mapping from context → Motion/GitHub payloads.
- `lib/pm-agent/targets/github.ts` — minimal client (issue create/update/comment/close) using env token.
- `lib/pm-agent/targets/motion.ts` — minimal client (task create/update/status/due) using env key.
- `lib/pm-agent/memory/zep.ts` — helper to write anchors (project `pm-agent`).
- `scripts/pm-agent-sync.ts` — one-shot sync; wire to `npm run pm-agent:sync`.
- Tests: mapper idempotency, payload shape, dry-run mode.

Implementation steps for the engineer (Claude)
1) Build fetchers for legal/finance queues using existing API routes; accept base URL/env; support pagination if added later.
2) Build mapper with idempotency keys (e.g., hash of context id + source) to avoid duplicates in Motion/GitHub.
3) Build Motion and GitHub thin clients (REST) using env creds; include dry-run guard.
4) Add Zep anchor writer and call it once per sync run.
5) Expose CLI `npm run pm-agent:sync` that runs one sync pass.
6) Add cron/pm2 instructions (above) using `./scripts/run-with-op.sh` for secrets.
7) Keep logs in `logs/pm-agent.log` (git-ignored) and ensure noise is minimal.

Notes
- Keep payloads small and deterministic; no secrets in logs.
- Extend to other queues (research/health) by adding source fetchers without breaking mapper.
