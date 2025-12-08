import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { agentInvoker } from '@/lib/agents/AgentInvoker';

export const dynamic = 'force-dynamic';

interface LearnRequest {
  message?: string;
  correction?: {
    itemId: string;
    original: string;
    corrected: string;
  };
  conversationContext?: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * POST /api/ea/learn
 * Handles learning interactions with James.
 * - Processes corrections (learns from domain reclassifications)
 * - Answers questions about current understanding
 * - Updates preference model based on feedback
 */
export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body: LearnRequest = await request.json();

    // Handle correction
    if (body.correction) {
      await processCorrection(userId, body.correction);

      return NextResponse.json({
        response: `Got it! I'll remember that items like this should go to "${body.correction.corrected}" instead of "${body.correction.original}". I've updated my understanding.`,
      });
    }

    // Handle conversational message
    if (body.message) {
      const response = await generateLearningResponse(userId, body.message, body.conversationContext);
      return NextResponse.json({ response });
    }

    return NextResponse.json({ error: 'No message or correction provided' }, { status: 400 });
  } catch (error) {
    console.error('[EA Learn] Error:', error);
    return NextResponse.json(
      { error: 'Learning interaction failed' },
      { status: 500 }
    );
  }
}

/**
 * Process a correction and update the preference model
 */
async function processCorrection(
  _userId: string,
  correction: { itemId: string; original: string; corrected: string }
): Promise<void> {
  try {
    // Record correction in Zep memory
    // The recordCorrection function expects structured original/corrected objects
    const { recordCorrection } = await import('@/lib/ea/preference-model');
    type Domain = 'legal' | 'finance' | 'health' | 'pm' | 'comms' | 'personal' | 'business' | 'hyro' | 'general';
    await recordCorrection(
      correction.itemId,
      {
        urgency: 'medium',
        domain: (correction.original || 'general') as Domain,
        action: 'review',
      },
      {
        urgency: 'medium',
        domain: (correction.corrected || 'general') as Domain,
        action: 'review',
      },
      'User correction via EA learning interface'
    );

    console.log(`[EA Learn] Recorded correction: ${correction.original} → ${correction.corrected}`);
  } catch (e) {
    // Fallback: store in Zep directly
    console.warn('[EA Learn] preference-model not available, storing directly in Zep');
    try {
      const { addAgentMemory } = await import('@/lib/memory/zep');
      await addAgentMemory(
        'ea-agent',
        `CORRECTION: User reclassified item from "${correction.original}" to "${correction.corrected}". Item ID: ${correction.itemId}. Learn this pattern.`,
        {
          type: 'correction',
          original: correction.original,
          corrected: correction.corrected,
          item_id: correction.itemId,
          user_id: _userId,
          timestamp: new Date().toISOString(),
        }
      );
    } catch (zepError) {
      console.error('[EA Learn] Failed to store correction in Zep:', zepError);
    }
  }
}

/**
 * Generate a learning response using the EA agent
 */
async function generateLearningResponse(
  _userId: string,
  message: string,
  context?: Array<{ role: string; content: string }>
): Promise<string> {
  // Load current preferences for context
  let preferencesContext = '';
  try {
    const { loadPreferences } = await import('@/lib/ea/preference-model');
    const prefs = await loadPreferences();
    // Format priority contacts (they are objects with identifier property)
    const priorityContacts = prefs.priority_contacts?.map((c: { identifier: string }) => c.identifier).join(', ') || 'None set';
    // Format urgency triggers (they are objects with pattern property)
    const urgencyTriggers = prefs.urgency_triggers?.map((t: { pattern: string }) => t.pattern).join(', ') || 'None set';
    // Format auto-archive patterns (they are objects with pattern property)
    const archivePatterns = prefs.auto_archive_patterns?.map((p: { pattern: string }) => p.pattern).join(', ') || 'None set';
    preferencesContext = `
Current Preference Model:
- Priority Contacts: ${priorityContacts}
- Urgency Triggers: ${urgencyTriggers}
- Auto-Archive Patterns: ${archivePatterns}
- Batch Preference: ${prefs.batch_frequency_preference || 'on_demand'}
- Current Focus: ${prefs.current_focus_domain || 'None'}
`;
  } catch (e) {
    preferencesContext = 'Preference model not yet initialized.';
  }

  const conversationHistory = context
    ?.slice(-5)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n') || '';

  const prompt = `
You are the EA (Executive Assistant) learning to understand James's preferences.
Your goal is to minimize cognitive entropy for James by learning what matters to him.

${preferencesContext}

Recent Conversation:
${conversationHistory}

James says: "${message}"

INSTRUCTIONS:
1. If James is asking about your current understanding, explain it clearly.
2. If James is giving you new preferences or feedback, acknowledge and confirm.
3. If James corrects you, thank him and confirm the correction.
4. Be conversational but efficient. James values his time.
5. If you learn something new, mention that you've noted it.

Respond naturally as James's EA:
`;

  try {
    const response = await agentInvoker.invoke({
      agentId: 'agent.ea',
      userMessage: prompt,
      providerOverride: 'openai',
      modelOverride: 'gpt-5.1',
      context: {
        metadata: { op: 'learning_conversation', user_id: _userId },
      },
    });

    return response.content;
  } catch (error) {
    console.error('[EA Learn] LLM error:', error);
    return "I'm having trouble processing that right now. Could you rephrase?";
  }
}
