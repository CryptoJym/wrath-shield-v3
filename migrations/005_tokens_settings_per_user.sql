-- Rebuild tokens and settings to be per-user with composite keys

-- Tokens: migrate to composite PK (provider, user_id)
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS tokens_new (
  provider TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at INTEGER,
  user_id TEXT NOT NULL DEFAULT 'default',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (provider, user_id)
);

INSERT INTO tokens_new (provider, access_token_enc, refresh_token_enc, expires_at, user_id, created_at, updated_at)
SELECT provider, access_token_enc, refresh_token_enc, expires_at, 'default' as user_id, created_at, updated_at
FROM tokens;

DROP TABLE tokens;
ALTER TABLE tokens_new RENAME TO tokens;

-- Settings: migrate to composite PK (key, user_id)
CREATE TABLE IF NOT EXISTS settings_new (
  key TEXT NOT NULL,
  value_enc TEXT,
  user_id TEXT NOT NULL DEFAULT 'default',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (key, user_id)
);

INSERT INTO settings_new (key, value_enc, user_id, created_at, updated_at)
SELECT key, value_enc, 'default' as user_id, created_at, updated_at
FROM settings;

DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;

COMMIT;
PRAGMA foreign_keys=on;

INSERT INTO migrations (name) VALUES ('005_tokens_settings_per_user')
  ON CONFLICT (name) DO NOTHING;

