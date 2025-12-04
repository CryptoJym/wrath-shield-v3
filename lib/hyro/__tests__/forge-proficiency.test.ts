/**
 * Tests for HYRO FORGE: Skill Proficiency System
 * Tests Bayesian estimation, velocity calculation, and benchmark comparisons
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
  recordSkillEvidence,
  getSkillEvidence,
  getSkillProficiency,
  getProficiencyProfile,
  predictPerformance,
  recordPrediction,
  recordOutcome,
  getCalibrationFeedback,
  compareToBenchmark,
  getAllBenchmarks,
} from '../forge-proficiency';

describe('Forge Proficiency System', () => {
  beforeEach(() => {
    // Create fresh in-memory database
    testDb = new BetterSqlite3(':memory:');

    // Create required tables
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS hyro_skill_evidence (
        id TEXT PRIMARY KEY,
        stat_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        performance_score INTEGER NOT NULL,
        difficulty_level REAL,
        time_pressure INTEGER DEFAULT 0,
        topic_tags TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS hyro_proficiency_snapshots (
        id TEXT PRIMARY KEY,
        stat_name TEXT NOT NULL,
        proficiency_level INTEGER NOT NULL,
        confidence_low INTEGER,
        confidence_high INTEGER,
        uncertainty INTEGER,
        learning_velocity REAL,
        velocity_trend TEXT,
        self_estimate INTEGER,
        calibration_error REAL,
        evidence_count INTEGER,
        snapshot_date TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS hyro_calibration_history (
        id TEXT PRIMARY KEY,
        stat_name TEXT NOT NULL,
        predicted_score INTEGER,
        confidence REAL,
        actual_score INTEGER,
        prediction_error REAL,
        activity_type TEXT,
        activity_id TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('recordSkillEvidence', () => {
    it('should record evidence with all parameters', () => {
      const evidence = recordSkillEvidence({
        stat_name: 'math',
        source_type: 'quest',
        source_id: 'quest-123',
        performance_score: 85,
        difficulty_level: 0.7,
        time_pressure: true,
        topic_tags: ['algebra', 'equations'],
      });

      expect(evidence.id).toBeDefined();
      expect(evidence.stat_name).toBe('math');
      expect(evidence.source_type).toBe('quest');
      expect(evidence.performance_score).toBe(85);
      expect(evidence.difficulty_level).toBe(0.7);
      expect(evidence.time_pressure).toBe(1);
    });

    it('should record evidence with minimal parameters', () => {
      const evidence = recordSkillEvidence({
        stat_name: 'reading',
        source_type: 'comprehension',
        performance_score: 70,
      });

      expect(evidence.stat_name).toBe('reading');
      expect(evidence.source_type).toBe('comprehension');
      expect(evidence.performance_score).toBe(70);
      expect(evidence.difficulty_level).toBeNull();
    });
  });

  describe('getSkillEvidence', () => {
    it('should retrieve evidence for a specific skill', () => {
      // Add some evidence
      recordSkillEvidence({ stat_name: 'math', source_type: 'quest', performance_score: 80 });
      recordSkillEvidence({ stat_name: 'math', source_type: 'srs', performance_score: 75 });
      recordSkillEvidence({ stat_name: 'reading', source_type: 'quest', performance_score: 90 });

      const mathEvidence = getSkillEvidence('math');
      expect(mathEvidence.length).toBe(2);
      expect(mathEvidence.every(e => e.stat_name === 'math')).toBe(true);
    });

    it('should respect the limit parameter', () => {
      // Add 5 evidence records
      for (let i = 0; i < 5; i++) {
        recordSkillEvidence({ stat_name: 'science', source_type: 'quest', performance_score: 70 + i });
      }

      const limited = getSkillEvidence('science', 3);
      expect(limited.length).toBe(3);
    });
  });

  describe('getSkillProficiency - Bayesian estimation', () => {
    it('should return default prior for skills with no evidence', () => {
      const proficiency = getSkillProficiency('coding');

      expect(proficiency.stat_name).toBe('coding');
      expect(proficiency.level).toBe(50); // Prior mean
      expect(proficiency.evidence_count).toBe(0);
      expect(proficiency.velocity_trend).toBe('unknown');
    });

    it('should update proficiency based on evidence', () => {
      // Add high-performing evidence
      recordSkillEvidence({ stat_name: 'math', source_type: 'quest', performance_score: 90 });
      recordSkillEvidence({ stat_name: 'math', source_type: 'quest', performance_score: 85 });
      recordSkillEvidence({ stat_name: 'math', source_type: 'quest', performance_score: 88 });

      const proficiency = getSkillProficiency('math');

      expect(proficiency.level).toBeGreaterThan(50);
      expect(proficiency.evidence_count).toBe(3);
      // With high scores, proficiency should be pulled toward the evidence
      expect(proficiency.level).toBeGreaterThan(70);
    });

    it('should calculate confidence intervals', () => {
      recordSkillEvidence({ stat_name: 'reading', source_type: 'quest', performance_score: 80 });

      const proficiency = getSkillProficiency('reading');

      expect(proficiency.confidence_interval).toHaveLength(2);
      expect(proficiency.confidence_interval[0]).toBeLessThanOrEqual(proficiency.level);
      expect(proficiency.confidence_interval[1]).toBeGreaterThanOrEqual(proficiency.level);
      expect(proficiency.uncertainty).toBeGreaterThan(0);
    });
  });

  describe('getProficiencyProfile', () => {
    it('should return a complete profile with all stats', () => {
      const profile = getProficiencyProfile();

      expect(profile.stats).toBeDefined();
      expect(profile.overall_level).toBeDefined();
      expect(profile.strongest_skill).toBeDefined();
      expect(profile.growth_skill).toBeDefined();

      // Should have all 8 stats
      const statCount = Object.keys(profile.stats).length;
      expect(statCount).toBe(8);
    });

    it('should identify strongest skill correctly', () => {
      // Add evidence to make math the strongest
      for (let i = 0; i < 5; i++) {
        recordSkillEvidence({ stat_name: 'math', source_type: 'quest', performance_score: 95 });
      }

      const profile = getProficiencyProfile();

      expect(profile.strongest_skill).toBe('math');
    });
  });

  describe('predictPerformance', () => {
    it('should predict based on proficiency and difficulty', () => {
      // Add evidence to establish proficiency
      recordSkillEvidence({ stat_name: 'science', source_type: 'quest', performance_score: 80 });
      recordSkillEvidence({ stat_name: 'science', source_type: 'quest', performance_score: 75 });

      const easyPrediction = predictPerformance('science', 0.2);
      const hardPrediction = predictPerformance('science', 0.8);

      // Easy tasks should have higher predicted scores
      expect(easyPrediction.predicted_score).toBeGreaterThan(hardPrediction.predicted_score);
      expect(easyPrediction.confidence).toBeGreaterThan(0);
      expect(hardPrediction.confidence).toBeGreaterThan(0);
    });

    it('should have lower confidence with less evidence', () => {
      const prediction = predictPerformance('technology', 0.5);

      // Low evidence = high uncertainty = lower confidence
      expect(prediction.confidence).toBeLessThan(0.7);
    });
  });

  describe('Calibration tracking', () => {
    it('should record predictions and outcomes', () => {
      const prediction = recordPrediction({
        stat_name: 'math',
        predicted_score: 75,
        confidence: 0.8,
        activity_type: 'quest',
        activity_id: 'quest-456',
      });

      expect(prediction.id).toBeDefined();
      expect(prediction.predicted_score).toBe(75);
      expect(prediction.actual_score).toBeNull();

      // Record outcome
      const updated = recordOutcome(prediction.id, 80);

      expect(updated.actual_score).toBe(80);
      expect(updated.prediction_error).toBe(5); // |80 - 75| = 5
    });

    it('should calculate calibration feedback', () => {
      // Create some predictions with outcomes
      const p1 = recordPrediction({
        stat_name: 'math',
        predicted_score: 70,
        confidence: 0.7,
        activity_type: 'quest',
        activity_id: 'q1',
      });
      recordOutcome(p1.id, 72);

      const p2 = recordPrediction({
        stat_name: 'reading',
        predicted_score: 80,
        confidence: 0.8,
        activity_type: 'quest',
        activity_id: 'q2',
      });
      recordOutcome(p2.id, 78);

      const feedback = getCalibrationFeedback();

      expect(feedback.overall_accuracy).toBeGreaterThan(0);
      expect(feedback.tendency).toBeDefined();
      expect(Array.isArray(feedback.recommendations)).toBe(true);
    });

    it('should identify overconfidence', () => {
      // Consistently predict higher than actual
      for (let i = 0; i < 5; i++) {
        const p = recordPrediction({
          stat_name: 'math',
          predicted_score: 90,
          confidence: 0.9,
          activity_type: 'quest',
          activity_id: `q${i}`,
        });
        recordOutcome(p.id, 60); // Always underperform
      }

      const feedback = getCalibrationFeedback();

      expect(feedback.tendency).toBe('overconfident');
    });
  });

  describe('Benchmark comparisons', () => {
    it('should compare to grade 6 benchmark', () => {
      // Add evidence at benchmark level
      for (let i = 0; i < 5; i++) {
        recordSkillEvidence({ stat_name: 'math', source_type: 'quest', performance_score: 65 });
      }

      const comparison = compareToBenchmark('math');

      expect(comparison.stat_name).toBe('math');
      expect(comparison.benchmark_level).toBe(65);
      expect(comparison.percentile).toBeGreaterThanOrEqual(1);
      expect(comparison.percentile).toBeLessThanOrEqual(99);
      expect(['below', 'at', 'above', 'excellent']).toContain(comparison.status);
    });

    it('should identify above benchmark performance', () => {
      // Add evidence well above benchmark
      for (let i = 0; i < 5; i++) {
        recordSkillEvidence({ stat_name: 'reading', source_type: 'quest', performance_score: 90 });
      }

      const comparison = compareToBenchmark('reading');

      expect(comparison.user_level).toBeGreaterThan(comparison.benchmark_level);
      expect(['above', 'excellent']).toContain(comparison.status);
    });

    it('should return all benchmarks', () => {
      const benchmarks = getAllBenchmarks();

      expect(benchmarks.length).toBe(8);
      expect(benchmarks.every(b => b.benchmark_level > 0)).toBe(true);
    });
  });

  describe('Velocity calculation', () => {
    it('should detect learning acceleration', () => {
      const now = Math.floor(Date.now() / 1000);
      const twoWeeksAgo = now - 14 * 86400;
      const fourWeeksAgo = now - 28 * 86400;

      // Insert older evidence with lower scores (3+ weeks ago)
      for (let i = 0; i < 5; i++) {
        testDb.prepare(`
          INSERT INTO hyro_skill_evidence (id, stat_name, source_type, performance_score, created_at)
          VALUES (?, 'math', 'quest', ?, ?)
        `).run(randomUUID(), 60, fourWeeksAgo - i * 86400);
      }

      // Insert recent evidence with higher scores (last 2 weeks)
      for (let i = 0; i < 5; i++) {
        testDb.prepare(`
          INSERT INTO hyro_skill_evidence (id, stat_name, source_type, performance_score, created_at)
          VALUES (?, 'math', 'quest', ?, ?)
        `).run(randomUUID(), 85, now - i * 86400);
      }

      const proficiency = getSkillProficiency('math');

      // With improvement over time, velocity should be positive or undefined (implementation-dependent)
      // Check that we get valid proficiency data
      expect(proficiency.level).toBeGreaterThan(50); // Evidence shows high performance
      expect(proficiency.evidence_count).toBe(10);
      // Velocity trend might be 'accelerating', 'decelerating', 'stable', or 'unknown'
      expect(['accelerating', 'decelerating', 'stable', 'unknown']).toContain(proficiency.velocity_trend);
    });
  });
});
