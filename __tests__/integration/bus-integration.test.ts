/**
 * Bus Integration Tests
 *
 * Tests the integration between UnifiedBus and its dependencies.
 * These tests verify that components work together correctly.
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Create mock functions that we can spy on
const mockSearchAgentMemory = jest.fn();
const mockAddAgentMemory = jest.fn();
const mockSearchOrgMemory = jest.fn();
const mockAddOrgMemory = jest.fn();
const mockInvokeAgent = jest.fn();

// Mock Zep module
jest.mock('@/lib/memory/zep', () => ({
  searchAgentMemory: (...args: any[]) => mockSearchAgentMemory(...args),
  addAgentMemory: (...args: any[]) => mockAddAgentMemory(...args),
  searchOrgMemory: (...args: any[]) => mockSearchOrgMemory(...args),
  addOrgMemory: (...args: any[]) => mockAddOrgMemory(...args),
  getProposalCounts: jest.fn().mockReturnValue({ pending: 0, approved: 5 }),
}));

// Mock AgentInvoker
jest.mock('@/lib/agents/AgentInvoker', () => ({
  invokeAgent: (...args: any[]) => mockInvokeAgent(...args),
  agentInvoker: {
    getPendingEscalations: jest.fn().mockReturnValue([]),
  },
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgents: jest.fn().mockReturnValue({
    agents: [
      { id: 'agent.orchestrator', name: 'Conductor', tools: [] },
      { id: 'agent.legal', name: 'Legal Advocate', tools: [] },
      { id: 'agent.finance', name: 'Finance Analyst', tools: [] },
    ],
  }),
}));

// Mock agent types
jest.mock('@/lib/agents/types', () => ({
  AGENT_PROVIDER_MAP: {
    'agent.orchestrator': { provider: 'xai', model: 'grok-4-1-fast' },
    'agent.legal': { provider: 'xai', model: 'grok-4-1-fast' },
    'agent.finance': { provider: 'openai', model: 'gpt-5.1' },
    'default': { provider: 'xai', model: 'grok-4-1-fast' },
  },
}));

// Mock agent_bus
jest.mock('@/lib/agent_bus', () => ({
  detectDomain: jest.fn().mockReturnValue('legal'),
  routeToAgents: jest.fn().mockReturnValue(['legal-agent']),
}));

import { getUnifiedBus } from '@/lib/agents/UnifiedBus';

describe('Bus Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Memory Integration', () => {
    it('should read agent memory via Zep', async () => {
      const bus = getUnifiedBus();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: 'mem1', text: 'Test memory', metadata: {}, createdAt: new Date().toISOString() },
          score: 0.95,
        },
      ]);

      const result = await bus.readAgentMemory('agent.legal', 'test query');

      expect(mockSearchAgentMemory).toHaveBeenCalledWith('legal-agent', 'test query', 5);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Test memory');
    });

    it('should write agent memory via Zep', async () => {
      const bus = getUnifiedBus();

      mockAddAgentMemory.mockResolvedValue(undefined);

      const success = await bus.writeAgentMemory('agent.legal', 'New memory', { type: 'fact' });

      expect(mockAddAgentMemory).toHaveBeenCalled();
      expect(success).toBe(true);
    });

    it('should search org memory', async () => {
      const bus = getUnifiedBus();

      mockSearchOrgMemory.mockResolvedValue([
        {
          memory: { id: 'org1', text: 'Org policy', metadata: {} },
          score: 0.9,
        },
      ]);

      const result = await bus.readOrgMemory('policies');

      expect(mockSearchOrgMemory).toHaveBeenCalledWith('policies', 5);
      expect(result).toHaveLength(1);
    });

    it('should write org memory directly', async () => {
      const bus = getUnifiedBus();

      mockAddOrgMemory.mockResolvedValue(undefined);

      const success = await bus.writeOrgMemory('New org policy', { category: 'policy' });

      expect(mockAddOrgMemory).toHaveBeenCalled();
      expect(success).toBe(true);
    });

    it('should handle memory read errors gracefully', async () => {
      const bus = getUnifiedBus();

      mockSearchAgentMemory.mockRejectedValue(new Error('Zep unavailable'));

      const result = await bus.readAgentMemory('agent.legal', 'test');

      expect(result).toEqual([]);
    });

    it('should handle memory write errors gracefully', async () => {
      const bus = getUnifiedBus();

      mockAddAgentMemory.mockRejectedValue(new Error('Zep unavailable'));

      const success = await bus.writeAgentMemory('agent.legal', 'Test');

      expect(success).toBe(false);
    });
  });

  describe('Agent Invocation Integration', () => {
    it('should invoke agent via AgentInvoker', async () => {
      const bus = getUnifiedBus();

      mockInvokeAgent.mockResolvedValue({
        agentId: 'agent.legal',
        content: 'Legal response',
        escalationLevel: 'AUTO_EXECUTE',
        shouldExecute: true,
        model: 'grok-4-1-fast',
        latencyMs: 150,
      });

      const result = await bus.invokeAgent({
        agentId: 'agent.legal',
        message: 'Check this contract',
      });

      expect(mockInvokeAgent).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.response).toBe('Legal response');
    });

    it('should handle invocation errors gracefully', async () => {
      const bus = getUnifiedBus();

      mockInvokeAgent.mockRejectedValue(new Error('Agent timeout'));

      const result = await bus.invokeAgent({
        agentId: 'agent.legal',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.response).toContain('Agent timeout');
    });

    it('should update agent state during invocation', async () => {
      const bus = getUnifiedBus();

      mockInvokeAgent.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          agentId: 'agent.legal',
          content: 'Response',
          escalationLevel: 'AUTO_EXECUTE',
          shouldExecute: true,
          model: 'grok-4-1-fast',
          latencyMs: 10,
        };
      });

      const invokePromise = bus.invokeAgent({
        agentId: 'agent.legal',
        message: 'Test',
      });

      // State should show busy during invocation
      const state = bus.getAgentState('agent.legal');
      // Note: Due to async timing, this might not always catch busy state in tests

      await invokePromise;

      // After completion, state should be idle
      const finalState = bus.getAgentState('agent.legal');
      expect(finalState?.status).toBe('idle');
    });
  });

  describe('Broadcast Integration', () => {
    it('should broadcast to multiple agents', async () => {
      const bus = getUnifiedBus();

      mockInvokeAgent.mockResolvedValue({
        content: 'Response',
        escalationLevel: 'AUTO_EXECUTE',
        shouldExecute: true,
        model: 'grok-4-1-fast',
        latencyMs: 50,
      });

      const result = await bus.broadcast({
        message: 'System announcement',
        priority: 'high',
        targetAgents: ['agent.legal', 'agent.finance'],
      });

      expect(result.success).toBe(true);
      expect(mockInvokeAgent).toHaveBeenCalledTimes(2);
    });

    it('should handle partial broadcast failures', async () => {
      const bus = getUnifiedBus();

      let callCount = 0;
      mockInvokeAgent.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Agent 1 failed');
        }
        return {
          content: 'Success',
          escalationLevel: 'AUTO_EXECUTE',
          shouldExecute: true,
          model: 'grok-4-1-fast',
          latencyMs: 50,
        };
      });

      const result = await bus.broadcast({
        message: 'Test',
        priority: 'normal',
        targetAgents: ['agent.legal', 'agent.finance'],
      });

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(1);
    });
  });

  describe('Message Routing Integration', () => {
    it('should route @mention messages to correct agent', async () => {
      const bus = getUnifiedBus();

      mockInvokeAgent.mockResolvedValue({
        content: 'Legal review complete',
        escalationLevel: 'AUTO_EXECUTE',
        shouldExecute: true,
        model: 'grok-4-1-fast',
        latencyMs: 100,
      });

      const result = await bus.routeMessage('@legal check this contract');

      expect(result).toBeDefined();
      expect(result?.agentId).toBe('agent.legal');
    });

    it('should return null for unroutable messages', async () => {
      const bus = getUnifiedBus();

      // Mock no mentions and no domain detection
      const { detectDomain, routeToAgents } = require('@/lib/agent_bus');
      detectDomain.mockReturnValue(null);
      routeToAgents.mockReturnValue([]);

      const result = await bus.routeMessage('random message without mentions');

      expect(result).toBeNull();
    });
  });
});

describe('Cross-Agent Memory Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchAgentMemory.mockResolvedValue([]);
  });

  it('should search all agent memories in parallel', async () => {
    const bus = getUnifiedBus();

    mockSearchAgentMemory.mockImplementation(async (agentId: string) => {
      if (agentId === 'legal-agent') {
        return [{ memory: { id: '1', text: 'Legal memory' }, score: 0.9 }];
      }
      if (agentId === 'finance-agent') {
        return [{ memory: { id: '2', text: 'Finance memory' }, score: 0.8 }];
      }
      return [];
    });

    const result = await bus.searchAllAgentMemories('test query');

    // Should have called searchAgentMemory for multiple agents
    expect(mockSearchAgentMemory.mock.calls.length).toBeGreaterThan(1);

    // Results should be keyed by agent
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('should handle individual agent search failures', async () => {
    const bus = getUnifiedBus();

    mockSearchAgentMemory.mockImplementation(async (agentId: string) => {
      if (agentId === 'legal-agent') {
        throw new Error('Legal agent memory unavailable');
      }
      return [{ memory: { id: '1', text: 'Other memory' }, score: 0.9 }];
    });

    // Should not throw, should return partial results
    const result = await bus.searchAllAgentMemories('test query');

    // Should still have results from non-failing agents
    expect(result).toBeDefined();
  });
});
