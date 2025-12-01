import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { getTransaction, updateTransaction } from '../../../../lib/finance/store';
import { getRule, upsertRule, type VendorRule } from '../../../../lib/finance/vendorRules';
import { classifyTxn } from '../../../../lib/finance/classifier';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

type ClassifyResult = {
  bucket?: string | null;
  project?: string | null;
  reimbursable?: boolean | null;
  rationale?: string | null;
  confidence?: number;
  source?: string; // 'rule' | 'heuristic' | 'llm' | 'history'
};

/**
 * Build historical context for the AI from past classifications
 */
function buildHistoricalContext(db: BetterSqlite3.Database, vendor: string): string {
  // Get past classifications for this vendor
  const pastForVendor = db.prepare(`
    SELECT bucket, project, reimbursable, COUNT(*) as cnt
    FROM finance_transactions
    WHERE vendor LIKE ? AND status IN ('classified', 'confirmed') AND bucket IS NOT NULL
    GROUP BY bucket, project, reimbursable
    ORDER BY cnt DESC
    LIMIT 5
  `).all(`%${vendor.substring(0, 10)}%`) as any[];

  // Get similar vendor patterns
  const similarVendors = db.prepare(`
    SELECT DISTINCT vendor, bucket, reimbursable
    FROM finance_transactions
    WHERE status IN ('classified', 'confirmed') AND bucket IS NOT NULL
    ORDER BY date DESC
    LIMIT 50
  `).all() as any[];

  let context = '';

  if (pastForVendor.length > 0) {
    context += `\n\nHISTORICAL DATA FOR THIS VENDOR:\n`;
    for (const p of pastForVendor) {
      context += `- Classified ${p.cnt}x as: bucket=${p.bucket}, project=${p.project || 'none'}, reimbursable=${p.reimbursable ? 'yes' : 'no'}\n`;
    }
  }

  // Add vendor rules context
  const rulesPath = path.resolve(process.cwd(), '.data', 'vendor-rules.json');
  if (fs.existsSync(rulesPath)) {
    try {
      const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8')) as VendorRule[];
      const relevantRules = rules.filter(r =>
        vendor.toLowerCase().includes(r.vendor) || r.vendor.includes(vendor.toLowerCase().substring(0, 6))
      ).slice(0, 5);

      if (relevantRules.length > 0) {
        context += `\n\nLEARNED VENDOR RULES:\n`;
        for (const r of relevantRules) {
          context += `- ${r.vendor}: bucket=${r.bucket}, reimbursable=${r.reimbursable}, project=${r.project || 'none'}, rationale="${r.rationale || ''}"\n`;
        }
      }
    } catch (e) {}
  }

  return context;
}

/**
 * Smart classify a single transaction using rules, heuristics, and LLM with historical context
 */
async function smartClassifyOne(
  txn: any,
  userId: string,
  db: BetterSqlite3.Database,
  apiKey: string,
  useOpenAI: boolean,
  useOpenRouter: boolean
): Promise<ClassifyResult> {
  const vendor = (txn.vendor || txn.raw_desc || '').toLowerCase();

  // Step 1: Check vendor rules first (learned patterns)
  const rule = getRule(vendor);
  if (rule && rule.bucket) {
    return {
      bucket: rule.bucket,
      project: rule.project,
      reimbursable: rule.reimbursable,
      rationale: `Matched vendor rule: ${rule.rationale || 'previously classified'}`,
      confidence: 0.95,
      source: 'rule'
    };
  }

  // Step 2: Check heuristic classifier
  const heuristic = classifyTxn(txn);
  if (heuristic.confidence >= 0.8 && heuristic.bucket !== 'unknown') {
    return {
      bucket: heuristic.bucket,
      project: heuristic.project,
      reimbursable: heuristic.reimbursable,
      rationale: `Matched heuristic pattern`,
      confidence: heuristic.confidence,
      source: 'heuristic'
    };
  }

  // Step 3: Check historical exact matches
  const exactMatch = db.prepare(`
    SELECT bucket, project, reimbursable, COUNT(*) as cnt
    FROM finance_transactions
    WHERE vendor = ? AND status IN ('classified', 'confirmed') AND bucket IS NOT NULL
    GROUP BY bucket, project, reimbursable
    ORDER BY cnt DESC
    LIMIT 1
  `).get(txn.vendor) as any;

  if (exactMatch && exactMatch.cnt >= 3) {
    return {
      bucket: exactMatch.bucket,
      project: exactMatch.project,
      reimbursable: !!exactMatch.reimbursable,
      rationale: `Matched ${exactMatch.cnt} previous identical transactions`,
      confidence: 0.9,
      source: 'history'
    };
  }

  // Step 4: Use LLM with full context
  const historicalContext = buildHistoricalContext(db, vendor);

  const systemPrompt = `You are a personal finance classifier for James Brady's expense tracking system.

CLASSIFICATION BUCKETS:
- work_reimbursable: Business expenses for Vuplicity/Utlyze work (AI tools, SaaS, infrastructure, client meetings)
- personal_ai: Personal AI/tech subscriptions not for work (personal Spotify, Netflix, gaming)
- family: Household expenses (groceries, gas, utilities, family entertainment)
- entertainment: Personal entertainment (movies, concerts, dining out with friends)
- other: Anything that doesn't fit above categories

IMPORTANT CONTEXT:
- James runs AI/tech companies (Vuplicity, Utlyze, Noticingmind)
- AI tools (OpenAI, Anthropic, Cursor, Windsurf, Claude, Perplexity, etc.) are usually work_reimbursable
- Infrastructure (Vercel, Supabase, AWS, GitHub, Clerk) is work_reimbursable
- Sales tools (Apollo, Instantly, Growthlead) are work_reimbursable
- McDonald's near work is often work_reimbursable (client meetings)
- Apple.com/bill for iCloud/personal apps is usually personal_ai
- Grocery stores, gas stations are usually family
${historicalContext}

Output ONLY valid JSON: {"bucket": string, "project": string|null, "reimbursable": boolean, "rationale": string, "confidence": number}`;

  const userPrompt = `Classify this transaction:
Vendor: ${txn.vendor || 'unknown'}
Description: ${txn.raw_desc || 'n/a'}
Amount: $${Math.abs(txn.amount || 0).toFixed(2)}
Date: ${txn.date}
Account: ${txn.account || 'unknown'}`;

  const model = useOpenAI ? (process.env.OPENAI_MODEL || 'gpt-4o') : (process.env.OPENROUTER_MODEL || 'x-ai/grok-4-1-fast');
  const url = useOpenAI ? OPENAI_URL : (useOpenRouter ? OR_URL : XAI_URL);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(useOpenRouter ? { 'HTTP-Referer': 'wrath-shield-v3', 'X-Title': 'finance-smart-classifier' } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error('[SmartClassify] LLM error:', resp.status, await resp.text());
      return { bucket: null, source: 'llm', rationale: 'LLM call failed' };
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

    // Learn from this classification for future
    if (parsed.bucket && txn.vendor) {
      upsertRule({
        vendor: txn.vendor.toLowerCase(),
        bucket: parsed.bucket,
        reimbursable: parsed.reimbursable,
        project: parsed.project,
        rationale: parsed.rationale,
      });
    }

    return {
      bucket: parsed.bucket,
      project: parsed.project,
      reimbursable: parsed.reimbursable,
      rationale: parsed.rationale,
      confidence: parsed.confidence || 0.7,
      source: 'llm'
    };
  } catch (e) {
    console.error('[SmartClassify] Error:', e);
    return { bucket: null, source: 'llm', rationale: 'Parse error' };
  }
}

