-- ============================================================================
-- HYRO FORGE PHASE 4: NOTIFICATION & ALERT SYSTEM
-- Alert generation, storage, preferences, and notification tracking
-- ============================================================================

-- ============================================================================
-- 1. ALERTS TABLE
-- Store all generated alerts for parent engagement
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- streak_at_risk, streak_milestone, session_complete, level_up, achievement_earned, weekly_report, growth_opportunity, quest_reminder
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',  -- low, medium, high

  -- Status tracking
  created_at INTEGER DEFAULT (unixepoch()),
  read_at INTEGER,
  dismissed INTEGER DEFAULT 0,

  -- Action and metadata
  action_url TEXT,
  metadata TEXT,  -- JSON for additional context (stat names, streak counts, etc.)

  -- Deduplication tracking
  alert_key TEXT,  -- Unique key for deduplication (e.g., 'streak_risk_2025-12-03')

  CHECK (type IN ('streak_at_risk', 'streak_milestone', 'session_complete', 'level_up', 'achievement_earned', 'weekly_report', 'growth_opportunity', 'quest_reminder')),
  CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_hyro_alerts_type ON hyro_alerts(type);
CREATE INDEX IF NOT EXISTS idx_hyro_alerts_created ON hyro_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hyro_alerts_read ON hyro_alerts(read_at);
CREATE INDEX IF NOT EXISTS idx_hyro_alerts_dismissed ON hyro_alerts(dismissed);
CREATE INDEX IF NOT EXISTS idx_hyro_alerts_key ON hyro_alerts(alert_key);

-- ============================================================================
-- 2. ALERT PREFERENCES TABLE
-- Allow parents to customize which alerts they receive and how
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_alert_preferences (
  alert_type TEXT PRIMARY KEY,  -- must match alert types above
  enabled INTEGER DEFAULT 1,
  email_enabled INTEGER DEFAULT 0,
  frequency TEXT DEFAULT 'immediate',  -- immediate, hourly, daily, weekly
  last_sent_at INTEGER,  -- Track when we last sent this type (for rate limiting)

  CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly'))
);

-- Initialize default preferences for all alert types
INSERT OR IGNORE INTO hyro_alert_preferences (alert_type, enabled, email_enabled, frequency) VALUES
  ('streak_at_risk', 1, 0, 'immediate'),
  ('streak_milestone', 1, 0, 'immediate'),
  ('session_complete', 1, 0, 'immediate'),
  ('level_up', 1, 0, 'immediate'),
  ('achievement_earned', 1, 0, 'immediate'),
  ('weekly_report', 1, 0, 'weekly'),
  ('growth_opportunity', 1, 0, 'daily'),
  ('quest_reminder', 1, 0, 'daily');

-- ============================================================================
-- 3. ALERT GENERATION TRACKING
-- Prevent spam by tracking when we last checked for each alert type
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_alert_generation_log (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,
  check_timestamp INTEGER DEFAULT (unixepoch()),
  alerts_generated INTEGER DEFAULT 0,
  metadata TEXT  -- JSON for debugging (what triggered it, threshold values, etc.)
);

CREATE INDEX IF NOT EXISTS idx_alert_gen_log_type_time ON hyro_alert_generation_log(alert_type, check_timestamp DESC);

-- ============================================================================
-- 4. STREAK TRACKING (for streak_at_risk alerts)
-- Track last activity timestamp to generate alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS hyro_streak_tracker (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_session_at INTEGER,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_streak_alert_at INTEGER,  -- Prevent multiple alerts in same 24h window
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Initialize singleton row
INSERT OR IGNORE INTO hyro_streak_tracker (id, last_session_at, current_streak_days, longest_streak_days)
VALUES ('singleton', unixepoch(), 0, 0);

-- ============================================================================
-- 5. VIEWS FOR EASY QUERYING
-- ============================================================================

-- Unread alerts view
CREATE VIEW IF NOT EXISTS hyro_alerts_unread AS
SELECT * FROM hyro_alerts
WHERE read_at IS NULL AND dismissed = 0
ORDER BY
  CASE priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    ELSE 3
  END,
  created_at DESC;

-- Recent alerts (last 7 days)
CREATE VIEW IF NOT EXISTS hyro_alerts_recent AS
SELECT * FROM hyro_alerts
WHERE created_at >= unixepoch() - (7 * 86400)
ORDER BY created_at DESC;
