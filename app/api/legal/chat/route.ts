import { NextRequest, NextResponse } from 'next/server';
import {
  saveChatMessage,
  listChatMessages,
  clearChatMessages,
  createPendingAction,
  createNotification,
  listLegalContextRequests,
} from '@/lib/legal/store';
import {
  detectLegalDomain,
  transfigurePersona,
} from '@/lib/legal/LegalPersonaSystem';
import fs from 'fs';
import path from 'path';

// Zep session for legal documents
const ZEP_SESSION_ID = 'legal-case-164400524';

// Load context memo if available
function loadContextMemo(): string {
  const monorepoPath = path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'analysis', 'context_memo.md');
  const legacyPath = path.resolve(process.env.LEGAL_AI_PATH || '/Users/jamesbrady/legal-advocate-ai', 'analysis', 'context_memo.md');
  const memoPath = fs.existsSync(monorepoPath) ? monorepoPath : legacyPath;

  try {
    if (fs.existsSync(memoPath)) {
      return fs.readFileSync(memoPath, 'utf-8');
    }
  } catch {}
  return '';
}

// Load timeline data
function loadTimeline(): any[] {
  const timelinePath = path.resolve(process.cwd(), '.data', 'legal', 'timeline', 'master_timeline.json');
  try {
    if (fs.existsSync(timelinePath)) {
      return JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    }
  } catch {}
  return [];
}

// Load Destiny text messages
function loadDestinyMessages(): string {
  const keyMsgsPath = path.resolve(process.cwd(), '.data', 'legal', 'destiny_key_messages.md');
  try {
    if (fs.existsSync(keyMsgsPath)) {
      return fs.readFileSync(keyMsgsPath, 'utf-8');
    }
  } catch {}
  return '';
}

// Search Zep memory for relevant context
async function searchZepContext(query: string): Promise<string> {
  const ZEP_API_KEY = process.env.ZEP_API_KEY || process.env.ZEP_LEGAL_API_KEY;
  if (!ZEP_API_KEY) return '';

  try {
    const response = await fetch(
      `https://api.getzep.com/api/v2/sessions/${ZEP_SESSION_ID}/memory/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${ZEP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: query, limit: 5 }),
      }
    );

    if (!response.ok) return '';

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) return '';

    return results
      .map((r: any) => r.message?.content || r.content || '')
      .filter((c: string) => c.length > 100)
      .join('\n\n---\n\n');
  } catch (e) {
    console.error('Zep search error:', e);
    return '';
  }
}

// APPROVED MODELS - Grok 4.1 Fast (primary) and GPT-5.1 (fallback)
const PRIMARY_MODEL = 'x-ai/grok-4-1-fast';
const FALLBACK_MODEL = 'openai/gpt-5.1';

// Call LLM via OpenRouter with approved models only
async function callLLM(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  model: string = PRIMARY_MODEL
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

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
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || 'No response generated';
  return { content, model };
}

// Call with fallback support
async function callLLMWithFallback(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: string; content: string }> = []
): Promise<{ content: string; model: string }> {
  try {
    return await callLLM(systemPrompt, userMessage, history, PRIMARY_MODEL);
  } catch (primaryError: any) {
    console.warn(`[LegalChat] Primary model failed: ${primaryError.message}, trying fallback...`);
    try {
      return await callLLM(systemPrompt, userMessage, history, FALLBACK_MODEL);
    } catch (fallbackError: any) {
      throw new Error(`Both models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
    }
  }
}

