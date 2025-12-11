# Wrath Shield v3: Complete Architecture Overview

**A Personal AI Operating System for Cognitive Protection, Life Optimization, and Educational Development**

---

## Executive Summary

**Wrath Shield v3** is not just an app - it's a **multi-layered AI-powered life operating system** that:

1. **Protects cognitive sovereignty** through manipulation detection
2. **Orchestrates multi-agent AI systems** for life domains (Legal, Finance, PM, Comms, Health, EA)
3. **Tracks biometric + neural data** (WHOOP recovery, Neurable EEG, Limitless conversations)
4. **Educates children** through gamified, AI-adaptive assessment (HYRO Forge)
5. **Synthesizes multi-source events** into unified actionable tasks (Cortex)
6. **Gates user experience** based on wellbeing metrics (UIX system)

---

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: USER EXPERIENCE                      │
│  - Next.js 14 App Router (TypeScript)                           │
│  - Tailwind CSS + shadcn/ui                                     │
│  - Real-time dashboards (Legal, Finance, PM, HYRO, Deck)        │
│  - UIX Gating System (locks features when wellbeing < 70)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│             LAYER 2: ORCHESTRATION & DECISION ENGINE             │
│  - Orchestrator Gateway (858-line API bridge)                   │
│  - Life OS Event Bus (pattern-based agent communication)        │
│  - AgentInvoker (escalation: CRITICAL/PROPOSE/AUTO_EXECUTE)     │
│  - Unified Bus (cross-domain coordination)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   LAYER 3: MULTI-AGENT SYSTEM                    │
│  Legal Advocate   │ Finance Analyst │ Project Maestro (PM)      │
│  Comms Scout      │ Executive Asst  │ Relationship Manager      │
│  Research (Grok)  │ Bio-Data (EEG)  │ HYRO Education Agent      │
│                                                                  │
│  Each agent:                                                     │
│  - Subscribes to event bus patterns (e.g., "domain.legal")     │
│  - Escalates decisions (auto-execute vs propose vs critical)    │
│  - Maintains memory in Zep Cloud temporal knowledge graph       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               LAYER 4: COGNITIVE SYNTHESIS ENGINE                │
│  - Working Memory Events (multi-source ingestion)               │
│  - Unified Tasks (synthesized from events)                      │
│  - Synthesis Patterns (learned consolidation rules)             │
│  - Confidence scoring (0.0-1.0) with refinement tracking        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 LAYER 5: DATA INTEGRATION LAYER                  │
│  WHOOP API       │ Limitless API    │ MyCase (Legal)            │
│  Motion (PM)     │ Gmail (Comms)    │ Plaid (Finance)           │
│  Neurable (EEG)  │ Clerk Auth       │ Zearn (Education)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 6: MEMORY & KNOWLEDGE                     │
│  SQLite (Primary DB)      - 139 tables, local storage           │
│  TimescaleDB              - EEG tokens (256 Hz → 1-sec windows)  │
│  Zep Cloud                - Agent memory (temporal graph)        │
│  Qdrant (Vector DB)       - Semantic search (Mem0 + Ollama)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 7: AI SERVICES (PYTHON MICROSERVICES)         │
│  Memory Layer Service     - Mem0 + Graphiti (port 8789)         │
│  EEG Tokenizer Service    - Neurable WebSocket → TimescaleDB    │
│  Timeline API             - Multi-modal data unification        │
│  Grok Orchestrator        - xAI research agent (port 8001)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Subsystems

### 1. 🛡️ **Manipulation Detection & UIX Gating**

**Purpose**: Protect cognitive sovereignty by detecting manipulation attempts and gating UI based on wellbeing.

**Components**:
- **Flags Table**: Stores detected manipulation attempts with severity scores
- **UIX Calculator**: Daily score based on WHOOP recovery + strain + sleep
- **Deck System**: Daily tasks (word/action/body) with gating rules
  - If UIX < 70 for 2 consecutive days → Deck locked
  - Unlock by "stomping" 3 manipulation flags

