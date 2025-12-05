-- ============================================================================
-- HYRO FORGE: Fix Stats Unique Constraint for Multi-Tenant
-- Migration 034: Recreate hyro_stats with proper UNIQUE constraint
-- Created: 2025-12-04
--
-- PROBLEM:
-- The original hyro_stats table had UNIQUE(stat_name) which only allows
-- ONE stat of each name globally. With multi-tenant support, we need
-- each student to have their own set of 8 stats.
--
-- SOLUTION:
-- Recreate the table with UNIQUE(student_id, stat_name) instead.
-- ============================================================================

-- Step 1: Create new table with correct constraint
CREATE TABLE IF NOT EXISTS hyro_stats_new (
  id TEXT PRIMARY KEY,
  student_id TEXT DEFAULT 'hyro',
  stat_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  base_value INTEGER DEFAULT 10,
  current_value INTEGER DEFAULT 10,
  modifier INTEGER DEFAULT 0,
  last_assessed INTEGER,
  assessment_confidence REAL DEFAULT 0.5,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(student_id, stat_name)
);

-- Step 2: Copy existing data
INSERT OR IGNORE INTO hyro_stats_new
  (id, student_id, stat_name, display_name, description, base_value, current_value,
   modifier, last_assessed, assessment_confidence, created_at, updated_at)
SELECT
  id, student_id, stat_name, display_name, description, base_value, current_value,
  modifier, last_assessed, assessment_confidence, created_at, updated_at
FROM hyro_stats;

-- Step 3: Drop old table
DROP TABLE IF EXISTS hyro_stats;

-- Step 4: Rename new table
ALTER TABLE hyro_stats_new RENAME TO hyro_stats;

-- Step 5: Recreate index on student_id
CREATE INDEX IF NOT EXISTS idx_hyro_stats_student ON hyro_stats(student_id);

-- Step 6: Record migration
INSERT INTO migrations (name) VALUES ('034_fix_stats_unique_constraint');
