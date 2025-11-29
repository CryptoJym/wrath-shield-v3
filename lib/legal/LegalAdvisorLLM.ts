/**
 * Legal Advisor LLM Client
 *
 * Uses OpenRouter with GPT-5.1 (primary) or Grok-4.1 (fallback) for real legal reasoning.
 * Integrates with Mem0/MemoryWrapper for persistent case memory.
 *
 * NOW INTEGRATED WITH LIFE OS CONFIG:
 * - Loads system prompt from agent.legal config
 * - Integrates Vuplicity domain context for FCRA-related matters
 * - Applies escalation rules from Life Charter
 */

import { ensureServerOnly } from '../server-only-guard';
import { addMemory, searchMemories, getAllMemories } from '../MemoryWrapper';
import {
  getAgent,
  getDomain,
  getLifeCharter,
  determineEscalationLevel,
} from '../life-os-config';

ensureServerOnly('lib/legal/LegalAdvisorLLM');

// Models from OpenRouter (verified available)
const PRIMARY_MODEL = 'x-ai/grok-4.1-fast'; // Grok 4.1 - fast reasoning
const FALLBACK_MODEL = 'openai/gpt-4.1'; // GPT-4.1 fallback
const RESEARCH_MODEL = 'x-ai/grok-4'; // For deep research

export interface LegalContext {
  caseNumber: string;
  nextHearing: { date: string; time: string } | null;
  judge: string | null;
  parties: Array<{ type: string; name: string; attorney: string | null }>;
  recentEmails: Array<{ from: string; subject: string; snippet: string; date: string }>;
  recentTexts: Array<{ text: string; date: string; from: string }>;
  timeline: Array<{ date: string; source: string; type: string; description: string }>;
  strategicBrief: any | null;
}

export interface DailyBriefItem {
  id: string;
  category: 'urgent' | 'opportunity' | 'warning';
  title: string;
  description: string;
  evidence: Array<{ type: string; source: string; snippet: string; date: string }>;
  utahLawRef?: string;
  action?: string;
}

export interface DailyBrief {
  generatedAt: string;
  caseNumber: string;
  nextHearing: { date: string; time: string } | null;
  urgent: DailyBriefItem[];
  opportunities: DailyBriefItem[];
  warnings: DailyBriefItem[];
  summary: string;
}

export interface ChatResponse {
  response: string;
  reasoning?: string;
  suggestedActions: string[];
  evidenceUsed: Array<{ type: string; source: string; snippet: string }>;
  memoryUpdated: boolean;
}

// Fallback prompt if Life OS config is unavailable
const FALLBACK_LEGAL_PROMPT = `You are the Legal Advocate AI for James Brady's custody case (Case #164400524, Fourth Judicial District, Provo, Utah).

ROLE: Act as an experienced family-law attorney's analytical brain. You have full access to:
- Court filings and docket information
- Email communications with opposing counsel (Zack Starr) and ex-wife (Destiny)
- Text message history
- Case timeline and evidence

CRITICAL - TEMPORAL AWARENESS:
- The context below includes TODAY'S DATE. Use it to calculate how old each piece of evidence is.
- NEVER say "recent" without verifying the actual date relative to today.
- If data is more than 30 days old, explicitly note this as STALE/HISTORICAL.
- When citing evidence, ALWAYS include the actual date AND how long ago that was.
- If you see a "DATA STALENESS WARNING", prominently acknowledge this limitation in your analysis.

YOUR RESPONSIBILITIES:
1. Analyze communications for tone, risks, and opportunities
2. Identify deadline and compliance issues
3. Spot patterns that could be used strategically
4. Ground advice in Utah Title 81 (Domestic Relations Code) when applicable
5. Help draft professional, strategic responses

KEY UTAH LAW REFERENCES:
- § 81-9-202: Best interest of child factors
- § 81-9-206: Parent-time schedules
- § 81-9-302/304: Modification standards

CONSTRAINTS:
- You provide legal INFORMATION, not legal ADVICE (UPL compliance)
- Always recommend consulting with attorney Zack Starr for final decisions
- Flag any communications that could be admissions or harmful
- Maintain professional, factual analysis
- BE PRECISE ABOUT DATES - never claim old data is current

CURRENT CASE STATUS:
- Judge: Derek P. Pullan
- James's Attorney: Zachary Starr (Moody Brown)
- Destiny's Attorneys: Brian Arnold, William Penrod
- Child: Hyro

When responding, structure your analysis clearly and link back to specific evidence WITH DATES.`;

/**
 * Get the legal system prompt from Life OS config
 * Falls back to hardcoded prompt if config is unavailable
 */