/**
 * POST /api/finance/smart-classify
 * Body: { limit?: number }
 *
 * Intelligently classifies pending transactions using:
 * 1. Learned vendor rules
 * 2. Heuristic patterns
 * 3. Historical transaction matches
 * 4. LLM with full context (only if above fail)
 */
export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(body?.limit || 50, 200);

  const openaiKey = process.env.OPENAI_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;
  const apiKey = openaiKey || orKey || xaiKey;

  if (!apiKey) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
  }

  const useOpenAI = !!openaiKey;
  const useOpenRouter = !useOpenAI && !!orKey;

  const dbPath = path.resolve(process.cwd(), '.data', 'finance', 'finance.db');
  const db = new BetterSqlite3(dbPath);

  // Get pending transactions
  const pending = db.prepare(`
    SELECT * FROM finance_transactions
    WHERE status = 'pending_review'
    AND (user_id = ? OR user_id IS NULL OR user_id = 'default')
    ORDER BY date DESC
    LIMIT ?
  `).all(userId, limit) as any[];

  if (!pending.length) {
    db.close();
    return NextResponse.json({
      ok: true,
      message: 'No pending transactions',
      classified: 0,
      bySource: {},
      remaining: 0
    });
  }

  const results: Record<string, ClassifyResult> = {};
  const bySource: Record<string, number> = { rule: 0, heuristic: 0, history: 0, llm: 0, skipped: 0 };
  let classified = 0;

  for (const txn of pending) {
    const result = await smartClassifyOne(txn, userId, db, apiKey, useOpenAI, useOpenRouter);
    results[txn.id] = result;

    if (result.bucket) {
      updateTransaction(txn.id, {
        bucket: result.bucket,
        project: result.project || undefined,
        reimbursable: result.reimbursable ?? undefined,
        status: 'classified',
        rationale: result.rationale || undefined,
      }, userId, 'smart-classify');
      classified++;
      bySource[result.source || 'llm']++;
    } else {
      bySource.skipped++;
    }
  }

  // Get remaining count
  const remaining = (db.prepare(`
    SELECT COUNT(*) as count FROM finance_transactions
    WHERE status = 'pending_review'
    AND (user_id = ? OR user_id IS NULL OR user_id = 'default')
  `).get(userId) as { count: number })?.count || 0;

  db.close();

  return NextResponse.json({
    ok: true,
    classified,
    bySource,
    remaining,
    message: `Classified ${classified}: ${bySource.rule} by rule, ${bySource.heuristic} by heuristic, ${bySource.history} by history, ${bySource.llm} by LLM, ${bySource.skipped} skipped`,
    results
  });
}

/**
 * GET /api/finance/smart-classify
 * Returns classification stats and pending count
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

  // Get vendor rules count
  const rulesPath = path.resolve(process.cwd(), '.data', 'vendor-rules.json');
  let rulesCount = 0;
  if (fs.existsSync(rulesPath)) {
    try {
      rulesCount = JSON.parse(fs.readFileSync(rulesPath, 'utf8')).length;
    } catch (e) {}
  }

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
    total: Object.values(statusMap).reduce((a, b) => a + b, 0),
    vendor_rules: rulesCount
  });
}
