/**
 * AI-Powered Triage Engine
 *
 * Replaces static rule-based triage with LLM-powered decisions using:
 * - GPT-5.1 via AgentInvoker for intelligent analysis
 * - Zep memory for historical context and learning
 * - Life OS config for organizational rules
 *
 * The AI analyzes signals with fuzzy logic, considering:
 * - Signal source, type, and payload context
 * - Similar past signals and how they were triaged
 * - Organizational policies from Zep org-council
 * - Life Charter escalation rules
 */

import { ensureServerOnly } from '../server-only-guard';
import { agentInvoker, type AgentResponse } from '../agents/AgentInvoker';
import { getLifeCharter, getDomain } from '../life-os-config';
import { searchPMMemories, addPMMemory } from './pm-memory';
import type { IncomingSignal, TriageResult, QueueAction, EscalationLevel } from './task-queue';

ensureServerOnly('lib/pm/ai-triage');

// ============================================================================
// Types
// ============================================================================

export interface AITriageResult extends TriageResult {
  confidence: number;
  ai_rationale: string;
  zep_context_used: boolean;
  model_used: string;
}

interface TriageDecision {
  action: QueueAction;
  escalation_level: EscalationLevel;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  rationale: string;
  suggested_title?: string;
  suggested_labels?: string[];
  assigned_project?: string;
  due_date?: string;
}

// ============================================================================
// Prompt Construction
// ============================================================================

/**
 * Build the triage prompt with full context
 */
function buildTriagePrompt(
  signal: IncomingSignal,
  zepContext: string,
  lifeCharterContext: string
): string {
  return `You are the PM Agent (Project Maestro) performing intelligent signal triage.

## Your Task
Analyze the incoming signal and decide:
1. What ACTION to take (github_issue, local_task, defer, ignore, escalate)
2. What ESCALATION level (critical, propose, auto)
3. What PRIORITY (critical, high, medium, low)
4. Provide a CONFIDENCE score (0.0 to 1.0) for your decision

## Incoming Signal
- ID: ${signal.id}
- Source: ${signal.source}
- Type: ${signal.signal_type}
- Confidence (from source): ${signal.confidence}
- Timestamp: ${new Date(signal.timestamp * 1000).toISOString()}
- Payload:
${JSON.stringify(signal.payload, null, 2)}

${zepContext ? `## Historical Context from Memory\n${zepContext}\n` : ''}

## Life Charter Escalation Rules
${lifeCharterContext}

## Decision Framework

### Actions:
- **github_issue**: Create a tracked GitHub issue for development work
- **local_task**: Create a local task for quick items or follow-ups
- **defer**: Flag for later review (low confidence signals)
- **ignore**: No action needed (noise, duplicates, irrelevant)
- **escalate**: Requires immediate human attention

### Escalation Levels:
- **critical**: Legal threats, security issues, compliance risks, family emergencies - IMMEDIATE attention
- **propose**: Significant decisions, bulk changes, budget items - needs approval before action
- **auto**: Routine operations, low-risk items - can proceed automatically

### Priority:
- **critical**: Must be addressed immediately (legal deadlines, security)
- **high**: Important, should be done soon (key deliverables, client requests)
- **medium**: Standard work, normal priority
- **low**: Nice to have, can wait

## Output Format
Respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):
{
  "action": "local_task" | "github_issue" | "defer" | "ignore" | "escalate",
  "escalation_level": "critical" | "propose" | "auto",
  "priority": "critical" | "high" | "medium" | "low",
  "confidence": 0.85,
  "rationale": "Brief explanation of your decision",
  "suggested_title": "Optional: Title for the task/issue if creating one",
  "suggested_labels": ["optional", "array", "of", "labels"],
  "assigned_project": "Optional: Project to assign to",
  "due_date": "Optional: YYYY-MM-DD format if deadline detected"
}`;
}

/**
 * Build Life Charter context for the prompt
 */
function buildLifeCharterContext(): string {
  const charter = getLifeCharter();

  return `
### CRITICAL Triggers (${charter.escalation_levels.CRITICAL.response_time}):
${charter.escalation_levels.CRITICAL.triggers.map(t => `- ${t}`).join('\n')}

### PROPOSE Triggers (${charter.escalation_levels.PROPOSE.response_time}):
${charter.escalation_levels.PROPOSE.triggers.map(t => `- ${t}`).join('\n')}

### AUTO_EXECUTE (${charter.escalation_levels.AUTO_EXECUTE.response_time}):
${charter.escalation_levels.AUTO_EXECUTE.triggers.map(t => `- ${t}`).join('\n')}