function getLegalSystemPrompt(): string {
  try {
    const legalAgent = getAgent('agent.legal');
    const charter = getLifeCharter();
    const vuplicity = getDomain('vuplicity'); // For FCRA context

    if (legalAgent) {
      let prompt = legalAgent.system_prompt;

      // Add Vuplicity/FCRA context if relevant
      if (vuplicity) {
        prompt += `\n\nFCRA/COMPLIANCE CONTEXT (Vuplicity Domain):
Domain: ${vuplicity.name}
Type: ${vuplicity.type}
Sensitivity: ${vuplicity.sensitivity_level || 'standard'}
Description: ${vuplicity.description}
Key People: ${vuplicity.key_people.join(', ')}

When handling FCRA-related matters, this is a HIGH COMPLIANCE domain requiring extra caution.`;
      }

      // Add escalation awareness from Life Charter
      if (charter) {
        prompt += `\n\nESCALATION FRAMEWORK:
- CRITICAL (${charter.escalation_levels.CRITICAL.response_time}): ${charter.escalation_levels.CRITICAL.triggers.join(', ')}
- PROPOSE (${charter.escalation_levels.PROPOSE.response_time}): ${charter.escalation_levels.PROPOSE.triggers.join(', ')}
- AUTO_EXECUTE: Routine matters with high confidence

When detecting CRITICAL items (lawsuits, compliance violations), flag them immediately.
When proposing significant actions, clearly indicate they require user approval.`;
      }

      // Add temporal awareness section
      prompt += `\n\nCRITICAL - TEMPORAL AWARENESS:
- The context below includes TODAY'S DATE. Use it to calculate how old each piece of evidence is.
- NEVER say "recent" without verifying the actual date relative to today.
- If data is more than 30 days old, explicitly note this as STALE/HISTORICAL.
- When citing evidence, ALWAYS include the actual date AND how long ago that was.
- If you see a "DATA STALENESS WARNING", prominently acknowledge this limitation in your analysis.

When responding, structure your analysis clearly and link back to specific evidence WITH DATES.`;

      console.log('[LegalAdvisor] Using Life OS config system prompt');
      return prompt;
    }
  } catch (e) {
    console.warn('[LegalAdvisor] Failed to load Life OS config, using fallback:', e);
  }

  return FALLBACK_LEGAL_PROMPT;
}

// Cache the system prompt (reloads on server restart)
let _cachedLegalPrompt: string | null = null;
function getLegalPrompt(): string {
  if (!_cachedLegalPrompt) {
    _cachedLegalPrompt = getLegalSystemPrompt();
  }
  return _cachedLegalPrompt;
}

async function callOpenRouter(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = PRIMARY_MODEL,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://wrath-shield.com',
      'X-Title': 'Wrath Shield Legal Advisor',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenRouter response');
  }

  return content;
}

