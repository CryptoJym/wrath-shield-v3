-- PM Local Tasks and Settings Migration
-- Adds local task storage and Motion workspace configuration

-- Record migration
INSERT OR IGNORE INTO migrations (name) VALUES ('013_pm_local_tasks');

-- Local tasks table for PM items not synced to external systems
CREATE TABLE IF NOT EXISTS local_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'failed', 'backlog')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
    project_id TEXT,
    project_name TEXT,
    assignee TEXT,
    due_date TEXT,
    labels TEXT, -- JSON array
    metadata TEXT, -- JSON object
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    user_id TEXT DEFAULT 'default'
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_tasks(status);
CREATE INDEX IF NOT EXISTS idx_local_tasks_priority ON local_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_local_tasks_user ON local_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_local_tasks_updated ON local_tasks(updated_at DESC);

-- PM settings table for workspace configuration
CREATE TABLE IF NOT EXISTS pm_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Sync history for tracking GitHub/Motion synchronization
CREATE TABLE IF NOT EXISTS pm_sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL, -- 'github_to_motion', 'motion_to_github', 'full'
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    tasks_synced INTEGER DEFAULT 0,
    errors TEXT, -- JSON array of error messages
    metadata TEXT -- JSON object with additional details
);

CREATE INDEX IF NOT EXISTS idx_pm_sync_history_type ON pm_sync_history(sync_type);
CREATE INDEX IF NOT EXISTS idx_pm_sync_history_started ON pm_sync_history(started_at DESC);