**Example Flow**:
```typescript
// User opens Deck
const uixGated = await isDeckGated(); // Check UIX history
if (uixGated) {
  return { locked: true, unlockRequirement: 'STOMP_3_FLAGS' };
}
// If UIX good, show tasks
const tasks = await getDailyTasks(); // word, action, body
```

**Key Files**:
- `/app/api/deck/route.ts` - Daily tasks API
- `/app/api/flags/route.ts` - Manipulation flags API
- `/app/api/uix/route.ts` - UIX calculation

---

### 2. 🧠 **Cortex Cognitive Synthesis Engine**

**Purpose**: Consolidate multi-source events (Gmail, Calendar, iMessage, Motion, GitHub, WHOOP, Limitless) into unified actionable tasks.

**Database Schema**:
```sql
-- Raw events from all sources
working_memory_events (
  source: 'gmail' | 'limitless' | 'calendar' | 'motion' | 'whoop',
  content_hash: SHA-256 for deduplication,
  embedding_json: Vector for semantic search,
  processed_by_synthesis: 0 or 1
)

-- Synthesized tasks
unified_tasks (
  urgency: 'critical' | 'high' | 'medium' | 'low',
  confidence: 0.0 - 1.0,
  domain: 'finance' | 'legal' | 'pm' | 'comms' | 'health',
  source_events_json: Array of event IDs,
  status: 'synthesizing' | 'ready' | 'approved' | 'executing' | 'completed'
)

-- Learned patterns
synthesis_patterns (
  pattern_type: 'consolidation' | 'urgency' | 'action' | 'relationship',
  success_rate: Running average from user feedback
)
```

**Synthesis Flow**:
1. Ingest events from Gmail, Limitless, etc.
2. Check `content_hash` for duplicates
3. Apply `synthesis_patterns` to consolidate related events
4. Create `unified_task` with confidence score
5. User approves/dismisses → Update pattern `success_rate`

**Key Files**:
- `/lib/db/queries.ts` - Synthesis database functions
- `/migrations/045_cognitive_synthesis_engine.sql`
- `/COGNITIVE_SYNTHESIS_SCHEMA.md`

---

### 3. 🤖 **Life OS Multi-Agent System**

**Purpose**: Autonomous AI agents for each life domain with escalation controls.

**Agent Architecture**:
```typescript
interface Agent {
  id: string; // 'agent.legal', 'agent.finance', etc.
  name: string;
  domains: string[]; // e.g., ['finance', 'legal']
  tools: string[]; // e.g., ['plaid', 'mycase']
  escalation_policy: {
    CRITICAL: 'always_notify';      // Red alert, immediate action
    PROPOSE: 'require_approval';    // Yellow, needs user review
    AUTO_EXECUTE: 'execute_log';    // Green, run automatically
  };
}
```

**Agent Roster**:
| Agent | Domain | Tools | Status |
|-------|--------|-------|--------|
| **Legal Advocate** | Legal | MyCase, Gmail | ✅ Active |
| **Finance Analyst** | Finance | Plaid, WHOOP | ✅ Active |
| **Project Maestro** | PM | Motion, GitHub, Taskmaster | ✅ Active |
| **Comms Scout** | Comms | Gmail, iMessage | ✅ Active |
| **Executive Assistant** | EA | Calendar, Travel | ✅ Active |
| **Relationship Manager** | Relationships | Contacts DB | ✅ Active |
| **Research Agent (Grok)** | All | xAI Grok API | ✅ Active |
| **Bio-Data Analyst** | Health | Neurable EEG | ✅ Active (check connection) |
| **HYRO Education** | Education | Zearn, IRT algorithms | ✅ Active |
| **Scheduler** | Automation | Cron | 🔴 Planned |
| **Saturation Learner** | Learning | TBD | 🔴 Planned |

**Event Bus Communication**:
```typescript
const bus = getEventBus();

// Legal agent subscribes to legal events
bus.subscribe('domain.legal', async (event) => {
  // Handle MyCase updates, contract deadlines, etc.
}, 100, 'legal-agent');

// Finance agent publishes transaction alert
await bus.publish(
  createNotificationEvent(
    'finance-agent',
    { type: 'unusual_transaction', amount: 50000 },
    DOMAINS.FINANCE,
    'high'
  )
);

// EA agent escalates critical calendar conflict
await bus.publishEscalation('critical', {
  source: 'ea-agent',
  payload: { conflict: 'Double-booked meeting' },
});
```

