import BetterSqlite3 from 'better-sqlite3';
import { resolve } from 'path';

const dbPath = resolve(process.cwd(), '.data', 'events.db');

const schema = `
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  source TEXT,
  channel TEXT,
  direction TEXT,
  contact TEXT,
  ts INTEGER,
  subject TEXT,
  preview TEXT,
  metadata TEXT,
  routed_target TEXT,
  junk INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_contact ON events(contact);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_routed ON events(routed_target);
CREATE INDEX IF NOT EXISTS idx_events_junk ON events(junk);
`;

function getDb() {
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  migrate(db);
  return db;
}

function migrate(db: BetterSqlite3.Database) {
  const cols = db.prepare("PRAGMA table_info('events')").all() as any[];
  const have = (name: string) => cols.some((c) => c.name === name);
  const alters: string[] = [];
  if (!have('routed_target')) alters.push("ALTER TABLE events ADD COLUMN routed_target TEXT;");
  if (!have('junk')) alters.push("ALTER TABLE events ADD COLUMN junk INTEGER DEFAULT 0;");
  // Classification columns for confidence scoring and review flagging
  if (!have('confidence')) alters.push("ALTER TABLE events ADD COLUMN confidence REAL;");
  if (!have('classification')) alters.push("ALTER TABLE events ADD COLUMN classification TEXT;");
  if (!have('needs_review')) alters.push("ALTER TABLE events ADD COLUMN needs_review INTEGER DEFAULT 0;");
  if (alters.length) {
    const tx = db.transaction(() => alters.forEach((sql) => db.exec(sql)));
    tx();
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_routed ON events(routed_target);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_junk ON events(junk);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_needs_review ON events(needs_review);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_confidence ON events(confidence);");
  }
}

export type EventRow = {
  id: string;
  user_id?: string;
  source: string;
  channel: string;
  direction?: string | null;
  contact?: string | null;
  ts: number;
  subject?: string | null;
  preview?: string | null;
  metadata?: any;
  routed_target?: string | null;
  junk?: number;
  // Classification fields
  confidence?: number | null;
  classification?: string | null;
  needs_review?: number;
};

export function upsertEvents(rows: EventRow[], user_id?: string) {
  if (!rows.length) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO events (id, user_id, source, channel, direction, contact, ts, subject, preview, metadata)
    VALUES (@id, @user_id, @source, @channel, @direction, @contact, @ts, @subject, @preview, @metadata)
    ON CONFLICT(id) DO UPDATE SET
      user_id=excluded.user_id,
      source=excluded.source,
      channel=excluded.channel,
      direction=excluded.direction,
      contact=excluded.contact,
      ts=excluded.ts,
      subject=excluded.subject,
      preview=excluded.preview,
      metadata=excluded.metadata
  `);
  const tx = db.transaction((all: EventRow[]) => {
    for (const r of all) {
      stmt.run({
        ...r,
        user_id: r.user_id ?? user_id ?? 'default',
        direction: r.direction ?? null,
        contact: r.contact ?? null,
        subject: r.subject ?? null,
        preview: r.preview ?? null,
        metadata: r.metadata ? JSON.stringify(r.metadata) : null,
      });
    }
  });
  tx(rows);
  db.close();
}

export function listRecentEvents(limit = 200, user_id?: string): EventRow[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];
  if (user_id) {
    // allow per-user plus shared/default rows
    where.push('(user_id = ? OR user_id IS NULL OR user_id = \'default\')');
    params.push(user_id);
  }
  params.push(limit);
  const sql = `SELECT * FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ts DESC LIMIT ?`;
  const rows = db.prepare<EventRow>(sql).all(...params) as any[];
  db.close();
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? safeParse(r.metadata) : null,
    routed_target: (r as any).routed_target || null,
    junk: (r as any).junk ?? 0,
    confidence: (r as any).confidence ?? null,
    classification: (r as any).classification ?? null,
    needs_review: (r as any).needs_review ?? 0,
  }));
}

export function listEventsNeedingReview(limit = 50, user_id?: string): EventRow[] {
  const db = getDb();
  const where: string[] = ['needs_review = 1'];
  const params: any[] = [];
  if (user_id) {
    where.push('(user_id = ? OR user_id IS NULL OR user_id = \'default\')');
    params.push(user_id);
  }
  params.push(limit);
  const sql = `SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY ts DESC LIMIT ?`;
  const rows = db.prepare<EventRow>(sql).all(...params) as any[];
  db.close();
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? safeParse(r.metadata) : null,
    routed_target: (r as any).routed_target || null,
    junk: (r as any).junk ?? 0,
    confidence: (r as any).confidence ?? null,
    classification: (r as any).classification ?? null,
    needs_review: (r as any).needs_review ?? 0,
  }));
}

export function updateEventClassification(
  id: string,
  classification: string,
  confidence: number,
  user_id?: string
) {
  const db = getDb();
  const needs_review = confidence < 0.7 ? 1 : 0;
  const stmt = db.prepare(
    `UPDATE events SET classification = ?, confidence = ?, needs_review = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [classification, confidence, needs_review, id, user_id] : [classification, confidence, needs_review, id]);
  db.close();
}

export function markEventReviewed(id: string, user_id?: string) {
  const db = getDb();
  const stmt = db.prepare(
    `UPDATE events SET needs_review = 0 WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [id, user_id] : [id]);
  db.close();
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function routeEvent(id: string, target: string, user_id?: string) {
  const db = getDb();
  const stmt = db.prepare(
    `UPDATE events SET routed_target = ?, junk = 0 WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [target, id, user_id] : [target, id]);
  db.close();
}

export function markJunk(id: string, junk: boolean, user_id?: string) {
  const db = getDb();
  const stmt = db.prepare(
    `UPDATE events SET junk = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [junk ? 1 : 0, id, user_id] : [junk ? 1 : 0, id]);
  db.close();
}
