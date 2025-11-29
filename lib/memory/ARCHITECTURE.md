# Wrath Shield Memory Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Wrath Shield Application                      │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Finance  │  │  Legal   │  │    PM    │  │    EA    │  ...      │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │             │             │             │                   │
│       └─────────────┴─────────────┴─────────────┘                   │
│                          │                                           │
│                          ▼                                           │
│              ┌─────────────────────┐                                │
│              │   MemoryWrapper     │                                │
│              │   (lib/MemoryWrapper.ts)                             │
│              └──────────┬──────────┘                                │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │   Zep    │   │   Grok   │   │  Qdrant  │
    │  Cloud   │   │  Memory  │   │  Vector  │
    │ (primary)│   │ (backup) │   │   DB     │
    └──────────┘   └──────────┘   └────┬─────┘
         │              │              │
         │              │              └─────┐
         │              │                    │
         ▼              ▼                    ▼
    [External]     [Local:8001]        [Local:6333]

    If none available → SQLite fallback
```

## Memory Backend Priority

```
Priority 1: Zep Cloud
├─ Condition: ZEP_API_KEY is set
├─ Features: Knowledge graphs, auto-summarization, cloud storage
└─ Fallback: If unavailable or error → Priority 2

Priority 2: Grok Memory Service
├─ Condition: http://localhost:8001/api/agentic/health returns 200
├─ Features: Local vector embeddings, fast access
└─ Fallback: If unavailable → Priority 3

Priority 3: Qdrant Vector Database
├─ Condition: http://localhost:6333/healthz returns 200
├─ Features: Local vector store, persistent storage
└─ Fallback: If unavailable → Priority 4

Priority 4: SQLite In-Memory
├─ Condition: Always available
├─ Features: Simple text search, no dependencies
└─ Fallback: None (final fallback)
```

## Zep Cloud Architecture

### Project Structure

```
Zep Cloud Project: wrath-shield
│
├─ User: finance-agent
│  ├─ Session: finance-agent-main (default)
│  ├─ Session: finance-agent-q4-review
│  └─ Session: finance-agent-budget-2025
│
├─ User: legal-agent
│  ├─ Session: legal-agent-main (default)
│  ├─ Session: legal-agent-case-12345
│  └─ Session: legal-agent-case-67890
│
├─ User: pm-agent
│  ├─ Session: pm-agent-main (default)
│  └─ Session: pm-agent-github-sync
│
├─ User: ea-agent
│  ├─ Session: ea-agent-main (default)
│  └─ Session: ea-agent-calendar-2025
│
├─ User: comms-agent
│  ├─ Session: comms-agent-main (default)
│  ├─ Session: comms-agent-email-batch-nov
│  └─ Session: comms-agent-imessages
│
├─ User: hyro-agent (Research/Grok)
│  ├─ Session: hyro-agent-main (default)
│  └─ Session: hyro-agent-research-ai
│
├─ User: relationships-agent
│  ├─ Session: relationships-agent-main (default)
│  └─ Session: relationships-agent-crm-sync
│
└─ User: eeg-agent
   ├─ Session: eeg-agent-main (default)
   └─ Session: eeg-agent-focus-analysis
```

### Data Flow

```
1. Memory Addition
   ┌──────────────┐
   │  Agent Call  │
   │ addMemory()  │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │MemoryWrapper │
   │  .add()      │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  ZepClient   │
   │ addZepMemory()│
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────┐
   │  ensureUser()        │
   │  (create if needed)  │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │  ensureSession()     │
   │  (create if needed)  │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │  Zep Cloud API       │
   │  POST /memory/add    │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │  Memory Stored       │
   │  + Auto Summary      │
   │  + Knowledge Graph   │
   └──────────────────────┘

2. Memory Search
   ┌──────────────┐
   │  Agent Call  │
   │searchMemory()│
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │MemoryWrapper │
   │  .search()   │
   └──────┬───────┘
          │
          ▼
   ┌──────────────┐
   │  ZepClient   │
   │searchZepMemory()│
   └──────┬───────┘
          │
          ▼
   ┌──────────────────────┐
   │  Zep Cloud API       │
   │  POST /memory/search │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │  Vector Search       │
   │  + Semantic Ranking  │
   │  + Score Results     │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │  Return Results      │
   │  [memory, score]     │
   └──────────────────────┘
