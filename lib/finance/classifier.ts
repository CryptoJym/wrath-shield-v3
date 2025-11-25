import { TxnRow } from './store';

// Heuristics for reimbursable AI/software
const aiVendors = [
  /openai/i,
  /anthropic/i,
  /xai/i,
  /gpt/i,
  /claude/i,
  /perplexity/i,
  /cursor/i,
  /vercel/i,
  /figma/i,
  /notion/i,
  /supabase/i,
  /instantly/i,
  /apollo\.io/i,
  /gamma\.app/i,
  /paddle/i,
  /plaid/i,
  /zep/i,
  /heygen/i,
  /opus clip/i,
  /turboscribe/i,
  /manus ai/i,
  /ngrok/i,
  /starlink/i,
  /tmobile/i, // infra/comm
  /aws|amazon web services/i,
];

const familyVendors = [/costco/i, /walmart/i, /target/i, /grocery/i, /good earth/i, /mcdonald/i, /amazon/i];
const personalAIVendors = [/apple\.com\/bill/i, /app store/i, /google one/i, /prime video/i];

export type Classified = { bucket: string; project?: string; reimbursable: boolean; confidence: number };

export function classifyTxn(txn: TxnRow): Classified {
  const v = (txn.vendor || '').toLowerCase();

  // Rule: AI reimbursable
  if (aiVendors.some((r) => r.test(v))) {
    return { bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 };
  }

  // Personal AI/media
  if (personalAIVendors.some((r) => r.test(v))) {
    return { bucket: 'personal_ai', project: undefined, reimbursable: false, confidence: 0.85 };
  }

  // Family/household
  if (familyVendors.some((r) => r.test(v))) {
    return { bucket: 'family', project: 'household', reimbursable: false, confidence: 0.8 };
  }

  // Account defaults
  const acct = (txn.account || '').toLowerCase();
  if (acct.includes('amex') || acct.includes('usbank')) {
    return { bucket: 'work_nonreimbursable', project: 'ops', reimbursable: false, confidence: 0.6 };
  }
  if (acct.includes('afcu') || acct.includes('wells')) {
    return { bucket: 'family', project: 'household', reimbursable: false, confidence: 0.6 };
  }

  return { bucket: 'unknown', reimbursable: false, confidence: 0.3 };
}
