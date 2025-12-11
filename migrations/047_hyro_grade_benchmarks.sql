-- Migration 047: Multi-Grade Benchmark System
-- Adds support for K-12 grade-aware benchmarks and grade inference

-- Note: enrolled_grade column may already exist on hyro_character
-- We skip adding it here since SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- The column was added in a previous migration or by the forge-grade-benchmarks.ts initialization

-- Create the grade inference table for per-stat grade tracking
-- This allows the system to infer grade levels based on demonstrated performance
CREATE TABLE IF NOT EXISTS hyro_student_grade_inference (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'science', 'coding',
    'study_skills', 'critical_thinking', 'technology', 'problem_solving'
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

-- Index for efficient student lookups
CREATE INDEX IF NOT EXISTS idx_grade_inference_student
ON hyro_student_grade_inference(student_id);

-- Index for efficient stat-based queries
CREATE INDEX IF NOT EXISTS idx_grade_inference_stat
ON hyro_student_grade_inference(stat_name);

-- Create the grade benchmark cache table (optional - for custom benchmarks)
-- This allows schools/districts to override default benchmarks
CREATE TABLE IF NOT EXISTS hyro_grade_benchmark_overrides (
  id TEXT PRIMARY KEY,
  organization_id TEXT, -- NULL means system-wide override
  grade TEXT NOT NULL CHECK (grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'science', 'coding',
    'study_skills', 'critical_thinking', 'technology', 'problem_solving'
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

-- Index for efficient benchmark lookups
CREATE INDEX IF NOT EXISTS idx_benchmark_overrides_org_grade
ON hyro_grade_benchmark_overrides(organization_id, grade);

-- Create table for tracking grade progression history
-- This helps visualize how a student's inferred grades change over time
CREATE TABLE IF NOT EXISTS hyro_grade_progression_history (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'science', 'coding',
    'study_skills', 'critical_thinking', 'technology', 'problem_solving'
  )),
  previous_grade TEXT CHECK (previous_grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  new_grade TEXT NOT NULL CHECK (new_grade IN (
    'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  )),
  trigger_event TEXT, -- 'assessment', 'threshold_crossed', 'manual', etc.
  proficiency_at_change REAL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Index for tracking progression over time
CREATE INDEX IF NOT EXISTS idx_grade_progression_student_stat
ON hyro_grade_progression_history(student_id, stat_name, created_at);
