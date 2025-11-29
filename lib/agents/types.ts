/**
 * Agent System Types
 *
 * Core type definitions for the Life OS agent invocation system.
 */

export type EscalationLevel = 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';

export type LLMProvider = 'openrouter' | 'openai' | 'xai';

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
 */
export const AGENT_PROVIDER_MAP: Record<string, { provider: LLMProvider; model: string }> = {
  // Orchestrator and coaching use Claude via OpenRouter
  'agent.orchestrator': { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet:beta' },
  'agent.coaching': { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet:beta' },

  // Legal uses Grok for aggressive advocacy
  'agent.legal': { provider: 'xai', model: 'grok-3' },

  // Finance uses GPT for structured analysis
  'agent.finance': { provider: 'openai', model: 'gpt-4.1' },

  // Research uses Grok for fast iteration
  'agent.grok': { provider: 'xai', model: 'grok-3' },
  'agent.research': { provider: 'xai', model: 'grok-3' },

  // Personal agents use Claude
  'agent.ea': { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet:beta' },
  'agent.health': { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet:beta' },

  // Default fallback
  'default': { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet:beta' },
};
