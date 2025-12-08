# Cortex API Routes - Implementation Summary

This document describes the API routes created for the Cognitive Synthesis Engine in `/app/api/cortex/`.

## Overview

The Cortex API provides HTTP endpoints to interact with the Cognitive Synthesis Engine, which processes events from multiple sources (Limitless, email, iMessage, calendar, GitHub) and synthesizes them into unified, actionable tasks.

## API Endpoints

### 1. Main Cortex Status and Control
**File**: `app/api/cortex/route.ts`

#### GET `/api/cortex`
Returns the current status of the synthesis engine.

**Response**:
```json
{
  "ok": true,
  "status": "active" | "idle" | "disabled",
  "lastSynthesisAt": 1234567890,
  "nextSynthesisAt": 1234567890,
  "eventCount": 15,
  "totalEventCount": 150,
  "taskCount": 5,
  "eventsBySource": {
    "limitless": 10,
    "email": 5
  },
  "processedLast24h": 30,
  "config": {
    "isRunning": true
  }
}
```

**Status Values**:
- `active`: Loop running with unprocessed events
- `idle`: Loop running but no events to process
- `disabled`: Loop stopped

#### POST `/api/cortex`
Control the synthesis loop (start/stop/configure).

**Request Body**:
```json
{
  "action": "start" | "stop" | "configure",
  "config": { /* SynthesisLoopConfig partial */ }
}
```

**Response**:
```json
{
  "ok": true,
  "status": "active",
  "message": "Synthesis loop started",
  "nextSynthesisAt": 1234567890
}
```

---

### 2. Manual Synthesis Trigger
**File**: `app/api/cortex/synthesis/route.ts`

#### POST `/api/cortex/synthesis`
Manually trigger an immediate synthesis pass.

**Response**:
```json
{
  "ok": true,
  "result": {
    "summary": "Synthesized 3 tasks from 15 events...",
    "tasksCreated": 3,
    "tasksUpdated": 2,
    "actionsProposed": 1,
    "eventsProcessed": 15,
    "needsMoreContext": 2,
    "patternsLearned": 1
  },
  "timestamp": "2025-12-07T10:00:00.000Z"
}
```

#### GET `/api/cortex/synthesis`
Get synthesis history (last N passes).

**Query Parameters**:
- `limit`: Number of history entries (default: 10)

**Response**:
```json
{
  "ok": true,
  "history": [
    {
      "timestamp": "2025-12-07T10:00:00.000Z",
      "tasksCreated": 3,
      "tasksUpdated": 2,
      "actionsProposed": 1,
      "eventsProcessed": 15,
      "summary": "Synthesized..."
    }
  ],
  "total": 50
}
```

---

### 3. Unified Tasks CRUD
**File**: `app/api/cortex/tasks/route.ts`

#### GET `/api/cortex/tasks`
List tasks with filtering and pagination.

**Query Parameters**:
- `status`: Filter by status (comma-separated for multiple)
- `domain`: Filter by domain (comma-separated)
- `urgency`: Filter by urgency (comma-separated)
- `minConfidence`: Minimum confidence threshold (0-1)
- `sortBy`: Sort field (`createdAt`, `urgency`, `confidence`, `deadline`)
- `sortDirection`: `asc` or `desc`
- `limit`: Max results (default: 50)
- `offset`: Pagination offset (default: 0)

**Example**: `/api/cortex/tasks?status=ready,approved&domain=legal&minConfidence=0.7&limit=20`

**Response**:
```json
{
  "ok": true,
  "tasks": [
    {
      "id": "task_123",
      "title": "Review contract for Client A",
      "description": "Client mentioned contract review in email...",
      "confidence": 0.85,
      "urgency": "high",
      "domain": "legal",
      "status": "ready",
      "sourceEvents": ["event_1", "event_2"],
      "proposedAction": { /* ProactiveAction */ },
      "createdAt": "2025-12-07T10:00:00.000Z",
      "refinementCount": 0
    }
  ],
  "total": 15,
  "query": { /* applied filters */ }
}
```

#### POST `/api/cortex/tasks`
Create a manual task (bypassing synthesis).

**Request Body**:
```json
{
  "title": "Task title",
  "description": "Task description",
  "domain": "legal",
  "urgency": "high",
  "confidence": 0.9,
  "sourceEvents": ["event_123"],
  "proposedAction": { /* optional */ }
}
```

**Response**:
```json
{
  "ok": true,
  "task": { /* UnifiedTask */ },
  "message": "Task created successfully"
}
```

#### PATCH `/api/cortex/tasks`
Bulk update multiple tasks.

