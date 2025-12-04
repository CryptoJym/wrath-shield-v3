/**
 * Local Task Store
 *
 * SQLite-based persistence for local PM tasks that aren't synced to GitHub/Motion.
 * Provides full CRUD operations and query capabilities.
 */

import { getDatabase } from '@/lib/db/Database';
import crypto from 'crypto';
import type { TaskStatus, TaskPriority } from './types';

export interface LocalTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string | null;
  project_name: string | null;
  assignee: string | null;
  due_date: string | null;
  labels: string[];
  metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  user_id: string;
}

interface LocalTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  project_id: string | null;
  project_name: string | null;
  assignee: string | null;
  due_date: string | null;
  labels: string | null;
  metadata: string | null;
  created_at: number;
  updated_at: number;
  user_id: string;
}

function rowToTask(row: LocalTaskRow): LocalTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    project_id: row.project_id,
    project_name: row.project_name,
    assignee: row.assignee,
    due_date: row.due_date,
    labels: row.labels ? JSON.parse(row.labels) : [],
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
  };
}

function generateId(): string {
  return `local_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Ensure the local_tasks table exists
 */
function ensureTable(): void {
  const db = getDatabase().getRawDb();
  db.exec(`
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
      labels TEXT,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      user_id TEXT DEFAULT 'default'
    )
  `);
}

/**
 * Create a new local task
 */
export function createLocalTask(params: {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: string;
  project_name?: string;
  assignee?: string;
  due_date?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
  user_id?: string;
}): LocalTask {
  ensureTable();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);
  const id = generateId();

  const stmt = db.prepare(`
    INSERT INTO local_tasks (
      id, title, description, status, priority,
      project_id, project_name, assignee, due_date,
      labels, metadata, created_at, updated_at, user_id
    ) VALUES (
      @id, @title, @description, @status, @priority,
      @project_id, @project_name, @assignee, @due_date,
      @labels, @metadata, @created_at, @updated_at, @user_id
    )
  `);

  stmt.run({
    id,
    title: params.title,
    description: params.description || null,
    status: params.status || 'pending',
    priority: params.priority || 'medium',
    project_id: params.project_id || null,
    project_name: params.project_name || null,
    assignee: params.assignee || null,
    due_date: params.due_date || null,
    labels: params.labels ? JSON.stringify(params.labels) : null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    created_at: now,
    updated_at: now,
    user_id: params.user_id || 'default',
  });

  return getLocalTask(id)!;
}

/**
 * Get a local task by ID
 */
export function getLocalTask(id: string): LocalTask | null {
  ensureTable();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM local_tasks WHERE id = ?').get(id) as LocalTaskRow | undefined;
  return row ? rowToTask(row) : null;
}

/**
 * Update a local task
 */
export function updateLocalTask(id: string, updates: {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: string | null;
  project_name?: string | null;
  assignee?: string | null;
  due_date?: string | null;
  labels?: string[];
  metadata?: Record<string, unknown>;
}): LocalTask | null {
  ensureTable();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  // Build dynamic update query
  const setClauses: string[] = ['updated_at = @updated_at'];
  const params: Record<string, unknown> = { id, updated_at: now };

  if (updates.title !== undefined) {
    setClauses.push('title = @title');
    params.title = updates.title;
  }
  if (updates.description !== undefined) {
    setClauses.push('description = @description');
    params.description = updates.description;
  }
  if (updates.status !== undefined) {
    setClauses.push('status = @status');
    params.status = updates.status;
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = @priority');
    params.priority = updates.priority;
  }
  if (updates.project_id !== undefined) {
    setClauses.push('project_id = @project_id');
    params.project_id = updates.project_id;
  }
  if (updates.project_name !== undefined) {
    setClauses.push('project_name = @project_name');
    params.project_name = updates.project_name;
  }
  if (updates.assignee !== undefined) {
    setClauses.push('assignee = @assignee');
    params.assignee = updates.assignee;
  }
  if (updates.due_date !== undefined) {
    setClauses.push('due_date = @due_date');
    params.due_date = updates.due_date;
  }
  if (updates.labels !== undefined) {
    setClauses.push('labels = @labels');
    params.labels = JSON.stringify(updates.labels);
  }
  if (updates.metadata !== undefined) {
    setClauses.push('metadata = @metadata');
    params.metadata = JSON.stringify(updates.metadata);
  }

  const sql = `UPDATE local_tasks SET ${setClauses.join(', ')} WHERE id = @id`;
  db.prepare(sql).run(params);

  return getLocalTask(id);
}

/**
 * Delete a local task
 */
export function deleteLocalTask(id: string): boolean {
  ensureTable();
  const db = getDatabase().getRawDb();
  const result = db.prepare('DELETE FROM local_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get all local tasks with optional filters
 */
export function getLocalTasks(options?: {
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
}): LocalTask[] {
  ensureTable();
  const db = getDatabase().getRawDb();

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options?.status) {
    conditions.push('status = @status');
    params.status = options.status;
  }
  if (options?.priority) {
    conditions.push('priority = @priority');
    params.priority = options.priority;
  }
  if (options?.project_id) {
    conditions.push('project_id = @project_id');
    params.project_id = options.project_id;
  }
  if (options?.user_id) {
    conditions.push('user_id = @user_id');
    params.user_id = options.user_id;
  }

  let sql = 'SELECT * FROM local_tasks';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY updated_at DESC';

  if (options?.limit) {
    sql += ' LIMIT @limit';
    params.limit = options.limit;
  }
  if (options?.offset) {
    sql += ' OFFSET @offset';
    params.offset = options.offset;
  }

  const rows = db.prepare(sql).all(params) as LocalTaskRow[];
  return rows.map(rowToTask);
}

/**
 * Get task counts by status
 */
export function getLocalTaskStats(user_id?: string): {
  total: number;
  pending: number;
  in_progress: number;
  done: number;
  failed: number;
  backlog: number;
} {
  ensureTable();
  const db = getDatabase().getRawDb();

  const whereClause = user_id ? 'WHERE user_id = ?' : '';
  const params = user_id ? [user_id] : [];

  const rows = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM local_tasks
    ${whereClause}
    GROUP BY status
  `).all(...params) as Array<{ status: string; count: number }>;

  const stats = {
    total: 0,
    pending: 0,
    in_progress: 0,
    done: 0,
    failed: 0,
    backlog: 0,
  };

  for (const row of rows) {
    const status = row.status as TaskStatus;
    stats[status] = row.count;
    stats.total += row.count;
  }

  return stats;
}

/**
 * Search local tasks by title or description
 */
export function searchLocalTasks(query: string, options?: {
  user_id?: string;
  limit?: number;
}): LocalTask[] {
  ensureTable();
  const db = getDatabase().getRawDb();

  const conditions = ['(title LIKE @query OR description LIKE @query)'];
  const params: Record<string, unknown> = { query: `%${query}%` };

  if (options?.user_id) {
    conditions.push('user_id = @user_id');
    params.user_id = options.user_id;
  }

  let sql = `SELECT * FROM local_tasks WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`;

  if (options?.limit) {
    sql += ' LIMIT @limit';
    params.limit = options.limit;
  }

  const rows = db.prepare(sql).all(params) as LocalTaskRow[];
  return rows.map(rowToTask);
}
