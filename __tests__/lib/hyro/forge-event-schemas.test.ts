// @ts-nocheck
/**
 * Tests for forge-event-schemas.ts
 * Event schemas and Redis channel definitions for real-time adaptive learning
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

import {
  HYRO_CHANNEL_PREFIX,
  REDIS_CHANNELS,
  generateEventId,
  createBaseEvent,
  getChannelForEvent,
  validateEvent,
  // Types
  type BaseEvent,
  type AnswerSubmittedEvent,
  type HintRequestedEvent,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type MetacogRespondedEvent,
  type StateUpdatedEvent,
  type AttractorChangedEvent,
  type MasteryUpdatedEvent,
  type PathUpdatedEvent,
  type ContentSelectedEvent,
  type PMRETriggeredEvent,
  type CalibrationRecordedEvent,
  type ConceptLinkedEvent,
  type MisconceptionDetectedEvent,
  type PrerequisiteGapEvent,
  type ExperimentStartedEvent,
  type ExperimentConcludedEvent,
  type ParameterChangedEvent,
  type SystemAlertEvent,
  type HyroEvent,
  type RedisChannel,
} from '@/lib/hyro/forge-event-schemas';

// ============================================================================
// Channel Constants Tests
// ============================================================================

describe('Redis channel constants', () => {
  describe('HYRO_CHANNEL_PREFIX', () => {
    it('should have the correct prefix', () => {
      expect(HYRO_CHANNEL_PREFIX).toBe('hyro:forge:');
    });
  });

  describe('REDIS_CHANNELS', () => {
    it('should define all core learning event channels', () => {
      expect(REDIS_CHANNELS.ANSWER_SUBMITTED).toBe('hyro:forge:answer.submitted');
      expect(REDIS_CHANNELS.HINT_REQUESTED).toBe('hyro:forge:hint.requested');
      expect(REDIS_CHANNELS.SESSION_STARTED).toBe('hyro:forge:session.started');
      expect(REDIS_CHANNELS.SESSION_ENDED).toBe('hyro:forge:session.ended');
      expect(REDIS_CHANNELS.METACOG_RESPONDED).toBe('hyro:forge:metacog.prompt_responded');
    });

    it('should define all state update channels', () => {
      expect(REDIS_CHANNELS.STATE_UPDATED).toBe('hyro:forge:state.updated');
      expect(REDIS_CHANNELS.ATTRACTOR_CHANGED).toBe('hyro:forge:attractor.changed');
      expect(REDIS_CHANNELS.MASTERY_UPDATED).toBe('hyro:forge:mastery.updated');
    });

    it('should define all path planning channels', () => {
      expect(REDIS_CHANNELS.PATH_UPDATED).toBe('hyro:forge:path.updated');
      expect(REDIS_CHANNELS.CONTENT_SELECTED).toBe('hyro:forge:content.selected');
    });

    it('should define all metacognition channels', () => {
      expect(REDIS_CHANNELS.PMRE_TRIGGERED).toBe('hyro:forge:pmre.triggered');
      expect(REDIS_CHANNELS.CALIBRATION_RECORDED).toBe('hyro:forge:calibration.recorded');
    });

    it('should define all knowledge graph channels', () => {
      expect(REDIS_CHANNELS.CONCEPT_LINKED).toBe('hyro:forge:graph.concept_linked');
      expect(REDIS_CHANNELS.MISCONCEPTION_DETECTED).toBe('hyro:forge:graph.misconception_detected');
      expect(REDIS_CHANNELS.PREREQUISITE_GAP).toBe('hyro:forge:graph.prerequisite_gap');
    });

    it('should define all HGM channels', () => {
      expect(REDIS_CHANNELS.EXPERIMENT_STARTED).toBe('hyro:forge:hgm.experiment_started');
      expect(REDIS_CHANNELS.EXPERIMENT_CONCLUDED).toBe('hyro:forge:hgm.experiment_concluded');
      expect(REDIS_CHANNELS.PARAMETER_CHANGED).toBe('hyro:forge:hgm.parameter_changed');
    });

    it('should define admin/debug channels', () => {
      expect(REDIS_CHANNELS.SYSTEM_ALERT).toBe('hyro:forge:system.alert');
      expect(REDIS_CHANNELS.DEBUG_LOG).toBe('hyro:forge:debug.log');
    });

    it('should have all channels prefixed correctly', () => {
      Object.values(REDIS_CHANNELS).forEach((channel) => {
        expect(channel).toMatch(/^hyro:forge:/);
      });
    });
  });
});

// ============================================================================
// generateEventId Tests
// ============================================================================

describe('generateEventId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateEventId();
    const id2 = generateEventId();
    const id3 = generateEventId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('should start with evt_ prefix', () => {
    const id = generateEventId();
    expect(id).toMatch(/^evt_/);
  });

  it('should have consistent format', () => {
    const id = generateEventId();
    // evt_<timestamp>_<random>
    expect(id).toMatch(/^evt_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('should generate many unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateEventId());
    }
    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// createBaseEvent Tests
// ============================================================================

describe('createBaseEvent', () => {
  it('should create event with required fields', () => {
    const event = createBaseEvent('answer.submitted', 'learner-123');

    expect(event.event_id).toBeDefined();
    expect(event.event_type).toBe('answer.submitted');
    expect(event.learner_id).toBe('learner-123');
    expect(event.timestamp).toBeDefined();
    expect(event.source).toBe('server');
  });

  it('should use default source of server', () => {
    const event = createBaseEvent('test.event', 'learner-123');
    expect(event.source).toBe('server');
  });

  it('should allow custom source', () => {
    const event = createBaseEvent('test.event', 'learner-123', 'client');
    expect(event.source).toBe('client');
  });

  it('should allow HGM source', () => {
    const event = createBaseEvent('hgm.experiment_started', 'learner-123', 'hgm');
    expect(event.source).toBe('hgm');
  });

  it('should allow scheduler source', () => {
    const event = createBaseEvent('session.reminder', 'learner-123', 'scheduler');
    expect(event.source).toBe('scheduler');
  });

  it('should include session_id when provided', () => {
    const event = createBaseEvent('answer.submitted', 'learner-123', 'server', 'session-456');
    expect(event.session_id).toBe('session-456');
  });

  it('should have undefined session_id when not provided', () => {
    const event = createBaseEvent('answer.submitted', 'learner-123');
    expect(event.session_id).toBeUndefined();
  });

  it('should have timestamp close to current time', () => {
    const before = Date.now();
    const event = createBaseEvent('test.event', 'learner-123');
    const after = Date.now();

    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// getChannelForEvent Tests
// ============================================================================

describe('getChannelForEvent', () => {
  it('should return correct channel for answer.submitted', () => {
    expect(getChannelForEvent('answer.submitted')).toBe(REDIS_CHANNELS.ANSWER_SUBMITTED);
  });

  it('should return correct channel for hint.requested', () => {
    expect(getChannelForEvent('hint.requested')).toBe(REDIS_CHANNELS.HINT_REQUESTED);
  });

  it('should return correct channel for session events', () => {
    expect(getChannelForEvent('session.started')).toBe(REDIS_CHANNELS.SESSION_STARTED);
    expect(getChannelForEvent('session.ended')).toBe(REDIS_CHANNELS.SESSION_ENDED);
  });

  it('should return correct channel for metacog events', () => {
    expect(getChannelForEvent('metacog.prompt_responded')).toBe(REDIS_CHANNELS.METACOG_RESPONDED);
  });

  it('should return correct channel for state events', () => {
    expect(getChannelForEvent('state.updated')).toBe(REDIS_CHANNELS.STATE_UPDATED);
    expect(getChannelForEvent('attractor.changed')).toBe(REDIS_CHANNELS.ATTRACTOR_CHANGED);
    expect(getChannelForEvent('mastery.updated')).toBe(REDIS_CHANNELS.MASTERY_UPDATED);
  });

  it('should return correct channel for path events', () => {
    expect(getChannelForEvent('path.updated')).toBe(REDIS_CHANNELS.PATH_UPDATED);
    expect(getChannelForEvent('content.selected')).toBe(REDIS_CHANNELS.CONTENT_SELECTED);
  });

  it('should return correct channel for PMRE events', () => {
    expect(getChannelForEvent('pmre.triggered')).toBe(REDIS_CHANNELS.PMRE_TRIGGERED);
    expect(getChannelForEvent('calibration.recorded')).toBe(REDIS_CHANNELS.CALIBRATION_RECORDED);
  });

  it('should return correct channel for graph events', () => {
    expect(getChannelForEvent('graph.concept_linked')).toBe(REDIS_CHANNELS.CONCEPT_LINKED);
    expect(getChannelForEvent('graph.misconception_detected')).toBe(REDIS_CHANNELS.MISCONCEPTION_DETECTED);
    expect(getChannelForEvent('graph.prerequisite_gap')).toBe(REDIS_CHANNELS.PREREQUISITE_GAP);
  });

  it('should return correct channel for HGM events', () => {
    expect(getChannelForEvent('hgm.experiment_started')).toBe(REDIS_CHANNELS.EXPERIMENT_STARTED);
    expect(getChannelForEvent('hgm.experiment_concluded')).toBe(REDIS_CHANNELS.EXPERIMENT_CONCLUDED);
    expect(getChannelForEvent('hgm.parameter_changed')).toBe(REDIS_CHANNELS.PARAMETER_CHANGED);
  });

  it('should return correct channel for system events', () => {
    expect(getChannelForEvent('system.alert')).toBe(REDIS_CHANNELS.SYSTEM_ALERT);
  });

  it('should return null for unknown event types', () => {
    expect(getChannelForEvent('unknown.event')).toBeNull();
    expect(getChannelForEvent('')).toBeNull();
    expect(getChannelForEvent('random')).toBeNull();
  });
});

// ============================================================================
// validateEvent Tests
// ============================================================================

describe('validateEvent', () => {
  it('should validate a complete event', () => {
    const event: HyroEvent = {
      event_id: 'evt_123',
      event_type: 'answer.submitted',
      learner_id: 'learner-123',
      timestamp: Date.now(),
      source: 'client',
      question_id: 'q1',
      concept_id: 'c1',
      answer: 'A',
      is_correct: true,
      time_taken_ms: 5000,
      attempt_number: 1,
      difficulty: 0.5,
    } as AnswerSubmittedEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing event_id', () => {
    const event = {
      event_type: 'test',
      learner_id: 'learner-123',
      timestamp: Date.now(),
      source: 'server',
    } as HyroEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing event_id');
  });

  it('should detect missing event_type', () => {
    const event = {
      event_id: 'evt_123',
      learner_id: 'learner-123',
      timestamp: Date.now(),
      source: 'server',
    } as HyroEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing event_type');
  });

  it('should detect missing learner_id', () => {
    const event = {
      event_id: 'evt_123',
      event_type: 'test',
      timestamp: Date.now(),
      source: 'server',
    } as HyroEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing learner_id');
  });

  it('should detect missing timestamp', () => {
    const event = {
      event_id: 'evt_123',
      event_type: 'test',
      learner_id: 'learner-123',
      source: 'server',
    } as HyroEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing timestamp');
  });

  it('should detect missing source', () => {
    const event = {
      event_id: 'evt_123',
      event_type: 'test',
      learner_id: 'learner-123',
      timestamp: Date.now(),
    } as HyroEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing source');
  });

  it('should collect all validation errors', () => {
    const event = {} as HyroEvent;

    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

// ============================================================================
// Event Type Tests
// ============================================================================

describe('event type definitions', () => {
  describe('AnswerSubmittedEvent', () => {
    it('should have correct structure', () => {
      const event: AnswerSubmittedEvent = {
        event_id: 'evt_123',
        event_type: 'answer.submitted',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'client',
        question_id: 'q1',
        concept_id: 'c1',
        answer: 'B',
        is_correct: true,
        time_taken_ms: 5000,
        attempt_number: 1,
        difficulty: 0.5,
      };

      expect(event.event_type).toBe('answer.submitted');
      expect(event.question_id).toBeDefined();
      expect(event.is_correct).toBeDefined();
    });
  });

  describe('SessionStartedEvent', () => {
    it('should have correct structure', () => {
      const event: SessionStartedEvent = {
        event_id: 'evt_123',
        event_type: 'session.started',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'server',
        config: {
          domain: 'math',
          mode: 'practice',
        },
        initial_state: {
          C: 50,
          E: 50,
          G: 50,
        },
      };

      expect(event.event_type).toBe('session.started');
      expect(event.config.domain).toBe('math');
      expect(event.initial_state.C).toBeDefined();
    });
  });

  describe('SessionEndedEvent', () => {
    it('should have correct structure', () => {
      const event: SessionEndedEvent = {
        event_id: 'evt_123',
        event_type: 'session.ended',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'server',
        summary: {
          duration_minutes: 30,
          questions_attempted: 20,
          questions_correct: 15,
          hints_used: 3,
          concepts_practiced: ['algebra', 'fractions'],
          xp_earned: 250,
        },
        final_state: { C: 55, E: 48, G: 52 },
        state_delta: { delta_C: 5, delta_E: -2, delta_G: 2 },
      };

      expect(event.summary.duration_minutes).toBe(30);
      expect(event.state_delta.delta_C).toBe(5);
    });
  });

  describe('PMRETriggeredEvent', () => {
    it('should have correct structure', () => {
      const event: PMRETriggeredEvent = {
        event_id: 'evt_123',
        event_type: 'pmre.triggered',
        learner_id: 'learner-123',
        timestamp: Date.now(),
        source: 'server',
        dimension: 'monitoring',
        trigger_reason: 'multiple_errors',
        suggested_prompt: 'What strategy are you using?',
        priority: 'high',
      };

      expect(event.dimension).toBe('monitoring');
      expect(event.trigger_reason).toBe('multiple_errors');
    });
  });

  describe('ExperimentConcludedEvent', () => {
    it('should have correct structure', () => {
      const event: ExperimentConcludedEvent = {
        event_id: 'evt_123',
        event_type: 'hgm.experiment_concluded',
        learner_id: 'system',
        timestamp: Date.now(),
        source: 'hgm',
        experiment_id: 'exp_123',
        results: {
          p_value: 0.005,
          cohens_d: 0.9,
          control_mean: 0.65,
          treatment_mean: 0.72,
          sample_size: 100,
        },
        decision: 'adopt',
        auto_applied: true,
        requires_review: false,
      };

      expect(event.results.p_value).toBe(0.005);
      expect(event.decision).toBe('adopt');
    });
  });

  describe('SystemAlertEvent', () => {
    it('should have correct structure', () => {
      const event: SystemAlertEvent = {
        event_id: 'evt_123',
        event_type: 'system.alert',
        learner_id: 'system',
        timestamp: Date.now(),
        source: 'server',
        severity: 'warning',
        message: 'High load detected',
        context: { cpu: 90, memory: 85 },
      };

      expect(event.severity).toBe('warning');
      expect(event.context?.cpu).toBe(90);
    });
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('type safety', () => {
  it('should enforce source types', () => {
    const validSources: Array<BaseEvent['source']> = ['client', 'server', 'hgm', 'scheduler'];
    validSources.forEach((source) => {
      const event = createBaseEvent('test', 'learner-123', source);
      expect(event.source).toBe(source);
    });
  });

  it('should enforce PMRE dimensions', () => {
    const validDimensions: Array<PMRETriggeredEvent['dimension']> = [
      'planning',
      'monitoring',
      'regulation',
      'evaluation',
    ];

    validDimensions.forEach((dim) => {
      const event: Partial<PMRETriggeredEvent> = { dimension: dim };
      expect(event.dimension).toBe(dim);
    });
  });

  it('should enforce trigger reasons', () => {
    const validReasons: Array<PMRETriggeredEvent['trigger_reason']> = [
      'session_start',
      'long_hesitation',
      'multiple_errors',
      'answer_submitted',
      'session_end',
      'calibration_poor',
      'attractor_shift',
    ];

    validReasons.forEach((reason) => {
      const event: Partial<PMRETriggeredEvent> = { trigger_reason: reason };
      expect(event.trigger_reason).toBe(reason);
    });
  });

  it('should enforce experiment decisions', () => {
    const validDecisions: Array<ExperimentConcludedEvent['decision']> = [
      'adopt',
      'reject',
      'inconclusive',
    ];

    validDecisions.forEach((decision) => {
      const event: Partial<ExperimentConcludedEvent> = { decision };
      expect(event.decision).toBe(decision);
    });
  });
});
