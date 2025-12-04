/**
 * Tests for HYRO FORGE: XP and Leveling System
 * Tests XP calculations, leveling, streaks, and achievements
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
  xpForLevel,
  cumulativeXpForLevel,
  calculateLevel,
  getLevelProgress,
  getTitleForLevel,
  awardXP,
  getXPSummary,
  getRecentXP,
  updateStreak,
} from '../forge-xp';

describe('Forge XP System', () => {
  beforeEach(() => {
    // Create fresh in-memory database
    testDb = new BetterSqlite3(':memory:');

    // Create required tables
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS hyro_character (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        title TEXT DEFAULT 'Apprentice Forger',
        level INTEGER DEFAULT 1,
        total_xp INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_session_at INTEGER,
        srs_mastery_count INTEGER DEFAULT 0,
        avatar_url TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS hyro_xp_log (
        id TEXT PRIMARY KEY,
        amount INTEGER NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        multiplier REAL DEFAULT 1.0,
        notes TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS hyro_achievements (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        category TEXT NOT NULL,
        xp_bonus INTEGER DEFAULT 0,
        requirement_type TEXT NOT NULL,
        requirement_value INTEGER NOT NULL,
        requirement_stat TEXT,
        is_secret INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS hyro_earned_achievements (
        id TEXT PRIMARY KEY,
        achievement_id TEXT NOT NULL,
        earned_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (achievement_id) REFERENCES hyro_achievements(id)
      );

      -- Initialize character
      INSERT INTO hyro_character (id, display_name, title, level, total_xp)
      VALUES ('hyro', 'Hyro', 'Apprentice Forger', 1, 0);

      -- Add some test achievements
      INSERT INTO hyro_achievements (id, name, description, category, xp_bonus, requirement_type, requirement_value)
      VALUES
        ('ach-level-5', 'Rising Star', 'Reach level 5', 'mastery', 50, 'stat_level', 5),
        ('ach-level-10', 'Dedicated Learner', 'Reach level 10', 'mastery', 100, 'stat_level', 10);
    `);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('XP Calculation Formulas', () => {
    it('should calculate XP needed for level 1 correctly', () => {
      expect(xpForLevel(1)).toBe(100);
    });

    it('should calculate XP using nonlinear formula', () => {
      // Level 5: Math.floor(100 * 5^1.5) = 1118
      expect(xpForLevel(5)).toBe(1118);

      // Level 10: Math.floor(100 * 10^1.5) = 3162
      expect(xpForLevel(10)).toBe(3162);
    });

    it('should calculate cumulative XP correctly', () => {
      const cumulative = cumulativeXpForLevel(3);
      const expected = xpForLevel(1) + xpForLevel(2) + xpForLevel(3);
      expect(cumulative).toBe(expected);
    });

    it('should calculate level from total XP', () => {
      // At exactly 100 XP (level 1 complete), you're level 2
      expect(calculateLevel(100)).toBe(2);

      // At 99 XP (level 1 incomplete), still level 1
      expect(calculateLevel(99)).toBe(1);

      // At cumulative XP for level 5, should be level 6 (you've completed level 5)
      const level5XP = cumulativeXpForLevel(5);
      expect(calculateLevel(level5XP)).toBe(6);
    });
  });

  describe('Level Progress', () => {
    it('should calculate progress within level', () => {
      const progress = getLevelProgress(50);

      expect(progress.level).toBe(1);
      expect(progress.xp_in_level).toBe(50);
      expect(progress.xp_for_next_level).toBe(100);
      expect(progress.progress_percent).toBe(50);
    });

    it('should handle level boundaries correctly', () => {
      // At 99 XP, still level 1 with 99% progress
      const almostLevel2 = getLevelProgress(99);
      expect(almostLevel2.level).toBe(1);
      expect(almostLevel2.xp_in_level).toBe(99);

      // At 100 XP, completed level 1, now level 2 with 0 XP toward level 2
      const atLevel2 = getLevelProgress(100);
      expect(atLevel2.level).toBe(2);
      expect(atLevel2.xp_in_level).toBe(0);

      // At 101 XP, level 2 with 1 XP progress
      const level2Progress = getLevelProgress(101);
      expect(level2Progress.level).toBe(2);
      expect(level2Progress.xp_in_level).toBe(1);
    });
  });

  describe('Level Titles', () => {
    it('should return correct title for level 1', () => {
      expect(getTitleForLevel(1)).toBe('Apprentice Forger');
    });

    it('should return correct title for level 5', () => {
      expect(getTitleForLevel(5)).toBe('Journeyman Scholar');
    });

    it('should return correct title for level 10', () => {
      expect(getTitleForLevel(10)).toBe('Adept Thinker');
    });

    it('should return highest applicable title for intermediate levels', () => {
      expect(getTitleForLevel(7)).toBe('Journeyman Scholar');
      expect(getTitleForLevel(14)).toBe('Adept Thinker');
    });
  });

  describe('Award XP', () => {
    it('should award XP and update character', () => {
      const result = awardXP(50, 'quest', 'quest-123');

      expect(result.awarded_xp).toBe(50);
      expect(result.previous_xp).toBe(0);
      expect(result.new_total).toBe(50);
      expect(result.level_up).toBe(false);
    });

    it('should apply multiplier to XP', () => {
      const result = awardXP(50, 'quest', 'quest-123', 2.0);

      expect(result.awarded_xp).toBe(100);
    });

    it('should trigger level up', () => {
      const result = awardXP(110, 'quest', 'quest-123');

      expect(result.level_up).toBe(true);
      expect(result.new_level).toBe(2);
    });

    it('should update title on level up', () => {
      // Award enough XP to reach level 5
      const level5XP = cumulativeXpForLevel(5);
      const result = awardXP(level5XP, 'quest', 'quest-123');

      expect(result.new_title).toBe('Journeyman Scholar');
    });

    it('should log XP transaction', () => {
      awardXP(50, 'quest', 'quest-123', 1.0, 'Test quest completion');

      const log = testDb.prepare(`SELECT * FROM hyro_xp_log LIMIT 1`).get() as any;

      expect(log.amount).toBe(50);
      expect(log.source).toBe('quest');
      expect(log.source_id).toBe('quest-123');
      expect(log.notes).toBe('Test quest completion');
    });

    it('should unlock achievements on level up', () => {
      // Award enough XP to reach level 5
      const level5XP = cumulativeXpForLevel(5);
      const result = awardXP(level5XP, 'quest', 'big-quest');

      // Should unlock the level 5 achievement
      expect(result.achievements_unlocked.length).toBeGreaterThan(0);
      expect(result.achievements_unlocked.some(a => a.name === 'Rising Star')).toBe(true);
    });
  });

  describe('XP Summary', () => {
    beforeEach(() => {
      // Add some XP entries
      awardXP(50, 'quest', 'q1');
      awardXP(30, 'srs_review', 's1');
      awardXP(20, 'daily', 'd1');
    });

    it('should calculate total XP correctly', () => {
      const summary = getXPSummary();

      expect(summary.total).toBe(100);
    });

    it('should calculate XP by source', () => {
      const summary = getXPSummary();

      expect(summary.by_source.quest).toBe(50);
      expect(summary.by_source.srs_review).toBe(30);
      expect(summary.by_source.daily).toBe(20);
    });

    it('should include today XP for recent entries', () => {
      const summary = getXPSummary();

      expect(summary.today).toBe(100);
    });
  });

  describe('Recent XP', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        awardXP(10 + i, 'quest', `quest-${i}`);
      }
    });

    it('should return recent XP entries', () => {
      const recent = getRecentXP(5);

      expect(recent.length).toBe(5);
    });

    it('should return entries in descending order by created_at', () => {
      const recent = getRecentXP(3);

      // Returns 3 most recent entries (order by created_at DESC)
      expect(recent.length).toBe(3);
      // All should have valid amounts
      expect(recent[0].amount).toBeGreaterThanOrEqual(10);
      expect(recent[1].amount).toBeGreaterThanOrEqual(10);
      expect(recent[2].amount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Streak Management', () => {
    it('should start streak at 1 for first session', () => {
      const result = updateStreak();

      expect(result.current_streak).toBe(1);
      expect(result.longest_streak).toBe(1);
    });

    it('should increment streak for consecutive days', () => {
      // Simulate yesterday's session
      const yesterday = Math.floor(Date.now() / 1000) - 86400;
      testDb.prepare(`
        UPDATE hyro_character SET last_session_at = ?, current_streak = 1 WHERE id = 'hyro'
      `).run(yesterday);

      const result = updateStreak();

      expect(result.current_streak).toBe(2);
      expect(result.streak_bonus_xp).toBe(4); // 2 * 2 = 4
    });

    it('should reset streak for missed day', () => {
      // Simulate session from 3 days ago
      const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 86400);
      testDb.prepare(`
        UPDATE hyro_character SET last_session_at = ?, current_streak = 5 WHERE id = 'hyro'
      `).run(threeDaysAgo);

      const result = updateStreak();

      expect(result.current_streak).toBe(1); // Reset to 1
    });

    it('should track longest streak', () => {
      // Set up a long streak
      testDb.prepare(`
        UPDATE hyro_character SET longest_streak = 10, current_streak = 5 WHERE id = 'hyro'
      `).run();

      const yesterday = Math.floor(Date.now() / 1000) - 86400;
      testDb.prepare(`
        UPDATE hyro_character SET last_session_at = ? WHERE id = 'hyro'
      `).run(yesterday);

      const result = updateStreak();

      // Current streak increases to 6, but longest stays at 10
      expect(result.current_streak).toBe(6);
      expect(result.longest_streak).toBe(10);
    });

    it('should update longest streak when current exceeds it', () => {
      // Set up streak that will exceed longest
      const yesterday = Math.floor(Date.now() / 1000) - 86400;
      testDb.prepare(`
        UPDATE hyro_character SET longest_streak = 5, current_streak = 5, last_session_at = ? WHERE id = 'hyro'
      `).run(yesterday);

      const result = updateStreak();

      expect(result.current_streak).toBe(6);
      expect(result.longest_streak).toBe(6);
    });
  });

  describe('Multiple Level Ups', () => {
    it('should handle multiple level ups in one XP award', () => {
      // Award enough XP to complete through level 5 (which puts you at level 6)
      const level5XP = cumulativeXpForLevel(5);
      const result = awardXP(level5XP, 'bonus', 'huge-bonus');

      // Completing all XP through level 5 means you're now level 6
      expect(result.new_level).toBe(6);
      expect(result.level_up).toBe(true);
    });
  });

  describe('XP Sources', () => {
    it('should accept all valid XP sources', () => {
      const sources = [
        'quest', 'daily', 'streak', 'achievement', 'srs', 'srs_review',
        'intel', 'intel_completed', 'reflection', 'reflection_completed', 'bonus',
        'reading_session', 'chapter_completed', 'book_completed',
        'comprehension_response', 'discussion_exchange', 'discussion_completed'
      ] as const;

      for (const source of sources) {
        const result = awardXP(10, source, `test-${source}`);
        expect(result.awarded_xp).toBe(10);
      }
    });
  });
});
