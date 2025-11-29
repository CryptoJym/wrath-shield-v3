import { TxnRow } from './store';

// Enhanced vendor classification rules
// Pattern: { match: RegExp, bucket: string, project?: string, reimbursable?: boolean, confidence?: number }
const vendorRules: { match: RegExp; bucket: string; project?: string; reimbursable?: boolean; confidence?: number }[] = [
  // AI/ML Services - Work reimbursable
  { match: /openai|anthropic|xai|x\.ai|openrouter|elevenlabs|replicate|huggingface/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /cohere|together\.ai|perplexity|runway|midjourney/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },

  // SaaS/Productivity Tools - Work (may or may not be reimbursable)
  { match: /notion|linear|zoom|github|gitlab/i, bucket: 'work_reimbursable', reimbursable: true, confidence: 0.9 },
  { match: /vercel|netlify|heroku|aws|amazon web services|digitalocean/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },
  { match: /figma|canva|adobe/i, bucket: 'work_reimbursable', project: 'design', reimbursable: true, confidence: 0.85 },

  // Cloud Storage & Services
  { match: /dropbox|google\s*(one|drive)|icloud/i, bucket: 'personal_ai', confidence: 0.8 },

  // Apple Services
  { match: /apple|app store|itunes|icloud/i, bucket: 'personal_ai', confidence: 0.75 },

  // Grocery & Family
  { match: /costco|sam'?s club|target|walmart/i, bucket: 'family', confidence: 0.9 },
  { match: /grocer|market|safeway|kroger|whole foods|trader joe/i, bucket: 'family', confidence: 0.85 },
  { match: /restaurant|cafe|coffee|starbucks|chipotle|mcdonald/i, bucket: 'family', confidence: 0.7 },

  // Entertainment
  { match: /netflix|hulu|disney|spotify|youtube premium|paramount/i, bucket: 'entertainment', confidence: 0.95 },
  { match: /steam|playstation|xbox|nintendo|epic games/i, bucket: 'entertainment', confidence: 0.95 },
  { match: /theater|cinema|amc|regal/i, bucket: 'entertainment', confidence: 0.9 },

  // Utilities & Bills
  { match: /verizon|at&t|t-mobile|sprint/i, bucket: 'family', confidence: 0.95 },
  { match: /electric|gas|water|power|energy/i, bucket: 'family', confidence: 0.9 },
  { match: /insurance|geico|state farm|allstate/i, bucket: 'family', confidence: 0.95 },

  // Transportation
  { match: /uber|lyft|taxi|shell|chevron|exxon|mobil|gas station/i, bucket: 'family', confidence: 0.8 },

  // Unknown patterns (low confidence)
  { match: /paypal|venmo|zelle|cash app/i, bucket: 'unknown', confidence: 0.3 },
];

export function classify(row: TxnRow): TxnRow {
  // If already classified with high confidence, don't override
  if (row.bucket && row.bucket !== 'unknown' && (row.confidence ?? 0) > 0.8) {
    return row;
  }

  for (const rule of vendorRules) {
    if (rule.match.test(row.vendor || '') || rule.match.test(row.raw_desc || '')) {
      return {
        ...row,
        bucket: rule.bucket,
        project: rule.project ?? row.project,
        reimbursable: rule.reimbursable ?? row.reimbursable,
        confidence: rule.confidence ?? 0.7,
        status: 'classified'
      };
    }
  }

  // No match found - mark as unknown with low confidence
  return { ...row, bucket: 'unknown', confidence: 0.1, status: 'pending_review' };
}
