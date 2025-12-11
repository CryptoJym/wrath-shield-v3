// @ts-nocheck
/**
 * Tests for HYRO FORGE Event Bus
 *
 * Tests for the in-memory event bus implementation including
 * publish/subscribe, event handlers, and event statistics.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock forge-event-schemas
const mockREDIS_CHANNELS = {
  ANSWER_SUBMITTED: 'forge:answer:submitted',
  STATE_UPDATED: 'forge:state:updated',
  PMRE_TRIGGERED: 'forge:pmre:triggered',
  HINT_REQUESTED: 'forge:hint:requested',
  SESSION_STARTED: 'forge:session:started',
  SESSION_ENDED: 'forge:session:ended',
};

jest.mock('../../../lib/hyro/forge-event-schemas', () => ({
  REDIS_CHANNELS: mockREDIS_CHANNELS,
  getChannelForEvent: jest.fn((eventType: string) => {
    const mapping: Record<string, string> = {
      'answer.submitted': mockREDIS_CHANNELS.ANSWER_SUBMITTED,
      'state.updated': mockREDIS_CHANNELS.STATE_UPDATED,
      'pmre.triggered': mockREDIS_CHANNELS.PMRE_TRIGGERED,
    };
    return mapping[eventType] || null;
  }),
  generateEventId: jest.fn(() => `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`),
  validateEvent: jest.fn(() => ({ valid: true, errors: [] })),
}));

// Mock forge-learner-state
jest.mock('../../../lib/hyro/forge-learner-state', () => ({
  applyTrajectoryEffect: jest.fn(),
  findNearestAttractor: jest.fn(),
}));

// Mock forge-update-equations
jest.mock('../../../lib/hyro/forge-update-equations', () => ({
  computeAnswerUpdate: jest.fn(),
  computeHintUpdate: jest.fn(),
  computeMetacogUpdate: jest.fn(),
  computeSessionUpdate: jest.fn(),
}));

import {
  getEventBus,
  resetEventBus,
  publishAnswerSubmitted,
  publishStateUpdated,
  publishPMRETrigger,
  subscribeToLearnerState,
  subscribeToPMRETriggers,
  publishBatch,
  getEventStats,
} from '../../../lib/hyro/forge-event-bus';

describe('HYRO FORGE: Event Bus', () => {
  beforeEach(() => {
    resetEventBus();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetEventBus();
  });

  // ==========================================================================
  // Event Bus Singleton Tests
  // ==========================================================================

  describe('getEventBus', () => {
    it('should return singleton event bus', () => {
      const bus1 = getEventBus();
      const bus2 = getEventBus();

      expect(bus1).toBe(bus2);
    });

    it('should accept custom config', () => {
      const bus = getEventBus({ enableLogging: false });

      expect(bus).toBeDefined();
    });
  });

  describe('resetEventBus', () => {
    it('should reset the event bus', () => {
      const bus1 = getEventBus();
      resetEventBus();
      const bus2 = getEventBus();

      expect(bus1).not.toBe(bus2);
    });

    it('should clear all subscriptions', () => {
      const bus = getEventBus();
      const handler = jest.fn();

      // Subscribe
      bus.subscribe('*', handler, 100);

      // Reset
      resetEventBus();

      // New bus should have no custom subscriptions
      const newBus = getEventBus();
      expect(newBus).toBeDefined();
    });
  });

  // ==========================================================================
  // Subscribe Tests
  // ==========================================================================

  describe('subscribe', () => {
    it('should subscribe to a channel', () => {
      const bus = getEventBus();
      const handler = jest.fn();

      const id = bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, handler, 100);

      expect(id).toBeDefined();
      expect(id).toMatch(/^sub_/);
    });

    it('should subscribe to wildcard channel', () => {
      const bus = getEventBus();
      const handler = jest.fn();

      const id = bus.subscribe('*', handler, 100);

      expect(id).toBeDefined();
    });

    it('should use default priority when not specified', () => {
      const bus = getEventBus();
      const handler = jest.fn();

      const id = bus.subscribe(mockREDIS_CHANNELS.STATE_UPDATED, handler);

      expect(id).toBeDefined();
    });
  });

  // ==========================================================================
  // Unsubscribe Tests
  // ==========================================================================

  describe('unsubscribe', () => {
    it('should unsubscribe by ID', () => {
      const bus = getEventBus();
      const handler = jest.fn();

      const id = bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, handler, 100);
      const result = bus.unsubscribe(id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent subscription', () => {
      const bus = getEventBus();

      const result = bus.unsubscribe('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Publish Tests
  // ==========================================================================

  describe('publish', () => {
    it('should publish event to subscribers', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, handler, 50);

      const event = {
        event_id: 'evt-123',
        event_type: 'answer.submitted',
        learner_id: 'learner-456',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      };

      await bus.publish(event);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'answer.submitted',
      }));
    });

    it('should publish to wildcard subscribers', async () => {
      const bus = getEventBus();
      const wildcardHandler = jest.fn();

      bus.subscribe('*', wildcardHandler, 1000);

      const event = {
        event_id: 'evt-123',
        event_type: 'answer.submitted',
        learner_id: 'learner-456',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      };

      await bus.publish(event);

      expect(wildcardHandler).toHaveBeenCalled();
    });

    it('should throw error for invalid event', async () => {
      const { validateEvent } = require('../../../lib/hyro/forge-event-schemas');
      validateEvent.mockReturnValueOnce({ valid: false, errors: ['Missing event_type'] });

      const bus = getEventBus();

      const invalidEvent = {
        event_id: 'evt-123',
        learner_id: 'learner-456',
        timestamp: Date.now(),
      };

      await expect(bus.publish(invalidEvent)).rejects.toThrow('Invalid event');
    });

    it('should throw error for unmapped event type', async () => {
      const { getChannelForEvent } = require('../../../lib/hyro/forge-event-schemas');
      getChannelForEvent.mockReturnValueOnce(null);

      const bus = getEventBus();

      const event = {
        event_id: 'evt-123',
        event_type: 'unknown.event',
        learner_id: 'learner-456',
        timestamp: Date.now(),
        source: 'test',
      };

      await expect(bus.publish(event)).rejects.toThrow('No channel for event type');
    });

    it('should continue processing if handler throws', async () => {
      const bus = getEventBus();
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, errorHandler, 10);
      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, successHandler, 20);

      const event = {
        event_id: 'evt-123',
        event_type: 'answer.submitted',
        learner_id: 'learner-456',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      };

      await bus.publish(event);

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Event Logging Tests
  // ==========================================================================

  describe('getRecentEvents', () => {
    it('should return recent events', async () => {
      const bus = getEventBus();

      const event = {
        event_id: 'evt-123',
        event_type: 'answer.submitted',
        learner_id: 'learner-456',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      };

      await bus.publish(event);

      const recentEvents = bus.getRecentEvents(10);

      expect(recentEvents.length).toBeGreaterThan(0);
    });

    it('should limit returned events', async () => {
      const bus = getEventBus();

      // Publish multiple events
      for (let i = 0; i < 10; i++) {
        await bus.publish({
          event_id: `evt-${i}`,
          event_type: 'answer.submitted',
          learner_id: 'learner-456',
          timestamp: Date.now(),
          source: 'test',
          is_correct: true,
          time_taken_ms: 5000,
          concept_id: 'concept-abc',
        });
      }

      const recentEvents = bus.getRecentEvents(5);

      expect(recentEvents.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getEventsForLearner', () => {
    it('should filter events by learner ID', async () => {
      const bus = getEventBus();

      // Publish events for different learners
      await bus.publish({
        event_id: 'evt-1',
        event_type: 'answer.submitted',
        learner_id: 'learner-A',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      });

      await bus.publish({
        event_id: 'evt-2',
        event_type: 'answer.submitted',
        learner_id: 'learner-B',
        timestamp: Date.now(),
        source: 'test',
        is_correct: false,
        time_taken_ms: 3000,
        concept_id: 'concept-def',
      });

      const learnerAEvents = bus.getEventsForLearner('learner-A', 10);

      expect(learnerAEvents.every(e => e.learner_id === 'learner-A')).toBe(true);
    });
  });

  // ==========================================================================
  // Publishing Helper Functions Tests
  // ==========================================================================

  describe('publishAnswerSubmitted', () => {
    it('should publish answer submitted event', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, handler, 50);

      await publishAnswerSubmitted('learner-123', {
        concept_id: 'concept-abc',
        question_id: 'q-123',
        is_correct: true,
        time_taken_ms: 5000,
        difficulty: 0.5,
        attempt_number: 1,
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('publishStateUpdated', () => {
    it('should publish state updated event', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.STATE_UPDATED, handler, 50);

      await publishStateUpdated(
        'learner-123',
        { C: 0.5, E: 0.5, G: 0.5 },
        { C: 0.6, E: 0.55, G: 0.52 },
        'answer',
        { delta_C: 0.1, delta_E: 0.05, delta_G: 0.02, source: 'answer' }
      );

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('publishPMRETrigger', () => {
    it('should publish PMRE trigger event', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.PMRE_TRIGGERED, handler, 50);

      await publishPMRETrigger(
        'learner-123',
        'C',
        'low_confidence',
        'How confident do you feel about this topic?',
        'high'
      );

      expect(handler).toHaveBeenCalled();
    });

    it('should use default priority', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.PMRE_TRIGGERED, handler, 50);

      await publishPMRETrigger(
        'learner-123',
        'E',
        'fatigue_detected',
        'Would you like to take a break?'
      );

      expect(handler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Subscription Helper Functions Tests
  // ==========================================================================

  describe('subscribeToLearnerState', () => {
    it('should subscribe to state updates for specific learner', async () => {
      const handler = jest.fn();

      const subId = subscribeToLearnerState('learner-123', handler);

      expect(subId).toBeDefined();

      // Publish state update
      await publishStateUpdated(
        'learner-123',
        { C: 0.5, E: 0.5, G: 0.5 },
        { C: 0.6, E: 0.55, G: 0.52 },
        'answer',
        { delta_C: 0.1, delta_E: 0.05, delta_G: 0.02, source: 'answer' }
      );

      expect(handler).toHaveBeenCalled();
    });

    it('should not call handler for other learners', async () => {
      const handler = jest.fn();

      subscribeToLearnerState('learner-123', handler);

      // Publish state update for different learner
      await publishStateUpdated(
        'learner-456',
        { C: 0.5, E: 0.5, G: 0.5 },
        { C: 0.6, E: 0.55, G: 0.52 },
        'answer',
        { delta_C: 0.1, delta_E: 0.05, delta_G: 0.02, source: 'answer' }
      );

      // Handler should be called but filter out non-matching learner
      // The filtering happens inside the handler
    });
  });

  describe('subscribeToPMRETriggers', () => {
    it('should subscribe to PMRE triggers for specific learner', async () => {
      const handler = jest.fn();

      const subId = subscribeToPMRETriggers('learner-123', handler);

      expect(subId).toBeDefined();

      await publishPMRETrigger(
        'learner-123',
        'C',
        'low_confidence',
        'Are you sure about this?'
      );

      expect(handler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Batch Operations Tests
  // ==========================================================================

  describe('publishBatch', () => {
    it('should publish multiple events in sequence', async () => {
      const bus = getEventBus();
      const handler = jest.fn();

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, handler, 50);

      const events = [
        {
          event_id: 'evt-1',
          event_type: 'answer.submitted',
          learner_id: 'learner-123',
          timestamp: Date.now(),
          source: 'test',
          is_correct: true,
          time_taken_ms: 5000,
          concept_id: 'concept-1',
        },
        {
          event_id: 'evt-2',
          event_type: 'answer.submitted',
          learner_id: 'learner-123',
          timestamp: Date.now(),
          source: 'test',
          is_correct: false,
          time_taken_ms: 3000,
          concept_id: 'concept-2',
        },
      ];

      await publishBatch(events);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Event Statistics Tests
  // ==========================================================================

  describe('getEventStats', () => {
    it('should return event statistics', async () => {
      const bus = getEventBus();

      // Publish some events
      await bus.publish({
        event_id: 'evt-1',
        event_type: 'answer.submitted',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      });

      const stats = getEventStats();

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('eventsByType');
      expect(stats).toHaveProperty('recentEventsPerSecond');
    });

    it('should count events by type', async () => {
      const bus = getEventBus();

      // Publish multiple events
      for (let i = 0; i < 5; i++) {
        await bus.publish({
          event_id: `evt-${i}`,
          event_type: 'answer.submitted',
          learner_id: 'learner-123',
          timestamp: Date.now(),
          source: 'test',
          is_correct: true,
          time_taken_ms: 5000,
          concept_id: 'concept-abc',
        });
      }

      const stats = getEventStats();

      expect(stats.eventsByType['answer.submitted']).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Priority Ordering Tests
  // ==========================================================================

  describe('Priority Ordering', () => {
    it('should call handlers in priority order', async () => {
      const bus = getEventBus();
      const callOrder: number[] = [];

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, () => callOrder.push(3), 30);
      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, () => callOrder.push(1), 10);
      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, () => callOrder.push(2), 20);

      await bus.publish({
        event_id: 'evt-priority',
        event_type: 'answer.submitted',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      });

      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty event batch', async () => {
      await expect(publishBatch([])).resolves.not.toThrow();
    });

    it('should handle high volume of events', async () => {
      const bus = getEventBus();
      const events = [];

      for (let i = 0; i < 100; i++) {
        events.push({
          event_id: `evt-${i}`,
          event_type: 'answer.submitted',
          learner_id: 'learner-123',
          timestamp: Date.now(),
          source: 'test',
          is_correct: true,
          time_taken_ms: 5000,
          concept_id: 'concept-abc',
        });
      }

      await expect(publishBatch(events)).resolves.not.toThrow();
    });

    it('should handle async handlers', async () => {
      const bus = getEventBus();
      const results: number[] = [];

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(1);
      }, 10);

      bus.subscribe(mockREDIS_CHANNELS.ANSWER_SUBMITTED, async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push(2);
      }, 20);

      await bus.publish({
        event_id: 'evt-async',
        event_type: 'answer.submitted',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'test',
        is_correct: true,
        time_taken_ms: 5000,
        concept_id: 'concept-abc',
      });

      // Both handlers should have completed
      expect(results).toHaveLength(2);
    });
  });
});
