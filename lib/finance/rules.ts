import { TxnRow } from './store';
import { applyRule } from './vendorRules';

// Enhanced vendor classification rules
// Pattern: { match: RegExp, bucket: string, project?: string, reimbursable?: boolean, confidence?: number }
const vendorRules: { match: RegExp; bucket: string; project?: string; reimbursable?: boolean; confidence?: number }[] = [
  // ========================================
  // EXCLUSIONS - CHECK THESE FIRST!
  // Banking, transfers, payments - NEVER reimbursable
  // ========================================
  { match: /mobile\s*banking|funds\s*transfer|online\s*banking|bank\s*transfer/i, bucket: 'banking_transfer', reimbursable: false, confidence: 0.99 },
  { match: /ach\s*(pmt|payment|transfer|debit|credit)|wire\s*transfer/i, bucket: 'banking_transfer', reimbursable: false, confidence: 0.99 },
  { match: /amex\s*(epayment|payment|autopay)|american\s*express\s*pmt/i, bucket: 'credit_card_payment', reimbursable: false, confidence: 0.99 },
  { match: /chase\s*(card|credit|payment)|discover\s*(card|payment)|capital\s*one\s*pmt/i, bucket: 'credit_card_payment', reimbursable: false, confidence: 0.99 },
  { match: /^venmo$/i, bucket: 'p2p_transfer', reimbursable: false, confidence: 0.95 },
  { match: /venmo\s*(transfer|cashout|payment|deposit)|paypal\s*(transfer|instant)/i, bucket: 'p2p_transfer', reimbursable: false, confidence: 0.95 },
  { match: /zelle\s*(send|transfer|payment)|cash\s*app\s*(transfer|cashout)/i, bucket: 'p2p_transfer', reimbursable: false, confidence: 0.95 },
  { match: /kraken|coinbase|binance|crypto|bitcoin|ethereum/i, bucket: 'crypto', reimbursable: false, confidence: 0.95 },
  { match: /progressive\s*ins|farmers\s*ins|insurance\s*prem|auto\s*ins|home\s*ins/i, bucket: 'insurance', reimbursable: false, confidence: 0.95 },
  { match: /mortgage|loan\s*pmt|student\s*loan|auto\s*loan/i, bucket: 'loan_payment', reimbursable: false, confidence: 0.99 },
  { match: /interest\s*(charge|payment)|finance\s*charge|late\s*fee/i, bucket: 'fee', reimbursable: false, confidence: 0.99 },
  { match: /atm\s*(withdrawal|deposit)|cash\s*advance/i, bucket: 'cash', reimbursable: false, confidence: 0.99 },
  { match: /transfer\s*to\s*(checking|savings)|internal\s*transfer/i, bucket: 'banking_transfer', reimbursable: false, confidence: 0.99 },
  { match: /bill\s*pay\s*(auto|online)|autopay/i, bucket: 'bill_payment', reimbursable: false, confidence: 0.9 },
  { match: /dividend|interest\s*earned|rebate|cashback\s*reward/i, bucket: 'income', reimbursable: false, confidence: 0.95 },
  { match: /mobile\s*payment|payment\s*-?\s*thank\s*you|internet\s*payment/i, bucket: 'credit_card_payment', reimbursable: false, confidence: 0.99 },
  { match: /items?\s*deposited|check\s*deposit|branch\s*deposit/i, bucket: 'banking_transfer', reimbursable: false, confidence: 0.99 },
  { match: /automatic\s*withdrawal|auto\s*withdrawal/i, bucket: 'banking_transfer', reimbursable: false, confidence: 0.99 },

  // ========================================
  // PERSONAL EXPENSES - NOT reimbursable
  // These are personal subscriptions/services
  // ========================================
  { match: /starlink/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /adobe|creative\s*cloud/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /netlify/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /turboscribe/i, bucket: 'personal_ai', reimbursable: false, confidence: 0.95 },
  { match: /windsurf|windsurfing|shoreline/i, bucket: 'personal_ai', reimbursable: false, confidence: 0.95 },
  { match: /linktree|linktr\.ee/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /ring\s*(plan|basic|protect)|ring\.com/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /g\s*suite|gsuite|google\s*workspace/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /grammarly/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /linkedin\s*premium|linkedin/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /apple\s*store|app\s*store|itunes/i, bucket: 'personal', reimbursable: false, confidence: 0.95 },
  { match: /beanie|coffee\s*shop/i, bucket: 'family', reimbursable: false, confidence: 0.9 },
  { match: /post\s*office|usps/i, bucket: 'personal', reimbursable: false, confidence: 0.9 },
  { match: /fast\s*gas|fastgas/i, bucket: 'family', reimbursable: false, confidence: 0.9 },
  { match: /bangerter/i, bucket: 'family', reimbursable: false, confidence: 0.9 },

  // ========================================
  // AI/ML Services - Work reimbursable (UTLYZE ONLY)
  // ========================================
  { match: /openai|chatgpt\s*subscr/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /anthropic|claude\.ai/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /xai\s*llc|x\.ai/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /openrouter|elevenlabs|replicate|huggingface/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /cohere|together\.ai|perplexity|runway|midjourney/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /cursor|cursor\.com|cursor\s*ai|cursor\s*usage/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /lovable|lovable\.dev/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /manus\s*ai|opus\s*clip/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.95 },
  { match: /heygen|gamma\.app|gamma/i, bucket: 'work_reimbursable', project: 'marketing', reimbursable: true, confidence: 0.9 },
  // Additional AI services from expense reports
  { match: /flowstate|flowstategenaipi/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.9 },
  { match: /moonshot\s*ai/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.9 },
  { match: /wispr/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.85 },
  { match: /klingai|kling\s*ai/i, bucket: 'work_reimbursable', project: 'marketing', reimbursable: true, confidence: 0.8 },
  { match: /ai\s*mad\s*fzco/i, bucket: 'work_reimbursable', project: 'ai_rnd', reimbursable: true, confidence: 0.8 },
  { match: /ecamm/i, bucket: 'work_reimbursable', project: 'marketing', reimbursable: true, confidence: 0.85 },
  { match: /podbean/i, bucket: 'work_reimbursable', project: 'marketing', reimbursable: true, confidence: 0.85 },
  { match: /google\s*cloud/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },

  // SaaS/Productivity Tools - Work (may or may not be reimbursable)
  { match: /notion|linear|zoom|github|gitlab/i, bucket: 'work_reimbursable', reimbursable: true, confidence: 0.9 },
  { match: /vercel|heroku|aws|amazon web services|digitalocean/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },
  { match: /supabase|clerk\.com|plaid|zep|ngrok|paddle/i, bucket: 'work_reimbursable', project: 'infrastructure', reimbursable: true, confidence: 0.9 },
  { match: /figma|canva/i, bucket: 'work_reimbursable', project: 'design', reimbursable: true, confidence: 0.85 },

  // Sales/Outreach Tools - Work reimbursable
  { match: /apollo\.io|instantly|zapmail|growthlead/i, bucket: 'work_reimbursable', project: 'outreach', reimbursable: true, confidence: 0.95 },

  // Company expenses
  { match: /vuplicity/i, bucket: 'work_reimbursable', project: 'company', reimbursable: true, confidence: 0.95 },
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
