# Wrath Shield Unified Memory Architecture

## Overview

Wrath Shield now uses **Zep Cloud** as the preferred unified memory system for all agents. This provides:

- **Unified memory space** - All agents share a common embedding space for cross-agent context
- **Per-agent isolation** - Each agent maintains separate conversation histories
- **Automatic summarization** - Zep generates context summaries automatically
- **Knowledge graphs** - Zep builds knowledge graphs from agent memories
- **Scalability** - Cloud-hosted, no local infrastructure needed

## Architecture

### Single Zep Project, Multiple Users

Each Wrath Shield agent is represented as a unique **user** in a single Zep project:

| Agent | Zep User ID | Purpose |
|-------|-------------|---------|
| Finance Analyst | `finance-agent` | Financial transaction memory, vendor enrichment |
| Legal Advocate | `legal-agent` | Legal case tracking, communication summaries |
| Project Maestro | `pm-agent` | Project status, GitHub/Motion sync |
| Executive Assistant | `ea-agent` | Calendar management, travel booking |
| Comms Scout | `comms-agent` | Email/iMessage classification, lifelogs |
| Research Agent (Grok) | `hyro-agent` | Deep research, fact checking |
| Relationship Manager | `relationships-agent` | CRM data, follow-up reminders |
| Bio-Data Analyst | `eeg-agent` | EEG analysis, focus tracking |

### Sessions

Each agent has a **main session** (`{agent-id}-main`) for persistent memory. Additional sessions can be created for:
- Specific conversations
- Temporary contexts
- Multi-agent collaborations

### Memory Priority

The `MemoryWrapper` tries backends in this order:

1. **Zep Cloud** (preferred) - If `ZEP_API_KEY` is set
2. **Grok Memory Service** - Local Python service at port 8001
3. **Qdrant** - Local vector database
4. **SQLite** - Final fallback with basic text search

## Setup

### 1. Get Zep API Key

