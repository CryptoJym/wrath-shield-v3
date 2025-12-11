# EA Agent API Documentation

Phase 4 of Life OS Architecture - Executive Assistant Agent API Routes

## Overview

The EA (Executive Assistant) Agent provides calendar management, meeting scheduling, and daily agenda generation capabilities through RESTful API routes.

## Architecture

### Files Created

1. **`/lib/agents/ea-agent.ts`** - Core EA Agent implementation
   - Calendar event management
   - Meeting scheduling logic
   - Conflict detection
   - Daily agenda generation
   - Event bus integration for proactive scheduling

2. **`/app/api/ea/status/route.ts`** - Status endpoint
   - Returns agent status, capabilities, and metrics
   - Provides daily agenda summary
   - Lists upcoming events

3. **`/app/api/ea/schedule/route.ts`** - Scheduling operations endpoint
   - Block time slots
   - Schedule meetings
   - Check for conflicts
   - Get agenda

4. **`/lib/agents/registry.ts`** - Updated EA status function
   - Now fetches live metrics from EA API
   - Reports actual capabilities instead of "[Planned]"

## API Endpoints

### GET /api/ea/status

Returns EA agent status and daily agenda.

**Response:**
```json
{
  "ok": true,
  "status": "active",
  "agent": "agent.ea",
  "name": "Executive Assistant",
  "capabilities": [
    "calendar_management",
    "meeting_scheduling",
    "daily_agenda",
    "conflict_detection",
    "time_blocking"
  ],
  "stats": {
    "upcomingEvents": 5,
    "todayEvents": 2,
    "weekEvents": 5
  },
  "dailyAgenda": {
    "date": "2025-12-08T00:00:00.000Z",
    "summary": "You have 2 event(s) today with 360 minutes of free time...",
    "eventCount": 2,
    "freeSlots": [...],
    "events": [...]
  },
  "upcomingEvents": [...]
}
```

### POST /api/ea/schedule

Perform scheduling operations.

**Actions:**

#### 1. Block Time

```bash
POST /api/ea/schedule
Content-Type: application/json

{
  "action": "block_time",
  "title": "Deep Work - Code Review",
  "start": "2025-12-08T14:00:00.000Z",
  "end": "2025-12-08T16:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "action": "block_time",
  "event": {
    "id": "block-1733674800000",
    "title": "Deep Work - Code Review",
    "start": "2025-12-08T14:00:00.000Z",
    "end": "2025-12-08T16:00:00.000Z"
  }
}
```

#### 2. Schedule Meeting

```bash
POST /api/ea/schedule
Content-Type: application/json

{
  "action": "schedule_meeting",
  "title": "Team Sync",
  "duration": 30,
  "attendees": ["alice@example.com", "bob@example.com"],
  "preferredTimes": ["2025-12-08T10:00:00.000Z"],
  "description": "Weekly team sync"
}
```

**Response:**
```json
{
  "success": true,
  "action": "schedule_meeting",
  "event": {
    "id": "meeting-1733674800000",
    "title": "Team Sync",
    "start": "2025-12-08T10:00:00.000Z",
    "end": "2025-12-08T10:30:00.000Z",
    "attendees": ["alice@example.com", "bob@example.com"]
  }
}
```

**Error (409 Conflict):**
```json
{
  "success": false,
  "error": "Time slot has conflicts"
}
```

#### 3. Check Conflicts

```bash
POST /api/ea/schedule
Content-Type: application/json

{
  "action": "check_conflicts",
  "start": "2025-12-08T10:00:00.000Z",
  "end": "2025-12-08T11:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "action": "check_conflicts",
  "hasConflicts": true,
  "conflicts": [
    {
      "id": "meeting-123",
      "title": "Existing Meeting",
      "start": "2025-12-08T10:30:00.000Z",
      "end": "2025-12-08T11:00:00.000Z"
    }
  ]
}
```

#### 4. Get Agenda

```bash
POST /api/ea/schedule
Content-Type: application/json

{
  "action": "get_agenda"
}
```

**Response:**
```json
{
  "success": true,
  "action": "get_agenda",
  "agenda": {
    "date": "2025-12-08T00:00:00.000Z",
    "summary": "You have 2 event(s) today...",
    "events": [...],
    "freeSlots": [...]
  }
}
```

### GET /api/ea/schedule

Get upcoming events.

**Query Parameters:**
- `days` (optional, default: 7) - Number of days to look ahead

**Example:**
```bash
GET /api/ea/schedule?days=14
```

**Response:**
```json
{
  "success": true,
  "days": 14,
  "count": 8,
  "events": [
    {
      "id": "meeting-123",
      "title": "Team Sync",
      "start": "2025-12-08T10:00:00.000Z",
      "end": "2025-12-08T10:30:00.000Z",
      "location": "Conference Room A",
      "attendees": ["alice@example.com"],
      "description": "Weekly team sync"
    }
  ]
}
```

## Event Bus Integration

The EA Agent subscribes to Life OS event bus topics:

