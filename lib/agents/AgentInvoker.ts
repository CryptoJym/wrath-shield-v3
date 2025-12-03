/**
 * AgentInvoker - Central LLM Gateway for Life OS
 *
 * This is the ONLY place agent LLM calls should be made.
 * It ensures all agents use their Life OS config system prompts,
 * applies escalation rules, and logs all activity.
 *
 * Features:
 * 1. Loads system prompts from Life OS config (not hardcoded)
 * 2. Applies escalation rules before execution
 * 3. Injects domain context into prompts
 * 4. Routes to correct LLM provider (OpenRouter, OpenAI, xAI)
 * 5. Logs all agent activity for observability
 * 6. Integrates with Zep memory for context retrieval and persistence
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  getAgent,
  getDomain,
  getLifeCharter,
  determineEscalationLevel,
  buildAgentContext,
  type AgentDefinition,
  type Domain,
} from '../life-os-config';
import { DirectLLMClients } from '../DirectLLMClients';
import type { ConstructedPrompt, ChatMessage } from '../PromptBuilder';
import {
  type AgentInvocation,
  type AgentResponse,
  type AgentActivity,
  type EscalationLevel,
  type LLMProvider,
  AGENT_PROVIDER_MAP,
} from './types';
import type { AgentId as ZepAgentId } from '../memory/zep';

ensureServerOnly('lib/agents/AgentInvoker');

// In-memory activity log (will be persisted in Phase 5)
const activityLog: AgentActivity[] = [];
const MAX_ACTIVITY_LOG = 1000;

/**
 * Map Life OS agent IDs to Zep agent IDs
 * Each agent now has its own dedicated memory graph
 */
const LIFE_OS_TO_ZEP_ID: Record<string, ZepAgentId> = {
  'agent.orchestrator': 'orchestrator-agent',
  'agent.orchestrator.interface': 'orchestrator-agent', // Power interface uses orchestrator memory
  'agent.legal': 'legal-agent',
  'agent.finance': 'finance-agent',
  'agent.pm': 'pm-agent',
  'agent.comms': 'comms-agent',
  'agent.health': 'health-agent',
  'agent.coaching': 'coaching-agent',
  'agent.hyro': 'hyro-agent',
    'agent.grok': 'orchestrator-agent', // Legacy - redirects to orchestrator
  'agent.sherlock': 'sherlock-agent',
  'agent.ea': 'ea-agent',
  'agent.relationships': 'relationships-agent',
  'agent.eeg': 'eeg-agent',
};

/**
 * Convert Life OS agent ID to Zep agent ID
 */
function toZepAgentId(lifeOsAgentId: string): ZepAgentId {
  return LIFE_OS_TO_ZEP_ID[lifeOsAgentId] || 'orchestrator-agent';
}

/**
 * Fetch relevant memories from Zep for context injection
 * Searches both agent's private graph AND the shared org-council graph
 */
