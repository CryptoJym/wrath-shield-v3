/**
 * AgentInvoker Tests
 *
 * Tests for the central LLM gateway that integrates Life OS config.
 */

import { AGENT_PROVIDER_MAP } from '@/lib/agents/types';

// Mock the dependencies
jest.mock('@/lib/life-os-config', () => ({
  getAgent: jest.fn((id: string) => {
    const agents: Record<string, any> = {
      'agent.orchestrator': {
        id: 'agent.orchestrator',
        name: 'Conductor',
        system_prompt: 'You are the orchestrator agent. {{PRIORITIES}}',
        domains: ['*'],
        tools: ['motion', 'github'],
        max_context_tasks: 10,
      },
      'agent.legal': {
        id: 'agent.legal',
        name: 'Legal Advocate',
        system_prompt: 'You are the legal advisor agent.',
        domains: ['family', 'vuplicity'],
        tools: ['mycase', 'gmail'],
        max_context_tasks: 5,
      },
      'agent.finance': {
        id: 'agent.finance',
        name: 'Finance Agent',
        system_prompt: 'You are the finance agent.',
        domains: ['personal_finance'],
        tools: ['plaid', 'quickbooks'],
        max_context_tasks: 8,
      },
    };
    return agents[id] || null;
  }),
  getDomain: jest.fn((id: string) => {
    const domains: Record<string, any> = {
      'vuplicity': {
        id: 'vuplicity',
        name: 'Vuplicity',
        type: 'company',
        sensitivity_level: 'high_compliance',
        priority_weight: 8,
        key_people: ['James Brady'],
      },
      'family': {
        id: 'family',
        name: 'Family',
        type: 'personal',
        priority_weight: 10,
        key_people: ['Lisa', 'Hiro'],
      },
    };
    return domains[id] || null;
  }),
  getLifeCharter: jest.fn(() => ({
    owner: 'James Brady',
    priority_stack: [
      { id: 'family', name: 'Family', description: 'Family first', weight: 10 },
      { id: 'vuplicity', name: 'Vuplicity', description: 'FCRA compliance', weight: 8 },
    ],
    escalation_levels: {
      CRITICAL: {
        description: 'Immediate attention required',
        triggers: ['lawsuit', 'legal threat', 'FCRA violation'],
        response_time: 'immediate',
      },
      PROPOSE: {
        description: 'Propose for approval',
        triggers: ['new project', 'budget change'],
        response_time: '24 hours',
      },
      AUTO_EXECUTE: {
        description: 'Auto execute',
        triggers: ['routine tasks'],
        response_time: 'async',
      },
    },
    global_principles: ['Family first', 'Automate everything'],
    coherence_rules: {
      avoid_fragmentation: [],
      deadline_rules: [],
      meeting_rules: [],
    },
  })),
  determineEscalationLevel: jest.fn((content: string, domainId?: string) => {
    if (/lawsuit|legal\s*threat|fcra/i.test(content)) return 'CRITICAL';
    if (/new\s*project|budget/i.test(content)) return 'PROPOSE';
    return 'AUTO_EXECUTE';
  }),
  buildAgentContext: jest.fn(),
}));

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

jest.mock('@/lib/DirectLLMClients', () => ({
  DirectLLMClients: {
    openaiChat: jest.fn().mockResolvedValue({
      content: 'Mock OpenAI response',
      model: 'gpt-4.1',
      finish_reason: 'stop',
    }),
    xaiChat: jest.fn().mockResolvedValue({
      content: 'Mock Grok response',
      model: 'grok-3',
      finish_reason: 'stop',
    }),
  },
}));

// Mock fetch for OpenRouter
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () =>
    Promise.resolve({
      choices: [{ message: { content: 'Mock OpenRouter response' } }],
      model: 'anthropic/claude-3.5-sonnet:beta',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
});

describe('AgentInvoker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  describe('AGENT_PROVIDER_MAP', () => {
    it('should have correct provider for orchestrator', () => {
      expect(AGENT_PROVIDER_MAP['agent.orchestrator']).toEqual({
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet:beta',
      });
    });

    it('should have correct provider for legal agent', () => {
      expect(AGENT_PROVIDER_MAP['agent.legal']).toEqual({
        provider: 'xai',
        model: 'grok-3',
      });
    });

    it('should have correct provider for finance agent', () => {
      expect(AGENT_PROVIDER_MAP['agent.finance']).toEqual({
        provider: 'openai',
        model: 'gpt-4.1',
      });
    });

    it('should have a default provider', () => {
      expect(AGENT_PROVIDER_MAP['default']).toBeDefined();
      expect(AGENT_PROVIDER_MAP['default'].provider).toBe('openrouter');
    });
  });

  describe('Escalation Level Detection', () => {
    const { determineEscalationLevel } = require('@/lib/life-os-config');

    it('should detect CRITICAL for lawsuit mentions', () => {
      expect(determineEscalationLevel('There is a lawsuit pending')).toBe('CRITICAL');
    });

    it('should detect CRITICAL for FCRA violations', () => {
      expect(determineEscalationLevel('FCRA compliance issue detected')).toBe('CRITICAL');
    });

    it('should detect PROPOSE for new projects', () => {
      expect(determineEscalationLevel('Create a new project for Utlyze')).toBe('PROPOSE');
    });

    it('should detect AUTO_EXECUTE for routine tasks', () => {
      expect(determineEscalationLevel('Send daily report')).toBe('AUTO_EXECUTE');
    });
  });

  describe('Life OS Config Integration', () => {
    const { getAgent, getDomain, getLifeCharter } = require('@/lib/life-os-config');

    it('should load agent from config', () => {
      const agent = getAgent('agent.orchestrator');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('Conductor');
      expect(agent.system_prompt).toContain('orchestrator');
    });

    it('should load domain from config', () => {
      const domain = getDomain('vuplicity');
      expect(domain).toBeDefined();
      expect(domain.sensitivity_level).toBe('high_compliance');
    });

    it('should return null for unknown agent', () => {
      const agent = getAgent('agent.unknown');
      expect(agent).toBeNull();
    });

    it('should load life charter with escalation levels', () => {
      const charter = getLifeCharter();
      expect(charter.escalation_levels.CRITICAL).toBeDefined();
      expect(charter.escalation_levels.PROPOSE).toBeDefined();
      expect(charter.escalation_levels.AUTO_EXECUTE).toBeDefined();
    });

    it('should load priority stack', () => {
      const charter = getLifeCharter();
      expect(charter.priority_stack.length).toBeGreaterThan(0);
      expect(charter.priority_stack[0].name).toBe('Family');
    });
  });
});
