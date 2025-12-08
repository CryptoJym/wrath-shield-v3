# Working Memory - Quick Start Guide

## Installation

No installation needed - the Working Memory system is part of the Wrath Shield v3 codebase.

## Basic Usage

```typescript
import { getWorkingMemory } from '@/lib/cortex/working-memory';

// Get the singleton instance
const wm = getWorkingMemory();
```

## Common Operations

### 1. Add an Event

```typescript
const eventId = await wm.addEvent({
  source: 'email',
  timestamp: new Date().toISOString(),
  content: 'Meeting tomorrow at 3pm with John',
  contentHash: '', // Auto-generated
  processedBySynthesis: false,
});

if (eventId) {
  console.log(`Event added: ${eventId}`);
} else {
  console.log('Event was a duplicate');
}
```

### 2. Get Unprocessed Events

```typescript
const events = await wm.getUnprocessed(50);
console.log(`Found ${events.length} unprocessed events`);
```

### 3. Mark Events as Processed

```typescript
const synthesisTaskId = 'synth-' + Date.now();
const eventIds = events.map(e => e.id);

await wm.markProcessed(eventIds, synthesisTaskId);
console.log(`Marked ${eventIds.length} events as processed`);
```

### 4. Get Recent Events

```typescript
// Get events from last 24 hours
const recentEvents = await wm.getRecent(24);
```

### 5. Check Statistics

```typescript
const stats = await wm.getStats();
console.log(`Total: ${stats.totalEvents}`);
console.log(`Unprocessed: ${stats.unprocessedEvents}`);
console.log(`Sources:`, stats.eventsBySource);
```

### 6. Prune Old Events

```typescript
// Remove processed events older than 7 days
const pruned = await wm.prune(168);
console.log(`Pruned ${pruned} events`);
```

## Event Structure

```typescript
{
  source: 'email',           // Where the event came from
  timestamp: '2025-12-07...',// ISO 8601 timestamp
  content: '...',            // Event content (text/JSON)
  contentHash: '',           // Auto-generated SHA-256 hash

  // Optional fields
  embedding: [0.1, 0.2, ...],      // Vector embedding
  initialClassification: {          // Initial categorization
    domain: 'productivity',
    urgency: 'medium',
    keywords: ['meeting']
  },
  metadata: {                       // Custom metadata
    sender: 'john@example.com',
    subject: 'Q4 Planning'
  },

  processedBySynthesis: false,     // Processing status
  synthesisTaskId: undefined       // Set when processed
}
```

## Event Sources

Supported sources:
- `limitless` - Limitless lifelogs
- `email` - Email messages
- `imessage` - iMessage conversations
- `calendar` - Calendar events
- `github` - GitHub notifications
- `slack` - Slack messages
- `motion` - Motion tasks
- `whoop` - WHOOP health data

## Configuration

```typescript
const wm = getWorkingMemory({
  maxBufferSize: 1000,      // Max events in buffer
  dedupeWindowHours: 2,     // Duplicate detection window
  pruneAfterHours: 336,     // Keep for 2 weeks
});
```

## Error Handling

```typescript
try {
  const eventId = await wm.addEvent(event);

  if (!eventId) {
    console.log('Duplicate event rejected');
  } else {
    console.log(`Event added: ${eventId}`);
  }
} catch (error) {
  if (error.message.includes('buffer full')) {
    console.error('Buffer is full, cannot add more events');
    // Consider running manual pruning
    await wm.prune(168);
  } else {
    console.error('Error adding event:', error);
  }
}
```

## Testing

```typescript
import { resetWorkingMemory } from '@/lib/cortex/working-memory';

// Before tests
beforeEach(() => {
  resetWorkingMemory();
  wm = getWorkingMemory();
});

// After tests
afterEach(async () => {
  await wm.clearAll();
});
```

## Performance Tips

1. **Batch Processing**: Process events in batches (50-100 at a time)
2. **Regular Pruning**: Schedule pruning to run daily/weekly
3. **Monitor Buffer**: Check stats regularly to avoid buffer overflow
4. **Use Indexes**: The system automatically creates indexes for fast queries

## Common Patterns

### Event Ingestion Loop

```typescript
async function ingestEvents() {
  const newEvents = await fetchNewEventsFromSource();

  for (const event of newEvents) {
    await wm.addEvent({
      source: event.source,
      timestamp: new Date(event.timestamp).toISOString(),
      content: JSON.stringify(event.data),
      contentHash: '',
      processedBySynthesis: false,
      metadata: event.metadata,
    });
  }
}
```

### Synthesis Loop

```typescript
async function synthesisLoop() {
  // Get unprocessed events
  const events = await wm.getUnprocessed(50);

  if (events.length < 3) {
    return; // Wait for more events
  }

  // Run synthesis (LLM call)
  const result = await synthesizeEvents(events);

  // Mark as processed
  const synthesisTaskId = result.taskId;
  const eventIds = events.map(e => e.id);
  await wm.markProcessed(eventIds, synthesisTaskId);
}
```

### Cleanup Job

```typescript
async function cleanupJob() {
  // Prune old processed events
  const pruned = await wm.prune(168); // 1 week

  // Check buffer health
  const stats = await wm.getStats();

  if (stats.totalEvents > 800) {
    console.warn('Buffer getting full:', stats.totalEvents);
  }
}
```

## Troubleshooting

### Issue: Buffer Full Error

**Solution**: Run manual pruning or increase `maxBufferSize`

```typescript
await wm.prune(72); // Prune events older than 3 days
```

### Issue: Too Many Duplicates

**Solution**: Increase `dedupeWindowHours` or check content normalization

```typescript
const wm = getWorkingMemory({
  dedupeWindowHours: 4, // Longer window
});
```

### Issue: Events Not Being Processed

**Solution**: Check synthesis loop is running

```typescript
const stats = await wm.getStats();
console.log('Unprocessed:', stats.unprocessedEvents);
```

## Next Steps

1. Set up event ingestion from your sources
2. Implement synthesis loop with LLM
3. Configure monitoring and alerting
4. Set up scheduled pruning job

## Documentation

- Full Documentation: `/lib/cortex/README.md`
- Implementation Details: `/lib/cortex/IMPLEMENTATION_SUMMARY.md`
- Example Code: `/lib/cortex/example.ts`
- Type Definitions: `/lib/cortex/types.ts`

## Support

For issues or questions:
1. Check the full README.md
2. Review example.ts for usage patterns
3. Examine IMPLEMENTATION_SUMMARY.md for architecture details
