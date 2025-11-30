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

CREATE TABLE IF NOT EXISTS finance_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id TEXT,
  user_id TEXT,
  source TEXT,
  ts TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  prev_bucket TEXT,
  new_bucket TEXT,
  prev_project TEXT,
  new_project TEXT,
  prev_reimbursable INTEGER,
  new_reimbursable INTEGER,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_txn ON finance_audit(txn_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON finance_audit(ts);

CREATE TABLE IF NOT EXISTS finance_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  employee TEXT DEFAULT 'James Brady',
  purpose TEXT,
  total_reimbursable REAL DEFAULT 0,
  total_spent REAL DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  generated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  submitted_at TEXT,
  pdf_path TEXT,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_cycle ON finance_reports(cycle_start, cycle_end);
CREATE INDEX IF NOT EXISTS idx_reports_status ON finance_reports(status);
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
  confidence?: number;
  meta?: any;
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
  const sql = user_id
    ? `SELECT * FROM finance_transactions WHERE date >= ? AND date < ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default') ORDER BY date DESC`
    : `SELECT * FROM finance_transactions WHERE date >= ? AND date < ? ORDER BY date DESC`;
  const stmt = db.prepare(sql);
  const rows = (user_id ? stmt.all(start, end, user_id) : stmt.all(start, end)) as any[];
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
  const row = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id) as any;
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
      .prepare(
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
  const out = db.prepare('SELECT * FROM finance_context_requests WHERE id = ?').get(id) as any;
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
  const existing = db.prepare('SELECT * FROM finance_context_requests WHERE id = ?').get(id) as any;
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
  const out = db.prepare('SELECT * FROM finance_context_requests WHERE id = ?').get(id) as any;
  db.close();
  return out;
}

// ============================================================================
// Finance Reports & Cycles
// ============================================================================

export type FinanceReport = {
  id: string;
  user_id?: string;
  cycle_start: string;
  cycle_end: string;
  employee: string;
  purpose?: string;
  total_reimbursable: number;
  total_spent: number;
  transaction_count: number;
  status: 'draft' | 'submitted' | 'approved';
  generated_at?: string;
  submitted_at?: string;
  pdf_path?: string;
  meta?: any;
};

export type CycleInfo = {
  start: string;
  end: string;
  status: 'current' | 'closed';
  reimbursable: number;
  total: number;
  count: number;
  report_id?: string;
  report_status?: string;
};

// Expense cycles run 8th to 8th (based on historical data)
const CYCLE_DAY = 8;

/**
 * Generate all expense cycles from earliest transaction to present.
 * Cycles run from the 8th of one month to the 8th of the next.
 */
export function generateAllCycles(user_id?: string): CycleInfo[] {
  const db = getDb();

  // Get earliest transaction date (exclude NULL/empty dates)
  const whereBase = "WHERE date IS NOT NULL AND date != ''";
  const whereUser = user_id
    ? `${whereBase} AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
    : whereBase;
  const earliest = db.prepare(
    `SELECT MIN(date) as min_date FROM finance_transactions ${whereUser}`
  ).get(user_id ? [user_id] : []) as any;

  if (!earliest?.min_date) {
    db.close();
    return [];
  }

  const minDate = new Date(earliest.min_date);
  const now = new Date();
  const cycles: CycleInfo[] = [];

  // Start from the cycle containing the earliest transaction
  let cycleStart = new Date(minDate.getFullYear(), minDate.getMonth(), CYCLE_DAY);
  if (minDate.getDate() < CYCLE_DAY) {
    cycleStart.setMonth(cycleStart.getMonth() - 1);
  }

  // Generate cycles until we pass today
  while (cycleStart <= now) {
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);

    const startStr = cycleStart.toISOString().split('T')[0];
    const endStr = cycleEnd.toISOString().split('T')[0];

    // Get transaction stats for this cycle
    const statsQuery = user_id
      ? `SELECT
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN reimbursable = 1 THEN amount ELSE 0 END), 0) as reimbursable
         FROM finance_transactions
         WHERE date >= ? AND date < ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
      : `SELECT
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN reimbursable = 1 THEN amount ELSE 0 END), 0) as reimbursable
         FROM finance_transactions
         WHERE date >= ? AND date < ?`;

    const stats = db.prepare(statsQuery).get(
      user_id ? [startStr, endStr, user_id] : [startStr, endStr]
    ) as any;

    // Check if there's a report for this cycle
    const reportQuery = user_id
      ? `SELECT id, status FROM finance_reports
         WHERE cycle_start = ? AND cycle_end = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')
         LIMIT 1`
      : `SELECT id, status FROM finance_reports WHERE cycle_start = ? AND cycle_end = ? LIMIT 1`;

    const report = db.prepare(reportQuery).get(
      user_id ? [startStr, endStr, user_id] : [startStr, endStr]
    ) as any;

    const isCurrent = cycleEnd > now;

    cycles.push({
      start: startStr,
      end: endStr,
      status: isCurrent ? 'current' : 'closed',
      reimbursable: Math.abs(stats?.reimbursable || 0),
      total: Math.abs(stats?.total || 0),
      count: stats?.count || 0,
      report_id: report?.id,
      report_status: report?.status,
    });

    cycleStart = cycleEnd;
  }

  db.close();
  return cycles.reverse(); // Most recent first
}

