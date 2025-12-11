// @ts-nocheck
/**
 * Wrath Shield v3 - LifeOS Event Bus Tests
 *
 * Tests for the pub/sub event bus system:
 * - Event publishing and subscription
 * - Pattern matching (wildcards, domains, types)
 * - Priority-based handler execution
 * - Event helpers
 */

import {
  LifeOSEventBus,
  getEventBus,
  resetEventBus,
  generateEventId,
  createMessageEvent,
  createTaskEvent,
  createNotificationEvent,
  createEscalationEvent,
  DOMAINS,
  type AgentEvent,
  type Domain,
} from '@/lib/agents/life-os-event-bus';

describe('LifeOS Event Bus', () => {
  let bus: LifeOSEventBus;

  beforeEach(() => {
    resetEventBus();
    bus = new LifeOSEventBus();
  });

  afterEach(() => {
    resetEventBus();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();
      expect(bus1).toBe(bus2);
    });

    it('should reset instance', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();
      expect(bus1).not.toBe(bus2);
    });
  });

  describe('subscribe', () => {
    it('should add subscription', () => {
      const handler = jest.fn();
      bus.subscribe('type.message', handler, 100, 'test-agent');

      const stats = bus.getStats();
      expect(stats.totalSubscriptions).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const handler = jest.fn();
      const unsubscribe = bus.subscribe('type.message', handler, 100, 'test-agent');

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe when called', () => {
      const handler = jest.fn();
      const unsubscribe = bus.subscribe('type.message', handler, 100, 'test-agent');

      unsubscribe();

      const stats = bus.getStats();
      expect(stats.totalSubscriptions).toBe(0);
    });

    it('should allow multiple subscriptions to same pattern', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      bus.subscribe('type.message', handler1, 100, 'agent-1');
      bus.subscribe('type.message', handler2, 50, 'agent-2');

      const stats = bus.getStats();
      expect(stats.totalSubscriptions).toBe(2);
    });
  });

  describe('publish', () => {
    it('should call matching handlers', async () => {
      const handler = jest.fn();
      bus.subscribe('type.message', handler, 100, 'test-agent');

      const event: AgentEvent = {
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: { text: 'Hello' },
        timestamp: new Date(),
      };

      await bus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not call non-matching handlers', async () => {
      const handler = jest.fn();
      bus.subscribe('type.task', handler, 100, 'test-agent'); // Subscribe to task

      const event: AgentEvent = {
        id: 'evt-1',
        type: 'message', // Publish message
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      };

      await bus.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should validate event has required fields', async () => {
      const invalidEvent = {
        // Missing id, type, source, priority
        payload: {},
      } as any;

      await expect(bus.publish(invalidEvent)).rejects.toThrow('Invalid event');
    });

    it('should add events to log', async () => {
      const event: AgentEvent = {
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      };

      await bus.publish(event);

      const recentEvents = bus.getRecentEvents(10);
      expect(recentEvents.length).toBe(1);
      expect(recentEvents[0].id).toBe('evt-1');
    });

    it('should call handlers in priority order', async () => {
      const callOrder: string[] = [];

      bus.subscribe('type.message', () => { callOrder.push('low'); }, 10, 'low-priority');
      bus.subscribe('type.message', () => { callOrder.push('high'); }, 100, 'high-priority');
      bus.subscribe('type.message', () => { callOrder.push('medium'); }, 50, 'medium-priority');

      const event: AgentEvent = {
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      };

      await bus.publish(event);

      expect(callOrder).toEqual(['high', 'medium', 'low']);
    });

    it('should continue to other handlers on error', async () => {
      const handler1 = jest.fn().mockRejectedValue(new Error('Handler 1 failed'));
      const handler2 = jest.fn();

      bus.subscribe('type.message', handler1, 100, 'agent-1');
      bus.subscribe('type.message', handler2, 50, 'agent-2');

      const event: AgentEvent = {
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      };

      await bus.publish(event);

      // Handler 2 should still be called
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Pattern Matching', () => {
    it('should match wildcard (*)', async () => {
      const handler = jest.fn();
      bus.subscribe('*', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should match type.X pattern', async () => {
      const handler = jest.fn();
      bus.subscribe('type.task', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'task',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should match domain.X pattern', async () => {
      const handler = jest.fn();
      bus.subscribe('domain.family', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        domain: 'family',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should match domain.X.* wildcard', async () => {
      const handler = jest.fn();
      bus.subscribe('domain.family.*', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        domain: 'family.hyro',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should not match domain.X.* when domain doesn\'t start with prefix', async () => {
      const handler = jest.fn();
      bus.subscribe('domain.work.*', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        domain: 'family.hyro',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should match escalation.* pattern', async () => {
      const handler = jest.fn();
      bus.subscribe('escalation.*', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'escalation',
        source: 'test',
        priority: 'critical',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should match priority.X pattern', async () => {
      const handler = jest.fn();
      bus.subscribe('priority.critical', handler, 100, 'test-agent');

      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'critical',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('publishToDomain', () => {
    it('should add domain to event', async () => {
      const handler = jest.fn();
      bus.subscribe('domain.family', handler, 100, 'test-agent');

      await bus.publishToDomain('family', {
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'family' })
      );
    });
  });

  describe('publishEscalation', () => {
    it('should create escalation event with critical priority', async () => {
      const handler = jest.fn();
      bus.subscribe('escalation.*', handler, 100, 'test-agent');

      await bus.publishEscalation('critical', {
        id: 'evt-1',
        source: 'test',
        payload: { issue: 'urgent' },
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'escalation',
          priority: 'critical',
        })
      );
    });

    it('should create escalation event with high priority for propose', async () => {
      const handler = jest.fn();
      bus.subscribe('escalation.*', handler, 100, 'test-agent');

      await bus.publishEscalation('propose', {
        id: 'evt-1',
        source: 'test',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' })
      );
    });

    it('should create escalation event with normal priority for auto_execute', async () => {
      const handler = jest.fn();
      bus.subscribe('escalation.*', handler, 100, 'test-agent');

      await bus.publishEscalation('auto_execute', {
        id: 'evt-1',
        source: 'test',
        payload: {},
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'normal' })
      );
    });
  });

  describe('Event Retrieval', () => {
    it('should get recent events', async () => {
      for (let i = 0; i < 5; i++) {
        await bus.publish({
          id: `evt-${i}`,
          type: 'message',
          source: 'test',
          priority: 'normal',
          payload: { num: i },
          timestamp: new Date(),
        });
      }

      const events = bus.getRecentEvents(3);
      expect(events.length).toBe(3);
    });

    it('should get events for agent', async () => {
      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'agent-a',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      await bus.publish({
        id: 'evt-2',
        type: 'message',
        source: 'agent-b',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      const events = bus.getEventsForAgent('agent-a', 10);
      expect(events.length).toBe(1);
      expect(events[0].source).toBe('agent-a');
    });

    it('should get events for domain', async () => {
      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        domain: 'family',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      await bus.publish({
        id: 'evt-2',
        type: 'message',
        source: 'test',
        domain: 'work',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      const events = bus.getEventsForDomain('family', 10);
      expect(events.length).toBe(1);
      expect(events[0].domain).toBe('family');
    });
  });

  describe('Stats', () => {
    it('should return correct stats', async () => {
      bus.subscribe('type.message', jest.fn(), 100, 'agent-1');
      bus.subscribe('type.task', jest.fn(), 100, 'agent-2');

      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      const stats = bus.getStats();

      expect(stats.patterns).toBe(2);
      expect(stats.totalSubscriptions).toBe(2);
      expect(stats.recentEvents).toBe(1);
    });
  });

  describe('Clear Methods', () => {
    it('should clear subscriptions', () => {
      bus.subscribe('type.message', jest.fn(), 100, 'test');
      bus.clearSubscriptions();

      const stats = bus.getStats();
      expect(stats.totalSubscriptions).toBe(0);
    });

    it('should clear event log', async () => {
      await bus.publish({
        id: 'evt-1',
        type: 'message',
        source: 'test',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      });

      bus.clearEventLog();

      const stats = bus.getStats();
      expect(stats.recentEvents).toBe(0);
    });
  });

  describe('Event Helpers', () => {
    describe('generateEventId', () => {
      it('should generate unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
          ids.add(generateEventId());
        }
        expect(ids.size).toBe(100);
      });

      it('should start with evt_ prefix', () => {
        const id = generateEventId();
        expect(id.startsWith('evt_')).toBe(true);
      });
    });

    describe('createMessageEvent', () => {
      it('should create message event', () => {
        const event = createMessageEvent('test-agent', { text: 'Hello' }, 'family', 'high');

        expect(event.id).toBeDefined();
        expect(event.type).toBe('message');
        expect(event.source).toBe('test-agent');
        expect(event.domain).toBe('family');
        expect(event.priority).toBe('high');
        expect(event.payload).toEqual({ text: 'Hello' });
        expect(event.timestamp).toBeInstanceOf(Date);
      });

      it('should use default priority', () => {
        const event = createMessageEvent('test', {});
        expect(event.priority).toBe('normal');
      });
    });

    describe('createTaskEvent', () => {
      it('should create task event', () => {
        const event = createTaskEvent('pm-agent', { title: 'Task 1' });

        expect(event.type).toBe('task');
      });
    });

    describe('createNotificationEvent', () => {
      it('should create notification event', () => {
        const event = createNotificationEvent('system', { message: 'Alert!' });

        expect(event.type).toBe('notification');
      });
    });

    describe('createEscalationEvent', () => {
      it('should create escalation event', () => {
        const event = createEscalationEvent('legal-agent', { issue: 'Review needed' }, 'critical');

        expect(event.type).toBe('escalation');
        expect(event.priority).toBe('critical');
      });
    });
  });

  describe('DOMAINS', () => {
    it('should export domain constants', () => {
      expect(DOMAINS.FAMILY).toBe('family');
      expect(DOMAINS.WORK).toBe('work');
      expect(DOMAINS.HEALTH).toBe('health');
      expect(DOMAINS.FINANCE).toBe('finance');
      expect(DOMAINS.LEARNING).toBe('learning');
      expect(DOMAINS.LEGAL).toBe('legal');
    });
  });
});
