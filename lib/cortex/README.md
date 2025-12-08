# Cortex Memory System

The Cortex memory system provides a working memory buffer for storing and processing events before they are synthesized into long-term memory.

## Architecture

```
┌─────────────────┐
│  Event Sources  │
│ (Email, iMsg,   │
│  WHOOP, etc.)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  Working Memory     │◄── Ring buffer (500 events max)
│  - Deduplication    │
│  - SQLite backed    │
│  - Auto-pruning     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Synthesis Tasks    │
│  - Batch processing │
│  - Entity extract   │
│  - Narrative gen    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Long-term Memory   │
│  (Zep + SQLite)     │
└─────────────────────┘
```

## Usage

### Adding Events

```typescript
import { getWorkingMemory } from '@/lib/cortex/working-memory';

const wm = getWorkingMemory();

// Add an event
const eventId = await wm.addEvent({
  source: 'email',
  timestamp: Math.floor(Date.now() / 1000),
  content: 'Meeting tomorrow at 3pm with John about the Q4 review',
  embeddingJson: null,
  initialClassification: 'calendar',
});

if (!eventId) {
  console.log('Event was a duplicate, skipped');
}
```

### Retrieving Unprocessed Events

```typescript
// Get up to 50 unprocessed events
const events = await wm.getUnprocessed(50);

console.log(`Found ${events.length} unprocessed events`);
for (const event of events) {
  console.log(`[${event.source}] ${event.content}`);
}
```

### Getting Recent Events

```typescript
// Get all events from the last 24 hours
const recentEvents = await wm.getRecent(24);

console.log(`${recentEvents.length} events in last 24 hours`);
```

### Marking Events as Processed

```typescript
import { randomUUID } from 'crypto';

const synthesisTaskId = randomUUID();
const eventIds = events.map(e => e.id);

await wm.markProcessed(eventIds, synthesisTaskId);
console.log(`Marked ${eventIds.length} events as processed`);
```

### Retrieving Specific Events

```typescript
const eventIds = ['event-id-1', 'event-id-2', 'event-id-3'];
const specificEvents = await wm.getByIds(eventIds);

console.log(`Retrieved ${specificEvents.length} specific events`);
```

### Pruning Old Events

```typescript
// Remove events older than 7 days (168 hours)
const pruned = await wm.prune(168);
console.log(`Pruned ${pruned} old events`);
```

### Getting Statistics

```typescript
const stats = await wm.getStats();

console.log('Working Memory Statistics:');
console.log(`- Total events: ${stats.totalEvents}`);
console.log(`- Unprocessed: ${stats.unprocessedEvents}`);
console.log(`- Processed in last 24h: ${stats.processedLast24h}`);
console.log(`- Events by source:`, stats.eventsBySource);
```

## Configuration

You can customize the working memory behavior:

```typescript
const wm = getWorkingMemory({
  maxBufferSize: 1000,        // Store up to 1000 events
  dedupeWindowHours: 2,       // Check for duplicates within 2 hours
  pruneAfterHours: 336,       // Keep processed events for 2 weeks
});
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `maxBufferSize` | 500 | Maximum number of events in buffer |
| `dedupeWindowHours` | 1 | Time window for duplicate detection |
| `pruneAfterHours` | 168 | Age after which processed events are deleted |

## Features

### Content-Based Deduplication

Events are deduplicated using SHA-256 hashing of their content. If an identical event arrives within the deduplication window (default: 1 hour), it will be rejected.

```typescript
// First event - added successfully
await wm.addEvent({
  source: 'email',
  timestamp: now,
  content: 'Meeting at 3pm',
  embeddingJson: null,
  initialClassification: null,
});

// Duplicate event within 1 hour - rejected
const duplicateId = await wm.addEvent({
  source: 'email',
  timestamp: now + 1800, // 30 minutes later
  content: 'Meeting at 3pm',
  embeddingJson: null,
  initialClassification: null,
});

