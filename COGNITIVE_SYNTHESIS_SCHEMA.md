# Cognitive Synthesis Engine - Database Schema

## Overview

The Cognitive Synthesis Engine provides a multi-source event processing system that consolidates information from various sources (email, calendar, messages, etc.) and synthesizes them into actionable unified tasks. The system learns patterns over time to improve synthesis quality.

## Database Tables

### 1. `unified_tasks`

Synthesized high-level tasks derived from multiple event sources.

**Schema:**
```sql
CREATE TABLE unified_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  confidence REAL DEFAULT 0.5,
  urgency TEXT CHECK(urgency IN ('critical', 'high', 'medium', 'low')),
  domain TEXT,
  source_events_json TEXT,
  proposed_action_json TEXT,
  status TEXT DEFAULT 'synthesizing',
  last_refined_at INTEGER,
  refinement_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);
```

**Indexes:**
- `idx_unified_tasks_status` - Status, urgency, and creation time
- `idx_unified_tasks_domain` - Domain and status
- `idx_unified_tasks_confidence` - Confidence and urgency

**Status Flow:**
1. `synthesizing` - Initial state when task is being created
2. `ready` - Task is ready for review
3. `approved` - User or system has approved the task
4. `executing` - Task is being executed
5. `completed` - Task is complete
6. `dismissed` - Task was rejected/dismissed

**Urgency Levels:**
- `critical` - Immediate action required
- `high` - Important, act soon
- `medium` - Normal priority
- `low` - Nice to have

**Domains:**
Common values: `finance`, `legal`, `pm`, `comms`, `health`

### 2. `synthesis_patterns`

Learned patterns for event consolidation and task synthesis.

**Schema:**
```sql
CREATE TABLE synthesis_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT CHECK(pattern_type IN ('consolidation', 'urgency', 'action', 'relationship')),
  description TEXT NOT NULL,
  trigger_conditions TEXT,
  suggested_behavior TEXT,
  success_rate REAL DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);
```

**Indexes:**
- `idx_synthesis_patterns_type` - Pattern type and success rate
- `idx_synthesis_patterns_usage` - Usage count

**Pattern Types:**
- `consolidation` - Patterns for combining related events
- `urgency` - Patterns for determining task urgency
- `action` - Patterns for suggesting actions
- `relationship` - Patterns for finding relationships between events

**Learning Mechanism:**
The `success_rate` is updated using a running average based on whether the pattern application was successful. The `usage_count` tracks how many times the pattern has been applied.

### 3. `working_memory_events`

Temporary event storage for multi-source ingestion before synthesis.

**Schema:**
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
  synthesis_task_id TEXT REFERENCES unified_tasks(id),
  created_at INTEGER
);
```

**Indexes:**
- `idx_working_memory_timestamp` - Event timestamp
- `idx_working_memory_source` - Source and timestamp
- `idx_working_memory_processed` - Processing status and timestamp
- `idx_working_memory_hash` - Content hash for deduplication
- `idx_working_memory_task` - Associated synthesis task

**Sources:**
Common values: `gmail`, `limitless`, `calendar`, `motion`, `imessage`, `slack`, `github`

**Classification:**
Common values: `task`, `meeting`, `info`, `alert`, `reminder`

**Deduplication:**
The `content_hash` field (SHA-256) is used to prevent duplicate event ingestion.

### 4. `events` table modification (if exists)

If an `events` table exists in the system, a `synthesis_task_id` column can be added to link existing events to synthesized tasks:

```sql
ALTER TABLE events ADD COLUMN synthesis_task_id TEXT REFERENCES unified_tasks(id);
```

**Note:** This is optional and depends on whether the events table exists in the system.

## TypeScript Types

### UnifiedTask
```typescript
export interface UnifiedTask {
  id: string;
  title: string;
  description: string | null;
  confidence: number; // 0.0 - 1.0
  urgency: 'critical' | 'high' | 'medium' | 'low';
  domain: string | null;
  source_events_json: string | null; // JSON array of event IDs
  proposed_action_json: string | null; // JSON object
  status: 'synthesizing' | 'ready' | 'approved' | 'executing' | 'completed' | 'dismissed';
  last_refined_at: number | null;
  refinement_count: number;
  created_at?: number;
  updated_at?: number;
}
```

### SynthesisPattern
```typescript
export interface SynthesisPattern {
  id: string;
  pattern_type: 'consolidation' | 'urgency' | 'action' | 'relationship';
  description: string;
  trigger_conditions: string | null;
  suggested_behavior: string | null;
  success_rate: number; // 0.0 - 1.0
  usage_count: number;
  created_at?: number;
  updated_at?: number;
}
```

### WorkingMemoryEvent
```typescript
export interface WorkingMemoryEvent {
  id: string;
  source: string;
  timestamp: number;
  content: string;
  content_hash: string;
  embedding_json: string | null; // JSON array
  initial_classification: string | null;
  processed_by_synthesis: number; // 0 or 1
  synthesis_task_id: string | null;
  created_at?: number;
}
```

## Query Functions

All query functions are located in `/lib/db/queries.ts`:

### Working Memory Events
- `insertWorkingMemoryEvent(event)` - Insert single event
- `insertWorkingMemoryEvents(events)` - Batch insert events
- `getUnprocessedEvents(limit)` - Get events not yet processed
- `getEventsBySource(source, limit)` - Get events from specific source
- `markEventProcessed(eventId, taskId?)` - Mark event as processed
- `findEventByHash(contentHash)` - Check for duplicate events

### Unified Tasks
- `insertUnifiedTask(task)` - Insert or update task
- `getUnifiedTasksByStatus(status, limit)` - Get tasks by status
- `getUnifiedTasksByDomain(domain, limit)` - Get tasks by domain
- `updateUnifiedTaskStatus(id, status)` - Update task status
- `refineUnifiedTask(id, newConfidence?)` - Increment refinement count
- `getUnifiedTaskById(id)` - Get specific task

### Synthesis Patterns
- `insertSynthesisPattern(pattern)` - Insert or update pattern
- `getSynthesisPatternsByType(patternType)` - Get patterns by type
- `updatePatternMetrics(id, success)` - Update pattern success rate
- `getAllSynthesisPatterns()` - Get all patterns

## Usage Example

```typescript
import { createHash } from 'crypto';
import {
  insertWorkingMemoryEvent,
  getUnprocessedEvents,
  insertUnifiedTask,
  markEventProcessed,
  insertSynthesisPattern,
  updatePatternMetrics
} from '@/lib/db/queries';

