-- ============================================================================
-- HYRO FORGE PHASE 3: MASTERY SYSTEMS
-- Book/Reading, Intelligent Comprehension, Behavioral Analytics, Skill Proficiency
-- ============================================================================

-- ============================================================================
-- 1. BOOK/READING SYSTEM
-- Track deep engagement with reading materials
-- ============================================================================

-- Book library (classics from Boost and other sources)
CREATE TABLE IF NOT EXISTS hyro_library (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT,
  difficulty_level TEXT DEFAULT 'grade_6',  -- grade_4 through grade_9
  page_count INTEGER,
  chapter_count INTEGER,
  estimated_hours REAL,
  cover_image_url TEXT,
  description TEXT,
  themes TEXT,  -- JSON array of themes for discussion
  source TEXT DEFAULT 'boost',  -- boost, assigned, personal
  external_id TEXT,  -- Boost assignment ID if applicable
  stat_primary TEXT DEFAULT 'reading',
  stat_secondary TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Individual chapters for granular progress
CREATE TABLE IF NOT EXISTS hyro_book_chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES hyro_library(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  page_start INTEGER,
  page_end INTEGER,
  estimated_minutes INTEGER,
  key_concepts TEXT,  -- JSON array
  discussion_hooks TEXT  -- JSON array of comprehension prompt seeds
);

CREATE INDEX IF NOT EXISTS idx_book_chapters_book ON hyro_book_chapters(book_id);

-- Reading sessions (time-based tracking)
CREATE TABLE IF NOT EXISTS hyro_reading_sessions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES hyro_library(id),
  chapter_id TEXT REFERENCES hyro_book_chapters(id),

  -- Timing
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_minutes INTEGER,
  pages_start INTEGER,
  pages_end INTEGER,

  -- Quality metrics
  focus_self_rating INTEGER,  -- 1-5
  interruption_count INTEGER DEFAULT 0,
  environment TEXT,  -- quiet, noisy, music, etc.

  -- Comprehension checkpoint (triggered after session)
  comprehension_prompted INTEGER DEFAULT 0,
  comprehension_response_id TEXT,

  xp_earned INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book ON hyro_reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_date ON hyro_reading_sessions(started_at);

-- Chapter completion tracking
CREATE TABLE IF NOT EXISTS hyro_chapter_progress (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES hyro_library(id),
  chapter_id TEXT NOT NULL REFERENCES hyro_book_chapters(id),

  status TEXT DEFAULT 'not_started',  -- not_started, in_progress, completed
  first_read_at INTEGER,
  completed_at INTEGER,
  total_time_minutes INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,

  -- Comprehension evidence
  comprehension_score REAL,  -- 0-100 from responses
  discussion_depth TEXT,  -- surface, moderate, deep

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),

  UNIQUE(book_id, chapter_id)
);

