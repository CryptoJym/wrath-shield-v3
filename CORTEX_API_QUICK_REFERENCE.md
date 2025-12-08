# Cortex API - Quick Reference

## Endpoints at a Glance

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **Status & Control** |
| GET | `/api/cortex` | Get cortex status |
| POST | `/api/cortex` | Start/stop/configure loop |
| **Synthesis** |
| POST | `/api/cortex/synthesis` | Trigger manual synthesis |
| GET | `/api/cortex/synthesis?limit=N` | Get synthesis history |
| **Tasks** |
| GET | `/api/cortex/tasks?filters` | List tasks |
| POST | `/api/cortex/tasks` | Create manual task |
| PATCH | `/api/cortex/tasks` | Bulk update tasks |
| GET | `/api/cortex/tasks/[id]` | Get task with lineage |
| PATCH | `/api/cortex/tasks/[id]` | Update task |
| DELETE | `/api/cortex/tasks/[id]` | Archive task |
| POST | `/api/cortex/tasks/[id]` | Handle action (approve/reject/execute) |
| **Patterns** |
| GET | `/api/cortex/patterns?filters` | List patterns |
| POST | `/api/cortex/patterns` | Create manual pattern |
| PATCH | `/api/cortex/patterns` | Update pattern |
| **Events** |
| GET | `/api/cortex/events?filters` | List working memory events |
| POST | `/api/cortex/events` | Add event (for testing) |

## Common Query Filters

### Tasks
```
?status=ready,approved
&domain=legal,productivity
&urgency=high,critical
&minConfidence=0.7
&sortBy=urgency
&sortDirection=desc
&limit=50
&offset=0
```

### Events
```
?processed=false
&source=limitless
&hours=24
&limit=50
&offset=0
```

### Patterns
```
?type=consolidation
&minSuccess=0.5
&limit=50
```

## Status Values

### Task Status
- `synthesizing` - Being synthesized/refined
- `ready` - Ready for review/approval
- `approved` - Approved and ready for execution
- `executing` - Currently being executed
- `completed` - Finished
- `dismissed` - Archived

### Urgency Levels
- `critical` - Immediate attention required
- `high` - Action within 24 hours
- `medium` - Action within week
- `low` - No rush
- `background` - FYI only

### Domains
- `productivity` - Tasks, projects, work
- `personal` - Personal life, relationships
- `health` - Fitness, medical, wellness
- `finance` - Money, expenses, investments
- `legal` - Legal matters, contracts
- `communication` - Messages, emails, calls

### Event Sources
- `limitless` - Limitless lifelogs
- `email` - Email messages
- `imessage` - iMessage conversations
- `calendar` - Calendar events
- `github` - GitHub notifications
- `slack` - Slack messages
- `motion` - Motion tasks
- `whoop` - WHOOP health data

### Pattern Types
- `consolidation` - Multiple events → single task
- `urgency` - Urgency classification rules
- `action` - Event → proactive action mapping
- `relationship` - Event correlation patterns
- `sequence` - Temporal event sequences

### Cortex Status
- `active` - Loop running with events to process
- `idle` - Loop running, no events
- `disabled` - Loop stopped

## Quick Examples

### Start Synthesis Loop
```bash
curl -X POST http://localhost:4242/api/cortex \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

### Get High-Urgency Legal Tasks
```bash
curl "http://localhost:4242/api/cortex/tasks?domain=legal&urgency=high,critical&status=ready"
```

### Add Test Event
```bash
curl -X POST http://localhost:4242/api/cortex/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "limitless",
    "content": "Client mentioned urgent contract review",
    "initialClassification": {"domain": "legal", "urgency": "high"}
  }'
```

### Approve Task Action
```bash
curl -X POST http://localhost:4242/api/cortex/tasks/task_123 \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

### Trigger Synthesis
```bash
curl -X POST http://localhost:4242/api/cortex/synthesis
```

## Response Format

All responses follow this pattern:

**Success:**
```json
{
  "ok": true,
  "...": "data fields"
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Error message"
}
```

HTTP status codes:
- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `404` - Not found
- `500` - Server error

## File Locations

```
/app/api/cortex/
├── route.ts              # Status & control
├── synthesis/route.ts    # Manual synthesis
├── tasks/
│   ├── route.ts         # Task CRUD
│   └── [id]/route.ts    # Individual task ops
├── patterns/route.ts     # Pattern management
└── events/route.ts       # Working memory
```

## Integration Points

### From Frontend
```typescript
// Get cortex status
const status = await fetch('/api/cortex').then(r => r.json());

// List tasks
const tasks = await fetch('/api/cortex/tasks?status=ready').then(r => r.json());

// Approve task action
await fetch(`/api/cortex/tasks/${taskId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'approve' })
});
```

### From Background Jobs
```typescript
import { getSynthesisLoop } from '@/lib/cortex/synthesis-loop';
import { getWorkingMemory } from '@/lib/cortex/working-memory';

// Add event
const workingMemory = getWorkingMemory();
await workingMemory.addEvent({
  source: 'limitless',
  content: 'Event text...',
  timestamp: new Date().toISOString(),
  processedBySynthesis: false,
});

// Trigger synthesis
const synthesisLoop = getSynthesisLoop();
await synthesisLoop.runSynthesisPass();
```
