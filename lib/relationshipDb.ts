import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

const dbPath = resolve(process.cwd(), '.data', 'relationships.db');

function ensureDir() {
  const dir = resolve(process.cwd(), '.data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function getRelationshipDb() {
  ensureDir();
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      handle TEXT NOT NULL,
      last_ts INTEGER,
      last_text TEXT,
      message_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      recv_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_last_ts ON contacts(last_ts DESC);
    CREATE TABLE IF NOT EXISTS relationship_summaries (
      contact_id TEXT PRIMARY KEY,
      summary TEXT,
      suggested_follow_up TEXT,
      last_updated INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(contact_id) REFERENCES contacts(id)
    );
  `);
  ensureColumn(db, 'contacts', 'canonical_handle', "ALTER TABLE contacts ADD COLUMN canonical_handle TEXT");
  ensureColumn(db, 'contacts', 'confidence', "ALTER TABLE contacts ADD COLUMN confidence REAL");
  ensureIndex(db, 'idx_contacts_canonical', 'CREATE INDEX idx_contacts_canonical ON contacts(canonical_handle)');
  return db;
}

export type ContactRow = {
  id: string;
  display_name: string | null;
  handle: string;
  canonical_handle?: string | null;
  confidence?: number | null;
  last_ts: number | null;
  last_text: string | null;
  message_count: number;
  sent_count: number;
  recv_count: number;
};

export function upsertContact(row: ContactRow) {
  const db = getRelationshipDb();
  const stmt = db.prepare(`
    INSERT INTO contacts (id, display_name, handle, canonical_handle, confidence, last_ts, last_text, message_count, sent_count, recv_count)
    VALUES (@id, @display_name, @handle, @canonical_handle, @confidence, @last_ts, @last_text, @message_count, @sent_count, @recv_count)
    ON CONFLICT(id) DO UPDATE SET
      display_name=excluded.display_name,
      handle=excluded.handle,
      canonical_handle=excluded.canonical_handle,
      confidence=excluded.confidence,
      last_ts=excluded.last_ts,
      last_text=excluded.last_text,
      message_count=excluded.message_count,
      sent_count=excluded.sent_count,
      recv_count=excluded.recv_count,
      updated_at=strftime('%s','now')
  `);
  stmt.run(row);
}

export function topContacts(limit = 50): ContactRow[] {
  const db = getRelationshipDb();
  const stmt = db.prepare<ContactRow>(`SELECT * FROM contacts ORDER BY last_ts DESC LIMIT ?`);
  return stmt.all(limit);
}

export function updateDisplayNameByHandle(handle: string, displayName: string) {
  if (!handle || !displayName) return;
  const db = getRelationshipDb();
  const stmt = db.prepare(`
    UPDATE contacts
    SET display_name = ?
    WHERE handle = ?
  `);
  stmt.run(displayName, handle);
}

export type RelationshipSummary = {
  contact_id: string;
  summary: string | null;
  suggested_follow_up: string | null;
  last_updated: number;
};

export function upsertRelationshipSummary(s: RelationshipSummary) {
  const db = getRelationshipDb();
  const stmt = db.prepare(`
    INSERT INTO relationship_summaries (contact_id, summary, suggested_follow_up, last_updated)
    VALUES (@contact_id, @summary, @suggested_follow_up, @last_updated)
    ON CONFLICT(contact_id) DO UPDATE SET
      summary=excluded.summary,
      suggested_follow_up=excluded.suggested_follow_up,
      last_updated=excluded.last_updated
  `);
  stmt.run(s);
}

export function listRelationshipSummaries(): RelationshipSummary[] {
  const db = getRelationshipDb();
  const stmt = db.prepare<RelationshipSummary>(`SELECT * FROM relationship_summaries ORDER BY last_updated DESC`);
  return stmt.all();
}

function ensureColumn(db: BetterSqlite3.Database, table: string, column: string, alterSql: string) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    const has = rows.some((r: any) => r.name === column);
    if (!has) db.exec(alterSql);
  } catch {
    /* ignore */
  }
}

function ensureIndex(db: BetterSqlite3.Database, indexName: string, createSql: string) {
  try {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get(indexName);
    if (!row) db.exec(createSql);
  } catch {
    /* ignore */
  }
}
