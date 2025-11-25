-- Guarded migration: only alter finance tables if they exist (Vercel build-friendly)
PRAGMA foreign_keys=OFF;

-- finance_transactions: add user_id + index
BEGIN;
  SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_transactions';
  -- Only run alters if table exists
  CREATE TEMP TABLE IF NOT EXISTS __dummy_finance_flag(flag INT);
  DELETE FROM __dummy_finance_flag;
  INSERT INTO __dummy_finance_flag(flag) SELECT 1 WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_transactions');
  -- If flag inserted, apply alters
  UPDATE __dummy_finance_flag SET flag=flag;
  -- Add column/index guarded by existence checks
  ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS user_id TEXT;
  CREATE INDEX IF NOT EXISTS idx_finance_user ON finance_transactions(user_id);
COMMIT;

-- finance_context_requests: add user_id + index
BEGIN;
  SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_context_requests';
  CREATE TEMP TABLE IF NOT EXISTS __dummy_ctx_flag(flag INT);
  DELETE FROM __dummy_ctx_flag;
  INSERT INTO __dummy_ctx_flag(flag) SELECT 1 WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_context_requests');
  UPDATE __dummy_ctx_flag SET flag=flag;
  ALTER TABLE finance_context_requests ADD COLUMN IF NOT EXISTS user_id TEXT;
  CREATE INDEX IF NOT EXISTS idx_ctx_user ON finance_context_requests(user_id);
COMMIT;

DROP TABLE IF EXISTS __dummy_finance_flag;
DROP TABLE IF EXISTS __dummy_ctx_flag;
