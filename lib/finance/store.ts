import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const dbPath = path.resolve(process.cwd(), '.data', 'finance', 'finance.db');

const schema = `
CREATE TABLE IF NOT EXISTS finance_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  account TEXT,
  amount REAL,
  iso_currency_code TEXT,
  date TEXT,
  vendor TEXT,
  raw_desc TEXT,
  bucket TEXT,
  project TEXT,
  recurring INTEGER DEFAULT 0,
  reimbursable INTEGER DEFAULT 0,
  source TEXT,
  meta TEXT,
  status TEXT DEFAULT 'pending_review', -- pending_review | classified | confirmed
  confidence REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_transactions(date);
CREATE INDEX IF NOT EXISTS idx_finance_bucket ON finance_transactions(bucket);
CREATE INDEX IF NOT EXISTS idx_finance_vendor ON finance_transactions(vendor);
CREATE INDEX IF NOT EXISTS idx_finance_status ON finance_transactions(status);

CREATE TABLE IF NOT EXISTS finance_context_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  txn_id TEXT,
  vendor TEXT,
  date TEXT,
  amount REAL,
  status TEXT DEFAULT 'pending', -- pending | resolved
  summary TEXT,
  confidence REAL DEFAULT 0,
  bucket TEXT,
  project TEXT,
  reimbursable INTEGER,
  note TEXT,
  rationale TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ctx_status ON finance_context_requests(status);
CREATE INDEX IF NOT EXISTS idx_ctx_txn ON finance_context_requests(txn_id);
`;

function getDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  migrateContextTable(db);
  migrateUserColumns(db);
  return db;
}

function migrateContextTable(db: BetterSqlite3.Database) {
  const cols = db.prepare("PRAGMA table_info('finance_context_requests')").all() as any[];
  const have = (name: string) => cols.some((c) => c.name === name);
  const alters: string[] = [];
  if (!have('bucket')) alters.push("ALTER TABLE finance_context_requests ADD COLUMN bucket TEXT;");
  if (!have('project')) alters.push("ALTER TABLE finance_context_requests ADD COLUMN project TEXT;");
  if (!have('reimbursable')) alters.push("ALTER TABLE finance_context_requests ADD COLUMN reimbursable INTEGER;");
  if (!have('note')) alters.push("ALTER TABLE finance_context_requests ADD COLUMN note TEXT;");
  if (!have('rationale')) alters.push("ALTER TABLE finance_context_requests ADD COLUMN rationale TEXT;");
  if (alters.length) {
    const tx = db.transaction(() => {
      alters.forEach((sql) => db.exec(sql));
    });
    tx();
  }
}

