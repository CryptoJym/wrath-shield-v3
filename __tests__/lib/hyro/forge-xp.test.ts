// @ts-nocheck
/**
 * Hyro Forge: XP System Tests
 * Tests for XP calculations, level progression, and awarding XP
 */

import { Database } from '../../../lib/db/Database';
import {
  xpForLevel,
  cumulativeXpForLevel,
  calculateLevel,
  getLevelProgress,
  getTitleForLevel,
  awardXP,
  getXPSummary,
  getRecentXP,
  updateStreak,
} from '../../../lib/hyro/forge-xp';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Helper to apply Hyro Forge migration manually (since test mode only applies 001, 002)
function applyForgeHyroMigration(db: Database) {
  const migrationPath = join(process.cwd(), 'migrations', '012_hyro_forge_rpg.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  db.exec(sql);
}

describe('Hyro Forge XP System', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-xp-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    // Remove WAL files too
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');

    // Reset singleton instance
    Database.resetInstance();
  });

  afterEach(() => {
    // Clean up after each test
    Database.resetInstance();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
  });

  describe('XP Formula Calculations', () => {
    it('should calculate XP needed for level 1 as 100', () => {
      expect(xpForLevel(1)).toBe(100);
    });

    it('should follow Grok\'s formula: 100 * level^1.5', () => {
      // Level 1: 100 * 1^1.5 = 100
      expect(xpForLevel(1)).toBe(100);

      // Level 5: 100 * 5^1.5 ≈ 1118 (actual: 1118.03...)
      expect(xpForLevel(5)).toBe(1118);

      // Level 10: 100 * 10^1.5 ≈ 3162
      expect(xpForLevel(10)).toBe(3162);
    });

    it('should calculate cumulative XP correctly', () => {
      // Level 1: 100
      expect(cumulativeXpForLevel(1)).toBe(100);

      // Level 2: 100 + 282 = 382
      const level2Cumulative = xpForLevel(1) + xpForLevel(2);
      expect(cumulativeXpForLevel(2)).toBe(level2Cumulative);
    });

    it('should calculate level from total XP', () => {
      // 0 XP = level 1
      expect(calculateLevel(0)).toBe(1);

      // 99 XP = still level 1
      expect(calculateLevel(99)).toBe(1);

      // 100 XP = level 2
      expect(calculateLevel(100)).toBe(2);

      // 382 XP (100 + 282) = level 3
      expect(calculateLevel(382)).toBe(3);
    });
  });

  describe('Level Progress', () => {
    it('should return correct progress within level', () => {
      // At 0 XP: Level 1, 0 XP into level, needs 100 XP for next
      const progress0 = getLevelProgress(0);
      expect(progress0.level).toBe(1);
      expect(progress0.xp_in_level).toBe(0);
      expect(progress0.xp_for_next_level).toBe(100);
      expect(progress0.progress_percent).toBe(0);

      // At 50 XP: Level 1, 50 XP into level, 50% progress
      const progress50 = getLevelProgress(50);
      expect(progress50.level).toBe(1);
      expect(progress50.xp_in_level).toBe(50);
      expect(progress50.progress_percent).toBe(50);
    });

    it('should handle level boundaries correctly', () => {
      // At exactly 100 XP: Level 2, 0 XP into level 2
      const progress100 = getLevelProgress(100);
      expect(progress100.level).toBe(2);
      expect(progress100.xp_in_level).toBe(0);
    });
  });

  describe('Title Progression', () => {
    it('should return Apprentice Forger for level 1', () => {
      expect(getTitleForLevel(1)).toBe('Apprentice Forger');
    });

    it('should return Journeyman Scholar for level 5+', () => {
      expect(getTitleForLevel(5)).toBe('Journeyman Scholar');
      expect(getTitleForLevel(6)).toBe('Journeyman Scholar');
    });

    it('should return higher titles at correct thresholds', () => {
      expect(getTitleForLevel(10)).toBe('Adept Thinker');
      expect(getTitleForLevel(15)).toBe('Master Learner');
      expect(getTitleForLevel(20)).toBe('Sage of Knowledge');
      expect(getTitleForLevel(25)).toBe('Grandmaster');
      expect(getTitleForLevel(30)).toBe('Legendary Forger');
    });
  });

  describe('XP Award System', () => {
    it('should award XP and update character', () => {
      // Initialize database with migrations
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Award XP
      const result = awardXP(100, 'quest', 'test-quest-1', 1.0, 'Test XP award');

      expect(result.previous_xp).toBe(0);
      expect(result.awarded_xp).toBe(100);
      expect(result.new_total).toBeGreaterThanOrEqual(100);
      expect(result.level_up).toBe(true);
      expect(result.previous_level).toBe(1);
      expect(result.new_level).toBe(2);
    });

    it('should apply XP multiplier', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const result = awardXP(100, 'quest', 'test-quest', 2.0, 'Double XP');

      expect(result.awarded_xp).toBe(200);
    });

    it('should record XP transaction in log', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      awardXP(50, 'daily', null, 1.0, 'Daily bonus');

      const log = db.prepare(
        'SELECT * FROM hyro_xp_log ORDER BY created_at DESC LIMIT 1'
      ).get() as { amount: number; source: string; notes: string };

      expect(log.amount).toBe(50);
      expect(log.source).toBe('daily');
      expect(log.notes).toBe('Daily bonus');
    });
  });

  describe('XP Summary', () => {
    it('should return XP summary by time period', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Award some XP
      awardXP(50, 'quest');
      awardXP(30, 'daily');

      const summary = getXPSummary();

      expect(summary.today).toBeGreaterThanOrEqual(80);
      expect(summary.this_week).toBeGreaterThanOrEqual(80);
      expect(summary.by_source.quest).toBeGreaterThanOrEqual(50);
      expect(summary.by_source.daily).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Recent XP', () => {
    it('should return recent XP transactions', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      awardXP(10, 'quest');
      awardXP(20, 'srs');
      awardXP(30, 'intel');

      const recent = getRecentXP(3);

      expect(recent.length).toBeGreaterThanOrEqual(3);
      // Most recent first
      expect(recent[0].amount).toBe(30);
      expect(recent[1].amount).toBe(20);
      expect(recent[2].amount).toBe(10);
    });
  });

  describe('Streak System', () => {
    it('should initialize streak on first session', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const result = updateStreak();

      expect(result.current_streak).toBe(1);
      expect(result.longest_streak).toBe(1);
      expect(result.streak_bonus_xp).toBe(0); // No bonus on first day
    });

    it('should maintain streak if called same day', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      updateStreak();
      const result = updateStreak();

      // Same day, streak stays at 1
      expect(result.current_streak).toBe(1);
    });
  });
});
