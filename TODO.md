# WRATH SHIELD V3 - Engineering TODO List

> **Last Updated:** 2024-12-10
> **Status:** Production Ready with Known Issues

---

## CRITICAL - Address First

### 1. Pre-existing Test Failures (30 suites)
- Tests were failing before cleanup - not caused by recent changes
- Run `bun test` to see current failures
- Priority: HIGH - affects CI/CD reliability

### ~~2. Dead API Routes (Proxy to Archived Services)~~ ✅ COMPLETED
~~These routes proxy to services that have been archived:~~
```
/api/agentic/health  → ✅ Returns 410 deprecation response
/api/agentic/status  → ✅ Uses local DB (not archived service)
/api/eeg/status      → ✅ Returns 410 deprecation response
```
**FIXED:** Routes now return proper HTTP 410 "Gone" responses with deprecation info and alternatives.

---

## HIGH PRIORITY - Implementation Gaps

### ~~3. Agent Subscriptions - Incomplete Integration~~ ✅ COMPLETED
**File:** `lib/agents/agent-subscriptions.ts`
- ✅ AgentInvoker integration complete
- ✅ Event handlers now invoke agents via `invokeAgent()`
- ✅ Metadata extraction and context passing implemented
- ✅ Error handling prevents one agent failure from blocking others

### ~~4. Cortex Synthesis Loop - Placeholder Implementation~~ ✅ COMPLETED
**Files:**
- `lib/cortex/init.ts`
- `lib/cortex/synthesis-loop.ts`
- ✅ Synthesis loop already fully implemented with:
  - Real task fetching via `taskStore.getTasksNeedingRefinement()`
  - Pattern retrieval via `getRelevantPatterns(events)`
  - Full LLM invocation with retry logic
  - JSON parsing and validation

### ~~5. Cortex Event Ingestor - Fast-path Routing~~ ✅ COMPLETED
**File:** `lib/cortex/event-ingestor.ts`
- ✅ Fast-path routing implemented via `routeCriticalToAgent()`
- ✅ Critical emails, iMessages, and calendar events route directly to agents
- ✅ Events published to event bus with appropriate domain mapping
- ✅ Fallback to working memory if routing fails

### ~~6. Decision Queue - Correction Recording~~ ✅ COMPLETED
**File:** `lib/cortex/decision-queue.ts`
- ✅ Connected to `recordCorrection` in preference-model.ts
- ✅ When user selects non-recommended option, correction is recorded
- ✅ Learning feedback loop now active

---

## MEDIUM PRIORITY - Feature Completion

### 7. Executor Integrations - External Services
**File:** `lib/executors.ts`
```typescript
// TODO: Integrate with email sending service (Gmail API, SMTP, etc.)
// TODO: Integrate with notification service
// TODO: Integrate with calendar service (Google Calendar, etc.)
// TODO: Integrate with notes service (Notion, Obsidian, etc.)
```
- Task execution stubs exist but don't connect to real services
- **Action:** Implement actual service integrations

### ~~8. Google Calendar - Timezone Configuration~~ ✅ COMPLETED
**File:** `lib/integrations/GoogleCalendarClient.ts`
- ✅ Already configurable via:
  - Constructor parameter: `new GoogleCalendarClient('America/New_York')`
  - Environment variable: `DEFAULT_TIMEZONE`
  - Fallback: `'America/Los_Angeles'`

### 9. Repo Organizer - Project Creation
**File:** `lib/pm/repo-organizer.ts`
```typescript
// TODO: Implement project creation via GraphQL
```
- GitHub project creation not implemented
- **Action:** Implement GraphQL mutation for project creation

### 10. PM Connectors - Phase 3
**File:** `lib/pm/connectors/comms-lifelog-connector.ts`
```typescript
// TODO: Phase 3
```
- Additional connector features planned but not implemented

---

## LOW PRIORITY - Code Quality

### 11. lib/ Directory Reorganization
From cleanup report - deferred:
- 48 top-level files in `lib/` should be organized into subdirectories
- Requires careful import updates across entire codebase
- **Action:** Plan and execute as separate focused refactor

### ~~12. Agent Health Calculation~~ ✅ COMPLETED
**File:** `lib/agents/registry.ts`
- ✅ HP calculated from agent execution success rate
- ✅ MP calculated from token usage efficiency
- ✅ Status calculated from recent activity (green/yellow/red)
- Lines 57-64 implement dynamic health metrics

### 13. Pod Implementations
**Files:** `lib/pods/*.ts`
- `commPod.ts`: "TODO: add contact merge + reply suggestions"
- `financePod.ts`: "TODO: ingest spend feeds..."
- `legalPod.ts`: "TODO: add Zep timeline collection..."
- **Action:** Implement pod features as needed

### 14. Slash Command Stubs
**File:** `lib/slashCommands.ts`
```typescript
// Project commands (stubs, safe default behavior)
reg.register({ name: 'prime', description: 'Prime ritual (stub)', ... });
reg.register({ name: 'lock', description: 'Lock ritual (stub)', ... });
```
- Placeholder implementations
- **Action:** Implement actual ritual logic or remove

---

## API Route Consolidation (Future)

Consider consolidating these duplicate API paths:
```
/api/agentic/* → /api/agents/*
```
The `/api/agentic/*` routes were for the now-archived Python Grok service.

---

## Archived Code (Available for Reference)

Location: `_archived/cleanup_20241210_184112/`

| Category | Contents |
|----------|----------|
| `db_files/` | 8 empty database files |
| `scheduler_files/` | 11 dead scheduler files + tests |
| `duplicate_scripts/` | 6 duplicate auth/ingest scripts |
| `dead_examples/` | 5 dead example files |
| `dead_services/` | agentic-grok, eeg-tokenizer |
| `dead_memory_code/` | ExtendedMemorySystem (964 lines) |

**Rollback if needed:**
```bash
cp -r _archived/cleanup_20241210_184112/<category>/* ./
```

---

## Build & Test Status

| Check | Status | Notes |
|-------|--------|-------|
| Build | ✅ Passing | `bun run build` |
| Dev Server | ✅ Running | Port 4242 |
| Unit Tests | ⚠️ 30 suites failing | Pre-existing issues |
| E2E Tests | ⚠️ Requires setup | Playwright config ready |

---

## Quick Reference

### Key Directories
```
lib/agents/      - Agent system (event bus, subscriptions, health)
lib/cortex/      - Decision engine (temporal search, synthesis)
lib/hyro/        - HYRO Forge education system
lib/scheduler/   - LifeOSScheduler (active scheduler)
lib/learning/    - Adaptive learning system
lib/integrations/- External service clients
```

### Active Databases
```
.data/wrath-shield.db  - PRIMARY (17MB)
.data/events.db        - Events (144MB)
.data/relationships.db - Relationships (1.4MB)
```

### Environment Requirements
- `TODOIST_API_KEY` - For task sync
- `AGENTIC_GROK_URL` - Set to empty or remove routes
- Clerk Auth - Required for API endpoints

---

## Contact

For questions about this codebase, check:
1. `CLAUDE.md` - Orchestration patterns
2. `CLEANUP_REPORT_20241210.md` - Recent cleanup details
3. `docs/` - Feature documentation
