/**
 * Export lifelogs from the local SQLite DB to .data/lifelogs.jsonl
 *
 * Usage:
 *   npx tsx scripts/export-lifelogs.ts
 *   npm run lifelogs:export
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'wrath-shield.db');
const OUT_PATH = path.join(DATA_DIR, 'lifelogs.jsonl');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function main() {
  ensureDataDir();

  const db = new Database(DB_PATH);
  const rows = db
    .prepare('SELECT id, date, title, raw_json FROM lifelogs ORDER BY date')
    .all() as { id: string; date: string; title: string | null; raw_json: string | null }[];

  const lines = rows.map((r) =>
    JSON.stringify({
      id: r.id,
      date: r.date,
      title: r.title,
      raw_json: r.raw_json,
    })
  );

  fs.writeFileSync(OUT_PATH, lines.join('\n') + (lines.length ? '\n' : ''));

  console.log(`Exported ${rows.length} lifelog rows → ${OUT_PATH}`);
}

main();
