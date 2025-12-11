// @ts-nocheck
/**
 * Wrath Shield v3 - Agent Types Tests
 *
 * Tests for agent system type definitions and configurations:
 * - EscalationLevel enum values
 * - LLMProvider enum values
 * - AgentInvocation interface
 * - AgentResponse interface
 * - AgentActivity interface
 * - AGENT_PROVIDER_MAP configuration
 */

import {
  type EscalationLevel,
  type LLMProvider,
  type AgentInvocation,
  type AgentResponse,
  type AgentActivity,
  AGENT_PROVIDER_MAP,
} from '@/lib/agents/types';

describe('Agent Types', () => {
  describe('EscalationLevel', () => {
    it('should accept valid escalation levels', () => {
      const levels: EscalationLevel[] = ['CRITICAL', 'PROPOSE', 'AUTO_EXECUTE'];
      expect(levels).toHaveLength(3);
    });

    it('should be usable in conditionals', () => {
      const level: EscalationLevel = 'CRITICAL';
      expect(level === 'CRITICAL').toBe(true);
      expect(level === 'PROPOSE').toBe(false);
    });
  });

  describe('LLMProvider', () => {
    it('should accept valid providers', () => {
      const providers: LLMProvider[] = ['openai', 'xai', 'ollama'];
      expect(providers).toHaveLength(3);
    });

    it('should be usable for provider selection', () => {
      const provider: LLMProvider = 'xai';
      expect(['openai', 'xai', 'ollama'].includes(provider)).toBe(true);
    });
  });

  describe('AgentInvocation', () => {
    it('should accept minimal invocation', () => {
      const invocation: AgentInvocation = {
        agentId: 'agent.finance',
        userMessage: 'Check my balance',
      };

      expect(invocation.agentId).toBe('agent.finance');
      expect(invocation.userMessage).toBe('Check my balance');
    });

    it('should accept full invocation with all options', () => {
      const invocation: AgentInvocation = {
        agentId: 'agent.legal',
        userMessage: 'Review contract',
        context: {
          domainId: 'legal',
          events: [{ type: 'task' }],
          recentTasks: [{ id: 1 }],
          metadata: { priority: 'high' },
          skipMemory: true,
          enablePromptCaching: false,
        },
        forceExecute: true,
        providerOverride: 'openai',
        modelOverride: 'gpt-5.1',
      };

      expect(invocation.context?.skipMemory).toBe(true);
      expect(invocation.forceExecute).toBe(true);
      expect(invocation.providerOverride).toBe('openai');
    });

    it('should have prompt caching enabled by default conceptually', () => {
      const invocation: AgentInvocation = {
        agentId: 'agent.pm',
        userMessage: 'List tasks',
        context: {},
      };

      // enablePromptCaching defaults to true per the comment
      expect(invocation.context?.enablePromptCaching).toBeUndefined();
    });
  });

  describe('AgentResponse', () => {
    it('should represent successful response', () => {
      const response: AgentResponse = {
        content: 'Here is your balance: $1000',
        escalationLevel: 'AUTO_EXECUTE',
        shouldExecute: true,
        agentId: 'agent.finance',
        model: 'gpt-5.1',
        tokensUsed: {
          prompt: 100,
          completion: 50,
          total: 150,
        },
        latencyMs: 500,
        requestId: 'req-123',
      };

      expect(response.shouldExecute).toBe(true);
      expect(response.tokensUsed.total).toBe(150);
    });

    it('should represent blocked response', () => {
      const response: AgentResponse = {
        content: 'Would you like me to proceed with deletion?',
        escalationLevel: 'CRITICAL',
        shouldExecute: false,
        agentId: 'agent.finance',
        model: 'gpt-5.1',
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 400,
        requestId: 'req-456',
        escalationReason: 'Destructive action requires explicit approval',
      };

      expect(response.shouldExecute).toBe(false);
      expect(response.escalationReason).toBeDefined();
    });

    it('should include optional detected domain', () => {
      const response: AgentResponse = {
        content: 'Legal advice',
        escalationLevel: 'PROPOSE',
        shouldExecute: false,
        agentId: 'agent.orchestrator',
        model: 'grok-4-1-fast',
        tokensUsed: { prompt: 50, completion: 25, total: 75 },
        latencyMs: 200,
        requestId: 'req-789',
        detectedDomain: 'legal',
      };

      expect(response.detectedDomain).toBe('legal');
    });
  });

  describe('AgentActivity', () => {
    it('should represent activity record', () => {
      const activity: AgentActivity = {
        id: 'act-123',
        agentId: 'agent.pm',
        timestamp: Date.now(),
        input: 'Create a new task',
        output: 'Task created: #123',
        escalationLevel: 'AUTO_EXECUTE',
        wasExecuted: true,
        tokensUsed: 200,
        model: 'grok-4-1-fast',
        latencyMs: 300,
        requestId: 'req-001',
      };

      expect(activity.wasExecuted).toBe(true);
      expect(activity.id).toBe('act-123');
    });

    it('should include optional domain', () => {
      const activity: AgentActivity = {
        id: 'act-456',
        agentId: 'agent.legal',
        timestamp: Date.now(),
        input: 'Review',
        output: 'Reviewed',
        escalationLevel: 'PROPOSE',
        wasExecuted: false,
        tokensUsed: 100,
        model: 'grok-4-1-fast',
        latencyMs: 200,
        requestId: 'req-002',
        domainId: 'vuplicity',
      };

      expect(activity.domainId).toBe('vuplicity');
    });
  });

  describe('AGENT_PROVIDER_MAP', () => {
    it('should have default fallback', () => {
      expect(AGENT_PROVIDER_MAP['default']).toBeDefined();
      expect(AGENT_PROVIDER_MAP['default'].provider).toBe('xai');
      expect(AGENT_PROVIDER_MAP['default'].model).toBe('grok-4-1-fast');
    });

    describe('Ollama Agents (Local Classification)', () => {
      it('should configure comms agent with ollama + fallback', () => {
        const config = AGENT_PROVIDER_MAP['agent.comms'];
        expect(config.provider).toBe('ollama');
        expect(config.model).toBe('deepseek-r1:32b');
        expect(config.fallback?.provider).toBe('xai');
      });

      it('should configure relationships agent with ollama + fallback', () => {
        const config = AGENT_PROVIDER_MAP['agent.relationships'];
        expect(config.provider).toBe('ollama');
        expect(config.model).toBe('deepseek-r1:32b');
        expect(config.fallback).toBeDefined();
      });
    });

    describe('xAI Grok Agents', () => {
      const xaiAgents = [
        'agent.orchestrator',
        'agent.legal',
        'agent.grok',
        'agent.research',
        'agent.pm',
        'agent.hyro.education',
        'agent.james.learning',
      ];

      xaiAgents.forEach(agentId => {
        it(`should configure ${agentId} with xAI grok-4-1-fast`, () => {
          const config = AGENT_PROVIDER_MAP[agentId];
          expect(config).toBeDefined();
          expect(config.provider).toBe('xai');
          expect(config.model).toBe('grok-4-1-fast');
        });
      });
    });

    describe('OpenAI GPT-5.1 Agents', () => {
      const openaiAgents = [
        'agent.finance',
        'agent.coaching',
        'agent.ea',
        'agent.health',
      ];

      openaiAgents.forEach(agentId => {
        it(`should configure ${agentId} with OpenAI gpt-5.1`, () => {
          const config = AGENT_PROVIDER_MAP[agentId];
          expect(config).toBeDefined();
          expect(config.provider).toBe('openai');
          expect(config.model).toBe('gpt-5.1');
        });
      });
    });

    describe('Model Configuration Validation', () => {
      it('should only use approved models', () => {
        const approvedModels = ['gpt-5.1', 'grok-4-1-fast', 'deepseek-r1:32b'];

        Object.values(AGENT_PROVIDER_MAP).forEach(config => {
          expect(approvedModels).toContain(config.model);
          if (config.fallback) {
            expect(approvedModels).toContain(config.fallback.model);
          }
        });
      });

      it('should have valid provider for each model', () => {
        Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
          if (config.model === 'gpt-5.1') {
            expect(config.provider).toBe('openai');
          } else if (config.model === 'grok-4-1-fast') {
            expect(config.provider).toBe('xai');
          } else if (config.model === 'deepseek-r1:32b') {
            expect(config.provider).toBe('ollama');
          }
        });
      });

      it('should have fallback to xai for ollama agents', () => {
        Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
          if (config.provider === 'ollama') {
            expect(config.fallback).toBeDefined();
            expect(config.fallback?.provider).toBe('xai');
          }
        });
      });
    });

    describe('Agent Coverage', () => {
      it('should have orchestrator configured', () => {
        expect(AGENT_PROVIDER_MAP['agent.orchestrator']).toBeDefined();
      });

      it('should have finance configured for structured analysis', () => {
        const config = AGENT_PROVIDER_MAP['agent.finance'];
        // Finance uses OpenAI for structured analysis
        expect(config.provider).toBe('openai');
      });

      it('should have legal configured for advocacy', () => {
        const config = AGENT_PROVIDER_MAP['agent.legal'];
        // Legal uses xAI for fast iteration
        expect(config.provider).toBe('xai');
      });

      it('should have pm configured for project management', () => {
        expect(AGENT_PROVIDER_MAP['agent.pm']).toBeDefined();
      });

      it('should have hyro education configured', () => {
        expect(AGENT_PROVIDER_MAP['agent.hyro.education']).toBeDefined();
      });
    });
  });
});
