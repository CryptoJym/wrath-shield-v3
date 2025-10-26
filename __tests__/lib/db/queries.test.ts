/**
 * Wrath Shield v3 - Database Query Helpers Tests
 */

import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import {
  insertCycles,
  insertRecoveries,
  insertSleeps,
  insertLifelogs,
  insertTokens,
  insertScores,
  insertSettings,
  getMetricsLastNDays,
  getLatestRecovery,
  getLatestCycle,
  getLatestSleep,
  getToken,
  getSetting,
  getLifelogsForDate,
  getUnbendingScores,
  calculateUnbendingScore,
} from '../../../lib/db/queries';
import type {
  CycleInput,
  RecoveryInput,
  SleepInput,
  LifelogInput,
  TokenInput,
  ScoreInput,
  SettingInput,
} from '../../../lib/db/types';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('Database Query Helpers', () => {
  const testDbPath = join(process.cwd(), '.data', 'test-queries.db');
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

  describe('Cycles - Batch Upsert', () => {
    it('should insert new cycles', () => {
      const cycles: CycleInput[] = [
        { id: '1', date: '2025-01-01', strain: 15.2, kilojoules: 1200, avg_hr: 120, max_hr: 180 },
        { id: '2', date: '2025-01-02', strain: 12.5, kilojoules: 1000, avg_hr: 115, max_hr: 175 },
      ];

      insertCycles(cycles);

      const result = getLatestCycle();
      expect(result).toMatchObject({ id: '2', date: '2025-01-02', strain: 12.5 });
    });

    it('should upsert existing cycles', () => {
      const initial: CycleInput[] = [{ id: '1', date: '2025-01-01', strain: 10.0, kilojoules: 800, avg_hr: 110, max_hr: 170 }];
      insertCycles(initial);

      const updated: CycleInput[] = [{ id: '1', date: '2025-01-01', strain: 15.0, kilojoules: 1200, avg_hr: 120, max_hr: 180 }];
      insertCycles(updated);

      const result = getLatestCycle();
      expect(result).toMatchObject({ id: '1', strain: 15.0, kilojoules: 1200 });
    });

    it('should handle empty array gracefully', () => {
      expect(() => insertCycles([])).not.toThrow();
    });
  });

  describe('Recoveries - Batch Upsert', () => {
    it('should insert new recoveries', () => {
      const recoveries: RecoveryInput[] = [
        { id: '1', date: '2025-01-01', score: 75, hrv: 65, rhr: 55, spo2: 98, skin_temp: 98.2 },
        { id: '2', date: '2025-01-02', score: 80, hrv: 70, rhr: 53, spo2: 99, skin_temp: 98.3 },
      ];

      insertRecoveries(recoveries);

      const result = getLatestRecovery();
      expect(result).toMatchObject({ id: '2', date: '2025-01-02', score: 80 });
    });

    it('should upsert existing recoveries', () => {
      const initial: RecoveryInput[] = [{ id: '1', date: '2025-01-01', score: 70, hrv: 60, rhr: 56, spo2: 97, skin_temp: 98.0 }];
      insertRecoveries(initial);

      const updated: RecoveryInput[] = [{ id: '1', date: '2025-01-01', score: 85, hrv: 75, rhr: 52, spo2: 99, skin_temp: 98.5 }];
      insertRecoveries(updated);

      const result = getLatestRecovery();
      expect(result).toMatchObject({ id: '1', score: 85, hrv: 75 });
    });
  });

  describe('Sleeps - Batch Upsert', () => {
    it('should insert new sleeps', () => {
      const sleeps: SleepInput[] = [
        { id: '1', date: '2025-01-01', performance: 85, rem_min: 90, sws_min: 120, light_min: 150, respiration: 14, sleep_debt_min: 30 },
        { id: '2', date: '2025-01-02', performance: 90, rem_min: 100, sws_min: 130, light_min: 160, respiration: 13, sleep_debt_min: 20 },
      ];

      insertSleeps(sleeps);

      const result = getLatestSleep();
      expect(result).toMatchObject({ id: '2', date: '2025-01-02', performance: 90 });
    });
  });

  describe('Lifelogs - Batch Upsert', () => {
    it('should insert new lifelogs', () => {
      const lifelogs: LifelogInput[] = [
        { id: '1', date: '2025-01-01', title: 'Test Log 1', manipulation_count: 5, wrath_deployed: 1, raw_json: '{}' },
        { id: '2', date: '2025-01-01', title: 'Test Log 2', manipulation_count: 3, wrath_deployed: 0, raw_json: '{}' },
      ];

      insertLifelogs(lifelogs);

      const results = getLifelogsForDate('2025-01-01');
      expect(results).toHaveLength(2);
      // Check both lifelogs exist (order may vary due to same timestamp)
      const manipulationCounts = results.map(r => r.manipulation_count);
      expect(manipulationCounts).toContain(5);
      expect(manipulationCounts).toContain(3);
    });

    it('should calculate unbending score correctly', () => {
      const lifelogs: LifelogInput[] = [
        { id: '1', date: '2025-01-01', title: 'Log 1', manipulation_count: 5, wrath_deployed: 1, raw_json: '{}' },
        { id: '2', date: '2025-01-01', title: 'Log 2', manipulation_count: 3, wrath_deployed: 1, raw_json: '{}' },
      ];

      insertLifelogs(lifelogs);
      calculateUnbendingScore('2025-01-01');

      const scores = getUnbendingScores('2025-01-01', '2025-01-01');
      expect(scores).toHaveLength(1);
      // Total manipulations: 8, total wrath: 2, score: 2/8 * 100 = 25%
      expect(scores[0].unbending_score).toBeCloseTo(25, 1);
    });
  });

  describe('Tokens - Batch Upsert', () => {
    it('should insert new tokens', () => {
      const tokens: TokenInput[] = [
        { provider: 'whoop', access_token_enc: 'enc_access', refresh_token_enc: 'enc_refresh', expires_at: 1735689600 },
      ];

      insertTokens(tokens);

      const result = getToken('whoop');
      expect(result).toMatchObject({ provider: 'whoop', access_token_enc: 'enc_access' });
    });

    it('should upsert existing tokens', () => {
      const initial: TokenInput[] = [
        { provider: 'whoop', access_token_enc: 'old_token', refresh_token_enc: 'old_refresh', expires_at: 1735689600 },
      ];
      insertTokens(initial);

      const updated: TokenInput[] = [
        { provider: 'whoop', access_token_enc: 'new_token', refresh_token_enc: 'new_refresh', expires_at: 1735776000 },
      ];
      insertTokens(updated);

      const result = getToken('whoop');
      expect(result).toMatchObject({ access_token_enc: 'new_token', refresh_token_enc: 'new_refresh' });
    });
  });

  describe('Scores - Batch Upsert', () => {
    it('should insert new scores', () => {
      const scores: ScoreInput[] = [
        { date: '2025-01-01', unbending_score: 25.5, recovery_compliance: 100 },
        { date: '2025-01-02', unbending_score: 30.0, recovery_compliance: 100 },
      ];

      insertScores(scores);

      const results = getUnbendingScores('2025-01-01', '2025-01-02');
      expect(results).toHaveLength(2);
    });
  });

  describe('Settings - Batch Upsert', () => {
    it('should insert new settings', () => {
      const settings: SettingInput[] = [
        { key: 'theme', value_enc: 'encrypted_dark' },
        { key: 'notifications', value_enc: 'encrypted_true' },
      ];

      insertSettings(settings);

      const result = getSetting('theme');
      expect(result).toMatchObject({ key: 'theme', value_enc: 'encrypted_dark' });
    });

    it('should upsert existing settings', () => {
      const initial: SettingInput[] = [{ key: 'theme', value_enc: 'encrypted_light' }];
      insertSettings(initial);

      const updated: SettingInput[] = [{ key: 'theme', value_enc: 'encrypted_dark' }];
      insertSettings(updated);

      const result = getSetting('theme');
      expect(result).toMatchObject({ value_enc: 'encrypted_dark' });
    });
  });

  describe('Aggregated Metrics Queries', () => {
    beforeEach(() => {
      // Insert test data for last 7 days
      const cycles: CycleInput[] = [];
      const recoveries: RecoveryInput[] = [];
      const sleeps: SleepInput[] = [];
      const lifelogs: LifelogInput[] = [];
      const scores: ScoreInput[] = [];

      for (let i = 0; i < 7; i++) {
        const date = `2025-01-0${i + 1}`;
        cycles.push({ id: `c${i}`, date, strain: 10 + i, kilojoules: 1000 + i * 100, avg_hr: 120, max_hr: 180 });
        recoveries.push({ id: `r${i}`, date, score: 70 + i, hrv: 60, rhr: 55, spo2: 98, skin_temp: 98.2 });
        sleeps.push({ id: `s${i}`, date, performance: 80 + i, rem_min: 90, sws_min: 120, light_min: 150, respiration: 14, sleep_debt_min: 30 });
        lifelogs.push({ id: `l${i}`, date, title: `Log ${i}`, manipulation_count: 5, wrath_deployed: 1, raw_json: '{}' });
        scores.push({ date, unbending_score: 20.0 + i, recovery_compliance: 100 });
      }

      insertCycles(cycles);
      insertRecoveries(recoveries);
      insertSleeps(sleeps);
      insertLifelogs(lifelogs);
      insertScores(scores);
    });

    it('should get metrics for last 7 days', () => {
      const metrics = getMetricsLastNDays(7);

      expect(metrics).toHaveLength(7);
      expect(metrics[0]).toHaveProperty('date');
      expect(metrics[0]).toHaveProperty('strain');
      expect(metrics[0]).toHaveProperty('recovery_score');
      expect(metrics[0]).toHaveProperty('sleep_performance');
      expect(metrics[0]).toHaveProperty('manipulation_count');
      expect(metrics[0]).toHaveProperty('wrath_deployed');
      expect(metrics[0]).toHaveProperty('unbending_score');
    });

    it('should order metrics by date descending', () => {
      const metrics = getMetricsLastNDays(7);

      expect(metrics[0].date).toBe('2025-01-07');
      expect(metrics[6].date).toBe('2025-01-01');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values in batch upserts', () => {
      const cycles: CycleInput[] = [
        { id: '1', date: '2025-01-01', strain: null, kilojoules: null, avg_hr: null, max_hr: null },
      ];

      insertCycles(cycles);

      const result = getLatestCycle();
      expect(result).toMatchObject({ id: '1', strain: null, kilojoules: null });
    });

    it('should return null for missing records', () => {
      expect(getLatestRecovery()).toBeNull();
      expect(getLatestCycle()).toBeNull();
      expect(getLatestSleep()).toBeNull();
      expect(getToken('whoop')).toBeNull();
      expect(getSetting('nonexistent')).toBeNull();
    });

    it('should return empty array for missing lifelogs', () => {
      const results = getLifelogsForDate('2025-01-01');
      expect(results).toEqual([]);
    });

    it('should calculate null unbending score when no manipulations', () => {
      calculateUnbendingScore('2025-01-01');

      const scores = getUnbendingScores('2025-01-01', '2025-01-01');
      expect(scores).toHaveLength(1);
      expect(scores[0].unbending_score).toBeNull();
    });
  });
});
