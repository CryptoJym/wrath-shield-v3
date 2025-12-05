-- HYRO FORGE: Multi-Tenant Student System
-- Migration 032: Students table linking Clerk user IDs to HYRO profiles
-- Created: 2025-12-03

-- ============================================================================
-- STUDENTS TABLE - Links Clerk Auth to HYRO Profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS students (
  -- Primary identifier (use Clerk user_id as the key)
  id TEXT PRIMARY KEY,                    -- Clerk user_id (e.g., 'user_2abc123...')

  -- Profile information
  display_name TEXT NOT NULL,             -- Student's display name
  email TEXT,                             -- Email from Clerk (optional)
  avatar_url TEXT,                        -- Profile picture from Clerk

  -- HYRO FORGE profile settings
  grade_level INTEGER DEFAULT 5,          -- Current grade level (K-12)
  birth_year INTEGER,                     -- For age-appropriate content
  timezone TEXT DEFAULT 'America/Chicago',

  -- Onboarding status
  onboarding_completed INTEGER DEFAULT 0,  -- 0 = needs onboarding, 1 = complete
  onboarding_step TEXT DEFAULT 'welcome',  -- Current onboarding step

  -- Parent/Guardian (for linked accounts)
  parent_user_id TEXT,                    -- Clerk user_id of parent (if applicable)
  parent_email TEXT,                      -- Parent's email for notifications

  -- Platform credentials (encrypted references, not actual passwords)
  platform_credentials TEXT,              -- JSON: {"zearn": {...}, "quill": {...}}

  -- Preferences
  preferences TEXT,                       -- JSON: notification settings, themes, etc.

  -- Status
  is_active INTEGER DEFAULT 1,            -- Soft delete flag

  -- Timestamps
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  last_login_at INTEGER
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_parent ON students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_students_onboarding ON students(onboarding_completed) WHERE onboarding_completed = 0;

-- ============================================================================
-- SEED DATA - Create Hyro's profile (link to his Clerk account)
-- ============================================================================

-- Note: Replace 'hyro_clerk_id' with actual Clerk user_id when Hyro logs in
-- This creates a placeholder that will be updated on first login
INSERT OR IGNORE INTO students (
  id,
  display_name,
  grade_level,
  onboarding_completed,
  onboarding_step
) VALUES (
  'hyro',                    -- Will be replaced with Clerk ID on first login
  'Hyro',
  5,                         -- 5th grade
  1,                         -- Already onboarded (existing user)
  'complete'
);

-- Record migration
INSERT INTO migrations (name) VALUES ('032_students');