### Global Principles:
${charter.global_principles.map(p => `- ${p}`).join('\n')}
`;
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse the AI response into a structured triage decision
 */
function parseTriageResponse(response: string): TriageDecision | null {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Handle markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.action || !parsed.escalation_level || !parsed.priority) {
      console.warn('[AI Triage] Missing required fields in response:', parsed);
      return null;
    }

    // Validate action
    const validActions: QueueAction[] = ['github_issue', 'local_task', 'defer', 'ignore', 'escalate'];
    if (!validActions.includes(parsed.action)) {
      console.warn('[AI Triage] Invalid action:', parsed.action);
      return null;
    }

    // Validate escalation level
    const validEscalations: EscalationLevel[] = ['auto', 'propose', 'critical'];
    if (!validEscalations.includes(parsed.escalation_level)) {
      console.warn('[AI Triage] Invalid escalation level:', parsed.escalation_level);
      return null;
    }

    return {
      action: parsed.action,
      escalation_level: parsed.escalation_level,
      priority: parsed.priority || 'medium',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      rationale: parsed.rationale || 'AI triage decision',
      suggested_title: parsed.suggested_title,
      suggested_labels: Array.isArray(parsed.suggested_labels) ? parsed.suggested_labels : undefined,
      assigned_project: parsed.assigned_project,
      due_date: parsed.due_date,
    };
  } catch (error) {
    console.error('[AI Triage] Failed to parse response:', error);
    console.error('[AI Triage] Raw response:', response);
    return null;
  }
}

// ============================================================================
// Main Triage Function
// ============================================================================

/**
 * Triage a signal using AI with Zep memory context
 */
export async function triageSignalWithAI(signal: IncomingSignal): Promise<AITriageResult | null> {
  const startTime = Date.now();

  try {
    // 1. Query Zep for relevant context
    let zepContext = '';
    let zepContextUsed = false;

    try {
      const searchQuery = `signal triage ${signal.source} ${signal.signal_type} ${
        signal.payload.description || signal.payload.title || ''
      }`.trim();

      const memories = await searchPMMemories(searchQuery, 5);

      if (memories.length > 0) {
        zepContextUsed = true;
        zepContext = '### Similar Past Signals & Decisions:\n' +
          memories.map((m, i) => `${i + 1}. ${m.text}`).join('\n');
      }
    } catch (zepError) {
      console.warn('[AI Triage] Zep context fetch failed:', zepError);
      // Continue without Zep context
    }

    // 2. Build the prompt
    const lifeCharterContext = buildLifeCharterContext();
    const prompt = buildTriagePrompt(signal, zepContext, lifeCharterContext);

    // 3. Call GPT-5.1 via AgentInvoker
    const agentResponse: AgentResponse = await agentInvoker.invoke({
      agentId: 'agent.pm',
      userMessage: prompt,
      providerOverride: 'openai',  // Use GPT-5.1 for structured analysis
      modelOverride: 'gpt-4.1-2025-04-14',  // GPT-5.1 / latest
      context: {
        skipMemory: true,  // We're handling Zep context manually
        metadata: {
          operation: 'triage',
          signal_id: signal.id,
          signal_source: signal.source,
        },
      },
    });

    // 4. Parse the response
    const decision = parseTriageResponse(agentResponse.content);

    if (!decision) {
      console.warn('[AI Triage] Failed to parse AI response for signal:', signal.id);
      return null;
    }

    // 5. Build the result
    const result: AITriageResult = {
      action: decision.action,
      rationale: decision.rationale,
      priority: decision.priority,
      escalation_level: decision.escalation_level,
      due_date: decision.due_date,
      assigned_project: decision.assigned_project,
      suggested_title: decision.suggested_title,
      suggested_labels: decision.suggested_labels,
      confidence: decision.confidence,
      ai_rationale: decision.rationale,
      zep_context_used: zepContextUsed,
      model_used: agentResponse.model,
      metadata: {
        ai_powered: true,
        processing_time_ms: Date.now() - startTime,
        tokens_used: agentResponse.tokensUsed,
        zep_memories_count: zepContextUsed ? 5 : 0,
      },
    };

    // 6. Persist the decision to Zep for future learning
    try {
      await addPMMemory(
        `Triaged signal ${signal.id} from ${signal.source}/${signal.signal_type}: ` +
        `action=${result.action}, escalation=${result.escalation_level}, ` +
        `priority=${result.priority}, confidence=${result.confidence.toFixed(2)}. ` +
        `Rationale: ${result.rationale}`,
        'decision',
        {
          signal_id: signal.id,
          signal_source: signal.source,
          signal_type: signal.signal_type,
          action: result.action,
          escalation: result.escalation_level,
          priority: result.priority,
          confidence: result.confidence,
        }
      );
    } catch (memoryError) {
      console.warn('[AI Triage] Failed to persist to Zep:', memoryError);
      // Don't fail the triage if memory persistence fails
    }

    console.log(
      `[AI Triage] Signal ${signal.id}: ${result.action} (${result.escalation_level}) ` +
      `confidence=${result.confidence.toFixed(2)} in ${Date.now() - startTime}ms`
    );

    return result;
  } catch (error) {
    console.error('[AI Triage] Error triaging signal:', error);
    return null;
  }
}

/**
 * Triage multiple signals in batch (for efficiency)
 */
export async function triageSignalsBatch(
  signals: IncomingSignal[]
): Promise<Map<string, AITriageResult | null>> {
  const results = new Map<string, AITriageResult | null>();

  // Process in parallel with limited concurrency
  const concurrency = 3;
  const batches: IncomingSignal[][] = [];

  for (let i = 0; i < signals.length; i += concurrency) {
    batches.push(signals.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(signal => triageSignalWithAI(signal))
    );

    batch.forEach((signal, index) => {
      results.set(signal.id, batchResults[index]);
    });
  }

  return results;
}

/**
 * Get AI triage confidence threshold from environment
 */
export function getAITriageConfidenceThreshold(): number {
  const threshold = process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD;
  if (threshold) {
    const parsed = parseFloat(threshold);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return 0.6; // Default threshold
}

/**
 * Check if AI triage is enabled
 */
export function isAITriageEnabled(): boolean {
  return process.env.USE_AI_TRIAGE !== 'false';
}
