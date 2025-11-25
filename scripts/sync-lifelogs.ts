/**
 * Hourly Limitless lifelog sync + export + normalize events.
 *
 * Usage:
 *   npx tsx scripts/sync-lifelogs.ts
 *   npm run sync:lifelogs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getLimitlessClient } from '../lib/LimitlessClient';
import { spawnSync } from 'child_process';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'wrath-shield.db');
const OUT_PATH = path.join(DATA_DIR, 'lifelogs.jsonl');

function exportLifelogs(): number {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`DB not found at ${DB_PATH}`);
  }
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

  return rows.length;
}

async function main() {
  const limitless = getLimitlessClient();
  const fetched = await limitless.syncNewLifelogs();
  console.log(`[lifelogs] fetched ${fetched} new rows`);

  const exported = exportLifelogs();
  console.log(`[lifelogs] exported ${exported} rows -> ${OUT_PATH}`);

  const norm = spawnSync('npm', ['run', 'normalize:events'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (norm.status !== 0) {
    throw new Error('normalize:events failed');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
