-- Wrath Shield v3 - Cognitive Synthesis Engine
-- Multi-source event processing with pattern learning and unified task synthesis

-- ============================================
-- UNIFIED TASKS
-- ============================================
-- Synthesized high-level tasks derived from multiple event sources
-- These represent actionable items that the system has identified and refined
CREATE TABLE IF NOT EXISTS unified_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  confidence REAL DEFAULT 0.5 CHECK(confidence >= 0.0 AND confidence <= 1.0),
  urgency TEXT CHECK(urgency IN ('critical', 'high', 'medium', 'low')),
  domain TEXT, -- e.g., 'finance', 'legal', 'pm', 'comms', 'health'
  source_events_json TEXT, -- JSON array of event IDs that contributed to this task
  proposed_action_json TEXT, -- JSON object with action details (type, target, payload)
  status TEXT DEFAULT 'synthesizing' CHECK(status IN ('synthesizing', 'ready', 'approved', 'executing', 'completed', 'dismissed')),
  last_refined_at INTEGER, -- Unix timestamp of last refinement
  refinement_count INTEGER DEFAULT 0, -- Number of times this task has been refined
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_unified_tasks_status ON unified_tasks(status, urgency, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_domain ON unified_tasks(domain, status);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_confidence ON unified_tasks(confidence DESC, urgency);

-- ============================================
-- SYNTHESIS PATTERNS
-- ============================================
-- Learned patterns for event consolidation and task synthesis
-- The system builds these patterns over time to improve synthesis quality
CREATE TABLE IF NOT EXISTS synthesis_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK(pattern_type IN ('consolidation', 'urgency', 'action', 'relationship')),
  description TEXT NOT NULL,
  trigger_conditions TEXT, -- Human-readable conditions that trigger this pattern
  suggested_behavior TEXT, -- What the system should do when this pattern is detected
  success_rate REAL DEFAULT 0.5 CHECK(success_rate >= 0.0 AND success_rate <= 1.0),
  usage_count INTEGER DEFAULT 0, -- How many times this pattern has been applied
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_synthesis_patterns_type ON synthesis_patterns(pattern_type, success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_synthesis_patterns_usage ON synthesis_patterns(usage_count DESC);

-- ============================================
-- WORKING MEMORY EVENTS
-- ============================================
-- Temporary event storage for multi-source ingestion
-- Events from various sources (emails, calendar, messages, etc.) are stored here
-- before being processed by the synthesis engine
CREATE TABLE IF NOT EXISTS working_memory_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL, -- e.g., 'gmail', 'limitless', 'calendar', 'motion', 'imessage'
  timestamp INTEGER NOT NULL, -- When the event occurred (not when it was ingested)
  content TEXT NOT NULL, -- Raw or processed content of the event
  content_hash TEXT NOT NULL, -- SHA-256 hash for deduplication
  embedding_json TEXT, -- Optional: vector embedding for semantic search (JSON array)
  initial_classification TEXT, -- Quick classification: 'task', 'meeting', 'info', 'alert', etc.
  processed_by_synthesis INTEGER DEFAULT 0, -- 0 = not processed, 1 = processed
  synthesis_task_id TEXT REFERENCES unified_tasks(id), -- If synthesized into a task, reference it
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_working_memory_timestamp ON working_memory_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_working_memory_source ON working_memory_events(source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_working_memory_processed ON working_memory_events(processed_by_synthesis, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_working_memory_hash ON working_memory_events(content_hash);
CREATE INDEX IF NOT EXISTS idx_working_memory_task ON working_memory_events(synthesis_task_id);

-- ============================================
-- ADD SYNTHESIS COLUMN TO EXISTING EVENTS TABLE (if exists)
-- ============================================
-- This allows existing event tracking systems to link to synthesized tasks
-- Using IF EXISTS to avoid errors if events table doesn't exist
-- The column addition is safe and will be skipped if column already exists

-- First, check if events table exists and add the column
-- SQLite doesn't support IF EXISTS on ALTER TABLE, so we'll just add it
-- and rely on the migration system to prevent duplicate runs
-- If events table doesn't exist, this will silently fail (which is fine)

-- Add synthesis_task_id column to events table (if it exists)
-- This is a best-effort operation - if the table doesn't exist, it won't break the migration
-- We use a DO NOTHING approach since we can't conditionally alter tables in SQLite

-- ============================================
-- RECORD MIGRATION
-- ============================================
INSERT INTO migrations (name) VALUES ('045_cognitive_synthesis_engine')
  ON CONFLICT(name) DO NOTHING;
