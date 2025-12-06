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
  confidence REAL DEFAULT 0,
  -- New fields for reimbursement tracking
  company TEXT, -- UTLYZE | VUPLICITY | NEW_REWARD | SOLUTION_STREAM | KAHOA | PERSONAL
  assignee TEXT, -- James Brady | Josh Smith | Cody Vincent | Carl | etc.
  usage_note TEXT, -- How the product was used
  utilization_score REAL DEFAULT 0, -- 0-100 Utlyze metric for ROI/usage
  receipt_verified INTEGER DEFAULT 0, -- Has email receipt been matched
  receipt_email_id TEXT -- Reference to email containing receipt
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
  migrateReimbursementColumns(db);
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

function migrateReimbursementColumns(db: BetterSqlite3.Database) {
  const check = (col: string) =>
    (db.prepare("PRAGMA table_info('finance_transactions')").all() as any[]).some((c) => c.name === col);
  const alters: string[] = [];
  if (!check('company')) alters.push("ALTER TABLE finance_transactions ADD COLUMN company TEXT;");
  if (!check('assignee')) alters.push("ALTER TABLE finance_transactions ADD COLUMN assignee TEXT;");
  if (!check('usage_note')) alters.push("ALTER TABLE finance_transactions ADD COLUMN usage_note TEXT;");
  if (!check('utilization_score')) alters.push("ALTER TABLE finance_transactions ADD COLUMN utilization_score REAL DEFAULT 0;");
  if (!check('receipt_verified')) alters.push("ALTER TABLE finance_transactions ADD COLUMN receipt_verified INTEGER DEFAULT 0;");
  if (!check('receipt_email_id')) alters.push("ALTER TABLE finance_transactions ADD COLUMN receipt_email_id TEXT;");
  if (alters.length) {
    const tx = db.transaction(() => alters.forEach((sql) => db.exec(sql)));
    tx();
  }
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_finance_company ON finance_transactions(company);
     CREATE INDEX IF NOT EXISTS idx_finance_assignee ON finance_transactions(assignee);`
  );
}

// Company options for expense attribution
export const COMPANIES = ['UTLYZE', 'VUPLICITY', 'NEW_REWARD', 'SOLUTION_STREAM', 'KAHOA', 'PERSONAL'] as const;
export type Company = typeof COMPANIES[number];

// Known assignees for expense tracking
export const ASSIGNEES = ['James Brady', 'Josh Smith', 'Cody Vincent', 'Carl', 'Other'] as const;
export type Assignee = typeof ASSIGNEES[number];

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
  // Reimbursement tracking fields
  company?: Company;
  assignee?: Assignee | string;
  usage_note?: string;
  utilization_score?: number;
  receipt_verified?: boolean;
  receipt_email_id?: string;
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
  const allowedBuckets = new Set(['work_reimbursable', 'personal_ai', 'family', 'entertainment', 'other', 'unknown', null]);
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
  const sql = `SELECT * FROM finance_context_requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''
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
 * List all reports, syncing stats for drafts.
 */
export function listReports(user_id?: string): FinanceReport[] {
  const db = getDb();

  // 1. Fetch all reports
  const where = user_id
    ? "WHERE (user_id = ? OR user_id IS NULL OR user_id = 'default')"
    : '';
  const rows = db.prepare(
    `SELECT * FROM finance_reports ${where} ORDER BY cycle_start DESC`
  ).all(user_id ? [user_id] : []) as any[];

  // 2. Identify drafts to sync
  const drafts = rows.filter(r => r.status === 'draft');
  const updates: FinanceReport[] = [];

  // 3. Recalculate stats for drafts
  if (drafts.length > 0) {
    const updateStmt = db.prepare(`
      UPDATE finance_reports 
      SET total_reimbursable = @total_reimbursable,
          total_spent = @total_spent,
          transaction_count = @transaction_count,
          generated_at = STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = @id
    `);

    const statsQueryBase = user_id
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

    const statsStmt = db.prepare(statsQueryBase);

    const tx = db.transaction(() => {
      for (const draft of drafts) {
        const stats = statsStmt.get(
          user_id
            ? [draft.cycle_start, draft.cycle_end, user_id]
            : [draft.cycle_start, draft.cycle_end]
        ) as any;

        const newStats = {
          total_reimbursable: Math.abs(stats?.reimbursable || 0),
          total_spent: Math.abs(stats?.total || 0),
          transaction_count: stats?.count || 0,
        };

        // Only update if changed (simple optimization)
        if (
          Math.abs(newStats.total_reimbursable - draft.total_reimbursable) > 0.01 ||
          Math.abs(newStats.total_spent - draft.total_spent) > 0.01 ||
          newStats.transaction_count !== draft.transaction_count
        ) {
          updateStmt.run({
            id: draft.id,
            ...newStats
          });
          // Update the object in memory to return correct data immediately
          draft.total_reimbursable = newStats.total_reimbursable;
          draft.total_spent = newStats.total_spent;
          draft.transaction_count = newStats.transaction_count;
        }
      }
    });

    try {
      tx();
    } catch (err) {
      console.error("Failed to sync draft reports:", err);
    }
  }

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

// ============================================================================
// Transaction Meta Updates (for Reimbursement Tracking)
// ============================================================================

export type TransactionMetaUpdate = {
  company?: Company | null;
  assignee?: string | null;
  usage_note?: string | null;
  utilization_score?: number | null;
  receipt_verified?: boolean | null;
  receipt_email_id?: string | null;
  reimbursable?: boolean | null;
  bucket?: string | null;
  status?: 'pending_review' | 'classified' | 'confirmed';
};

/**
 * Update transaction metadata fields (company, assignee, usage_note, etc.)
 * Used for reimbursement tracking and expense categorization.
 */
export function updateTransactionMeta(
  id: string,
  updates: TransactionMetaUpdate,
  user_id?: string,
  source = 'user'
): TxnRow | null {
  const db = getDb();

  // Get existing transaction
  const query = user_id
    ? `SELECT * FROM finance_transactions WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
    : `SELECT * FROM finance_transactions WHERE id = ?`;
  const existing = db.prepare(query).get(user_id ? [id, user_id] : [id]) as any;

  if (!existing) {
    db.close();
    return null;
  }

  // Build update parts dynamically
  const setParts: string[] = [];
  const params: any = { id };

  if (updates.company !== undefined) {
    setParts.push('company = @company');
    params.company = updates.company;
  }
  if (updates.assignee !== undefined) {
    setParts.push('assignee = @assignee');
    params.assignee = updates.assignee;
  }
  if (updates.usage_note !== undefined) {
    setParts.push('usage_note = @usage_note');
    params.usage_note = updates.usage_note;
  }
  if (updates.utilization_score !== undefined) {
    setParts.push('utilization_score = @utilization_score');
    params.utilization_score = updates.utilization_score;
  }
  if (updates.receipt_verified !== undefined) {
    setParts.push('receipt_verified = @receipt_verified');
    params.receipt_verified = updates.receipt_verified === null ? null : updates.receipt_verified ? 1 : 0;
  }
  if (updates.receipt_email_id !== undefined) {
    setParts.push('receipt_email_id = @receipt_email_id');
    params.receipt_email_id = updates.receipt_email_id;
  }
  if (updates.reimbursable !== undefined) {
    setParts.push('reimbursable = @reimbursable');
    params.reimbursable = updates.reimbursable === null ? null : updates.reimbursable ? 1 : 0;
  }
  if (updates.bucket !== undefined) {
    setParts.push('bucket = @bucket');
    params.bucket = updates.bucket;
  }
  if (updates.status !== undefined) {
    setParts.push('status = @status');
    params.status = updates.status;
  }

  if (setParts.length === 0) {
    db.close();
    return {
      ...existing,
      meta: existing.meta ? safeParse(existing.meta) : undefined,
      recurring: !!existing.recurring,
      reimbursable: !!existing.reimbursable,
      receipt_verified: !!existing.receipt_verified,
    };
  }

  // Execute update
  db.prepare(`UPDATE finance_transactions SET ${setParts.join(', ')} WHERE id = @id`).run(params);

  // Audit the change if reimbursable changed
  if (updates.reimbursable !== undefined && updates.reimbursable !== !!existing.reimbursable) {
    auditTxn(id, user_id, source, {
      bucket: existing.bucket,
      project: existing.project,
      reimbursable: existing.reimbursable,
    }, {
      bucket: updates.bucket ?? existing.bucket,
      project: existing.project,
      reimbursable: updates.reimbursable,
    });
  }

  // Return updated transaction
  const updated = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id) as any;
  db.close();

  // Trigger AI Memory recording (Fire and Forget)
  if (updates.reimbursable !== undefined || updates.usage_note !== undefined) {
    recordReimbursementDecisionToMemory({
      ...updated,
      meta: updated.meta ? safeParse(updated.meta) : undefined,
      recurring: !!updated.recurring,
      reimbursable: !!updated.reimbursable,
      receipt_verified: !!updated.receipt_verified,
    }, {
      reimbursable: !!updated.reimbursable,
      assignee: updated.assignee,
      usage_note: updated.usage_note,
      company: updated.company,
      source: source
    }).catch(err => console.error('Failed to record memory:', err));
  }

  return {
    ...updated,
    meta: updated.meta ? safeParse(updated.meta) : undefined,
    recurring: !!updated.recurring,
    reimbursable: !!updated.reimbursable,
    receipt_verified: !!updated.receipt_verified,
  };
}

/**
 * Bulk update transaction meta for multiple IDs at once.
 * Useful for marking multiple transactions as reimbursable.
 */
export function bulkUpdateTransactionMeta(
  ids: string[],
  updates: TransactionMetaUpdate,
  user_id?: string,
  source = 'bulk_user'
): number {
  if (!ids.length) return 0;

  const db = getDb();
  let updated = 0;

  const tx = db.transaction(() => {
    for (const id of ids) {
      const query = user_id
        ? `SELECT * FROM finance_transactions WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
        : `SELECT * FROM finance_transactions WHERE id = ?`;
      const existing = db.prepare(query).get(user_id ? [id, user_id] : [id]) as any;

      if (!existing) continue;

      const setParts: string[] = [];
      const params: any = { id };

      if (updates.company !== undefined) {
        setParts.push('company = @company');
        params.company = updates.company;
      }
      if (updates.assignee !== undefined) {
        setParts.push('assignee = @assignee');
        params.assignee = updates.assignee;
      }
      if (updates.usage_note !== undefined) {
        setParts.push('usage_note = @usage_note');
        params.usage_note = updates.usage_note;
      }
      if (updates.reimbursable !== undefined) {
        setParts.push('reimbursable = @reimbursable');
        params.reimbursable = updates.reimbursable === null ? null : updates.reimbursable ? 1 : 0;
      }
      if (updates.bucket !== undefined) {
        setParts.push('bucket = @bucket');
        params.bucket = updates.bucket;
      }
      if (updates.status !== undefined) {
        setParts.push('status = @status');
        params.status = updates.status;
      }

      if (setParts.length > 0) {
        db.prepare(`UPDATE finance_transactions SET ${setParts.join(', ')} WHERE id = @id`).run(params);
        updated++;
      }
    }
  });

  tx();
  db.close();
  return updated;
}

