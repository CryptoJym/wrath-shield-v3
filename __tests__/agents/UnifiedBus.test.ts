/**
 * UnifiedBus Unit Tests
 *
 * Tests the core UnifiedBus functionality for full org access.
 * These are unit tests that mock external dependencies (Zep, AgentInvoker).
 */

import {
  getUnifiedBus,
  UnifiedBus,
  LIFE_OS_TO_ZEP,
  AGENT_NAMES,
  AGENT_ALIASES,
  type LifeOSAgentId,
} from '@/lib/agents/UnifiedBus';

// Mock the server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgents: jest.fn(() => ({
    agents: [
      { id: 'agent.orchestrator', name: 'Conductor', tools: ['invoke_agent', 'query_memory'] },
      { id: 'agent.legal', name: 'Legal Advocate', tools: ['legal_search'] },
      { id: 'agent.finance', name: 'Finance Analyst', tools: ['transaction_analysis'] },
      { id: 'agent.pm', name: 'Project Maestro', tools: ['task_management'] },
    ],
  })),
}));

// Mock agent types
jest.mock('@/lib/agents/types', () => ({
  AGENT_PROVIDER_MAP: {
    'agent.orchestrator': { provider: 'xai', model: 'grok-4-1-fast' },
    'agent.legal': { provider: 'xai', model: 'grok-4-1-fast' },
    'agent.finance': { provider: 'openai', model: 'gpt-5.1' },
    'agent.pm': { provider: 'xai', model: 'grok-4-1-fast' },
    'default': { provider: 'xai', model: 'grok-4-1-fast' },
  },
}));

