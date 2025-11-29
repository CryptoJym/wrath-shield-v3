// Lazy load better-sqlite3 so the app can run even if the native module
// is missing or compiled for a different Node version (e.g., in dev after
// switching Node runtimes). When unavailable, we return empty arrays instead
// of crashing the events API.
let BetterSqlite3: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BetterSqlite3 = require('better-sqlite3');
} catch (e) {
  console.warn('[events] better-sqlite3 not available, using fallback', e instanceof Error ? e.message : e);
}

import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dbPath = resolve(process.cwd(), '.data', 'events.db');

function ensureDir() {
  const dir = resolve(process.cwd(), '.data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

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
  if (!BetterSqlite3) return null;
  ensureDir();
  let db: any;
  try {
    db = new BetterSqlite3(dbPath);
  } catch (e) {
    console.warn('[events] failed to open better-sqlite3 database; falling back to noop', e instanceof Error ? e.message : e);
    return null;
  }
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  migrate(db);
  return db;
}

function migrate(db: any) {
  const cols = db.prepare("PRAGMA table_info('events')").all() as any[];
  const have = (name: string) => cols.some((c) => c.name === name);
  const alters: string[] = [];
  if (!have('routed_target')) alters.push("ALTER TABLE events ADD COLUMN routed_target TEXT;");
  if (!have('junk')) alters.push("ALTER TABLE events ADD COLUMN junk INTEGER DEFAULT 0;");
  // Classification columns for confidence scoring and review flagging
  if (!have('confidence')) alters.push("ALTER TABLE events ADD COLUMN confidence REAL;");
  if (!have('classification')) alters.push("ALTER TABLE events ADD COLUMN classification TEXT;");
  if (!have('needs_review')) alters.push("ALTER TABLE events ADD COLUMN needs_review INTEGER DEFAULT 0;");
  // Inbox action columns
  if (!have('dismissed_at')) alters.push("ALTER TABLE events ADD COLUMN dismissed_at INTEGER;");
  if (!have('rsvp_status')) alters.push("ALTER TABLE events ADD COLUMN rsvp_status TEXT;");
  if (!have('flagged')) alters.push("ALTER TABLE events ADD COLUMN flagged INTEGER DEFAULT 0;");
  if (!have('snoozed_until')) alters.push("ALTER TABLE events ADD COLUMN snoozed_until INTEGER;");
  if (alters.length) {
    const tx = db.transaction(() => alters.forEach((sql) => db.exec(sql)));
    tx();
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_routed ON events(routed_target);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_junk ON events(junk);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_needs_review ON events(needs_review);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_confidence ON events(confidence);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_dismissed ON events(dismissed_at);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_rsvp ON events(rsvp_status);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_flagged ON events(flagged);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_events_snoozed ON events(snoozed_until);");
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
  // Inbox action fields
  dismissed_at?: number | null;
  rsvp_status?: string | null;
  flagged?: number;
  snoozed_until?: number | null;
};

export function upsertEvents(rows: EventRow[], user_id?: string) {
  if (!rows.length) return;
  const db = getDb();
  if (!db) return;
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
  if (!db) return [];
  const where: string[] = [];
  const params: any[] = [];
  if (user_id) {
    // allow per-user plus shared/default rows
    where.push('(user_id = ? OR user_id IS NULL OR user_id = \'default\')');
    params.push(user_id);
  }
  params.push(limit);
  const sql = `SELECT * FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ts DESC LIMIT ?`;
  const stmt = db.prepare(sql);
  const rows = (user_id ? stmt.all(user_id, limit) : stmt.all(limit)) as any[];
  db.close();
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? safeParse(r.metadata) : null,
    routed_target: (r as any).routed_target || null,
    junk: (r as any).junk ?? 0,
    confidence: (r as any).confidence ?? null,
    classification: (r as any).classification ?? null,
    needs_review: (r as any).needs_review ?? 0,
    dismissed_at: (r as any).dismissed_at ?? null,
    rsvp_status: (r as any).rsvp_status ?? null,
    flagged: (r as any).flagged ?? 0,
    snoozed_until: (r as any).snoozed_until ?? null,
  }));
}

