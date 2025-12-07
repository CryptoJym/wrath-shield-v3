import { ensureServerOnly } from '@/lib/server-only-guard';
import { agentInvoker, type AgentResponse } from '@/lib/agents/AgentInvoker';
import { searchPMMemories, addPMMemory } from '@/lib/pm/pm-memory';

ensureServerOnly('lib/ea/adjudicator');

export interface AdjudicationResult {
    domain: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: 'route' | 'archive' | 'reply' | 'flag';
    target_agent?: string; // e.g. 'agent.finance'
    reasoning: string;
    suggested_tags: string[];
}

/**
 * Adjudicates a single item (email, message, log) using AI + Memory.
 * 
 * @param content The text content to analyze
 * @param source Source of the item (email, message, etc)
 * @param hint Optional hint from UI button (e.g. user clicked "Finance")
 */
export async function adjudicateItem(
    content: string,
    source: string,
    hint?: string
): Promise<AdjudicationResult> {

    // 1. Fetch Memory Context (Patterns)
    let memoryContext = '';
    try {
        // Search for relevant routing rules or past decisions
        const memories = await searchPMMemories(`adjudicate routing rules ${hint || ''} ${content.substring(0, 50)}`, 3);
        if (memories.length > 0) {
            memoryContext = memories.map(m => m.text).join('\n');
        }
    } catch (e) {
        console.warn('Failed to fetch Zep context for adjudication', e);
    }

    // 2. Build Prompt
    const prompt = `
    You are the Adjudicator for the Executive Assistant (EA) System.
    Your job is to route incoming information to the correct domain agent or disposition it.

    ITEM SOURCE: ${source}
    UI HINT: ${hint ? `User suggests: ${hint}` : 'None'}

    CONTENT:
    "${content.substring(0, 2000)}"

    MEMORY/RULES CONTEXT:
    ${memoryContext || 'No specific past rules found.'}

    INSTRUCTIONS:
    1. Determine the relevant LifeOS Domain (Finance, Legal, Health, etc).
    2. Assess Priority based on urgency/importance.
    3. Choose Action: route (send to agent), archive (junk/done), reply (needs draft), flag (needs human).
    4. If routing, specify Target Agent (agent.finance, agent.legal, agent.pm, agent.orchestrator).

    OUTPUT JSON ONLY:
    {
      "domain": "finance",
      "priority": "high",
      "action": "route",
      "target_agent": "agent.finance",
      "reasoning": "Invoice detected, amount > $500",
      "suggested_tags": ["invoice", "urgent"]
    }
    `;

    // 3. Invoke LLM (Fast model is usually fine, but user urged intelligence, so standard model)
    try {
        const response: AgentResponse = await agentInvoker.invoke({
            agentId: 'agent.ea',
            userMessage: prompt,
            providerOverride: 'openai',
            modelOverride: 'gpt-5.1',
            context: {
                skipMemory: true, // We already injected specific memory
                metadata: { op: 'adjudication' }
            }
        });

        // 4. Parse Output
        let result: AdjudicationResult;
        let jsonStr = response.content.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }

        try {
            result = JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse adjudication JSON', response.content);
            // Fallback
            return {
                domain: 'general',
                priority: 'medium',
                action: 'flag',
                reasoning: 'AI failed to produce structured output',
                suggested_tags: ['error']
            };
        }

        // 5. Learn (Async)
        // Record this decision to help future adjudication
        if (result.action !== 'archive') { // Don't learn from junk
            addPMMemory(
                `Adjudicated [${source}] -> ${result.target_agent || result.action}. Reason: ${result.reasoning}`,
                'decision',
                { source, result }
            ).catch(err => console.error('Failed to save adjudication memory', err));
        }

        return result;

    } catch (error) {
        console.error('Adjudication system error', error);
        return {
            domain: 'system',
            priority: 'high',
            action: 'flag',
            reasoning: 'System Error during adjudication',
            suggested_tags: ['system_error']
        };
    }
}
