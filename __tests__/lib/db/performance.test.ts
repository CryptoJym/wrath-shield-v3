/**
 * Wrath Shield v3 - Database Performance & Integration Tests
 *
 * Tests for performance benchmarks, large batch operations, and end-to-end integration.
 * Requirements:
 * - Batch insert/query 100+ rows under 500ms
 * - Common queries with indexes under 100ms
 * - Upsert conflict handling at scale
 * - Migration system integration
 */

import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import {
  insertCycles,
  insertRecoveries,
  insertSleeps,
  insertLifelogs,
  insertScores,
  getMetricsLastNDays,
  getLatestRecovery,
  getLatestCycle,
  getUnbendingScores,
  calculateUnbendingScore,
} from '../../../lib/db/queries';
import type {
  CycleInput,
  RecoveryInput,
  SleepInput,
  LifelogInput,
  ScoreInput,
} from '../../../lib/db/types';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('Database Performance & Integration Tests', () => {
  const testDbPath = join(process.cwd(), '.data', 'test-performance.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    // Ensure .data directory exists
    const dataDir = join(process.cwd(), '.data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Reset singleton and initialize with real schema
    Database.resetInstance();
    Database.getInstance(testDbPath, testMigrationsPath);
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('Performance Benchmarks', () => {
    it('should insert 100+ cycles in under 500ms', () => {
      const cycles: CycleInput[] = [];
      for (let i = 0; i < 150; i++) {
        cycles.push({
          id: `cycle-${i}`,
          date: `2025-01-${String(i % 30 + 1).padStart(2, '0')}`,
          strain: 10 + Math.random() * 10,
          kilojoules: 1000 + Math.random() * 500,
          avg_hr: 120 + Math.random() * 20,
          max_hr: 180 + Math.random() * 20,
        });
      }

      const startTime = performance.now();
      insertCycles(cycles);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500);

      // Verify all were inserted
      const latest = getLatestCycle();
      expect(latest).toBeTruthy();
    });

    it('should insert 100+ recoveries in under 500ms', () => {
      const recoveries: RecoveryInput[] = [];
      for (let i = 0; i < 150; i++) {
        recoveries.push({
          id: `recovery-${i}`,
          date: `2025-01-${String(i % 30 + 1).padStart(2, '0')}`,
          score: 60 + Math.random() * 40,
          hrv: 50 + Math.random() * 50,
          rhr: 50 + Math.random() * 20,
          spo2: 95 + Math.random() * 5,
          skin_temp: 97 + Math.random() * 2,
        });
      }

      const startTime = performance.now();
      insertRecoveries(recoveries);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500);

      const latest = getLatestRecovery();
      expect(latest).toBeTruthy();
    });

    it('should insert 100+ sleeps in under 500ms', () => {
      const sleeps: SleepInput[] = [];
      for (let i = 0; i < 150; i++) {
        sleeps.push({
          id: `sleep-${i}`,
          date: `2025-01-${String(i % 30 + 1).padStart(2, '0')}`,
          performance: 70 + Math.random() * 30,
          rem_min: 80 + Math.random() * 40,
          sws_min: 100 + Math.random() * 50,
          light_min: 140 + Math.random() * 60,
          respiration: 12 + Math.random() * 4,
          sleep_debt_min: Math.random() * 60,
        });
      }

      const startTime = performance.now();
      insertSleeps(sleeps);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should insert 100+ lifelogs in under 500ms', () => {
      const lifelogs: LifelogInput[] = [];
      for (let i = 0; i < 150; i++) {
        lifelogs.push({
          id: `lifelog-${i}`,
          date: `2025-01-${String(i % 30 + 1).padStart(2, '0')}`,
          title: `Log ${i}`,
          manipulation_count: Math.floor(Math.random() * 10),
          wrath_deployed: Math.random() > 0.7 ? 1 : 0,
          raw_json: JSON.stringify({ index: i }),
        });
      }

      const startTime = performance.now();
      insertLifelogs(lifelogs);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should query metrics for 7 days in under 100ms with indexes', () => {
      // Insert test data across 7 days
      const cycles: CycleInput[] = [];
      const recoveries: RecoveryInput[] = [];
      const sleeps: SleepInput[] = [];

      for (let i = 0; i < 7; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`;
        cycles.push({
          id: `c${i}`,
          date,
          strain: 10 + i,
          kilojoules: 1000 + i * 100,
          avg_hr: 120,
          max_hr: 180,
        });
        recoveries.push({
          id: `r${i}`,
          date,
          score: 70 + i,
          hrv: 60,
          rhr: 55,
          spo2: 98,
          skin_temp: 98.2,
        });
        sleeps.push({
          id: `s${i}`,
          date,
          performance: 80 + i,
          rem_min: 90,
          sws_min: 120,
          light_min: 150,
          respiration: 14,
          sleep_debt_min: 30,
        });
      }

      insertCycles(cycles);
      insertRecoveries(recoveries);
      insertSleeps(sleeps);

      // Measure query performance with indexes
      const startTime = performance.now();
      const metrics = getMetricsLastNDays(7);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(metrics).toHaveLength(7);
    });

    it('should handle upsert conflicts efficiently at scale', () => {
      // Initial batch insert
      const initialCycles: CycleInput[] = [];
      for (let i = 0; i < 100; i++) {
        initialCycles.push({
          id: `cycle-${i}`,
          date: `2025-01-${String(i % 30 + 1).padStart(2, '0')}`,
          strain: 10.0,
          kilojoules: 1000,
          avg_hr: 120,
          max_hr: 180,
        });
      }

      const insertStart = performance.now();
      insertCycles(initialCycles);
      const insertEnd = performance.now();

      // Update batch (conflicts)
      const updatedCycles: CycleInput[] = [];
      for (let i = 0; i < 100; i++) {
        updatedCycles.push({
          id: `cycle-${i}`,
          date: `2025-01-${String(i % 30 + 1).padStart(2, '0')}`,
          strain: 15.0, // Updated value
          kilojoules: 1500, // Updated value
          avg_hr: 125,
          max_hr: 185,
        });
      }

      const updateStart = performance.now();
      insertCycles(updatedCycles);
      const updateEnd = performance.now();

      // Both operations should be fast
      expect(insertEnd - insertStart).toBeLessThan(500);
      expect(updateEnd - updateStart).toBeLessThan(500);

      // Verify updates were applied (check one record)
      const latest = getLatestCycle();
      expect(latest?.strain).toBe(15.0);
    });
  });

  describe('Integration Tests', () => {
    it('should run full migration system end-to-end', () => {
      // Database is already initialized in beforeEach with migrations
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      // Verify migrations table exists
      const migrations = db
        .prepare('SELECT name FROM migrations ORDER BY name')
        .all();

      expect(migrations).toHaveLength(1);
      expect(migrations[0]).toHaveProperty('name', '001_initial_schema');

      // Verify all 7 tables were created
      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence', 'migrations')`
        )
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name).sort();
      expect(tableNames).toEqual([
        'cycles',
        'lifelogs',
        'recoveries',
        'scores',
        'settings',
        'sleeps',
        'tokens',
      ]);
    });

    it('should handle complete data workflow: insert -> query -> aggregate', () => {
      // Step 1: Insert data for multiple days
      const cycles: CycleInput[] = [];
      const recoveries: RecoveryInput[] = [];
      const sleeps: SleepInput[] = [];
      const lifelogs: LifelogInput[] = [];

      for (let i = 0; i < 30; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`;

        cycles.push({
          id: `c${i}`,
          date,
          strain: 10 + i * 0.5,
          kilojoules: 1000 + i * 50,
          avg_hr: 120 + i,
          max_hr: 180 + i,
        });

        recoveries.push({
          id: `r${i}`,
          date,
          score: 70 + i,
          hrv: 60 + i * 0.5,
          rhr: 55 - i * 0.2,
          spo2: 98,
          skin_temp: 98.2,
        });

        sleeps.push({
          id: `s${i}`,
          date,
          performance: 80 + i * 0.5,
          rem_min: 90 + i,
          sws_min: 120,
          light_min: 150,
          respiration: 14,
          sleep_debt_min: 30 - i,
        });

        lifelogs.push({
          id: `l${i}`,
          date,
          title: `Log ${i}`,
          manipulation_count: 5 + i,
          wrath_deployed: i % 3 === 0 ? 1 : 0,
          raw_json: '{}',
        });
      }

      insertCycles(cycles);
      insertRecoveries(recoveries);
      insertSleeps(sleeps);
      insertLifelogs(lifelogs);

      // Step 2: Query aggregated metrics
      const metrics = getMetricsLastNDays(30);
      expect(metrics).toHaveLength(30);

      // Verify data integrity
      expect(metrics[0].date).toBe('2025-01-30'); // Most recent
      expect(metrics[29].date).toBe('2025-01-01'); // Oldest

      // Step 3: Calculate unbending scores
      for (let i = 0; i < 30; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`;
        calculateUnbendingScore(date);
      }

      // Step 4: Query calculated scores
      const scores = getUnbendingScores('2025-01-01', '2025-01-30');
      expect(scores).toHaveLength(30);

      // Verify score calculation for a specific date (pick one with wrath deployed)
      const score = scores.find((s) => s.date === '2025-01-01');
      expect(score?.unbending_score).not.toBeNull();
      expect(score?.unbending_score).toBeGreaterThan(0);
    });

    it('should handle concurrent operations via transactions', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      // Simulate concurrent batch operations
      const batch1: CycleInput[] = Array.from({ length: 50 }, (_, i) => ({
        id: `batch1-${i}`,
        date: '2025-01-15',
        strain: 12.0,
        kilojoules: 1200,
        avg_hr: 125,
        max_hr: 185,
      }));

      const batch2: RecoveryInput[] = Array.from({ length: 50 }, (_, i) => ({
        id: `batch2-${i}`,
        date: '2025-01-15',
        score: 75,
        hrv: 65,
        rhr: 54,
        spo2: 98,
        skin_temp: 98.3,
      }));

      // Both should complete without conflicts
      expect(() => {
        insertCycles(batch1);
        insertRecoveries(batch2);
      }).not.toThrow();

      // Verify both batches were inserted
      const cycles = db
        .prepare('SELECT COUNT(*) as count FROM cycles')
        .get() as { count: number };
      const recoveries = db
        .prepare('SELECT COUNT(*) as count FROM recoveries')
        .get() as { count: number };

      expect(cycles.count).toBe(50);
      expect(recoveries.count).toBe(50);
    });

    it('should verify index performance on date columns', () => {
      // Insert data across 100 different dates
      const cycles: CycleInput[] = [];
      for (let i = 0; i < 100; i++) {
        const month = Math.floor(i / 30) + 1;
        const day = (i % 30) + 1;
        cycles.push({
          id: `c${i}`,
          date: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          strain: 10 + i * 0.1,
          kilojoules: 1000 + i * 10,
          avg_hr: 120,
          max_hr: 180,
        });
      }

      insertCycles(cycles);

      // Query using date index - should be very fast
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      const startTime = performance.now();
      const result = db
        .prepare('SELECT * FROM cycles WHERE date = ? ORDER BY date DESC')
        .all('2025-02-15');
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(result).toHaveLength(1);
    });
  });

  describe('Edge Cases & Correctness', () => {
    it('should handle empty batch operations gracefully', () => {
      expect(() => {
        insertCycles([]);
        insertRecoveries([]);
        insertSleeps([]);
        insertLifelogs([]);
        insertScores([]);
      }).not.toThrow();
    });

    it('should handle null values in batch operations', () => {
      const cycles: CycleInput[] = [
        {
          id: '1',
          date: '2025-01-01',
          strain: null,
          kilojoules: null,
          avg_hr: null,
          max_hr: null,
        },
      ];

      insertCycles(cycles);
      const latest = getLatestCycle();

      expect(latest).toMatchObject({
        id: '1',
        strain: null,
        kilojoules: null,
      });
    });

    it('should calculate unbending score correctly with zero manipulations', () => {
      const lifelogs: LifelogInput[] = [
        {
          id: '1',
          date: '2025-01-01',
          title: 'No manipulation',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: '{}',
        },
      ];

      insertLifelogs(lifelogs);
      calculateUnbendingScore('2025-01-01');

      const scores = getUnbendingScores('2025-01-01', '2025-01-01');
      expect(scores[0].unbending_score).toBeNull();
    });

    it('should handle very large individual records', () => {
      const largeJson = JSON.stringify({
        data: Array(1000).fill({ key: 'value' }),
      });

      const lifelog: LifelogInput = {
        id: '1',
        date: '2025-01-01',
        title: 'Large record',
        manipulation_count: 5,
        wrath_deployed: 1,
        raw_json: largeJson,
      };

      expect(() => insertLifelogs([lifelog])).not.toThrow();
    });
  });
});
