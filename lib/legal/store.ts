import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.resolve(process.cwd(), '.data', 'legal', 'legal.db');

const schema = `
CREATE TABLE IF NOT EXISTS legal_context_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  case_number TEXT,
  contact TEXT,
  topic TEXT,
  source TEXT,
  summary TEXT,
  status TEXT DEFAULT 'pending', -- pending | resolved
  confidence REAL DEFAULT 0,
  due_date TEXT,
  action TEXT,
  rationale TEXT,
  attachments TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_legal_ctx_status ON legal_context_requests(status);
CREATE INDEX IF NOT EXISTS idx_legal_ctx_user ON legal_context_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_ctx_contact ON legal_context_requests(contact);

CREATE TABLE IF NOT EXISTS legal_pending_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  case_number TEXT,
  action_type TEXT NOT NULL, -- email_draft | file_motion | schedule_hearing | send_document | other
  title TEXT NOT NULL,
  description TEXT,
  payload TEXT, -- JSON payload with action details
  status TEXT DEFAULT 'pending', -- pending | approved | rejected | executed
  priority TEXT DEFAULT 'normal', -- low | normal | high | urgent
  requires_approval INTEGER DEFAULT 1,
  approved_at TEXT,
  approved_by TEXT,
  executed_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_legal_actions_status ON legal_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_legal_actions_user ON legal_pending_actions(user_id);

CREATE TABLE IF NOT EXISTS legal_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  case_number TEXT,
  notification_type TEXT NOT NULL, -- deadline | court_update | action_required | info
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT DEFAULT 'info', -- info | warning | urgent | critical
  read INTEGER DEFAULT 0,
  dismissed INTEGER DEFAULT 0,
  action_url TEXT,
  related_id TEXT, -- reference to context_request or pending_action
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_legal_notif_user ON legal_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_notif_read ON legal_notifications(read);

CREATE TABLE IF NOT EXISTS legal_chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  case_number TEXT,
  role TEXT NOT NULL, -- user | assistant | system
  content TEXT NOT NULL,
  metadata TEXT, -- JSON for tool calls, actions, etc.
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_legal_chat_user ON legal_chat_messages(user_id);
`;

function getDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  migrateColumns(db);
  return db;
}

function migrateColumns(db: BetterSqlite3.Database) {
  const cols = db.prepare("PRAGMA table_info('legal_context_requests')").all() as any[];
  const have = (name: string) => cols.some((c) => c.name === name);
  const alters: string[] = [];
  if (!have('action')) alters.push('ALTER TABLE legal_context_requests ADD COLUMN action TEXT;');
  if (!have('attachments')) alters.push('ALTER TABLE legal_context_requests ADD COLUMN attachments TEXT;');
  if (alters.length) {
    const tx = db.transaction(() => alters.forEach((sql) => db.exec(sql)));
    tx();
  }
}

// ============ Context Requests ============

export type LegalContextRequest = {
  id: string;
  user_id?: string;
  case_number?: string;
  contact?: string;
  topic?: string;
  source?: string;
  summary?: string;
  status: 'pending' | 'resolved';
  confidence?: number;
  due_date?: string;
  action?: string;
  rationale?: string;
  attachments?: string[];
  created_at?: string;
  updated_at?: string;
};

export function createLegalContextRequest(input: Partial<LegalContextRequest>): LegalContextRequest {
  const db = getDb();
  const id = input.id || uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO legal_context_requests (
       id, user_id, case_number, contact, topic, source, summary, status, confidence,
       due_date, action, rationale, attachments, created_at, updated_at
     ) VALUES (
       @id, @user_id, @case_number, @contact, @topic, @source, @summary, @status, @confidence,
       @due_date, @action, @rationale, @attachments, @created_at, @updated_at
     )`
  ).run({
    id,
    user_id: input.user_id || 'default',
    case_number: input.case_number || null,
    contact: input.contact || null,
    topic: input.topic || null,
    source: input.source || null,
    summary: input.summary || null,
    status: input.status || 'pending',
    confidence: input.confidence ?? 0,
    due_date: input.due_date || null,
    action: input.action || null,
    rationale: input.rationale || null,
    attachments: input.attachments ? JSON.stringify(input.attachments) : null,
    created_at: now,
    updated_at: now,
  });
  const out = db.prepare<LegalContextRequest>('SELECT * FROM legal_context_requests WHERE id = ?').get(id) as any;
  db.close();
  return mapRow(out);
}

export function createLegalContextRequestIfMissing(
  input: Partial<LegalContextRequest>
): { created: boolean; request: LegalContextRequest } {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT * FROM legal_context_requests
       WHERE (summary = @summary)
         AND (contact IS @contact OR contact = @contact)
         AND (due_date IS @due_date OR due_date = @due_date)
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get({ summary: input.summary || null, contact: input.contact || null, due_date: input.due_date || null }) as any;

  if (existing) {
    db.close();
    return { created: false, request: mapRow(existing) };
  }

  const created = createLegalContextRequest(input);
  return { created: true, request: created };
}

export function listLegalContextRequests(
  status: 'pending' | 'resolved' | 'all' = 'pending',
  user_id?: string
): LegalContextRequest[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const sql = `SELECT * FROM legal_context_requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows.map(mapRow);
}

