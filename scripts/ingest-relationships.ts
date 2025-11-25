/**
 * Ingest iMessage/SMS + Contacts into relationships.db
 *
 * Usage:
 *   npx tsx scripts/ingest-relationships.ts
 */
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';
import crypto from 'crypto';
import { upsertContact } from '../lib/relationshipDb';
import fs from 'fs';

const CHAT_DB = process.env.CHAT_DB || path.resolve(process.env.HOME || '~', 'Library', 'Messages', 'chat.db');

function openChatDb() {
  return new BetterSqlite3(CHAT_DB, { readonly: true, fileMustExist: true });
}

function appleDateToUnixSeconds(appleDate: number | null): number | null {
  if (!appleDate || appleDate <= 0) return null;
  // Apple stores in nanoseconds (since 2001-01-01)
  const sec = appleDate / 1_000_000_000 + 978307200;
  return Math.floor(sec);
}

function main() {
  const db = openChatDb();
  const rows = db
    .prepare(
      `
    SELECT
      m.ROWID as id,
      m.text,
      m.date,
      m.is_from_me,
      h.id as handle_id,
      h.uncanonicalized_id as handle_raw
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.ROWID
    WHERE m.date IS NOT NULL
    ORDER BY m.date DESC;
  `
    )
    .all();

  const byHandle: Record<
    string,
    {
      handle: string;
      last_ts: number;
      last_text: string;
      message_count: number;
      sent_count: number;
      recv_count: number;
    }
  > = {};

  for (const r of rows) {
    const handleRaw = (r.handle_id || r.handle_raw || 'unknown').toString();
    const canonical = canonicalHandle(handleRaw);
    const conf = canonical.confidence;
    const handle = canonical.value;
    const ts = appleDateToUnixSeconds(r.date);
    if (!ts) continue;
    if (!byHandle[handle]) {
      byHandle[handle] = {
        handle,
        canonical_handle: canonical.value,
        confidence: conf,
        last_ts: ts,
        last_text: r.text || '',
        message_count: 0,
        sent_count: 0,
        recv_count: 0,
      };
    }
    const agg = byHandle[handle];
    agg.message_count++;
    if (r.is_from_me === 1) agg.sent_count++;
    else agg.recv_count++;
    if (ts > agg.last_ts) {
      agg.last_ts = ts;
      agg.last_text = r.text || agg.last_text;
    }
  }

  // Apply only high-confidence canonical mappings; log lower-confidence suggestions
  const suggestionsPath = path.join(path.resolve(process.cwd(), '.data'), 'contact_merge_suggestions.jsonl');
  if (!fs.existsSync(path.dirname(suggestionsPath))) fs.mkdirSync(path.dirname(suggestionsPath), { recursive: true });

  const contactIds = Object.keys(byHandle);
  let applied = 0;
  let suggested = 0;
  for (const h of contactIds) {
    const c = byHandle[h];
    const conf = c.confidence ?? 0;
    if (conf >= 0.9) {
      upsertContact({
        id: crypto.createHash('sha1').update(h).digest('hex'),
        display_name: null,
        handle: c.handle,
        canonical_handle: c.canonical_handle,
        confidence: conf,
        last_ts: c.last_ts,
        last_text: c.last_text,
        message_count: c.message_count,
        sent_count: c.sent_count,
        recv_count: c.recv_count,
      });
      applied++;
    } else {
      fs.appendFileSync(
        suggestionsPath,
        JSON.stringify({ handle: c.handle, canonical: c.canonical_handle, confidence: conf }) + '\n',
        'utf8'
      );
      suggested++;
    }
  }

  console.log(`Ingested ${contactIds.length} contacts from Messages. Applied ${applied} high-confidence canonical mappings; logged ${suggested} suggestions to ${suggestionsPath}.`);
}

main();

// --- helpers ---
type Canonical = { value: string; confidence: number };
function canonicalHandle(raw: string): Canonical {
  if (!raw) return { value: 'unknown', confidence: 0 };
  const lower = raw.toLowerCase();
  // Email
  if (lower.includes('@')) {
    return { value: lower.trim(), confidence: 0.98 };
  }
  // Phone
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    // leading country code stripped -> slightly lower confidence
    const conf = digits.length === 10 ? 0.99 : 0.94;
    return { value: last10, confidence: conf };
  }
  return { value: raw.trim(), confidence: 0.6 };
}
