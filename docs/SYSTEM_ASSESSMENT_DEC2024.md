# Wrath Shield v3 - System Assessment
## December 2024

### Executive Summary

The Wrath Shield architecture is **well-designed but 60% activated**. The brain exists; the hands and feet are missing.

---

## What's WORKING (Core Infrastructure)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **Orchestrator** | `lib/orchestration/unified-orchestrator.ts` | ✅ 961 lines | Decision engine for signal routing |
| **AgentInvoker** | `lib/agents/AgentInvoker.ts` | ✅ 561 lines | Central LLM gateway with Zep integration |
| **Agent Bus** | `lib/agent_bus.ts` | ✅ 939 lines | Inter-agent messaging with adaptive triggers |
| **Zep Memory** | `lib/memory/zep.ts` | ✅ | Dual-graph: private agent + org-council |
| **PM Integration** | `lib/pm/integration.ts` | ✅ | GitHub-native unified task model |
| **Local Task Store** | `lib/pm/local-task-store.ts` | ✅ | SQLite CRUD complete |
| **Life OS Config** | `lib/life-os-config/index.ts` | ✅ | Domain mappings, escalation rules |
| **Comms Pipeline** | `lib/comms/pipeline.ts` | ✅ | 5-stage classification |
| **EA Adjudicator** | `lib/ea/adjudicator.ts` | ✅ | AI-powered item routing |
| **Gmail Ingestion** | `scripts/ingest-gmail.ts` | ✅ | OAuth + Google APIs |
| **Outlook Ingestion** | `scripts/ingest-outlook.ts` | ✅ | MS Graph API |

---

## What's BROKEN/MISSING (Execution Layer)

| Gap | Impact | Root Cause |
|-----|--------|------------|
| **No Background Scheduler** | CRITICAL | `processQueue()` never called automatically |
| **No Pipeline Connection** | CRITICAL | JSONL files not fed to Comms Pipeline |
| **Escalation Approval UI** | HIGH | No interface for PROPOSE items |
| **Manual Agent Triggers** | MEDIUM | Dashboard is read-only |
| **Legal Pod** | LOW | Stub only (returns notes, no actions) |

---

## Architecture: Intended vs Actual

### INTENDED FLOW
```
Email/iMessage → Comms Pipeline → Classify → Route → Agent Bus → Domain Agent → Action
                                                  ↓
                                          EA Adjudicator
                                                  ↓
                                       Orchestrator (if complex)
```

### ACTUAL FLOW
```
Email/iMessage → [MANUAL SCRIPT] → JSONL Files → [GAP] → Comms Pipeline → Classify → ...
                                                              ↓
                                               Task Queue → [NEVER PROCESSED]
```

---

## Duplications Identified

### 1. Classification Logic (Two Decision Points)
- `lib/comms/pipeline.ts` - Regex pattern matching
- `lib/ea/adjudicator.ts` - LLM-powered classification

**Recommendation**: Keep EA Adjudicator (smarter), simplify Comms Pipeline to ingest/dedupe only.

### 2. Task Creation Paths (3+ Entry Points)
- `createTask()` in `lib/pm/integration.ts`
- `createTaskFromSignal()` in same file
- `createLocalTask()` in `lib/pm/local-task-store.ts`
- Context requests also become tasks

**Recommendation**: Funnel all through `createTask()` with source parameter.

### 3. Memory Systems (4 Backends)
- Zep Cloud (primary)
- Grok Memory Service (fallback)
- Qdrant (fallback)
- SQLite (final fallback)

**Recommendation**: Remove fallbacks. Zep Cloud is reliable.

---

## Motion Deprecation Status

✅ **COMPLETE** - All Motion integration removed (December 2024)
- Deleted: 5 Motion client files
- Updated: 8+ files referencing Motion
- New: GitHub-only workflow via `config/mappings.json` v2

---

## Agent Communication Map

```
┌────────────────────────────────────────────────────────────────────┐
│                         INBOUND SOURCES                            │
│  Gmail (2) │ Outlook (2) │ iMessage │ Lifelogs │ GitHub Webhooks   │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   COMMS PIPELINE      │
                    │  (5-stage processing) │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │ EA Adjudicator│   │ Domain Agents │   │ Orchestrator │
     │  - Route      │   │ - Finance     │   │ - Complex    │
     │  - Learn      │   │ - Legal       │   │ - Multi-agent│
     │  - Escalate   │   │ - PM          │   │              │
     └───────┬──────┘   └───────┬──────┘   └───────┬──────┘
             │                  │                   │
             └──────────────────┼───────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │      ZEP MEMORY       │
                    │  (Dual-graph: private │
                    │   + org-council)      │
                    └───────────────────────┘
```

---

## Priority Fixes (Entropy Minimization for James)

### Phase 1: ACTIVATION (Immediate)
1. ✅ `/api/cron/ingest` - Unified ingestion endpoint [IN PROGRESS]
2. ✅ `/api/cron/process` - Queue processor endpoint [IN PROGRESS]
3. Dashboard "Activate Now" button

### Phase 2: EA LEARNING (Next)
4. ✅ `lib/ea/preference-model.ts` - James's adaptive model [IN PROGRESS]
5. `/app/dashboard/ea-chat/page.tsx` - Learning interface
6. `/api/ea/learn` - Preference update endpoint

### Phase 3: VISUALIZATION
7. Comms Temporal Maps (Zep timeline)
8. Squad Health for AgentAnatomyCard
9. Approval Queue UI

### Phase 4: OPTIMIZATION
10. WebSocket real-time updates
11. "Nano Banana" visual polish
12. Cross-agent collaboration patterns

---

## Verification Criteria

**Phase 1 Complete When:**
- Click "Activate Now" button
- System ingests last 7 days from 4 mailboxes
- Items flow through Comms Pipeline
- Tasks appear in PM queue
- Activity visible in dashboard

**Phase 2 Complete When:**
- EA Chat shows recent items
- James can correct classifications
- Corrections persist in Zep
- Future classifications use learned preferences

---

## Technical Debt

1. **TypeScript Errors**: Pre-existing in `app/hyro/forge/proficiency/page.tsx` (lines 134, 142, 160-163, 285-286)
2. **Missing Tests**: Many integration paths untested
3. **Hardcoded Values**: Some thresholds should be configurable
4. **Documentation Gap**: Agent prompts not fully documented

---

## James's Unique Requirements

James is a **non-linear system**. The EA cannot use rigid rules.

| Requirement | Implementation |
|-------------|----------------|
| No formal schedule | On-demand processing + optional cron |
| Learn preferences | EA preference model with corrections |
| Minimize cognitive load | Batch items, surface only critical |
| Conversational learning | EA Chat interface |
| Adapt over time | Zep memory + preference vectors |

---

*Last Updated: December 2024*
*Status: Activation Layer In Progress*
