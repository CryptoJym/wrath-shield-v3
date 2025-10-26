-- Wrath Shield v3 - Initial Database Schema
-- Migration: 001_initial_schema
-- Created: 2025-10-26

-- WHOOP Cycles Table
-- Stores daily WHOOP cycle data (strain, kilojoules, heart rate)
CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  strain REAL,
  kilojoules REAL,
  avg_hr REAL,
  max_hr REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cycles_date ON cycles(date DESC);

-- WHOOP Recovery Table
-- Stores daily recovery scores and biometric data
CREATE TABLE IF NOT EXISTS recoveries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  score INTEGER,
  hrv REAL,
  rhr REAL,
  spo2 REAL,
  skin_temp REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_recoveries_date ON recoveries(date DESC);

-- WHOOP Sleep Table
-- Stores sleep performance and sleep stage data
CREATE TABLE IF NOT EXISTS sleeps (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  performance INTEGER,
  rem_min INTEGER,
  sws_min INTEGER,
  light_min INTEGER,
  respiration REAL,
  sleep_debt_min INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sleeps_date ON sleeps(date DESC);

-- Limitless Lifelogs Table
-- Stores daily interaction logs with manipulation detection
CREATE TABLE IF NOT EXISTS lifelogs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT,
  manipulation_count INTEGER DEFAULT 0,
  wrath_deployed INTEGER DEFAULT 0,
  raw_json TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_lifelogs_date ON lifelogs(date DESC);
CREATE INDEX IF NOT EXISTS idx_lifelogs_manipulation ON lifelogs(manipulation_count);

-- OAuth Tokens Table
-- Stores encrypted access and refresh tokens for API integrations
CREATE TABLE IF NOT EXISTS tokens (
  provider TEXT PRIMARY KEY CHECK(provider IN ('whoop', 'limitless')),
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Daily Scores Table
-- Stores calculated Unbending Score and compliance metrics
CREATE TABLE IF NOT EXISTS scores (
  date TEXT PRIMARY KEY,
  unbending_score REAL,
  recovery_compliance REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_date ON scores(date DESC);
CREATE INDEX IF NOT EXISTS idx_scores_unbending ON scores(unbending_score DESC);

-- Settings Table
-- Stores encrypted application settings and user preferences
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_enc TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Migration Tracking Table
-- Tracks applied database migrations
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER DEFAULT (strftime('%s', 'now'))
);

INSERT INTO migrations (name) VALUES ('001_initial_schema')
  ON CONFLICT (name) DO NOTHING;
