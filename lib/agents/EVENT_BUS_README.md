# LifeOS Event Bus

Multi-agent communication system for Wrath Shield v3. Provides pub/sub messaging with pattern-based routing, priority handling, and domain isolation.

## Quick Start

```typescript
import { getEventBus, createMessageEvent, DOMAINS } from '@/lib/agents/life-os-event-bus';

const bus = getEventBus();

// Subscribe to events
bus.subscribe('domain.family', async (event) => {
  console.log('Family event:', event.payload);
}, 100, 'family-agent');

// Publish event
await bus.publish(
  createMessageEvent(
    'inbox-agent',
    { text: 'New family message' },
    DOMAINS.FAMILY,
    'high'
  )
);
```

## Architecture

Based on the Hyro Forge event bus pattern, extended for multi-agent orchestration:

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│ Inbox Agent │─────▶│  Event Bus   │─────▶│Family Agent │
└─────────────┘      │              │      └─────────────┘
                     │  - Pattern   │
┌─────────────┐      │    matching  │      ┌─────────────┐
│Finance Agent│◀─────│  - Priority  │─────▶│ Legal Agent │
└─────────────┘      │    queues    │      └─────────────┘
                     │  - Event log │
┌─────────────┐      │  - Domains   │      ┌─────────────┐
│  PM Agent   │◀─────│              │─────▶│   EA Agent  │
└─────────────┘      └──────────────┘      └─────────────┘
```

## Event Types

### AgentEvent

```typescript
interface AgentEvent {
  id: string;                  // Unique event ID
  type: 'message' | 'task' | 'notification' | 'escalation';
  source: string;              // Agent ID that emitted
  domain?: string;             // Optional domain (family, work, etc.)
  priority: 'critical' | 'high' | 'normal' | 'low';
  payload: unknown;            // Event data
  timestamp: Date;
  correlationId?: string;      // For tracking related events
}
```

## Subscription Patterns

The event bus supports wildcard pattern matching:

| Pattern | Matches | Example |
|---------|---------|---------|
| `*` | All events | Monitor all activity |
| `domain.family` | Specific domain | Family-related events |
| `domain.fam.*` | Domain prefix | `family`, `family-health`, etc. |
| `agent.inbox-agent` | Specific agent | Events from inbox agent |
| `agent.inbox.*` | Agent prefix | `inbox-agent`, `inbox-router` |
| `type.task` | Event type | All task events |
| `escalation.*` | All escalations | Critical/high priority issues |
| `priority.critical` | Specific priority | Critical events only |

## Priority System

Handlers execute in priority order (higher first):

```typescript
// Critical system handler (runs first)
bus.subscribe('*', criticalHandler, 200, 'system');

// Normal agent handler
bus.subscribe('domain.work', workHandler, 100, 'work-agent');

// Logging handler (runs last)
bus.subscribe('*', logHandler, 50, 'logger');
```

## Domains

Pre-defined domains for organizing events:

```typescript
export const DOMAINS = {
  FAMILY: 'family',
  WORK: 'work',
  HEALTH: 'health',
  FINANCE: 'finance',
  LEARNING: 'learning',
  LEGAL: 'legal',
} as const;
```

## Helper Functions

### Event Creation

```typescript
// Message event
createMessageEvent(source, payload, domain?, priority?, correlationId?);

// Task event
createTaskEvent(source, payload, domain?, priority?, correlationId?);

// Notification event
createNotificationEvent(source, payload, domain?, priority?, correlationId?);

// Escalation event
createEscalationEvent(source, payload, priority, domain?, correlationId?);
```

### Publishing

```typescript
// Standard publish
await bus.publish(event);

// Publish to domain
await bus.publishToDomain('family', event);

// Publish to specific agent
await bus.publishToAgent('ea-agent', event);

// Publish escalation
await bus.publishEscalation('critical', event);
```

### Monitoring

```typescript
// Get recent events
const events = bus.getRecentEvents(50);

// Get events for specific agent
const agentEvents = bus.getEventsForAgent('inbox-agent', 50);

// Get events for specific domain
const domainEvents = bus.getEventsForDomain('family', 50);

// Get statistics
const stats = bus.getStats();
// { patterns: 5, totalSubscriptions: 12, recentEvents: 150 }
```

## Common Patterns

### 1. Agent Communication

```typescript
// Agent A publishes
await bus.publish(
  createMessageEvent('agent-a', { data: 'hello' }, DOMAINS.WORK)
);

// Agent B subscribes
bus.subscribe('domain.work', async (event) => {
  console.log('Received:', event.payload);
}, 100, 'agent-b');
```

### 2. Task Coordination

```typescript
const correlationId = `task-${Date.now()}`;

// Create task
await bus.publish(
  createTaskEvent('inbox', { title: 'Review contract' }, DOMAINS.LEGAL, 'high', correlationId)
);

