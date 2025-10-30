-- Wrath Shield v3 - Burst Forge Tables
-- Migration: 002_burst_forge_tables
-- Created: 2025-10-26
-- Purpose: Add tables for Burst Forge 90-second confidence rewrites

-- Flags Table
-- Stores manipulation flags detected in conversation text
CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('pending', 'resolved', 'dismissed')),
  original_text TEXT NOT NULL,
  detected_at INTEGER NOT NULL,
  severity INTEGER DEFAULT 3,
  manipulation_type TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_flags_status ON flags(status);
CREATE INDEX IF NOT EXISTS idx_flags_detected_at ON flags(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_flags_severity ON flags(severity DESC);

-- Tweaks Table
-- Stores confidence rewrites and flag resolutions
CREATE TABLE IF NOT EXISTS tweaks (
  id TEXT PRIMARY KEY,
  flag_id TEXT NOT NULL,
  assured_text TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN ('rewrite', 'dismiss', 'escalate')),
  context TEXT,
  delta_uix REAL DEFAULT 0.0,
  user_notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (flag_id) REFERENCES flags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tweaks_flag_id ON tweaks(flag_id);
CREATE INDEX IF NOT EXISTS idx_tweaks_action_type ON tweaks(action_type);
CREATE INDEX IF NOT EXISTS idx_tweaks_delta_uix ON tweaks(delta_uix DESC);
CREATE INDEX IF NOT EXISTS idx_tweaks_created_at ON tweaks(created_at DESC);

-- Migration Tracking
INSERT INTO migrations (name) VALUES ('002_burst_forge_tables')
  ON CONFLICT (name) DO NOTHING;
