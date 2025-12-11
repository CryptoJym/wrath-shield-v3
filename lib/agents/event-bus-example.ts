/**
 * LifeOS Event Bus - Usage Examples
 *
 * This file demonstrates how agents can use the event bus for communication.
 * These patterns are used throughout the LifeOS agent system.
 */

import {
  getEventBus,
  createMessageEvent,
  createTaskEvent,
  createNotificationEvent,
  createEscalationEvent,
  DOMAINS,
} from './life-os-event-bus';

// =============================================================================
// EXAMPLE 1: Basic Agent Communication
// =============================================================================

export async function example1_basicCommunication() {
  const bus = getEventBus();

  // Agent 1: Subscribe to messages
  bus.subscribe(
    'domain.family',
    async (event) => {
      console.log(`[Family Agent] Received: ${JSON.stringify(event.payload)}`);
      // Process family-related message
    },
    100,
    'family-agent'
  );

  // Agent 2: Send a message to family domain
  await bus.publish(
    createMessageEvent(
      'inbox-agent',
      { text: 'New family message from mom', from: 'mom@example.com' },
      DOMAINS.FAMILY,
      'high'
    )
  );
}

// =============================================================================
// EXAMPLE 2: Multi-Agent Task Coordination
// =============================================================================

export async function example2_taskCoordination() {
  const bus = getEventBus();

  // PM Agent: Subscribe to task events
  bus.subscribe(
    'type.task',
    async (event) => {
      console.log(`[PM Agent] New task: ${JSON.stringify(event.payload)}`);
      // Create task in Motion/GitHub
    },
    100,
    'pm-agent'
  );

  // Finance Agent: Subscribe to finance tasks
  bus.subscribe(
    'domain.finance',
    async (event) => {
      console.log(`[Finance Agent] Processing: ${JSON.stringify(event.payload)}`);
      // Process finance-related task
    },
    100,
    'finance-agent'
  );

  // Inbox Agent: Create a task
  const correlationId = `task-${Date.now()}`;
  await bus.publish(
    createTaskEvent(
      'inbox-agent',
      {
        title: 'Review Q4 budget',
        assignee: 'finance-agent',
        dueDate: '2025-12-15',
      },
      DOMAINS.FINANCE,
      'high',
      correlationId
    )
  );

  // Finance Agent: Report completion
  await bus.publish(
    createNotificationEvent(
      'finance-agent',
      {
        status: 'completed',
        result: 'Budget reviewed, $10k variance identified',
      },
      DOMAINS.FINANCE,
      'normal',
      correlationId
    )
  );
}

// =============================================================================
// EXAMPLE 3: Escalation Pattern
// =============================================================================

export async function example3_escalation() {
  const bus = getEventBus();

  // EA Agent: Subscribe to critical escalations
  bus.subscribe(
    'priority.critical',
    async (event) => {
      console.log(`[EA Agent] CRITICAL: ${JSON.stringify(event.payload)}`);
      // Notify user immediately
      // Block calendar if needed
    },
    200, // Higher priority
    'ea-agent'
  );

  // Legal Agent: Subscribe to all escalations
  bus.subscribe(
    'escalation.*',
    async (event) => {
      console.log(`[Legal Agent] Escalation: ${JSON.stringify(event.payload)}`);
      // Track in legal system
    },
    100,
    'legal-agent'
  );

  // Finance Agent: Escalate an urgent issue
  await bus.publishEscalation('critical', {
    id: 'esc-001',
    source: 'finance-agent',
    payload: {
      issue: 'Unusual transaction detected: $50,000 withdrawal',
      account: '****1234',
      timestamp: new Date(),
      requiresApproval: true,
    },
    timestamp: new Date(),
  });
}

// =============================================================================
// EXAMPLE 4: Cross-Domain Communication
// =============================================================================

export async function example4_crossDomain() {
  const bus = getEventBus();

  // Health Agent: Subscribe to health events
  bus.subscribe(
    'domain.health',
    async (event) => {
      console.log(`[Health Agent] Health event: ${JSON.stringify(event.payload)}`);
    },
    100,
    'health-agent'
  );

  // Calendar Agent: Subscribe to work events
  bus.subscribe(
    'domain.work',
    async (event) => {
      console.log(`[Calendar Agent] Work event: ${JSON.stringify(event.payload)}`);
    },
    100,
    'calendar-agent'
  );

  // EA Agent: Subscribe to all domains for oversight
  bus.subscribe(
    '*',
    async (event) => {
      console.log(`[EA Agent] All events: ${event.type} from ${event.source}`);
      // Track all activity for daily summary
    },
    50, // Lower priority - runs last
    'ea-agent'
  );

  // EEG Agent: Publish WHOOP recovery data
  await bus.publish(
    createNotificationEvent(
      'eeg-agent',
      {
        metric: 'recovery',
        value: 0.72,
        recommendation: 'Good day for intense workout',
      },
      DOMAINS.HEALTH,
      'normal'
    )
  );

  // Inbox Agent: Forward work meeting request
  await bus.publish(
    createMessageEvent(
      'inbox-agent',
      {
        subject: 'Team sync tomorrow at 2pm',
        from: 'boss@company.com',
        needsResponse: true,
      },
      DOMAINS.WORK,
      'high'
    )
  );
}

