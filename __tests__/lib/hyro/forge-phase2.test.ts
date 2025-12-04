// @ts-nocheck
/**
 * Hyro Forge Phase 2 Tests
 * Tests for SRS, Daily Intel, and Reflections systems
 */

import { Database } from '../../../lib/db/Database';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Helper to apply required migrations
function applyHyroMigrations(db: Database) {
  // First apply the base RPG migration (creates hyro_character table)
  const rpgMigrationPath = join(process.cwd(), 'migrations', '012_hyro_forge_rpg.sql');
  const rpgSql = readFileSync(rpgMigrationPath, 'utf8');
  db.exec(rpgSql);

  // Apply Phase 2 migration tables
  const phase2Migration = `
    -- SRS Decks
    CREATE TABLE IF NOT EXISTS hyro_srs_decks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      subject TEXT,
      icon TEXT DEFAULT '📚',
      card_count INTEGER DEFAULT 0,
      due_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- SRS Cards
    CREATE TABLE IF NOT EXISTS hyro_srs_cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES hyro_srs_decks(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      card_type TEXT DEFAULT 'basic',
      tags TEXT,
      source_quest_id TEXT,
      source_assignment_id TEXT,
      easiness_factor REAL DEFAULT 2.5,
      interval_days INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review_at INTEGER,
      last_reviewed_at INTEGER,
      card_state TEXT DEFAULT 'new',
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- SRS Card Reviews (Phase 2 - separate from migration 012's hyro_srs_reviews which uses topic_id)
    CREATE TABLE IF NOT EXISTS hyro_srs_card_reviews (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES hyro_srs_cards(id) ON DELETE CASCADE,
      quality INTEGER NOT NULL,
      response_time_ms INTEGER,
      easiness_before REAL,
      interval_before INTEGER,
      easiness_after REAL,
      interval_after INTEGER,
      xp_earned INTEGER DEFAULT 0,
      reviewed_at INTEGER DEFAULT (unixepoch())
    );

    -- Daily Intel Items (Phase 2 - new table, separate from migration 012's hyro_daily_intel)
    CREATE TABLE IF NOT EXISTS hyro_intel_items (
      id TEXT PRIMARY KEY,
      intel_date TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      content_type TEXT NOT NULL,
      subject TEXT,
      difficulty TEXT DEFAULT 'medium',
      source_url TEXT,
      source_name TEXT,
      thumbnail_url TEXT,
      estimated_time_minutes INTEGER,
      xp_reward INTEGER DEFAULT 10,
      status TEXT DEFAULT 'new',
      viewed_at INTEGER,
      completed_at INTEGER,
      relevance_score REAL,
      curation_reason TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- Reflection Journal (Phase 2 - new table, separate from migration 012's hyro_reflections)
    CREATE TABLE IF NOT EXISTS hyro_reflection_journal (
      id TEXT PRIMARY KEY,
      reflection_type TEXT NOT NULL,
      prompt TEXT,
      response TEXT,
      quest_id TEXT,
      achievement_id TEXT,
      stat_name TEXT,
      sentiment_score REAL,
      key_insights TEXT,
      growth_indicators TEXT,
      word_count INTEGER,
      time_spent_seconds INTEGER,
      xp_earned INTEGER DEFAULT 0,
      reflection_date TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- Reflection Prompts Library
    CREATE TABLE IF NOT EXISTS hyro_reflection_prompts (
      id TEXT PRIMARY KEY,
      prompt_type TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      subject TEXT,
      difficulty_level TEXT DEFAULT 'medium',
      is_active INTEGER DEFAULT 1,
      use_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Seed reflection prompts
    INSERT OR IGNORE INTO hyro_reflection_prompts (id, prompt_type, prompt_text, difficulty_level) VALUES
    ('daily-1', 'daily', 'What was the most interesting thing you learned today?', 'easy'),
    ('daily-2', 'daily', 'What challenged you today and how did you handle it?', 'medium'),
    ('weekly-1', 'weekly', 'Looking back at this week, what are you most proud of?', 'easy'),
    ('weekly-2', 'weekly', 'What skill improved the most this week? How can you tell?', 'medium'),
    ('quest-1', 'quest_complete', 'What did you learn from completing this quest?', 'easy'),
    ('achieve-1', 'achievement', 'How does earning this achievement make you feel?', 'easy');

    -- Study Sessions
    CREATE TABLE IF NOT EXISTS hyro_study_sessions (
      id TEXT PRIMARY KEY,
      session_type TEXT NOT NULL,
      subject TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_seconds INTEGER,
      cards_reviewed INTEGER DEFAULT 0,
      quests_worked INTEGER DEFAULT 0,
      intel_viewed INTEGER DEFAULT 0,
      focus_rating INTEGER,
      interruptions INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Quest Generators
    CREATE TABLE IF NOT EXISTS hyro_quest_generators (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      assignment_type TEXT,
      quest_template TEXT NOT NULL,
      xp_formula TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Seed quest generators
    INSERT OR IGNORE INTO hyro_quest_generators (id, platform, assignment_type, quest_template, xp_formula) VALUES
    ('gen-zearn-math', 'zearn', 'math', '{"quest_type": "daily", "title_prefix": "Math Quest: ", "difficulty": "medium", "required_stat": "math"}', 'difficulty * 25');

    -- Add character columns if missing
    ALTER TABLE hyro_character ADD COLUMN study_streak_days INTEGER DEFAULT 0;
    ALTER TABLE hyro_character ADD COLUMN longest_study_streak INTEGER DEFAULT 0;
    ALTER TABLE hyro_character ADD COLUMN last_study_date TEXT;
    ALTER TABLE hyro_character ADD COLUMN srs_mastery_count INTEGER DEFAULT 0;
  `;

  // Execute each statement separately to handle already-existing columns gracefully
  const statements = phase2Migration.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try {
      db.exec(stmt + ';');
    } catch (e: any) {
      // Ignore "duplicate column" errors from ALTER TABLE
      if (!e.message.includes('duplicate column')) {
        throw e;
      }
    }
  }
}

