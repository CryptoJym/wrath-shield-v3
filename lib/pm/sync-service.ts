/**
 * PM Sync Service
 *
 * GitHub-native sync service for project management.
 * Tracks synchronization history and provides utilities for
 * managing GitHub-based task data.
 *
 * Motion has been deprecated - this service now focuses on GitHub operations.
 */

import { getDatabase } from '@/lib/db/Database';
import githubClient from '@/lib/integrations/GitHubClient';
import { recordEvent } from './temporal-context';

export interface SyncConfig {
  dryRun?: boolean;
  repoFilter?: string; // Filter by specific repo
  includeLocal?: boolean; // Include local tasks in sync
}

export interface SyncResult {
  id: number;
  sync_type: string;
  started_at: number;
  completed_at: number | null;
  status: 'running' | 'completed' | 'failed';
  tasks_synced: number;
  errors: string[];
  metadata: Record<string, unknown>;
}

interface SyncHistoryRow {
  id: number;
  sync_type: string;
  started_at: number;
  completed_at: number | null;
  status: string;
  tasks_synced: number;
  errors: string | null;
  metadata: string | null;
}

function ensureSyncTable(): void {
  const db = getDatabase().getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
      tasks_synced INTEGER DEFAULT 0,
      errors TEXT,
      metadata TEXT
    )
  `);
}

function rowToResult(row: SyncHistoryRow): SyncResult {
  return {
    id: row.id,
    sync_type: row.sync_type,
    started_at: row.started_at,
    completed_at: row.completed_at,
    status: row.status as SyncResult['status'],
    tasks_synced: row.tasks_synced,
    errors: row.errors ? JSON.parse(row.errors) : [],
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}

/**
 * Start a sync operation and record it in history
 */
function startSyncRecord(sync_type: string): number {
  ensureSyncTable();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(`
    INSERT INTO pm_sync_history (sync_type, started_at, status)
    VALUES (@sync_type, @started_at, 'running')
  `).run({ sync_type, started_at: now });

  return result.lastInsertRowid as number;
}

/**
 * Complete a sync operation
 */
function completeSyncRecord(id: number, stats: {
  tasks_synced: number;
  errors: string[];
  metadata?: Record<string, unknown>;
}): void {
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE pm_sync_history
    SET completed_at = @completed_at,
        status = @status,
        tasks_synced = @tasks_synced,
        errors = @errors,
        metadata = @metadata
    WHERE id = @id
  `).run({
    id,
    completed_at: now,
    status: stats.errors.length > 0 ? 'failed' : 'completed',
    tasks_synced: stats.tasks_synced,
    errors: JSON.stringify(stats.errors),
    metadata: stats.metadata ? JSON.stringify(stats.metadata) : null,
  });
}

/**
 * Get recent sync history
 */
export function getSyncHistory(limit: number = 20): SyncResult[] {
  ensureSyncTable();
  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM pm_sync_history
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit) as SyncHistoryRow[];

  return rows.map(rowToResult);
}

/**
 * Get the last successful sync
 */
export function getLastSuccessfulSync(): SyncResult | null {
  ensureSyncTable();
  const db = getDatabase().getRawDb();

  const row = db.prepare(`
    SELECT * FROM pm_sync_history
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
  `).get() as SyncHistoryRow | undefined;

  return row ? rowToResult(row) : null;
}

/**
 * Check if a sync is currently running
 */
export function isSyncRunning(): boolean {
  ensureSyncTable();
  const db = getDatabase().getRawDb();

  const row = db.prepare(`
    SELECT COUNT(*) as count FROM pm_sync_history
    WHERE status = 'running'
  `).get() as { count: number };

  return row.count > 0;
}

/**
 * Run a GitHub sync operation
 *
 * This fetches and caches GitHub data locally:
 * 1. Fetches issues from all enabled repos
 * 2. Updates local cache with latest data
 * 3. Records sync history
 */
export async function runSync(config: SyncConfig = {}): Promise<SyncResult> {
  if (isSyncRunning()) {
    throw new Error('A sync operation is already in progress');
  }

  const syncType = 'github_refresh';
  const syncId = startSyncRecord(syncType);

  const errors: string[] = [];
  let tasksSynced = 0;
  const metadata: Record<string, unknown> = {
    dryRun: config.dryRun || false,
    syncType,
  };

  try {
    // Check if GitHub is configured
    const githubConfigured = githubClient.isConfigured();

    if (!githubConfigured) {
      throw new Error('GitHub is not configured. Add GITHUB_ACCESS_TOKEN to .env.local');
    }

    // Get enabled repos from GitHub client
    const enabledRepos = githubClient.getEnabledRepos();
    metadata.enabledRepos = enabledRepos.length;
    metadata.repoNames = enabledRepos.map(r => r.repo_full_name);

    // Fetch data from GitHub
    let githubIssues: Awaited<ReturnType<typeof githubClient.getAllIssues>> = [];

    try {
      githubIssues = await githubClient.getAllIssues({ state: 'all' });
      metadata.githubIssues = githubIssues.length;
      tasksSynced = githubIssues.length;
    } catch (error) {
      errors.push(`GitHub fetch error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Calculate stats
    const openIssues = githubIssues.filter(i => i.state === 'open').length;
    const closedIssues = githubIssues.filter(i => i.state === 'closed').length;

    metadata.openIssues = openIssues;
    metadata.closedIssues = closedIssues;
    metadata.tasksSynced = tasksSynced;

    // Log sync details
    console.log(`[PM Sync] GitHub sync complete: ${openIssues} open, ${closedIssues} closed issues from ${enabledRepos.length} repos`);

    // Record temporal event for grounding
    recordEvent({
      event_type: 'sync',
      event_key: 'github_refresh',
      metadata: {
        repos: enabledRepos.length,
        issues: githubIssues.length,
        open: openIssues,
        closed: closedIssues,
      },
    });

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  completeSyncRecord(syncId, { tasks_synced: tasksSynced, errors, metadata });

  // Return the completed record
  ensureSyncTable();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM pm_sync_history WHERE id = ?').get(syncId) as SyncHistoryRow;
  return rowToResult(row);
}

/**
 * Schedule periodic sync (call from cron or interval)
 */
export async function scheduledSync(): Promise<SyncResult | null> {
  const lastSync = getLastSuccessfulSync();
  const now = Math.floor(Date.now() / 1000);

  // Only sync if last sync was more than 15 minutes ago
  if (lastSync && lastSync.completed_at && (now - lastSync.completed_at) < 900) {
    console.log('[PM Sync] Skipping scheduled sync - last sync was recent');
    return null;
  }

  console.log('[PM Sync] Starting scheduled GitHub sync');
  return runSync();
}