// Build the system prompt with case context
function buildSystemPrompt(contextMemo: string, zepContext: string, timeline: any[], destinyMsgs: string): string {
  const today = new Date().toISOString().split('T')[0];

  // Get recent key events
  const keyEvents = timeline
    .filter((e: any) => e.category !== 'email')
    .slice(0, 20)
    .map((e: any) => `- ${e.date}: ${e.title} (${e.category})`)
    .join('\n');

  // Get recent Destiny messages (last ~4000 chars)
  const recentDestinyMsgs = destinyMsgs ? destinyMsgs.slice(-6000) : '';

  return `You are the Legal Advocate AI for James Brady's custody case.

CASE: 164400524 - Brady v. Brady
COURT: Fourth Judicial District, Provo, Utah
JUDGE: Derek P. Pullan
COMMISSIONER: Marian Ito
FATHER'S ATTORNEY: Zachary Starr (Moody Brown Law)
CHILD: Hyro

TODAY'S DATE: ${today}

CURRENT STATUS (cite sources for each fact):
- October 21, 2025 ORDER: "If Mother relocates, physical custody transfers to Father" (Order on Hearing)
- November 17, 2025: Email to attorney states "She transferred my son to my care" - Hyro transferred to Father
- Case is ACTIVE with ongoing proceedings

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY state facts you can cite from actual documents, emails, or timeline events
2. NEVER make up dates or events - if you don't have evidence, say "I don't have documentation for this"
3. ALWAYS cite your source: document name, email date, text message date, or "no source available"
4. DO NOT assume relocation dates or transfer dates without evidence
5. When unsure, say "Based on available documents..." or "I need to verify..."

KEY CASE TIMELINE:
${keyEvents || 'No timeline events loaded'}

${recentDestinyMsgs ? `TEXT MESSAGES WITH DESTINY (← = from her, → = from James):
${recentDestinyMsgs}` : ''}

${zepContext ? `RELEVANT CASE DOCUMENTS:
${zepContext.substring(0, 6000)}` : ''}

${contextMemo ? `CONTEXT MEMO:
${contextMemo.substring(0, 3000)}` : ''}

YOUR RESPONSIBILITIES:
1. Answer questions about the case using the documents and timeline
2. Help draft professional communications to attorney Zack Starr
3. Analyze legal strategy and identify opportunities
4. Track deadlines and compliance issues
5. Reference specific evidence and documents when answering

IMPORTANT:
- Provide legal INFORMATION, not legal ADVICE (UPL compliance)
- Always recommend consulting with attorney Zack Starr for final decisions
- Be precise about dates - calculate age from today (${today})
- When asked to create actions (draft emails, etc.), acknowledge and note it will be added to pending actions

Respond in a clear, professional manner. Reference specific documents and dates when relevant.`;
}

// Check if message requests an action
function checkForActionRequest(message: string): { isAction: boolean; actionType: string; title: string } | null {
  const lower = message.toLowerCase();

  if (lower.includes('create action') || lower.includes('draft email') || lower.includes('send to zack') || lower.includes('email zack')) {
    return {
      isAction: true,
      actionType: 'email_draft',
      title: lower.includes('email') ? 'Draft email to Zack Starr' : 'Legal action request',
    };
  }

  if (lower.includes('schedule') || lower.includes('set reminder')) {
    return {
      isAction: true,
      actionType: 'reminder',
      title: 'Schedule reminder',
    };
  }

  return null;
}

// GET - Retrieve chat history
export async function GET() {
  try {
    const messages = listChatMessages();
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return NextResponse.json({ messages: [] });
  }
}

