/**
 * Store historical expense classification learnings in Finance Agent's Zep memory
 *
 * This script records knowledge from historical expense reports:
 * - Jul 7 - Aug 8, 2025 (CSV): $3,514.20
 * - Aug 8 - Sep 8, 2025 (XLSX): $2,564.56
 * - Apr 9 - Jul 7, 2025 (XLSX): $11,466.77
 */

import { addAgentMemory } from '../lib/memory/zep';

const FINANCE_AGENT: 'finance-agent' = 'finance-agent';

interface HistoricalPeriod {
  period: string;
  startDate: string;
  endDate: string;
  totalReimbursable: number;
  vendors: { name: string; amount?: number; project: string; notes?: string }[];
}

const historicalPeriods: HistoricalPeriod[] = [
  {
    period: 'Apr 9 - Jul 7, 2025',
    startDate: '2025-04-09',
    endDate: '2025-07-07',
    totalReimbursable: 11466.77,
    vendors: [
      { name: 'OpenAI', amount: 5047.72, project: 'ai_rnd', notes: 'Multiple ChatGPT subscriptions and API' },
      { name: 'Anthropic/Claude', amount: 859.60, project: 'ai_rnd', notes: 'Claude subscriptions' },
      { name: 'Vercel', amount: 408.00, project: 'infrastructure', notes: 'Website hosting' },
      { name: 'GitHub', amount: 156.05, project: 'infrastructure', notes: 'Code hosting + Copilot' },
      { name: 'Perplexity', amount: 322.56, project: 'ai_rnd', notes: 'Deep research' },
      { name: 'Supabase', amount: 115.17, project: 'infrastructure', notes: 'Database hosting' },
      { name: 'Cursor', amount: 93.03, project: 'ai_rnd', notes: 'AI IDE' },
      { name: 'Windsurf', amount: 31.51, project: 'ai_rnd', notes: 'AI IDE' },
      { name: 'CodeGuide', amount: 16.00, project: 'ai_rnd', notes: 'Code documentation' },
      { name: 'Luma Dream Machine', amount: 149.99, project: 'ai_rnd', notes: 'AI video generation' },
      { name: 'Kling AI', amount: 92.00, project: 'ai_rnd', notes: 'Video generation' },
      { name: 'Embedchain', amount: 21.90, project: 'ai_rnd', notes: 'RAG framework' },
      { name: 'LinkedIn Sales Navigator', amount: 192.46, project: 'outreach', notes: 'Sales prospecting' },
      { name: 'GoDaddy', amount: 18.17, project: 'infrastructure', notes: 'Domain registration' },
      { name: 'Limitless Pendant', amount: 169.00, project: 'hardware', notes: 'AI wearable device' },
    ]
  },
  {
    period: 'Jul 7 - Aug 8, 2025',
    startDate: '2025-07-07',
    endDate: '2025-08-08',
    totalReimbursable: 3514.20, // Note: KlingAI ($92) was removed from total
    vendors: [
      { name: 'OpenAI', amount: 880.19, project: 'ai_rnd', notes: 'ChatGPT subscriptions for team' },
      { name: 'Anthropic/Claude', amount: 644.70, project: 'ai_rnd', notes: 'Provides Cody, Carl, James access to Opus 4.1' },
      { name: 'Google Cloud', amount: 284.57, project: 'ai_rnd', notes: 'Gemini LLM API' },
      { name: 'Perplexity', amount: 322.56, project: 'ai_rnd', notes: 'Comet Browser deep research' },
      { name: 'XAI/Grok', amount: 522.00, project: 'ai_rnd', notes: 'Grok 4 and Grok 4 Heavy API' },
      { name: 'OpenRouter', amount: 105.93, project: 'ai_rnd', notes: 'Josh Smith API key' },
      { name: 'Moonshot/Kimi', amount: 202.00, project: 'ai_rnd', notes: 'Kimi2 API access' },
      { name: 'Vercel', amount: 100.00, project: 'infrastructure', notes: 'Hosting for Josh, James, and Utlyze systems' },
      { name: 'GitHub', amount: 96.26, project: 'infrastructure', notes: 'Full GitHub bill including Copilot' },
      { name: 'HeyGen', amount: 128.00, project: 'marketing', notes: 'CGI avatars for marketing' },
      { name: 'Opus Clip', amount: 29.00, project: 'marketing', notes: 'Automatic video clipping' },
      { name: 'Lovable', amount: 25.00, project: 'ai_rnd', notes: 'Frontend building' },
      { name: 'Cursor', amount: 21.69, project: 'ai_rnd', notes: 'AI IDE' },
      { name: 'Supabase', amount: 38.39, project: 'infrastructure', notes: 'Database hosting' },
      { name: 'Notion', amount: 25.79, project: 'productivity', notes: 'Database for project management' },
      { name: 'Podbean', amount: 41.91, project: 'marketing', notes: 'AI-powered podcast hosting' },
      { name: 'Wispr', amount: 15.00, project: 'ai_rnd', notes: 'Voice-to-text conversion' },
    ]
  },
  {
    period: 'Aug 8 - Sep 8, 2025',
    startDate: '2025-08-08',
    endDate: '2025-09-08',
    totalReimbursable: 2564.56,
    vendors: [
      { name: 'OpenAI', amount: 429.80, project: 'ai_rnd', notes: 'ChatGPT Pro subscriptions' },
      { name: 'Anthropic/Claude', amount: 644.70, project: 'ai_rnd', notes: 'Team Claude subscriptions' },
      { name: 'Perplexity', amount: 107.45, project: 'ai_rnd', notes: 'Deep research' },
      { name: 'Cursor', amount: 58.02, project: 'ai_rnd', notes: 'AI IDE subscriptions' },
      { name: 'HeyGen', amount: 99.00, project: 'marketing', notes: 'AI avatars' },
      { name: 'Suno', amount: 96.00, project: 'ai_rnd', notes: 'AI music generation' },
      { name: 'Google Cloud', amount: 202.91, project: 'ai_rnd', notes: 'Gemini API' },
      { name: 'Vercel', amount: 60.00, project: 'infrastructure', notes: 'Hosting' },
      { name: 'Supabase', amount: 25.00, project: 'infrastructure', notes: 'Database' },
      { name: 'GitHub', amount: 30.00, project: 'infrastructure', notes: 'Team access' },
      { name: 'Wispr', amount: 15.00, project: 'ai_rnd', notes: 'Voice-to-text' },
      { name: 'Notion', amount: 25.79, project: 'productivity', notes: 'Project management' },
    ]
  }
];