/**
 * Get all transactions for a cycle (not just reimbursable).
 * Used for the reimbursement review page.
 */
export function getCycleTransactions(
  cycle_start: string,
  cycle_end: string,
  user_id?: string,
  options?: {
    reimbursableOnly?: boolean;
    bucketFilter?: string[];
    sortBy?: 'date' | 'amount' | 'vendor';
    sortDir?: 'asc' | 'desc';
  }
): TxnRow[] {
  const db = getDb();
  const where: string[] = ['date >= ?', 'date < ?'];
  const params: any[] = [cycle_start, cycle_end];

  if (user_id) {
    where.push("(user_id = ? OR user_id IS NULL OR user_id = 'default')");
    params.push(user_id);
  }

  if (options?.reimbursableOnly) {
    where.push('reimbursable = 1');
  }

  if (options?.bucketFilter?.length) {
    const placeholders = options.bucketFilter.map(() => '?').join(', ');
    where.push(`bucket IN (${placeholders})`);
    params.push(...options.bucketFilter);
  }

  const sortCol = options?.sortBy || 'date';
  const sortDir = options?.sortDir || 'desc';

  const sql = `SELECT * FROM finance_transactions WHERE ${where.join(' AND ')} ORDER BY ${sortCol} ${sortDir.toUpperCase()}`;
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();

  return rows.map(r => ({
    ...r,
    meta: r.meta ? safeParse(r.meta) : undefined,
    recurring: !!r.recurring,
    reimbursable: !!r.reimbursable,
    receipt_verified: !!r.receipt_verified,
  }));
}