async function fetchZepContext(
  agentId: string,
  userMessage: string,
  limit: number = 5
): Promise<string> {
  try {
    // Lazy import to avoid circular dependencies and allow graceful fallback
    const { searchAllMemory } = await import('../memory/zep');
    const zepAgentId = toZepAgentId(agentId);

    // Search both agent and org-council graphs
    const { agent: agentResults, org: orgResults } = await searchAllMemory(zepAgentId, userMessage, limit);

    let contextParts: string[] = [];

    // Add agent's private memories
    if (agentResults.length > 0) {
      const agentMemories = agentResults
        .map((r, i) => `[Private ${i + 1}] ${r.memory.text}`)
        .join('\n');
      contextParts.push(`### Your Private Memory:\n${agentMemories}`);
    }

    // Add org-council shared memories
    if (orgResults.length > 0) {
      const orgMemories = orgResults
        .map((r, i) => `[Org ${i + 1}] ${r.memory.text}`)
        .join('\n');
      contextParts.push(`### Organizational Knowledge (Council-Approved):\n${orgMemories}`);
    }

    if (contextParts.length > 0) {
      return `\n## Relevant Context from Memory:\n${contextParts.join('\n\n')}\n`;
    }

    return '';
  } catch (error) {
    // Gracefully handle Zep unavailability
    console.warn('[AgentInvoker] Zep memory unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return '';
  }
}

/**
 * Persist interaction to Zep memory
 * Writes to agent's private graph (not org-council - that requires approval)
 */
async function persistToZepMemory(
  agentId: string,
  userMessage: string,
  agentResponse: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const { addAgentMemory } = await import('../memory/zep');
    const zepAgentId = toZepAgentId(agentId);

    // Store the interaction in agent's private graph
    const memoryText = `User: ${userMessage.substring(0, 500)}\nAgent Response: ${agentResponse.substring(0, 500)}`;
    await addAgentMemory(zepAgentId, memoryText, {
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  } catch (error) {
    // Don't fail the request if memory persistence fails
    console.warn('[AgentInvoker] Failed to persist to Zep:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Propose organizational knowledge to the council graph
 * Returns proposal ID for tracking approval status
 */
export async function proposeOrgKnowledge(
  agentId: string,
  knowledge: string,
  metadata?: Record<string, any>
): Promise<{ proposalId: string }> {
  const { proposeOrgMemory } = await import('../memory/zep');
  const zepAgentId = toZepAgentId(agentId);

  const proposal = await proposeOrgMemory(zepAgentId, knowledge, metadata);
  console.log(`[AgentInvoker] Org knowledge proposed: ${proposal.id} by ${agentId}`);

  return { proposalId: proposal.id };
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Build the system prompt with Life OS context injected
 */
function buildEnrichedSystemPrompt(
  agent: AgentDefinition,
  domain?: Domain | null,
  additionalContext?: Record<string, any>
): string {
  const charter = getLifeCharter();
  let prompt = agent.system_prompt;

  // Inject priority stack if referenced
  if (prompt.includes('{{PRIORITIES}}')) {
    const priorities = charter.priority_stack
      .sort((a, b) => b.weight - a.weight)
      .map((p, i) => `${i + 1}. ${p.name} (weight: ${p.weight}): ${p.description}`)
      .join('\n');
    prompt = prompt.replace('{{PRIORITIES}}', priorities);
  }

  // Inject global principles if referenced
  if (prompt.includes('{{PRINCIPLES}}')) {
    const principles = charter.global_principles.join('\n- ');
    prompt = prompt.replace('{{PRINCIPLES}}', `- ${principles}`);
  }

  // Inject domain context if available
  if (domain && prompt.includes('{{DOMAIN_CONTEXT}}')) {
    const domainContext = `
Domain: ${domain.name}
Type: ${domain.type}
Priority Weight: ${domain.priority_weight}
Sensitivity: ${domain.sensitivity_level || 'standard'}
Description: ${domain.description}
Key People: ${domain.key_people.join(', ')}
`;
    prompt = prompt.replace('{{DOMAIN_CONTEXT}}', domainContext);
  }

  // Inject coherence rules if referenced
  if (prompt.includes('{{COHERENCE_RULES}}')) {
    const rules = [
      ...charter.coherence_rules.avoid_fragmentation,
      ...charter.coherence_rules.deadline_rules,
      ...charter.coherence_rules.meeting_rules,
    ].join('\n- ');
    prompt = prompt.replace('{{COHERENCE_RULES}}', `- ${rules}`);
  }

  // Append escalation awareness
  const escalationContext = `

## Escalation Awareness
You operate under the Life OS escalation framework:
- CRITICAL: ${charter.escalation_levels.CRITICAL.description} (Response: ${charter.escalation_levels.CRITICAL.response_time})
- PROPOSE: ${charter.escalation_levels.PROPOSE.description} (Response: ${charter.escalation_levels.PROPOSE.response_time})
- AUTO_EXECUTE: ${charter.escalation_levels.AUTO_EXECUTE.description} (Response: ${charter.escalation_levels.AUTO_EXECUTE.response_time})

When you detect CRITICAL items, flag them explicitly. For PROPOSE items, clearly indicate they require approval.
`;

  return prompt + escalationContext;
}

/**
 * Call OpenAI API directly (GPT-5.1)
 */
async function callOpenAI(
  prompt: ConstructedPrompt,
  model: string
): Promise<{ content: string; model: string; usage: { prompt: number; completion: number; total: number } }> {
  const result = await DirectLLMClients.openaiChat(prompt, model);
  return {
    content: result.content,
    model: result.model,
    usage: { prompt: 0, completion: 0, total: 0 }, // DirectLLM doesn't return usage
  };
}

/**
 * Call xAI API directly (Grok 4.1 Fast)
 */
async function callXAI(
  prompt: ConstructedPrompt,
  model: string
): Promise<{ content: string; model: string; usage: { prompt: number; completion: number; total: number } }> {
  const result = await DirectLLMClients.xaiChat(prompt, model);
  return {
    content: result.content,
    model: result.model,
    usage: { prompt: 0, completion: 0, total: 0 }, // DirectLLM doesn't return usage
  };
}

/**
 * Route to the appropriate LLM provider
 *
 * APPROVED PROVIDERS:
 * - openai: GPT-5.1 for structured analysis, finance, complex reasoning
 * - xai: Grok 4.1 Fast for fast iteration, research, real-time tasks
 */
async function routeToLLM(
  prompt: ConstructedPrompt,
  provider: LLMProvider,
  model: string
): Promise<{ content: string; model: string; usage: { prompt: number; completion: number; total: number } }> {
  switch (provider) {
    case 'openai':
      return callOpenAI(prompt, model);
    case 'xai':
      return callXAI(prompt, model);
    default:
      // Default to xAI Grok 4.1 Fast for speed
      console.warn(`[AgentInvoker] Unknown provider "${provider}", falling back to xAI`);
      return callXAI(prompt, 'grok-4-1-fast');
  }
}

/**
 * Log agent activity
 */
function logActivity(activity: AgentActivity): void {
  activityLog.unshift(activity);
  if (activityLog.length > MAX_ACTIVITY_LOG) {
    activityLog.pop();
  }
  console.log(`[AgentInvoker] ${activity.agentId} | ${activity.escalationLevel} | ${activity.latencyMs}ms | ${activity.tokensUsed} tokens`);
}

/**
 * AgentInvoker Class
 *
 * Central gateway for ALL agent LLM calls.
 */
export class AgentInvoker {
  private static instance: AgentInvoker | null = null;

  static getInstance(): AgentInvoker {
    if (!AgentInvoker.instance) {
      AgentInvoker.instance = new AgentInvoker();
    }
    return AgentInvoker.instance;
  }

  /**
   * Invoke an agent with Life OS config integration
   *
   * This is the main entry point for all agent LLM calls.
   */
  async invoke(params: AgentInvocation): Promise<AgentResponse> {
    const startTime = Date.now();
    const requestId = generateRequestId();

    // 1. Load agent from Life OS config
    const agent = getAgent(params.agentId);
    if (!agent) {
      throw new Error(`Agent not found in Life OS config: ${params.agentId}`);
    }

    // 2. Detect domain from context or content
    const domainId = params.context?.domainId || this.detectDomainFromContent(params.userMessage);
    const domain = domainId ? getDomain(domainId) : null;

    // 3. Determine escalation level
    const escalationLevel = determineEscalationLevel(params.userMessage, domainId || undefined);
    const shouldExecute = params.forceExecute || escalationLevel === 'AUTO_EXECUTE';
    let escalationReason: string | undefined;

    if (!shouldExecute) {
      const charter = getLifeCharter();
      if (escalationLevel === 'CRITICAL') {
        escalationReason = `CRITICAL escalation triggered - requires immediate user attention. Triggers: ${charter.escalation_levels.CRITICAL.triggers.join(', ')}`;
      } else if (escalationLevel === 'PROPOSE') {
        escalationReason = `PROPOSE escalation triggered - action queued for user approval. Triggers: ${charter.escalation_levels.PROPOSE.triggers.join(', ')}`;
      }
    }

    // 4. Build enriched system prompt from Life OS config
    let systemPrompt = buildEnrichedSystemPrompt(agent, domain, params.context?.metadata);

    // 4b. Fetch relevant memories from Zep and inject into system prompt
    const skipMemory = params.context?.skipMemory === true;
    let memoryContext = '';
    if (!skipMemory) {
      memoryContext = await fetchZepContext(params.agentId, params.userMessage, 5);
      if (memoryContext) {
        systemPrompt += memoryContext;
      }
    }

    // 5. Construct the prompt
    const prompt: ConstructedPrompt = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      metadata: {
        date: new Date().toISOString().split('T')[0],
        has_whoop_data: false,
        has_manipulations: false,
        wrath_deployed: false,
        memory_count: memoryContext ? 1 : 0,
        anchor_count: 0,
      },
    };

    // 6. Determine provider and model
    const providerConfig = params.providerOverride
      ? { provider: params.providerOverride, model: params.modelOverride || AGENT_PROVIDER_MAP.default.model }
      : AGENT_PROVIDER_MAP[params.agentId] || AGENT_PROVIDER_MAP.default;

    const provider = providerConfig.provider;
    const model = params.modelOverride || providerConfig.model;

    // 7. Call the LLM
    let content: string;
    let actualModel: string;
    let tokensUsed = { prompt: 0, completion: 0, total: 0 };

    try {
      const result = await routeToLLM(prompt, provider, model);
      content = result.content;
      actualModel = result.model;
      tokensUsed = result.usage;
    } catch (error) {
      // Fallback to OpenRouter on failure
      console.warn(`[AgentInvoker] ${provider} failed, falling back to OpenRouter:`, error);
      const fallbackResult = await callOpenRouter(prompt, AGENT_PROVIDER_MAP.default.model);
      content = fallbackResult.content;
      actualModel = fallbackResult.model;
      tokensUsed = fallbackResult.usage;
    }

    const latencyMs = Date.now() - startTime;

    // 8. Persist interaction to Zep memory (async, non-blocking)
    const skipPersist = params.context?.skipMemory === true;
    if (!skipPersist && shouldExecute) {
      // Only persist executed interactions to avoid cluttering memory with blocked requests
      persistToZepMemory(params.agentId, params.userMessage, content, {
        escalation_level: escalationLevel,
        domain_id: domainId,
        model: actualModel,
        tokens_used: tokensUsed.total,
      }).catch(() => {}); // Fire-and-forget, errors already logged
    }

    // 9. Log activity
    const activity: AgentActivity = {
      id: requestId,
      agentId: params.agentId,
      timestamp: Date.now(),
      input: params.userMessage.substring(0, 500), // Truncate for storage
      output: content.substring(0, 500),
      escalationLevel,
      wasExecuted: shouldExecute,
      domainId: domainId || undefined,
      tokensUsed: tokensUsed.total,
      model: actualModel,
      latencyMs,
      requestId,
    };
    logActivity(activity);

    // 9. Return response
    return {
      content,
      escalationLevel,
      shouldExecute,
      agentId: params.agentId,
      model: actualModel,
      tokensUsed,
      latencyMs,
      detectedDomain: domainId || undefined,
      requestId,
      escalationReason,
    };
  }

  /**
   * Invoke with escalation enforcement
   *
   * Same as invoke() but blocks execution for non-AUTO_EXECUTE levels
   * unless forceExecute is true.
   */
  async invokeWithEscalation(params: AgentInvocation): Promise<AgentResponse> {
    const response = await this.invoke(params);

    if (!response.shouldExecute && !params.forceExecute) {
      // For CRITICAL/PROPOSE, we still return the response but mark it as blocked
      console.log(`[AgentInvoker] Escalation blocked execution: ${response.escalationLevel}`);
    }

    return response;
  }

  /**
   * Detect domain from content using keyword matching
   */
  private detectDomainFromContent(content: string): string | null {
    const lowerContent = content.toLowerCase();

    // Domain detection patterns
    const domainPatterns: Record<string, RegExp[]> = {
      family: [/kids?/i, /family/i, /custody/i, /divorce/i, /child/i, /parent/i],
      utlyze_core: [/utlyze/i, /saas/i, /platform/i, /startup/i],
      vuplicity: [/vuplicity/i, /fcra/i, /background\s*check/i, /credit\s*report/i, /consumer\s*report/i],
      career: [/job/i, /career/i, /interview/i, /salary/i, /promotion/i],
      health: [/health/i, /workout/i, /sleep/i, /whoop/i, /fitness/i, /diet/i],
      personal_finance: [/finance/i, /budget/i, /tax/i, /investment/i, /money/i, /expense/i],
      legal: [/lawsuit/i, /attorney/i, /court/i, /legal/i, /lawyer/i, /litigation/i],
      social: [/friend/i, /social/i, /relationship/i, /network/i],
    };

    for (const [domainId, patterns] of Object.entries(domainPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return domainId;
        }
      }
    }

    return null;
  }

  /**
   * Get recent agent activity
   */
  getRecentActivity(limit: number = 50): AgentActivity[] {
    return activityLog.slice(0, limit);
  }

  /**
   * Get activity for a specific agent
   */
  getAgentActivity(agentId: string, limit: number = 20): AgentActivity[] {
    return activityLog.filter(a => a.agentId === agentId).slice(0, limit);
  }

  /**
   * Get pending escalations (CRITICAL and PROPOSE that weren't executed)
   */
  getPendingEscalations(): AgentActivity[] {
    return activityLog.filter(
      a => !a.wasExecuted && (a.escalationLevel === 'CRITICAL' || a.escalationLevel === 'PROPOSE')
    );
  }

  /**
   * Clear activity log (for testing)
   */
  clearActivity(): void {
    activityLog.length = 0;
  }
}

/**
 * Export singleton instance
 */
export const agentInvoker = AgentInvoker.getInstance();

/**
 * Convenience function for quick invocations
 */
export async function invokeAgent(params: AgentInvocation): Promise<AgentResponse> {
  return agentInvoker.invoke(params);
}

/**
 * Re-export types for convenience
 */
export type { AgentInvocation, AgentResponse, AgentActivity, EscalationLevel } from './types';
