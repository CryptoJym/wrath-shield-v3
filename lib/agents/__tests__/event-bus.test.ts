/**
 * LifeOS Event Bus Tests
 * Comprehensive test suite for agent communication
 */

import {
  getEventBus,
  resetEventBus,
  generateEventId,
  createMessageEvent,
  createTaskEvent,
  createNotificationEvent,
  createEscalationEvent,
  DOMAINS,
  type AgentEvent,
} from '../life-os-event-bus';

describe('LifeOS Event Bus', () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  describe('Initialization', () => {
    it('should create a singleton instance', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();
      expect(bus1).toBe(bus2);
    });

    it('should reset the bus', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();
      expect(bus1).not.toBe(bus2);
    });
  });

  describe('Event Publishing and Subscription', () => {
    it('should publish and receive events', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('*', handler, 100, 'test-agent');

      const event = createMessageEvent('inbox-agent', { text: 'Hello' });
      await bus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should support multiple subscribers', async () => {
      const bus = getEventBus();
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.subscribe('*', handler1, 100, 'agent-1');
      bus.subscribe('*', handler2, 100, 'agent-2');

      const event = createMessageEvent('inbox-agent', { text: 'Hello' });
      await bus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should execute handlers by priority (higher first)', async () => {
      const bus = getEventBus();
      const executionOrder: string[] = [];

      const handler1 = jest.fn(async () => {
        executionOrder.push('low');
      });
      const handler2 = jest.fn(async () => {
        executionOrder.push('high');
      });

      bus.subscribe('*', handler1, 50, 'low-priority');
      bus.subscribe('*', handler2, 200, 'high-priority');

      const event = createMessageEvent('test', { data: 'test' });
      await bus.publish(event);

      expect(executionOrder).toEqual(['high', 'low']);
    });

    it('should continue execution even if a handler fails', async () => {
      const bus = getEventBus();
      const handler1 = jest.fn(() => {
        throw new Error('Handler 1 failed');
      });
      const handler2 = jest.fn();

      // Suppress error event emission for this test
      bus.on('error', () => {
        // Intentionally empty - just consuming the error event
      });

      bus.subscribe('*', handler1, 100, 'failing-agent');
      bus.subscribe('*', handler2, 100, 'working-agent');

      const event = createMessageEvent('test', { data: 'test' });
      await bus.publish(event);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Pattern Matching', () => {
    it('should match wildcard pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('*', handler, 100, 'test-agent');

      const event = createMessageEvent('any-agent', { data: 'test' });
      await bus.publish(event);

      expect(handler).toHaveBeenCalled();
    });

    it('should match domain pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('domain.family', handler, 100, 'family-agent');

      const event1 = createMessageEvent('inbox', { data: 'test' }, DOMAINS.FAMILY);
      const event2 = createMessageEvent('inbox', { data: 'test' }, DOMAINS.WORK);

      await bus.publish(event1);
      await bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });

    it('should match domain wildcard pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('domain.fam.*', handler, 100, 'family-agent');

      const event1 = createMessageEvent('inbox', { data: 'test' }, 'family');
      const event2 = createMessageEvent('inbox', { data: 'test' }, 'work');

      await bus.publish(event1);
      await bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should match agent pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('agent.inbox-agent', handler, 100, 'monitor');

      const event1 = createMessageEvent('inbox-agent', { data: 'test' });
      const event2 = createMessageEvent('finance-agent', { data: 'test' });

      await bus.publish(event1);
      await bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });

    it('should match agent wildcard pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('agent.inbox.*', handler, 100, 'monitor');

      const event1 = createMessageEvent('inbox-agent', { data: 'test' });
      const event2 = createMessageEvent('inbox-router', { data: 'test' });
      const event3 = createMessageEvent('finance-agent', { data: 'test' });

      await bus.publish(event1);
      await bus.publish(event2);
      await bus.publish(event3);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should match type pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('type.task', handler, 100, 'task-handler');

      const event1 = createTaskEvent('agent', { task: 'do something' });
      const event2 = createMessageEvent('agent', { message: 'hello' });

      await bus.publish(event1);
      await bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });

    it('should match escalation pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('escalation.*', handler, 100, 'escalation-handler');

      const event1 = createEscalationEvent('agent', { issue: 'critical' }, 'critical');
      const event2 = createMessageEvent('agent', { message: 'hello' });

      await bus.publish(event1);
      await bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });

    it('should match priority pattern', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('priority.critical', handler, 100, 'critical-handler');

      const event1 = createEscalationEvent('agent', { issue: 'urgent' }, 'critical');
      const event2 = createMessageEvent('agent', { message: 'hello' }, undefined, 'normal');

      await bus.publish(event1);
      await bus.publish(event2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });
  });

  describe('Unsubscribe', () => {
    it('should unsubscribe using returned function', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      const unsubscribe = bus.subscribe('*', handler, 100, 'test-agent');

      const event1 = createMessageEvent('agent', { data: 'test1' });
      await bus.publish(event1);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      const event2 = createMessageEvent('agent', { data: 'test2' });
      await bus.publish(event2);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('Helper Methods', () => {
    it('should publish to specific domain', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('domain.family', handler, 100, 'family-agent');

      await bus.publishToDomain(DOMAINS.FAMILY, {
        id: generateEventId(),
        type: 'message',
        source: 'inbox',
        priority: 'normal',
        payload: { text: 'Hello family' },
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should publish escalation with correct priority', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe('escalation.*', handler, 100, 'escalation-handler');

      await bus.publishEscalation('critical', {
        id: generateEventId(),
        source: 'agent',
        payload: { issue: 'critical issue' },
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as AgentEvent;
      expect(event.type).toBe('escalation');
      expect(event.priority).toBe('critical');
    });
  });

  describe('Event Log', () => {
    it('should maintain recent events log', async () => {
      const bus = getEventBus();

      const event1 = createMessageEvent('agent-1', { data: 'test1' });
      const event2 = createMessageEvent('agent-2', { data: 'test2' });

      await bus.publish(event1);
      await bus.publish(event2);

      const recentEvents = bus.getRecentEvents(10);
      expect(recentEvents).toHaveLength(2);
      expect(recentEvents[0]).toEqual(event1);
      expect(recentEvents[1]).toEqual(event2);
    });

    it('should filter events by agent', async () => {
      const bus = getEventBus();

      const event1 = createMessageEvent('agent-1', { data: 'test1' });
      const event2 = createMessageEvent('agent-2', { data: 'test2' });
      const event3 = createMessageEvent('agent-1', { data: 'test3' });

      await bus.publish(event1);
      await bus.publish(event2);
      await bus.publish(event3);

      const agent1Events = bus.getEventsForAgent('agent-1', 10);
      expect(agent1Events).toHaveLength(2);
      expect(agent1Events[0].source).toBe('agent-1');
      expect(agent1Events[1].source).toBe('agent-1');
    });

    it('should filter events by domain', async () => {
      const bus = getEventBus();

      const event1 = createMessageEvent('agent', { data: 'test1' }, DOMAINS.FAMILY);
      const event2 = createMessageEvent('agent', { data: 'test2' }, DOMAINS.WORK);
      const event3 = createMessageEvent('agent', { data: 'test3' }, DOMAINS.FAMILY);

      await bus.publish(event1);
      await bus.publish(event2);
      await bus.publish(event3);

      const familyEvents = bus.getEventsForDomain(DOMAINS.FAMILY, 10);
      expect(familyEvents).toHaveLength(2);
      expect(familyEvents[0].domain).toBe(DOMAINS.FAMILY);
      expect(familyEvents[1].domain).toBe(DOMAINS.FAMILY);
    });
  });

  describe('Statistics', () => {
    it('should return subscription stats', () => {
      const bus = getEventBus();

      bus.subscribe('domain.family', jest.fn(), 100, 'agent-1');
      bus.subscribe('domain.work', jest.fn(), 100, 'agent-2');
      bus.subscribe('*', jest.fn(), 100, 'agent-3');

      const stats = bus.getStats();
      expect(stats.patterns).toBe(3);
      expect(stats.totalSubscriptions).toBe(3);
    });

    it('should track recent events count', async () => {
      const bus = getEventBus();

      await bus.publish(createMessageEvent('agent', { data: 'test1' }));
      await bus.publish(createMessageEvent('agent', { data: 'test2' }));

      const stats = bus.getStats();
      expect(stats.recentEvents).toBe(2);
    });
  });

  describe('Event Validation', () => {
    it('should reject invalid events', async () => {
      const bus = getEventBus();

      const invalidEvent = {
        // Missing required fields
        id: 'test',
        type: 'message',
      } as AgentEvent;

      await expect(bus.publish(invalidEvent)).rejects.toThrow('Invalid event');
    });
  });

  describe('Helper Functions', () => {
    it('should generate unique event IDs', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('should create message events', () => {
      const event = createMessageEvent('agent', { text: 'hello' }, DOMAINS.FAMILY, 'high', 'corr-123');

      expect(event.type).toBe('message');
      expect(event.source).toBe('agent');
      expect(event.domain).toBe(DOMAINS.FAMILY);
      expect(event.priority).toBe('high');
      expect(event.correlationId).toBe('corr-123');
      expect(event.payload).toEqual({ text: 'hello' });
    });

    it('should create task events', () => {
      const event = createTaskEvent('agent', { task: 'do something' });

      expect(event.type).toBe('task');
      expect(event.source).toBe('agent');
    });

    it('should create notification events', () => {
      const event = createNotificationEvent('agent', { message: 'alert' });

      expect(event.type).toBe('notification');
      expect(event.source).toBe('agent');
    });

    it('should create escalation events', () => {
      const event = createEscalationEvent('agent', { issue: 'urgent' }, 'critical');

      expect(event.type).toBe('escalation');
      expect(event.priority).toBe('critical');
    });
  });

  describe('Correlation IDs', () => {
    it('should track related events with correlation IDs', async () => {
      const bus = getEventBus();
      const correlationId = 'task-123';

      const event1 = createTaskEvent('inbox', { action: 'start' }, DOMAINS.WORK, 'normal', correlationId);
      const event2 = createMessageEvent('pm', { status: 'processing' }, DOMAINS.WORK, 'normal', correlationId);
      const event3 = createNotificationEvent('pm', { status: 'complete' }, DOMAINS.WORK, 'normal', correlationId);

      await bus.publish(event1);
      await bus.publish(event2);
      await bus.publish(event3);

      const allEvents = bus.getRecentEvents(10);
      const relatedEvents = allEvents.filter(e => e.correlationId === correlationId);

      expect(relatedEvents).toHaveLength(3);
    });
  });
});
