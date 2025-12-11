-- Migration 048: Meta-Learning, Standards Mastery, and Meta-Dimensions
-- Adds tables for trajectory learning, standards tracking, and extended dimensions

-- 1. Standards Mastery Table
CREATE TABLE IF NOT EXISTS hyro_standard_mastery (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  standard_id TEXT NOT NULL,
  mastery_level REAL NOT NULL DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  first_exposure INTEGER,
  last_assessment INTEGER,
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'introduced', 'developing', 'proficient', 'mastered'
  )),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(student_id, standard_id)
);

-- Indexes for standard mastery
CREATE INDEX IF NOT EXISTS idx_standard_mastery_student ON hyro_standard_mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_standard_mastery_standard ON hyro_standard_mastery(standard_id);
CREATE INDEX IF NOT EXISTS idx_standard_mastery_status ON hyro_standard_mastery(status);

-- 2. Trajectory Records Table (for meta-learning)
CREATE TABLE IF NOT EXISTS hyro_trajectory_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  stat_name TEXT NOT NULL CHECK (stat_name IN (
    'math', 'reading', 'science', 'coding',
    'study_skills', 'critical_thinking', 'technology', 'problem_solving'
  )),
  start_coherence REAL NOT NULL CHECK (start_coherence >= 0 AND start_coherence <= 100),
  start_entropy REAL NOT NULL CHECK (start_entropy >= 0 AND start_entropy <= 100),
  start_generativity REAL NOT NULL CHECK (start_generativity >= 0 AND start_generativity <= 100),
  end_coherence REAL NOT NULL CHECK (end_coherence >= 0 AND end_coherence <= 100),
  end_entropy REAL NOT NULL CHECK (end_entropy >= 0 AND end_entropy <= 100),
  end_generativity REAL NOT NULL CHECK (end_generativity >= 0 AND end_generativity <= 100),
  interventions TEXT NOT NULL,  -- JSON array of interventions
  duration_hours REAL NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0, 1)),
  efficiency REAL NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for trajectory records
CREATE INDEX IF NOT EXISTS idx_trajectory_student ON hyro_trajectory_records(student_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_stat ON hyro_trajectory_records(stat_name);
CREATE INDEX IF NOT EXISTS idx_trajectory_success ON hyro_trajectory_records(success);
CREATE INDEX IF NOT EXISTS idx_trajectory_created ON hyro_trajectory_records(created_at);

-- 3. Learned Patterns Table (for meta-learning)
CREATE TABLE IF NOT EXISTS hyro_learned_patterns (
  id TEXT PRIMARY KEY,
  source_coherence REAL NOT NULL CHECK (source_coherence >= 0 AND source_coherence <= 100),
  source_entropy REAL NOT NULL CHECK (source_entropy >= 0 AND source_entropy <= 100),
  source_generativity REAL NOT NULL CHECK (source_generativity >= 0 AND source_generativity <= 100),
  target_coherence REAL NOT NULL CHECK (target_coherence >= 0 AND target_coherence <= 100),
  target_entropy REAL NOT NULL CHECK (target_entropy >= 0 AND target_entropy <= 100),
  target_generativity REAL NOT NULL CHECK (target_generativity >= 0 AND target_generativity <= 100),
  optimal_interventions TEXT NOT NULL,  -- JSON array
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  sample_count INTEGER NOT NULL DEFAULT 0,
  average_duration_hours REAL NOT NULL,
  success_rate REAL NOT NULL CHECK (success_rate >= 0 AND success_rate <= 1),
  stat_name TEXT CHECK (stat_name IN (
    'math', 'reading', 'science', 'coding',
    'study_skills', 'critical_thinking', 'technology', 'problem_solving'
  )),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for learned patterns
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON hyro_learned_patterns(confidence);
CREATE INDEX IF NOT EXISTS idx_patterns_success_rate ON hyro_learned_patterns(success_rate);
CREATE INDEX IF NOT EXISTS idx_patterns_stat ON hyro_learned_patterns(stat_name);

-- 4. Meta-Dimensions Table
CREATE TABLE IF NOT EXISTS hyro_meta_dimensions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  manifold_fluidity REAL DEFAULT 0.5 CHECK (manifold_fluidity >= 0 AND manifold_fluidity <= 1),
  multi_model_coherence REAL DEFAULT 0.5 CHECK (multi_model_coherence >= 0 AND multi_model_coherence <= 1),
  identity_elasticity REAL DEFAULT 0.5 CHECK (identity_elasticity >= 0 AND identity_elasticity <= 1),
  gradient_awareness REAL DEFAULT 0.5 CHECK (gradient_awareness >= 0 AND gradient_awareness <= 1),
  entropy_intuition REAL DEFAULT 0.5 CHECK (entropy_intuition >= 0 AND entropy_intuition <= 1),
  non_dual_resolution REAL DEFAULT 0.5 CHECK (non_dual_resolution >= 0 AND non_dual_resolution <= 1),
  cooperative_generativity REAL DEFAULT 0.5 CHECK (cooperative_generativity >= 0 AND cooperative_generativity <= 1),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for meta-dimensions
CREATE INDEX IF NOT EXISTS idx_meta_dimensions_student ON hyro_meta_dimensions(student_id);

-- 5. Meta-Dimension Events Table (history tracking)
CREATE TABLE IF NOT EXISTS hyro_meta_dimension_events (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN (
    'manifold_fluidity', 'multi_model_coherence', 'identity_elasticity',
    'gradient_awareness', 'entropy_intuition', 'non_dual_resolution', 'cooperative_generativity'
  )),
  change REAL NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Index for meta-dimension events
CREATE INDEX IF NOT EXISTS idx_meta_events_student ON hyro_meta_dimension_events(student_id);
CREATE INDEX IF NOT EXISTS idx_meta_events_dimension ON hyro_meta_dimension_events(dimension);

-- 6. Assessment Sessions Table
CREATE TABLE IF NOT EXISTS hyro_assessment_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN (
    'diagnostic', 'formative', 'summative', 'transfer', 'metacognitive'
  )),
  target_standards TEXT NOT NULL,  -- JSON array of standard IDs
  items TEXT NOT NULL,              -- JSON array of item IDs
  state_start_coherence REAL,
  state_start_entropy REAL,
  state_start_generativity REAL,
  state_end_coherence REAL,
  state_end_entropy REAL,
  state_end_generativity REAL,
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

-- Indexes for assessment sessions
CREATE INDEX IF NOT EXISTS idx_assessment_student ON hyro_assessment_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_type ON hyro_assessment_sessions(assessment_type);

-- 7. Assessment Responses Table
CREATE TABLE IF NOT EXISTS hyro_assessment_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  student_response TEXT NOT NULL,
  score REAL,
  rubric_scores TEXT,  -- JSON object
  time_spent_seconds INTEGER NOT NULL,
  scaffolding_used TEXT,  -- JSON array
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES hyro_assessment_sessions(id)
);

-- Index for assessment responses
CREATE INDEX IF NOT EXISTS idx_responses_session ON hyro_assessment_responses(session_id);