**Request Body**:
```json
{
  "taskIds": ["task_1", "task_2"],
  "updates": {
    "status": "approved",
    "urgency": "high"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "tasks": [/* updated tasks */],
  "updated": 2
}
```

---

### 4. Individual Task Operations
**File**: `app/api/cortex/tasks/[id]/route.ts`

#### GET `/api/cortex/tasks/[id]`
Get a single task with full lineage (source events).

**Response**:
```json
{
  "ok": true,
  "task": { /* UnifiedTask */ },
  "sourceEvents": [
    {
      "id": "event_1",
      "source": "limitless",
      "timestamp": "2025-12-07T09:00:00.000Z",
      "content": "Client mentioned contract review...",
      "processedBySynthesis": true
    }
  ],
  "lineage": {
    "eventCount": 3,
    "sources": ["limitless", "email"],
    "timeRange": {
      "earliest": "2025-12-07T09:00:00.000Z",
      "latest": "2025-12-07T10:00:00.000Z"
    }
  }
}
```

#### PATCH `/api/cortex/tasks/[id]`
Update task properties.

**Request Body**:
```json
{
  "status": "approved",
  "urgency": "critical",
  "confidence": 0.95
}
```

**Response**:
```json
{
  "ok": true,
  "task": { /* updated task */ },
  "message": "Task updated successfully"
}
```

#### DELETE `/api/cortex/tasks/[id]`
Archive a task (sets status to `dismissed`).

**Response**:
```json
{
  "ok": true,
  "message": "Task archived successfully"
}
```

#### POST `/api/cortex/tasks/[id]`
Handle proposed actions.

**Request Body**:
```json
{
  "action": "approve" | "reject" | "execute"
}
```

**Actions**:
- `approve`: Mark action as approved, set status to `approved`
- `reject`: Remove proposed action, set status to `ready`
- `execute`: Execute the action (not yet implemented, returns placeholder)

**Response**:
```json
{
  "ok": true,
  "task": { /* updated task */ },
  "message": "Action approved - ready for execution"
}
```

---

### 5. Pattern Management
**File**: `app/api/cortex/patterns/route.ts`

#### GET `/api/cortex/patterns`
List learned synthesis patterns with filtering.

**Query Parameters**:
- `type`: Filter by pattern type (`consolidation`, `urgency`, `action`, `relationship`, `sequence`)
- `minSuccess`: Minimum success rate (0-1)
- `limit`: Max results (default: 50)

**Response**:
```json
{
  "ok": true,
  "patterns": [
    {
      "id": "pattern_123",
      "patternType": "consolidation",
      "description": "Email + Calendar = Meeting Task",
      "triggerConditions": {
        "sources": ["email", "calendar"],
        "keywords": ["meeting"],
        "temporalWindow": 3600000
      },
      "suggestedBehavior": {
        "consolidateEvents": true,
        "customGuidance": "Merge email and calendar into single task"
      },
      "successRate": 0.85,
      "usageCount": 42,
      "learnedAt": "2025-11-01T10:00:00.000Z"
    }
  ],
  "total": 10,
  "filtered": 5
}
```

#### POST `/api/cortex/patterns`
Create a manual pattern.

**Request Body**:
```json
{
  "patternType": "consolidation",
  "description": "Pattern description",
  "triggerConditions": {
    "sources": ["email", "calendar"],
    "keywords": ["meeting"]
  },
  "suggestedBehavior": {
    "consolidateEvents": true
  },
  "exampleEvents": ["event_1", "event_2"]
}
```

**Response**:
```json
{
  "ok": true,
  "pattern": { /* SynthesisPattern */ },
  "message": "Pattern created successfully"
}
```

#### PATCH `/api/cortex/patterns`
Update a pattern (e.g., adjust success rate).

**Request Body**:
```json
{
  "patternId": "pattern_123",
  "updates": {
    "successRate": 0.9,
    "description": "Updated description"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "pattern": { /* updated pattern */ },
  "message": "Pattern updated successfully"
}
```

---

### 6. Working Memory Access
**File**: `app/api/cortex/events/route.ts`

#### GET `/api/cortex/events`
List events in working memory buffer.

**Query Parameters**:
- `processed`: Filter by processed status (`true`/`false`)
- `source`: Filter by source (`limitless`, `email`, etc.)
- `hours`: Get events from last N hours
- `limit`: Max results (default: 50)
- `offset`: Pagination offset (default: 0)

**Example**: `/api/cortex/events?processed=false&source=limitless&limit=20`