export function updateLegalContextRequest(
  id: string,
  updates: Partial<LegalContextRequest>
): LegalContextRequest | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM legal_context_requests WHERE id = ?').get(id) as any;
  if (!existing) {
    db.close();
    return null;
  }
  const merged = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE legal_context_requests SET
       user_id=@user_id,
       case_number=@case_number,
       contact=@contact,
       topic=@topic,
       source=@source,
       summary=@summary,
       status=@status,
       confidence=@confidence,
       due_date=@due_date,
       action=@action,
       rationale=@rationale,
       attachments=@attachments,
       updated_at=@updated_at
     WHERE id=@id`
  ).run({
    ...merged,
    attachments: merged.attachments ? JSON.stringify(merged.attachments) : null,
  });
  const out = db.prepare('SELECT * FROM legal_context_requests WHERE id = ?').get(id) as any;
  db.close();
  return mapRow(out);
}

// ============ Pending Actions ============

export type LegalPendingAction = {
  id: string;
  user_id?: string;
  case_number?: string;
  action_type: 'email_draft' | 'file_motion' | 'schedule_hearing' | 'send_document' | 'other';
  title: string;
  description?: string;
  payload?: any;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requires_approval: boolean;
  approved_at?: string;
  approved_by?: string;
  executed_at?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
};

export function createPendingAction(input: Partial<LegalPendingAction>): LegalPendingAction {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO legal_pending_actions (
       id, user_id, case_number, action_type, title, description, payload, status,
       priority, requires_approval, created_at, updated_at
     ) VALUES (
       @id, @user_id, @case_number, @action_type, @title, @description, @payload, @status,
       @priority, @requires_approval, @created_at, @updated_at
     )`
  ).run({
    id,
    user_id: input.user_id || 'default',
    case_number: input.case_number || null,
    action_type: input.action_type || 'other',
    title: input.title || 'Unnamed action',
    description: input.description || null,
    payload: input.payload ? JSON.stringify(input.payload) : null,
    status: input.status || 'pending',
    priority: input.priority || 'normal',
    requires_approval: input.requires_approval !== false ? 1 : 0,
    created_at: now,
    updated_at: now,
  });
  const out = db.prepare('SELECT * FROM legal_pending_actions WHERE id = ?').get(id) as any;
  db.close();
  return mapActionRow(out);
}

export function listPendingActions(
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'all' = 'pending',
  user_id?: string
): LegalPendingAction[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const sql = `SELECT * FROM legal_pending_actions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY
    CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    created_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows.map(mapActionRow);
}

export function updatePendingAction(
  id: string,
  updates: Partial<LegalPendingAction>
): LegalPendingAction | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM legal_pending_actions WHERE id = ?').get(id) as any;
  if (!existing) {
    db.close();
    return null;
  }
  const now = new Date().toISOString();
  const merged = {
    ...existing,
    ...updates,
    payload: updates.payload ? JSON.stringify(updates.payload) : existing.payload,
    requires_approval: updates.requires_approval !== undefined
      ? (updates.requires_approval ? 1 : 0)
      : existing.requires_approval,
    updated_at: now,
  };
  if (updates.status === 'approved' && existing.status !== 'approved') {
    merged.approved_at = now;
    merged.approved_by = updates.approved_by || 'user';
  }
  if (updates.status === 'executed' && existing.status !== 'executed') {
    merged.executed_at = now;
  }
  db.prepare(
    `UPDATE legal_pending_actions SET
       user_id=@user_id, case_number=@case_number, action_type=@action_type,
       title=@title, description=@description, payload=@payload, status=@status,
       priority=@priority, requires_approval=@requires_approval, approved_at=@approved_at,
       approved_by=@approved_by, executed_at=@executed_at, error_message=@error_message,
       updated_at=@updated_at
     WHERE id=@id`
  ).run(merged);
  const out = db.prepare('SELECT * FROM legal_pending_actions WHERE id = ?').get(id) as any;
  db.close();
  return mapActionRow(out);
}

// ============ Notifications ============

export type LegalNotification = {
  id: string;
  user_id?: string;
  case_number?: string;
  notification_type: 'deadline' | 'court_update' | 'action_required' | 'info';
  title: string;
  message?: string;
  severity: 'info' | 'warning' | 'urgent' | 'critical';
  read: boolean;
  dismissed: boolean;
  action_url?: string;
  related_id?: string;
  created_at?: string;
};

export function createNotification(input: Partial<LegalNotification>): LegalNotification {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO legal_notifications (
       id, user_id, case_number, notification_type, title, message, severity,
       read, dismissed, action_url, related_id, created_at
     ) VALUES (
       @id, @user_id, @case_number, @notification_type, @title, @message, @severity,
       @read, @dismissed, @action_url, @related_id, @created_at
     )`
  ).run({
    id,
    user_id: input.user_id || 'default',
    case_number: input.case_number || null,
    notification_type: input.notification_type || 'info',
    title: input.title || 'Notification',
    message: input.message || null,
    severity: input.severity || 'info',
    read: 0,
    dismissed: 0,
    action_url: input.action_url || null,
    related_id: input.related_id || null,
    created_at: now,
  });
  const out = db.prepare('SELECT * FROM legal_notifications WHERE id = ?').get(id) as any;
  db.close();
  return mapNotificationRow(out);
}

