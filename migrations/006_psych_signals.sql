-- Wrath Shield v3 - Psych Signals (analysis summaries)
-- Migration: 006_psych_signals

CREATE TABLE IF NOT EXISTS psych_signals (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default',
  records INTEGER NOT NULL,
  words INTEGER NOT NULL,
  vocab INTEGER NOT NULL,
  ttr REAL NOT NULL,
  sentiment_score REAL NOT NULL,
  pos_terms INTEGER NOT NULL,
  neg_terms INTEGER NOT NULL,
  emotions_json TEXT,
  top_terms_json TEXT,
  sources_json TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_psych_signals_date ON psych_signals(date DESC);
CREATE INDEX IF NOT EXISTS idx_psych_signals_user ON psych_signals(user_id);

INSERT INTO migrations (name) VALUES ('006_psych_signals')
  ON CONFLICT (name) DO NOTHING;