- **`type.task`** (priority 40) - Detects tasks with due dates or meeting requirements
- **`domain.family.*`** (priority 50) - Protects family time from work conflicts
- **`domain.work.*`** (priority 50) - Coordinates work meetings
- **`type.message`** (priority 30) - Detects scheduling requests in messages

### Example Event Handling

When a task event is published with a due date:
```typescript
{
  type: 'type.task',
  payload: {
    title: 'Prepare Q4 Report',
    dueDate: '2025-12-15T17:00:00.000Z',
    requiresMeeting: true
  }
}
```

The EA Agent will:
1. Log the task and due date
2. Consider creating calendar reminders
3. Propose meeting times if `requiresMeeting` is true

## Calendar Store

Currently uses an in-memory mock store. To integrate with Google Calendar:

1. Install Google Calendar API:
   ```bash
   npm install googleapis
   ```

2. Set environment variables:
   ```
   GOOGLE_CALENDAR_CLIENT_ID=your_client_id
   GOOGLE_CALENDAR_CLIENT_SECRET=your_secret
   GOOGLE_CALENDAR_REFRESH_TOKEN=your_token
   ```

3. Replace `CalendarStore` in `ea-agent.ts` with Google Calendar API calls

## Integration Points

### Agent Registry

The agent registry (`/lib/agents/registry.ts`) now fetches live EA metrics:

```typescript
async function getEAStatus(): Promise<Agent> {
  // Calls /api/ea/status to get real-time metrics
  const response = await fetch('/api/ea/status');
  // Returns updated agent card with actual capabilities
}
```

### Agent Graph

The EA Agent appears in the agent graph visualization at `/agents/graph` with:
- Status: Green (active)
- HP: 75 (based on execution success rate)
- MP: 65 (based on token efficiency)
- Capabilities: Calendar management, meeting scheduling, etc.

## Frontend Integration

While there's no dedicated calendar UI page yet, you can integrate the EA agent into:

1. **Dashboard Widget** - Show today's agenda
2. **Quick Actions** - "Block 2 hours for deep work"
3. **Chat Interface** - Natural language scheduling requests
4. **Notification System** - Daily agenda summaries

### Example React Component

```tsx
import useSWR from 'swr';

function DailyAgenda() {
  const { data } = useSWR('/api/ea/status', fetcher);

  return (
    <div>
      <h2>Today's Agenda</h2>
      <p>{data?.dailyAgenda?.summary}</p>
      <ul>
        {data?.dailyAgenda?.events?.map(event => (
          <li key={event.id}>
            {event.title} at {new Date(event.start).toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Testing

### Manual Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test the status endpoint:
   ```bash
   curl http://localhost:4242/api/ea/status
   ```

3. Block time:
   ```bash
   curl -X POST http://localhost:4242/api/ea/schedule \
     -H "Content-Type: application/json" \
     -d '{
       "action": "block_time",
       "title": "Focus Time",
       "start": "2025-12-08T14:00:00.000Z",
       "end": "2025-12-08T16:00:00.000Z"
     }'
   ```

4. Check conflicts:
   ```bash
   curl -X POST http://localhost:4242/api/ea/schedule \
     -H "Content-Type: application/json" \
     -d '{
       "action": "check_conflicts",
       "start": "2025-12-08T14:30:00.000Z",
       "end": "2025-12-08T15:00:00.000Z"
     }'
   ```

### Unit Tests

Create tests in `/lib/agents/__tests__/ea-agent.test.ts`:

```typescript
import { getEAAgent } from '../ea-agent';

describe('EA Agent', () => {
  it('should generate daily agenda', async () => {
    const agent = getEAAgent();
    const agenda = await agent.generateDailyAgenda();
    expect(agenda).toHaveProperty('date');
    expect(agenda).toHaveProperty('events');
    expect(agenda).toHaveProperty('freeSlots');
  });

  it('should detect conflicts', async () => {
    const agent = getEAAgent();
    // Block time first
    await agent.blockTime('Test Event',
      new Date('2025-12-08T10:00:00.000Z'),
      new Date('2025-12-08T11:00:00.000Z')
    );
    // Check for conflicts
    const conflicts = await agent.checkConflicts(
      new Date('2025-12-08T10:30:00.000Z'),
      new Date('2025-12-08T11:30:00.000Z')
    );
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
```

## Future Enhancements

1. **Google Calendar Integration** - Replace mock store with real calendar API
2. **Natural Language Processing** - Parse scheduling requests from chat/email
3. **Smart Scheduling** - ML-based optimal meeting time suggestions
4. **Travel Time Calculations** - Factor in commute between meetings
5. **Calendar UI** - Dedicated calendar page at `/calendar`
6. **Recurring Events** - Support for recurring meetings
7. **Timezone Support** - Handle multi-timezone scheduling
8. **Calendar Sharing** - Share availability with external parties

## Related Documentation

- `/lib/agents/EVENT_BUS_README.md` - Event bus architecture
- `/AGENTS.md` - Overall agent system documentation
- `/.claude_results/` - Phase 4 implementation notes
