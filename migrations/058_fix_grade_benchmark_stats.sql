-- Migration 058: Fix Grade Benchmark Stats
-- Adds missing stats (writing, social_studies, financial_literacy) to grade benchmark tables
-- The TypeScript code already supports all 11 stats - this migration ensures the DB does too

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- We need to recreate the tables with updated constraints

-- Recreate grade inference table with all 11 stats
DROP TABLE IF EXISTS hyro_student_grade_inference_new;
CREATE TABLE hyro_student_grade_inference_new (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'writing', 'science', 'social_studies', 'financial_literacy',
    'coding', 'study_skills', 'critical_thinking', 'technology', 'problem_solving'
  )),
  inferred_grade TEXT NOT NULL CHECK (inferred_grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(student_id, stat_name)
);

-- Copy existing data
INSERT INTO hyro_student_grade_inference_new
SELECT * FROM hyro_student_grade_inference;

-- Drop old table and rename new one
DROP TABLE IF EXISTS hyro_student_grade_inference;
ALTER TABLE hyro_student_grade_inference_new RENAME TO hyro_student_grade_inference;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_grade_inference_student
ON hyro_student_grade_inference(student_id);

CREATE INDEX IF NOT EXISTS idx_grade_inference_stat
ON hyro_student_grade_inference(stat_name);

-- Recreate benchmark overrides table with all 11 stats
DROP TABLE IF EXISTS hyro_grade_benchmark_overrides_new;
CREATE TABLE hyro_grade_benchmark_overrides_new (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  grade TEXT NOT NULL CHECK (grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'writing', 'science', 'social_studies', 'financial_literacy',
    'coding', 'study_skills', 'critical_thinking', 'technology', 'problem_solving'
  )),
  benchmark_25th REAL NOT NULL,
  benchmark_50th REAL NOT NULL,
  benchmark_75th REAL NOT NULL,
  std_dev REAL NOT NULL,
  source TEXT DEFAULT 'custom',
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(organization_id, grade, stat_name)
);

-- Copy existing data
INSERT INTO hyro_grade_benchmark_overrides_new
SELECT * FROM hyro_grade_benchmark_overrides;

-- Drop old table and rename new one
DROP TABLE IF EXISTS hyro_grade_benchmark_overrides;
ALTER TABLE hyro_grade_benchmark_overrides_new RENAME TO hyro_grade_benchmark_overrides;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_benchmark_overrides_org_grade
ON hyro_grade_benchmark_overrides(organization_id, grade);

-- Recreate grade progression history table with all 11 stats
DROP TABLE IF EXISTS hyro_grade_progression_history_new;
CREATE TABLE hyro_grade_progression_history_new (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'writing', 'science', 'social_studies', 'financial_literacy',
    'coding', 'study_skills', 'critical_thinking', 'technology', 'problem_solving'
  )),
  previous_grade TEXT CHECK (previous_grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  new_grade TEXT NOT NULL CHECK (new_grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  trigger_event TEXT,
  proficiency_at_change REAL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Copy existing data
INSERT INTO hyro_grade_progression_history_new
SELECT * FROM hyro_grade_progression_history;

-- Drop old table and rename new one
DROP TABLE IF EXISTS hyro_grade_progression_history;
ALTER TABLE hyro_grade_progression_history_new RENAME TO hyro_grade_progression_history;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_grade_progression_student_stat
ON hyro_grade_progression_history(student_id, stat_name, created_at);
