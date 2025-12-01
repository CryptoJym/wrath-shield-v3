import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { getTransaction, updateTransaction } from '../../../../lib/finance/store';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minute timeout for batch processing

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.1';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OR_MODEL = process.env.OPENROUTER_MODEL || 'x-ai/grok-4.1-fast';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const XAI_URL = 'https://api.x.ai/v1/chat/completions';

type ClassifyResult = {
  bucket?: string | null;
  project?: string | null;
  reimbursable?: boolean | null;
  rationale?: string | null;
};

/**
 * Batch classify pending_review transactions
 * POST /api/finance/classify-batch
 * Body: { limit?: number } - defaults to 50
 */
export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(body?.limit || 50, 100); // Max 100 per batch

  const openaiKey = process.env.OPENAI_API_KEY;
  const apiKey = openaiKey || process.env.OPENROUTER_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY or OPENROUTER_API_KEY or XAI_API_KEY missing' }, { status: 500 });
  }
  const useOpenAI = !!openaiKey;
  const useOpenRouter = !useOpenAI && !!process.env.OPENROUTER_API_KEY;

  // Get pending_review transactions directly from DB
  const dbPath = path.resolve(process.cwd(), '.data', 'finance', 'finance.db');
  const db = new BetterSqlite3(dbPath);

  const pendingTxns = db.prepare(`
    SELECT id FROM finance_transactions
    WHERE status = 'pending_review'
    AND (user_id = ? OR user_id IS NULL OR user_id = 'default')
    ORDER BY date DESC
    LIMIT ?
  `).all(userId, limit) as { id: string }[];
  db.close();

  if (!pendingTxns.length) {
    return NextResponse.json({
      ok: true,
      message: 'No pending transactions to classify',
      classified: 0,
      skipped: 0,
      remaining: 0
    });
  }

  const results: Record<string, ClassifyResult> = {};
  let classified = 0;
  let skipped = 0;

  for (const { id } of pendingTxns) {
    const txn = getTransaction(id);
    if (!txn) {
      skipped++;
      continue;
    }

    const payload = {
      model: useOpenAI ? OPENAI_MODEL : OR_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You classify personal finance transactions. Output strict JSON {"bucket": string|null, "project": string|null, "reimbursable": bool|null, "rationale": string}. Buckets: work_reimbursable, work_nonreimbursable, personal_ai, family, other. If unsure, bucket=null.',
        },
        {
          role: 'user',
          content: `Vendor: ${txn.vendor || 'unknown'}\nDescription: ${txn.raw_desc || ''}\nAmount: ${txn.amount}\nDate: ${txn.date}\nCurrent bucket: ${txn.bucket || 'null'}\nProject: ${txn.project || 'null'}`,
        },
      ],
      response_format: { type: 'json_object' },
    };

    try {
      const resp = await fetch(useOpenAI ? OPENAI_URL : (useOpenRouter ? OR_URL : XAI_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(useOpenRouter
            ? { 'HTTP-Referer': 'wrath-shield-v3', 'X-Title': 'finance-classifier' }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        skipped++;
        continue;
      }

      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);

      results[id] = {
        bucket: parsed.bucket ?? null,
        project: parsed.project ?? null,
        reimbursable: parsed.reimbursable ?? null,
        rationale: parsed.rationale ?? null,
      };

      updateTransaction(id, {
        bucket: parsed.bucket ?? null,
        project: parsed.project ?? null,
        reimbursable: parsed.reimbursable ?? null,
        status: 'classified',
      }, userId);

      classified++;
    } catch (e) {
      skipped++;
    }
  }

  // Get remaining count
  const db2 = new BetterSqlite3(dbPath);
  const remaining = (db2.prepare(`
    SELECT COUNT(*) as count FROM finance_transactions
    WHERE status = 'pending_review'
    AND (user_id = ? OR user_id IS NULL OR user_id = 'default')
  `).get(userId) as { count: number })?.count || 0;
  db2.close();

  return NextResponse.json({
    ok: true,
    classified,
    skipped,
    remaining,
    message: `Classified ${classified} transactions, ${skipped} skipped, ${remaining} remaining`,
    results
  });
}

/**
 * Get status of pending transactions
 * GET /api/finance/classify-batch
 */
export async function GET() {
  const { userId } = currentUserOrThrow();

  const dbPath = path.resolve(process.cwd(), '.data', 'finance', 'finance.db');
  const db = new BetterSqlite3(dbPath);

  const stats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM finance_transactions
    WHERE (user_id = ? OR user_id IS NULL OR user_id = 'default')
    GROUP BY status
  `).all(userId) as { status: string; count: number }[];
  db.close();

  const statusMap: Record<string, number> = {};
  for (const s of stats) {
    statusMap[s.status || 'unknown'] = s.count;
  }

  return NextResponse.json({
    ok: true,
    pending_review: statusMap['pending_review'] || 0,
    classified: statusMap['classified'] || 0,
    confirmed: statusMap['confirmed'] || 0,
    total: Object.values(statusMap).reduce((a, b) => a + b, 0)
  });
}