function migrateUserColumns(db: BetterSqlite3.Database) {
  const check = (table: string, col: string) =>
    (db.prepare(`PRAGMA table_info('${table}')`).all() as any[]).some((c) => c.name === col);
  const alters: string[] = [];
  if (!check('finance_transactions', 'user_id'))
    alters.push("ALTER TABLE finance_transactions ADD COLUMN user_id TEXT;");
  if (!check('finance_context_requests', 'user_id'))
    alters.push("ALTER TABLE finance_context_requests ADD COLUMN user_id TEXT;");
  if (alters.length) {
    const tx = db.transaction(() => alters.forEach((sql) => db.exec(sql)));
    tx();
  }
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_finance_user ON finance_transactions(user_id);
     CREATE INDEX IF NOT EXISTS idx_ctx_user ON finance_context_requests(user_id);`
  );
}

export type TxnRow = {
  id: string;
  user_id?: string;
  account: string;
  amount: number;
  iso_currency_code?: string;
  date: string; // YYYY-MM-DD
  vendor?: string;
  raw_desc?: string;
  bucket?: string;
  project?: string;
  recurring?: boolean;
  reimbursable?: boolean;
  source?: string;
  meta?: any;
  status?: 'pending_review' | 'classified' | 'confirmed';
  confidence?: number;
};

type TxnUpdate = {
  bucket?: string;
  project?: string;
  reimbursable?: boolean;
  status?: 'pending_review' | 'classified' | 'confirmed';
  note?: string;
  rationale?: string;
};

export type AuditRow = {
  id?: number;
  txn_id: string;
  user_id?: string;
  ts?: string;
  source?: string;
  prev_bucket?: string | null;
  new_bucket?: string | null;
  prev_project?: string | null;
  new_project?: string | null;
  prev_reimbursable?: number | null;
  new_reimbursable?: number | null;
  note?: string | null;
};

export function auditTxn(id: string, user_id: string | undefined, source: string, prev: any, next: any) {
  const db = getDb();
  db.prepare(
    `INSERT INTO finance_audit (txn_id, user_id, source, prev_bucket, new_bucket, prev_project, new_project, prev_reimbursable, new_reimbursable, note)
     VALUES (@txn_id, @user_id, @source, @prev_bucket, @new_bucket, @prev_project, @new_project, @prev_reimbursable, @new_reimbursable, @note)`
  ).run({
    txn_id: id,
    user_id: user_id || 'default',
    source,
    prev_bucket: prev.bucket ?? null,
    new_bucket: next.bucket ?? null,
    prev_project: prev.project ?? null,
    new_project: next.project ?? null,
    prev_reimbursable: prev.reimbursable === undefined ? null : prev.reimbursable ? 1 : 0,
    new_reimbursable: next.reimbursable === undefined ? null : next.reimbursable ? 1 : 0,
    note: next.note || null,
  });
  db.close();
}

export function listAudit(txn_id: string, user_id?: string): AuditRow[] {
  const db = getDb();
  const where: string[] = ['txn_id = ?'];
  const params: any[] = [txn_id];
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const rows = db
    .prepare(`SELECT * FROM finance_audit WHERE ${where.join(' AND ')} ORDER BY ts DESC, id DESC`)
    .all(...params) as any[];
  db.close();
  return rows;
}

export async function upsertTransactionsFromRows(rows: TxnRow[], user_id?: string) {
  if (!rows.length) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO finance_transactions
      (id, user_id, account, amount, iso_currency_code, date, vendor, raw_desc, bucket, project, recurring, reimbursable, source, meta, status, confidence)
    VALUES
      (@id, @user_id, @account, @amount, @iso_currency_code, @date, @vendor, @raw_desc, @bucket, @project, @recurring, @reimbursable, @source, @meta, @status, @confidence)
    ON CONFLICT(id) DO UPDATE SET
      user_id=excluded.user_id,
      account=excluded.account,
      amount=excluded.amount,
      iso_currency_code=excluded.iso_currency_code,
      date=excluded.date,
      vendor=excluded.vendor,
      raw_desc=excluded.raw_desc,
      bucket=excluded.bucket,
      project=excluded.project,
      recurring=excluded.recurring,
      reimbursable=excluded.reimbursable,
      source=excluded.source,
      meta=excluded.meta,
      status=excluded.status,
      confidence=excluded.confidence;
  `);
  const tx = db.transaction((all: TxnRow[]) => {
    for (const r of all) {
      stmt.run({
        ...r,
        user_id: r.user_id ?? user_id ?? 'default',
        meta: r.meta ? JSON.stringify(r.meta) : null,
        iso_currency_code: r.iso_currency_code ?? null,
        bucket: r.bucket ?? null,
        project: r.project ?? null,
        vendor: r.vendor ?? null,
        raw_desc: r.raw_desc ?? null,
        source: r.source ?? null,
        recurring: r.recurring ? 1 : 0,
        reimbursable: r.reimbursable ? 1 : 0,
        status: r.status ?? 'pending_review',
        confidence: r.confidence ?? 0,
      });
    }
  });
  tx(rows);
  db.close();
}

export function listByDateRange(start: string, end: string, user_id?: string): TxnRow[] {
  const db = getDb();
  const where: string[] = ['date >= ?', 'date < ?'];
  const params: any[] = [start, end];
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const sql = `SELECT * FROM finance_transactions WHERE ${where.join(' AND ')} ORDER BY date DESC`;
  const rows = db.prepare<TxnRow>(sql).all(...params) as any[];
  db.close();
  return rows.map((r) => ({
    ...r,
    meta: r.meta ? safeParse(r.meta) : undefined,
    recurring: !!r.recurring,
    reimbursable: !!r.reimbursable,
    status: (r as any).status || 'pending_review',
    confidence: (r as any).confidence ?? 0,
  }));
}

