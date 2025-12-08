BEGIN TRANSACTION;

DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS lesson_plans;
DROP TABLE IF EXISTS weekly_schedules;
DROP TABLE IF EXISTS platform_credentials;
DROP TABLE IF EXISTS sync_logs;
DROP TABLE IF EXISTS standards;
DROP TABLE IF EXISTS standard_mastery;
DROP TABLE IF EXISTS concepts;
DROP TABLE IF EXISTS standard_concepts;

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_id TEXT,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date INTEGER,
  assigned_date INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  score REAL,
  max_score REAL,
  url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_platform ON assignments(platform, platform_id);

CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  objectives TEXT NOT NULL, -- JSON array
  activities TEXT NOT NULL, -- JSON array
  duration_minutes INTEGER NOT NULL,
  scheduled_date TEXT,
  scheduled_time TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  resources TEXT, -- JSON array
  notes TEXT,
  effectiveness_rating INTEGER,
  feedback TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_student ON lesson_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_date ON lesson_plans(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject ON lesson_plans(subject);

CREATE TABLE IF NOT EXISTS weekly_schedules (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  week_start TEXT NOT NULL, -- YYYY-MM-DD
  schedule TEXT NOT NULL, -- JSON array
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(student_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_student ON weekly_schedules(student_id);

CREATE TABLE IF NOT EXISTS platform_credentials (
  platform TEXT PRIMARY KEY,
  username TEXT,
  encrypted_password TEXT,
  cookies TEXT,
  last_login_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  student_id TEXT NOT NULL,
  success INTEGER NOT NULL,
  assignments_found INTEGER DEFAULT 0,
  assignments_new INTEGER DEFAULT 0,
  assignments_updated INTEGER DEFAULT 0,
  error TEXT,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON sync_logs(platform, synced_at DESC);

CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT NOT NULL,
  prerequisites TEXT, -- JSON array
  cluster TEXT
);
CREATE INDEX IF NOT EXISTS idx_standards_domain ON standards(domain);

CREATE TABLE IF NOT EXISTS standard_mastery (
  student_id TEXT NOT NULL,
  standard_id TEXT NOT NULL,
  mastery_level REAL DEFAULT 0, -- 0-100
  evidence_count INTEGER DEFAULT 0,
  last_practiced_at INTEGER,
  status TEXT DEFAULT 'locked', -- locked, unlocked, practicing, mastered
  confidence_score REAL DEFAULT 0,
  PRIMARY KEY (student_id, standard_id)
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  discipline TEXT, -- physics, math, philosophy
  layer TEXT NOT NULL DEFAULT 'fundamental' -- fundamental, derived, heuristic
);

CREATE TABLE IF NOT EXISTS standard_concepts (
  standard_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  authenticity_layer TEXT NOT NULL DEFAULT 'direct', -- direct, approximation, special_case
  notes TEXT,
  PRIMARY KEY (standard_id, concept_id)
);

COMMIT;