**Key Files**:
- `/lib/agents/registry.ts` - Agent status aggregation
- `/lib/agents/life-os-event-bus.ts` - Event bus implementation
- `/lib/agents/AgentInvoker.ts` - Escalation + execution logic
- `/AGENT_ASSETS.md` - 16-bit RPG pixel art prompts for each agent

---

### 4. 🎓 **HYRO Forge: Adaptive Educational System**

**Purpose**: Gamified, AI-powered assessment for children using IRT (Item Response Theory).

**Features**:
- **Multi-stat battery**: Math, Reading, Writing, Science, Coding, etc.
- **Adaptive difficulty**: Uses IRT to adjust item difficulty based on student ability (θ)
- **Real-time scoring**: 0-100 scale with convergence detection
- **Misconception tracking**: Records errors to inform future item generation
- **Alert system**: Notifies parents of streaks, achievements, progress
- **Visual assessment**: Diagram interpretation, chart reading, spatial reasoning
- **Multi-modal learning**: Text, image, video, interactive, audio

**Database Schema** (24+ tables):
```sql
hyro_stats               -- Core stats (Math, Reading, etc.)
hyro_diagnostic_sessions -- Assessment sessions
hyro_generated_items     -- AI-generated assessment items
hyro_misconceptions      -- Tracked student errors
hyro_alerts              -- Parent notifications
hyro_streak_tracker      -- Learning streak management
```

**Assessment Flow**:
```typescript
// 1. Start diagnostic session
const session = await startDiagnosticSession(studentId, 'math');

// 2. Generate adaptive item based on current ability estimate
const item = await generateNextItem(session.id, session.theta_estimate);

// 3. Submit response
const result = await submitResponse(session.id, item.id, 'b', 5000);
// → Updates theta_estimate using IRT
// → Checks for convergence (SE < threshold)

// 4. Complete when converged
if (result.complete) {
  const report = await getDiagnosticReport(session.id);
  // Shows final score, strand breakdown, recommendations
}
```

**Key Files**:
- `/app/api/hyro/forge/v4/route.ts` - Main assessment API
- `/lib/hyro/forge-irt.ts` - Item Response Theory engine
- `/lib/hyro/forge-alerts.ts` - Parent notification system
- `/HYRO_PHASE4_ALERTS.md` - Alert system documentation
- `/app/api/hyro/forge/v4/README.md` - API documentation

---

### 5. 🧬 **Neurable Multi-Modal Integration**

**Purpose**: Unify EEG brain data with biometrics (WHOOP) and conversations (Limitless) for cognitive coaching.

**Data Sources**:
- **Neurable EEG**: 256 Hz × 12 channels → Tokenized to 1-second windows
  - Stored in TimescaleDB with power spectrum features
- **WHOOP**: Recovery, Strain, Sleep, HRV
  - Stored in SQLite (`whoop_cycles`, `recoveries`, `sleeps`)
- **Limitless**: Audio transcripts with timestamps
  - Stored in SQLite (`limitless_lifelogs`)

**Timeline API Architecture**:
```python
# services/timeline-api/main.py
class DataBridge:
    def __init__(self):
        self.eeg_client = TimescaleDBClient()
        self.sqlite_client = SQLiteClient()

    def query_timeline(self, start: str, end: str):
        # Normalize timestamps to ISO 8601
        eeg_data = self.eeg_client.get_tokens(start, end)
        whoop_data = self.sqlite_client.get_cycles(start, end)
        limitless_data = self.sqlite_client.get_lifelogs(start, end)

        # Merge and return unified timeline
        return {
            'eeg': eeg_data,
            'biometrics': whoop_data,
            'conversations': limitless_data,
            'data_quality': self.assess_quality()
        }
```

