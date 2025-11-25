-- Add user_id to events table for per-user partitioning
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
