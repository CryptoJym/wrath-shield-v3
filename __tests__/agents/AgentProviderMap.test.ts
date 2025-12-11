/**
 * Agent Provider Map Tests
 *
 * Validates that agent-to-model mappings are correct and only use approved models.
 */

import { AGENT_PROVIDER_MAP, LLMProvider } from '@/lib/agents/types';

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('AGENT_PROVIDER_MAP', () => {
  // Updated to include Ollama and DeepSeek for local model support
  const APPROVED_MODELS = ['grok-4-1-fast', 'gpt-5.1', 'deepseek-r1:32b'];
  const APPROVED_PROVIDERS: LLMProvider[] = ['xai', 'openai', 'ollama'];

  describe('Model Compliance', () => {
    it('should only use approved models', () => {
      Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
        expect(APPROVED_MODELS).toContain(config.model);
      });
    });

    it('should only use approved providers', () => {
      Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
        expect(APPROVED_PROVIDERS).toContain(config.provider);
      });
    });

    it('should not use OpenRouter', () => {
      Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
        expect(config.provider).not.toBe('openrouter');
      });
    });

    it('should not use Claude models', () => {
      Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
        expect(config.model).not.toContain('claude');
        expect(config.model).not.toContain('anthropic');
      });
    });

    it('should not use old Grok models', () => {
      Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
        expect(config.model).not.toBe('grok-3');
        expect(config.model).not.toBe('grok-2');
      });
    });

    it('should not use old GPT models', () => {
      Object.entries(AGENT_PROVIDER_MAP).forEach(([agentId, config]) => {
        expect(config.model).not.toBe('gpt-4.1');
        expect(config.model).not.toBe('gpt-4');
        // gpt-5.1 is now approved for structured analysis
      });
    });
  });

  describe('Required Agent Mappings', () => {
    // Updated agent IDs to match new naming convention
    const requiredAgents = [
      'agent.orchestrator',
      'agent.legal',
      'agent.finance',
      'agent.pm',
      'agent.comms',  // renamed from agent.ea (inbox)
      'agent.health',
      'agent.coaching',
      'agent.hyro.education',  // renamed from agent.hyro
      'agent.grok',
      'agent.research',
      'agent.ea',  // NEW - Executive Assistant (calendar/scheduling)
    ];

    it('should have all required agents mapped', () => {
      requiredAgents.forEach((agentId) => {
        expect(AGENT_PROVIDER_MAP[agentId]).toBeDefined();
      });
    });

    it('should have a default fallback', () => {
      expect(AGENT_PROVIDER_MAP['default']).toBeDefined();
    });
  });

  describe('Specific Agent Assignments', () => {
    it('should assign orchestrator to Grok 4.1 Fast', () => {
      expect(AGENT_PROVIDER_MAP['agent.orchestrator'].provider).toBe('xai');
      expect(AGENT_PROVIDER_MAP['agent.orchestrator'].model).toBe('grok-4-1-fast');
    });

    it('should assign legal to Grok 4.1 Fast (fast advocacy)', () => {
      expect(AGENT_PROVIDER_MAP['agent.legal'].provider).toBe('xai');
      expect(AGENT_PROVIDER_MAP['agent.legal'].model).toBe('grok-4-1-fast');
    });

    it('should assign finance to GPT-5.1 (structured analysis)', () => {
      expect(AGENT_PROVIDER_MAP['agent.finance'].provider).toBe('openai');
      expect(AGENT_PROVIDER_MAP['agent.finance'].model).toBe('gpt-5.1');
    });

    it('should assign coaching to GPT-5.1 (complex reasoning)', () => {
      expect(AGENT_PROVIDER_MAP['agent.coaching'].provider).toBe('openai');
      expect(AGENT_PROVIDER_MAP['agent.coaching'].model).toBe('gpt-5.1');
    });

    it('should use Grok 4.1 Fast as default fallback', () => {
      expect(AGENT_PROVIDER_MAP['default'].provider).toBe('xai');
      expect(AGENT_PROVIDER_MAP['default'].model).toBe('grok-4-1-fast');
    });
  });

  describe('Provider Distribution', () => {
    it('should have balanced distribution across providers', () => {
      const providers = Object.values(AGENT_PROVIDER_MAP).map((c) => c.provider);
      const xaiCount = providers.filter((p) => p === 'xai').length;
      const openaiCount = providers.filter((p) => p === 'openai').length;

      // Both providers should be used
      expect(xaiCount).toBeGreaterThan(0);
      expect(openaiCount).toBeGreaterThan(0);
    });
  });
});
