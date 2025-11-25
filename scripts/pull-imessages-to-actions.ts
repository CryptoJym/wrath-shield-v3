/**
 * Pull latest iMessages/SMS from chat.db and log inbound texts as agentic_actions
 * (type: note, target: imessage).
 *
 * Stores cursor at .data/imessage_cursor.json (last rowid processed).
 *
 * Usage: npx tsx scripts/pull-imessages-to-actions.ts
 */
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { insertAgenticActions } from '../lib/db/queries';

const CHAT_DB = process.env.CHAT_DB || path.resolve(process.env.HOME || '~', 'Library', 'Messages', 'chat.db');
const CURSOR_PATH = path.resolve(process.cwd(), '.data', 'imessage_cursor.json');

function loadCursor(): number {
  if (!fs.existsSync(CURSOR_PATH)) return 0;
  try {
    const j = JSON.parse(fs.readFileSync(CURSOR_PATH, 'utf8'));
    return Number(j.lastRowId) || 0;
  } catch {
    return 0;
  }
}

function saveCursor(id: number) {
  const dir = path.dirname(CURSOR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CURSOR_PATH, JSON.stringify({ lastRowId: id }), 'utf8');
}

function main() {
  const last = loadCursor();
  const db = new BetterSqlite3(CHAT_DB, { readonly: true, fileMustExist: true });
  const rows = db
    .prepare(
      `
      SELECT m.ROWID as id, m.text, m.date, m.is_from_me, h.id as handle_id, h.uncanonicalized_id as handle_raw
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.ROWID > ?
      ORDER BY m.ROWID ASC
      LIMIT 500;
    `
    )
    .all(last);

  if (!rows.length) {
    console.log('No new messages.');
    return;
  }

  const actions = [];
  let maxRowId = last;
  for (const r of rows) {
    maxRowId = Math.max(maxRowId, r.id);
    if (r.is_from_me === 1) continue; // inbound only
    const handle = (r.handle_id || r.handle_raw || 'unknown').toString();
    const text = r.text || '';
    const ts = appleDateToIso(r.date);
    const id = crypto.createHash('sha1').update(String(r.id)).digest('hex');
    actions.push({
      id,
      user_id: 'default',
      type: 'note',
      target: 'imessage',
      title: `Inbound from ${handle}`,
      content: `${text}\n\n[${ts}]`,
      confidence: 1.0,
      status: 'proposed',
      source: 'imessage-ingest',
      metadata: JSON.stringify({ handle, ts }),
    });
  }

  if (actions.length) {
    insertAgenticActions(actions as any);
    console.log(`Logged ${actions.length} inbound messages as actions.`);
  }
  saveCursor(maxRowId);
}

function appleDateToIso(appleDate: number | null): string {
  if (!appleDate) return '';
  const sec = appleDate / 1_000_000_000 + 978307200;
  return new Date(sec * 1000).toISOString();
}

main();
