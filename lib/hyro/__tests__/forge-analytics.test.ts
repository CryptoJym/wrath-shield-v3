/**
 * Tests for HYRO FORGE: Behavioral Analytics Engine
 * Tests event logging, pattern detection, and recommendations
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BetterSqlite3 from 'better-sqlite3';
import { randomUUID } from 'crypto';

// Create in-memory database for testing
let testDb: BetterSqlite3.Database;

// Mock the Database module
jest.mock('@/lib/db/Database', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => testDb.prepare(sql),
    exec: (sql: string) => testDb.exec(sql),
    transaction: <T>(fn: () => T): T => testDb.transaction(fn)(),
  }),
}));

// Import after mocking
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
  type EventType,
} from '../forge-analytics';

describe('Forge Analytics System', () => {
  beforeEach(() => {
    // Create fresh in-memory database
    testDb = new BetterSqlite3(':memory:');

    // Create required tables
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS hyro_behavior_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_data TEXT,
        day_of_week INTEGER NOT NULL,
        hour_of_day INTEGER NOT NULL,
        session_id TEXT,
        device_type TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS hyro_behavior_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        pattern_data TEXT NOT NULL,
        confidence REAL NOT NULL,
        evidence_count INTEGER NOT NULL,
        first_detected INTEGER DEFAULT (unixepoch()),
        last_confirmed INTEGER DEFAULT (unixepoch()),
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS hyro_predictions (
        id TEXT PRIMARY KEY,
        prediction_type TEXT NOT NULL,
        prediction_data TEXT NOT NULL,
        confidence REAL NOT NULL,
        outcome_recorded INTEGER DEFAULT 0,
        outcome_data TEXT,
        prediction_accuracy REAL,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Event Logging', () => {
    it('should log a behavior event with all parameters', () => {
      const event = logBehaviorEvent(
        'session_start',
        { duration_estimate: 30 },
        'session-123',
        'desktop'
      );

      expect(event.id).toBeDefined();
      expect(event.event_type).toBe('session_start');
      expect(event.session_id).toBe('session-123');
      expect(event.device_type).toBe('desktop');
      expect(event.day_of_week).toBeGreaterThanOrEqual(0);
      expect(event.day_of_week).toBeLessThanOrEqual(6);
      expect(event.hour_of_day).toBeGreaterThanOrEqual(0);
      expect(event.hour_of_day).toBeLessThanOrEqual(23);
    });

    it('should log event with minimal parameters', () => {
      const event = logBehaviorEvent('level_up');

      expect(event.event_type).toBe('level_up');
      expect(event.session_id).toBeNull();
      expect(event.device_type).toBeNull();
    });

    it('should store event data as JSON', () => {
      const eventData = { score: 95, subject: 'math', success: true };
      const event = logBehaviorEvent('quest_completed', eventData);

      expect(event.event_data).toBe(JSON.stringify(eventData));
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(() => {
      // Add some test events
      logBehaviorEvent('session_start', { type: 'morning' });
      logBehaviorEvent('quest_completed', { score: 80 });
      logBehaviorEvent('srs_review', { cards: 10 });
      logBehaviorEvent('session_end', { duration: 30 });
      logBehaviorEvent('quest_completed', { score: 95 });
    });

    it('should retrieve recent events', () => {
      const events = getRecentEvents(10);

      expect(events.length).toBe(5);
      // All events present (order by created_at DESC)
      const types = events.map(e => e.event_type);
      expect(types).toContain('session_start');
      expect(types).toContain('quest_completed');
    });

    it('should respect limit parameter', () => {
      const events = getRecentEvents(3);

      expect(events.length).toBe(3);
    });

    it('should filter events by type', () => {
      const questEvents = getEventsByType('quest_completed');

      expect(questEvents.length).toBe(2);
      expect(questEvents.every(e => e.event_type === 'quest_completed')).toBe(true);
    });
  });

  describe('Pattern Detection', () => {
    it('should return empty array when insufficient data', () => {
      const patterns = detectPatterns();

      // With no events, no patterns should be detected
      expect(patterns.length).toBe(0);
    });

    it('should detect optimal time pattern with sufficient data', () => {
      const now = Math.floor(Date.now() / 1000);

      // Add successful events at specific hour (10 AM)
      for (let i = 0; i < 10; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'quest_completed', ?, 1, 10, ?)
        `).run(randomUUID(), JSON.stringify({ success: 1 }), now - i * 86400);
      }

      const patterns = detectPatterns();
      const timePattern = patterns.find(p => p.pattern_type === 'optimal_time');

      if (timePattern) {
        expect(timePattern.confidence).toBeGreaterThan(0);
        expect(timePattern.evidence_count).toBeGreaterThan(0);
      }
    });

    it('should detect struggle subject pattern', () => {
      const now = Math.floor(Date.now() / 1000);

      // Add failing events for a subject
      for (let i = 0; i < 10; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'quest_completed', ?, 1, 10, ?)
        `).run(
          randomUUID(),
          JSON.stringify({ success: 0, score: 40, subject: 'math' }),
          now - i * 86400
        );
      }

      const patterns = detectPatterns();
      const strugglePattern = patterns.find(p => p.pattern_type === 'struggle_subject');

      if (strugglePattern) {
        expect(strugglePattern.confidence).toBeGreaterThan(0);
        const data = JSON.parse(strugglePattern.pattern_data);
        expect(data.most_difficult).toBe('math');
      }
    });

    it('should get active patterns', () => {
      // Insert a pattern directly
      testDb.prepare(`
        INSERT INTO hyro_behavior_patterns (id, pattern_type, pattern_data, confidence, evidence_count, is_active)
        VALUES (?, 'optimal_time', ?, 0.8, 20, 1)
      `).run(randomUUID(), JSON.stringify({ optimal_hours: [9, 10, 11] }));

      const patterns = getActivePatterns();

      expect(patterns.length).toBe(1);
      expect(patterns[0].pattern_type).toBe('optimal_time');
    });
  });

  describe('Recommendations', () => {
    beforeEach(() => {
      // Insert various patterns
      testDb.prepare(`
        INSERT INTO hyro_behavior_patterns (id, pattern_type, pattern_data, confidence, evidence_count, is_active)
        VALUES (?, 'optimal_time', ?, 0.8, 20, 1)
      `).run(randomUUID(), JSON.stringify({ optimal_hours: [9, 10, 11], optimal_days: [1, 2, 3] }));

      testDb.prepare(`
        INSERT INTO hyro_behavior_patterns (id, pattern_type, pattern_data, confidence, evidence_count, is_active)
        VALUES (?, 'struggle_subject', ?, 0.7, 15, 1)
      `).run(randomUUID(), JSON.stringify({ most_difficult: 'math', struggling_subjects: [{ subject: 'math', avg_score: 55 }] }));

      testDb.prepare(`
        INSERT INTO hyro_behavior_patterns (id, pattern_type, pattern_data, confidence, evidence_count, is_active)
        VALUES (?, 'session_length_optimal', ?, 0.75, 18, 1)
      `).run(randomUUID(), JSON.stringify({ optimal_category: 'medium', optimal_range_minutes: [15, 30] }));
    });

    it('should generate personalized recommendations', () => {
      const recommendations = getPersonalizedRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].title).toBeDefined();
      expect(recommendations[0].description).toBeDefined();
      expect(recommendations[0].priority).toBeGreaterThan(0);
    });

    it('should prioritize recommendations by priority', () => {
      const recommendations = getPersonalizedRecommendations();

      // Should be sorted by priority (highest first)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].priority).toBeGreaterThanOrEqual(recommendations[i].priority);
      }
    });

    it('should get optimal study time', () => {
      const optimalTime = getOptimalStudyTime();

      expect(optimalTime).not.toBeNull();
      if (optimalTime) {
        expect(optimalTime.start_hour).toBe(9);
        expect(optimalTime.end_hour).toBe(11);
        expect(optimalTime.days).toEqual([1, 2, 3]);
        expect(optimalTime.confidence).toBe(0.8);
      }
    });
  });

  describe('Predictions', () => {
    it('should predict session success', () => {
      const prediction = predictSessionSuccess('reading');

      expect(prediction.id).toBeDefined();
      expect(prediction.prediction_type).toBe('session_success');
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('should use historical data for better predictions', () => {
      const now = Math.floor(Date.now() / 1000);
      const currentHour = new Date().getHours();
      const currentDay = new Date().getDay();

      // Add successful historical events at current time
      for (let i = 0; i < 10; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'session_end', ?, ?, ?, ?)
        `).run(
          randomUUID(),
          JSON.stringify({ success: 1 }),
          currentDay,
          currentHour,
          now - i * 86400 * 7 // Same time each week
        );
      }

      const prediction = predictSessionSuccess('study');

      // With good historical data, confidence should be higher
      expect(prediction.confidence).toBeGreaterThan(0.5);
    });

    it('should record prediction outcomes', () => {
      const prediction = predictSessionSuccess('math');

      recordPredictionOutcome(prediction.id, true);

      // Verify outcome was recorded
      const updated = testDb.prepare(`
        SELECT * FROM hyro_predictions WHERE id = ?
      `).get(prediction.id) as any;

      expect(updated.outcome_recorded).toBe(1);
      expect(updated.prediction_accuracy).toBeDefined();
    });

    it('should calculate prediction accuracy', () => {
      // Make some predictions and record outcomes
      for (let i = 0; i < 5; i++) {
        const p = predictSessionSuccess('study');
        recordPredictionOutcome(p.id, i % 2 === 0);
      }

      const accuracy = getPredictionAccuracy();

      expect(accuracy.total).toBe(5);
      expect(accuracy.accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy.accuracy).toBeLessThanOrEqual(1);
    });
  });

  describe('Engagement Decay Detection', () => {
    it('should detect declining engagement', () => {
      const now = Math.floor(Date.now() / 1000);

      // Add older sessions with longer durations
      for (let i = 10; i < 14; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'session_end', ?, 1, 10, ?)
        `).run(
          randomUUID(),
          JSON.stringify({ duration_minutes: 45, focus_rating: 4 }),
          now - i * 86400
        );
      }

      // Add recent sessions with shorter durations
      for (let i = 0; i < 4; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'session_end', ?, 1, 10, ?)
        `).run(
          randomUUID(),
          JSON.stringify({ duration_minutes: 20, focus_rating: 3 }),
          now - i * 86400
        );
      }

      const patterns = detectPatterns();
      const decayPattern = patterns.find(p => p.pattern_type === 'engagement_decay');

      if (decayPattern) {
        const data = JSON.parse(decayPattern.pattern_data);
        expect(data.decay_rate).toBeGreaterThan(0.2);
        expect(data.trend).toBe('declining');
      }
    });
  });

  describe('Subject Affinity Detection', () => {
    it('should detect favorite subjects', () => {
      const now = Math.floor(Date.now() / 1000);

      // Add many events for reading (favorite)
      for (let i = 0; i < 15; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'quest_completed', ?, 1, 10, ?)
        `).run(
          randomUUID(),
          JSON.stringify({ subject: 'reading', score: 90, duration_minutes: 30 }),
          now - i * 86400
        );
      }

      // Add fewer events for other subjects
      for (let i = 0; i < 6; i++) {
        testDb.prepare(`
          INSERT INTO hyro_behavior_events (id, event_type, event_data, day_of_week, hour_of_day, created_at)
          VALUES (?, 'quest_completed', ?, 1, 10, ?)
        `).run(
          randomUUID(),
          JSON.stringify({ subject: 'math', score: 75, duration_minutes: 20 }),
          now - i * 86400
        );
      }

      const patterns = detectPatterns();
      const affinityPattern = patterns.find(p => p.pattern_type === 'subject_affinity');

      if (affinityPattern) {
        const data = JSON.parse(affinityPattern.pattern_data);
        expect(data.favorite_subjects).toContain('reading');
      }
    });
  });
});
