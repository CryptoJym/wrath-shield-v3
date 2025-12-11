import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { getTransaction, updateTransaction } from '../../../../lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json().catch(() => ({}));
  const ids: string[] = body?.ids || [];
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  // Support both XAI_API_KEY and XAI_API_KEY_DIRECT
  const openaiKey = process.env.OPENAI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY || process.env.XAI_API_KEY_DIRECT;
  const apiKey = openaiKey || process.env.OPENROUTER_API_KEY || xaiKey;
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY or OPENROUTER_API_KEY or XAI_API_KEY/XAI_API_KEY_DIRECT missing' }, { status: 500 });
  const useOpenAI = !!openaiKey;
  const useOpenRouter = !useOpenAI && !!process.env.OPENROUTER_API_KEY;

  const results: Record<string, ClassifyResult> = {};
  for (const id of ids) {
    const txn = getTransaction(id);
    if (!txn) continue;
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
    if (!resp.ok) continue;
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    try {
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
        meta: { ...(txn.meta || {}), rationale: parsed.rationale ?? null },
      }, userId);
    } catch (e) {
      // ignore parse errors
    }
  }

  return NextResponse.json({ ok: true, results });
}