**Streamlit Dashboard** (port 8501):
```
┌─────────────────────────────────────────────────────────────┐
│  Timeline: 2025-11-09 08:00 - 12:00                         │
├─────────────────────────────────────────────────────────────┤
│  Panel 1: EEG Power Spectrum (1-second windows)             │
│  [||||||||||||||||||||||||||||||||||||||||||||||||||||]     │
├─────────────────────────────────────────────────────────────┤
│  Panel 2: Biometrics (Recovery, Strain, Sleep)             │
│  ● Recovery: 78%  ● Strain: 12.4  ● Sleep: 85%             │
├─────────────────────────────────────────────────────────────┤
│  Panel 3: Conversations (Limitless transcripts)            │
│  "Discussing project deadlines..." [08:15-08:43]           │
└─────────────────────────────────────────────────────────────┘
```

**Key Files**:
- `/services/eeg-tokenizer/` - EEG ingestion service
- `/services/memory-layer/` - Mem0 + Graphiti semantic memory
- `/NEURABLE_INTEGRATION_PLAN.md` - Complete integration plan

---

### 6. 🚪 **Orchestrator Gateway**

**Purpose**: Central API bridge between Next.js frontend and Python microservices (especially Grok research agent).

**Endpoints** (858 lines of routing logic):
```typescript
// POST operations
{
  operation: 'invoke',
  agentId: 'agent.grok',
  message: 'Research latest developments in quantum computing',
  awaitResponse: true
} → Calls Python Grok service at http://localhost:8001

{
  operation: 'memory',
  graphType: 'org-council',
  action: 'propose',
  text: 'New company policy: 4-day work week'
} → Stores in Zep Cloud, requires approval from "council"

{
  operation: 'unified',
  action: 'direct-invoke',
  targetAgent: 'agent.finance',
  message: 'Analyze Q4 expenses'
} → Sends via Unified Bus to Finance Agent

{
  operation: 'coordinate',
  agents: ['agent.legal', 'agent.finance'],
  task: 'Review vendor contract'
} → Multi-agent coordination
```

```typescript
// GET operations
?operation=pulse          → System health, agent status
?operation=config         → Life OS configuration (charter, agents, domains)
?operation=states         → All agent states
?operation=overview       → Full system overview
```

**Key Files**:
- `/app/api/orchestrator/gateway/route.ts` - Gateway implementation
- `/lib/agents/UnifiedBus.ts` - Agent coordination bus
- `/lib/agents/AgentInvoker.ts` - Agent invocation + escalation

---

### 7. 📦 **Memory Architecture**

**Multiple Memory Systems**:

| System | Storage | Purpose | Latency |
|--------|---------|---------|---------|
| **SQLite** | Local file | Primary structured data | ~1ms |
| **TimescaleDB** | PostgreSQL | EEG time-series data | ~10ms |
| **Zep Cloud** | Cloud | Agent temporal knowledge graphs | ~100ms |
| **Qdrant** | Vector DB | Semantic search (Mem0 + Ollama) | ~200ms |

**Zep Cloud Memory Graphs**:
```typescript
// Agent-specific memory (per-agent graph)
await addAgentMemory('agent.legal', 'User prefers concise legal summaries');

// Org-council memory (shared, requires approval)
const proposal = await proposeOrgMemory(
  'agent.finance',
  'Budget increased to $500k for Q1',
  { quarter: 'Q1', amount: 500000 }
);
await approveOrgProposal(proposal.proposal_id, 'user');
```

**Memory Layer Service** (Python FastAPI, port 8789):
- **Mem0**: Semantic memory with Ollama embeddings (bge-m3)
- **Graphiti**: Temporal knowledge graphs (Neo4j)
- **Remote GPU**: Offload heavy inference to Tailscale studios

```python
# Record student learning event
await client.post('/memory/add', json={
    'student_id': 'student123',
    'content': 'Student struggled with fraction division',
    'stat': 'math',
    'session_id': 'session456'
})

# Search memories
results = await client.post('/memory/search', json={
    'student_id': 'student123',
    'query': 'fraction difficulties',
    'limit': 10
})
```

**Key Files**:
- `/lib/memory/zep.ts` - Zep Cloud client
- `/services/memory-layer/main.py` - Mem0 + Graphiti service
- `/lib/db/Database.ts` - SQLite wrapper
- `/services/eeg-tokenizer/db_client.py` - TimescaleDB client