-- Book-level progress tracking
CREATE TABLE IF NOT EXISTS hyro_book_progress (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES hyro_library(id) UNIQUE,

  status TEXT DEFAULT 'not_started',  -- not_started, reading, completed, abandoned
  started_at INTEGER,
  completed_at INTEGER,

  -- Progress stats
  chapters_completed INTEGER DEFAULT 0,
  total_time_minutes INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  current_page INTEGER DEFAULT 0,

  -- Comprehension summary
  average_comprehension REAL,
  overall_depth TEXT,

  -- XP
  xp_earned INTEGER DEFAULT 0,

  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================================
-- 2. INTELLIGENT COMPREHENSION SYSTEM
-- Socratic inquiry, not trivia quizzes
-- ============================================================================

-- Comprehension prompts (AI-generated from book content)
CREATE TABLE IF NOT EXISTS hyro_comprehension_prompts (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES hyro_library(id),
  chapter_id TEXT REFERENCES hyro_book_chapters(id),

  prompt_type TEXT NOT NULL,  -- analysis, connection, prediction, creation, meta
  prompt_text TEXT NOT NULL,
  context_excerpt TEXT,  -- Relevant passage from the book

  -- For AI evaluation
  evaluation_rubric TEXT,  -- JSON: criteria for scoring
  exemplar_response TEXT,  -- What a strong response looks like
  common_misconceptions TEXT,  -- JSON: typical weak responses

  difficulty_level TEXT DEFAULT 'medium',
  stat_targeted TEXT DEFAULT 'reading',
  times_used INTEGER DEFAULT 0,
  average_score REAL,

  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_comp_prompts_book ON hyro_comprehension_prompts(book_id);
CREATE INDEX IF NOT EXISTS idx_comp_prompts_type ON hyro_comprehension_prompts(prompt_type);

-- User responses with AI evaluation
CREATE TABLE IF NOT EXISTS hyro_comprehension_responses (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL REFERENCES hyro_comprehension_prompts(id),
  session_id TEXT REFERENCES hyro_reading_sessions(id),

  -- Response content
  response_text TEXT NOT NULL,
  response_time_seconds INTEGER,
  word_count INTEGER,

  -- AI evaluation
  ai_score REAL,  -- 0-100
  ai_feedback TEXT,  -- Constructive feedback
  ai_strengths TEXT,  -- JSON: what was done well
  ai_growth_areas TEXT,  -- JSON: areas to improve
  ai_depth_rating TEXT,  -- surface, moderate, deep

  -- Detailed rubric scores
  evidence_use_score REAL,  -- 0-25
  reasoning_score REAL,  -- 0-25
  analysis_depth_score REAL,  -- 0-25
  connection_score REAL,  -- 0-25

  -- Stat impact
  xp_earned INTEGER DEFAULT 0,
  stat_delta REAL,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_comp_responses_prompt ON hyro_comprehension_responses(prompt_id);

-- Discussion threads for back-and-forth Socratic dialogue
CREATE TABLE IF NOT EXISTS hyro_reading_discussions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES hyro_library(id),
  initial_prompt_id TEXT REFERENCES hyro_comprehension_prompts(id),

  -- Discussion state
  status TEXT DEFAULT 'active',  -- active, concluded, abandoned
  exchange_count INTEGER DEFAULT 0,

  -- Quality tracking
  depth_achieved TEXT,
  insight_moments TEXT,  -- JSON: key breakthrough insights

  total_xp_earned INTEGER DEFAULT 0,
  started_at INTEGER DEFAULT (unixepoch()),
  concluded_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_discussions_book ON hyro_reading_discussions(book_id);

-- Individual exchanges in a discussion
CREATE TABLE IF NOT EXISTS hyro_discussion_exchanges (
  id TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL REFERENCES hyro_reading_discussions(id) ON DELETE CASCADE,
  exchange_number INTEGER NOT NULL,

  -- The exchange
  ai_prompt TEXT NOT NULL,
  user_response TEXT,
  response_time_seconds INTEGER,

  -- AI analysis of this exchange
  response_quality TEXT,  -- weak, adequate, strong, exceptional
  thinking_demonstrated TEXT,  -- JSON: types of thinking shown
  follow_up_type TEXT,  -- probe_deeper, redirect, affirm, conclude

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_exchanges_discussion ON hyro_discussion_exchanges(discussion_id);

-- ============================================================================
-- 3. BEHAVIORAL ANALYTICS ENGINE
-- Learn from patterns to optimize learning
-- ============================================================================

-- Raw behavioral events
CREATE TABLE IF NOT EXISTS hyro_behavior_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,  -- session_start, session_end, quest_complete, etc.
  event_data TEXT,  -- JSON with event-specific data

  -- Context
  day_of_week INTEGER,  -- 0-6 (Sunday-Saturday)
  hour_of_day INTEGER,  -- 0-23
  session_id TEXT,

  -- Device/environment
  device_type TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON hyro_behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_time ON hyro_behavior_events(day_of_week, hour_of_day);

-- Detected patterns (computed periodically)
CREATE TABLE IF NOT EXISTS hyro_behavior_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  -- Types: optimal_time, struggle_subject, engagement_decay, session_length_optimal

  pattern_data TEXT NOT NULL,  -- JSON with pattern details
  confidence REAL,  -- 0-1
  evidence_count INTEGER,

  first_detected INTEGER,
  last_confirmed INTEGER,
  is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON hyro_behavior_patterns(pattern_type);

-- Learning predictions
CREATE TABLE IF NOT EXISTS hyro_predictions (
  id TEXT PRIMARY KEY,
  prediction_type TEXT NOT NULL,
  -- Types: session_success, quest_difficulty, optimal_next_activity

  prediction_data TEXT NOT NULL,  -- JSON
  confidence REAL,

  -- Validation
  outcome_recorded INTEGER DEFAULT 0,
  outcome_data TEXT,
  prediction_accuracy REAL,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_predictions_type ON hyro_predictions(prediction_type);

-- ============================================================================
-- 4. SKILL PROFICIENCY SYSTEM
-- Evidence-based skill quantification with confidence intervals
-- ============================================================================

-- Evidence points for skills
CREATE TABLE IF NOT EXISTS hyro_skill_evidence (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,

  -- Evidence source
  source_type TEXT NOT NULL,  -- quest, srs, comprehension, assessment
  source_id TEXT,

  -- Evidence data
  performance_score REAL NOT NULL,  -- 0-100
  difficulty_level REAL,  -- 0-1 multiplier
  time_pressure INTEGER DEFAULT 0,  -- was there time pressure?

  -- Context
  topic_tags TEXT,  -- JSON array of specific topics

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_skill_evidence_stat ON hyro_skill_evidence(stat_name);
CREATE INDEX IF NOT EXISTS idx_skill_evidence_source ON hyro_skill_evidence(source_type);

-- Proficiency snapshots (computed periodically)
CREATE TABLE IF NOT EXISTS hyro_proficiency_snapshots (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,

  -- Point estimate
  proficiency_level REAL NOT NULL,  -- 0-100

  -- Confidence interval (Bayesian)
  confidence_low REAL,
  confidence_high REAL,
  uncertainty REAL,  -- Width of interval

  -- Velocity
  learning_velocity REAL,  -- Change per week
  velocity_trend TEXT,  -- accelerating, steady, slowing

  -- Calibration
  self_estimate REAL,  -- What Hyro thinks
  calibration_error REAL,  -- Difference from actual

  evidence_count INTEGER,
  snapshot_date TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_proficiency_stat ON hyro_proficiency_snapshots(stat_name);
CREATE INDEX IF NOT EXISTS idx_proficiency_date ON hyro_proficiency_snapshots(snapshot_date);

-- Calibration history (tracking prediction accuracy)
CREATE TABLE IF NOT EXISTS hyro_calibration_history (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,

  -- Prediction
  predicted_score REAL,
  confidence REAL,

  -- Outcome
  actual_score REAL,
  prediction_error REAL,

  -- Context
  activity_type TEXT,
  activity_id TEXT,

  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_calibration_stat ON hyro_calibration_history(stat_name);

-- ============================================================================
-- SEED DATA: Sample Books
-- ============================================================================

INSERT OR IGNORE INTO hyro_library (id, title, author, genre, difficulty_level, page_count, chapter_count, estimated_hours, description, themes, source, stat_primary) VALUES
('book-wonder', 'Wonder', 'R.J. Palacio', 'realistic_fiction', 'grade_5', 310, 8, 6, 'Auggie Pullman was born with a facial difference. Now he''s starting school for the first time...', '["kindness", "acceptance", "courage", "friendship"]', 'boost', 'reading'),
('book-percy-lightning', 'Percy Jackson: The Lightning Thief', 'Rick Riordan', 'fantasy', 'grade_6', 377, 22, 8, 'Percy discovers he''s a demigod and embarks on a quest to prevent a war among the gods...', '["mythology", "identity", "loyalty", "heroism"]', 'boost', 'reading'),
('book-hatchet', 'Hatchet', 'Gary Paulsen', 'survival', 'grade_6', 195, 19, 4, 'Brian survives a plane crash and must learn to live alone in the Canadian wilderness...', '["survival", "resilience", "nature", "self-reliance"]', 'boost', 'reading'),
('book-holes', 'Holes', 'Louis Sachar', 'mystery', 'grade_6', 233, 50, 5, 'Stanley Yelnats is sent to Camp Green Lake for a crime he didn''t commit...', '["justice", "fate", "friendship", "perseverance"]', 'boost', 'reading'),
('book-outsiders', 'The Outsiders', 'S.E. Hinton', 'realistic_fiction', 'grade_7', 192, 12, 4, 'Ponyboy Curtis and the Greasers struggle with identity, loyalty, and class conflict...', '["identity", "loyalty", "class", "family"]', 'boost', 'reading');

-- ============================================================================
-- SEED DATA: Sample Comprehension Prompts
-- ============================================================================

INSERT OR IGNORE INTO hyro_comprehension_prompts (id, book_id, prompt_type, prompt_text, difficulty_level, stat_targeted, evaluation_rubric) VALUES
-- Wonder prompts
('prompt-wonder-1', 'book-wonder', 'analysis', 'Why do you think August chooses to start going to school now, after being homeschooled for so long? What might have changed for him or his family?', 'medium', 'reading', '{"evidence": "cites text about his family/decision", "reasoning": "explains motivation logically", "depth": "considers multiple factors", "connection": "relates to growth/change"}'),
('prompt-wonder-2', 'book-wonder', 'connection', 'Think about a time when you felt different from others. How did you handle it? What would August''s advice be to you?', 'medium', 'reading', '{"evidence": "references August''s experiences", "reasoning": "draws parallel clearly", "depth": "shows self-reflection", "connection": "applies lesson personally"}'),
('prompt-wonder-3', 'book-wonder', 'prediction', 'Based on how Jack Will has acted so far, what do you think he will do when August finds out what he said on Halloween? Why?', 'hard', 'reading', '{"evidence": "cites Jack''s previous behavior", "reasoning": "logical prediction", "depth": "understands character complexity", "connection": "relates to themes of friendship"}'),

-- Percy Jackson prompts
('prompt-percy-1', 'book-percy-lightning', 'analysis', 'How does Percy''s ADHD and dyslexia, which he thought were weaknesses, turn out to be strengths? What does this suggest about how we view differences?', 'medium', 'reading', '{"evidence": "cites specific examples", "reasoning": "explains connection", "depth": "explores theme of perspective", "connection": "relates to real differences"}'),
('prompt-percy-2', 'book-percy-lightning', 'creation', 'If you discovered you were a demigod, which Greek god would you want as your parent and why? How would their powers help you in your daily life?', 'easy', 'reading', '{"evidence": "knows god characteristics", "reasoning": "logical choice", "depth": "creative application", "connection": "connects to self-knowledge"}'),

-- Hatchet prompts
('prompt-hatchet-1', 'book-hatchet', 'meta', 'What survival skills has Brian learned that you think are most important? How did his attitude change from when he first crashed to now?', 'medium', 'reading', '{"evidence": "lists specific skills", "reasoning": "prioritizes logically", "depth": "tracks character growth", "connection": "relates to mindset"}'),
('prompt-hatchet-2', 'book-hatchet', 'prediction', 'Brian keeps thinking about the Secret. How do you think this knowledge will affect him if he gets rescued? What might he do differently?', 'hard', 'reading', '{"evidence": "references the Secret", "reasoning": "predicts consequences", "depth": "understands psychological impact", "connection": "relates to family themes"}');
