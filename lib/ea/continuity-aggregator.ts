import { ensureServerOnly } from '../server-only-guard';
import { agentInvoker, type AgentResponse } from '../agents/AgentInvoker';
import { getLifelogsLastNDays } from '../db/queries';
import { listAgenticActions } from '../db/queries';
import { searchPMMemories, addPMMemory } from '../pm/pm-memory';

ensureServerOnly('lib/ea/continuity-aggregator');

interface ContinuityContext {
    summary: string;
    threads: {
        title: string;
        status: 'active' | 'resolved' | 'stalled';
        last_update: string;
    }[];
    generated_at: number;
}

let cachedContinuity: ContinuityContext | null = null;
let lastGenerated = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Generates a continuity narrative from recent life logs and agentic actions.
 * Uses caching to avoid excessive LLM calls.
 */
export async function getContinuityNarrative(userId?: string, forceRefresh = false): Promise<ContinuityContext> {
    const now = Date.now();
    if (!forceRefresh && cachedContinuity && (now - lastGenerated < CACHE_TTL)) {
        return cachedContinuity;
    }

    try {
        // 1. Fetch recent data
        const logs = getLifelogsLastNDays(3, userId); // Last 3 days
        const actions = listAgenticActions({ limit: 50, userId });

        if (logs.length === 0 && actions.length === 0) {
            return {
                summary: "No recent activity to analyze. Systems standing by.",
                threads: [],
                generated_at: now
            };
        }

        // 2. Format for LLM
        const logText = logs.map(l => `[LOG ${l.date}] ${l.title}: ${l.raw_json ? JSON.stringify(JSON.parse(l.raw_json).transcription || l.raw_json).substring(0, 200) : 'No content'}`).join('\n');
        const actionText = actions.slice(0, 20).map(a => `[ACTION ${a.status}] ${a.title || a.type}: ${a.content.substring(0, 100)}`).join('\n');

        // 3. Fetch Memory Context (Zep)
        let memoryContext = '';
        try {
            const memories = await searchPMMemories('current active threads priorities', 5);
            if (memories.length > 0) {
                memoryContext = memories.map(m => m.text).join('\n');
            }
        } catch (e) {
            console.warn('Failed to fetch Zep context', e);
        }

        // 4. Prompt LLM
        const prompt = `
    You are the Continuity Engine for the user's Life OS.
    Analyze the following recent Life Logs (audio transcriptions/notes) and Agentic Actions (system tasks).
    
    GOAL: synthesizing disparate events into a cohesive narrative status update.
    - Identify active conversation threads or projects.
    - Flag anything that seems "stalled" or "needs attention".
    - Ignore trivial noise.
    
    INPUT DATA:
    ${logText}
    
    RECENT ACTIONS:
    ${actionText}
    
    MEMORY CONTEXT:
    ${memoryContext}
    
    OUTPUT FORMAT (JSON ONLY):
    {
      "summary": "A 2-3 sentence executive summary of the current state of affairs, written in a professional, slightly futuristic EA tone.",
      "threads": [
        { "title": "Project Alpha", "status": "active", "last_update": "Discussion about API keys" },
        { "title": "Health Optimization", "status": "stalled", "last_update": "Missed workout log" }
      ]
    }
    `;

        const response: AgentResponse = await agentInvoker.invoke({
            agentId: 'agent.ea',
            userMessage: prompt,
            providerOverride: 'openai',
            modelOverride: 'gpt-5.1', // Using high quality model as requested
            context: {
                skipMemory: true,
                metadata: { op: 'continuity_aggregation' }
            }
        });

        // 5. Parse and Return
        let parsed;
        try {
            let content = response.content.trim();
            if (content.startsWith('```json')) content = content.slice(7, -3).trim();
            parsed = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse continuity JSON', e);
            parsed = { summary: "Analysis failed due to parsing error. Raw output available in logs.", threads: [] };
        }

        cachedContinuity = {
            summary: parsed.summary,
            threads: parsed.threads || [],
            generated_at: now
        };
        lastGenerated = now;

        // Async: Save to Zep for long-term continuity
        if (parsed.summary) {
            addPMMemory(`Continuity Update [${new Date().toISOString()}]: ${parsed.summary}`, 'continuity', { threads: parsed.threads })
                .catch(err => console.error('Failed to save continuity memory', err));
        }

        return cachedContinuity!;

    } catch (error) {
        console.error('Error in getContinuityNarrative', error);
        return {
            summary: "System error during continuity analysis.",
            threads: [],
            generated_at: now
        };
    }
}