/**
 * Get cycle stats breakdown by assignee
 */
export function getCycleStatsByAssignee(
  cycle_start: string,
  cycle_end: string,
  user_id?: string
): { assignee: string; count: number; total: number; reimbursable: number }[] {
  const db = getDb();
  const where = user_id
    ? `WHERE date >= ? AND date < ? AND reimbursable = 1 AND (user_id = ? OR user_id IS NULL OR user_id = 'default')`
    : `WHERE date >= ? AND date < ? AND reimbursable = 1`;

  const sql = `
    SELECT
      COALESCE(assignee, 'Unassigned') as assignee,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total,
      COALESCE(SUM(CASE WHEN reimbursable = 1 THEN amount ELSE 0 END), 0) as reimbursable
    FROM finance_transactions
    ${where}
    GROUP BY COALESCE(assignee, 'Unassigned')
    ORDER BY total DESC
  `;

  const rows = db.prepare(sql).all(user_id ? [cycle_start, cycle_end, user_id] : [cycle_start, cycle_end]) as any[];
  db.close();

  return rows.map(r => ({
    assignee: r.assignee,
    count: r.count,
    total: Math.abs(r.total),
    reimbursable: Math.abs(r.reimbursable),
  }));
}

// ============================================================================
// Zep Memory Integration for Finance Agent
// ============================================================================

