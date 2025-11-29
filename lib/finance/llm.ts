/**
 * Finance LLM module
 * Now integrated with Life OS AgentInvoker for routing and escalation.
 */
import { getTransaction, listContextRequests } from './store';
import { applyCommsContext } from './enrich';
import { applyRule, upsertRule } from './vendorRules';
import { invokeAgent } from '../agents/AgentInvoker';

// Finance agent ID
const FINANCE_AGENT_ID = 'agent.finance';

function buildPrompt(req: any, txn: any | null): string {
  return `Classify this transaction:

Vendor: ${req.vendor || txn?.vendor || 'unknown'}
Amount: ${req.amount ?? txn?.amount ?? 'unknown'}
Date: ${req.date ?? txn?.date ?? 'unknown'}
Raw description: ${txn?.raw_desc ?? 'n/a'}
Source meta: ${JSON.stringify(txn?.meta ?? {})}

Respond with ONLY a JSON object containing:
- summary: brief description of what this is
- bucket: category slug (work_reimbursable, personal, infra, ai_research, etc.)
- reimbursable: true/false
- rationale: why you classified it this way
- confidence: 0-1
- project: (optional) related project
- note: (optional) additional notes`;
}

export async function autoClassifyOne(ctxId: string, userId?: string) {
  const req = listContextRequests('pending', userId).find((r) => r.id === ctxId);
  if (!req) throw new Error('Context request not found or not pending');
  const txn = req.txn_id ? getTransaction(req.txn_id) : null;
  const rule = applyRule(req.vendor || txn?.vendor);
  const prompt = buildPrompt(req, txn);

  // Call via AgentInvoker (Life OS routing)
  const response = await invokeAgent({
    agentId: FINANCE_AGENT_ID,
    userMessage: prompt,
    context: { domainId: 'personal_finance' },
    forceExecute: true, // Finance classification is auto-execute
  });

  const content = response.content.trim();
  if (!content) throw new Error('No content from model');

  let parsed: any;
  try {
    // Strip markdown code blocks if present
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleanJson);
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

  // Learn vendor rule if user later confirms
  if (applied?.vendor || txn?.vendor) {
    const v = (applied?.vendor || txn?.vendor || '').toLowerCase();
    if (v) {
      upsertRule({
        vendor: v,
        bucket: result.bucket,
        reimbursable: result.reimbursable,
        project: result.project,
        note: result.note,
        rationale: result.rationale,
      });
    }
  }

  console.log(`[Finance LLM] Classified ${req.vendor || 'unknown'} (escalation: ${response.escalationLevel})`);
  return applied;
}
