# Cognitive Synthesis Engine - Setup Complete

## Files Created/Modified

### 1. Migration File
**Location:** `/migrations/045_cognitive_synthesis_engine.sql`

Creates three new tables:
- `unified_tasks` - Synthesized tasks from multiple sources
- `synthesis_patterns` - Learned patterns for event consolidation
- `working_memory_events` - Temporary event storage before synthesis

### 2. TypeScript Types
**Location:** `/lib/db/types.ts`

Added type definitions:
- `UnifiedTask` / `UnifiedTaskInput`
- `SynthesisPattern` / `SynthesisPatternInput`
- `WorkingMemoryEvent` / `WorkingMemoryEventInput`

### 3. Query Functions
**Location:** `/lib/db/queries.ts`

Added 17 new query functions for managing synthesis data:

**Working Memory Events:**
- `insertWorkingMemoryEvent()`
- `insertWorkingMemoryEvents()`
- `getUnprocessedEvents()`
- `getEventsBySource()`
- `markEventProcessed()`
- `findEventByHash()`

**Unified Tasks:**
- `insertUnifiedTask()`
- `getUnifiedTasksByStatus()`
- `getUnifiedTasksByDomain()`
- `updateUnifiedTaskStatus()`
- `refineUnifiedTask()`
- `getUnifiedTaskById()`

**Synthesis Patterns:**
- `insertSynthesisPattern()`
- `getSynthesisPatternsByType()`
- `updatePatternMetrics()`
- `getAllSynthesisPatterns()`

### 4. Documentation
**Location:** `/COGNITIVE_SYNTHESIS_SCHEMA.md`

Complete schema documentation including:
- Table schemas and indexes
- TypeScript type definitions
- Query function reference
- Usage examples
- Implementation notes

### 5. Examples File
**Location:** `/lib/db/synthesis-examples.ts`

10 practical examples demonstrating:
- Event ingestion
- Duplicate detection
- Task synthesis
- Task refinement
- Pattern learning
- Status workflows
- Batch processing
- Debugging
- Pattern analysis

## How to Use

### 1. Apply Migration

The migration will be automatically applied when you restart the application:

```bash
npm run dev
```

The Database class runs all pending migrations on startup.

### 2. Import Query Functions

```typescript
import {
  insertWorkingMemoryEvent,
  getUnprocessedEvents,
  insertUnifiedTask,
  // ... other functions
} from '@/lib/db/queries';
```

### 3. Basic Workflow

```typescript
// 1. Ingest event
insertWorkingMemoryEvent({
  id: 'event-123',
  source: 'gmail',
  timestamp: Math.floor(Date.now() / 1000),
  content: 'Meeting with legal team tomorrow',
  content_hash: hash,
  initial_classification: 'meeting',
  processed_by_synthesis: 0,
  synthesis_task_id: null,
});

// 2. Process events
const events = getUnprocessedEvents(100);

// 3. Synthesize into task
insertUnifiedTask({
  id: 'task-456',
  title: 'Prepare for legal meeting',
  confidence: 0.85,
  urgency: 'high',
  domain: 'legal',
  status: 'ready',
  refinement_count: 0,
  // ... other fields
});

// 4. Mark events as processed
markEventProcessed('event-123', 'task-456');
```

## Key Features

1. **Multi-Source Event Ingestion**
   - Supports events from gmail, calendar, limitless, motion, imessage, etc.
   - Automatic deduplication via content hashing
   - Flexible classification system

2. **Unified Task Synthesis**
   - Combines related events from multiple sources
   - Confidence scoring (0.0 - 1.0)
   - Urgency levels (critical, high, medium, low)
   - Domain-based organization
   - Proposed actions in JSON format

3. **Pattern Learning**
   - Four pattern types: consolidation, urgency, action, relationship
   - Success rate tracking with running averages
   - Usage count for pattern popularity
   - Continuous improvement through feedback

4. **Status Workflow**
   - synthesizing → ready → approved → executing → completed
   - Can be dismissed at any stage
   - Refinement tracking for iterative improvement

## Integration Points

The Cognitive Synthesis Engine can integrate with:

1. **Email (Gmail)** - Ingest messages as events
2. **Calendar** - Ingest calendar events
3. **Limitless** - Ingest conversation logs
4. **Motion** - Create tasks from synthesized items
5. **iMessage** - Ingest messages as events
6. **GitHub** - Ingest issues/PRs as events

## Next Steps

1. **Implement Event Collectors**: Create services to ingest events from each source
2. **Build Synthesis Logic**: Implement AI-powered event consolidation
3. **Create Pattern Library**: Define initial synthesis patterns
4. **Add UI Components**: Build interfaces to view/manage synthesized tasks
5. **Integrate with Agents**: Connect to existing agent system

## Testing

To verify the migration worked:

```typescript
import { getDatabase } from '@/lib/db/Database';

const db = getDatabase().getRawDb();

// Check tables exist
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name IN ('unified_tasks', 'synthesis_patterns', 'working_memory_events')
`).all();

console.log('Created tables:', tables);
```

## Performance Considerations

1. **Indexes**: All high-traffic query patterns have indexes
2. **Batch Operations**: Use batch insert functions for multiple events
3. **Deduplication**: Always check `findEventByHash()` before inserting
4. **Cleanup**: Implement periodic cleanup of old processed events

## Security Notes

1. **Content Hash**: SHA-256 hashing prevents duplicate event ingestion
2. **JSON Validation**: Always validate JSON before parsing from database
3. **SQL Injection**: All queries use prepared statements
4. **User Scoping**: Consider adding user_id columns for multi-user support

## Support

For questions or issues:
1. Review `/COGNITIVE_SYNTHESIS_SCHEMA.md` for detailed documentation
2. Check `/lib/db/synthesis-examples.ts` for usage examples
3. Review existing query functions in `/lib/db/queries.ts`

---

**Status:** Ready to use
**Migration:** 045_cognitive_synthesis_engine.sql
**Version:** 1.0.0
