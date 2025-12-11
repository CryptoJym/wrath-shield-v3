-- ============================================================================
-- MIGRATION 052: Fix Diagnostics Schema & Migrate Content
-- ============================================================================

-- 1. Ensure Tables Exist (from 017)
CREATE TABLE IF NOT EXISTS hyro_diagnostic_tests (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,
  question_count INTEGER NOT NULL,
  time_limit_minutes INTEGER DEFAULT 15,
  difficulty_curve TEXT DEFAULT 'adaptive',
  grade_level INTEGER DEFAULT 6,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS hyro_diagnostic_questions (
  id TEXT PRIMARY KEY,
  test_id TEXT,
  stat_name TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options TEXT,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty_level REAL NOT NULL,
  topic TEXT,
  subtopic TEXT,
  common_misconceptions TEXT,
  hints TEXT,
  time_estimate_seconds INTEGER DEFAULT 60,
  source TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (test_id) REFERENCES hyro_diagnostic_tests(id)
);

CREATE TABLE IF NOT EXISTS hyro_diagnostic_sessions (
  id TEXT PRIMARY KEY,
  test_id TEXT,
  stat_name TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  time_spent_seconds INTEGER DEFAULT 0,
  questions_total INTEGER NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  current_difficulty REAL DEFAULT 0.5,
  adaptive_history TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (test_id) REFERENCES hyro_diagnostic_tests(id)
);

CREATE TABLE IF NOT EXISTS hyro_diagnostic_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  user_answer TEXT,
  is_correct INTEGER,
  time_spent_seconds INTEGER,
  confidence_before INTEGER,
  difficulty_at_time REAL,
  hints_used INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES hyro_diagnostic_sessions(id),
  FOREIGN KEY (question_id) REFERENCES hyro_diagnostic_questions(id)
);

CREATE TABLE IF NOT EXISTS hyro_diagnostic_results (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  stat_name TEXT NOT NULL,
  raw_score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage_score REAL NOT NULL,
  estimated_level INTEGER NOT NULL,
  confidence_low INTEGER,
  confidence_high INTEGER,
  identified_gaps TEXT,
  strong_areas TEXT,
  recommended_focus TEXT,
  topic_breakdown TEXT,
  calibration_data TEXT,
  time_spent_seconds INTEGER,
  completed_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES hyro_diagnostic_sessions(id)
);

CREATE TABLE IF NOT EXISTS hyro_skill_gaps (
  id TEXT PRIMARY KEY,
  stat_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT,
  gap_severity TEXT NOT NULL,
  current_level INTEGER,
  target_level INTEGER DEFAULT 70,
  identified_from TEXT,
  source_id TEXT,
  status TEXT DEFAULT 'active',
  evidence_count INTEGER DEFAULT 1,
  first_identified INTEGER DEFAULT (unixepoch()),
  last_confirmed INTEGER DEFAULT (unixepoch()),
  resolved_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 2. Populate Tests (if missing)
INSERT OR IGNORE INTO hyro_diagnostic_tests (id, stat_name, title, description, question_count, time_limit_minutes) VALUES
  ('diag-math', 'Mathematics', 'Math Assessment', 'Evaluate understanding of mathematics concepts', 20, 20),
  ('diag-reading', 'Reading', 'Reading Assessment', 'Assess reading comprehension and vocabulary skills', 15, 15),
  ('diag-science', 'Science', 'Science Assessment', 'Test understanding of scientific concepts and method', 15, 15),
  ('diag-critical', 'Critical Thinking', 'Critical Thinking Assessment', 'Test logical reasoning and analysis skills', 15, 15);

-- 3. Migrate Items from V2 to Questions Table
-- Note: We map 'mcq' to 'multiple_choice'
INSERT OR IGNORE INTO hyro_diagnostic_questions (
  id, test_id, stat_name, question_text, question_type, options, correct_answer, difficulty_level, topic, source
)
SELECT 
  id, 
  CASE 
    WHEN stat_name = 'Mathematics' THEN 'diag-math'
    WHEN stat_name = 'Reading' THEN 'diag-reading'
    WHEN stat_name = 'Science' THEN 'diag-science'
    ELSE 'diag-critical'
  END as test_id,
  stat_name,
  prompt,
  'multiple_choice',
  options,
  correct_answer,
  difficulty,
  json_extract(constructs_measured, '$[0]'), -- Use first construct as topic
  'generated_v2'
FROM hyro_diagnostic_items_v2
WHERE correct_answer IS NOT NULL AND correct_answer != '';

-- 4. Clean up V2 table (optional, but good for hygiene)
-- DROP TABLE hyro_diagnostic_items_v2; 
