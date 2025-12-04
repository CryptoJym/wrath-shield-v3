// @ts-nocheck
/**
 * Hyro Forge: Quest System Tests
 * Tests for quest creation, completion, and XP rewards
 */

import { Database } from '../../../lib/db/Database';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Helper to apply Hyro Forge migration manually
function applyForgeHyroMigration(db: Database) {
  const migrationPath = join(process.cwd(), 'migrations', '012_hyro_forge_rpg.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  db.exec(sql);
}

describe('Hyro Forge Quest System', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-quests-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
    Database.resetInstance();
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
  });

  describe('Quest Table Structure', () => {
    it('should have hyro_quests table with correct columns', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_quests)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('quest_type');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('xp_reward');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('platform');
      expect(columnNames).toContain('external_id');
    });

    it('should support all quest types', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const questTypes = ['daily', 'weekly', 'epic', 'side', 'challenge'];

      for (const questType of questTypes) {
        const result = db.prepare(`
          INSERT INTO hyro_quests (id, quest_type, title, xp_reward)
          VALUES (?, ?, ?, ?)
        `).run(`quest_${questType}`, questType, `Test ${questType} quest`, 50);

        expect(result.changes).toBe(1);
      }

      const quests = db.prepare('SELECT * FROM hyro_quests').all();
      expect(quests.length).toBe(5);
    });
  });

  describe('Quest CRUD Operations', () => {
    it('should create a new quest', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const result = db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, description, xp_reward, required_stat, difficulty)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'test-quest-1',
        'daily',
        'Complete Math Assignment',
        'Finish the Zearn math module',
        100,
        'math',
        'medium'
      );

      expect(result.changes).toBe(1);

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('test-quest-1') as any;
      expect(quest.title).toBe('Complete Math Assignment');
      expect(quest.xp_reward).toBe(100);
      expect(quest.status).toBe('available');
    });

    it('should update quest status', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Create quest
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward)
        VALUES (?, ?, ?, ?)
      `).run('test-quest-2', 'daily', 'Test Quest', 50);

      // Update to active
      db.prepare(`
        UPDATE hyro_quests SET status = 'active', started_at = unixepoch() WHERE id = ?
      `).run('test-quest-2');

      let quest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('test-quest-2') as any;
      expect(quest.status).toBe('active');
      expect(quest.started_at).not.toBeNull();

      // Update to completed
      db.prepare(`
        UPDATE hyro_quests SET status = 'completed', completed_at = unixepoch() WHERE id = ?
      `).run('test-quest-2');

      quest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('test-quest-2') as any;
      expect(quest.status).toBe('completed');
      expect(quest.completed_at).not.toBeNull();
    });

    it('should filter quests by status', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Create multiple quests with different statuses
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q1', 'daily', 'Quest 1', 50, 'available');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q2', 'daily', 'Quest 2', 50, 'active');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q3', 'daily', 'Quest 3', 50, 'completed');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q4', 'weekly', 'Quest 4', 100, 'available');

      const availableQuests = db.prepare(`SELECT * FROM hyro_quests WHERE status = 'available'`).all();
      expect(availableQuests.length).toBe(2);

      const activeQuests = db.prepare(`SELECT * FROM hyro_quests WHERE status = 'active'`).all();
      expect(activeQuests.length).toBe(1);

      const completedQuests = db.prepare(`SELECT * FROM hyro_quests WHERE status = 'completed'`).all();
      expect(completedQuests.length).toBe(1);
    });
  });

  describe('Quest-Assignment Integration', () => {
    it('should link quests to external platforms', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Create quest from Zearn assignment
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, external_id, external_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'zearn-quest-1',
        'daily',
        'Tower of Power - Level 5',
        75,
        'zearn',
        'zearn-assignment-123',
        'https://zearn.org/assignment/123'
      );

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE platform = ?').get('zearn') as any;
      expect(quest.external_id).toBe('zearn-assignment-123');
      expect(quest.external_url).toContain('zearn.org');
    });

    it('should support recurring quests', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, is_recurring, recurrence_pattern)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('recurring-1', 'daily', 'Daily Reading', 25, 1, 'daily');

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('recurring-1') as any;
      expect(quest.is_recurring).toBe(1);
      expect(quest.recurrence_pattern).toBe('daily');
    });
  });

  describe('Quest Submissions', () => {
    it('should create submission for quest', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Create quest first
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward)
        VALUES (?, ?, ?, ?)
      `).run('quest-with-submission', 'daily', 'Writing Quest', 50);

      // Create submission
      db.prepare(`
        INSERT INTO hyro_submissions (id, quest_id, submission_type, content)
        VALUES (?, ?, ?, ?)
      `).run('submission-1', 'quest-with-submission', 'text', 'My essay about science');

      const submission = db.prepare('SELECT * FROM hyro_submissions WHERE quest_id = ?').get('quest-with-submission') as any;
      expect(submission.submission_type).toBe('text');
      expect(submission.content).toContain('essay');
      expect(submission.ai_review_status).toBe('pending');
    });

    it('should track AI review of submissions', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward)
        VALUES (?, ?, ?, ?)
      `).run('quest-reviewed', 'daily', 'Reviewed Quest', 50);

      db.prepare(`
        INSERT INTO hyro_submissions (id, quest_id, submission_type, content)
        VALUES (?, ?, ?, ?)
      `).run('submission-reviewed', 'quest-reviewed', 'text', 'Test submission');

      // Simulate AI review
      db.prepare(`
        UPDATE hyro_submissions
        SET ai_review_status = 'reviewed', ai_feedback = ?, ai_score = ?, ai_reviewed_at = unixepoch(), xp_awarded = ?
        WHERE id = ?
      `).run('Great work! Well organized thoughts.', 0.85, 50, 'submission-reviewed');

      const submission = db.prepare('SELECT * FROM hyro_submissions WHERE id = ?').get('submission-reviewed') as any;
      expect(submission.ai_review_status).toBe('reviewed');
      expect(submission.ai_score).toBe(0.85);
      expect(submission.xp_awarded).toBe(50);
    });
  });

  describe('Quest XP Integration', () => {
    it('should award XP when quest is completed', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Get initial character XP
      const initialChar = db.prepare('SELECT total_xp FROM hyro_character WHERE id = ?').get('hyro') as any;
      const initialXP = initialChar?.total_xp || 0;

      // Create and complete a quest
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status)
        VALUES (?, ?, ?, ?, ?)
      `).run('xp-quest', 'daily', 'XP Test Quest', 100, 'completed');

      // Simulate XP award (this would normally be done by forge-xp module)
      db.prepare(`
        UPDATE hyro_character
        SET total_xp = total_xp + 100
        WHERE id = ?
      `).run('hyro');

      const updatedChar = db.prepare('SELECT total_xp FROM hyro_character WHERE id = ?').get('hyro') as any;
      expect(updatedChar.total_xp).toBe(initialXP + 100);
    });
  });
});