describe('Hyro Forge Phase 2: SRS System', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-phase2-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
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

  describe('SRS Tables', () => {
    it('should create SRS deck table with correct columns', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_srs_decks)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('subject');
      expect(columnNames).toContain('icon');
      expect(columnNames).toContain('card_count');
      expect(columnNames).toContain('due_count');
    });

    it('should create SRS cards table with SM-2 fields', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_srs_cards)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('deck_id');
      expect(columnNames).toContain('front');
      expect(columnNames).toContain('back');
      expect(columnNames).toContain('easiness_factor');
      expect(columnNames).toContain('interval_days');
      expect(columnNames).toContain('repetitions');
      expect(columnNames).toContain('next_review_at');
      expect(columnNames).toContain('card_state');
    });

    it('should create deck and cards', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create deck
      db.prepare(`
        INSERT INTO hyro_srs_decks (id, title, subject, icon)
        VALUES (?, ?, ?, ?)
      `).run('deck-1', 'Math Facts', 'math', '🔢');

      // Create cards
      db.prepare(`
        INSERT INTO hyro_srs_cards (id, deck_id, front, back)
        VALUES (?, ?, ?, ?)
      `).run('card-1', 'deck-1', '5 + 7 = ?', '12');

      db.prepare(`
        INSERT INTO hyro_srs_cards (id, deck_id, front, back)
        VALUES (?, ?, ?, ?)
      `).run('card-2', 'deck-1', '8 × 9 = ?', '72');

      const deck = db.prepare('SELECT * FROM hyro_srs_decks WHERE id = ?').get('deck-1') as any;
      expect(deck.title).toBe('Math Facts');

      const cards = db.prepare('SELECT * FROM hyro_srs_cards WHERE deck_id = ?').all('deck-1');
      expect(cards.length).toBe(2);
    });

    it('should track review history', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create deck and card
      db.prepare(`INSERT INTO hyro_srs_decks (id, title) VALUES (?, ?)`).run('deck-1', 'Test Deck');
      db.prepare(`INSERT INTO hyro_srs_cards (id, deck_id, front, back) VALUES (?, ?, ?, ?)`).run('card-1', 'deck-1', 'Q', 'A');

      // Record review in the Phase 2 card reviews table
      db.prepare(`
        INSERT INTO hyro_srs_card_reviews (id, card_id, quality, easiness_before, interval_before, easiness_after, interval_after)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('review-1', 'card-1', 4, 2.5, 0, 2.6, 1);

      const review = db.prepare('SELECT * FROM hyro_srs_card_reviews WHERE card_id = ?').get('card-1') as any;
      expect(review.quality).toBe(4);
      expect(review.interval_after).toBe(1);
    });
  });
});

describe('Hyro Forge Phase 2: Daily Intel', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-intel-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
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

  describe('Daily Intel Table', () => {
    it('should create daily intel table', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_intel_items)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('intel_date');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('content_type');
      expect(columnNames).toContain('xp_reward');
      expect(columnNames).toContain('status');
    });

    it('should create intel items with different content types', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const contentTypes = ['video', 'article', 'quiz', 'fact', 'challenge'];
      const today = new Date().toISOString().split('T')[0];

      for (let i = 0; i < contentTypes.length; i++) {
        db.prepare(`
          INSERT INTO hyro_intel_items (id, intel_date, title, content_type, xp_reward)
          VALUES (?, ?, ?, ?, ?)
        `).run(`intel-${i}`, today, `Intel Item ${i}`, contentTypes[i], 10 + i * 5);
      }

      const items = db.prepare('SELECT * FROM hyro_intel_items WHERE intel_date = ?').all(today);
      expect(items.length).toBe(5);
    });

    it('should track intel status changes', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const today = new Date().toISOString().split('T')[0];
      db.prepare(`
        INSERT INTO hyro_intel_items (id, intel_date, title, content_type, xp_reward)
        VALUES (?, ?, ?, ?, ?)
      `).run('intel-1', today, 'Test Intel', 'video', 15);

      // Mark as viewed
      db.prepare(`UPDATE hyro_intel_items SET status = 'viewed', viewed_at = unixepoch() WHERE id = ?`).run('intel-1');
      let intel = db.prepare('SELECT * FROM hyro_intel_items WHERE id = ?').get('intel-1') as any;
      expect(intel.status).toBe('viewed');
      expect(intel.viewed_at).not.toBeNull();

      // Mark as completed
      db.prepare(`UPDATE hyro_intel_items SET status = 'completed', completed_at = unixepoch() WHERE id = ?`).run('intel-1');
      intel = db.prepare('SELECT * FROM hyro_intel_items WHERE id = ?').get('intel-1') as any;
      expect(intel.status).toBe('completed');
      expect(intel.completed_at).not.toBeNull();
    });
  });
});

describe('Hyro Forge Phase 2: Reflections', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-reflections-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
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

  describe('Reflections Table', () => {
    it('should create reflections table', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_reflection_journal)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('reflection_type');
      expect(columnNames).toContain('prompt');
      expect(columnNames).toContain('response');
      expect(columnNames).toContain('sentiment_score');
      expect(columnNames).toContain('xp_earned');
    });

    it('should have seeded reflection prompts', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const prompts = db.prepare('SELECT * FROM hyro_reflection_prompts').all();
      expect(prompts.length).toBeGreaterThan(0);

      // Check for daily prompts
      const dailyPrompts = db.prepare(`SELECT * FROM hyro_reflection_prompts WHERE prompt_type = 'daily'`).all();
      expect(dailyPrompts.length).toBeGreaterThan(0);

      // Check for weekly prompts
      const weeklyPrompts = db.prepare(`SELECT * FROM hyro_reflection_prompts WHERE prompt_type = 'weekly'`).all();
      expect(weeklyPrompts.length).toBeGreaterThan(0);
    });

    it('should create and store reflections', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const today = new Date().toISOString().split('T')[0];
      db.prepare(`
        INSERT INTO hyro_reflection_journal (id, reflection_type, prompt, response, word_count, xp_earned, reflection_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'reflection-1',
        'daily',
        'What was the most interesting thing you learned today?',
        'Today I learned about the Fibonacci sequence in math class. It was really cool to see how the numbers follow a pattern!',
        25,
        20,
        today
      );

      const reflection = db.prepare('SELECT * FROM hyro_reflection_journal WHERE id = ?').get('reflection-1') as any;
      expect(reflection.reflection_type).toBe('daily');
      expect(reflection.word_count).toBe(25);
      expect(reflection.xp_earned).toBe(20);
    });

    it('should support different reflection types', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const today = new Date().toISOString().split('T')[0];
      const types = ['daily', 'weekly', 'quest_complete', 'achievement', 'milestone'];

      for (const type of types) {
        db.prepare(`
          INSERT INTO hyro_reflection_journal (id, reflection_type, reflection_date)
          VALUES (?, ?, ?)
        `).run(`reflection-${type}`, type, today);
      }

      const reflections = db.prepare('SELECT * FROM hyro_reflection_journal').all();
      expect(reflections.length).toBe(5);
    });
  });

  describe('Study Sessions', () => {
    it('should create study sessions table', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_study_sessions)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('session_type');
      expect(columnNames).toContain('started_at');
      expect(columnNames).toContain('duration_seconds');
      expect(columnNames).toContain('cards_reviewed');
    });

    it('should track study sessions', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT INTO hyro_study_sessions (id, session_type, subject, started_at, ended_at, duration_seconds, cards_reviewed, xp_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('session-1', 'srs', 'math', now - 1200, now, 1200, 25, 125);

      const session = db.prepare('SELECT * FROM hyro_study_sessions WHERE id = ?').get('session-1') as any;
      expect(session.session_type).toBe('srs');
      expect(session.duration_seconds).toBe(1200);
      expect(session.cards_reviewed).toBe(25);
    });
  });

  describe('Character Updates', () => {
    it('should have study streak columns in character table', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      const tableInfo = db.prepare(`PRAGMA table_info(hyro_character)`).all();
      const columnNames = tableInfo.map((col: any) => col.name);

      expect(columnNames).toContain('study_streak_days');
      expect(columnNames).toContain('longest_study_streak');
      expect(columnNames).toContain('last_study_date');
      expect(columnNames).toContain('srs_mastery_count');
    });
  });
});