export function listDistinctValues(column: 'bucket' | 'project', user_id?: string): string[] {
  const db = getDb();
  const where: string[] = [`${column} IS NOT NULL`, `${column} != ''`];
  const params: any[] = [];
  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }
  const sql = `SELECT DISTINCT ${column} as val FROM finance_transactions WHERE ${where.join(' AND ')} ORDER BY val COLLATE NOCASE`;
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows.map((r) => r.val).filter(Boolean);
}

type BulkFields = {
  bucket?: string | null;
  project?: string | null;
  reimbursable?: boolean | null;
  status?: 'pending_review' | 'classified' | 'confirmed';
};

export function bulkUpdateVendor(
  vendor: string,
  start: string,
  end: string,
  fields: BulkFields,
  user_id?: string
) {
  const db = getDb();
  const params: any[] = [];
  const setParts: string[] = [];
  if (fields.bucket !== undefined) setParts.push('bucket = ?'), params.push(fields.bucket);
  if (fields.project !== undefined) setParts.push('project = ?'), params.push(fields.project);
  if (fields.reimbursable !== undefined)
    setParts.push('reimbursable = ?'), params.push(fields.reimbursable === null ? null : fields.reimbursable ? 1 : 0);
  if (fields.status !== undefined) setParts.push('status = ?'), params.push(fields.status);
  if (!setParts.length) {
    db.close();
    return 0;
  }
  params.push(start, end, vendor);
  let sql = `UPDATE finance_transactions SET ${setParts.join(', ')} WHERE date >= ? AND date < ? AND vendor = ?`;
  if (user_id) {
    sql += " AND (user_id = ? OR user_id IS NULL OR user_id = 'default')";
    params.push(user_id);
  }
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  db.close();
  return info.changes ?? 0;
}

export function getTransaction(id: string): TxnRow | null {
  const db = getDb();
  const row = db.prepare<TxnRow>('SELECT * FROM finance_transactions WHERE id = ?').get(id) as any;
  db.close();
  if (!row) return null;
  return {
    ...row,
    meta: row.meta ? safeParse(row.meta) : undefined,
    recurring: !!row.recurring,
    reimbursable: !!row.reimbursable,
    status: (row as any).status || 'pending_review',
    confidence: (row as any).confidence ?? 0,
  };
}

