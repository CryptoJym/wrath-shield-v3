/**
 * Agent System Types
 *
 * Core type definitions for the Life OS agent invocation system.
 */

export type EscalationLevel = 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';

export type LLMProvider = 'openai' | 'xai';

export interface AgentInvocation {
  /** Agent ID from Life OS config (e.g., 'agent.finance', 'agent.legal') */
  agentId: string;

  /** The user message or task to process */
  userMessage: string;

  /** Optional context to inject */
  context?: {
    domainId?: string;
    events?: any[];
    recentTasks?: any[];
    metadata?: Record<string, any>;
    /** Skip Zep memory retrieval and persistence for this invocation */
    skipMemory?: boolean;
  };

  /** Skip escalation check and force execution */
  forceExecute?: boolean;

  /** Override the default LLM provider for this invocation */
  providerOverride?: LLMProvider;

  /** Override the default model for this invocation */
  modelOverride?: string;
}

export interface AgentResponse {
  /** The generated content from the LLM */
  content: string;

  /** The escalation level determined for this request */
  escalationLevel: EscalationLevel;

  /** Whether the action should be executed (based on escalation rules) */
  shouldExecute: boolean;

  /** The agent that processed this request */
  agentId: string;

  /** The LLM model used */
  model: string;

  /** Token usage statistics */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Latency in milliseconds */
  latencyMs: number;

  /** Detected domain for routing */
  detectedDomain?: string;

  /** Unique request ID for tracking */
  requestId: string;

  /** If escalation blocked execution, this explains why */
  escalationReason?: string;
}

export interface AgentActivity {
  id: string;
  agentId: string;
  timestamp: number;
  input: string;
  output: string;
  escalationLevel: EscalationLevel;
  wasExecuted: boolean;
  domainId?: string;
  tokensUsed: number;
  model: string;
  latencyMs: number;
  requestId: string;
}

/**
 * Agent-specific provider configuration
 * Maps agent IDs to their preferred LLM providers
 *
 * APPROVED MODELS ONLY:
 * - OpenAI: gpt-5.1 (for structured analysis, finance, complex reasoning)
 * - xAI: grok-4-1-fast (for fast iteration, research, legal advocacy)
 */
export const AGENT_PROVIDER_MAP: Record<string, { provider: LLMProvider; model: string }> = {
  // === xAI Grok 4.1 Fast ===
  // Fast iteration, research, advocacy, real-time tasks
  'agent.orchestrator': { provider: 'xai', model: 'grok-4-1-fast' },
  'agent.legal': { provider: 'xai', model: 'grok-4-1-fast' },
  'agent.grok': { provider: 'xai', model: 'grok-4-1-fast' },
  'agent.research': { provider: 'xai', model: 'grok-4-1-fast' },
  'agent.comms': { provider: 'xai', model: 'grok-4-1-fast' },
  'agent.pm': { provider: 'xai', model: 'grok-4-1-fast' },
  'agent.hyro': { provider: 'xai', model: 'grok-4-1-fast' },

  // === OpenAI GPT-5.1 ===
  // Structured analysis, complex reasoning, financial work
  'agent.finance': { provider: 'openai', model: 'gpt-5.1' },
  'agent.coaching': { provider: 'openai', model: 'gpt-5.1' },
  'agent.ea': { provider: 'openai', model: 'gpt-5.1' },
  'agent.health': { provider: 'openai', model: 'gpt-5.1' },

  // Default fallback - Grok for speed
  'default': { provider: 'xai', model: 'openai/gpt-5.1' },
};