// Classification patterns learned from historical data
const classificationPatterns = [
  // AI/ML Services - Always reimbursable for Utlyze
  'OpenAI subscriptions and API usage are work_reimbursable under ai_rnd project',
  'Claude/Anthropic subscriptions provide team access to Opus 4.1 at reduced costs - work_reimbursable',
  'Google Cloud charges labeled G.CO/HELPPAY are Gemini LLM API costs - work_reimbursable ai_rnd',
  'XAI/Grok charges are for Grok 4 API access - work_reimbursable ai_rnd',
  'Moonshot AI/Kimi charges are for Kimi2 model API - work_reimbursable ai_rnd',
  'Perplexity provides deep research capability for Comet Browser - work_reimbursable ai_rnd',
  'OpenRouter provides LLM routing API access for team members - work_reimbursable ai_rnd',

  // AI Tools - Always reimbursable
  'Cursor is an AI-powered IDE for development - work_reimbursable ai_rnd',
  'Windsurf is an AI-powered IDE alternative - work_reimbursable ai_rnd',
  'Lovable is an AI frontend building tool - work_reimbursable ai_rnd',
  'Wispr/Wisprflow is voice-to-text AI for productivity - work_reimbursable ai_rnd',
  'Suno is AI music generation for content creation - work_reimbursable ai_rnd',

  // Video/Marketing AI
  'HeyGen provides CGI avatars for marketing videos - work_reimbursable marketing',
  'Opus Clip is automatic video clipping for content - work_reimbursable marketing',
  'Luma Dream Machine is AI video generation - work_reimbursable ai_rnd',
  'Kling AI is video generation (note: sometimes removed from totals) - work_reimbursable ai_rnd',

  // Infrastructure
  'Vercel hosts Utlyze websites and Vuplicity applications - work_reimbursable infrastructure',
  'Supabase is database hosting for applications - work_reimbursable infrastructure',
  'GitHub includes repository hosting and Copilot subscriptions - work_reimbursable infrastructure',
  'GoDaddy is for domain registration - work_reimbursable infrastructure',

  // Productivity
  'Notion is database for project management - work_reimbursable productivity',
  'Podbean is AI-powered podcast hosting platform - work_reimbursable marketing',

  // Hardware
  'Limitless Pendant is an AI wearable device for research - work_reimbursable hardware',

  // Sales/Outreach
  'LinkedIn Sales Navigator is for sales prospecting - work_reimbursable outreach',

  // Key insights
  'Reimbursement cycle runs 8th to 8th of each month',
  'Team members receiving subscriptions: James, Josh Smith, Cody, Carl',
  'Some charges like KlingAI may be removed from totals - check notes',
  'Google Cloud billing shows as G.CO/HELPPAY# in bank statements',
];