export function updateTransaction(id: string, fields: TxnUpdate, user_id?: string, source = 'user') {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT * FROM finance_transactions WHERE id = ? ${user_id ? "AND (user_id = ? OR user_id IS NULL OR user_id = 'default')" : ''}`
    )
    .get(user_id ? [id, user_id] : [id]) as any;
  if (!existing) {
    db.close();
    return;
  }
  const metaObj = existing.meta ? safeParse(existing.meta) : {};
  if (fields.note !== undefined) metaObj.note = fields.note;
  if (fields.rationale !== undefined) metaObj.rationale = fields.rationale;

  // enforce buckets: collapse work_nonreimbursable -> work_reimbursable; allowed set
  const allowedBuckets = new Set(['work_reimbursable','personal_ai','family','entertainment','other','unknown',null]);
  const nextBucket = fields.bucket === 'work_nonreimbursable' ? 'work_reimbursable' : fields.bucket;
  const bucketFinal = allowedBuckets.has(nextBucket ?? null) ? nextBucket : 'other';
  const reimbFinal = bucketFinal === 'work_reimbursable' ? true : fields.reimbursable;

  const nextState = {
    bucket: bucketFinal,
    project: fields.project ?? null,
    reimbursable: reimbFinal === undefined ? null : reimbFinal,
  };

  const prevState = {
    bucket: existing.bucket,
    project: existing.project,
    reimbursable: existing.reimbursable,
  };

  db.prepare(
    `UPDATE finance_transactions
     SET bucket = COALESCE(@bucket, bucket),
         project = COALESCE(@project, project),
         reimbursable = CASE WHEN @reimbursable IS NULL THEN reimbursable ELSE @reimbursable END,
         status = COALESCE(@status, status),
         meta = @meta
     WHERE id = @id ${user_id ? "AND (user_id = @user_id OR user_id IS NULL OR user_id = 'default')" : ''}`
  ).run({
    id,
    user_id,
    bucket: bucketFinal ?? null,
    project: fields.project ?? null,
    reimbursable: reimbFinal === undefined ? null : reimbFinal ? 1 : 0,
    status: fields.status ?? null,
    meta: Object.keys(metaObj).length ? JSON.stringify(metaObj) : null,
  });
  auditTxn(id, user_id, source, prevState, nextState);
  db.close();
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// Context request types
export type ContextRequest = {
  id: string;
  user_id?: string;
  txn_id: string;
  vendor?: string;
  date?: string;
  amount?: number;
  status: 'pending' | 'resolved';
  summary?: string;
  confidence?: number;
  bucket?: string;
  project?: string;
  reimbursable?: boolean;
  note?: string;
  rationale?: string;
  created_at?: string;
  updated_at?: string;
};

export function createContextRequest(input: Partial<ContextRequest>): ContextRequest {
  const db = getDb();
  if (input.txn_id) {
    const existing = db
      .prepare<ContextRequest>(
        "SELECT * FROM finance_context_requests WHERE txn_id = ? AND status = 'pending' LIMIT 1"
      )
      .get(input.txn_id) as any;
    if (existing) {
      db.close();
      return existing;
    }
  }
  const id = input.id || uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO finance_context_requests (id, user_id, txn_id, vendor, date, amount, status, summary, confidence, bucket, project, reimbursable, note, rationale, created_at, updated_at)
     VALUES (@id, @user_id, @txn_id, @vendor, @date, @amount, @status, @summary, @confidence, @bucket, @project, @reimbursable, @note, @rationale, @created_at, @updated_at)`
  ).run({
    id,
    user_id: input.user_id || 'default',
    txn_id: input.txn_id || '',
    vendor: input.vendor || null,
    date: input.date || null,
    amount: input.amount ?? null,
    status: input.status || 'pending',
    summary: input.summary || null,
    confidence: input.confidence ?? 0,
    bucket: input.bucket || null,
    project: input.project || null,
    reimbursable: input.reimbursable === undefined ? null : input.reimbursable ? 1 : 0,
    note: input.note || null,
    rationale: input.rationale || null,
    created_at: now,
    updated_at: now,
  });
  const out = db.prepare<ContextRequest>('SELECT * FROM finance_context_requests WHERE id = ?').get(id) as any;
  db.close();
  return out;
}

export function listContextRequests(
  status: 'pending' | 'resolved' | 'all' = 'pending',
  user_id?: string
): ContextRequest[] {
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
  const sql = `SELECT * FROM finance_context_requests ${
    where.length ? 'WHERE ' + where.join(' AND ') : ''
  } ORDER BY created_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();
  return rows;
}

export function updateContextRequest(id: string, updates: Partial<ContextRequest>): ContextRequest | null {
  const db = getDb();
  const existing = db.prepare<ContextRequest>('SELECT * FROM finance_context_requests WHERE id = ?').get(id) as any;
  if (!existing) {
    db.close();
    return null;
  }
  const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
  db.prepare(
    `UPDATE finance_context_requests SET
      user_id=@user_id,
      status=@status,
      summary=@summary,
      confidence=@confidence,
      vendor=@vendor,
      date=@date,
      amount=@amount,
      bucket=@bucket,
      project=@project,
      reimbursable=@reimbursable,
      note=@note,
      rationale=@rationale,
      updated_at=@updated_at
     WHERE id=@id`
  ).run({
    ...merged,
    reimbursable:
      merged.reimbursable === undefined || merged.reimbursable === null
        ? null
        : merged.reimbursable
        ? 1
        : 0,
  });
  const out = db.prepare<ContextRequest>('SELECT * FROM finance_context_requests WHERE id = ?').get(id) as any;
  db.close();
  return out;
}