describe('UnifiedBus', () => {
  let bus: ReturnType<typeof getUnifiedBus>;

  beforeEach(() => {
    // Reset singleton for each test
    jest.resetModules();
    bus = getUnifiedBus();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const bus1 = getUnifiedBus();
      const bus2 = getUnifiedBus();
      expect(bus1).toBe(bus2);
    });
  });

  describe('Agent ID Resolution', () => {
    it('should resolve full agent IDs', () => {
      expect(bus.resolveAgentId('agent.legal')).toBe('agent.legal');
      expect(bus.resolveAgentId('agent.finance')).toBe('agent.finance');
    });

    it('should resolve agent aliases', () => {
      expect(bus.resolveAgentId('legal')).toBe('agent.legal');
      expect(bus.resolveAgentId('finance')).toBe('agent.finance');
      expect(bus.resolveAgentId('pm')).toBe('agent.pm');
      expect(bus.resolveAgentId('coach')).toBe('agent.coaching');
    });

    it('should resolve @mention syntax', () => {
      expect(bus.resolveAgentId('@legal')).toBe('agent.legal');
      expect(bus.resolveAgentId('@finance')).toBe('agent.finance');
    });

    it('should be case-insensitive', () => {
      expect(bus.resolveAgentId('LEGAL')).toBe('agent.legal');
      expect(bus.resolveAgentId('Finance')).toBe('agent.finance');
      expect(bus.resolveAgentId('@LEGAL')).toBe('agent.legal');
    });

    it('should return null for unknown agents', () => {
      expect(bus.resolveAgentId('unknown')).toBeNull();
      expect(bus.resolveAgentId('@nonexistent')).toBeNull();
    });
  });

  describe('Parse Agent Mentions', () => {
    it('should parse single @mention', () => {
      const mentions = bus.parseAgentMentions('@legal check this contract');
      expect(mentions).toEqual(['agent.legal']);
    });

    it('should parse multiple @mentions', () => {
      const mentions = bus.parseAgentMentions('@legal and @finance review the budget');
      expect(mentions).toContain('agent.legal');
      expect(mentions).toContain('agent.finance');
      expect(mentions.length).toBe(2);
    });

    it('should deduplicate @mentions', () => {
      const mentions = bus.parseAgentMentions('@legal @legal @legal');
      expect(mentions).toEqual(['agent.legal']);
    });

    it('should return empty array for no mentions', () => {
      const mentions = bus.parseAgentMentions('no mentions here');
      expect(mentions).toEqual([]);
    });

    it('should ignore invalid @mentions', () => {
      const mentions = bus.parseAgentMentions('@unknown @legal @invalid');
      expect(mentions).toEqual(['agent.legal']);
    });
  });

  describe('Agent State Management', () => {
    it('should get all agent states', () => {
      const states = bus.getAllAgentStates();
      expect(Array.isArray(states)).toBe(true);
      expect(states.length).toBeGreaterThan(0);
    });

    it('should get single agent state', () => {
      const state = bus.getAgentState('agent.orchestrator');
      expect(state).toBeDefined();
      expect(state?.agentId).toBe('agent.orchestrator');
      expect(state?.status).toBeDefined();
    });

    it('should return null for unknown agent', () => {
      const state = bus.getAgentState('agent.unknown' as LifeOSAgentId);
      expect(state).toBeNull();
    });

    it('should update agent state', () => {
      bus.updateAgentState('agent.legal', { status: 'busy', currentTask: 'Test task' });
      const state = bus.getAgentState('agent.legal');
      expect(state?.status).toBe('busy');
      expect(state?.currentTask).toBe('Test task');
    });

    it('should update lastActivity on state change', async () => {
      const before = bus.getAgentState('agent.legal')?.lastActivity;
      // Wait a small amount to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      bus.updateAgentState('agent.legal', { status: 'idle' });
      const after = bus.getAgentState('agent.legal')?.lastActivity;
      // lastActivity should be updated (newer timestamp or same if within same ms)
      expect(after).toBeDefined();
      expect(new Date(after!).getTime()).toBeGreaterThanOrEqual(new Date(before!).getTime());
    });
  });

  describe('Activity Logging', () => {
    it('should log activity', () => {
      bus.logActivity('agent.legal', 'test_action');
      const activity = bus.getRecentActivity(1);
      expect(activity.length).toBe(1);
      expect(activity[0].agentId).toBe('agent.legal');
      expect(activity[0].action).toBe('test_action');
    });

    it('should limit activity log to max size', () => {
      // Log many activities
      for (let i = 0; i < 600; i++) {
        bus.logActivity('agent.legal', `action_${i}`);
      }
      const activity = bus.getRecentActivity(1000);
      expect(activity.length).toBeLessThanOrEqual(500);
    });

    it('should return recent activities in reverse chronological order', () => {
      bus.logActivity('agent.legal', 'first');
      bus.logActivity('agent.legal', 'second');
      bus.logActivity('agent.legal', 'third');
      const activity = bus.getRecentActivity(3);
      expect(activity[0].action).toBe('third');
      expect(activity[2].action).toBe('first');
    });
  });
});

describe('UnifiedBus Mappings', () => {
  describe('LIFE_OS_TO_ZEP mapping', () => {
    it('should have all major agents mapped', () => {
      expect(LIFE_OS_TO_ZEP['agent.orchestrator']).toBe('orchestrator-agent');
      expect(LIFE_OS_TO_ZEP['agent.legal']).toBe('legal-agent');
      expect(LIFE_OS_TO_ZEP['agent.finance']).toBe('finance-agent');
      expect(LIFE_OS_TO_ZEP['agent.pm']).toBe('pm-agent');
    });
  });

  describe('AGENT_NAMES mapping', () => {
    it('should have human-readable names', () => {
      expect(AGENT_NAMES['agent.orchestrator']).toBe('Conductor');
      expect(AGENT_NAMES['agent.legal']).toBe('Legal Advocate');
      expect(AGENT_NAMES['agent.finance']).toBe('Finance Analyst');
    });
  });

  describe('AGENT_ALIASES', () => {
    it('should have common aliases', () => {
      expect(AGENT_ALIASES['conductor']).toBe('agent.orchestrator');
      expect(AGENT_ALIASES['legal']).toBe('agent.legal');
      expect(AGENT_ALIASES['finance']).toBe('agent.finance');
      expect(AGENT_ALIASES['coach']).toBe('agent.coaching');
      expect(AGENT_ALIASES['fcra']).toBe('agent.vuplicity');
    });
  });
});
