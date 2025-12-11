// @ts-nocheck
/**
 * Wrath Shield v3 - Unified Bus Tests
 *
 * Tests for the Unified Bus that provides Conductor with full org access:
 * - Cross-agent memory access (read/write)
 * - Agent state tracking
 * - Direct agent invocation
 * - Broadcast messaging
 * - @mention parsing and routing
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgents: jest.fn().mockReturnValue({
    agents: [
      { id: 'agent.orchestrator', name: 'Conductor', tools: ['memory'], domains: ['*'] },
      { id: 'agent.legal', name: 'Legal Advocate', tools: ['mycase'], domains: ['legal'] },
      { id: 'agent.finance', name: 'Finance Analyst', tools: ['plaid'], domains: ['finance'] },
      { id: 'agent.pm', name: 'Project Maestro', tools: ['github'], domains: ['pm'] },
      { id: 'agent.comms', name: 'Comms Scout', tools: ['gmail'], domains: ['comms'] },
    ],
  }),
}));

// Mock agent types
jest.mock('@/lib/agents/types', () => ({
  AGENT_PROVIDER_MAP: {
    'agent.orchestrator': { model: 'gpt-4o', provider: 'openai' },
    'agent.legal': { model: 'grok-3', provider: 'xai' },
    default: { model: 'gpt-4o', provider: 'openai' },
  },
}));

// Mock Zep memory
const mockSearchAgentMemory = jest.fn().mockResolvedValue([
  {
    memory: { id: 'mem-1', text: 'Test memory', metadata: {}, createdAt: '2025-01-01T00:00:00Z' },
    score: 0.9,
  },
]);
const mockAddAgentMemory = jest.fn().mockResolvedValue({ success: true });
const mockSearchOrgMemory = jest.fn().mockResolvedValue([]);
const mockAddOrgMemory = jest.fn().mockResolvedValue({ success: true });
const mockGetProposalCounts = jest.fn().mockReturnValue({ approved: 100, pending: 5 });

jest.mock('@/lib/memory/zep', () => ({
  searchAgentMemory: mockSearchAgentMemory,
  addAgentMemory: mockAddAgentMemory,
  searchOrgMemory: mockSearchOrgMemory,
  addOrgMemory: mockAddOrgMemory,
  getProposalCounts: mockGetProposalCounts,
}));

// Mock AgentInvoker
const mockInvokeAgent = jest.fn().mockResolvedValue({
  content: 'Agent response',
  escalationLevel: 'AUTO_EXECUTE',
  shouldExecute: true,
  model: 'gpt-4o',
});
const mockGetPendingEscalations = jest.fn().mockReturnValue([]);

jest.mock('@/lib/agents/AgentInvoker', () => ({
  invokeAgent: mockInvokeAgent,
  agentInvoker: {
    getPendingEscalations: mockGetPendingEscalations,
  },
}));

// Mock agent_bus
jest.mock('@/lib/agent_bus', () => ({
  detectDomain: jest.fn().mockReturnValue('legal'),
  routeToAgents: jest.fn().mockReturnValue(['legal-agent']),
}));

import {
  getUnifiedBus,
  LIFE_OS_TO_ZEP,
  AGENT_NAMES,
  AGENT_ALIASES,
  type LifeOSAgentId,
} from '@/lib/agents/UnifiedBus';

describe('Unified Bus', () => {
  let bus: ReturnType<typeof getUnifiedBus>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh instance by clearing module cache would be ideal,
    // but for singleton we'll work with it
    bus = getUnifiedBus();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const bus1 = getUnifiedBus();
      const bus2 = getUnifiedBus();
      expect(bus1).toBe(bus2);
    });
  });

  describe('Agent ID Resolution', () => {
    it('should resolve agent aliases to full IDs', () => {
      expect(bus.resolveAgentId('conductor')).toBe('agent.orchestrator');
      expect(bus.resolveAgentId('legal')).toBe('agent.legal');
      expect(bus.resolveAgentId('finance')).toBe('agent.finance');
      expect(bus.resolveAgentId('pm')).toBe('agent.pm');
    });

    it('should handle @ prefix', () => {
      expect(bus.resolveAgentId('@legal')).toBe('agent.legal');
      expect(bus.resolveAgentId('@conductor')).toBe('agent.orchestrator');
    });

    it('should handle agent. prefix', () => {
      expect(bus.resolveAgentId('agent.legal')).toBe('agent.legal');
      expect(bus.resolveAgentId('agent.orchestrator')).toBe('agent.orchestrator');
    });

    it('should be case insensitive', () => {
      expect(bus.resolveAgentId('LEGAL')).toBe('agent.legal');
      expect(bus.resolveAgentId('Conductor')).toBe('agent.orchestrator');
    });

    it('should return null for unknown aliases', () => {
      expect(bus.resolveAgentId('unknown-agent')).toBeNull();
      expect(bus.resolveAgentId('not-an-agent')).toBeNull();
    });

    it('should support alternative aliases', () => {
      expect(bus.resolveAgentId('coach')).toBe('agent.coaching');
      expect(bus.resolveAgentId('research')).toBe('agent.grok');
      expect(bus.resolveAgentId('assistant')).toBe('agent.ea');
      expect(bus.resolveAgentId('fcra')).toBe('agent.vuplicity');
    });
  });

  describe('@Mention Parsing', () => {
    it('should parse single @mention', () => {
      const mentions = bus.parseAgentMentions('Hey @legal can you help?');
      expect(mentions).toEqual(['agent.legal']);
    });

    it('should parse multiple @mentions', () => {
      const mentions = bus.parseAgentMentions('@legal and @finance please review');
      expect(mentions).toContain('agent.legal');
      expect(mentions).toContain('agent.finance');
    });

    it('should deduplicate mentions', () => {
      const mentions = bus.parseAgentMentions('@legal @legal @legal');
      expect(mentions).toEqual(['agent.legal']);
    });

    it('should return empty array for no mentions', () => {
      const mentions = bus.parseAgentMentions('No mentions here');
      expect(mentions).toEqual([]);
    });

    it('should ignore invalid mentions', () => {
      const mentions = bus.parseAgentMentions('@unknown-agent help');
      expect(mentions).toEqual([]);
    });

    it('should handle mixed valid and invalid mentions', () => {
      const mentions = bus.parseAgentMentions('@legal @unknown @finance');
      expect(mentions).toContain('agent.legal');
      expect(mentions).toContain('agent.finance');
      expect(mentions).not.toContain('unknown');
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
      expect(state?.name).toBe('Conductor');
    });

    it('should return null for unknown agent', () => {
      const state = bus.getAgentState('agent.unknown' as LifeOSAgentId);
      expect(state).toBeNull();
    });

    it('should update agent state', () => {
      bus.updateAgentState('agent.orchestrator', { status: 'busy', currentTask: 'Testing' });
      const state = bus.getAgentState('agent.orchestrator');
      expect(state?.status).toBe('busy');
      expect(state?.currentTask).toBe('Testing');
    });

    it('should update lastActivity on state change', () => {
      const before = bus.getAgentState('agent.orchestrator')?.lastActivity;
      bus.updateAgentState('agent.orchestrator', { status: 'idle' });
      const after = bus.getAgentState('agent.orchestrator')?.lastActivity;
      expect(new Date(after!).getTime()).toBeGreaterThanOrEqual(new Date(before!).getTime());
    });
  });

  describe('Activity Logging', () => {
    it('should log activity', () => {
      bus.logActivity('agent.legal', 'test_action');
      const activity = bus.getRecentActivity(1);
      expect(activity[0].agentId).toBe('agent.legal');
      expect(activity[0].action).toBe('test_action');
    });

    it('should maintain activity order (most recent first)', () => {
      bus.logActivity('agent.legal', 'action_1');
      bus.logActivity('agent.finance', 'action_2');
      const activity = bus.getRecentActivity(2);
      expect(activity[0].action).toBe('action_2');
      expect(activity[1].action).toBe('action_1');
    });

    it('should limit activity log size', () => {
      // Log more than max (500)
      for (let i = 0; i < 510; i++) {
        bus.logActivity('agent.orchestrator', `action_${i}`);
      }
      const activity = bus.getRecentActivity(1000);
      expect(activity.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Memory Access', () => {
    describe('readAgentMemory', () => {
      it('should read agent memory', async () => {
        const memories = await bus.readAgentMemory('agent.legal', 'test query', 5);
        expect(mockSearchAgentMemory).toHaveBeenCalledWith('legal-agent', 'test query', 5);
        expect(memories.length).toBeGreaterThan(0);
        expect(memories[0].text).toBe('Test memory');
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Network error'));
        const memories = await bus.readAgentMemory('agent.legal', 'test query');
        expect(memories).toEqual([]);
      });

      it('should throw for unknown agent', async () => {
        await expect(
          bus.readAgentMemory('agent.unknown' as LifeOSAgentId, 'query')
        ).rejects.toThrow('Unknown agent');
      });
    });

    describe('writeAgentMemory', () => {
      it('should write agent memory', async () => {
        const result = await bus.writeAgentMemory('agent.legal', 'New memory', { key: 'value' });
        expect(result).toBe(true);
        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'legal-agent',
          'New memory',
          expect.objectContaining({
            key: 'value',
            written_by: 'conductor',
          })
        );
      });

      it('should return false on error', async () => {
        mockAddAgentMemory.mockRejectedValueOnce(new Error('Write failed'));
        const result = await bus.writeAgentMemory('agent.legal', 'Test');
        expect(result).toBe(false);
      });
    });

    describe('searchAllAgentMemories', () => {
      it('should search all agents in parallel', async () => {
        const results = await bus.searchAllAgentMemories('global query', 3);
        expect(typeof results).toBe('object');
      });
    });

    describe('readOrgMemory', () => {
      it('should read org memory', async () => {
        mockSearchOrgMemory.mockResolvedValueOnce([
          { memory: { id: 'org-1', text: 'Org memory', metadata: {} }, score: 0.95 },
        ]);
        const memories = await bus.readOrgMemory('org query', 5);
        expect(mockSearchOrgMemory).toHaveBeenCalled();
      });
    });

    describe('writeOrgMemory', () => {
      it('should write org memory with conductor privilege', async () => {
        const result = await bus.writeOrgMemory('Important org memory', { type: 'policy' });
        expect(mockAddOrgMemory).toHaveBeenCalledWith(
          'Important org memory',
          expect.objectContaining({
            type: 'policy',
            written_by: 'conductor',
            direct_write: true,
          })
        );
      });
    });
  });

  describe('Direct Agent Invocation', () => {
    it('should invoke agent directly', async () => {
      const response = await bus.invokeAgent({
        agentId: 'agent.legal',
        message: 'Help with legal matter',
        priority: 'high',
      });

      expect(response.success).toBe(true);
      expect(response.agentId).toBe('agent.legal');
      expect(response.response).toBe('Agent response');
    });

    it('should handle invoke failure', async () => {
      mockInvokeAgent.mockRejectedValueOnce(new Error('Agent unavailable'));

      const response = await bus.invokeAgent({
        agentId: 'agent.legal',
        message: 'Test',
      });

      expect(response.success).toBe(false);
      expect(response.escalationLevel).toBe('CRITICAL');
    });

    it('should update agent state during invocation', async () => {
      const invokePromise = bus.invokeAgent({
        agentId: 'agent.pm',
        message: 'Project update',
      });

      // State should be updated after invocation completes
      await invokePromise;
      const state = bus.getAgentState('agent.pm');
      expect(state?.status).toBe('idle');
    });

    it('should force execute for critical priority', async () => {
      await bus.invokeAgent({
        agentId: 'agent.legal',
        message: 'Urgent matter',
        priority: 'critical',
      });

      expect(mockInvokeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          forceExecute: true,
        })
      );
    });
  });

  describe('Broadcast Messaging', () => {
    it('should broadcast to all agents except orchestrator', async () => {
      const response = await bus.broadcast({
        message: 'System announcement',
        priority: 'high',
      });

      expect(response.success).toBe(true);
      expect(response.totalAgents).toBeGreaterThan(0);
      // Should not include orchestrator
      const targetedAgents = response.responses.map(r => r.agentId);
      expect(targetedAgents).not.toContain('agent.orchestrator');
    });

    it('should broadcast to specific agents', async () => {
      const response = await bus.broadcast({
        message: 'Targeted message',
        priority: 'normal',
        targetAgents: ['agent.legal', 'agent.finance'],
      });

      expect(response.totalAgents).toBe(2);
    });

    it('should report success and failure counts', async () => {
      mockInvokeAgent
        .mockResolvedValueOnce({ content: 'OK', escalationLevel: 'AUTO_EXECUTE', shouldExecute: true, model: 'gpt-4o' })
        .mockRejectedValueOnce(new Error('Failed'));

      const response = await bus.broadcast({
        message: 'Test',
        priority: 'normal',
        targetAgents: ['agent.legal', 'agent.finance'],
      });

      expect(response.successCount + response.failCount).toBe(response.totalAgents);
    });
  });

  describe('Message Routing', () => {
    it('should route to @mentioned agent', async () => {
      const result = await bus.routeMessage('@legal help with contract');
      expect(result?.agentId).toBe('agent.legal');
    });

    it('should use domain detection when no mentions', async () => {
      const { detectDomain, routeToAgents } = require('@/lib/agent_bus');
      detectDomain.mockReturnValue('legal');
      routeToAgents.mockReturnValue(['legal-agent']);

      const result = await bus.routeMessage('I need legal advice');
      expect(result).toBeDefined();
    });

    it('should return null when no route found', async () => {
      const { detectDomain } = require('@/lib/agent_bus');
      detectDomain.mockReturnValue(null);

      const result = await bus.routeMessage('Hello world');
      expect(result).toBeNull();
    });
  });

  describe('System Overview', () => {
    it('should return system overview', async () => {
      const overview = await bus.getSystemOverview();

      expect(overview.agents).toBeDefined();
      expect(Array.isArray(overview.agents)).toBe(true);
      expect(typeof overview.orgMemoryCount).toBe('number');
      expect(typeof overview.pendingEscalations).toBe('number');
      expect(['healthy', 'degraded', 'critical']).toContain(overview.systemHealth);
    });

    it('should calculate system health', async () => {
      const overview = await bus.getSystemOverview();
      expect(overview.systemHealth).toBeDefined();
    });
  });

  describe('Constants', () => {
    it('should export LIFE_OS_TO_ZEP mapping', () => {
      expect(LIFE_OS_TO_ZEP['agent.orchestrator']).toBe('orchestrator-agent');
      expect(LIFE_OS_TO_ZEP['agent.legal']).toBe('legal-agent');
    });

    it('should export AGENT_NAMES mapping', () => {
      expect(AGENT_NAMES['agent.orchestrator']).toBe('Conductor');
      expect(AGENT_NAMES['agent.legal']).toBe('Legal Advocate');
    });

    it('should export AGENT_ALIASES mapping', () => {
      expect(AGENT_ALIASES['conductor']).toBe('agent.orchestrator');
      expect(AGENT_ALIASES['legal']).toBe('agent.legal');
    });
  });
});
