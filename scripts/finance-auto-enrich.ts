import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fetch from 'node-fetch';
import { listContextRequests, getTransaction } from '../lib/finance/store';
import { applyCommsContext } from '../lib/finance/enrich';

const model = process.env.OPENROUTER_MODEL || 'x-ai/grok-4.1-fast';
const apiKey = process.env.OPENROUTER_API_KEY;
const limit = Number(process.env.LIMIT || 5);
const dryRun = process.env.DRY_RUN === '1';

if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY');
  process.exit(1);
}

const pending = listContextRequests('pending').slice(0, limit);
if (!pending.length) {
  console.log('No pending finance context requests.');
  process.exit(0);
}

function buildPrompt(req: any, txn: any | null) {
  return `You are a finance classification assistant. Given a transaction, decide:
- brief summary (what it likely is)
- bucket (short slug, e.g., work_reimbursable, personal, infra, ai_research)
- reimbursable (true/false)
- rationale (why)
- confidence 0-1

Transaction:
Vendor: ${req.vendor || txn?.vendor || 'unknown'}
Amount: ${req.amount ?? txn?.amount ?? 'unknown'}
Date: ${req.date ?? txn?.date ?? 'unknown'}
Raw description: ${txn?.raw_desc ?? 'n/a'}
Source meta: ${JSON.stringify(txn?.meta ?? {})}

Return JSON with keys: summary, bucket, reimbursable, rationale, confidence, project (optional), note (optional).
`;
}

async function classify(req: any) {
  const txn = req.txn_id ? getTransaction(req.txn_id) : null;
  const prompt = buildPrompt(req, txn);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://wrath-shield-local',
      'X-Title': 'finance-auto-enrich',
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
  return {
    summary: parsed.summary || '',
    bucket: parsed.bucket || undefined,
    reimbursable: parsed.reimbursable ?? undefined,
    rationale: parsed.rationale || undefined,
    confidence: parsed.confidence ?? 0.6,
    project: parsed.project || undefined,
    note: parsed.note || undefined,
  };
}

(async () => {
  for (const req of pending) {
    try {
      const parsed = await classify(req);
      console.log(JSON.stringify({ id: req.id, ...parsed }, null, 2));
      if (!dryRun) {
        applyCommsContext(req.id, {
          id: req.id,
          summary: parsed.summary,
          confidence: parsed.confidence,
          bucket: parsed.bucket,
          project: parsed.project,
          reimbursable: parsed.reimbursable,
          note: parsed.note,
          rationale: parsed.rationale,
        });
      }
    } catch (e: any) {
      console.error('Failed on', req.id, e?.message || e);
    }
  }
})();
