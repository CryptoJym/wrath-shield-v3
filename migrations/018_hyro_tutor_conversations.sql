-- HYRO FORGE: AI Tutor Conversations Table
-- Stores chat history and context for AI tutor interactions

CREATE TABLE IF NOT EXISTS hyro_tutor_conversations (
  id TEXT PRIMARY KEY,
  messages TEXT NOT NULL DEFAULT '[]', -- JSON array of TutorMessage objects
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  last_message_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  total_xp_earned INTEGER NOT NULL DEFAULT 0,
  stat_focus TEXT NOT NULL DEFAULT '[]' -- JSON array of stat names discussed
);

-- Index for quick lookups by recency
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_last_message
ON hyro_tutor_conversations(last_message_at DESC);

-- Index for finding active conversations
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_created
ON hyro_tutor_conversations(created_at DESC);
