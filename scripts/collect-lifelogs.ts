/*
  Collect lifelogs from local sources into a normalized JSONL at .analysis/lifelogs.jsonl
  Sources (local only, no network):
  - ~/.claude/memory_logs/* (JSON lines or text)
  - ~/.claude/conversation_logs/* (JSON or text)
  - ~/.aavm-logs/*.log (text)
  - ~/.bulletproof_memory/memories.db (SQLite: memories table)
  - ./services/agentic-grok/mem_store.db (SQLite: best-effort memories table)
  - ./.data/wrath-shield.db (SQLite: best-effort tables)

  Output: .analysis/lifelogs.jsonl (one JSON object per line)
  Record shape: { timestamp: string, source: string, type?: string, text?: string, metadata?: any }
*/
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Lazy import better-sqlite3 to avoid failing if native bindings unavailable
let BetterSqlite3: any = null;
try { // eslint-disable-next-line @typescript-eslint/no-var-requires
  BetterSqlite3 = require('better-sqlite3');
} catch (_) {
  // optional; some environments may not have native bindings ready
}

type LogRecord = {
  timestamp?: string;
  source: string;
  type?: string;
  text?: string;
  metadata?: any;
};

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, '..', '.analysis');
const outPath = path.join(outDir, 'lifelogs.jsonl');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJsonl(records: LogRecord[]) {
  ensureDir(outDir);
  const stream = fs.createWriteStream(outPath, { flags: 'a' });
  for (const r of records) {
    try {
      stream.write(JSON.stringify(r) + '\n');
    } catch (e) {
      // skip malformed
    }
  }
  stream.end();
}

function normTs(v: any): string | undefined {
  if (!v) return undefined;
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (_) {}
  return undefined;
}

function safeRead(filePath: string): string[] {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    // split by lines conservatively; large files handled by streaming later if needed
    return data.split(/\r?\n/);
  } catch (_) {
    return [];
  }
}

function collectFromTextFiles(dir: string, source: string, opts?: { onlyJson?: boolean; excludeNames?: RegExp }) {
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => (opts?.excludeNames ? !opts.excludeNames.test(f) : true))
    .map((f) => path.join(dir, f))
    .filter((p) => fs.statSync(p).isFile());
  const batch: LogRecord[] = [];
  for (const file of files) {
    const lines = safeRead(file);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // JSON line or free text
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const obj = JSON.parse(trimmed);
          const ts = normTs(obj.timestamp || obj.time || obj.created_at || obj.date);
          let text = obj.text || obj.message || obj.msg || obj.content || obj.note || obj.title || obj.path || obj.event || obj.summary;
          if (!text && Array.isArray(obj.messages)) {
            try {
              text = obj.messages.map((m: any) => `${m.role}: ${m.content}`).join(' \n ');
            } catch { /* noop */ }
          }
          batch.push({ timestamp: ts, source, type: obj.type || 'json', text, metadata: obj });
          continue;
        } catch (_) {
          // fallthrough to text
        }
      }
      if (!opts?.onlyJson) {
        batch.push({ source, type: 'text', text: trimmed });
      }
    }
  }
  writeJsonl(batch);
}

function collectFromSqlite(dbPath: string, source: string) {
  if (!fs.existsSync(dbPath)) return;
  if (!BetterSqlite3) {
    console.warn(`[collect] better-sqlite3 not available; skipping ${dbPath}`);
    return;
  }
  try {
    const db = new BetterSqlite3(dbPath, { readonly: true });
    // discover tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name as string);
    const batch: LogRecord[] = [];

    // Common memories schema
    if (tables.includes('memories')) {
      try {
        const rows = db.prepare('SELECT id, user_id, text, metadata, created_at FROM memories ORDER BY created_at DESC LIMIT 50000').all();
        for (const r of rows) {
          let meta: any = undefined;
          try { meta = r.metadata ? JSON.parse(r.metadata) : undefined; } catch { meta = r.metadata; }
          batch.push({ timestamp: normTs(r.created_at), source, type: 'memory', text: r.text, metadata: { id: r.id, user_id: r.user_id, ...meta } });
        }
      } catch (_) { /* table exists but shape differs */ }
    }

    // App lifelogs table (title + raw_json)
    if (tables.includes('lifelogs')) {
      try {
        const rows = db.prepare('SELECT id, user_id, date, title, raw_json FROM lifelogs ORDER BY date DESC LIMIT 50000').all();
        for (const r of rows) {
          let meta: any = undefined;
          try { meta = r.raw_json ? JSON.parse(r.raw_json) : undefined; } catch { meta = r.raw_json; }
          const text = r.title || (meta && (meta.note || meta.text || meta.summary || meta.markdown));
          batch.push({ timestamp: normTs(r.date), source: `${source}:lifelogs`, type: 'lifelog', text, metadata: { id: r.id, user_id: r.user_id, ...meta } });
        }
      } catch (_) { /* ignore */ }
    }

    // Generic notes table heuristics
    for (const t of tables) {
      if (t === 'memories') continue;
      if (t === 'lifelogs') continue;
      const cols = db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>;
      const names = cols.map(c => c.name.toLowerCase());
      const hasText = names.includes('text') || names.includes('content') || names.includes('message') || names.includes('note');
      if (!hasText) continue;
      const tsCol = names.find(n => ['created_at','timestamp','time','date'].includes(n));
      const textCol = names.find(n => ['text','content','message','note'].includes(n))!;
      try {
        const rows = db.prepare(`SELECT ${tsCol ?? 'NULL'} as ts, ${textCol} as tx, * FROM ${t} LIMIT 10000`).all();
        for (const r of rows) {
          batch.push({ timestamp: normTs((r as any).ts), source: `${source}:${t}`, type: 'db', text: (r as any).tx, metadata: r });
        }
      } catch (_e) { /* ignore errors per table */ }
    }

    writeJsonl(batch);
  } catch (e) {
    console.warn(`[collect] failed to read sqlite ${dbPath}:`, (e as Error).message);
  }
}

function gitIgnoreOut() {
  try {
    execSync('git add -N .analysis 2>/dev/null || true');
  } catch {}
}

function main() {
  console.log('==> Collecting lifelogs (local only)');
  ensureDir(outDir);
  // fresh output: rotate previous if exists
  if (fs.existsSync(outPath)) {
    const bak = outPath.replace(/\.jsonl$/, `.${Date.now()}.bak.jsonl`);
    fs.renameSync(outPath, bak);
  }

  const home = os.homedir();
  // Text-like sources (JSON-only for cleanliness); exclude sensitive cookie files
  collectFromTextFiles(path.join(home, '.claude', 'memory_logs'), 'claude:memory_logs', { onlyJson: true });
  collectFromTextFiles(path.join(home, '.claude', 'conversation_logs'), 'claude:conversation_logs', { onlyJson: true });
  collectFromTextFiles(path.join(home, '.aavm-logs'), 'aavm:logs', { onlyJson: true, excludeNames: /cookie/i });

  collectFromSqlite(path.join(home, '.bulletproof_memory', 'memories.db'), 'sqlite:bulletproof_memory');
  collectFromSqlite(path.join(projectRoot, '.data', 'wrath-shield.db'), 'sqlite:wrath_shield_app');
  collectFromSqlite(path.join(projectRoot, 'services', 'agentic-grok', 'mem_store.db'), 'sqlite:agentic_grok');

  gitIgnoreOut();
  console.log(`==> Done. Output: ${outPath}`);
}

main();