// POST - Send message and get LLM response
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history, matterId: existingMatterId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Save user message
    saveChatMessage({ role: 'user', content: message });

    // Check for action creation requests
    const actionRequest = checkForActionRequest(message);
    let actionCreated = false;
    let actionId: string | undefined;

    if (actionRequest) {
      const action = createPendingAction({
        action_type: actionRequest.actionType,
        title: actionRequest.title,
        description: message,
        priority: message.toLowerCase().includes('urgent') ? 'urgent' : 'normal',
        payload: { originalRequest: message, timestamp: new Date().toISOString() },
      });

      createNotification({
        notification_type: 'action_required',
        title: 'New action pending approval',
        message: actionRequest.title,
        severity: 'warning',
        related_id: action.id,
      });

      actionCreated = true;
      actionId = action.id;
    }

    // === LEGAL PERSONA TRANSFIGURATION ===
    // Detect domain and transfigure persona for specialized legal advice
    const domainDetection = detectLegalDomain(message);
    let personaResult;
    let matterId = existingMatterId;

    // Only transfigure if we detect a specific legal domain with reasonable confidence
    if (domainDetection.domain !== 'general' && domainDetection.confidence > 0.3) {
      personaResult = await transfigurePersona(message);
      matterId = personaResult.matterId;
      console.log(`[LegalChat] Transfigured to ${personaResult.persona.name} (${domainDetection.confidence.toFixed(2)} confidence)`);
    }

    // Load context sources
    const contextMemo = loadContextMemo();
    const timeline = loadTimeline();
    const destinyMsgs = loadDestinyMessages();

    // Search Zep for relevant documents based on the query
    const zepContext = await searchZepContext(message);

    // Build base system prompt with case context
    let systemPrompt = buildSystemPrompt(contextMemo, zepContext, timeline, destinyMsgs);

    // Enhance with persona-specific context if transfigured
    if (personaResult) {
      systemPrompt += `\n\n${personaResult.enrichedSystemPrompt}`;

      // Add persona-specific guidance
      systemPrompt += `\n\n## ACTIVE LEGAL PERSONA: ${personaResult.persona.name}
Domain: ${personaResult.persona.domain}
Confidence: ${(domainDetection.confidence * 100).toFixed(0)}%
Matched Keywords: ${domainDetection.matchedKeywords.join(', ')}
Jurisdiction: ${domainDetection.suggestedJurisdiction}

### Key Statutes for This Domain:
${personaResult.persona.keyStatutes.slice(0, 5).map(s => `- ${s}`).join('\n')}
`;
    }

    let reply: string;
    let modelUsed: string = PRIMARY_MODEL;

    try {
      // Call LLM with fallback support
      const llmResult = await callLLMWithFallback(systemPrompt, message, history || []);
      reply = llmResult.content;
      modelUsed = llmResult.model;

      // If action was created, append note
      if (actionCreated) {
        reply += `\n\n---\n✅ **Action Created**: "${actionRequest!.title}" has been added to your pending actions queue for approval.`;
      }

      // Add persona context note if transfigured
      if (personaResult && domainDetection.confidence > 0.5) {
        reply += `\n\n---\n🎭 *Responding as ${personaResult.persona.name} (${domainDetection.suggestedJurisdiction} jurisdiction)*`;
      }
    } catch (llmError: any) {
      console.error('LLM call failed:', llmError);
      // Fallback to basic response
      reply = `I apologize, but I'm having trouble connecting to the AI service right now.

Here's what I can tell you based on the case data:
- Case #164400524 is active
- Father (James) currently has physical custody per the October 21, 2025 order
- Your attorney is Zack Starr at Moody Brown Law

Please try again in a moment, or check the timeline view for case history.`;

      if (actionCreated) {
        reply += `\n\n✅ Your action request has been saved for approval.`;
      }
    }

    // Save assistant message with enhanced metadata
    const metadata: Record<string, any> = {};
    if (actionCreated) {
      metadata.actionCreated = true;
      metadata.actionId = actionId;
    }
    if (personaResult) {
      metadata.persona = personaResult.persona.name;
      metadata.domain = domainDetection.domain;
      metadata.domainConfidence = domainDetection.confidence;
      metadata.matterId = matterId;
    }
    metadata.model = modelUsed;

    saveChatMessage({
      role: 'assistant',
      content: reply,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    });

    return NextResponse.json({
      reply,
      actionsCreated: actionCreated,
      metadata: {
        ...metadata,
        model: modelUsed,
        persona: personaResult?.persona.name,
        domain: domainDetection.domain,
        domainConfidence: domainDetection.confidence,
        matterId,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

// DELETE - Clear chat history
export async function DELETE() {
  try {
    const deleted = clearChatMessages();
    return NextResponse.json({ cleared: deleted });
  } catch (error) {
    console.error('Failed to clear chat:', error);
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 });
  }
}
