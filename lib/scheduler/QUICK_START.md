# Life OS Scheduler - Quick Start Guide

**Get up and running with the Life OS Internal Scheduler in 5 minutes.**

## What is it?

An in-process task scheduler that runs within your Next.js app. No PM2, no cron, no external dependencies.

## Already Running

The scheduler starts automatically on server startup via `instrumentation.ts`. Check status:

```bash
curl http://localhost:4242/api/scheduler/status
```

## Default Tasks

Three tasks are enabled by default:

1. **Daily Briefing** (7 AM) - Morning agenda
2. **Inbox Sweep** (Every 30 min) - Process messages
3. **Health Reminder** (Every 2 hours) - Break reminders

Three optional tasks (disabled):

4. **Weekly Planning** (Sunday 6 PM) - Weekly review
5. **Evening Wind-Down** (8 PM) - Tomorrow's preview
6. **Focus Time Blocker** (9 AM) - Find deep work time

## Enable Optional Tasks

### Via Code
```typescript
import { getScheduler } from '@/lib/scheduler';

const scheduler = getScheduler();
scheduler.enableTask('weekly-planning');
```

### Via API
```bash
curl -X PATCH http://localhost:4242/api/scheduler/tasks/weekly-planning \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

## Create Custom Task

```typescript
import { getScheduler } from '@/lib/scheduler';

const scheduler = getScheduler();

scheduler.registerTask({
  id: 'my-task',
  name: 'My Custom Task',
  description: 'Does something cool',
  cronExpression: '0 12 * * *',  // Noon daily
  enabled: true,
  handler: async () => {
    console.log('Task running!');
    // Your logic here
  }
});
```

## Cron Patterns

| Pattern | Runs |
|---------|------|
| `*/15 * * * *` | Every 15 minutes |
| `0 */2 * * *` | Every 2 hours |
| `0 9 * * *` | Daily at 9 AM |
| `0 18 * * 5` | Fridays at 6 PM |

## Monitor Tasks

### All Tasks
```bash
curl http://localhost:4242/api/scheduler/tasks
```

### Specific Task
```bash
curl http://localhost:4242/api/scheduler/tasks/daily-briefing
```

### Scheduler Status
```bash
curl http://localhost:4242/api/scheduler/status
```

## Disable Task

### Via Code
```typescript
scheduler.disableTask('health-reminder');
```

### Via API
```bash
curl -X PATCH http://localhost:4242/api/scheduler/tasks/health-reminder \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

## Publish Events from Tasks

Tasks can publish to the Event Bus:

```typescript
import { getEventBus, createNotificationEvent } from '@/lib/agents/life-os-event-bus';

scheduler.registerTask({
  id: 'notification-task',
  name: 'Send Notification',
  description: 'Sends daily notification',
  cronExpression: '0 9 * * *',
  enabled: true,
  handler: async () => {
    const eventBus = getEventBus();

    await eventBus.publish(createNotificationEvent({
      source: 'scheduler.notification-task',
      domain: 'work',
      payload: {
        message: 'Good morning!',
        type: 'greeting'
      },
      priority: 'normal'
    }));
  }
});
```

## Integration with EA Agent

Use the EA Agent in your tasks:

```typescript
import { getEAAgent } from '@/lib/agents/ea-agent';

scheduler.registerTask({
  id: 'calendar-check',
  name: 'Calendar Check',
  description: 'Check upcoming events',
  cronExpression: '0 8 * * *',
  enabled: true,
  handler: async () => {
    const ea = getEAAgent();
    const events = await ea.getUpcomingEvents(7);

    console.log(`You have ${events.length} events in the next 7 days`);
  }
});
```

## Error Handling

Errors are automatically published to the Event Bus:

```typescript
// Subscribe to scheduler errors
const eventBus = getEventBus();

eventBus.subscribe(
  'agent.scheduler',
  async (event) => {
    if (event.payload?.type === 'task-error') {
      console.error('Task failed:', event.payload);
      // Send alert, retry, etc.
    }
  },
  100,
  'error-monitor'
);
```

## Testing

```typescript
import { getScheduler, resetScheduler } from '@/lib/scheduler';

describe('My Task', () => {
  afterEach(() => {
    resetScheduler();
  });

  it('executes correctly', async () => {
    const scheduler = getScheduler();
    let executed = false;

    scheduler.registerTask({
      id: 'test',
      name: 'Test',
      description: 'Test task',
      cronExpression: '*/1 * * * *',
      enabled: true,
      handler: async () => {
        executed = true;
      }
    });

    scheduler.start();

    // Wait for execution
    await new Promise(r => setTimeout(r, 61000));

    expect(executed).toBe(true);
  });
});
```

## Common Patterns

### Morning Routine
```typescript
scheduler.registerTask({
  id: 'morning-routine',
  name: 'Morning Routine',
  cronExpression: '0 7 * * *',  // 7 AM
  enabled: true,
  handler: async () => {
    const ea = getEAAgent();
    const agenda = await ea.generateDailyAgenda();
    // Send to notification system
  }
});
```

### Evening Cleanup
```typescript
scheduler.registerTask({
  id: 'evening-cleanup',
  name: 'Evening Cleanup',
  cronExpression: '0 22 * * *',  // 10 PM
  enabled: true,
  handler: async () => {
    // Archive old data
    // Send daily summary
    // Prepare for tomorrow
  }
});
```

### Periodic Sync
```typescript
scheduler.registerTask({
  id: 'sync-data',
  name: 'Data Sync',
  cronExpression: '*/30 * * * *',  // Every 30 min
  enabled: true,
  handler: async () => {
    // Sync with external services
    // Update local cache
  }
});
```

## Troubleshooting

### Tasks Not Running
1. Check scheduler is running: `GET /api/scheduler/status`
2. Verify task is enabled: `GET /api/scheduler/tasks/[taskId]`
3. Check server logs for errors
4. Ensure cron expression is valid

### Task Running Multiple Times
1. Verify only one server instance running
2. Check for duplicate task registrations
3. Review interval calculations

### High CPU/Memory
1. Keep task handlers short (<30s)
2. Use event bus for long-running work
3. Don't process heavy data in handlers
4. Offload to background jobs

## Best Practices

✅ **DO:**
- Keep handlers short and simple
- Use event bus for async work
- Log task execution
- Handle errors gracefully
- Test tasks thoroughly

❌ **DON'T:**
- Block event loop in handlers
- Process large datasets synchronously
- Ignore errors
- Create circular dependencies
- Schedule too frequently (<1 min)

## Production Deployment

### Vercel
- Use Vercel Cron for critical tasks
- Scheduler works but has 60s timeout

### Railway/Docker
- Perfect for long-running containers
- No special configuration needed

### PM2
- Can coexist with PM2
- Or use PM2 native cron instead

## Need Help?

- **Full Docs:** `/lib/scheduler/README.md`
- **Implementation Guide:** `/SCHEDULER_IMPLEMENTATION.md`
- **Tests:** `/lib/scheduler/__tests__/scheduler.test.ts`
- **Examples:** Check default tasks in `/lib/scheduler/default-tasks.ts`

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scheduler/status` | GET | Get scheduler status |
| `/api/scheduler/tasks` | GET | List all tasks |
| `/api/scheduler/tasks/[id]` | GET | Get task details |
| `/api/scheduler/tasks/[id]` | PATCH | Enable/disable task |
| `/api/scheduler/tasks/[id]` | DELETE | Unregister task |

---

**That's it!** You're ready to use the Life OS Scheduler. Create custom tasks, enable optional ones, and automate your workflows.
