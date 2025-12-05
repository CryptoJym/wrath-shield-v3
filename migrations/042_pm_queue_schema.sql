-- Migration: Create pm_queue table for Unified Orchestration Layer

CREATE TABLE IF NOT EXISTS pm_queue (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  signal_source TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_payload TEXT NOT NULL,
  signal_timestamp INTEGER NOT NULL,
  signal_confidence REAL NOT NULL,

  triage_action TEXT NOT NULL,
  triage_rationale TEXT,
  triage_priority TEXT NOT NULL,
  triage_escalation_level TEXT NOT NULL,
  triage_due_date TEXT,
  triage_assigned_project TEXT,
  triage_suggested_title TEXT,
  triage_suggested_labels TEXT,
  triage_metadata TEXT,

  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  processed_at INTEGER,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata TEXT,

  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'deferred'))
);

CREATE INDEX IF NOT EXISTS idx_pm_queue_status ON pm_queue(status);
CREATE INDEX IF NOT EXISTS idx_pm_queue_created_at ON pm_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_pm_queue_source ON pm_queue(signal_source);
CREATE INDEX IF NOT EXISTS idx_pm_queue_escalation ON pm_queue(triage_escalation_level);
