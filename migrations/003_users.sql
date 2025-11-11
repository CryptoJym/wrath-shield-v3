-- Wrath Shield v3 - Users Table
-- Migration: 003_users
-- Purpose: Minimal user profiles to support multi-user flows

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  timezone TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

INSERT INTO migrations (name) VALUES ('003_users')
  ON CONFLICT (name) DO NOTHING;

