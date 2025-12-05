# PM Agent Connectors

This directory contains connectors that bridge external agents to the PM Agent's task queue.

## Overview

Connectors monitor activity from various agents (Comms, Inbox, Legal, Finance, etc.) and automatically create signals for the PM task queue when action is needed. The PM queue then triages these signals and routes them to appropriate destinations (GitHub issues, local tasks, etc.).

## Available Connectors

### Comms Follow-up Connector (`comms-followup-connector.ts`)

**Purpose**: Automatically detects when contact follow-ups are needed and creates reminder tasks.

**Trigger Scenarios**:
1. No response after outbound message (3 days normal, 1 day VIP)
2. Promised callback detection ("I'll get back to you")
3. Scheduled check-ins from relationship summaries
4. VIP contact staleness (7 days no interaction)
5. Unanswered questions (2 days)

**Usage**:
```typescript
import { scanContactsForFollowups } from '@/lib/pm/connectors/comms-followup-connector';

// Scan all contacts and create follow-up signals
const signals = await scanContactsForFollowups();
console.log(`Created ${signals.length} follow-up signals`);
```

**Documentation**: See `.claude_results/phase2b_complete.md` for full API and examples.

## Architecture

```
┌─────────────┐
│ Agent       │ (Comms, Inbox, Legal, etc.)
│ Activity    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Connector   │ (Monitors, detects patterns)
│ Logic       │
└──────┬──────┘
       │
       ▼ enqueueSignal()
┌─────────────┐
│ PM Task     │ (Triage, route, escalate)
│ Queue       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Destination │ (GitHub, local tasks, defer)
└─────────────┘
```

## Creating a New Connector

1. **Create connector file**: `lib/pm/connectors/your-connector.ts`

2. **Import dependencies**:
```typescript
import { ensureServerOnly } from '@/lib/server-only-guard';
import { enqueueSignal, type IncomingSignal } from '@/lib/pm/task-queue';
```

3. **Add server-only guard**:
```typescript
ensureServerOnly('lib/pm/connectors/your-connector');
```

4. **Implement detection logic**:
```typescript
export async function detectAndCreateSignals(): Promise<void> {
  // 1. Fetch data from source
  // 2. Detect patterns/conditions
  // 3. Create signals
  const signal: IncomingSignal = {
    id: 'unique-id',
    source: 'your-source',
    signal_type: 'task' | 'deadline' | 'follow_up',
    payload: { /* your data */ },
    timestamp: Date.now(),
    confidence: 0.85
  };

  // 4. Enqueue
  await enqueueSignal(signal);
}
```

5. **Add to background jobs** (optional):
```typescript
// In lib/pm/background-jobs.ts
registerJob({
  id: 'your-connector-scan',
  name: 'Your Connector Scan',
  schedule: 'daily',
  cooldown_ms: 12 * 60 * 60 * 1000,
  execute: async () => {
    await detectAndCreateSignals();
    return { success: true };
  }
});
```

## Signal Format

All connectors must create signals matching this interface:

```typescript
interface IncomingSignal {
  id: string;                      // Unique signal ID
  source: SignalSource;            // 'comms' | 'inbox' | 'legal' | 'finance' | 'eeg' | 'github' | 'calendar'
  signal_type: SignalType;         // 'task' | 'deadline' | 'follow_up' | 'energy_window' | 'commit' | 'mention'
  payload: Record<string, unknown>; // Signal-specific data
  timestamp: number;               // Unix timestamp (ms)
  confidence: number;              // 0-1, how sure the signal is actionable
}
```

## Triage Rules

The PM queue automatically triages signals based on:
- **Source**: Which agent sent it
- **Signal type**: task, deadline, follow_up, etc.
- **Confidence**: How sure we are about the signal
- **Payload content**: Specific attributes like importance, urgency

See `lib/pm/task-queue.ts` for full triage rule set.

## Best Practices

1. **Prevent duplicates**: Check if signal already exists before creating
2. **Use cooldowns**: Don't spam the queue with repeated signals
3. **Confidence scoring**: Higher confidence = more likely to auto-execute
4. **Graceful degradation**: Handle missing data, don't crash
5. **Clear tracking**: Mark signals as complete when resolved
6. **Type safety**: Use TypeScript interfaces for all data structures

## Testing

```typescript
// Manual test
import { yourDetectionFunction } from '@/lib/pm/connectors/your-connector';

const result = await yourDetectionFunction();
console.log('Created signals:', result);
```

## Future Connectors

Planned connectors:
- **Inbox Connector**: Extract action items from emails, meeting notes
- **Legal Connector**: Sync case deadlines from MyCase
- **Finance Connector**: Detect missing receipts, expense categorization needs
- **EEG Connector**: Optimal work window notifications
- **Commit Bridge**: Already implemented via GitHub webhook receiver

## Resources

- Task Queue: `lib/pm/task-queue.ts`
- Background Jobs: `lib/pm/background-jobs.ts`
- PM Types: `lib/pm/types.ts`
- Integration: `lib/pm/integration.ts`