```

## Agent Memory Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    Zep Cloud Project                         │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐│
│  │ finance-agent  │  │  legal-agent   │  │   pm-agent     ││
│  │                │  │                │  │                ││
│  │ • Transactions │  │ • Case notes   │  │ • Project logs ││
│  │ • Vendors      │  │ • Emails       │  │ • GitHub sync  ││
│  │ • Categories   │  │ • Deadlines    │  │ • Tasks        ││
│  │                │  │                │  │                ││
│  │ [Isolated]     │  │ [Isolated]     │  │ [Isolated]     ││
│  └────────────────┘  └────────────────┘  └────────────────┘│
│           ▲                  ▲                   ▲          │
│           │                  │                   │          │
│           └──────────────────┴───────────────────┘          │
│                              │                              │
│                    [Shared Embedding Space]                 │
│                    (enables cross-agent search)             │
└─────────────────────────────────────────────────────────────┘
```

## User ID Mapping

```typescript
// Internal agent IDs → Zep user IDs
const mapping = {
  'finance'       → 'finance-agent',
  'legal'         → 'legal-agent',
  'pm'            → 'pm-agent',
  'ea'            → 'ea-agent',
  'comms'         → 'comms-agent',
  'hyro'          → 'hyro-agent',
  'grok'          → 'hyro-agent',      // alias
  'relationships' → 'relationships-agent',
  'eeg'           → 'eeg-agent',
};

// Already in agent format? Pass through
if (userId.endsWith('-agent')) {
  return userId;
}
```

## Session Management

```
Default Session Pattern: {agentId}-main

Examples:
  finance-agent    → finance-agent-main
  legal-agent      → legal-agent-main
  pm-agent         → pm-agent-main

Custom Session Pattern: {agentId}-{purpose}

Examples:
  finance-agent    → finance-agent-q4-budget
  legal-agent      → legal-agent-case-12345
  comms-agent      → comms-agent-email-nov-2025

Sessions are created automatically on first use.
```

## Memory Operations

### Add Memory

```
Input:
  text: "Transaction: Amazon $49.99"
  userId: "finance"
  metadata: { vendor: "Amazon", amount: 49.99 }

Processing:
  1. Map userId: "finance" → "finance-agent"
  2. Ensure user exists in Zep
  3. Get/create session: "finance-agent-main"
  4. Add message to session with metadata

Output:
  Memory stored in Zep Cloud
  Auto-summary updated
  Knowledge graph updated
```

### Search Memory

```
Input:
  query: "Amazon purchases"
  userId: "finance"
  limit: 5

Processing:
  1. Map userId: "finance" → "finance-agent"
  2. Generate query embedding
  3. Search across all sessions for user
  4. Rank by semantic similarity

Output:
  [
    { memory: {...}, score: 0.92 },
    { memory: {...}, score: 0.87 },
    { memory: {...}, score: 0.81 },
    ...
  ]
```

### Get Context

```
Input:
  userId: "finance-agent"
  sessionId: "finance-agent-main" (optional)

Processing:
  1. Retrieve session from Zep
  2. Get auto-generated summary
  3. Fallback to recent messages if no summary

Output:
  "Finance agent has processed 142 transactions this month.
   Top vendors: Amazon ($1,234), Uber ($567), Whole Foods ($432).
   Categories: Groceries (35%), Transportation (25%), Tech (20%)."
```

## Knowledge Graph

```
Zep automatically builds connections:

Entity: "Amazon"
  └─ Mentioned by: finance-agent (142 times)
  └─ Categories: [vendor, e-commerce, tech]
  └─ Related to: ["Whole Foods", "AWS", "Prime"]

Entity: "Case 12345"
  └─ Mentioned by: legal-agent (28 times)
  └─ Categories: [legal-case, active]
  └─ Related to: ["Destiny", "MyCase", "Court"]

Entity: "GitHub PR #456"
  └─ Mentioned by: pm-agent (15 times)
  └─ Categories: [pull-request, in-progress]
  └─ Related to: ["Motion", "Task-789"]
```

## Performance

