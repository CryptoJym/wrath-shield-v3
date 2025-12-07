-- HYRO FORGE: Session Planning
-- Migration 044: Create session plans table
-- Created: 2025-12-07

CREATE TABLE IF NOT EXISTS hyro_session_plans (
  id TEXT PRIMARY KEY,
  planned_date TEXT NOT NULL,
  activities TEXT NOT NULL, -- JSON array of SessionActivity
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  xp_potential INTEGER,
  xp_earned INTEGER,
  completion_rate REAL DEFAULT 0,
  
  -- Tracking
  status TEXT DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'abandoned'
  started_at INTEGER,
  completed_at INTEGER,
  
  -- Metadata
  stat_focus TEXT, -- JSON array of strings
  
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_hyro_session_plans_date ON hyro_session_plans(planned_date);
INSERT INTO migrations (name) VALUES ('044_create_session_plans');