---

## Data Flow Examples

### Example 1: Legal Deadline Detection

```
1. Gmail API polls new emails
   ↓
2. Comms Scout agent ingests email
   ↓
3. Stored in working_memory_events with source='gmail'
   ↓
4. Cortex synthesis engine detects "deadline" pattern
   ↓
5. Creates unified_task with domain='legal', urgency='high'
   ↓
6. Legal Advocate agent receives notification via event bus
   ↓
7. Agent invokes MyCase API to check if deadline already tracked
   ↓
8. Escalation decision: PROPOSE (requires user approval)
   ↓
9. User approves → Create calendar event + set reminder
   ↓
10. Synthesis pattern success_rate updated
```

### Example 2: HYRO Learning Session

```
1. Student opens HYRO Forge dashboard
   ↓
2. Start diagnostic session for 'math'
   ↓
3. Generate adaptive item based on theta estimate (θ = 0.0)
   ↓
4. Student answers correctly → Update θ using IRT
   ↓
5. Record in Memory Layer (Mem0): "Student answered 3-digit multiplication correctly"
   ↓
6. Generate next item at higher difficulty
   ↓
7. Student answers incorrectly → Record misconception
   ↓
8. Continue until SE < 0.3 (convergence)
   ↓
9. Complete session → Generate diagnostic report
   ↓
10. Alert parent: "Math diagnostic complete! Score: 82/100"
```

### Example 3: UIX Gating Flow

```
1. Daily WHOOP sync (6am)
   ↓
2. Calculate UIX = (recovery * 0.5) + (strain * 0.3) + (sleep * 0.2)
   ↓
3. If UIX < 70 for 2 consecutive days → Set deck_gated = true
   ↓
4. User opens Deck → Blocked with message "Complete 3 flag stomps to unlock"
   ↓
5. User reviews manipulation flags (sorted by severity)
   ↓
6. User "stomps" 3 flags (marks as resolved)
   ↓
7. Deck unlocked → Show daily tasks (word, action, body)
   ↓
8. User completes tasks → Award XP + update UIX history
```

---

## API Port Map

| Service | Port | Purpose |
|---------|------|---------|
| **Next.js API** | 8080 | Main web application + API routes |
| **Grok Orchestrator** | 8001 | xAI research agent (Python) |
| **Memory Layer** | 8789 | Mem0 + Graphiti semantic memory (Python) |
| **Streamlit Dashboard** | 8501 | EEG visualization (Python) |
| **Timeline API** | 8082 | Multi-modal data unification (Python) |
| **TimescaleDB** | 5432 | EEG time-series database (internal only) |
| **Qdrant** | 6333 | Vector database for semantic search |

---

## Technology Stack

### Frontend
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui**
- **React** with Server Components
- **Clerk** for authentication

### Backend (Next.js)
- **SQLite** (better-sqlite3) - Primary database
- **Zep Cloud SDK** - Agent memory graphs
- **OpenAI SDK** - GPT-4o, GPT-4o-mini
- **Anthropic SDK** - Claude 3.5 Sonnet
- **xAI SDK** - Grok (via Python service)

### Python Services
- **FastAPI** - REST APIs
- **Mem0** - Semantic memory
- **Graphiti** - Temporal knowledge graphs
- **Ollama** - Local LLM inference (qwen3:8b, deepseek-r1)
- **TimescaleDB** - Time-series database
- **Qdrant** - Vector database
- **Streamlit** - Data visualization

### Integrations
- **WHOOP** - Recovery, strain, sleep data
- **Limitless** - Audio transcript memory
- **Neurable** - 12-channel EEG data
- **MyCase** - Legal case management
- **Plaid** - Banking transactions
- **Motion** - Project management
- **Zearn** - Math education platform

---

## Security Architecture

### Authentication
- **Clerk** for user auth with local fallback
- **API Key** authentication for Python services
- **OAuth 2.0** for third-party APIs (WHOOP, Limitless, Plaid)

### Data Protection
- **Encryption at rest**: AES-256-GCM for tokens
- **Encryption in transit**: HTTPS for all API calls
- **Local-first**: SQLite on user's machine, Zep Cloud for agent memory only
- **No cloud storage of raw EEG**: TimescaleDB runs locally in Docker

