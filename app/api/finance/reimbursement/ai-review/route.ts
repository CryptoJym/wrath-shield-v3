import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import {
  getCycleTransactions,
  updateTransactionMeta,
  TransactionMetaUpdate,
} from '@/lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

type ReviewResult = {
  id: string;
  vendor: string;
  amount: number;
  decision: {
    reimbursable: boolean;
    company: string | null;
    assignee: string | null;
    rationale: string;
  };
  updated: boolean;
};

/**
 * POST /api/finance/reimbursement/ai-review
 *
 * AI reviews all transactions in a cycle and makes reimbursement decisions
 * Body: { cycleStart: string, cycleEnd: string, dryRun?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json();

    const { cycleStart, cycleEnd, dryRun = false } = body;

    if (!cycleStart || !cycleEnd) {
      return NextResponse.json({ error: 'cycleStart and cycleEnd are required' }, { status: 400 });
    }

    // Get API key
    const openaiKey = process.env.OPENAI_API_KEY;
    const orKey = process.env.OPENROUTER_API_KEY;
    const xaiKey = process.env.XAI_API_KEY;
    const apiKey = openaiKey || orKey || xaiKey;

    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 500 });
    }

    const useOpenAI = !!openaiKey;
    const useOpenRouter = !useOpenAI && !!orKey;

    // Fetch all transactions for the cycle (pass undefined to get all users' transactions)
    // The finance DB usually has transactions stored under 'default' or specific email
    const transactions = getCycleTransactions(cycleStart, cycleEnd);

    console.log(`[AI Review] Found ${transactions.length} transactions for cycle ${cycleStart} to ${cycleEnd}`);

    if (!transactions.length) {
      return NextResponse.json({
        success: true,
        message: 'No transactions in cycle',
        reviewed: 0,
        updated: 0,
        debug: { userId, cycleStart, cycleEnd },
      });
    }

    // Build context with historical patterns
    const systemPrompt = `You are an AI expense reviewer for Utlyze/James Brady's AI R&D reimbursement tracking.

Your job is to review transactions and decide:
1. Is this reimbursable? (true/false)
2. Which company should it be billed to? (UTLYZE, VUPLICITY, SOLUTION_STREAM, NEW_REWARD, KAHOA, or null for personal)
3. Who should be assigned? (James Brady, Josh Smith, Cody Vincent, Carl, or null)

REIMBURSABLE CRITERIA:
- AI/SaaS tools: OpenAI, Anthropic, Claude, Cursor, Windsurf, Vercel, GitHub, Supabase, etc. → REIMBURSABLE
- Cloud infrastructure: AWS, GCP, Railway, Fly.io, DigitalOcean → REIMBURSABLE
- Sales/marketing tools: Apollo, Instantly, Growthlead → REIMBURSABLE (usually VUPLICITY or NEW_REWARD)
- Developer tools: ngrok, Postman, JetBrains, GitHub → REIMBURSABLE
- Internet service for work (Starlink): → REIMBURSABLE (split between companies)
- Work meals/McDonald's near office → REIMBURSABLE (small amounts)
- Client-related expenses → REIMBURSABLE

NOT REIMBURSABLE:
- Personal streaming: Netflix, Spotify, Disney+ → NOT REIMBURSABLE
- Family groceries: Harmons, grocery stores → NOT REIMBURSABLE
- Personal gas not for work travel → NOT REIMBURSABLE
- Personal Amazon purchases (general household) → NOT REIMBURSABLE unless clearly work-related
- Apple.com/bill for personal subscriptions → NOT REIMBURSABLE
- Fund transfers between personal accounts → NOT REIMBURSABLE

COMPANY ASSIGNMENT RULES:
- FCRA/Background check related: VUPLICITY
- AI research and development: UTLYZE
- Consulting/client work: SOLUTION_STREAM
- New Reward projects: NEW_REWARD
- Kahoa work: KAHOA
- If AI/SaaS tool and no specific project: UTLYZE (default for AI R&D)

SPECIAL NOTES:
- Starlink is work internet, always reimbursable, assign to UTLYZE
- Claude.ai charges are always reimbursable (AI development)
- OpenAI charges are always reimbursable (AI development)
- GitHub is always reimbursable (development infrastructure)
- Vercel is always reimbursable (deployment infrastructure)
- HeyGen is AI video tool - reimbursable
- Suno is AI music tool - reimbursable if for content creation
- xAI/Grok is reimbursable (AI research)
- Ngrok is dev tool - reimbursable
- Lovable is AI coding tool - reimbursable

Output JSON array with decisions for each transaction.`;

    // Process in batches of 20
    const batchSize = 20;
    const results: ReviewResult[] = [];
    let totalUpdated = 0;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      const batchPrompt = batch.map((t, idx) => {
        return `${idx + 1}. ID: ${t.id}
   Vendor: ${t.vendor || 'Unknown'}
   Amount: $${t.amount?.toFixed(2) || 0}
   Date: ${t.date}
   Current bucket: ${t.bucket}
   Current reimbursable: ${t.reimbursable}
   Usage note: ${t.usage_note || 'none'}`;
      }).join('\n\n');

      const userPrompt = `Review ALL ${batch.length} transactions below and provide a decision for EACH ONE. You MUST return exactly ${batch.length} decisions.

${batchPrompt}

IMPORTANT: Return a JSON object with a "decisions" array containing EXACTLY ${batch.length} items - one for each transaction listed above. Use the exact transaction ID from each entry.

Response format:
{
  "decisions": [
    {
      "id": "exact_transaction_id_from_above",
      "reimbursable": true,
      "company": "UTLYZE",
      "assignee": "James Brady",
      "rationale": "AI development tool"
    },
    ... (${batch.length - 1} more items)
  ]
}`;

      const model = useOpenAI ? (process.env.OPENAI_MODEL || 'gpt-4o') : (process.env.OPENROUTER_MODEL || 'x-ai/grok-4-1-fast');
      const url = useOpenAI ? OPENAI_URL : (useOpenRouter ? OR_URL : XAI_URL);

      try {
        console.log(`[AI Review] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transactions.length / batchSize)} (${batch.length} txns) via ${model} at ${url}`);

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(useOpenRouter ? { 'HTTP-Referer': 'wrath-shield-v3', 'X-Title': 'ai-expense-reviewer' } : {}),
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => 'unknown');
          console.error(`[AI Review] LLM error: ${resp.status} - ${errText.substring(0, 200)}`);
          continue;
        }

        const data = await resp.json();
        const text = data?.choices?.[0]?.message?.content || '[]';
        console.log(`[AI Review] Raw LLM response: ${text.substring(0, 500)}`);

        // Parse response - handle multiple formats
        let decisions: any[];
        try {
          const parsed = JSON.parse(text);
          console.log(`[AI Review] Parsed type: isArray=${Array.isArray(parsed)}, keys: ${Object.keys(parsed).slice(0, 8).join(', ')}`);

          if (Array.isArray(parsed)) {
            // Direct array of decisions
            decisions = parsed;
          } else if (parsed.decisions || parsed.transactions || parsed.results || parsed.items) {
            // Wrapped in a container object
            decisions = parsed.decisions || parsed.transactions || parsed.results || parsed.items || [];
          } else if (parsed.id && 'reimbursable' in parsed) {
            // Single decision object - wrap in array
            decisions = [parsed];
            console.log('[AI Review] LLM returned single decision, wrapping in array');
          } else {
            // Unknown format
            console.warn(`[AI Review] Unknown response format: ${JSON.stringify(parsed).substring(0, 200)}`);
            decisions = [];
          }

          console.log(`[AI Review] Batch ${Math.floor(i / batchSize) + 1} - parsed ${decisions.length} decisions from LLM`);
          if (decisions.length > 0) {
            console.log(`[AI Review] Sample decision: ${JSON.stringify(decisions[0]).substring(0, 200)}`);
          }
        } catch (parseErr) {
          console.error(`[AI Review] Parse error: ${parseErr}. Response: ${text.substring(0, 300)}`);
          continue;
        }

        // Process decisions
        for (const decision of decisions) {
          const txn = batch.find(t => t.id === decision.id);
          if (!txn) continue;

          const result: ReviewResult = {
            id: decision.id,
            vendor: txn.vendor || 'Unknown',
            amount: txn.amount || 0,
            decision: {
              reimbursable: decision.reimbursable,
              company: decision.company,
              assignee: decision.assignee || 'James Brady',
              rationale: decision.rationale || '',
            },
            updated: false,
          };

          // Apply updates if not dry run
          if (!dryRun && decision.reimbursable !== undefined) {
            const updates: TransactionMetaUpdate = {
              reimbursable: decision.reimbursable,
            };

            if (decision.reimbursable && decision.company) {
              updates.company = decision.company;
            }

            if (decision.reimbursable && decision.assignee) {
              updates.assignee = decision.assignee;
            }

            const updated = updateTransactionMeta(decision.id, updates, userId, 'ai-review');
            result.updated = !!updated;
            if (updated) totalUpdated++;
          }

          results.push(result);
        }
      } catch (e) {
        console.error('[AI Review] Batch error:', e);
      }
    }

    // Summarize results
    const summary = {
      reimbursable: results.filter(r => r.decision.reimbursable).length,
      nonReimbursable: results.filter(r => !r.decision.reimbursable).length,
      byCompany: {} as Record<string, { count: number; total: number }>,
    };

    results.filter(r => r.decision.reimbursable).forEach(r => {
      const company = r.decision.company || 'Unassigned';
      if (!summary.byCompany[company]) {
        summary.byCompany[company] = { count: 0, total: 0 };
      }
      summary.byCompany[company].count++;
      summary.byCompany[company].total += r.amount;
    });

    return NextResponse.json({
      success: true,
      dryRun,
      cycle: { start: cycleStart, end: cycleEnd },
      reviewed: results.length,
      updated: totalUpdated,
      summary,
      results: results.slice(0, 50), // Return first 50 for preview
      message: dryRun
        ? `DRY RUN: Would update ${summary.reimbursable} as reimbursable, ${summary.nonReimbursable} as non-reimbursable`
        : `Updated ${totalUpdated} transactions. ${summary.reimbursable} reimbursable, ${summary.nonReimbursable} non-reimbursable.`,
    });
  } catch (e: any) {
    console.error('[AI Review] Error:', e);
    return NextResponse.json({ error: e.message || 'AI review failed' }, { status: 500 });
  }
}
