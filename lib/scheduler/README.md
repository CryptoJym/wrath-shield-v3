# Life OS Internal Scheduler

**Internal task scheduler for Life OS that runs within the Next.js application.**

## Overview

The Life OS Scheduler is a lightweight, in-process task scheduler that runs scheduled tasks within your Next.js application. It's designed to work in environments where external schedulers like PM2 or cron aren't available (e.g., Vercel, Railway, Docker).

## Features

- ✅ **In-Process Execution** - Runs within Next.js, no external dependencies
- ✅ **Cron-like Scheduling** - Familiar cron syntax for task scheduling
- ✅ **Event Bus Integration** - Tasks can publish events to the Life OS Event Bus
- ✅ **Task Management** - Enable/disable tasks dynamically
- ✅ **Error Handling** - Automatic error reporting via event bus
- ✅ **Status Monitoring** - Real-time task status and execution history

## Quick Start

### 1. Initialize the Scheduler

Add to your `instrumentation.ts` (or equivalent startup file):

```typescript
import { getScheduler } from '@/lib/scheduler';
import { initializeDefaultTasks } from '@/lib/scheduler/default-tasks';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const scheduler = getScheduler();

    // Register default tasks
    initializeDefaultTasks(scheduler);

    // Start the scheduler
    scheduler.start();

    console.log('[Server] Scheduler initialized');
  }
}
```

### 2. Check Status

Get scheduler status via API endpoint:

```typescript
// app/api/scheduler/status/route.ts
import { getScheduler } from '@/lib/scheduler';

export async function GET() {
  const scheduler = getScheduler();
  const status = scheduler.getStatus();

  return Response.json(status);
}
```

### 3. Create Custom Tasks

Register your own scheduled tasks:

```typescript
import { getScheduler } from '@/lib/scheduler';

const scheduler = getScheduler();

scheduler.registerTask({
  id: 'my-custom-task',
  name: 'Custom Task',
  description: 'Does something cool',
  cronExpression: '*/15 * * * *',  // Every 15 minutes
  enabled: true,
  handler: async () => {
    console.log('Custom task running!');
    // Your task logic here
  }
});
```

## Cron Expression Format

The scheduler supports simplified cron expressions:

| Pattern | Description | Example |
|---------|-------------|---------|
| `*/N * * * *` | Every N minutes | `*/30 * * * *` = Every 30 min |
| `0 */N * * *` | Every N hours | `0 */2 * * *` = Every 2 hours |
| `0 H * * *` | Daily at hour H | `0 7 * * *` = Daily at 7 AM |
| `0 H * * D` | Weekly on day D | `0 18 * * 0` = Sundays at 6 PM |

**Note:** For complex scheduling patterns, consider using a full cron library like `node-cron`.

## Default Tasks

The scheduler comes with pre-configured tasks:

### 1. Daily Briefing (7 AM)
Generates and sends daily agenda every morning.

```typescript
cronExpression: '0 7 * * *'
enabled: true
```

### 2. Inbox Sweep (Every 30 min)
Processes and classifies incoming messages.

```typescript
cronExpression: '*/30 * * * *'
enabled: true
```

### 3. Health Reminder (Every 2 hours)
Reminds to take breaks and stay hydrated.

```typescript
cronExpression: '0 */2 * * *'
enabled: true
```

### 4. Weekly Planning (Sunday 6 PM)
Generates weekly review and planning session.

```typescript
cronExpression: '0 18 * * 0'
enabled: false  // Disabled by default
```

### 5. Evening Wind-Down (8 PM)
Prepares tomorrow's preview and wind-down checklist.

```typescript
cronExpression: '0 20 * * *'
enabled: false  // Disabled by default
```

### 6. Focus Time Blocker (9 AM)
Finds opportunities for deep work and blocks calendar.

```typescript
cronExpression: '0 9 * * *'
enabled: false  // Disabled by default
```

## Task Management

### Enable/Disable Tasks

```typescript
import { getScheduler } from '@/lib/scheduler';

const scheduler = getScheduler();

// Enable a task
scheduler.enableTask('weekly-planning');

// Disable a task
scheduler.disableTask('health-reminder');
```

### Get Task Status

```typescript
const scheduler = getScheduler();

// Get all tasks
const allTasks = scheduler.getAllTasks();

// Get specific task
const task = scheduler.getTask('daily-briefing');

// Get scheduler status
const status = scheduler.getStatus();
console.log(`Running: ${status.running}`);
console.log(`Active tasks: ${status.activeTasks}`);
```

### Unregister Tasks

```typescript
const scheduler = getScheduler();

scheduler.unregisterTask('my-custom-task');
```

## Event Bus Integration

Tasks can publish events to the Life OS Event Bus:

```typescript
import { getEventBus, createNotificationEvent } from '@/lib/agents/life-os-event-bus';

scheduler.registerTask({
  id: 'notification-task',
  name: 'Notification Task',
  description: 'Sends periodic notifications',
  cronExpression: '0 9 * * *',
  enabled: true,
  handler: async () => {
    const eventBus = getEventBus();

    await eventBus.publish(createNotificationEvent({
      source: 'scheduler.notification-task',
      domain: 'work',
      payload: {
        message: 'Daily notification!',
        type: 'reminder'
      },
      priority: 'normal'
    }));
  }
});
```

## Error Handling

The scheduler automatically publishes error events when tasks fail:

```typescript
// Subscribe to scheduler errors
const eventBus = getEventBus();

eventBus.subscribe(
  'agent.scheduler',
  async (event) => {
    if (event.payload?.type === 'task-error') {
      console.error('Task error:', event.payload);
      // Handle error (e.g., send alert, retry, etc.)
    }
  },
  100,
  'error-handler'
);
```

## Production Deployment

### Vercel
The scheduler runs automatically in Vercel serverless functions. Note that serverless functions have execution time limits (10s default, 60s max on Pro).

For long-running tasks, consider using:
- Vercel Cron Jobs (recommended for scheduled tasks)
- External services (e.g., GitHub Actions, AWS EventBridge)

### Railway / Docker
The scheduler works perfectly in long-running containers. No additional configuration needed.

### PM2
If using PM2, you can still use this scheduler OR disable it and use PM2's native cron feature:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'wrath-shield',
    script: 'npm',
    args: 'start',
    cron_restart: '0 */6 * * *'  // Restart every 6 hours
  }]
};
```

## API Endpoints

Create API endpoints to manage the scheduler:

### Get Status
```typescript
// app/api/scheduler/status/route.ts
import { getScheduler } from '@/lib/scheduler';

export async function GET() {
  const status = getScheduler().getStatus();
  return Response.json(status);
}
```

### Enable Task
```typescript
// app/api/scheduler/tasks/[taskId]/enable/route.ts
import { getScheduler } from '@/lib/scheduler';

export async function POST(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const scheduler = getScheduler();
  scheduler.enableTask(params.taskId);

  return Response.json({ success: true });
}
```

### Disable Task
```typescript
// app/api/scheduler/tasks/[taskId]/disable/route.ts
import { getScheduler } from '@/lib/scheduler';

export async function POST(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const scheduler = getScheduler();
  scheduler.disableTask(params.taskId);

  return Response.json({ success: true });
}
```

## Best Practices

1. **Keep tasks short** - Tasks should complete quickly (<30s). Use event bus for long-running work.
2. **Use event bus** - Publish events for work that needs to be done, don't do heavy processing in handlers.
3. **Error handling** - Always wrap task logic in try/catch and log errors.
4. **Enable selectively** - Start with essential tasks enabled, let users enable optional ones.
5. **Monitor execution** - Track task execution times and success rates.
6. **Test thoroughly** - Test tasks in development before enabling in production.

## Testing

```typescript
import { getScheduler, resetScheduler } from '@/lib/scheduler';

describe('Scheduler', () => {
  afterEach(() => {
    resetScheduler();
  });

  it('registers and runs tasks', async () => {
    const scheduler = getScheduler();
    let executed = false;

    scheduler.registerTask({
      id: 'test-task',
      name: 'Test Task',
      description: 'Test',
      cronExpression: '*/1 * * * *',  // Every minute
      enabled: true,
      handler: async () => {
        executed = true;
      }
    });

    scheduler.start();

    // Wait for task to execute
    await new Promise(resolve => setTimeout(resolve, 61000));

    expect(executed).toBe(true);
  });
});
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Next.js Application             │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   instrumentation.ts              │ │
│  │   - Initialize scheduler          │ │
│  │   - Register default tasks        │ │
│  │   - Start scheduler               │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │   LifeOSScheduler                 │ │
│  │   - Task registry                 │ │
│  │   - Interval management           │ │
│  │   - Cron parsing                  │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │   Task Handlers                   │ │
│  │   - Daily briefing                │ │
│  │   - Inbox sweep                   │ │
│  │   - Health reminders              │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │   Life OS Event Bus               │ │
│  │   - Publish task events           │ │
│  │   - Trigger agent actions         │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Tasks not running
- Check scheduler status: `scheduler.getStatus()`
- Verify scheduler is started: `scheduler.start()`
- Check task is enabled: `task.enabled === true`
- Check cron expression is valid

### Tasks running multiple times
- Ensure scheduler is only started once (use singleton pattern)
- Check for duplicate task registrations
- Verify intervals are being cleared properly

### High memory usage
- Limit event log size (default: 1000 events)
- Clear task history periodically
- Use event bus for heavy processing, not task handlers

## Future Enhancements

- [ ] Persistent task history in database
- [ ] Task execution metrics and analytics
- [ ] Retry logic for failed tasks
- [ ] Task dependencies and chaining
- [ ] Dynamic cron expression updates
- [ ] Task priority queues
- [ ] Rate limiting and throttling
- [ ] Full cron library integration
- [ ] Web UI for task management
- [ ] Webhook triggers for tasks