async function storeLearnings() {
  console.log('Storing finance agent learnings in Zep memory...\n');

  // Store historical period summaries
  for (const period of historicalPeriods) {
    const text = `Historical Expense Report: ${period.period}
Total Reimbursable: $${period.totalReimbursable.toLocaleString()}
Date Range: ${period.startDate} to ${period.endDate}

Top Vendors:
${period.vendors.slice(0, 10).map(v => `- ${v.name}: $${v.amount?.toLocaleString() || 'N/A'} (${v.project})${v.notes ? ` - ${v.notes}` : ''}`).join('\n')}`;

    try {
      await addAgentMemory(FINANCE_AGENT, text, {
        type: 'historical_report',
        period: period.period,
        startDate: period.startDate,
        endDate: period.endDate,
        totalReimbursable: period.totalReimbursable,
        vendorCount: period.vendors.length,
        source: 'historical_expense_csv_xlsx',
      });
      console.log(`✓ Stored: ${period.period} ($${period.totalReimbursable.toLocaleString()})`);
    } catch (error) {
      console.error(`✗ Failed to store ${period.period}:`, error);
    }
  }

  console.log('\nStoring classification patterns...\n');

  // Store classification patterns
  for (const pattern of classificationPatterns) {
    try {
      await addAgentMemory(FINANCE_AGENT, pattern, {
        type: 'classification_pattern',
        source: 'historical_analysis',
        learnedFrom: 'expense_reports_apr_sep_2025',
      });
      console.log(`✓ Pattern: ${pattern.substring(0, 60)}...`);
    } catch (error) {
      console.error(`✗ Failed to store pattern:`, error);
    }
  }

  console.log('\nStoring vendor-specific learnings...\n');

  // Store detailed vendor learnings
  const vendorLearnings = [
    { vendor: 'OpenAI', pattern: 'OpenAI ChatGPT subscriptions are $214.90/month pro, $21.49/month basic. API usage varies. All are work_reimbursable under ai_rnd.' },
    { vendor: 'Anthropic', pattern: 'Claude subscriptions at $214.90/month provide Opus 4.1 access at reduced costs. Team members: James, Cody, Carl. work_reimbursable ai_rnd.' },
    { vendor: 'Google Cloud', pattern: 'Google Cloud charges appear as "GOOGLE *CLOUD" with codes like J9HR4Z, MZPZRM. G.CO/HELPPAY# is the billing descriptor. Used for Gemini LLM API. work_reimbursable ai_rnd.' },
    { vendor: 'Vercel', pattern: 'Vercel charges range $40-$100/month. Hosts Josh, James, and Utlyze websites/systems. work_reimbursable infrastructure.' },
    { vendor: 'XAI', pattern: 'XAI/X.AI charges are for Grok 4 ($222) and Grok 4 Heavy ($300) API access. work_reimbursable ai_rnd.' },
    { vendor: 'HeyGen', pattern: 'HeyGen charges for CGI avatars for marketing. Typical charges $29-$99/month. work_reimbursable marketing.' },
    { vendor: 'Cursor', pattern: 'Cursor AI IDE charges vary by usage ($21-58/month). work_reimbursable ai_rnd.' },
  ];

  for (const learning of vendorLearnings) {
    try {
      await addAgentMemory(FINANCE_AGENT, learning.pattern, {
        type: 'vendor_learning',
        vendor: learning.vendor,
        source: 'historical_analysis',
      });
      console.log(`✓ Vendor: ${learning.vendor}`);
    } catch (error) {
      console.error(`✗ Failed to store ${learning.vendor}:`, error);
    }
  }

  console.log('\n✅ Finance agent learnings stored in Zep memory');
  console.log('The finance agent can now reference this historical data for classification decisions.');
}

storeLearnings().catch(console.error);