1. Visit [Zep Cloud](https://cloud.getzep.com)
2. Create an account or sign in
3. Create a new project for Wrath Shield
4. Copy your API key

### 2. Configure Environment

Add to your `.env.local`:

```bash
# Zep Cloud - Unified Memory System
ZEP_API_KEY=your_zep_api_key_here
```

### 3. Install Dependencies

```bash
npm install
```

This will install `@getzep/zep-cloud` package.

### 4. Initialize Agents

On first run, each agent will be automatically created as a Zep user with appropriate metadata.

## Usage

### Basic Memory Operations

The existing `MemoryWrapper` API remains unchanged:

```typescript
import { addMemory, searchMemories, getAllMemories } from '@/lib/MemoryWrapper';

// Add memory for finance agent
await addMemory('Vendor: Amazon - Category: Tech Equipment', 'finance', {
  vendor: 'Amazon',
  category: 'tech',
  date: '2025-11-26',
});

// Search finance agent memory
const results = await searchMemories('Amazon purchases', 'finance', 5);

// Get all memories for legal agent
const allLegal = await getAllMemories('legal');
```

### Direct Zep API

For advanced use cases, import the Zep client directly:

```typescript
import {
  addZepMemory,
  searchZepMemory,
  getZepContext,
  getRecentZepMemories,
  ensureZepSession,
} from '@/lib/memory/zep';

// Add memory with custom session
await addZepMemory(
  'finance-agent',
  'Q4 budget review complete',
  { quarter: 'Q4', year: 2025 },
  'finance-agent-budget-2025'
);

// Search across all sessions
const memories = await searchZepMemory('finance-agent', 'budget', 10);

// Get context summary
const context = await getZepContext('legal-agent');

// Get recent memories
const recent = await getRecentZepMemories('pm-agent', 20);

// Create custom session
const sessionId = await ensureZepSession(
  'comms-agent',
  'comms-agent-email-batch-nov-2025',
  { type: 'email-batch', month: '2025-11' }
);
```

## Agent Integration

### Finance Agent

```typescript
import { addMemory } from '@/lib/MemoryWrapper';

// After transaction enrichment
await addMemory(
  `Enriched transaction: ${vendor} - ${category} - $${amount}`,
  'finance',
  { vendor, category, amount, date, accountId }
);
```

### Legal Agent

```typescript
import { searchMemories, addMemory } from '@/lib/MemoryWrapper';

// Before responding to legal email
const context = await searchMemories('case history with Destiny', 'legal', 5);

// After generating response
await addMemory(
  `Response to Destiny re: ${caseNumber}`,
  'legal',
  { case: caseNumber, recipient: 'destiny@example.com', date }
);
```

### Project Maestro

```typescript
import { addMemory, getZepContext } from '@/lib/MemoryWrapper';

// After GitHub sync
await addMemory(
  `Synced ${prCount} PRs from GitHub to Motion`,
  'pm',
  { prs: prCount, workspace: 'main', date }
);

// Get project context
const projectContext = await getZepContext('pm');
```

## Features

### Automatic Context Summarization

Zep automatically generates summaries of agent memories:

```typescript
import { getZepContext } from '@/lib/memory/zep';

const summary = await getZepContext('finance-agent');
// Returns: "Finance agent has processed 142 transactions this month.
// Top vendors: Amazon ($1,234), Uber ($567), ..."
```

### Cross-Agent Context

While each agent has isolated sessions, the shared embedding space enables:

1. **Related memory discovery** - Finance agent can discover legal communications about vendors
2. **Context sharing** - PM agent can reference comms about project deadlines
3. **Knowledge graphs** - Zep builds connections between entities across agents

### Session Management

```typescript
import { getZepSessions, ensureZepSession } from '@/lib/memory/zep';

// List all sessions for an agent
const sessions = await getZepSessions('legal-agent');
// ['legal-agent-main', 'legal-agent-case-12345', ...]

// Create session for specific case
await ensureZepSession('legal-agent', 'legal-agent-case-12345', {
  case: '12345',
  client: 'destiny',
});
```

## Migration from Existing Memory

### From Qdrant/Mem0

Existing memories are preserved in the fallback chain. Zep will be used for new memories while old memories remain accessible through Qdrant.

To migrate existing memories to Zep:

```typescript
import { getAllMemories, addZepMemory } from '@/lib/MemoryWrapper';

async function migrateAgent(agentId: string) {
  const oldMemories = await getAllMemories(agentId);

  for (const memory of oldMemories) {
    await addZepMemory(
      `${agentId}-agent`,
      memory.text,
      memory.metadata
    );
  }
}
```

### From Grok Service

The Grok memory service continues to work as a fallback. Zep will be preferred when available.

## Monitoring

### Check Active Backend

```typescript
import { getMemoryConfig } from '@/lib/MemoryWrapper';

const config = getMemoryConfig();
console.log('Active memory backend:', config?.vectorStore);
// 'zep' | 'grok' | 'qdrant' | 'in-memory'
```

### View Logs

```bash
# Check initialization logs
npm run dev

# Look for:
# [MemoryWrapper] init: ZEP_API_KEY set=true
# [MemoryWrapper] Successfully connected to Zep Cloud
# [ZepClient] Successfully initialized Zep Cloud client
```

## Troubleshooting

### Zep Not Activating

1. Check `.env.local` has `ZEP_API_KEY` set
2. Verify API key is valid at [cloud.getzep.com](https://cloud.getzep.com)
3. Check logs for initialization errors
4. Ensure `@getzep/zep-cloud` is installed: `npm list @getzep/zep-cloud`

### User Creation Errors

If you see "User already exists" warnings, this is normal. Zep clients check for existing users before creating.

### Session Errors

Sessions are auto-created on first use. If you see 404 errors, the system will create the session automatically.

### Fallback to Qdrant

If Zep is unavailable, the system falls back to Qdrant/Grok/SQLite. Check logs to see which backend is active.

## Advanced Features

### Custom Instructions

Create per-user or project-wide instructions:

```typescript
// Via Zep Cloud dashboard
// Add instruction: "Always format financial summaries with $ amounts"
// This applies to all finance-agent memory operations
```

### Knowledge Graph Queries

Zep builds knowledge graphs automatically. Access via Zep Cloud dashboard to:
- View entity relationships
- Discover connections between agents
- Query graph structure

### Memory Analytics

Zep Cloud dashboard provides:
- Memory usage per agent
- Query performance metrics
- Popular search terms
- Session activity

## Security

- API key is server-side only (never exposed to client)
- Each agent's memories are isolated by user_id
- Sessions can have additional metadata-based access control
- All data is encrypted in transit (TLS)
- Data residency options available in Zep Cloud

## Cost

Zep Cloud pricing is based on:
- Number of messages stored
- Number of searches performed
- Memory retention period

See [Zep pricing](https://www.getzep.com/pricing) for details.

## References

- [Zep Documentation](https://help.getzep.com/)
- [Zep TypeScript SDK](https://github.com/getzep/zep-js)
- [Zep Cloud Dashboard](https://cloud.getzep.com)
- [Wrath Shield MemoryWrapper](/lib/MemoryWrapper.ts)
- [Zep Client Implementation](/lib/memory/zep.ts)
