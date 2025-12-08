# Agent Dependencies & Communication Flows

## Overview

This document maps the inter-agent communication patterns and dependencies in Wrath Shield v3.

## Agent Registry

| Agent ID | Name | Role | Primary Functions |
|----------|------|------|-------------------|
| `orchestrator` | Orchestrator | Meta-coordinator | Routes complex requests, coordinates multi-agent workflows |
| `agent.pm` | Project Maestro | Domain Agent | GitHub sync, task management, project tracking |
| `agent.legal` | Legal Advocate | Domain Agent | Case tracking, compliance, legal document analysis |
| `agent.finance` | Finance Analyst | Domain Agent | Transaction classification, Plaid integration, expense tracking |
| `agent.comms` | Comms Scout | Domain Agent | Email/iMessage classification, contact management |
| `agent.ea` | Executive Assistant | Domain Agent | Calendar, scheduling, item adjudication, continuity tracking |
| `agent.health` | Bio-Data Analyst | Domain Agent | WHOOP integration, health metrics |
| `agent.hyro` | Research Agent | Support Agent | Deep research, education, fact-checking |

## Communication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INBOUND EVENTS                               │
│  (Email, iMessage, Calendar, Lifelogs, GitHub webhooks)             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    COMMS PIPELINE (5 stages)                         │
│  Ingest → Dedupe → Classify → Route → Action                        │
│  - Pattern-based classification                                      │
│  - Life OS domain detection                                          │
│  - Escalation level determination                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │     smartEmit()        │
                    │  (Agent Bus routing)   │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  EA Adjudicator│     │  Domain Agents │     │  Orchestrator │
│  - Routes items│     │  (Finance,     │     │  - Complex    │
│  - Determines  │     │   Legal, PM)   │     │    requests   │
│    priority    │     │  - Specialized │     │  - Multi-agent│
│  - Suggests    │     │    processing  │     │    coord      │
│    actions     │     └───────────────┘     └───────────────┘
└───────────────┘
```

## Key Integration Points

### 1. Comms Pipeline → Agent Bus

The `lib/comms/pipeline.ts` classifies incoming events and routes them via:
- `smartEmit()` - Auto-routes based on content analysis
- `routeToAgents()` - Uses Life OS config for agent-domain mappings
- `createContextRequest()` - Creates actionable work items

### 2. EA Adjudicator → Domain Agents

`lib/ea/adjudicator.ts` routes items to specific agents:
- `agent.finance` - Invoices, payments, financial items
- `agent.legal` - Contracts, legal documents, compliance
- `agent.pm` - Tasks, projects, milestones
- `agent.orchestrator` - Complex multi-domain items

### 3. Life OS Config → All Agents

`lib/life-os-config/index.ts` provides:
- Domain definitions and priority weights
- Escalation rules (CRITICAL, PROPOSE, AUTO_EXECUTE)
- Agent-domain mappings

### 4. Memory Integration

All agents use `lib/agents/AgentInvoker.ts` which:
- Routes to appropriate LLM provider (OpenAI, xAI, OpenRouter)
- Injects Zep memory context
- Enforces escalation levels

## Escalation Levels

| Level | Triggers | Response |
|-------|----------|----------|
| CRITICAL | Lawsuit, security breach, FCRA violation | Immediate human attention |
| PROPOSE | New project, budget change, deadline change | Agent proposes, human approves |
| AUTO_EXECUTE | Routine tasks, low-risk actions | Agent acts autonomously |

## Data Flow for Common Operations

### Processing an Email

1. Email arrives via inbox API
2. Comms Pipeline classifies (finance/legal/pm/ea/junk)
3. If high-confidence: routes to domain agent via Agent Bus
4. If low-confidence: creates context request for human review
5. EA Adjudicator may re-route if initial classification is wrong

### Creating a Task from Event

1. Comms Pipeline routes PM-related item
2. PM Agent receives via Agent Bus
3. PM Integration creates GitHub issue or local task
4. Sync Service records in SQLite
5. Memory stores decision for future reference

### Cross-Agent Collaboration

1. Legal Agent needs project timeline
2. Sends request to PM Agent via Agent Bus
3. PM Agent queries GitHub issues
4. Responds with structured data
5. Legal Agent incorporates into brief

## Configuration Files

| File | Purpose |
|------|---------|
| `config/agents.json` | Agent definitions and system prompts |
| `config/domains.json` | Life domains (Family, Utlyze, Vuplicity, etc.) |
| `config/life_charter.json` | Global principles and escalation rules |
| `config/mappings.json` | GitHub project mappings |

## Motion Deprecation (Dec 2024)

Motion integration has been fully removed. All task management now flows through:
- **GitHub Issues** - Primary task source
- **GitHub Milestones** - Project organization
- **Local SQLite** - Quick tasks and offline storage

---

*Last updated: December 2024*
*Motion removal completed*
