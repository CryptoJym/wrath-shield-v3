/**
 * PM Agent SQLite Store
 * Handles persistence for sync state and logs
 */

import BetterSqlite3 from 'better-sqlite3';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const DEFAULT_DB_PATH = resolve(
  process.env.PM_AGENT_DB_PATH ||
  resolve(process.env.HOME || '', '.data', 'pm-agent', 'pm-agent.db')
);

const schema = `
-- Sync state tracks the relationship between Motion and GitHub items
CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY,
  motion_id TEXT UNIQUE,
  github_repo TEXT NOT NULL,
  github_issue_number INTEGER,
  github_owner TEXT,
  last_motion_update TEXT,
  last_github_update TEXT,
  sync_direction TEXT DEFAULT 'bidirectional',
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_state_motion ON sync_state(motion_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_github ON sync_state(github_repo, github_issue_number);

-- Sync log tracks individual sync operations
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_run_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  motion_id TEXT,
  github_ref TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_log_run ON sync_log(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at DESC);

-- Project mappings store Motion ↔ GitHub project relationships
CREATE TABLE IF NOT EXISTS project_mappings (
  id TEXT PRIMARY KEY,
  motion_project_id TEXT UNIQUE NOT NULL,
  motion_project_name TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium',
  rationale TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_mappings_motion ON project_mappings(motion_project_id);
CREATE INDEX IF NOT EXISTS idx_project_mappings_github ON project_mappings(github_owner, github_repo);
`;

export interface SyncState {
  id: string;
  motion_id: string | null;
  github_repo: string;
  github_issue_number: number | null;
  github_owner: string | null;
  last_motion_update: string | null;
  last_github_update: string | null;
  sync_direction: 'motion_to_github' | 'github_to_motion' | 'bidirectional';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SyncLogEntry {
  id?: number;
  sync_run_id: string;
  entity_type: 'task' | 'project' | 'issue';
  motion_id: string | null;
  github_ref: string | null;
  action: 'create' | 'update' | 'close' | 'skip' | 'error';
  status: 'success' | 'error' | 'skipped';
  error_message?: string;
  details?: Record<string, unknown>;
  created_at?: string;
}

export interface ProjectMapping {
  id: string;
  motion_project_id: string;
  motion_project_name: string;
  github_owner: string;
  github_repo: string;
  confidence: 'high' | 'medium' | 'low';
  rationale?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class PMAgentStore {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    // Ensure directory exists
    const dir = resolve(dbPath, '..');
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(schema);
  }

  close(): void {
    this.db.close();
  }

  // ============================================================
  // Sync State
  // ============================================================

  getSyncState(motionId: string): SyncState | undefined {
    const stmt = this.db.prepare('SELECT * FROM sync_state WHERE motion_id = ?');
    const row = stmt.get(motionId) as any;
    if (!row) return undefined;
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  getSyncStateByGitHub(owner: string, repo: string, issueNumber: number): SyncState | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM sync_state WHERE github_owner = ? AND github_repo = ? AND github_issue_number = ?'
    );
    const row = stmt.get(owner, repo, issueNumber) as any;
    if (!row) return undefined;
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  upsertSyncState(state: Partial<SyncState> & { motion_id: string; github_repo: string }): SyncState {
    const existing = this.getSyncState(state.motion_id);
    const id = existing?.id || randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_state (id, motion_id, github_repo, github_issue_number, github_owner,
                             last_motion_update, last_github_update, sync_direction, metadata, updated_at)
      VALUES (@id, @motion_id, @github_repo, @github_issue_number, @github_owner,
              @last_motion_update, @last_github_update, @sync_direction, @metadata, @updated_at)
      ON CONFLICT(motion_id) DO UPDATE SET
        github_repo = excluded.github_repo,
        github_issue_number = excluded.github_issue_number,
        github_owner = excluded.github_owner,
        last_motion_update = excluded.last_motion_update,
        last_github_update = excluded.last_github_update,
        sync_direction = excluded.sync_direction,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id,
      motion_id: state.motion_id,
      github_repo: state.github_repo,
      github_issue_number: state.github_issue_number || null,
      github_owner: state.github_owner || null,
      last_motion_update: state.last_motion_update || null,
      last_github_update: state.last_github_update || null,
      sync_direction: state.sync_direction || 'bidirectional',
      metadata: state.metadata ? JSON.stringify(state.metadata) : null,
      updated_at: now,
    });

