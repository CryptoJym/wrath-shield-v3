# Agents Guide – Wrath Shield v3

Scope: This file governs all agent work inside `wrath-shield-v3/`.

Goals
- Keep the repo always-green: tests must pass before changing Task Master state to done.
- Coordinate via Task Master for task claiming, progress, and completion.
- Avoid churn: scoped changes, additive UX, and stable test harness.

Definitions
- Definition of Ready (DoR)
  - Task status is `pending` and all dependencies are `done`.
  - Codebase builds locally; test runner works.
- Definition of Done (DoD)
  - All related unit/integration tests pass locally (`npm test`).
  - Task Master subtask/task status updated (`done`).
  - Dependencies validated (`task-master validate-dependencies`).
  - Task files regenerated (`task-master generate`).

Source of Truth
- Tasks: `.taskmaster/tasks/tasks.json` (managed by Task Master CLI only).
- Tests: Jest multi-project config (`jest.config.js`).
- Next: Next.js 14; Node 22 LTS.

Workflow (Single Task)
1) Claim the task
   - Ensure dependencies are satisfied (Task Master `next` or `list --with-subtasks`).
   - Immediately claim: `task-master set-status --id=<id> --status=in-progress`.

2) Plan + notes
   - Add concise plan to the subtask: `task-master update-subtask --id=<id> --prompt="plan / acceptance criteria"`.

3) Implement
   - Keep changes scoped. Prefer additive UX and stable interfaces.
   - Update or add tests adjacent to code when behavior changes.

4) Validate
   - Run tests: `npm test`.
   - If only server libs/APIs: `npx jest --selectProjects server-node`.
   - If only components: `npx jest --selectProjects client-jsdom`.

5) Finish + sync
   - Mark subtask `done`, then parent when all children are `done`:
     - `task-master set-status --id=<subtaskId> --status=done`
     - If last child done → `task-master set-status --id=<parentId> --status=done`
   - Validate deps and regenerate files:
     - `task-master validate-dependencies`
     - `task-master generate`

Parallelism
- Project-wide max concurrency: 4 lanes (per owner directive on 10/30).
- Default assignment:
  - Lane A → Task 9 (Schedulers)
  - Lane B → Task 10 (Saturation learning)
  - Lane C → Task 12 (Slash commands + accessibility)
  - Lane D → Validator/Status alignment (may finish unclaimed in-progress items)
- Never work in parallel on the same task/subtask. Always claim first.

Lane Operating Rules
- Each lane must:
  1) Claim the task with `in-progress` before edits.
  2) Maintain a short plan in the relevant task/subtask via `update-subtask`.
  3) Keep changes scoped and continuously run tests for its area.
  4) Mark subtasks `done` only after green tests and dependency validation.
  5) Defer to other lanes on conflicts; if a task is already `in-progress`, do not claim it.

Prohibited
- Do not manually edit `.taskmaster/config.json` or `tasks.json`.
- Do not lower test coverage thresholds.
- Do not bypass failing tests by skipping; fix product or test harness.

Test Harness (Jest)
- Multi-project setup (already configured):
  - `server-node`: Node environment for API routes and server libraries.
  - `client-jsdom`: jsdom environment for React components.
- Global server-only guard mock is provided for server tests in `jest.setup.server.ts`.
- Typical commands:
  - All tests: `npm test`
  - Single file: `npx jest path/to/file.test.ts --runInBand`
  - Server only: `npx jest --selectProjects server-node`
  - Client only: `npx jest --selectProjects client-jsdom`

Task Master Commands (quick reference)
- Status & navigation
  - `task-master list --with-subtasks`
  - `task-master next`
  - `task-master show <id>`
  - `task-master set-status --id=<id> --status=pending|in-progress|done|deferred|cancelled|blocked`
- Update/context
  - `task-master update-subtask --id=<id> --prompt="notes or plan"`
  - `task-master update-task --id=<id> --prompt="context change"`
  - `task-master update --from=<id> --prompt="bulk change from id"`
- Dependencies & generation
  - `task-master validate-dependencies`
  - `task-master fix-dependencies`
  - `task-master generate`

Status Alignment Rules
- Parent may never be `done` while any child is not `done`.
- If any child is `in-progress`, set parent to `in-progress`.
- Only set parent to `done` after all children are `done`.

UX/Testing Conventions
- Empty states must display explicit copy and accessible actions (e.g., Retry button) when appropriate.
- Prefer assertions that use roles/labels over raw text to avoid brittle tests.
- When adding ARIA attributes, leverage `aria-label`, `aria-pressed`, and keyboard handlers (Enter/Space) for interactive elements.

Incident Handling (Red Tests)
1) Identify harness vs. product failures.
   - “Request is not defined” → route tests running under jsdom; use server-node project.
   - `ensureServerOnly is not a function` → mock server-only guard in server setup.
2) Fix harness first, rerun.
3) If still failing, fix product or adjust tests to match the accepted UX.

Audit Trail (10/28)
- Status alignment: parents 6, 8, 9, 14, 15 set to `in-progress` (children unfinished).
- Harness stabilized: multi-project Jest + server-only guard mock.
- FlagRadar UI: added empty state, retry, improved accessibility; tests updated.
- Dependencies normalized: converted relative subtask deps to fully-qualified IDs; validation now clean.
- Re-enabled `/api/import/limitless` route test; suite passes.
- Full suite: 50/50 suites, 1008/1008 tests passing.

Contact & Handoff
- Before switching tasks, ensure statuses are accurate and tests green.
- Leave a brief note in the relevant subtask via `update-subtask` describing what changed and any follow-ups.

Concurrency Policy (10/30)
- Owner directive: run 4 lanes in parallel across the project.
- Lane assignments at kickoff:
  - Lane A → Task 9 (Schedulers)
  - Lane B → Task 10 (Saturation learning)
  - Lane C → Task 12 (Slash commands + accessibility)
  - Lane D → Validator/Status alignment (may finish unclaimed in-progress items like Task 4/11 if idle)
- Do not co-edit the same task/subtask; claim first, then work.
- Gate every status change to `done` with green tests and `task-master validate-dependencies`.

