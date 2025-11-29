# Wrath Shield - AI Assistant Instructions

## CRITICAL: Codebase Verification

**BEFORE MAKING ANY CHANGES**, verify you are in the correct codebase:

```bash
# Check for .claude-version file
cat .claude-version | jq .status
# Should show: "ACTIVE - PRIMARY CODEBASE"

# Verify key directories exist
ls components/agents components/comms components/finance components/hyro lib/pm lib/hyro lib/memory/zep.ts
# All should exist
```

**If you see "ARCHIVED" or "DEPRECATED" or directories are missing, STOP and investigate.**

## Project Overview

Wrath Shield is a personal AI assistant platform with:
- Multi-agent orchestration system
- Agent graph visualization (interactive SVG network)
- Inbox routing and PM agent
- Finance tracking with Plaid integration and cycle reports
- Communication integrations (iMessage, SMS, Email)
- Hyro voice interface with recommendations
- Zep-based memory system (cloud-hosted temporal knowledge graph)
- Legal advisor module
- WHOOP and Limitless data integration

## Key Directories

```
/app                    # Next.js 14 app router pages
  /agents              # Agent roster and graph visualization
    /graph             # Network graph view
    /roster            # List view with PMStatusCard
  /api                 # API routes
    /agents/graph      # Graph data endpoint
    /comms             # Communication processing
    /finance           # Finance + Plaid endpoints
    /hyro              # Hyro voice interface
    /pm                # Project management
  /chat                # Chat interface
  /comms               # Communications hub
  /finance             # Financial tracking
  /hyro                # Voice interface
  /inbox               # Inbox management
  /pm                  # Project management

/components            # React components
  /agents              # Graph components (AgentNode, AgentEdge, GraphFilters, etc.)
  /comms               # Communication components
  /finance             # Finance + PlaidLink components
  /hyro                # Hyro interface
  /pm                  # PM components (PMStatusCard, etc.)
  /power               # Power/analytics components
  /ui                  # Shared UI components

/lib                   # Core business logic
  /agents              # Agent registry
  /comms               # Communications pipeline
  /db                  # Database layer
  /finance             # Finance module
  /hyro                # Hyro crawler, recommender, store
  /integrations        # GitHubClient, MotionClient
  /legal               # Legal advisor module
  /memory              # Zep integration (zep.ts)
  /pm                  # PM integration and types
  MemoryWrapper.ts     # Zep memory integration with fallbacks
  OpenRouterClient.ts  # LLM routing
  executors.ts         # Action executors
```

## Memory System

The memory system uses **Zep Cloud** as primary with SQLite fallback:

```typescript
import { addMemory, searchMemories, getAllMemories } from '@/lib/MemoryWrapper';

// Add memory
await addMemory('text', 'user-id', { type: 'anchor', category: 'health' });

// Search
const results = await searchMemories('query', 'user-id', 5);

// Get all
const all = await getAllMemories('user-id');
```

**Direct Zep access** (for advanced use):
```typescript
import { addZepMemory, searchZepMemory, getZepContext } from '@/lib/memory/zep';

await addZepMemory('finance-agent', 'Transaction data', { amount: 49.99 });
const context = await getZepContext('legal-agent');
```

**Environment variables:**
- `ZEP_API_KEY` or `ZEP_LEGAL_API_KEY` - Zep API key (required for Zep)
- Falls back to local SQLite if not set

## Running the Project

```bash
# Development server (port 4242)
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit
```

## Agent Registry

Agents are defined in `lib/agents/registry.ts`. Current agents:
1. **Inbox** - Email/iMessage ingest, classification
2. **Legal** - MyCase data, Gmail scrape, strategic briefs
3. **Finance** - Plaid transactions, context enrichment
4. **PM** - Motion↔GitHub sync, project tracking
5. **Grok/Research Hub** - LLM routing, action proposals
6. **Comms Scout** - Contact monitoring, relationship tracking
7. **EA** - Calendar, travel, gatekeeping (partial)
8. **EEG** - WHOOP/Limitless data (partial)
9. **Hyro** - Education and research recommendations

## Regression Prevention

### Before Any Session

1. **Verify codebase**: Check `.claude-version` file
2. **Check directories**: Ensure all key directories exist
3. **Run tests**: `npm test` to establish baseline

### After Making Changes

1. **Run affected tests**: `npm test -- --testPathPattern="<changed-area>"`
2. **Type check**: `npx tsc --noEmit`
3. **Commit with descriptive message**

### Red Flags (Possible Regression)

If you see these, investigate before proceeding:
- Missing `components/agents/` directory
- Missing `components/comms/` directory
- Missing `lib/hyro/` directory
- Missing `lib/pm/` directory
- Missing `lib/memory/zep.ts` file
- `.claude-version` shows "DEPRECATED" or "ARCHIVED"

## Integration Points

| Service | Config Location | Required |
|---------|----------------|----------|
| Zep Memory | `ZEP_API_KEY` env | Optional (fallback to SQLite) |
| WHOOP | `lib/config.ts` | Yes |
| Limitless | `lib/config.ts` | Optional |
| OpenRouter | `OPENROUTER_API_KEY` env | Yes |
| Motion | `MOTION_API_KEY` env | Optional |
| Todoist | `TODOIST_API_KEY` env | Optional |
| Twilio | `TWILIO_*` env vars | Optional |
| Plaid | `PLAID_*` env vars | Optional |
| GitHub | `GITHUB_TOKEN` env | Optional |

## Documentation

See these files for detailed information:
- `AGENTS.md` - Agent system architecture
- `ZEP_INTEGRATION_SUMMARY.md` - Memory system details
- `HYRO_AGENT_SUMMARY.md` - Voice interface
- `IMESSAGE_QUICK_START.md` - iMessage setup
- `PM2_SETUP.md` - Production deployment
- `REMEDIATION_PLAN.md` - Codebase sync documentation

## Version History

- **v3.0.0-unified** (2025-11-28): Merged wrath-shield-clean into v3
  - Added agent graph visualization
  - Added comms pipeline
  - Added hyro voice interface
  - Added PM system with Motion/GitHub
  - Added Zep memory integration
  - Added Plaid finance integration
