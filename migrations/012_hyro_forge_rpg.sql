-- HYRO FORGE: ULTRA-EDGE RPG Education System
-- Migration 012: Character, Stats, XP, Quests, SRS, and Daily Intel tables
-- Created: 2025-12-01

-- ============================================================================
-- PART 1: CHARACTER & STATS TABLES
-- ============================================================================

-- Student character profile with RPG elements
CREATE TABLE IF NOT EXISTS hyro_character (
  id TEXT PRIMARY KEY DEFAULT 'hyro',
  display_name TEXT DEFAULT 'Hyro',
  title TEXT DEFAULT 'Apprentice Forger',
  level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_session_at INTEGER,
  avatar_url TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- The 8 core stats (RPG character attributes)
CREATE TABLE IF NOT EXISTS hyro_stats (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL UNIQUE, -- 'math_velocity', 'linguistic_edge', etc.
  display_name TEXT NOT NULL,     -- 'Math Velocity', 'Linguistic Edge', etc.
  description TEXT,               -- What this stat measures
  base_value INTEGER DEFAULT 10,  -- Starting value 1-100
  current_value INTEGER DEFAULT 10,
  modifier INTEGER DEFAULT 0,     -- Temporary boosts/penalties
  last_assessed INTEGER,
  assessment_confidence REAL DEFAULT 0.5, -- 0-1 confidence in score
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Stat change history (for tracking growth over time)
CREATE TABLE IF NOT EXISTS hyro_stat_history (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  old_value INTEGER,
  new_value INTEGER,
  change_reason TEXT, -- 'assessment', 'quest_complete', 'daily_session', 'bonus'
  session_id TEXT,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- XP transaction log
CREATE TABLE IF NOT EXISTS hyro_xp_log (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL, -- 'quest', 'daily', 'streak', 'achievement', 'srs', 'intel'
  source_id TEXT,       -- Reference to quest/achievement/etc
  multiplier REAL DEFAULT 1.0,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- PART 2: SPACED REPETITION SYSTEM (SM-2)
-- ============================================================================

-- Topics for spaced repetition
CREATE TABLE IF NOT EXISTS hyro_srs_topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  domain TEXT NOT NULL, -- Maps to one of 8 stats
  difficulty REAL DEFAULT 0.5, -- 0-1

  -- SM-2 algorithm fields
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,

  -- Review tracking
  last_reviewed INTEGER,
  next_review INTEGER,
  last_quality INTEGER, -- 0-5 (0-2 fail, 3-5 pass)

  -- Context
  source TEXT, -- 'zearn', 'quill', 'manual', 'ai_generated'
  external_id TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Review session logs
CREATE TABLE IF NOT EXISTS hyro_srs_reviews (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  quality INTEGER NOT NULL, -- 0-5
  response_time_ms INTEGER,
  confidence_before INTEGER, -- 1-5 self-rating
  confidence_after INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (topic_id) REFERENCES hyro_srs_topics(id) ON DELETE CASCADE
);

-- ============================================================================
-- PART 3: QUEST & ASSIGNMENT SYSTEM
-- ============================================================================

-- Quest system (gamified assignments)
CREATE TABLE IF NOT EXISTS hyro_quests (
  id TEXT PRIMARY KEY,
  quest_type TEXT NOT NULL, -- 'daily', 'weekly', 'epic', 'side', 'challenge'
  title TEXT NOT NULL,
  description TEXT,

  -- Requirements
  required_stat TEXT, -- Which stat this exercises
  difficulty TEXT DEFAULT 'medium', -- 'trivial', 'easy', 'medium', 'hard', 'legendary'

  -- Rewards
  xp_reward INTEGER DEFAULT 10,
  stat_boost TEXT, -- JSON: {"math_velocity": 2, "meta_mastery": 1}
  achievement_unlock TEXT,

  -- Status
  status TEXT DEFAULT 'available', -- 'available', 'active', 'completed', 'failed', 'expired'
  started_at INTEGER,
  completed_at INTEGER,
  due_at INTEGER,

  -- Platform integration
  platform TEXT, -- 'zearn', 'quill', 'boost', 'custom', 'noredink'
  external_id TEXT,
  external_url TEXT,

  -- Metadata
  is_recurring INTEGER DEFAULT 0,
  recurrence_pattern TEXT, -- 'daily', 'weekly', etc
  parent_quest_id TEXT,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Multimodal quest submissions
CREATE TABLE IF NOT EXISTS hyro_submissions (
  id TEXT PRIMARY KEY,
  quest_id TEXT,
  submission_type TEXT NOT NULL, -- 'text', 'voice', 'image', 'url', 'code'

  -- Content
  content TEXT,      -- For text/code
  file_path TEXT,    -- For voice/image
  url TEXT,          -- For links

  -- AI Review
  ai_review_status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'needs_revision'
  ai_feedback TEXT,
  ai_score REAL,     -- 0-1
  ai_reviewed_at INTEGER,

  -- Stats impact
  stats_awarded TEXT, -- JSON of stat changes
  xp_awarded INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (quest_id) REFERENCES hyro_quests(id) ON DELETE SET NULL
);

-- ============================================================================
-- PART 4: DAILY INTEL & METACOGNITION
-- ============================================================================

-- Daily intelligence feed
CREATE TABLE IF NOT EXISTS hyro_daily_intel (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD

  -- Content (JSON arrays)
  tech_items TEXT,
  science_items TEXT,
  ai_update TEXT,

  -- Engagement tracking
  items_read INTEGER DEFAULT 0,
  discussion_completed INTEGER DEFAULT 0,
  deep_dive_topic TEXT,
  deep_dive_url TEXT,

  -- XP
  xp_earned INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch())
);

-- Session reflections (metacognition journal)
CREATE TABLE IF NOT EXISTS hyro_reflections (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  session_date TEXT, -- YYYY-MM-DD

  -- What questions
  what_learned TEXT,
  what_surprised TEXT,
  what_was_hard TEXT,
  what_connects TEXT,

  -- Calibration
  confidence_rating INTEGER, -- 1-5
  actual_performance REAL,   -- Measured later
  calibration_score REAL,    -- Difference (for tracking overconfidence)

  -- Mood/energy tracking
  energy_level INTEGER,      -- 1-5
  engagement_level INTEGER,  -- 1-5
  focus_level INTEGER,       -- 1-5

  -- Duration
  session_duration_minutes INTEGER,

  created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- PART 5: ACHIEVEMENTS & BADGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,           -- Emoji or icon name
  category TEXT,       -- 'streak', 'mastery', 'exploration', 'epic'
  xp_bonus INTEGER DEFAULT 0,
  requirement_type TEXT, -- 'streak_days', 'quests_completed', 'stat_level', 'custom'
  requirement_value INTEGER,
  requirement_stat TEXT,
  is_secret INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Player's earned achievements
CREATE TABLE IF NOT EXISTS hyro_earned_achievements (
  id TEXT PRIMARY KEY,
  achievement_id TEXT NOT NULL,
  earned_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (achievement_id) REFERENCES hyro_achievements(id) ON DELETE CASCADE
);

-- ============================================================================
-- PART 6: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hyro_stat_history_stat ON hyro_stat_history(stat_name);
CREATE INDEX IF NOT EXISTS idx_hyro_stat_history_date ON hyro_stat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_hyro_xp_log_date ON hyro_xp_log(created_at);
CREATE INDEX IF NOT EXISTS idx_hyro_xp_log_source ON hyro_xp_log(source);
CREATE INDEX IF NOT EXISTS idx_hyro_srs_topics_next ON hyro_srs_topics(next_review) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_hyro_srs_topics_domain ON hyro_srs_topics(domain);
CREATE INDEX IF NOT EXISTS idx_hyro_quests_status ON hyro_quests(status);
CREATE INDEX IF NOT EXISTS idx_hyro_quests_type ON hyro_quests(quest_type);
CREATE INDEX IF NOT EXISTS idx_hyro_reflections_date ON hyro_reflections(session_date);
CREATE INDEX IF NOT EXISTS idx_hyro_daily_intel_date ON hyro_daily_intel(date);

-- ============================================================================
-- PART 7: SEED DATA
-- ============================================================================

-- Initialize the 8 core stats (standard educational terms)
INSERT OR IGNORE INTO hyro_stats (id, stat_name, display_name, description, base_value, current_value) VALUES
  ('stat_math', 'math', 'Mathematics', 'Mathematical reasoning, problem-solving, and numeracy - measured via Zearn progress and assessments', 40, 40),
  ('stat_lang', 'reading', 'Reading & Language Arts', 'Reading comprehension, grammar, vocabulary, and writing skills - measured via Quill/NoRedInk', 20, 20),
  ('stat_phys', 'science', 'Science', 'Scientific reasoning, inquiry, and understanding of natural phenomena', 25, 25),
  ('stat_logic', 'coding', 'Coding & Logic', 'Computational thinking, programming concepts, and algorithmic reasoning', 30, 30),
  ('stat_meta', 'study_skills', 'Study Skills', 'Learning strategies, organization, time management, and metacognition', 15, 15),
  ('stat_systems', 'critical_thinking', 'Critical Thinking', 'Analysis, evaluation, pattern recognition, and cross-domain reasoning', 20, 20),
  ('stat_ai', 'technology', 'Technology', 'Digital literacy, technology fluency, and effective use of tools', 25, 25),
  ('stat_arsenal', 'problem_solving', 'Problem Solving', 'Applying frameworks, strategies, and approaches to solve complex challenges', 20, 20);

-- Initialize Hyro's character
INSERT OR IGNORE INTO hyro_character (id, display_name, title, level, total_xp) VALUES
  ('hyro', 'Hyro', 'Apprentice Forger', 1, 0);

-- Seed initial achievements (using standard educational terms)
INSERT OR IGNORE INTO hyro_achievements (id, name, description, icon, category, xp_bonus, requirement_type, requirement_value) VALUES
  ('ach_first_quest', 'First Steps', 'Complete your first quest', '🎯', 'exploration', 50, 'quests_completed', 1),
  ('ach_streak_3', 'Warming Up', '3-day learning streak', '🔥', 'streak', 30, 'streak_days', 3),
  ('ach_streak_7', 'On Fire', '7-day learning streak', '🔥🔥', 'streak', 100, 'streak_days', 7),
  ('ach_streak_30', 'Unstoppable', '30-day learning streak', '🔥🔥🔥', 'streak', 500, 'streak_days', 30),
  ('ach_math_25', 'Math Novice', 'Reach Mathematics skill level 25', '🧮', 'mastery', 75, 'stat_level', 25),
  ('ach_math_50', 'Math Adept', 'Reach Mathematics skill level 50', '📐', 'mastery', 150, 'stat_level', 50),
  ('ach_lang_25', 'Bookworm', 'Reach Reading & Language Arts skill level 25', '📝', 'mastery', 75, 'stat_level', 25),
  ('ach_reflector', 'The Reflector', 'Complete 10 reflection sessions', '🪞', 'mastery', 100, 'quests_completed', 10),
  ('ach_intel_reader', 'Intel Agent', 'Read daily intel for 7 days', '📰', 'exploration', 100, 'streak_days', 7),
  ('ach_deep_diver', 'Deep Diver', 'Complete 5 weekly deep dives', '🤿', 'exploration', 200, 'quests_completed', 5);

-- Record migration in the table
INSERT INTO migrations (name) VALUES ('012_hyro_forge_rpg');
