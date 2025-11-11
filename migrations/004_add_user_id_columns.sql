-- Add user_id columns to core tables for multi-user support

ALTER TABLE cycles ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_cycles_user_id ON cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_cycles_user_date ON cycles(user_id, date DESC);

ALTER TABLE recoveries ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_recoveries_user_id ON recoveries(user_id);
CREATE INDEX IF NOT EXISTS idx_recoveries_user_date ON recoveries(user_id, date DESC);

ALTER TABLE sleeps ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_sleeps_user_id ON sleeps(user_id);
CREATE INDEX IF NOT EXISTS idx_sleeps_user_date ON sleeps(user_id, date DESC);

ALTER TABLE lifelogs ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_lifelogs_user_id ON lifelogs(user_id);
CREATE INDEX IF NOT EXISTS idx_lifelogs_user_date ON lifelogs(user_id, date DESC);

ALTER TABLE scores ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_user_date ON scores(user_id, date DESC);

-- Note: tokens/settings left as global for now

INSERT INTO migrations (name) VALUES ('004_add_user_id_columns')
  ON CONFLICT (name) DO NOTHING;

