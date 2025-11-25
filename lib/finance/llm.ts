import fetch from 'node-fetch';
import { getTransaction, listContextRequests } from './store';
import { applyCommsContext } from './enrich';
import { applyRule, upsertRule } from './vendorRules';

const model = process.env.OPENROUTER_MODEL || 'x-ai/grok-4.1-fast';
const apiKey = process.env.OPENROUTER_API_KEY;

function buildPrompt(req: any, txn: any | null) {
  return `You are a finance classification assistant. Given a transaction, decide:
- brief summary (what it likely is)
- bucket (short slug, e.g., work_reimbursable, personal, infra, ai_research)
- reimbursable (true/false)
- rationale (why)
- confidence 0-1
- optional: project, note
Transaction:
Vendor: ${req.vendor || txn?.vendor || 'unknown'}
Amount: ${req.amount ?? txn?.amount ?? 'unknown'}
Date: ${req.date ?? txn?.date ?? 'unknown'}
Raw description: ${txn?.raw_desc ?? 'n/a'}
Source meta: ${JSON.stringify(txn?.meta ?? {})}
Return JSON with keys: summary, bucket, reimbursable, rationale, confidence, project (optional), note (optional).
`;
}

export async function autoClassifyOne(ctxId: string, userId?: string) {
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');
  const req = listContextRequests('pending', userId).find((r) => r.id === ctxId);
  if (!req) throw new Error('Context request not found or not pending');
  const txn = req.txn_id ? getTransaction(req.txn_id) : null;
  const rule = applyRule(req.vendor || txn?.vendor);
  const prompt = buildPrompt(req, txn);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://wrath-shield-local',
      'X-Title': 'finance-auto-enrich-one',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Output JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('No content from model');
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('Failed to parse JSON from model: ' + content);
  }
  const result = {
    summary: parsed.summary || '',
    bucket: parsed.bucket || rule?.bucket || undefined,
    reimbursable: parsed.reimbursable ?? rule?.reimbursable ?? undefined,
    rationale: parsed.rationale || rule?.rationale || undefined,
    confidence: Math.min(1, (parsed.confidence ?? 0.6) + (rule?.confidenceBoost || 0)),
    project: parsed.project || rule?.project || undefined,
    note: parsed.note || rule?.note || undefined,
  };
  // Apply immediately
  const applied = applyCommsContext(req.id, {
    id: req.id,
    summary: result.summary,
    confidence: result.confidence,
    bucket: result.bucket,
    project: result.project,
    reimbursable: result.reimbursable,
    note: result.note,
    rationale: result.rationale,
  });
  // Learn vendor rule if user later confirms; we pre-store now when high confidence
  if (applied?.vendor || txn?.vendor) {
    const v = (applied?.vendor || txn?.vendor || '').toLowerCase();
    if (v) {
      upsertRule({ vendor: v, bucket: result.bucket, reimbursable: result.reimbursable, project: result.project, note: result.note, rationale: result.rationale });
    }
  }
  return applied;
}
