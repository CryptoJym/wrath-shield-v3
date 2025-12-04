-- ============================================================================
-- HYRO FORGE PHASE 2: SRS, Daily Intel, Reflections
-- Spaced Repetition System, Daily Intel Feed, Metacognition Journal
-- ============================================================================

-- ============================================================================
-- SRS (Spaced Repetition System) Tables
-- SM-2 algorithm-based flashcard/concept review system
-- ============================================================================

-- Flashcard decks for organizing content
CREATE TABLE IF NOT EXISTS hyro_srs_decks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,  -- math, reading, science, coding, etc.
  icon TEXT DEFAULT '📚',
  card_count INTEGER DEFAULT 0,
  due_count INTEGER DEFAULT 0,  -- Cards due for review
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Individual flashcards
CREATE TABLE IF NOT EXISTS hyro_srs_cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES hyro_srs_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,           -- Question/prompt
  back TEXT NOT NULL,            -- Answer/response
  card_type TEXT DEFAULT 'basic', -- basic, cloze, image
  tags TEXT,                     -- JSON array of tags
  source_quest_id TEXT,          -- If generated from a quest
  source_assignment_id TEXT,     -- If generated from an assignment

  -- SM-2 Algorithm fields
  easiness_factor REAL DEFAULT 2.5,  -- E-Factor (2.5 starting)
  interval_days INTEGER DEFAULT 0,    -- Current interval in days
  repetitions INTEGER DEFAULT 0,      -- Number of successful reviews
  next_review_at INTEGER,             -- Unix timestamp of next review
  last_reviewed_at INTEGER,

  -- Card states: new, learning, review, graduated
  card_state TEXT DEFAULT 'new',

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Review history for analytics
CREATE TABLE IF NOT EXISTS hyro_srs_reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES hyro_srs_cards(id) ON DELETE CASCADE,
  quality INTEGER NOT NULL,  -- 0-5 SM-2 quality rating
  -- 0: Complete blackout
  -- 1: Incorrect, but upon seeing answer remembered
  -- 2: Incorrect, but answer seemed easy to recall
  -- 3: Correct with serious difficulty
  -- 4: Correct after hesitation
  -- 5: Perfect response

  response_time_ms INTEGER,  -- How long it took to answer

  -- State at time of review (for analytics)
  easiness_before REAL,
  interval_before INTEGER,
  easiness_after REAL,
  interval_after INTEGER,

  xp_earned INTEGER DEFAULT 0,
  reviewed_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- Daily Intel Feed (Phase 2 - enhanced)