    return this.getSyncState(state.motion_id)!;
  }

  getAllSyncStates(): SyncState[] {
    const stmt = this.db.prepare('SELECT * FROM sync_state ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  // ============================================================
  // Sync Log
  // ============================================================

  logSync(entry: Omit<SyncLogEntry, 'id' | 'created_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_log (sync_run_id, entity_type, motion_id, github_ref, action, status, error_message, details)
      VALUES (@sync_run_id, @entity_type, @motion_id, @github_ref, @action, @status, @error_message, @details)
    `);

    stmt.run({
      sync_run_id: entry.sync_run_id,
      entity_type: entry.entity_type,
      motion_id: entry.motion_id || null,
      github_ref: entry.github_ref || null,
      action: entry.action,
      status: entry.status,
      error_message: entry.error_message || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
    });
  }

  getRecentLogs(limit: number = 100): SyncLogEntry[] {
    const stmt = this.db.prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : undefined,
    }));
  }

  getLogsByRunId(syncRunId: string): SyncLogEntry[] {
    const stmt = this.db.prepare('SELECT * FROM sync_log WHERE sync_run_id = ? ORDER BY created_at');
    const rows = stmt.all(syncRunId) as any[];
    return rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : undefined,
    }));
  }

  getSyncStats(since?: Date): { total: number; success: number; error: number; skipped: number } {
    const whereClause = since ? 'WHERE created_at >= ?' : '';
    const params = since ? [since.toISOString()] : [];

    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM sync_log ${whereClause}
    `);

    const row = stmt.get(...params) as any;
    return {
      total: row.total || 0,
      success: row.success || 0,
      error: row.error || 0,
      skipped: row.skipped || 0,
    };
  }

  // ============================================================
  // Project Mappings
  // ============================================================

  getProjectMapping(motionProjectId: string): ProjectMapping | undefined {
    const stmt = this.db.prepare('SELECT * FROM project_mappings WHERE motion_project_id = ?');
    const row = stmt.get(motionProjectId) as any;
    if (!row) return undefined;
    return {
      ...row,
      enabled: Boolean(row.enabled),
    };
  }

  getProjectMappingByGitHub(owner: string, repo: string): ProjectMapping | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM project_mappings WHERE github_owner = ? AND github_repo = ?'
    );
    const row = stmt.get(owner, repo) as any;
    if (!row) return undefined;
    return {
      ...row,
      enabled: Boolean(row.enabled),
    };
  }

  upsertProjectMapping(mapping: Omit<ProjectMapping, 'id' | 'created_at' | 'updated_at'>): ProjectMapping {
    const existing = this.getProjectMapping(mapping.motion_project_id);
    const id = existing?.id || randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO project_mappings (id, motion_project_id, motion_project_name, github_owner,
                                   github_repo, confidence, rationale, enabled, updated_at)
      VALUES (@id, @motion_project_id, @motion_project_name, @github_owner,
              @github_repo, @confidence, @rationale, @enabled, @updated_at)
      ON CONFLICT(motion_project_id) DO UPDATE SET
        motion_project_name = excluded.motion_project_name,
        github_owner = excluded.github_owner,
        github_repo = excluded.github_repo,
        confidence = excluded.confidence,
        rationale = excluded.rationale,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id,
      motion_project_id: mapping.motion_project_id,
      motion_project_name: mapping.motion_project_name,
      github_owner: mapping.github_owner,
      github_repo: mapping.github_repo,
      confidence: mapping.confidence,
      rationale: mapping.rationale || null,
      enabled: mapping.enabled ? 1 : 0,
      updated_at: now,
    });

    return this.getProjectMapping(mapping.motion_project_id)!;
  }

  getAllProjectMappings(enabledOnly: boolean = false): ProjectMapping[] {
    const whereClause = enabledOnly ? 'WHERE enabled = 1' : '';
    const stmt = this.db.prepare(`SELECT * FROM project_mappings ${whereClause} ORDER BY motion_project_name`);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      ...row,
      enabled: Boolean(row.enabled),
    }));
  }

  // ============================================================
  // Bulk Operations
  // ============================================================

  importMappingsFromJSON(mappingsJson: {
    mappings: Array<{
      motion_project_id: string;
      motion_project_name: string;
      github_owner: string;
      github_repo: string;
      confidence: 'high' | 'medium' | 'low';
      rationale?: string;
    }>;
  }): number {
    const insertMany = this.db.transaction((mappings) => {
      let count = 0;
      for (const m of mappings) {
        this.upsertProjectMapping({
          motion_project_id: m.motion_project_id,
          motion_project_name: m.motion_project_name,
          github_owner: m.github_owner,
          github_repo: m.github_repo,
          confidence: m.confidence,
          rationale: m.rationale,
          enabled: true,
        });
        count++;
      }
      return count;
    });

    return insertMany(mappingsJson.mappings);
  }
}

export default PMAgentStore;