**Response**:
```json
{
  "ok": true,
  "events": [
    {
      "id": "event_123",
      "source": "limitless",
      "timestamp": "2025-12-07T10:00:00.000Z",
      "content": "Client mentioned contract review during meeting...",
      "contentHash": "abc123...",
      "initialClassification": {
        "domain": "legal",
        "urgency": "high"
      },
      "processedBySynthesis": false,
      "metadata": { /* optional metadata */ }
    }
  ],
  "total": 15,
  "offset": 0,
  "limit": 50
}
```

#### POST `/api/cortex/events`
Manually add an event to working memory (for testing).

**Request Body**:
```json
{
  "source": "limitless",
  "content": "Event content text...",
  "initialClassification": {
    "domain": "legal",
    "urgency": "high"
  },
  "metadata": { /* optional */ }
}
```

**Response**:
```json
{
  "ok": true,
  "event": { /* WorkingMemoryEvent */ },
  "message": "Event added to working memory"
}
```

**Note**: Duplicate events (same content hash within deduplication window) will return:
```json
{
  "ok": false,
  "error": "Event was duplicate and not added"
}
```

---

## Common Patterns

### Authentication
All routes use `currentUserOrThrow()` for authentication. Unauthenticated requests return:
```json
{
  "ok": false,
  "error": "Failed to ...",
  "status": 401
}
```

### Error Handling
All routes follow the `{ ok: boolean, ...data }` pattern:
```json
{
  "ok": false,
  "error": "Error message",
  "status": 400 | 401 | 404 | 500
}
```

### Server-Side Enforcement
All routes include:
- `ensureServerOnly('app/api/cortex/...')` - Prevents client-side imports
- `export const dynamic = 'force-dynamic'` - Disables static generation
- `export const runtime = 'nodejs'` - Specifies Node.js runtime

---

## Type Definitions

All types are imported from:
- `@/lib/cortex/types` - Core types (`UnifiedTask`, `WorkingMemoryEvent`, `SynthesisPattern`, `SynthesisResult`)
- `@/lib/cortex/synthesis-loop` - Synthesis loop class and status
- `@/lib/cortex/task-store` - Task storage and consolidation
- `@/lib/cortex/working-memory` - Working memory buffer
- `@/lib/ea/preference-model` - Domain type

---

## Implementation Notes

### Pattern Storage
Currently, patterns are stored in-memory in `app/api/cortex/patterns/route.ts`. This is marked with `TODO: Move to database` and should be migrated to SQLite for persistence.

### Synthesis History
Synthesis history is also in-memory (max 50 entries). Consider moving to database for long-term analytics.

### Action Execution
The `execute` action in `POST /api/cortex/tasks/[id]` is a placeholder. Actual execution should integrate with the agent executor system.

### Concurrency
The synthesis loop runs in a single process. For multi-instance deployments, consider adding distributed locking to prevent concurrent synthesis passes.

---

## Testing

Example API calls:

```bash
# Get cortex status
curl http://localhost:4242/api/cortex

# Start synthesis loop
curl -X POST http://localhost:4242/api/cortex \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Trigger manual synthesis
curl -X POST http://localhost:4242/api/cortex/synthesis

# List tasks
curl "http://localhost:4242/api/cortex/tasks?status=ready&domain=legal"

# Get task with lineage
curl http://localhost:4242/api/cortex/tasks/task_123

# List unprocessed events
curl "http://localhost:4242/api/cortex/events?processed=false"

# Add test event
curl -X POST http://localhost:4242/api/cortex/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "limitless",
    "content": "Client mentioned contract review",
    "initialClassification": {
      "domain": "legal",
      "urgency": "high"
    }
  }'
```

---

## Next Steps

1. **Persistence**: Move pattern and synthesis history storage to SQLite
2. **Action Execution**: Implement actual action execution via agent executor
3. **WebSocket Updates**: Add real-time updates for synthesis status changes
4. **Metrics**: Add detailed metrics endpoint for synthesis performance
5. **Bulk Operations**: Add bulk event ingestion endpoint
6. **Pattern Mining**: Add endpoint to analyze existing tasks and suggest patterns
7. **Task Consolidation**: Add endpoint to trigger task consolidation on demand

---

## Related Files

- Core implementation: `/lib/cortex/`
  - `types.ts` - Type definitions
  - `synthesis-loop.ts` - Main synthesis engine
  - `task-store.ts` - Task storage and consolidation
  - `working-memory.ts` - Event buffer
- API routes: `/app/api/cortex/`
  - `route.ts` - Status and control
  - `synthesis/route.ts` - Manual synthesis
  - `tasks/route.ts` - Task CRUD
  - `tasks/[id]/route.ts` - Individual task operations
  - `patterns/route.ts` - Pattern management
  - `events/route.ts` - Working memory access
