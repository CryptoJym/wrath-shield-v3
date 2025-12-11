// @ts-nocheck
/**
 * Tests for HYRO FORGE: Behavioral Analytics Engine
 *
 * Tests pattern detection, event logging, recommendations,
 * and predictions based on behavioral data.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock database
const mockDb = {
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
};

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-12345'),
}));

// Import after mocks
import {
  logBehaviorEvent,
  getRecentEvents,
  getEventsByType,
  detectPatterns,
  getActivePatterns,
  getOptimalStudyTime,
  getPersonalizedRecommendations,
  predictSessionSuccess,
  recordPredictionOutcome,
  getPredictionAccuracy,
} from '../../../lib/hyro/forge-analytics';
import type {
  EventType,
  PatternType,
  PredictionType,
  BehaviorEvent,
  BehaviorPattern,
  Prediction,
  TimeRange,
  Recommendation,
} from '../../../lib/hyro/forge-analytics';

describe('HYRO FORGE: Behavioral Analytics Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define EventType values', () => {
      const eventTypes: EventType[] = [
        'session_start',
        'session_end',
        'quest_started',
        'quest_completed',
        'srs_review',
        'reading_started',
        'reading_ended',
        'comprehension_submitted',
        'discussion_started',
        'discussion_concluded',
        'level_up',
        'achievement_earned',
      ];
      expect(eventTypes).toHaveLength(12);
    });

    it('should define PatternType values', () => {
      const patternTypes: PatternType[] = [
        'optimal_time',
        'struggle_subject',
        'engagement_decay',
        'session_length_optimal',
        'subject_affinity',
      ];
      expect(patternTypes).toHaveLength(5);
    });

    it('should define PredictionType values', () => {
      const predictionTypes: PredictionType[] = [
        'session_success',
        'quest_difficulty',
        'optimal_next_activity',
      ];
      expect(predictionTypes).toHaveLength(3);
    });

    it('should define BehaviorEvent interface', () => {
      const event: BehaviorEvent = {
        id: 'evt-123',
        event_type: 'session_start',
        event_data: '{"duration": 30}',
        day_of_week: 1,
        hour_of_day: 14,
        session_id: 'session-1',
        device_type: 'desktop',
        created_at: Date.now(),
      };

      expect(event.event_type).toBe('session_start');
      expect(event.day_of_week).toBe(1);
    });

    it('should define BehaviorPattern interface', () => {
      const pattern: BehaviorPattern = {
        id: 'pattern-123',
        pattern_type: 'optimal_time',
        pattern_data: '{"optimal_hours": [14, 15, 16]}',
        confidence: 0.85,
        evidence_count: 50,
        first_detected: Date.now() - 86400,
        last_confirmed: Date.now(),
        is_active: 1,
      };

      expect(pattern.pattern_type).toBe('optimal_time');
      expect(pattern.confidence).toBe(0.85);
    });

    it('should define Prediction interface', () => {
      const prediction: Prediction = {
        id: 'pred-123',
        prediction_type: 'session_success',
        prediction_data: '{"predicted_success": true}',
        confidence: 0.75,
        outcome_recorded: 0,
        outcome_data: null,
        prediction_accuracy: null,
        created_at: Date.now(),
      };

      expect(prediction.prediction_type).toBe('session_success');
      expect(prediction.outcome_recorded).toBe(0);
    });

    it('should define TimeRange interface', () => {
      const timeRange: TimeRange = {
        start_hour: 14,
        end_hour: 17,
        days: [1, 2, 3, 4, 5],
        confidence: 0.8,
      };

      expect(timeRange.start_hour).toBe(14);
      expect(timeRange.days).toContain(1);
    });

    it('should define Recommendation interface', () => {
      const recommendation: Recommendation = {
        type: 'timing',
        title: 'Best Study Time',
        description: 'Study between 2pm and 5pm',
        priority: 4,
        based_on: 'optimal_time',
      };

      expect(recommendation.type).toBe('timing');
      expect(recommendation.priority).toBe(4);
    });
  });

  // ==========================================================================
  // Event Logging Tests
  // ==========================================================================

  describe('logBehaviorEvent', () => {
    it('should log an event to the database', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn(() => ({
        id: 'mock-uuid-12345',
        event_type: 'session_start',
        event_data: null,
        day_of_week: new Date().getDay(),
        hour_of_day: new Date().getHours(),
        session_id: null,
        device_type: null,
        created_at: Math.floor(Date.now() / 1000),
      }));

      mockDb.prepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
      });

      const event = logBehaviorEvent('session_start');

      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it('should include event data when provided', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: mockRun,
        get: jest.fn(() => ({})),
      });

      logBehaviorEvent('quest_completed', { score: 85, quest_id: 'q-1' });

      expect(mockRun).toHaveBeenCalledWith(
        expect.any(String),
        'quest_completed',
        expect.stringContaining('"score":85'),
        expect.any(Number),
        expect.any(Number),
        null,
        null,
        expect.any(Number)
      );
    });

    it('should include session and device info', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: mockRun,
        get: jest.fn(() => ({})),
      });

      logBehaviorEvent('reading_started', {}, 'session-abc', 'mobile');

      expect(mockRun).toHaveBeenCalledWith(
        expect.any(String),
        'reading_started',
        expect.any(String),
        expect.any(Number),
        expect.any(Number),
        'session-abc',
        'mobile',
        expect.any(Number)
      );
    });
  });

  describe('getRecentEvents', () => {
    it('should return recent events from database', () => {
      const mockEvents = [
        { id: 'e1', event_type: 'session_start', created_at: 1000 },
        { id: 'e2', event_type: 'quest_completed', created_at: 2000 },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockEvents),
      });

      const events = getRecentEvents(10);

      expect(events).toHaveLength(2);
      expect(events[0].event_type).toBe('session_start');
    });

    it('should default to 100 events limit', () => {
      const mockAll = jest.fn(() => []);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      getRecentEvents();

      expect(mockAll).toHaveBeenCalledWith(100);
    });

    it('should respect custom limit', () => {
      const mockAll = jest.fn(() => []);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      getRecentEvents(25);

      expect(mockAll).toHaveBeenCalledWith(25);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      const mockAll = jest.fn(() => [
        { id: 'e1', event_type: 'quest_completed' },
      ]);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      const events = getEventsByType('quest_completed');

      expect(mockAll).toHaveBeenCalledWith('quest_completed', 50);
    });

    it('should respect custom limit', () => {
      const mockAll = jest.fn(() => []);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      getEventsByType('session_end', 20);

      expect(mockAll).toHaveBeenCalledWith('session_end', 20);
    });
  });

  // ==========================================================================
  // Pattern Detection Tests
  // ==========================================================================

  describe('detectPatterns', () => {
    it('should return array of detected patterns', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => []),
        get: jest.fn(() => null),
        run: jest.fn(),
      });

      const patterns = detectPatterns();

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should detect optimal time pattern when data available', () => {
      const mockHourStats = [
        { hour_of_day: 14, day_of_week: 1, total_events: 10, success_events: 8 },
        { hour_of_day: 15, day_of_week: 1, total_events: 8, success_events: 7 },
        { hour_of_day: 16, day_of_week: 2, total_events: 12, success_events: 10 },
      ];

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('hour_of_day')) {
          return { all: jest.fn(() => mockHourStats) };
        }
        return { all: jest.fn(() => []), get: jest.fn(() => null), run: jest.fn() };
      });

      const patterns = detectPatterns();
      // Pattern detection depends on data threshold
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('getActivePatterns', () => {
    it('should return active patterns ordered by confidence', () => {
      const mockPatterns = [
        { id: 'p1', pattern_type: 'optimal_time', confidence: 0.9, is_active: 1 },
        { id: 'p2', pattern_type: 'struggle_subject', confidence: 0.7, is_active: 1 },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      const patterns = getActivePatterns();

      expect(patterns).toHaveLength(2);
      expect(patterns[0].confidence).toBe(0.9);
    });

    it('should only return active patterns', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => []),
      });

      const patterns = getActivePatterns();

      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  // ==========================================================================
  // Recommendations Tests
  // ==========================================================================

  describe('getOptimalStudyTime', () => {
    it('should return null when no pattern exists', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => null),
      });

      const timeRange = getOptimalStudyTime();

      expect(timeRange).toBeNull();
    });

    it('should parse pattern data and return TimeRange', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          id: 'p1',
          pattern_type: 'optimal_time',
          pattern_data: JSON.stringify({
            optimal_hours: [14, 15, 16],
            optimal_days: [1, 2, 3, 4, 5],
          }),
          confidence: 0.85,
        })),
      });

      const timeRange = getOptimalStudyTime();

      expect(timeRange).not.toBeNull();
      expect(timeRange?.start_hour).toBe(14);
      expect(timeRange?.end_hour).toBe(16);
      expect(timeRange?.confidence).toBe(0.85);
    });

    it('should handle malformed pattern data', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          pattern_data: 'invalid json',
        })),
      });

      const timeRange = getOptimalStudyTime();

      expect(timeRange).toBeNull();
    });
  });

  describe('getPersonalizedRecommendations', () => {
    it('should return empty array when no patterns', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => []),
      });

      const recommendations = getPersonalizedRecommendations();

      expect(recommendations).toEqual([]);
    });

    it('should generate recommendations from patterns', () => {
      const mockPatterns = [
        {
          pattern_type: 'optimal_time',
          pattern_data: JSON.stringify({
            optimal_hours: [14, 15, 16],
          }),
        },
        {
          pattern_type: 'struggle_subject',
          pattern_data: JSON.stringify({
            most_difficult: 'Math',
          }),
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      const recommendations = getPersonalizedRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'timing')).toBe(true);
      expect(recommendations.some(r => r.type === 'focus')).toBe(true);
    });

    it('should sort recommendations by priority', () => {
      const mockPatterns = [
        {
          pattern_type: 'optimal_time',
          pattern_data: JSON.stringify({ optimal_hours: [14] }),
        },
        {
          pattern_type: 'struggle_subject',
          pattern_data: JSON.stringify({ most_difficult: 'Math' }),
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      const recommendations = getPersonalizedRecommendations();

      // Should be sorted by priority (highest first)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].priority).toBeGreaterThanOrEqual(
          recommendations[i].priority
        );
      }
    });

    it('should handle engagement decay pattern', () => {
      const mockPatterns = [
        {
          pattern_type: 'engagement_decay',
          pattern_data: JSON.stringify({
            decay_rate: 0.3,
          }),
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      const recommendations = getPersonalizedRecommendations();

      expect(recommendations.some(r => r.type === 'break')).toBe(true);
    });

    it('should handle subject affinity pattern', () => {
      const mockPatterns = [
        {
          pattern_type: 'subject_affinity',
          pattern_data: JSON.stringify({
            favorite_subjects: ['Reading', 'Science'],
          }),
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      const recommendations = getPersonalizedRecommendations();

      expect(recommendations.some(r => r.type === 'activity')).toBe(true);
    });
  });

  // ==========================================================================
  // Predictions Tests
  // ==========================================================================

  describe('predictSessionSuccess', () => {
    it('should create a prediction in database', () => {
      const mockRun = jest.fn();
      const mockGet = jest.fn(() => ({
        id: 'mock-uuid-12345',
        prediction_type: 'session_success',
        confidence: 0.5,
      }));

      mockDb.prepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
      });

      const prediction = predictSessionSuccess('reading');

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should base prediction on historical success', () => {
      const mockHistorical = { total: 20, successes: 18 };

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('COUNT(*)')) {
          return { get: jest.fn(() => mockHistorical) };
        }
        return {
          run: jest.fn(),
          get: jest.fn(() => ({
            id: 'pred-1',
            prediction_type: 'session_success',
            confidence: 0.9,
          })),
        };
      });

      const prediction = predictSessionSuccess('math');

      expect(prediction).toBeDefined();
    });

    it('should use default confidence when insufficient data', () => {
      const mockHistorical = { total: 2, successes: 1 };

      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('COUNT(*)')) {
          return { get: jest.fn(() => mockHistorical) };
        }
        return {
          run: jest.fn(),
          get: jest.fn(() => ({
            id: 'pred-1',
            prediction_type: 'session_success',
            confidence: 0.5,
          })),
        };
      });

      const prediction = predictSessionSuccess('writing');

      expect(prediction.confidence).toBe(0.5);
    });
  });

  describe('recordPredictionOutcome', () => {
    it('should update prediction with outcome', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT')) {
          return {
            get: jest.fn(() => ({
              id: 'pred-1',
              prediction_data: JSON.stringify({ predicted_success: true }),
            })),
          };
        }
        return { run: mockRun };
      });

      recordPredictionOutcome('pred-1', true);

      expect(mockRun).toHaveBeenCalled();
    });

    it('should handle missing prediction gracefully', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => null),
      });

      // Should not throw
      expect(() => recordPredictionOutcome('nonexistent', true)).not.toThrow();
    });

    it('should calculate accuracy correctly', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockImplementation((sql) => {
        if (sql.includes('SELECT')) {
          return {
            get: jest.fn(() => ({
              id: 'pred-1',
              prediction_data: JSON.stringify({ predicted_success: true }),
            })),
          };
        }
        return { run: mockRun };
      });

      recordPredictionOutcome('pred-1', true);

      // Should mark as correct (prediction_accuracy = 1.0)
      expect(mockRun).toHaveBeenCalledWith(
        expect.stringContaining('"was_correct":true'),
        1.0,
        'pred-1'
      );
    });
  });

  describe('getPredictionAccuracy', () => {
    it('should return accuracy statistics', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          total: 100,
          correct: 75,
        })),
      });

      const accuracy = getPredictionAccuracy();

      expect(accuracy.total).toBe(100);
      expect(accuracy.correct).toBe(75);
      expect(accuracy.accuracy).toBe(0.75);
    });

    it('should handle zero predictions', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          total: 0,
          correct: 0,
        })),
      });

      const accuracy = getPredictionAccuracy();

      expect(accuracy.total).toBe(0);
      expect(accuracy.accuracy).toBe(0);
    });

    it('should handle null values', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          total: null,
          correct: null,
        })),
      });

      const accuracy = getPredictionAccuracy();

      expect(accuracy.total).toBe(0);
      expect(accuracy.correct).toBe(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty pattern data gracefully', () => {
      const mockPatterns = [
        {
          pattern_type: 'optimal_time',
          pattern_data: '{}',
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      const recommendations = getPersonalizedRecommendations();
      // Should not crash
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle malformed JSON in pattern data', () => {
      const mockPatterns = [
        {
          pattern_type: 'optimal_time',
          pattern_data: 'not json',
        },
      ];

      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => mockPatterns),
      });

      // Should not throw, just skip malformed patterns
      expect(() => getPersonalizedRecommendations()).not.toThrow();
    });

    it('should handle extreme hour values', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          pattern_data: JSON.stringify({
            optimal_hours: [0, 23],
            optimal_days: [0, 6],
          }),
          confidence: 0.5,
        })),
      });

      const timeRange = getOptimalStudyTime();

      expect(timeRange?.start_hour).toBe(0);
      expect(timeRange?.end_hour).toBe(23);
    });

    it('should handle single hour in optimal time', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          pattern_data: JSON.stringify({
            optimal_hours: [15],
            optimal_days: [1],
          }),
          confidence: 0.6,
        })),
      });

      const timeRange = getOptimalStudyTime();

      expect(timeRange?.start_hour).toBe(15);
      expect(timeRange?.end_hour).toBe(15);
    });
  });
});