// =============================================================================
// EXAMPLE 5: Agent Monitoring Pattern
// =============================================================================

export async function example5_monitoring() {
  const bus = getEventBus();

  // Monitor Agent: Track all agent activity
  const agentActivity = new Map<string, number>();

  bus.subscribe(
    '*',
    async (event) => {
      const count = agentActivity.get(event.source) || 0;
      agentActivity.set(event.source, count + 1);

      // Log stats every 10 events
      if (Array.from(agentActivity.values()).reduce((a, b) => a + b, 0) % 10 === 0) {
        console.log('[Monitor] Agent activity:', Object.fromEntries(agentActivity));
      }
    },
    1, // Lowest priority - runs last
    'monitor-agent'
  );

  // Get bus statistics
  const stats = bus.getStats();
  console.log('[Monitor] Bus stats:', stats);

  // Get recent events
  const recentEvents = bus.getRecentEvents(10);
  console.log(`[Monitor] Recent events: ${recentEvents.length}`);
}

// =============================================================================
// EXAMPLE 6: Unsubscribe Pattern
// =============================================================================

export async function example6_unsubscribe() {
  const bus = getEventBus();

  // Subscribe and get unsubscribe function
  const unsubscribe = bus.subscribe(
    'domain.work',
    async (event) => {
      console.log(`[Temp Agent] Work event: ${JSON.stringify(event.payload)}`);
    },
    100,
    'temp-agent'
  );

  // Do some work...
  await bus.publish(
    createMessageEvent('inbox', { text: 'Meeting at 3pm' }, DOMAINS.WORK)
  );

  // Unsubscribe when done
  unsubscribe();

  // This event won't be received
  await bus.publish(
    createMessageEvent('inbox', { text: 'Another meeting' }, DOMAINS.WORK)
  );
}

// =============================================================================
// EXAMPLE 7: Real-World Workflow
// =============================================================================

export async function example7_realWorldWorkflow() {
  const bus = getEventBus();

  // Setup agents
  const setupAgents = () => {
    // Inbox Agent: Route incoming messages
    bus.subscribe(
      'agent.inbox-agent',
      async (event) => {
        const message = event.payload as { from: string; subject: string };
        console.log(`[Inbox] Routing message from ${message.from}`);

        // Route to appropriate domain
        if (message.from.includes('@lawfirm.com')) {
          await bus.publishToDomain(DOMAINS.LEGAL, {
            id: `fwd-${event.id}`,
            type: 'message',
            source: 'inbox-agent',
            priority: 'high',
            payload: message,
            timestamp: new Date(),
          });
        } else if (message.subject.toLowerCase().includes('budget')) {
          await bus.publishToDomain(DOMAINS.FINANCE, {
            id: `fwd-${event.id}`,
            type: 'message',
            source: 'inbox-agent',
            priority: 'normal',
            payload: message,
            timestamp: new Date(),
          });
        }
      },
      100,
      'inbox-agent'
    );

    // Legal Agent: Process legal messages
    bus.subscribe(
      'domain.legal',
      async (event) => {
        console.log(`[Legal] Processing: ${JSON.stringify(event.payload)}`);
        // Store in MyCase, create tasks, etc.
      },
      100,
      'legal-agent'
    );

    // Finance Agent: Process finance messages
    bus.subscribe(
      'domain.finance',
      async (event) => {
        console.log(`[Finance] Processing: ${JSON.stringify(event.payload)}`);
        // Update budget tracker, create Plaid queries, etc.
      },
      100,
      'finance-agent'
    );
  };

  setupAgents();

  // Simulate incoming messages
  await bus.publish(
    createMessageEvent('inbox-agent', {
      from: 'partner@lawfirm.com',
      subject: 'Case update - Smith v. Jones',
    })
  );

  await bus.publish(
    createMessageEvent('inbox-agent', {
      from: 'accounting@company.com',
      subject: 'Q4 budget review needed',
    })
  );
}

// =============================================================================
// RUN EXAMPLES
// =============================================================================

if (require.main === module) {
  (async () => {
    console.log('\n=== Example 1: Basic Communication ===');
    await example1_basicCommunication();

    console.log('\n=== Example 2: Task Coordination ===');
    await example2_taskCoordination();

    console.log('\n=== Example 3: Escalation ===');
    await example3_escalation();

    console.log('\n=== Example 4: Cross-Domain ===');
    await example4_crossDomain();

    console.log('\n=== Example 5: Monitoring ===');
    await example5_monitoring();

    console.log('\n=== Example 6: Unsubscribe ===');
    await example6_unsubscribe();

    console.log('\n=== Example 7: Real-World Workflow ===');
    await example7_realWorldWorkflow();
  })();
}