export function listNotifications(
  user_id?: string,
  unreadOnly = false,
  limit = 50
): LegalNotification[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  where.push('dismissed = 0');
  if (unreadOnly) {
    where.push('read = 0');
  }
  const sql = `SELECT * FROM legal_notifications WHERE ${where.join(' AND ')}
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'urgent' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
      created_at DESC
    LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows.map(mapNotificationRow);
}

export function markNotificationRead(id: string): LegalNotification | null {
  const db = getDb();
  const result = db.prepare('UPDATE legal_notifications SET read = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    db.close();
    return null;
  }
  const out = db.prepare('SELECT * FROM legal_notifications WHERE id = ?').get(id) as any;
  db.close();
  return mapNotificationRow(out);
}

export function markAllNotificationsRead(user_id?: string): number {
  const db = getDb();
  let sql = 'UPDATE legal_notifications SET read = 1 WHERE read = 0';
  const params: any[] = [];
  if (user_id) {
    sql += " AND (user_id = ? OR user_id IS NULL OR user_id = 'default')";
    params.push(user_id);
  }
  const result = db.prepare(sql).run(...params);
  db.close();
  return result.changes;
}

export function deleteNotification(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM legal_notifications WHERE id = ?').run(id);
  db.close();
  return result.changes > 0;
}

export function dismissNotification(id: string): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE legal_notifications SET dismissed = 1 WHERE id = ?').run(id);
  db.close();
  return result.changes > 0;
}

export function getUnreadNotificationCount(user_id?: string): number {
  const db = getDb();
  const where = ['dismissed = 0', 'read = 0'];
  const params: any[] = [];
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const row = db.prepare(`SELECT COUNT(*) as count FROM legal_notifications WHERE ${where.join(' AND ')}`).get(...params) as any;
  db.close();
  return row?.count || 0;
}

// ============ Chat Messages ============

export type LegalChatMessage = {
  id: string;
  user_id?: string;
  case_number?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at?: string;
};

export function saveChatMessage(input: Partial<LegalChatMessage>): LegalChatMessage {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO legal_chat_messages (id, user_id, case_number, role, content, metadata, created_at)
     VALUES (@id, @user_id, @case_number, @role, @content, @metadata, @created_at)`
  ).run({
    id,
    user_id: input.user_id || 'default',
    case_number: input.case_number || null,
    role: input.role || 'user',
    content: input.content || '',
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: now,
  });
  const out = db.prepare('SELECT * FROM legal_chat_messages WHERE id = ?').get(id) as any;
  db.close();
  return mapChatRow(out);
}

export function listChatMessages(user_id?: string, limit = 100): LegalChatMessage[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const sql = `SELECT * FROM legal_chat_messages ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at ASC LIMIT ?`;
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows.map(mapChatRow);
}

export function clearChatMessages(user_id?: string): number {
  const db = getDb();
  let sql = 'DELETE FROM legal_chat_messages';
  const params: any[] = [];
  if (user_id) {
    sql += ' WHERE user_id = ?';
    params.push(user_id);
  }
  const result = db.prepare(sql).run(...params);
  db.close();
  return result.changes;
}

// ============ Row Mappers ============

function mapRow(row: any): LegalContextRequest {
  if (!row) return row;
  return {
    ...row,
    attachments: row.attachments ? safeParse(row.attachments) : undefined,
  };
}

function mapActionRow(row: any): LegalPendingAction {
  if (!row) return row;
  return {
    ...row,
    payload: row.payload ? safeParse(row.payload) : undefined,
    requires_approval: !!row.requires_approval,
  };
}

function mapNotificationRow(row: any): LegalNotification {
  if (!row) return row;
  return {
    ...row,
    read: !!row.read,
    dismissed: !!row.dismissed,
  };
}

function mapChatRow(row: any): LegalChatMessage {
  if (!row) return row;
  return {
    ...row,
    metadata: row.metadata ? safeParse(row.metadata) : undefined,
  };
}

function safeParse(val: string | null) {
  if (!val) return undefined;
  try {
    return JSON.parse(val);
  } catch {
    return undefined;
  }
}