console.log(duplicateId); // null
```

### Automatic Pruning

When the buffer reaches capacity (default: 500 events), the system automatically prunes old processed events. If pruning doesn't free enough space, an error is thrown.

### SQLite Persistence

All events are persisted to SQLite, ensuring durability across application restarts. The database uses:
- WAL mode for better concurrency
- Indexes on timestamp, processing status, and content hash for fast queries
- Transaction support for batch operations

## Database Schema

```sql
CREATE TABLE working_memory_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_json TEXT,
  initial_classification TEXT,
  processed_by_synthesis INTEGER DEFAULT 0,
  synthesis_task_id TEXT,
  created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_wm_timestamp ON working_memory_events(timestamp DESC);
CREATE INDEX idx_wm_processed ON working_memory_events(processed_by_synthesis, timestamp);
CREATE INDEX idx_wm_content_hash ON working_memory_events(content_hash, timestamp);
CREATE INDEX idx_wm_source ON working_memory_events(source);
CREATE INDEX idx_wm_synthesis_task ON working_memory_events(synthesis_task_id);
```

## Event Sources

Supported event sources:

- `email` - Email messages
- `imessage` - iMessage conversations
- `sms` - SMS messages
- `whoop` - WHOOP fitness data
- `limitless` - Limitless lifelogs
- `calendar` - Calendar events
- `github` - GitHub activity
- `motion` - Motion tasks
- `plaid` - Financial transactions
- `manual` - Manually created events
- `system` - System-generated events

## Best Practices

1. **Use appropriate timestamps**: Always use Unix timestamps in seconds, not milliseconds
2. **Provide source context**: Include the correct source type for better organization
3. **Prune regularly**: Run pruning on a schedule to keep the buffer manageable
4. **Monitor stats**: Check statistics regularly to ensure the system is healthy
5. **Handle duplicates gracefully**: Check for null return values from `addEvent()`

## Error Handling

```typescript
try {
  const eventId = await wm.addEvent({
    source: 'email',
    timestamp: Math.floor(Date.now() / 1000),
    content: 'Important meeting reminder',
    embeddingJson: null,
    initialClassification: null,
  });

  if (!eventId) {
    console.warn('Event was a duplicate');
  } else {
    console.log(`Event ${eventId} added successfully`);
  }
} catch (error) {
  if (error.message.includes('buffer full')) {
    console.error('Working memory buffer is full, cannot add more events');
    // Consider running manual pruning or increasing buffer size
  } else {
    console.error('Failed to add event:', error);
  }
}
```

## Testing

```typescript
import { getWorkingMemory, resetWorkingMemory } from '@/lib/cortex/working-memory';

describe('WorkingMemory', () => {
  let wm: WorkingMemory;

  beforeEach(() => {
    // Get fresh instance for each test
    resetWorkingMemory();
    wm = getWorkingMemory();
  });

  afterEach(async () => {
    // Clean up
    await wm.clearAll();
  });

  it('should add events', async () => {
    const id = await wm.addEvent({
      source: 'manual',
      timestamp: Math.floor(Date.now() / 1000),
      content: 'Test event',
      embeddingJson: null,
      initialClassification: null,
    });

    expect(id).toBeTruthy();
  });

  it('should reject duplicates', async () => {
    const content = 'Duplicate test';
    const timestamp = Math.floor(Date.now() / 1000);

    const id1 = await wm.addEvent({
      source: 'manual',
      timestamp,
      content,
      embeddingJson: null,
      initialClassification: null,
    });

    const id2 = await wm.addEvent({
      source: 'manual',
      timestamp: timestamp + 10,
      content,
      embeddingJson: null,
      initialClassification: null,
    });

    expect(id1).toBeTruthy();
    expect(id2).toBeNull();
  });
});
```

## Future Enhancements

- [ ] Add event priority levels
- [ ] Support for event relationships/threading
- [ ] Configurable retention policies per source
- [ ] Event replay/audit log
- [ ] Metrics and monitoring dashboard
- [ ] Integration with Zep for embeddings
