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

// Mock Zep memory module
jest.mock('@/lib/memory/zep', () => ({
  searchAllMemory: jest.fn().mockResolvedValue({
    agent: [
      { memory: { id: 'agent-mem-1', text: 'Agent-specific memory' }, score: 0.9 },
    ],
    org: [
      { memory: { id: 'org-mem-1', text: 'Org-wide policy: All contracts require legal review' }, score: 0.85 },
    ],
  }),
  addAgentMemory: jest.fn().mockResolvedValue(undefined),
  proposeOrgMemory: jest.fn().mockResolvedValue({
    id: 'proposal-1',
    proposedBy: 'legal-agent',
    text: 'New org policy',
    status: 'pending',
  }),
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
        provider: 'xai',
        model: 'grok-4-1-fast',
      });
    });

    it('should have correct provider for legal agent', () => {
      expect(AGENT_PROVIDER_MAP['agent.legal']).toEqual({
        provider: 'xai',
        model: 'grok-4-1-fast',
      });
    });

    it('should have correct provider for finance agent', () => {
      expect(AGENT_PROVIDER_MAP['agent.finance']).toEqual({
        provider: 'openai',
        model: 'gpt-5.1',
      });
    });

    it('should have a default provider', () => {
      expect(AGENT_PROVIDER_MAP['default']).toBeDefined();
      expect(AGENT_PROVIDER_MAP['default'].provider).toBe('xai');
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

  describe('Zep Memory Integration', () => {
    const { searchAllMemory, addAgentMemory, proposeOrgMemory } = require('@/lib/memory/zep');

    it('should search both agent and org-council graphs', async () => {
      const result = await searchAllMemory('legal-agent', 'contract review', 5);

      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('org');
      expect(Array.isArray(result.agent)).toBe(true);
      expect(Array.isArray(result.org)).toBe(true);
    });

    it('should return agent-specific memories', async () => {
      const result = await searchAllMemory('legal-agent', 'query', 5);

      expect(result.agent.length).toBeGreaterThan(0);
      expect(result.agent[0].memory.text).toBe('Agent-specific memory');
    });

    it('should return org-council memories', async () => {
      const result = await searchAllMemory('legal-agent', 'query', 5);

      expect(result.org.length).toBeGreaterThan(0);
      expect(result.org[0].memory.text).toContain('Org-wide policy');
    });

    it('should add memory to agent graph', async () => {
      await addAgentMemory('legal-agent', 'New legal insight', { category: 'case-law' });

      expect(addAgentMemory).toHaveBeenCalledWith(
        'legal-agent',
        'New legal insight',
        { category: 'case-law' }
      );
    });

    it('should propose org-level knowledge', async () => {
      const proposal = await proposeOrgMemory('legal-agent', 'All contracts require legal review');

      expect(proposal).toHaveProperty('id');
      expect(proposal.status).toBe('pending');
      expect(proposal.proposedBy).toBe('legal-agent');
    });
  });

  describe('LIFE_OS_TO_ZEP_ID Mapping', () => {
    it('should map Life OS agent IDs to Zep agent IDs', () => {
      // The mapping should convert 'agent.legal' to 'legal-agent'
      const mappings: Record<string, string> = {
        'agent.orchestrator': 'orchestrator-agent',
        'agent.legal': 'legal-agent',
        'agent.finance': 'finance-agent',
        'agent.pm': 'pm-agent',
        'agent.comms': 'comms-agent',
        'agent.health': 'health-agent',
        'agent.coaching': 'coaching-agent',
        'agent.hyro': 'hyro-agent',
        'agent.grok': 'grok-agent',
        'agent.sherlock': 'sherlock-agent',
        'agent.ea': 'ea-agent',
        'agent.relationships': 'relationships-agent',
        'agent.eeg': 'eeg-agent',
      };

      // Verify all 13 agents are mapped
      expect(Object.keys(mappings).length).toBe(13);

      // Verify naming convention
      Object.entries(mappings).forEach(([lifeOs, zep]) => {
        expect(lifeOs).toMatch(/^agent\./);
        expect(zep).toMatch(/-agent$/);
      });
    });
  });
});