/**
 * Create a new expense report for a cycle
 */
export function createReport(input: {
  cycle_start: string;
  cycle_end: string;
  user_id?: string;
  employee?: string;
  purpose?: string;
}): FinanceReport {
  const db = getDb();
  const id = `rpt_${uuidv4().slice(0, 8)}`;

  // Calculate stats from transactions
  const statsQuery = input.user_id
    ? `SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(CASE WHEN reimbursable = 1 THEN amount ELSE 0 END), 0) as reimbursable
       FROM finance_transactions
       WHERE date >= ? AND date < ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
    : `SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(CASE WHEN reimbursable = 1 THEN amount ELSE 0 END), 0) as reimbursable
       FROM finance_transactions
       WHERE date >= ? AND date < ?`;

  const stats = db.prepare(statsQuery).get(
    input.user_id
      ? [input.cycle_start, input.cycle_end, input.user_id]
      : [input.cycle_start, input.cycle_end]
  ) as any;

  db.prepare(
    `INSERT INTO finance_reports
      (id, user_id, cycle_start, cycle_end, employee, purpose, total_reimbursable, total_spent, transaction_count, status)
     VALUES (@id, @user_id, @cycle_start, @cycle_end, @employee, @purpose, @total_reimbursable, @total_spent, @transaction_count, @status)`
  ).run({
    id,
    user_id: input.user_id || 'default',
    cycle_start: input.cycle_start,
    cycle_end: input.cycle_end,
    employee: input.employee || 'James Brady',
    purpose: input.purpose || `AI Tools and Services (${formatCycleLabel(input.cycle_start, input.cycle_end)})`,
    total_reimbursable: Math.abs(stats?.reimbursable || 0),
    total_spent: Math.abs(stats?.total || 0),
    transaction_count: stats?.count || 0,
    status: 'draft',
  });

  const out = db.prepare('SELECT * FROM finance_reports WHERE id = ?').get(id) as any;
  db.close();
  return {
    ...out,
    meta: out.meta ? safeParse(out.meta) : undefined,
  };
}

/**
 * List all reports
 */
export function listReports(user_id?: string): FinanceReport[] {
  const db = getDb();
  const where = user_id
    ? "WHERE (user_id = ? OR user_id IS NULL OR user_id = 'default')"
    : '';
  const rows = db.prepare(
    `SELECT * FROM finance_reports ${where} ORDER BY cycle_start DESC`
  ).all(user_id ? [user_id] : []) as any[];
  db.close();
  return rows.map(r => ({
    ...r,
    meta: r.meta ? safeParse(r.meta) : undefined,
  }));
}

/**
 * Get a single report by ID
 */
export function getReport(id: string, user_id?: string): FinanceReport | null {
  const db = getDb();
  const where = user_id
    ? "WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')"
    : 'WHERE id = ?';
  const row = db.prepare(`SELECT * FROM finance_reports ${where}`).get(
    user_id ? [id, user_id] : [id]
  ) as any;
  db.close();
  if (!row) return null;
  return {
    ...row,
    meta: row.meta ? safeParse(row.meta) : undefined,
  };
}

/**
 * Get report by cycle dates
 */
export function getReportByCycle(cycle_start: string, cycle_end: string, user_id?: string): FinanceReport | null {
  const db = getDb();
  const where = user_id
    ? "WHERE cycle_start = ? AND cycle_end = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')"
    : 'WHERE cycle_start = ? AND cycle_end = ?';
  const row = db.prepare(`SELECT * FROM finance_reports ${where}`).get(
    user_id ? [cycle_start, cycle_end, user_id] : [cycle_start, cycle_end]
  ) as any;
  db.close();
  if (!row) return null;
  return {
    ...row,
    meta: row.meta ? safeParse(row.meta) : undefined,
  };
}

/**
 * Update a report
 */
export function updateReport(id: string, updates: Partial<FinanceReport>, user_id?: string): FinanceReport | null {
  const db = getDb();
  // Include user_id check for security - only allow updating own reports
  const query = user_id
    ? `SELECT * FROM finance_reports WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
    : `SELECT * FROM finance_reports WHERE id = ?`;
  const existing = db.prepare(query).get(user_id ? [id, user_id] : [id]) as any;
  if (!existing) {
    db.close();
    return null;
  }

  const setParts: string[] = [];
  const params: any = { id };

  if (updates.status !== undefined) {
    setParts.push('status = @status');
    params.status = updates.status;
    if (updates.status === 'submitted') {
      setParts.push("submitted_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
    }
  }
  if (updates.purpose !== undefined) {
    setParts.push('purpose = @purpose');
    params.purpose = updates.purpose;
  }
  if (updates.employee !== undefined) {
    setParts.push('employee = @employee');
    params.employee = updates.employee;
  }
  if (updates.pdf_path !== undefined) {
    setParts.push('pdf_path = @pdf_path');
    params.pdf_path = updates.pdf_path;
  }
  if (updates.meta !== undefined) {
    setParts.push('meta = @meta');
    params.meta = JSON.stringify(updates.meta);
  }

  if (setParts.length) {
    db.prepare(`UPDATE finance_reports SET ${setParts.join(', ')} WHERE id = @id`).run(params);
  }

  const out = db.prepare('SELECT * FROM finance_reports WHERE id = ?').get(id) as any;
  db.close();
  return {
    ...out,
    meta: out.meta ? safeParse(out.meta) : undefined,
  };
}

/**
 * Get transactions for a report (reimbursable only)
 */
export function getReportTransactions(cycle_start: string, cycle_end: string, user_id?: string): TxnRow[] {
  const db = getDb();
  const where = user_id
    ? `WHERE date >= ? AND date < ? AND reimbursable = 1 AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
    : `WHERE date >= ? AND date < ? AND reimbursable = 1`;
  const rows = db.prepare(
    `SELECT * FROM finance_transactions ${where} ORDER BY date ASC`
  ).all(user_id ? [cycle_start, cycle_end, user_id] : [cycle_start, cycle_end]) as any[];
  db.close();
  return rows.map(r => ({
    ...r,
    meta: r.meta ? safeParse(r.meta) : undefined,
    recurring: !!r.recurring,
    reimbursable: !!r.reimbursable,
  }));
}

/**
 * Format a cycle label for display (e.g., "Nov 8 → Dec 8, 2025")
 */
export function formatCycleLabel(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const startMonth = months[startDate.getMonth()];
  const startDay = startDate.getDate();
  const endMonth = months[endDate.getMonth()];
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startMonth} ${startDay} → ${endMonth} ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay}, ${startDate.getFullYear()} → ${endMonth} ${endDay}, ${year}`;
}