// Report completion
await bus.publish(
  createNotificationEvent('legal-agent', { status: 'complete' }, DOMAINS.LEGAL, 'normal', correlationId)
);
```

### 3. Escalation

```typescript
// Agent detects critical issue
await bus.publishEscalation('critical', {
  id: generateEventId(),
  source: 'finance-agent',
  payload: {
    issue: 'Unusual transaction detected',
    amount: 50000,
    requiresApproval: true,
  },
  timestamp: new Date(),
});

// EA subscribes to critical events
bus.subscribe('priority.critical', async (event) => {
  // Notify user immediately
  // Block calendar if needed
}, 200, 'ea-agent');
```

### 4. Cross-Domain Monitoring

```typescript
// EA monitors all activity
bus.subscribe('*', async (event) => {
  // Track for daily summary
  await trackActivity(event);
}, 50, 'ea-agent');

// Legal monitors legal events
bus.subscribe('domain.legal', async (event) => {
  // Log in MyCase
  await logToMyCase(event);
}, 100, 'legal-agent');
```

### 5. Temporary Subscriptions

```typescript
// Subscribe temporarily
const unsubscribe = bus.subscribe('domain.work', handler, 100, 'temp-agent');

// Do work...
await processWorkItems();

// Cleanup
unsubscribe();
```

## Error Handling

The event bus continues execution even if handlers fail:

```typescript
bus.subscribe('*', async (event) => {
  throw new Error('Handler failed');
}, 100, 'failing-agent');

bus.subscribe('*', async (event) => {
  console.log('This still executes');
}, 100, 'working-agent');

// Listen for errors
bus.on('error', ({ event, errors }) => {
  console.error('Handler errors:', errors);
});
```

## Testing

Comprehensive test suite at `/lib/agents/__tests__/event-bus.test.ts`:

```bash
npm test -- lib/agents/__tests__/event-bus.test.ts
```

Coverage:
- ✅ Pattern matching (wildcard, domain, agent, type, priority)
- ✅ Priority-based execution
- ✅ Error resilience
- ✅ Subscription/unsubscription
- ✅ Event logging and monitoring
- ✅ Correlation IDs
- ✅ Helper functions

## Examples

See `/lib/agents/event-bus-example.ts` for complete examples:

1. Basic agent communication
2. Multi-agent task coordination
3. Escalation patterns
4. Cross-domain communication
5. Agent monitoring
6. Unsubscribe patterns
7. Real-world workflow

Run examples:

```bash
npx ts-node lib/agents/event-bus-example.ts
```

## Integration with Existing Systems

### Hyro Forge Event Bus

The LifeOS event bus is modeled after the Hyro Forge event bus at `/lib/hyro/forge-event-bus.ts`:

- Similar architecture (in-memory, queue-based)
- Pattern-based subscriptions
- Priority handling
- Event logging
- Error resilience

### Agent Registry

Agents from `/lib/agents/registry.ts` can use the event bus:

```typescript
import { getEventBus } from '@/lib/agents/life-os-event-bus';

// In agent initialization
const bus = getEventBus();
bus.subscribe('domain.family', familyHandler, 100, 'family-agent');
```

### Memory Integration

Events can trigger memory updates:

```typescript
bus.subscribe('*', async (event) => {
  // Store important events in Zep
  await addMemory(JSON.stringify(event.payload), event.source);
}, 50, 'memory-agent');
```

## Performance

- **In-memory**: No external dependencies
- **Queue-based**: Sequential event processing prevents race conditions
- **Priority-sorted**: O(n log n) for subscription sorting, O(n) for dispatch
- **Event log**: Capped at 1000 events (configurable)

## Future Enhancements

Potential improvements for Phase 4+:

1. **Redis backend**: Distributed event bus for multi-process systems
2. **Event replay**: Replay events from log for debugging
3. **Event filtering**: More advanced pattern matching (regex, predicates)
4. **Event batching**: Batch multiple events for efficiency
5. **Metrics**: Event throughput, handler latency, error rates
6. **Dead letter queue**: Failed events sent to DLQ for retry
7. **Event versioning**: Schema evolution support

## API Reference

### LifeOSEventBus

#### Methods

- `subscribe(pattern, handler, priority, agentId)` - Subscribe to events, returns unsubscribe function
- `publish(event)` - Publish event to all matching subscribers
- `publishToDomain(domain, event)` - Publish to specific domain
- `publishToAgent(agentId, event)` - Publish to specific agent
- `publishEscalation(level, event)` - Publish escalation event
- `getRecentEvents(count)` - Get recent events
- `getEventsForAgent(agentId, count)` - Get events for specific agent
- `getEventsForDomain(domain, count)` - Get events for specific domain
- `getStats()` - Get subscription and event statistics

### Helper Functions

- `getEventBus()` - Get singleton event bus instance
- `resetEventBus()` - Reset event bus (for testing)
- `generateEventId()` - Generate unique event ID
- `createMessageEvent(...)` - Create message event
- `createTaskEvent(...)` - Create task event
- `createNotificationEvent(...)` - Create notification event
- `createEscalationEvent(...)` - Create escalation event

## License

Part of Wrath Shield v3 - Personal AI Assistant Platform