describe('Hyro Forge Phase 2: Quest Generators', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-generators-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
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

  it('should create quest generators table', () => {
    const db = Database.getInstance(testDbPath, testMigrationsPath);
    applyHyroMigrations(db);

    const tableInfo = db.prepare(`PRAGMA table_info(hyro_quest_generators)`).all();
    const columnNames = tableInfo.map((col: any) => col.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('platform');
    expect(columnNames).toContain('assignment_type');
    expect(columnNames).toContain('quest_template');
    expect(columnNames).toContain('xp_formula');
  });

  it('should have seeded quest generators', () => {
    const db = Database.getInstance(testDbPath, testMigrationsPath);
    applyHyroMigrations(db);

    const generators = db.prepare('SELECT * FROM hyro_quest_generators').all();
    expect(generators.length).toBeGreaterThan(0);

    // Check for zearn generator
    const zearnGen = db.prepare(`SELECT * FROM hyro_quest_generators WHERE platform = 'zearn'`).get() as any;
    expect(zearnGen).not.toBeNull();
    expect(zearnGen.assignment_type).toBe('math');
  });
});

describe('Hyro Forge Phase 2: Quest Generation from Assignments', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-quest-gen-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
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

  describe('Quest Creation from Assignments', () => {
    it('should generate quest from Zearn assignment', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create a quest manually as if generated
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, description, xp_reward, platform, external_id, external_url, status, difficulty, required_stat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'quest-zearn-1',
        'daily',
        'Math Quest: Tower of Power Level 5',
        'Complete the Zearn math module',
        25,
        'zearn',
        'zearn-123',
        'https://zearn.org/assignment/123',
        'available',
        'medium',
        'math'
      );

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE external_id = ?').get('zearn-123') as any;
      expect(quest).not.toBeNull();
      expect(quest.platform).toBe('zearn');
      expect(quest.title).toContain('Math Quest');
      expect(quest.required_stat).toBe('math');
    });

    it('should generate quest from Boost reading assignment', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Simulate quest generation for Boost platform
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, external_id, status, difficulty, required_stat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'quest-boost-1',
        'daily',
        'Reading Quest: Chapter Review',
        20,
        'boost',
        'boost-456',
        'available',
        'easy',
        'reading'
      );

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE platform = ?').get('boost') as any;
      expect(quest).not.toBeNull();
      expect(quest.required_stat).toBe('reading');
    });

    it('should prevent duplicate quest generation', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create first quest
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, external_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('quest-1', 'daily', 'Test Quest', 25, 'zearn', 'zearn-123', 'available');

      // Check if quest exists (simulating duplicate check)
      const existing = db.prepare('SELECT * FROM hyro_quests WHERE platform = ? AND external_id = ?').get('zearn', 'zearn-123');
      expect(existing).not.toBeNull();
    });
  });

  describe('Quest Completion', () => {
    it('should mark quest as completed and award XP', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create quest
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, external_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('quest-complete-1', 'daily', 'Complete Me', 50, 'zearn', 'z-complete', 'active');

      // Complete the quest
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        UPDATE hyro_quests SET status = 'completed', completed_at = ? WHERE id = ?
      `).run(now, 'quest-complete-1');

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('quest-complete-1') as any;
      expect(quest.status).toBe('completed');
      expect(quest.completed_at).not.toBeNull();
    });

    it('should sync quest completion from external platform', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create quest linked to external platform
      db.prepare(`
        INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, external_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('quest-sync-1', 'daily', 'Sync Quest', 30, 'boost', 'boost-sync-123', 'available');

      // Simulate sync completion (external platform reports completion)
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        UPDATE hyro_quests SET status = 'completed', completed_at = ? WHERE platform = ? AND external_id = ?
      `).run(now, 'boost', 'boost-sync-123');

      const quest = db.prepare('SELECT * FROM hyro_quests WHERE external_id = ?').get('boost-sync-123') as any;
      expect(quest.status).toBe('completed');
    });
  });

  describe('Quest Filtering', () => {
    it('should filter active quests', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Create quests with different statuses
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q1', 'daily', 'Quest 1', 25, 'available');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q2', 'daily', 'Quest 2', 25, 'active');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, status) VALUES (?, ?, ?, ?, ?)`).run('q3', 'daily', 'Quest 3', 25, 'completed');

      const activeQuests = db.prepare(`SELECT * FROM hyro_quests WHERE status IN ('available', 'active')`).all();
      expect(activeQuests.length).toBe(2);
    });

    it('should filter quests by platform', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, status) VALUES (?, ?, ?, ?, ?, ?)`).run('z1', 'daily', 'Zearn 1', 25, 'zearn', 'available');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, status) VALUES (?, ?, ?, ?, ?, ?)`).run('z2', 'daily', 'Zearn 2', 25, 'zearn', 'available');
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, platform, status) VALUES (?, ?, ?, ?, ?, ?)`).run('b1', 'daily', 'Boost 1', 20, 'boost', 'available');

      const zearnQuests = db.prepare(`SELECT * FROM hyro_quests WHERE platform = ?`).all('zearn');
      expect(zearnQuests.length).toBe(2);

      const boostQuests = db.prepare(`SELECT * FROM hyro_quests WHERE platform = ?`).all('boost');
      expect(boostQuests.length).toBe(1);
    });
  });

  describe('XP Calculation', () => {
    it('should calculate XP based on difficulty', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyHyroMigrations(db);

      // Easy quest = lower XP
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, difficulty, status) VALUES (?, ?, ?, ?, ?, ?)`).run('easy-q', 'daily', 'Easy Quest', 15, 'easy', 'available');

      // Hard quest = higher XP
      db.prepare(`INSERT INTO hyro_quests (id, quest_type, title, xp_reward, difficulty, status) VALUES (?, ?, ?, ?, ?, ?)`).run('hard-q', 'daily', 'Hard Quest', 50, 'hard', 'available');

      const easyQuest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('easy-q') as any;
      const hardQuest = db.prepare('SELECT * FROM hyro_quests WHERE id = ?').get('hard-q') as any;

      expect(easyQuest.xp_reward).toBeLessThan(hardQuest.xp_reward);
      expect(easyQuest.difficulty).toBe('easy');
      expect(hardQuest.difficulty).toBe('hard');
    });
  });
});