async function callWithFallback(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  try {
    return await callOpenRouter(messages, PRIMARY_MODEL, temperature, maxTokens);
  } catch (primaryError: any) {
    console.warn(`[LegalAdvisor] Primary model failed: ${primaryError.message}, trying fallback...`);
    try {
      return await callOpenRouter(messages, FALLBACK_MODEL, temperature, maxTokens);
    } catch (fallbackError: any) {
      console.error(`[LegalAdvisor] Fallback model also failed: ${fallbackError.message}`);
      throw new Error(`Both models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
    }
  }
}

/**
 * Generate a Daily Strategic Brief
 */
export async function generateDailyBrief(context: LegalContext): Promise<DailyBrief> {
  const userId = 'legal-advisor';

  // Build context summary
  const contextSummary = buildContextSummary(context);

  // Search memory for relevant past analysis
  const relevantMemories = await searchMemories('case strategy hearing custody', userId, 5);
  const memoryContext = relevantMemories.length > 0
    ? `\n\nRELEVANT PAST ANALYSIS:\n${relevantMemories.map(m => `- ${m.text}`).join('\n')}`
    : '';

  const prompt = `${contextSummary}${memoryContext}

Based on this case data, generate a Daily Strategic Brief with three categories:

1. URGENT - Items requiring immediate attention (deadlines, compliance issues, critical communications)
2. OPPORTUNITIES - Strategic advantages, favorable patterns, or openings to leverage
3. WARNINGS - Potential risks, concerning patterns, or areas needing caution

For each item, provide:
- A clear title
- Detailed description
- Specific evidence (quote sources with dates)
- Relevant Utah law citation if applicable
- Recommended action

Also provide an overall case summary (2-3 sentences).

Respond in JSON format:
{
  "urgent": [{ "title": "", "description": "", "evidence": [{"type": "", "source": "", "snippet": "", "date": ""}], "utahLawRef": "", "action": "" }],
  "opportunities": [...],
  "warnings": [...],
  "summary": ""
}`;

  const messages = [
    { role: 'system' as const, content: getLegalPrompt() },
    { role: 'user' as const, content: prompt },
  ];

  const response = await callWithFallback(messages, 0.3, 3000);

  // Parse JSON response
  let parsed: any;
  try {
    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (e) {
    console.error('[LegalAdvisor] Failed to parse brief response:', e);
    parsed = {
      urgent: [],
      opportunities: [],
      warnings: [],
      summary: response.slice(0, 500),
    };
  }

  // Save brief to memory
  await addMemory(
    `Daily Brief ${new Date().toISOString().slice(0, 10)}: ${parsed.summary}`,
    userId,
    { type: 'daily_brief', date: new Date().toISOString() }
  );

  return {
    generatedAt: new Date().toISOString(),
    caseNumber: context.caseNumber,
    nextHearing: context.nextHearing,
    urgent: (parsed.urgent || []).map((item: any, i: number) => ({ ...item, id: `urgent-${i}`, category: 'urgent' })),
    opportunities: (parsed.opportunities || []).map((item: any, i: number) => ({ ...item, id: `opp-${i}`, category: 'opportunity' })),
    warnings: (parsed.warnings || []).map((item: any, i: number) => ({ ...item, id: `warn-${i}`, category: 'warning' })),
    summary: parsed.summary || '',
  };
}

/**
 * Chat with the Legal Advisor
 */
export async function chat(
  message: string,
  context: LegalContext,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ChatResponse> {
  const userId = 'legal-advisor';

  // Search memory for relevant context
  const relevantMemories = await searchMemories(message, userId, 5);
  const memoryContext = relevantMemories.length > 0
    ? `\n\nRELEVANT MEMORIES:\n${relevantMemories.map(m => `- ${m.text}`).join('\n')}`
    : '';

  // Build context
  const contextSummary = buildContextSummary(context);

  const systemPrompt = `${getLegalPrompt()}

CURRENT CASE CONTEXT:
${contextSummary}${memoryContext}

When responding:
1. Be direct and actionable
2. Reference specific evidence when available
3. Suggest 2-3 follow-up questions or actions
4. If the user's question reveals important case info, note it for memory`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10), // Last 10 messages for context
    { role: 'user', content: message },
  ];

  const response = await callWithFallback(messages, 0.7, 1500);

  // Extract suggested actions from response
  const suggestedActions = extractSuggestedActions(response);

  // Check if we should save anything to memory
  let memoryUpdated = false;
  if (message.toLowerCase().includes('remember') ||
      message.toLowerCase().includes('important') ||
      response.toLowerCase().includes('i\'ll note that')) {
    await addMemory(
      `User context: ${message.slice(0, 200)}`,
      userId,
      { type: 'user_context', date: new Date().toISOString() }
    );
    memoryUpdated = true;
  }

  return {
    response,
    suggestedActions,
    evidenceUsed: [], // Could parse from response
    memoryUpdated,
  };
}

/**
 * Analyze a draft message before sending
 */
export async function analyzeOutgoingMessage(
  draft: string,
  recipient: string,
  context: LegalContext
): Promise<{
  riskLevel: 'low' | 'medium' | 'high';
  issues: Array<{ type: string; text: string; suggestion: string }>;
  rewriteSuggestion: string;
}> {
  const prompt = `Analyze this draft message to ${recipient} for tone, legal risks, and strategic concerns:

DRAFT:
"${draft}"

Check for:
1. Hostile or emotional language
2. Absolute statements ("never", "always")
3. Potential admissions
4. Order violations references
5. Anything that could be used against James in court

Respond in JSON:
{
  "riskLevel": "low|medium|high",
  "issues": [{"type": "...", "text": "quote from draft", "suggestion": "..."}],
  "rewriteSuggestion": "neutral professional version"
}`;

  const messages = [
    { role: 'system' as const, content: getLegalPrompt() },
    { role: 'user' as const, content: prompt },
  ];

  const response = await callWithFallback(messages, 0.2, 1500);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[LegalAdvisor] Failed to parse message analysis:', e);
  }

  return {
    riskLevel: 'medium',
    issues: [{ type: 'parse_error', text: 'Could not analyze', suggestion: 'Review manually' }],
    rewriteSuggestion: draft,
  };
}

/**
 * Temporal context helpers - ensures AI understands time properly
 */
function getTemporalContext(): { today: string; todayDate: Date; formatAge: (date: string) => string } {
  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);

  const formatAge = (dateStr: string): string => {
    if (!dateStr) return 'unknown date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const diffMs = todayDate.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'YESTERDAY';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return { today, todayDate, formatAge };
}

interface TemporalBucket<T> {
  today: T[];
  thisWeek: T[];
  thisMonth: T[];
  older: T[];
  oldestDate: string | null;
  newestDate: string | null;
}

function bucketByRecency<T extends { date: string }>(items: T[]): TemporalBucket<T> {
  const { todayDate } = getTemporalContext();
  const result: TemporalBucket<T> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
    oldestDate: null,
    newestDate: null,
  };

  for (const item of items) {
    const date = new Date(item.date);
    if (isNaN(date.getTime())) {
      result.older.push(item);
      continue;
    }

    // Track date range
    if (!result.newestDate || date > new Date(result.newestDate)) {
      result.newestDate = item.date;
    }
    if (!result.oldestDate || date < new Date(result.oldestDate)) {
      result.oldestDate = item.date;
    }

    const diffDays = Math.floor((todayDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) result.today.push(item);
    else if (diffDays < 7) result.thisWeek.push(item);
    else if (diffDays < 30) result.thisMonth.push(item);
    else result.older.push(item);
  }

  return result;
}

function buildContextSummary(context: LegalContext): string {
  const { today, formatAge } = getTemporalContext();
  const parts: string[] = [];

  // CRITICAL: Ground AI in current time
  parts.push(`=== TEMPORAL CONTEXT ===`);
  parts.push(`TODAY'S DATE: ${today}`);
  parts.push(`ANALYSIS GENERATED: ${new Date().toISOString()}`);
  parts.push(`NOTE: All dates below are ABSOLUTE. Calculate recency from today (${today}).`);

  parts.push(`\n=== CASE INFORMATION ===`);
  parts.push(`CASE: #${context.caseNumber}`);

  if (context.nextHearing) {
    const hearingDate = new Date(context.nextHearing.date.replace(/(\d{2})-(\d{2})-(\d{4})/, '$3-$1-$2'));
    const daysUntil = Math.ceil((hearingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`NEXT HEARING: ${context.nextHearing.date} at ${context.nextHearing.time} (${daysUntil > 0 ? `in ${daysUntil} days` : 'PASSED'})`);
  }

  if (context.judge) {
    parts.push(`JUDGE: ${context.judge}`);
  }

  if (context.parties.length > 0) {
    parts.push(`PARTIES:\n${context.parties.map(p => `  - ${p.type}: ${p.name}${p.attorney ? ` (Atty: ${p.attorney})` : ''}`).join('\n')}`);
  }

  // Emails with temporal bucketing
  if (context.recentEmails.length > 0) {
    const emailBuckets = bucketByRecency(context.recentEmails);
    parts.push(`\n=== EMAIL COMMUNICATIONS ===`);
    parts.push(`DATA RANGE: ${emailBuckets.oldestDate ? formatAge(emailBuckets.oldestDate) : 'N/A'} to ${emailBuckets.newestDate ? formatAge(emailBuckets.newestDate) : 'N/A'}`);

    if (emailBuckets.today.length > 0) {
      parts.push(`\n[TODAY - ${emailBuckets.today.length} emails]:`);
      emailBuckets.today.slice(0, 3).forEach(e => {
        parts.push(`  ${e.date} | ${e.from}: "${e.subject}"`);
      });
    }
    if (emailBuckets.thisWeek.length > 0) {
      parts.push(`\n[THIS WEEK - ${emailBuckets.thisWeek.length} emails]:`);
      emailBuckets.thisWeek.slice(0, 3).forEach(e => {
        parts.push(`  ${e.date} (${formatAge(e.date)}) | ${e.from}: "${e.subject}"`);
      });
    }
    if (emailBuckets.thisMonth.length > 0) {
      parts.push(`\n[THIS MONTH - ${emailBuckets.thisMonth.length} emails]:`);
      emailBuckets.thisMonth.slice(0, 2).forEach(e => {
        parts.push(`  ${e.date} (${formatAge(e.date)}) | ${e.from}: "${e.subject}"`);
      });
    }
    if (emailBuckets.older.length > 0) {
      parts.push(`\n[OLDER - ${emailBuckets.older.length} emails] (oldest: ${emailBuckets.oldestDate})`);
    }

    if (emailBuckets.today.length === 0 && emailBuckets.thisWeek.length === 0 && emailBuckets.thisMonth.length === 0) {
      parts.push(`⚠️ WARNING: No emails from last 30 days. Most recent: ${emailBuckets.newestDate} (${formatAge(emailBuckets.newestDate || '')})`);
    }
  } else {
    parts.push(`\n=== EMAIL COMMUNICATIONS ===`);
    parts.push(`⚠️ NO EMAIL DATA AVAILABLE`);
  }

  // Texts with temporal bucketing
  if (context.recentTexts.length > 0) {
    const textBuckets = bucketByRecency(context.recentTexts);
    parts.push(`\n=== TEXT MESSAGES ===`);
    parts.push(`DATA RANGE: ${textBuckets.oldestDate ? formatAge(textBuckets.oldestDate) : 'N/A'} to ${textBuckets.newestDate ? formatAge(textBuckets.newestDate) : 'N/A'}`);
    parts.push(`TOTAL: ${context.recentTexts.length} messages`);

    if (textBuckets.today.length > 0) {
      parts.push(`\n[TODAY - ${textBuckets.today.length} texts]:`);
      textBuckets.today.slice(0, 5).forEach(t => {
        parts.push(`  ${t.date} | ${t.from}: "${t.text.slice(0, 80)}..."`);
      });
    }
    if (textBuckets.thisWeek.length > 0) {
      parts.push(`\n[THIS WEEK - ${textBuckets.thisWeek.length} texts]:`);
      textBuckets.thisWeek.slice(0, 5).forEach(t => {
        parts.push(`  ${t.date} (${formatAge(t.date)}) | ${t.from}: "${t.text.slice(0, 80)}..."`);
      });
    }
    if (textBuckets.thisMonth.length > 0) {
      parts.push(`\n[THIS MONTH - ${textBuckets.thisMonth.length} texts]:`);
      textBuckets.thisMonth.slice(0, 3).forEach(t => {
        parts.push(`  ${t.date} (${formatAge(t.date)}) | ${t.from}: "${t.text.slice(0, 80)}..."`);
      });
    }
    if (textBuckets.older.length > 0) {
      parts.push(`\n[OLDER - ${textBuckets.older.length} texts]`);
      // Show most recent of the "older" messages
      const sortedOlder = [...textBuckets.older].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      sortedOlder.slice(0, 3).forEach(t => {
        parts.push(`  ${t.date} (${formatAge(t.date)}) | ${t.from}: "${t.text.slice(0, 80)}..."`);
      });
    }

    // Staleness warning
    if (textBuckets.today.length === 0 && textBuckets.thisWeek.length === 0 && textBuckets.thisMonth.length === 0) {
      parts.push(`\n⚠️ DATA STALENESS WARNING: No text messages from last 30 days!`);
      parts.push(`   Most recent text: ${textBuckets.newestDate} (${formatAge(textBuckets.newestDate || '')})`);
      parts.push(`   Analysis based on HISTORICAL data only - may not reflect current situation.`);
    }
  } else {
    parts.push(`\n=== TEXT MESSAGES ===`);
    parts.push(`⚠️ NO TEXT DATA AVAILABLE`);
  }

  if (context.strategicBrief) {
    parts.push(`\n=== PRIOR ANALYSIS ===`);
    parts.push(`Existing strategic brief available (generated: ${context.strategicBrief.generated_at || 'unknown'})`);
  }

  return parts.join('\n');
}

function extractSuggestedActions(response: string): string[] {
  const actions: string[] = [];

  // Look for numbered lists or bullet points
  const lines = response.split('\n');
  let inActionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes('suggest') ||
        trimmed.toLowerCase().includes('recommend') ||
        trimmed.toLowerCase().includes('action') ||
        trimmed.toLowerCase().includes('next step')) {
      inActionSection = true;
      continue;
    }

    if (inActionSection && (trimmed.startsWith('-') || trimmed.startsWith('•') || /^\d+\./.test(trimmed))) {
      const action = trimmed.replace(/^[-•\d.]\s*/, '').trim();
      if (action.length > 10 && action.length < 200) {
        actions.push(action);
      }
    }

    if (inActionSection && trimmed === '' && actions.length > 0) {
      break;
    }
  }

  // Default suggestions if none found
  if (actions.length === 0) {
    actions.push('Review the strategic brief for updates');
    actions.push('Check for any pending deadlines');
    actions.push('Prepare documentation for next hearing');
  }

  return actions.slice(0, 4);
}

/**
 * Get all memories for the legal advisor
 */
export async function getMemories(): Promise<any[]> {
  return getAllMemories('legal-advisor');
}