export function listEventsNeedingReview(limit = 50, user_id?: string): EventRow[] {
  const db = getDb();
  if (!db) return [];
  const sql = user_id
    ? `SELECT * FROM events WHERE needs_review = 1 AND (user_id = ? OR user_id IS NULL OR user_id = 'default') ORDER BY ts DESC LIMIT ?`
    : `SELECT * FROM events WHERE needs_review = 1 ORDER BY ts DESC LIMIT ?`;
  const stmt = db.prepare(sql);
  const rows = (user_id ? stmt.all(user_id, limit) : stmt.all(limit)) as any[];
  db.close();
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? safeParse(r.metadata) : null,
    routed_target: (r as any).routed_target || null,
    junk: (r as any).junk ?? 0,
    confidence: (r as any).confidence ?? null,
    classification: (r as any).classification ?? null,
    needs_review: (r as any).needs_review ?? 0,
    dismissed_at: (r as any).dismissed_at ?? null,
    rsvp_status: (r as any).rsvp_status ?? null,
    flagged: (r as any).flagged ?? 0,
    snoozed_until: (r as any).snoozed_until ?? null,
  }));
}

export function updateEventClassification(
  id: string,
  classification: string,
  confidence: number,
  user_id?: string
) {
  const db = getDb();
  if (!db) return;
  const needs_review = confidence < 0.7 ? 1 : 0;
  const stmt = db.prepare(
    `UPDATE events SET classification = ?, confidence = ?, needs_review = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [classification, confidence, needs_review, id, user_id] : [classification, confidence, needs_review, id]);
  db.close();
}

export function markEventReviewed(id: string, user_id?: string) {
  const db = getDb();
  if (!db) return;
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
  if (!db) return;
  const stmt = db.prepare(
    `UPDATE events SET routed_target = ?, junk = 0 WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [target, id, user_id] : [target, id]);
  db.close();
}

export function markJunk(id: string, junk: boolean, user_id?: string) {
  const db = getDb();
  if (!db) return;
  const stmt = db.prepare(
    `UPDATE events SET junk = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [junk ? 1 : 0, id, user_id] : [junk ? 1 : 0, id]);
  db.close();
}

export function dismissEvent(id: string, user_id?: string) {
  const db = getDb();
  if (!db) return;
  const dismissedAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `UPDATE events SET dismissed_at = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [dismissedAt, id, user_id] : [dismissedAt, id]);
  db.close();
}

export function updateEventRsvp(id: string, rsvpStatus: string, user_id?: string) {
  const db = getDb();
  if (!db) return;
  const dismissedAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `UPDATE events SET rsvp_status = ?, dismissed_at = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [rsvpStatus, dismissedAt, id, user_id] : [rsvpStatus, dismissedAt, id]);
  db.close();
}

export function flagEvent(id: string, flagged: boolean, user_id?: string) {
  const db = getDb();
  if (!db) return;
  const stmt = db.prepare(
    `UPDATE events SET flagged = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [flagged ? 1 : 0, id, user_id] : [flagged ? 1 : 0, id]);
  db.close();
}

export function snoozeEvent(id: string, snoozeUntil: number, user_id?: string) {
  const db = getDb();
  if (!db) return;
  const stmt = db.prepare(
    `UPDATE events SET snoozed_until = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  stmt.run(user_id ? [snoozeUntil, id, user_id] : [snoozeUntil, id]);
  db.close();
}

export function bulkRouteEvents(ids: string[], target: string, user_id?: string) {
  const db = getDb();
  if (!db) return;
  const stmt = db.prepare(
    `UPDATE events SET routed_target = ?, junk = 0 WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  const tx = db.transaction((eventIds: string[]) => {
    for (const id of eventIds) {
      stmt.run(user_id ? [target, id, user_id] : [target, id]);
    }
  });
  tx(ids);
  db.close();
}

export function bulkDismissEvents(ids: string[], user_id?: string) {
  const db = getDb();
  if (!db) return;
  const dismissedAt = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(
    `UPDATE events SET dismissed_at = ? WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  const tx = db.transaction((eventIds: string[]) => {
    for (const id of eventIds) {
      stmt.run(user_id ? [dismissedAt, id, user_id] : [dismissedAt, id]);
    }
  });
  tx(ids);
  db.close();
}

export async function bulkEnrichEvents(ids: string[], user_id?: string): Promise<any[]> {
  // This is a placeholder - in production, this would call the enrichment logic
  // For now, we'll just mark them as needing enrichment
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare(
    `UPDATE events SET needs_review = 1 WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ""}`
  );
  const tx = db.transaction((eventIds: string[]) => {
    for (const id of eventIds) {
      stmt.run(user_id ? [id, user_id] : [id]);
    }
  });
  tx(ids);
  db.close();
  return ids.map((id) => ({ id, enriched: true }));
}
