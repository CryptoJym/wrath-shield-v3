-- Council Proposals Table
-- Stores pending, approved, and rejected proposals for the org-council memory graph
-- Provides persistence for the council approval workflow

CREATE TABLE IF NOT EXISTS council_proposals (
  id TEXT PRIMARY KEY,
  proposed_by TEXT NOT NULL,
  text TEXT NOT NULL,
  metadata TEXT, -- JSON blob for additional context
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Index for fast pending proposal lookup
CREATE INDEX IF NOT EXISTS idx_council_proposals_status ON council_proposals(status);
CREATE INDEX IF NOT EXISTS idx_council_proposals_proposed_by ON council_proposals(proposed_by);
CREATE INDEX IF NOT EXISTS idx_council_proposals_created_at ON council_proposals(created_at DESC);

-- Council Notifications Table
-- Tracks notification state for proposals
CREATE TABLE IF NOT EXISTS council_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL REFERENCES council_proposals(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('new_proposal', 'approved', 'rejected')),
  recipient TEXT NOT NULL, -- 'council' or specific user id
  read_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(proposal_id, notification_type, recipient)
);

CREATE INDEX IF NOT EXISTS idx_council_notifications_unread ON council_notifications(recipient, read_at) WHERE read_at IS NULL;

-- Insert migration record
INSERT INTO migrations (name) VALUES ('011_council_proposals');
