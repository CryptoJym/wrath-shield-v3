import { TxnRow } from './store';

// Simple rule stubs; extend/learn over time
const vendorRules: { match: RegExp; bucket: string; project?: string; reimbursable?: boolean }[] = [
  { match: /openai|anthropic|xai|openrouter|elevenlabs/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true },
  { match: /notion|linear|slack|zoom/i, bucket: 'work_nonreimbursable' },
  { match: /costco|target|walmart|grocer|market/i, bucket: 'family' },
  { match: /apple|app store/i, bucket: 'personal_ai' },
];

export function classify(row: TxnRow): TxnRow {
  for (const rule of vendorRules) {
    if (rule.match.test(row.vendor || '')) {
      return { ...row, bucket: rule.bucket, project: rule.project ?? row.project, reimbursable: rule.reimbursable ?? row.reimbursable };
    }
  }
  return row;
}