### Agent Permissions
- **Escalation levels**: Prevent agents from auto-executing critical actions
- **Approval flows**: Org-council memory requires user approval
- **Audit logs**: All agent invocations logged with timestamps

---

## Deployment Architecture

### Development (Current)
```yaml
# docker-compose.yml
services:
  nextjs:
    ports: ["8080:8080"]
    volumes: [".data:/app/.data"]  # SQLite

  timescaledb:
    ports: ["5432:5432"]  # Internal only
    volumes: ["timescale_data:/var/lib/postgresql/data"]

  qdrant:
    ports: ["6333:6333"]

  memory-layer:
    ports: ["8789:8789"]
    depends_on: [qdrant]

  eeg-tokenizer:
    ports: ["8501:8501"]
    depends_on: [timescaledb]
```

### Production (Planned)
- **Next.js**: Vercel deployment
- **SQLite**: Persistent volume on VPS
- **TimescaleDB**: Managed TimescaleDB Cloud
- **Python services**: AWS Lambda or Railway
- **Qdrant**: Qdrant Cloud

---

## Development Roadmap

### ✅ Completed (Current State)
- [x] Multi-agent system with event bus
- [x] Cortex cognitive synthesis engine
- [x] UIX gating + manipulation detection
- [x] WHOOP + Limitless integration
- [x] HYRO Forge IRT assessment system
- [x] Neurable EEG tokenization
- [x] Zep Cloud memory graphs
- [x] Orchestrator Gateway (858 lines)
- [x] Memory Layer Service (Mem0 + Ollama)
- [x] 10 API route test files (144 tests passing)

### 🚧 In Progress
- [ ] Timeline API (multi-modal data unification)
- [ ] Agent health monitoring (real-time status)
- [ ] Visual assessment UI components

### 📋 Planned
- [ ] Scheduler agent (cron automation)
- [ ] Saturation Learner agent (optimize knowledge intake)
- [ ] Push notifications (Web Push API)
- [ ] Real-time agent collaboration (WebSocket)
- [ ] Cross-domain synthesis (Legal + Finance insights)

---

## Key Insights

### 1. **It's a Cognitive Protection System**
UIX gating + manipulation flags + anchor memories create a framework for AI-assisted decision-making with built-in safeguards against manipulation.

### 2. **Multi-Modal Intelligence**
The system doesn't just read text - it processes:
- Brain waves (EEG)
- Biometrics (WHOOP)
- Conversations (Limitless)
- Documents (MyCase, Gmail)
- Financial data (Plaid)
- Project tasks (Motion, GitHub)

### 3. **Educational Innovation**
HYRO Forge combines:
- IRT for adaptive difficulty
- AI-generated items
- Gamification (XP, achievements, streaks)
- Multi-modal learning (text, diagrams, video)
- Real-time parent alerts

### 4. **Agent Autonomy with Safety**
Agents can auto-execute routine tasks but escalate critical decisions to user approval, balancing automation with control.

### 5. **Memory is Multi-Layered**
- **SQLite**: Fast structured queries (1ms)
- **Zep**: Temporal agent knowledge (100ms)
- **Mem0**: Semantic student learning (200ms)
- **TimescaleDB**: High-frequency EEG data (10ms)

---

## Open Questions for Further Exploration

1. **What patterns has Cortex learned?** (Check `synthesis_patterns` table)
2. **How many agent invocations per day?** (Check `agentic_actions` table)
3. **HYRO student progress?** (Check diagnostic sessions + misconceptions)
4. **EEG data quality?** (Check TimescaleDB token counts)
5. **Which agents are most active?** (Check event bus logs)

---

**Last Updated**: 2025-12-10
**Total API Routes**: 235
**Test Coverage**: 144 tests passing (10 new route test files)
**Database Tables**: 139 (SQLite) + EEG tokens (TimescaleDB)
**Active Agents**: 9 (Legal, Finance, PM, Comms, EA, Relationships, Grok, EEG, HYRO)
**Memory Systems**: 4 (SQLite, Zep, Mem0, TimescaleDB)
