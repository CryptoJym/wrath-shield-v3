# EA Agent Event Bus Subscriptions

## Overview

The EA (Executive Assistant) agent subscribes to 4 event patterns on the Life OS event bus to proactively manage scheduling and calendar operations.

## Subscriptions

### 1. Task Events (`type.task`)

**Pattern**: `type.task`
**Priority**: 40
**Handler**: `handleTaskEvent(event)`

**Purpose**: Detect tasks that require calendar blocking or meeting scheduling

**Triggers**:
- Task created with due date
- Task marked as requiring meeting
- Task assigned to user

**Actions**:
- Log tasks with due dates
- Identify meeting requirements
- (Future) Auto-create calendar reminders
- (Future) Propose meeting times

**Example Event**:
```typescript
{
  id: 'task-123',
  type: 'task',
  source: 'agent.pm',
  domain: 'work',
  priority: 'normal',
  payload: {
    title: 'Review Q4 financials',
    dueDate: '2025-12-15',
    requiresMeeting: true
  },
  timestamp: new Date()
}
```

---

### 2. Family Events (`domain.family.*`)

**Pattern**: `domain.family.*`
**Priority**: 50 (Higher - Family time is protected)
**Handler**: `handleFamilyEvent(event)`

**Purpose**: Protect family time from work scheduling conflicts

**Triggers**:
- Family domain events published
- Family activities scheduled
- Family commitments created

**Actions**:
- Monitor for scheduling conflicts
- (Future) Auto-block work meetings during family time
- (Future) Alert on family/work overlaps

**Example Event**:
```typescript
{
  id: 'family-456',
  type: 'notification',
  source: 'agent.family',
  domain: 'family',
  priority: 'high',
  payload: {
    activity: 'Family dinner',
    time: '2025-12-08T18:00:00',
    protected: true
  },
  timestamp: new Date()
}
```

---

### 3. Work Events (`domain.work.*`)

**Pattern**: `domain.work.*`
**Priority**: 50
**Handler**: `handleWorkEvent(event)`

**Purpose**: Coordinate work-related meeting scheduling

**Triggers**:
- Work domain events
- Business meeting requests
- Project milestones requiring coordination

**Actions**:
- Log work scheduling needs
- (Future) Coordinate meeting times
- (Future) Send calendar invitations

**Example Event**:
```typescript
{
  id: 'work-789',
  type: 'task',
  source: 'agent.pm',
  domain: 'work',
  priority: 'high',
  payload: {
    title: 'Client presentation',
    requiresMeeting: true,
    participants: ['jason@example.com', 'ryan@example.com'],
    preferredDuration: 60
  },
  timestamp: new Date()
}
```

---

### 4. Message Events (`type.message`)

**Pattern**: `type.message`
**Priority**: 30
**Handler**: `handleMessageEvent(event)`

**Purpose**: Detect scheduling requests in messages (email, SMS, etc.)

**Triggers**:
- Incoming email processed by Inbox Steward
- SMS/iMessage received
- Communication events routed through system

**Detection Keywords**:
- `meeting`
- `schedule`
- `calendar`
- `appointment`
- `call`

**Actions**:
- Log messages with scheduling keywords
- (Future) Parse scheduling intent (NLP)
- (Future) Propose meeting times
- (Future) Auto-draft calendar invites

**Example Event**:
```typescript
{
  id: 'msg-101',
  type: 'message',
  source: 'agent.comms',
  domain: 'work',
  priority: 'normal',
  payload: {
    from: 'jason@example.com',
    subject: 'Schedule a meeting next week?',
    text: 'Let\'s schedule a meeting to discuss the new project.',
    timestamp: '2025-12-08T10:30:00'
  },
  timestamp: new Date()
}
```

---

## Event Pattern Matching

The Life OS event bus supports wildcard matching:

| Pattern | Matches |
|---------|---------|
| `type.task` | All task events |
| `domain.family.*` | All family domain events |
| `domain.work.*` | All work domain events |
| `type.message` | All message events |
| `*` | All events (use sparingly) |

## Priority System

Higher priority = processed first when multiple handlers match:

1. **Priority 50**: Family & Work events (protect time)
2. **Priority 40**: Task events (schedule coordination)
3. **Priority 30**: Message events (opportunistic scheduling)

## Initialization

The EA agent must be initialized to activate subscriptions:

```typescript
import { initializeEAAgent } from '@/lib/agents/ea-agent';

// On server startup
initializeEAAgent();
```

This connects the EA agent to the event bus and registers all subscriptions.

## Testing Event Handlers

```typescript
import { getEventBus } from '@/lib/agents/life-os-event-bus';
import { initializeEAAgent } from '@/lib/agents/ea-agent';

// Initialize
initializeEAAgent();

// Get event bus
const bus = getEventBus();

// Test task event
await bus.publish({
  id: 'test-task-1',
  type: 'task',
  source: 'test',
  domain: 'work',
  priority: 'normal',
  payload: {
    title: 'Test task with meeting',
    requiresMeeting: true,
    dueDate: new Date('2025-12-15')
  },
  timestamp: new Date()
});

// Test family event
await bus.publish({
  id: 'test-family-1',
  type: 'notification',
  source: 'test',
  domain: 'family',
  priority: 'high',
  payload: {
    activity: 'Family movie night',
    time: new Date('2025-12-08T19:00:00')
  },
  timestamp: new Date()
});

// Test message event
await bus.publish({
  id: 'test-msg-1',
  type: 'message',
  source: 'test',
  domain: 'work',
  priority: 'normal',
  payload: {
    text: 'Can we schedule a meeting tomorrow?',
    from: 'colleague@example.com'
  },
  timestamp: new Date()
});

// Check console logs for EA agent responses
```

## Future Enhancements

### Planned Actions

1. **Auto-create calendar blocks**:
   - When task has due date, create focus time block
   - When family event scheduled, block work calendar

2. **Smart meeting proposals**:
   - Parse meeting requirements from tasks
   - Check participant availability
   - Propose 3 optimal time slots

3. **Conflict alerts**:
   - Detect family/work overlaps
   - Alert when protected time is at risk
   - Suggest reschedule options

4. **Email scheduling assistant**:
   - Parse meeting requests from email
   - Extract participants, duration, preferences
   - Auto-draft calendar invites

5. **Voice integration**:
   - Hyro voice commands: "Schedule meeting with Jason"
   - Parse natural language scheduling requests
   - Confirm via voice before creating events

## Integration with Other Agents

The EA agent works alongside:

- **Inbox Steward** (`agent.comms`): Receives message events
- **PM Agent** (`agent.pm`): Receives task events with deadlines
- **Family Steward** (`agent.family`): Receives family time blocks
- **Orchestrator** (`agent.orchestrator`): Coordinates cross-domain scheduling

## Event Bus Architecture

```
┌─────────────────┐
│  Event Source   │
│  (PM, Comms,    │
│   Family, etc)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Event Bus     │
│   (Pattern      │
│    Matching)    │
└────────┬────────┘
         │
         ├──────────► type.task ────────► EA Agent (Priority 40)
         │
         ├──────────► domain.family.* ──► EA Agent (Priority 50)
         │
         ├──────────► domain.work.* ────► EA Agent (Priority 50)
         │
         └──────────► type.message ─────► EA Agent (Priority 30)
```

---

**The EA agent is now listening and ready to proactively manage scheduling across all domains.**