// 1. Ingest an event from Gmail
const eventId = `gmail-${Date.now()}`;
const content = "Meeting with legal team tomorrow at 2pm";
const contentHash = createHash('sha256').update(content).digest('hex');

insertWorkingMemoryEvent({
  id: eventId,
  source: 'gmail',
  timestamp: Math.floor(Date.now() / 1000),
  content,
  content_hash: contentHash,
  embedding_json: null,
  initial_classification: 'meeting',
  processed_by_synthesis: 0,
  synthesis_task_id: null
});

// 2. Process unprocessed events
const events = getUnprocessedEvents(50);

// 3. Synthesize into a unified task
const taskId = `task-${Date.now()}`;
insertUnifiedTask({
  id: taskId,
  title: 'Prepare for legal team meeting',
  description: 'Meeting scheduled for tomorrow at 2pm',
  confidence: 0.85,
  urgency: 'high',
  domain: 'legal',
  source_events_json: JSON.stringify([eventId]),
  proposed_action_json: JSON.stringify({
    type: 'calendar_event',
    target: 'google-calendar',
    payload: { time: '2pm tomorrow' }
  }),
  status: 'ready',
  last_refined_at: null,
  refinement_count: 0
});

// 4. Mark event as processed
markEventProcessed(eventId, taskId);

// 5. Track pattern usage
insertSynthesisPattern({
  id: 'pattern-meeting-urgency',
  pattern_type: 'urgency',
  description: 'Meetings scheduled for tomorrow are high urgency',
  trigger_conditions: 'Event contains meeting + tomorrow',
  suggested_behavior: 'Set urgency to high',
  success_rate: 0.5,
  usage_count: 0
});

// After applying the pattern, update its metrics
updatePatternMetrics('pattern-meeting-urgency', true); // success = true
```

## Migration

The migration file is located at:
`/migrations/045_cognitive_synthesis_engine.sql`

To apply the migration, simply restart the application. The Database class automatically runs all pending migrations on startup.

## Implementation Notes

1. **Deduplication**: Always check `findEventByHash()` before inserting new events to prevent duplicates.

2. **Confidence Scoring**: Confidence scores should be between 0.0 and 1.0. Higher confidence means the system is more certain about the task.

3. **Refinement**: Tasks can be refined multiple times as more information becomes available. Use `refineUnifiedTask()` to track refinements.

4. **Pattern Learning**: Patterns improve over time through the `updatePatternMetrics()` function. Successful applications increase success_rate, failures decrease it.

5. **Status Transitions**: Tasks should follow the status flow: synthesizing → ready → approved → executing → completed. Tasks can be dismissed at any stage.

6. **Domain Assignment**: Use consistent domain values across the application for better task organization and filtering.

## Future Enhancements

1. **Vector Embeddings**: The `embedding_json` field in `working_memory_events` can be used for semantic search and similarity matching.

2. **Cross-Domain Synthesis**: Patterns can identify relationships between events from different domains (e.g., legal + finance).

3. **Temporal Patterns**: Track time-based patterns (e.g., certain types of events always happen on Mondays).

4. **Confidence Adjustment**: Automatically adjust confidence based on pattern success rates.

5. **Event Clustering**: Group related events before synthesis to create more accurate tasks.
