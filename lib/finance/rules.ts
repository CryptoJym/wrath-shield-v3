import { TxnRow } from './store';
import { applyRule } from './vendorRules';

// Enhanced vendor classification rules
// Pattern: { match: RegExp, bucket: string, project?: string, reimbursable?: boolean, confidence?: number }
const vendorRules: { match: RegExp; bucket: string; project?: string; reimbursable?: boolean; confidence?: number }[] = [
  // AI/ML Services - Work reimbursable
  { match: /openai|anthropic|xai|x\.ai|openrouter|elevenlabs|replicate|huggingface/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /cohere|together\.ai|perplexity|runway|midjourney/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /cursor|lovable|manus\s*ai|turboscribe|opus\s*clip/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /heygen|gamma\.app|gamma/i, bucket: 'work_reimbursable', project: 'marketing', reimbursable: true, confidence: 0.9 },

  // SaaS/Productivity Tools - Work (may or may not be reimbursable)
  { match: /notion|linear|zoom|github|gitlab/i, bucket: 'work_reimbursable', reimbursable: true, confidence: 0.9 },
  { match: /vercel|netlify|heroku|aws|amazon web services|digitalocean/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },
  { match: /supabase|clerk\.com|plaid|zep|ngrok|paddle/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },
  { match: /figma|canva|adobe/i, bucket: 'work_reimbursable', project: 'design', reimbursable: true, confidence: 0.85 },

  // Sales/Outreach Tools - Work reimbursable
  { match: /apollo\.io|instantly|zapmail|growthlead/i, bucket: 'work_reimbursable', project: 'outreach', reimbursable: true, confidence: 0.95 },

  // Company expenses
  { match: /vuplicity/i, bucket: 'work_reimbursable', project: 'company', reimbursable: true, confidence: 0.95 },
  { match: /starlink/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },
  { match: /neurable/i, bucket: 'work_reimbursable', project: 'hardware', reimbursable: true, confidence: 0.95 },

  // Cloud Storage & Services
  { match: /dropbox|google\s*(one|drive)|icloud/i, bucket: 'personal_ai', confidence: 0.8 },

  // Apple Services
  { match: /apple|app store|itunes|icloud/i, bucket: 'personal_ai', confidence: 0.75 },

  // Grocery & Family
  { match: /costco|sam'?s club|target|walmart/i, bucket: 'family', confidence: 0.9 },
  { match: /grocer|market|safeway|kroger|whole foods|trader joe|good earth|harmons|smiths/i, bucket: 'family', confidence: 0.85 },
  { match: /restaurant|cafe|coffee|starbucks|chipotle|mcdonald|swig/i, bucket: 'family', confidence: 0.7 },

  // Entertainment
  { match: /netflix|hulu|disney|spotify|youtube premium|paramount|prime video/i, bucket: 'entertainment', confidence: 0.95 },
  { match: /steam|playstation|xbox|nintendo|epic games/i, bucket: 'entertainment', confidence: 0.95 },
  { match: /theater|cinema|amc|regal/i, bucket: 'entertainment', confidence: 0.9 },

  // Social Media Premium
  { match: /x premium/i, bucket: 'personal_ai', confidence: 0.85 },

  // VR/Tech
  { match: /oculus/i, bucket: 'personal_ai', confidence: 0.8 },

  // Utilities & Bills
  { match: /verizon|at&t|t-mobile|sprint/i, bucket: 'family', confidence: 0.95 },
  { match: /electric|gas|water|power|energy/i, bucket: 'family', confidence: 0.9 },
  { match: /insurance|geico|state farm|allstate/i, bucket: 'family', confidence: 0.95 },

  // Transportation
  { match: /uber|lyft|taxi|shell|chevron|exxon|mobil|gas station/i, bucket: 'family', confidence: 0.8 },

  // Legal (personal)
  { match: /moody brown law/i, bucket: 'family', project: 'legal', confidence: 0.95 },

  // Unknown patterns (low confidence)
  { match: /paypal|venmo|zelle|cash app/i, bucket: 'other', confidence: 0.3 },
];

export function classify(row: TxnRow): TxnRow {
  // If already classified with high confidence, don't override
  if (row.bucket && row.bucket !== 'unknown' && (row.confidence ?? 0) > 0.8) {
    return row;
  }

  // First check the JSON vendor rules file (user-defined overrides)
  const jsonRule = applyRule(row.vendor);
  if (jsonRule && jsonRule.bucket) {
    return {
      ...row,
      bucket: jsonRule.bucket,
      project: jsonRule.project ?? row.project,
      reimbursable: jsonRule.reimbursable ?? row.reimbursable,
      confidence: Math.min((row.confidence ?? 0) + (jsonRule.confidenceBoost ?? 0.15), 0.95),
      status: 'classified'
    };
  }

  // Fall back to regex-based rules
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