```
Operation              | Zep Cloud | Qdrant | SQLite
-----------------------|-----------|--------|--------
Add Memory             | 50ms      | 20ms   | 5ms
Search (5 results)     | 100ms     | 50ms   | 500ms
Get Context            | 75ms      | N/A    | N/A
Semantic Accuracy      | High      | High   | Low
Auto-summarization     | Yes       | No     | No
Knowledge Graph        | Yes       | No     | No
Scale Limit            | Unlimited | Local  | Local
```

## Error Handling

```
┌─────────────┐
│ Try Zep     │
└──────┬──────┘
       │
       ▼
   [Success?] ──Yes──> Use Zep
       │
       No
       │
       ▼
┌─────────────┐
│ Try Grok    │
└──────┬──────┘
       │
       ▼
   [Success?] ──Yes──> Use Grok
       │
       No
       │
       ▼
┌─────────────┐
│ Try Qdrant  │
└──────┬──────┘
       │
       ▼
   [Success?] ──Yes──> Use Qdrant
       │
       No
       │
       ▼
┌─────────────┐
│ Use SQLite  │ (Always succeeds)
└─────────────┘
```

## Security Model

```
┌─────────────────────────────────────┐
│      Next.js Application            │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Server Components Only      │  │
│  │                              │  │
│  │  MemoryWrapper.ts            │  │
│  │    ↓                         │  │
│  │  memory/zep.ts               │  │
│  │    ↓                         │  │
│  │  @getzep/zep-cloud           │  │
│  └──────────────┬───────────────┘  │
│                 │                  │
│                 │ ZEP_API_KEY      │
│                 │ (server-side)    │
└─────────────────┼──────────────────┘
                  │
                  │ HTTPS/TLS
                  │
                  ▼
         ┌────────────────┐
         │   Zep Cloud    │
         │                │
         │  - Encrypted   │
         │  - Isolated    │
         │  - Logged      │
         └────────────────┘
```

## File Structure

```
wrath-shield-clean/
│
├── lib/
│   ├── MemoryWrapper.ts       # Main memory interface
│   │                          # (407 lines)
│   │
│   └── memory/                # Zep integration
│       ├── zep.ts             # Zep client wrapper (525 lines)
│       ├── README.md          # Full documentation
│       ├── QUICK_START.md     # 5-min setup guide
│       └── ARCHITECTURE.md    # This file
│
├── .env.local.example         # Env var template
├── package.json               # @getzep/zep-cloud dep
└── ZEP_INTEGRATION_SUMMARY.md # Integration summary
```

## Integration Points

```
Agent → Memory API

Finance Agent:
  app/api/finance/*
    → addMemory('finance')
    → searchMemories('finance')

Legal Agent:
  app/api/legal/*
    → addMemory('legal')
    → searchMemories('legal')

PM Agent:
  app/api/pm/*
    → addMemory('pm')
    → searchMemories('pm')

EA Agent:
  app/api/ea/*
    → addMemory('ea')
    → searchMemories('ea')

Comms Agent:
  app/api/comms/*
    → addMemory('comms')
    → searchMemories('comms')

Research Agent:
  app/api/agentic/*
    → addMemory('hyro')
    → searchMemories('hyro')
```

## Configuration

```bash
# Required for Zep
ZEP_API_KEY=zep-xxxxxxxxxxxx

# Optional fallbacks
AGENTIC_GROK_URL=http://localhost:8001
QDRANT_HOST=localhost
QDRANT_PORT=6333
OPENAI_API_KEY=sk-xxxxxxxxxxxx  # For embeddings
```

## Monitoring

```
Check Active Backend:
  const config = getMemoryConfig();
  console.log(config.vectorStore);
  → 'zep' | 'grok' | 'qdrant' | 'in-memory'

View Logs:
  [MemoryWrapper] init: ZEP_API_KEY set=true
  [ZepClient] Successfully initialized Zep Cloud client
  [MemoryWrapper] Successfully connected to Zep Cloud
  [ZepClient] Added memory for finance-agent in session finance-agent-main

Zep Dashboard:
  https://cloud.getzep.com/projects/your-project
  - Users: 8 agents
  - Sessions: ~10-50 (varies by usage)
  - Memories: Growing daily
  - Search performance
  - Knowledge graph visualization
```

---

**Architecture Documentation Complete** ✅
