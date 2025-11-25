-- Wrath Shield v3 - Agentic Actions Log
-- Tracks EA automation outputs (tasks, drafts, reminders, events) with confidence + status

CREATE TABLE IF NOT EXISTS agentic_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL, -- task | email_draft | text_message | reminder | calendar_event | note
  target TEXT,        -- todoist | gmail | outlook | calendar | sms | github | motion | other
  title TEXT,
  content TEXT NOT NULL,
  confidence REAL,    -- 0.0 - 1.0
  status TEXT NOT NULL DEFAULT 'proposed', -- proposed | queued | executed | failed | dismissed
  source TEXT,        -- e.g., hourly-scan, manual-run
  metadata TEXT,      -- JSON blob (recipients, due date, agenda, etc.)
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_agentic_actions_user ON agentic_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agentic_actions_status ON agentic_actions(status, created_at DESC);

INSERT INTO migrations (name) VALUES ('007_agentic_actions')
  ON CONFLICT(name) DO NOTHING;