-- Educational content recommendations curated daily
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_intel_items (
  id TEXT PRIMARY KEY,
  intel_date TEXT NOT NULL,  -- YYYY-MM-DD format

  -- Content
  title TEXT NOT NULL,
  summary TEXT,
  content_type TEXT NOT NULL,  -- video, article, quiz, fact, challenge
  subject TEXT,  -- math, reading, science, coding, etc.
  difficulty TEXT DEFAULT 'medium',

  -- Source
  source_url TEXT,
  source_name TEXT,
  thumbnail_url TEXT,

  -- Engagement
  estimated_time_minutes INTEGER,
  xp_reward INTEGER DEFAULT 10,

  -- Status
  status TEXT DEFAULT 'new',  -- new, viewed, engaged, completed, skipped
  viewed_at INTEGER,
  completed_at INTEGER,

  -- AI curation metadata
  relevance_score REAL,  -- 0-1, how relevant to Hyro's interests
  curation_reason TEXT,  -- Why this was selected

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for daily retrieval
CREATE INDEX IF NOT EXISTS idx_intel_items_date ON hyro_intel_items(intel_date);

-- ============================================================================
-- Reflection/Metacognition Journal (Phase 2 - enhanced)
-- Learning reflections and metacognitive observations
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_reflection_journal (
  id TEXT PRIMARY KEY,
  reflection_type TEXT NOT NULL,  -- daily, weekly, quest_complete, achievement, milestone

  -- Prompt and response
  prompt TEXT,           -- The reflection prompt shown
  response TEXT,         -- Hyro's written reflection

  -- Context
  quest_id TEXT,         -- If related to a quest
  achievement_id TEXT,   -- If related to an achievement
  stat_name TEXT,        -- If related to a stat improvement

  -- Sentiment analysis (AI-generated)
  sentiment_score REAL,  -- -1 to 1
  key_insights TEXT,     -- JSON array of extracted insights
  growth_indicators TEXT, -- JSON array of growth indicators

  -- Engagement
  word_count INTEGER,
  time_spent_seconds INTEGER,
  xp_earned INTEGER DEFAULT 0,

  reflection_date TEXT NOT NULL,  -- YYYY-MM-DD
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for date-based retrieval
CREATE INDEX IF NOT EXISTS idx_reflection_journal_date ON hyro_reflection_journal(reflection_date);

-- ============================================================================
-- Reflection Prompts Library
-- Curated prompts for different reflection types
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_reflection_prompts (
  id TEXT PRIMARY KEY,
  prompt_type TEXT NOT NULL,  -- daily, weekly, quest_complete, achievement, milestone
  prompt_text TEXT NOT NULL,
  subject TEXT,  -- Optional: math, reading, etc. for subject-specific prompts
  difficulty_level TEXT DEFAULT 'medium',  -- easy, medium, deep
  is_active INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed default reflection prompts
INSERT OR IGNORE INTO hyro_reflection_prompts (id, prompt_type, prompt_text, difficulty_level) VALUES
-- Daily prompts
('daily-1', 'daily', 'What was the most interesting thing you learned today?', 'easy'),
('daily-2', 'daily', 'What challenged you today and how did you handle it?', 'medium'),
('daily-3', 'daily', 'If you could teach someone one thing from today, what would it be?', 'medium'),
('daily-4', 'daily', 'What strategy worked well for you today? What might you try differently tomorrow?', 'deep'),

-- Weekly prompts
('weekly-1', 'weekly', 'Looking back at this week, what are you most proud of?', 'easy'),
('weekly-2', 'weekly', 'What skill improved the most this week? How can you tell?', 'medium'),
('weekly-3', 'weekly', 'What would you like to focus on more next week?', 'medium'),
('weekly-4', 'weekly', 'Think of a struggle this week. What did it teach you about how you learn best?', 'deep'),

-- Quest completion prompts
('quest-1', 'quest_complete', 'What did you learn from completing this quest?', 'easy'),
('quest-2', 'quest_complete', 'What was the hardest part and how did you overcome it?', 'medium'),
('quest-3', 'quest_complete', 'How might you use what you learned in real life?', 'medium'),

-- Achievement prompts
('achieve-1', 'achievement', 'How does earning this achievement make you feel?', 'easy'),
('achieve-2', 'achievement', 'What effort led to this achievement?', 'medium'),
('achieve-3', 'achievement', 'What goal do you want to work toward next?', 'medium');

-- ============================================================================
-- Quest Generation from Assignments
-- Track assignment-to-quest conversions
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_quest_generators (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,  -- zearn, boost, canyon_grove, etc.
  assignment_type TEXT,    -- math, reading, project, etc.
  quest_template TEXT NOT NULL,  -- JSON template for quest generation
  xp_formula TEXT,         -- Formula for calculating XP (e.g., "difficulty * 25")
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Seed default quest generators
INSERT OR IGNORE INTO hyro_quest_generators (id, platform, assignment_type, quest_template, xp_formula) VALUES
('gen-zearn-math', 'zearn', 'math',
  '{"quest_type": "daily", "title_prefix": "Math Quest: ", "difficulty": "medium", "required_stat": "math"}',
  'difficulty * 25'),
('gen-boost-all', 'boost', NULL,
  '{"quest_type": "daily", "title_prefix": "Boost Challenge: ", "difficulty": "medium"}',
  'difficulty * 20'),
('gen-reading-log', 'canyon_grove', 'reading',
  '{"quest_type": "daily", "title_prefix": "Reading Adventure: ", "difficulty": "easy", "required_stat": "reading"}',
  'pages * 2');

-- ============================================================================
-- Study Sessions Tracking
-- Track focused study time for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_study_sessions (
  id TEXT PRIMARY KEY,
  session_type TEXT NOT NULL,  -- srs, quest, intel, free_study
  subject TEXT,

  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,

  -- Session metrics
  cards_reviewed INTEGER DEFAULT 0,
  quests_worked INTEGER DEFAULT 0,
  intel_viewed INTEGER DEFAULT 0,

  -- Focus quality (can be set manually or via future integration)
  focus_rating INTEGER,  -- 1-5
  interruptions INTEGER DEFAULT 0,

  xp_earned INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- Update hyro_character with new stats
-- Note: Using a workaround for SQLite's lack of "IF NOT EXISTS" for ALTER TABLE
-- We use a temp table approach to safely add columns only if they don't exist
-- ============================================================================

-- Create temp table to check schema (this approach is idempotent)
-- The actual column additions are handled programmatically in the migration runner
-- These statements will be skipped if columns already exist

-- Check and add study_streak_days if not exists
SELECT CASE
  WHEN (SELECT COUNT(*) FROM pragma_table_info('hyro_character') WHERE name = 'study_streak_days') = 0
  THEN 1 ELSE 0 END;

-- Note: Due to SQLite limitations, the following columns should be added manually if needed:
-- study_streak_days INTEGER DEFAULT 0
-- longest_study_streak INTEGER DEFAULT 0
-- last_study_date TEXT
-- srs_mastery_count INTEGER DEFAULT 0
