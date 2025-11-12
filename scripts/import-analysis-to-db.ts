/*
  Import collected lifelogs + analysis summary into app DB (.data/wrath-shield.db)
  - Reads ~/.analysis/lifelogs.jsonl and inserts into lifelogs/memories tables
  - Reads ~/.analysis/psych_profile.json and inserts into psych_signals
*/
import fs from 'fs';
import os from 'os';
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';

type Lifelog = { timestamp?: string; source: string; type?: string; text?: string; metadata?: any };

const projectRoot = process.cwd();
const dbPath = path.join(projectRoot, '.data', 'wrath-shield.db');
const lifelogPath = path.join(os.homedir(), '.analysis', 'lifelogs.jsonl');
const summaryPath = path.join(os.homedir(), '.analysis', 'psych_profile.json');

function isoDate(d?: string): string {
  const t = d ? new Date(d) : new Date();
  if (isNaN(t.getTime())) return new Date().toISOString().slice(0, 10);
  return t.toISOString().slice(0, 10);
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function main() {
  const db = new BetterSqlite3(dbPath);
  // Ensure psych_signals table exists (migration 006); harmless if already applied
  db.exec(`
    CREATE TABLE IF NOT EXISTS psych_signals (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'default',
      records INTEGER NOT NULL,
      words INTEGER NOT NULL,
      vocab INTEGER NOT NULL,
      ttr REAL NOT NULL,
      sentiment_score REAL NOT NULL,
      pos_terms INTEGER NOT NULL,
      neg_terms INTEGER NOT NULL,
      emotions_json TEXT,
      top_terms_json TEXT,
      sources_json TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  const insertLifelog = db.prepare(
    `INSERT OR IGNORE INTO lifelogs (id, date, title, raw_json, user_id)
     VALUES (@id, @date, @title, @raw_json, @user_id)`
  );
  const insertMemory = db.prepare(
    `INSERT OR IGNORE INTO memories (id, user_id, text, metadata, created_at)
     VALUES (@id, @user_id, @text, @metadata, @created_at)`
  );
  const insertSignal = db.prepare(
    `INSERT OR REPLACE INTO psych_signals
      (id, date, user_id, records, words, vocab, ttr, sentiment_score, pos_terms, neg_terms, emotions_json, top_terms_json, sources_json)
     VALUES
      (@id, @date, @user_id, @records, @words, @vocab, @ttr, @sentiment_score, @pos_terms, @neg_terms, @emotions_json, @top_terms_json, @sources_json)`
  );

  // Import lifelogs/memories
  if (fs.existsSync(lifelogPath)) {
    const lines = fs.readFileSync(lifelogPath, 'utf8').split(/\r?\n/);
    const tx = db.transaction((batch: string[]) => {
      for (const line of batch) {
        const t = line.trim();
        if (!t) continue;
        let r: Lifelog | null = null;
        try { r = JSON.parse(t); } catch { continue; }
        const user_id = 'default';
        const raw_json = JSON.stringify(r);
        if (r?.type === 'memory' || (r?.source || '').includes('sqlite:agentic_grok') || (r?.source || '').includes('sqlite:bulletproof_memory')) {
          const mid = (r.metadata && (r.metadata.id || r.metadata.memory_id)) || `mem-${hashId(raw_json)}`;
          const created_at = Math.floor(Date.now() / 1000);
          insertMemory.run({ id: String(mid), user_id, text: r.text || '', metadata: raw_json, created_at });
        } else {
          const date = isoDate(r?.timestamp);
          const title = (r?.text && r.text.substring(0, 160)) || (r?.type || r?.source || 'log');
          const id = `ll-${date}-${hashId(raw_json)}`;
          insertLifelog.run({ id, date, title, raw_json, user_id });
        }
      }
    });
    tx(lines);
    console.log('Imported lifelogs/memories from ~/.analysis/lifelogs.jsonl');
  } else {
    console.warn('No lifelogs found at ~/.analysis/lifelogs.jsonl');
  }

  // Import analysis summary
  if (fs.existsSync(summaryPath)) {
    const s = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const id = `analysis-${new Date(s.generatedAt || Date.now()).toISOString()}`;
    insertSignal.run({
      id,
      date: isoDate(s.generatedAt),
      user_id: 'default',
      records: s.total || 0,
      words: s.totalWords || 0,
      vocab: s.uniqueWords || 0,
      ttr: s.ttr || 0,
      sentiment_score: s.sentimentScore || 0,
      pos_terms: s.pos || 0,
      neg_terms: s.neg || 0,
      emotions_json: JSON.stringify(s.emoCounts || {}),
      top_terms_json: JSON.stringify(s.topTerms || []),
      sources_json: JSON.stringify(s.bySource || {}),
    });
    console.log('Imported analysis summary into psych_signals');
  } else {
    console.warn('No analysis summary found at ~/.analysis/psych_profile.json');
  }

  console.log('Done.');
}

main();

