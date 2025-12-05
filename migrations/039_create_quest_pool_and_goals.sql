-- ============================================================================
-- HYRO FORGE: Quest Pool and Goals System
-- Migration 039: Create quest templates for stat-based quest generation
-- Created: 2025-12-04
--
-- This creates:
-- 1. Quest template pool (pre-defined quests for each stat)
-- 2. Student goals table (for tracking target stats)
-- 3. Seeds initial quest templates
-- ============================================================================

-- ============================================================================
-- STUDENT GOALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_student_goals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  deadline INTEGER,  -- Unix timestamp, optional
  status TEXT DEFAULT 'active',  -- active, completed, abandoned
  priority INTEGER DEFAULT 1,  -- 1-5, higher = more important
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(student_id, stat_name, status)
);

CREATE INDEX IF NOT EXISTS idx_student_goals_student ON hyro_student_goals(student_id);
CREATE INDEX IF NOT EXISTS idx_student_goals_stat ON hyro_student_goals(stat_name);

-- ============================================================================
-- QUEST TEMPLATE POOL
-- ============================================================================
CREATE TABLE IF NOT EXISTS hyro_quest_pool (
  id TEXT PRIMARY KEY,
  quest_type TEXT NOT NULL,  -- daily, weekly, challenge, skill_builder
  title TEXT NOT NULL,
  description TEXT,
  required_stat TEXT,
  difficulty TEXT DEFAULT 'medium',
  xp_reward INTEGER DEFAULT 15,
  estimated_minutes INTEGER,
  activity_type TEXT,  -- srs_review, intel_read, reading_session, practice_problem, etc.
  activity_config TEXT,  -- JSON config for activity (e.g., {"deck_id": "...", "min_cards": 10})
  tags TEXT,  -- JSON array
  is_active INTEGER DEFAULT 1,
  times_assigned INTEGER DEFAULT 0,
  success_rate REAL,  -- Track completion rate
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_quest_pool_stat ON hyro_quest_pool(required_stat);
CREATE INDEX IF NOT EXISTS idx_quest_pool_type ON hyro_quest_pool(quest_type);
CREATE INDEX IF NOT EXISTS idx_quest_pool_difficulty ON hyro_quest_pool(difficulty);

-- ============================================================================
-- SEED QUEST TEMPLATES - MATH
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  -- Daily quests
  ('quest_math_srs_01', 'daily', 'Fraction Master', 'Review 10 flashcards from the Fractions & Decimals deck', 'math', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_math_fractions", "min_cards": 10}', '["flashcards", "fractions"]'),
  ('quest_math_srs_02', 'daily', 'Geometry Guru', 'Complete 10 geometry flashcard reviews', 'math', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_math_geometry", "min_cards": 10}', '["flashcards", "geometry"]'),
  ('quest_math_intel_01', 'daily', 'Math Discovery', 'Read and complete one math-related intel item', 'math', 'easy', 10, 8, 'intel_complete', '{"subject": "math"}', '["intel", "discovery"]'),

  -- Weekly quests
  ('quest_math_weekly_01', 'weekly', 'Decimal Champion', 'Master 25 flashcards on decimals and percents', 'math', 'medium', 35, 30, 'srs_review', '{"deck_id": "deck_math_fractions", "min_cards": 25, "min_accuracy": 0.8}', '["flashcards", "decimals", "challenge"]'),
  ('quest_math_weekly_02', 'weekly', 'Pi Explorer', 'Complete all math intel items this week', 'math', 'medium', 40, 45, 'intel_complete_all', '{"subject": "math"}', '["intel", "weekly"]'),

  -- Challenge quests
  ('quest_math_challenge_01', 'challenge', 'Formula Recall Challenge', 'Score 90%+ accuracy on 20 geometry flashcards', 'math', 'hard', 50, 20, 'srs_challenge', '{"deck_id": "deck_math_geometry", "min_cards": 20, "min_accuracy": 0.9}', '["flashcards", "challenge", "accuracy"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - SCIENCE
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_sci_srs_01', 'daily', 'Science Vocab Builder', 'Review 10 science vocabulary flashcards', 'science', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_science_vocab", "min_cards": 10}', '["flashcards", "vocabulary"]'),
  ('quest_sci_intel_01', 'daily', 'Science Explorer', 'Discover one new science fact or video', 'science', 'easy', 10, 8, 'intel_complete', '{"subject": "science"}', '["intel", "discovery"]'),
  ('quest_sci_weekly_01', 'weekly', 'Lab Rat', 'Complete 30 science flashcard reviews', 'science', 'medium', 40, 35, 'srs_review', '{"deck_id": "deck_science_vocab", "min_cards": 30}', '["flashcards", "weekly"]'),
  ('quest_sci_challenge_01', 'challenge', 'Cell Biology Master', 'Score 85%+ on 15 biology flashcards', 'science', 'hard', 45, 15, 'srs_challenge', '{"deck_id": "deck_science_vocab", "min_cards": 15, "min_accuracy": 0.85}', '["flashcards", "challenge"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - READING
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_read_srs_01', 'daily', 'Word Root Explorer', 'Learn 10 new word roots and prefixes', 'reading', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_reading_roots", "min_cards": 10}', '["flashcards", "vocabulary"]'),
  ('quest_read_session_01', 'daily', 'Daily Reader', 'Complete a 15-minute reading session', 'reading', 'easy', 20, 15, 'reading_session', '{"min_minutes": 15}', '["reading", "daily"]'),
  ('quest_read_intel_01', 'daily', 'Word Wizard', 'Complete one reading/vocabulary intel item', 'reading', 'easy', 10, 8, 'intel_complete', '{"subject": "reading"}', '["intel", "vocabulary"]'),
  ('quest_read_weekly_01', 'weekly', 'Vocabulary Champion', 'Master 20 word roots flashcards', 'reading', 'medium', 35, 25, 'srs_review', '{"deck_id": "deck_reading_roots", "min_cards": 20}', '["flashcards", "weekly"]'),
  ('quest_read_challenge_01', 'challenge', 'Etymology Expert', 'Score 90%+ on word roots quiz', 'reading', 'hard', 50, 15, 'srs_challenge', '{"deck_id": "deck_reading_roots", "min_cards": 12, "min_accuracy": 0.9}', '["flashcards", "challenge"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - CODING
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_code_srs_01', 'daily', 'Python Basics Review', 'Review 10 Python syntax flashcards', 'coding', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_coding_python", "min_cards": 10}', '["flashcards", "python"]'),
  ('quest_code_intel_01', 'daily', 'Code Discovery', 'Learn about a new coding concept', 'coding', 'easy', 10, 8, 'intel_complete', '{"subject": "coding"}', '["intel", "discovery"]'),
  ('quest_code_weekly_01', 'weekly', 'Syntax Master', 'Complete 25 Python flashcard reviews', 'coding', 'medium', 40, 30, 'srs_review', '{"deck_id": "deck_coding_python", "min_cards": 25}', '["flashcards", "weekly"]'),
  ('quest_code_challenge_01', 'challenge', 'Debug Detective', 'Score 85%+ on 12 Python flashcards', 'coding', 'hard', 45, 15, 'srs_challenge', '{"deck_id": "deck_coding_python", "min_cards": 12, "min_accuracy": 0.85}', '["flashcards", "challenge"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - STUDY SKILLS
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_study_srs_01', 'daily', 'Memory Technique Practice', 'Review 10 study strategy flashcards', 'study_skills', 'easy', 15, 10, 'srs_review', '{"deck_id": "deck_study_memory", "min_cards": 10}', '["flashcards", "study-skills"]'),
  ('quest_study_intel_01', 'daily', 'Learning How to Learn', 'Discover a new study technique', 'study_skills', 'easy', 10, 8, 'intel_complete', '{"subject": "study_skills"}', '["intel", "meta-learning"]'),
  ('quest_study_streak_01', 'daily', 'Consistency Champion', 'Complete 3 different activities today', 'study_skills', 'medium', 25, 30, 'multi_activity', '{"min_activities": 3}', '["streak", "consistency"]'),
  ('quest_study_weekly_01', 'weekly', 'Study Strategist', 'Master all memory technique flashcards', 'study_skills', 'medium', 40, 30, 'srs_review', '{"deck_id": "deck_study_memory", "min_cards": 10, "min_accuracy": 0.85}', '["flashcards", "weekly"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - CRITICAL THINKING
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_think_intel_01', 'daily', 'Critical Lens', 'Analyze one intel article critically', 'critical_thinking', 'medium', 15, 10, 'intel_complete', '{"subject": "critical_thinking"}', '["intel", "analysis"]'),
  ('quest_think_weekly_01', 'weekly', 'Pattern Detective', 'Complete all critical thinking intel this week', 'critical_thinking', 'medium', 35, 40, 'intel_complete_all', '{"subject": "critical_thinking"}', '["intel", "weekly"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - TECHNOLOGY
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_tech_intel_01', 'daily', 'Tech Explorer', 'Learn about a new technology concept', 'technology', 'easy', 10, 8, 'intel_complete', '{"subject": "technology"}', '["intel", "discovery"]'),
  ('quest_tech_weekly_01', 'weekly', 'Digital Citizen', 'Complete all technology intel items this week', 'technology', 'medium', 35, 35, 'intel_complete_all', '{"subject": "technology"}', '["intel", "weekly"]');

-- ============================================================================
-- SEED QUEST TEMPLATES - PROBLEM SOLVING
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_solve_intel_01', 'daily', 'Puzzle Time', 'Complete one problem-solving challenge', 'problem_solving', 'medium', 15, 10, 'intel_complete', '{"subject": "problem_solving"}', '["puzzles", "logic"]'),
  ('quest_solve_weekly_01', 'weekly', 'Logic Champion', 'Complete 3 problem-solving challenges this week', 'problem_solving', 'hard', 45, 45, 'intel_complete_count', '{"subject": "problem_solving", "min_count": 3}', '["puzzles", "weekly"]');

-- ============================================================================
-- MIXED/CROSS-STAT QUESTS
-- ============================================================================
INSERT INTO hyro_quest_pool (id, quest_type, title, description, required_stat, difficulty, xp_reward, estimated_minutes, activity_type, activity_config, tags)
VALUES
  ('quest_mixed_daily_01', 'daily', 'Well-Rounded Warrior', 'Complete activities in 2 different subjects today', 'study_skills', 'medium', 30, 25, 'multi_subject', '{"min_subjects": 2}', '["variety", "cross-subject"]'),
  ('quest_mixed_weekly_01', 'weekly', 'Knowledge Explorer', 'Earn XP from 4 different stat categories', 'study_skills', 'medium', 50, 60, 'multi_subject', '{"min_subjects": 4}', '["variety", "weekly"]'),
  ('quest_mixed_streak_01', 'challenge', 'Week Warrior', 'Complete at least one quest every day for 7 days', 'study_skills', 'hard', 75, 120, 'streak_challenge', '{"streak_days": 7}', '["streak", "challenge"]');

-- Record migration
INSERT INTO migrations (name) VALUES ('039_create_quest_pool_and_goals');