/**
 * Store reimbursement decision to Zep memory for historical context.
 * This allows the finance agent to learn from past determinations.
 *
 * @param txn - The transaction that was classified
 * @param decision - The reimbursement decision details
 */
export async function recordReimbursementDecisionToMemory(
  txn: TxnRow,
  decision: {
    reimbursable: boolean;
    assignee?: string;
    usage_note?: string;
    company?: string;
    source: string;
  }
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies and client-side imports
    const { addAgentMemory } = await import('@/lib/memory/zep');

    const memoryText = `Reimbursement Decision: ${txn.vendor || txn.raw_desc} on ${txn.date} for $${Math.abs(txn.amount).toFixed(2)} was marked as ${decision.reimbursable ? 'REIMBURSABLE' : 'NOT REIMBURSABLE'}${decision.assignee ? ` for ${decision.assignee}` : ''}${decision.usage_note ? `. Usage: ${decision.usage_note}` : ''}.`;

    await addAgentMemory('finance-agent', memoryText, {
      type: 'reimbursement_decision',
      txn_id: txn.id,
      vendor: txn.vendor,
      amount: Math.abs(txn.amount),
      date: txn.date,
      bucket: txn.bucket,
      reimbursable: decision.reimbursable,
      assignee: decision.assignee,
      company: decision.company || 'UTLYZE',
      usage_note: decision.usage_note,
      decision_source: decision.source,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Finance] Recorded reimbursement decision to Zep memory for ${txn.vendor}`);
  } catch (error) {
    // Log but don't fail - Zep memory is enhancement, not critical path
    console.warn('[Finance] Failed to record to Zep memory:', error);
  }
}

/**
 * Search Zep memory for similar past reimbursement decisions.
 * Useful for auto-suggesting classifications based on historical patterns.
 *
 * @param vendor - Vendor name to search for
 * @param limit - Max results to return
 */
export async function searchReimbursementHistory(
  vendor: string,
  limit: number = 5
): Promise<Array<{
  vendor: string;
  reimbursable: boolean;
  assignee?: string;
  usage_note?: string;
  date: string;
  amount: number;
}>> {
  try {
    const { searchAgentMemory } = await import('@/lib/memory/zep');

    const results = await searchAgentMemory('finance-agent', `reimbursement ${vendor}`, limit);

    return results
      .filter(r => r.memory.metadata?.type === 'reimbursement_decision')
      .map(r => ({
        vendor: r.memory.metadata?.vendor || '',
        reimbursable: r.memory.metadata?.reimbursable ?? false,
        assignee: r.memory.metadata?.assignee,
        usage_note: r.memory.metadata?.usage_note,
        date: r.memory.metadata?.date || '',
        amount: r.memory.metadata?.amount || 0,
      }));
  } catch (error) {
    console.warn('[Finance] Failed to search Zep memory:', error);
    return [];
  }
}

/**
 * Store a completed expense report to Zep memory for historical tracking.
 */
export async function recordReportToMemory(
  report: FinanceReport,
  cycleLabel: string
): Promise<void> {
  try {
    const { addAgentMemory } = await import('@/lib/memory/zep');

    const memoryText = `Expense Report Submitted: ${cycleLabel} for ${report.employee}. Total reimbursable: $${report.total_reimbursable.toFixed(2)} across ${report.transaction_count} transactions. Purpose: ${report.purpose || 'AI Tools and Services'}.`;

    await addAgentMemory('finance-agent', memoryText, {
      type: 'expense_report',
      report_id: report.id,
      cycle_start: report.cycle_start,
      cycle_end: report.cycle_end,
      employee: report.employee,
      total_reimbursable: report.total_reimbursable,
      total_spent: report.total_spent,
      transaction_count: report.transaction_count,
      status: report.status,
      submitted_at: report.submitted_at,
      timestamp: new Date().toISOString(),
    });

    console.log(`[Finance] Recorded expense report ${report.id} to Zep memory`);
  } catch (error) {
    console.warn('[Finance] Failed to record report to Zep memory:', error);
  }
}

// ============================================================================
// Transaction Reclassification
// ============================================================================

/**
 * Reset and reclassify transactions that were incorrectly marked.
 * This is useful for bulk correction of misclassified data.
 *
 * @param dateStart - Start date (YYYY-MM-DD)
 * @param dateEnd - End date (YYYY-MM-DD)
 * @param dryRun - If true, just return counts without updating
 */
export function resetAndReclassifyTransactions(
  dateStart: string,
  dateEnd: string,
  dryRun = false
): {
  total: number;
  reset: number;
  reclassified: { bucket: string; count: number; reimbursable: number }[];
} {
  // Dynamic import classify to avoid circular dependency
  const { classify } = require('./rules');

  const db = getDb();

  // Get all transactions in date range
  const txns = db
    .prepare(
      `SELECT * FROM finance_transactions WHERE date >= ? AND date < ?`
    )
    .all(dateStart, dateEnd) as any[];

  const results: { bucket: string; count: number; reimbursable: number }[] = [];
  const bucketStats: Record<string, { count: number; reimbursable: number }> = {};
  let resetCount = 0;

  if (!dryRun) {
    // Start a transaction for atomic updates
    const updateStmt = db.prepare(`
      UPDATE finance_transactions
      SET bucket = ?, reimbursable = ?, confidence = ?, status = ?
      WHERE id = ?
    `);

    const runUpdates = db.transaction(() => {
      for (const txn of txns) {
        // Apply new classification rules
        // IMPORTANT: Reset bucket and confidence to force re-evaluation
        const classified = classify({
          ...txn,
          meta: txn.meta ? safeParse(txn.meta) : undefined,
          recurring: !!txn.recurring,
          reimbursable: false, // Reset to false for reclassification
          receipt_verified: !!txn.receipt_verified,
          bucket: 'unknown', // Reset bucket to force re-classification
          confidence: 0, // Reset confidence to force re-classification
        });

        const newReimbursable = classified.reimbursable ? 1 : 0;

        // Track if this was a change
        if (
          txn.bucket !== classified.bucket ||
          txn.reimbursable !== newReimbursable
        ) {
          resetCount++;
        }

        updateStmt.run(
          classified.bucket,
          newReimbursable,
          classified.confidence ?? 0,
          classified.status ?? 'classified',
          txn.id
        );

        // Track bucket stats
        if (!bucketStats[classified.bucket]) {
          bucketStats[classified.bucket] = { count: 0, reimbursable: 0 };
        }
        bucketStats[classified.bucket].count++;
        if (classified.reimbursable) {
          bucketStats[classified.bucket].reimbursable += Math.abs(txn.amount);
        }
      }
    });

    runUpdates();
  } else {
    // Dry run - just calculate what would happen
    for (const txn of txns) {
      // IMPORTANT: Reset bucket and confidence to force re-evaluation
      const classified = classify({
        ...txn,
        meta: txn.meta ? safeParse(txn.meta) : undefined,
        recurring: !!txn.recurring,
        reimbursable: false,
        receipt_verified: !!txn.receipt_verified,
        bucket: 'unknown', // Reset bucket to force re-classification
        confidence: 0, // Reset confidence to force re-classification
      });

      const newReimbursable = classified.reimbursable ? 1 : 0;

      if (
        txn.bucket !== classified.bucket ||
        txn.reimbursable !== newReimbursable
      ) {
        resetCount++;
      }

      if (!bucketStats[classified.bucket]) {
        bucketStats[classified.bucket] = { count: 0, reimbursable: 0 };
      }
      bucketStats[classified.bucket].count++;
      if (classified.reimbursable) {
        bucketStats[classified.bucket].reimbursable += Math.abs(txn.amount);
      }
    }
  }

  db.close();

  // Convert stats to array
  for (const [bucket, stats] of Object.entries(bucketStats)) {
    results.push({ bucket, ...stats });
  }
  results.sort((a, b) => b.reimbursable - a.reimbursable);

  return {
    total: txns.length,
    reset: resetCount,
    reclassified: results,
  };
}
