// @ts-nocheck
/**
 * Wrath Shield v3 - Agent Health Tests
 *
 * Tests for the Agent Health Monitoring system that tracks:
 * - Agent activity timestamps
 * - Zep memory latency
 * - Error counts and rates
 * - Token usage trends
 * - Response latency averages
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock performance.now for latency tests
const mockPerformanceNow = jest.fn();
global.performance = { now: mockPerformanceNow } as any;

// Mock AgentInvoker
const mockGetAgentActivity = jest.fn();

jest.mock('@/lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    getAgentActivity: mockGetAgentActivity,
  },
}));

// Mock Zep memory
const mockSearchAgentMemory = jest.fn();

jest.mock('@/lib/memory/zep', () => ({
  searchAgentMemory: mockSearchAgentMemory,
}));

import {
  getAgentHealth,
  getSquadHealth,
  getAgentsHealth,
  getQuickAgentHealth,
  type HealthStatus,
  type AgentHealthMetrics,
} from '@/lib/agents/health';

describe('Agent Health Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for activity
    mockGetAgentActivity.mockReturnValue([
      {
        agentId: 'agent.orchestrator',
        timestamp: Date.now(),
        wasExecuted: true,
        tokensUsed: 500,
        escalationLevel: 'AUTO_EXECUTE',
        latencyMs: 200,
      },
      {
        agentId: 'agent.orchestrator',
        timestamp: Date.now() - 60000,
        wasExecuted: true,
        tokensUsed: 450,
        escalationLevel: 'AUTO_EXECUTE',
        latencyMs: 180,
      },
    ]);

    // Default mock for memory search (fast response)
    mockSearchAgentMemory.mockResolvedValue([{ memory: { id: '1', text: 'test' }, score: 1 }]);

    // Mock performance.now to return incrementing values
    let time = 0;
    mockPerformanceNow.mockImplementation(() => {
      time += 100; // 100ms latency
      return time;
    });
  });

  describe('getAgentHealth', () => {
    it('should return health metrics for an agent', async () => {
      const health = await getAgentHealth('agent.orchestrator');

      expect(health).toBeDefined();
      expect(health.agentId).toBe('agent.orchestrator');
      expect(health.zepAgentId).toBe('orchestrator-agent');
      expect(health.status).toBeDefined();
      expect(health.healthScore).toBeDefined();
    });

    it('should map Life OS agent ID to Zep agent ID', async () => {
      const health = await getAgentHealth('agent.legal');
      expect(health.zepAgentId).toBe('legal-agent');
    });

    it('should use orchestrator-agent for unknown agents', async () => {
      const health = await getAgentHealth('agent.unknown');
      expect(health.zepAgentId).toBe('orchestrator-agent');
    });

    it('should calculate last activity timestamp', async () => {
      const now = Date.now();
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: now, wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.lastActivityTimestamp).toBe(now);
      expect(health.lastActivityAgo).toBeDefined();
    });

    it('should format time ago correctly', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now() - 30000, wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.lastActivityAgo).toContain('s ago');
    });

    it('should handle no activity gracefully', async () => {
      mockGetAgentActivity.mockReturnValue([]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.lastActivityTimestamp).toBeNull();
      expect(health.lastActivityAgo).toBe('Never');
      expect(health.totalRecentCalls).toBe(0);
    });
  });

  describe('Health Status Calculation', () => {
    it('should return healthy for recent activity with no errors', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.status).toBe('healthy');
    });

    it('should return idle for 5-60 minute inactivity', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now() - 10 * 60 * 1000, wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 }, // 10 min ago
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.status).toBe('idle');
    });

    it('should return offline for >1 hour inactivity', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now() - 2 * 60 * 60 * 1000, wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 }, // 2 hours ago
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.status).toBe('offline');
    });

    it('should return offline when memory unavailable', async () => {
      mockSearchAgentMemory.mockRejectedValue(new Error('Memory timeout'));
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.status).toBe('offline');
      expect(health.memoryStatus).toBe('unavailable');
    });

    it('should return degraded for high error rate', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: false, tokensUsed: 100, escalationLevel: 'CRITICAL', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 1000, wasExecuted: false, tokensUsed: 100, escalationLevel: 'CRITICAL', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 2000, wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      // 2/3 errors = 66% error rate
      expect(health.errorRate).toBeGreaterThan(0.5);
      expect(health.status).toBe('degraded');
    });

    it('should return degraded for high latency', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 5000 },
        { agentId: 'test', timestamp: Date.now() - 1000, wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 4000 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.avgResponseLatencyMs).toBeGreaterThan(2000);
      expect(health.status).toBe('degraded');
    });
  });

  describe('Error Rate Calculation', () => {
    it('should calculate error rate correctly', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: false, tokensUsed: 100, escalationLevel: 'CRITICAL', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      // 1/4 = 25% error rate
      expect(health.errorRate).toBe(0.25);
      expect(health.recentErrorCount).toBe(1);
    });

    it('should return 0 error rate for no errors', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.errorRate).toBe(0);
      expect(health.recentErrorCount).toBe(0);
    });
  });

  describe('Token Usage Trend', () => {
    it('should detect increasing token trend', async () => {
      // Older activities have lower tokens, newer have higher
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 1000, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 1000, wasExecuted: true, tokensUsed: 900, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 2000, wasExecuted: true, tokensUsed: 500, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 3000, wasExecuted: true, tokensUsed: 400, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.tokenUsageTrend).toBe('increasing');
    });

    it('should detect decreasing token trend', async () => {
      // Newer activities have lower tokens
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 200, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 1000, wasExecuted: true, tokensUsed: 250, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 2000, wasExecuted: true, tokensUsed: 800, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 3000, wasExecuted: true, tokensUsed: 900, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.tokenUsageTrend).toBe('decreasing');
    });

    it('should detect stable token trend', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 500, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 1000, wasExecuted: true, tokensUsed: 510, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 2000, wasExecuted: true, tokensUsed: 490, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now() - 3000, wasExecuted: true, tokensUsed: 505, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.tokenUsageTrend).toBe('stable');
    });

    it('should return unknown for insufficient data', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 500, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.tokenUsageTrend).toBe('unknown');
    });
  });

  describe('Memory Status', () => {
    it('should report connected for fast memory', async () => {
      mockSearchAgentMemory.mockResolvedValue([]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.memoryStatus).toBe('connected');
    });

    it('should report unavailable on memory error', async () => {
      mockSearchAgentMemory.mockRejectedValue(new Error('Connection refused'));

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.memoryStatus).toBe('unavailable');
      expect(health.memoryLatencyMs).toBeNull();
    });
  });

  describe('Health Score Calculation', () => {
    it('should return 100 for perfect health', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.healthScore).toBeGreaterThanOrEqual(90);
    });

    it('should deduct for offline status', async () => {
      mockGetAgentActivity.mockReturnValue([]);
      mockSearchAgentMemory.mockRejectedValue(new Error('Unavailable'));

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.healthScore).toBeLessThanOrEqual(40);
    });

    it('should deduct for high error rate', async () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: false, tokensUsed: 100, escalationLevel: 'CRITICAL', latencyMs: 100 },
        { agentId: 'test', timestamp: Date.now(), wasExecuted: false, tokensUsed: 100, escalationLevel: 'CRITICAL', latencyMs: 100 },
      ]);

      const health = await getAgentHealth('agent.orchestrator');

      expect(health.healthScore).toBeLessThan(80);
    });
  });

  describe('getSquadHealth', () => {
    it('should return health for all agents', async () => {
      const squadHealth = await getSquadHealth();

      expect(squadHealth.agents).toBeDefined();
      expect(Array.isArray(squadHealth.agents)).toBe(true);
      expect(squadHealth.agents.length).toBeGreaterThan(0);
    });

    it('should calculate squad health score', async () => {
      const squadHealth = await getSquadHealth();

      expect(squadHealth.squadHealthScore).toBeDefined();
      expect(squadHealth.squadHealthScore).toBeGreaterThanOrEqual(0);
      expect(squadHealth.squadHealthScore).toBeLessThanOrEqual(100);
    });

    it('should count agents by status', async () => {
      const squadHealth = await getSquadHealth();

      expect(typeof squadHealth.activeAgents).toBe('number');
      expect(typeof squadHealth.idleAgents).toBe('number');
      expect(typeof squadHealth.degradedAgents).toBe('number');
      expect(typeof squadHealth.offlineAgents).toBe('number');
    });

    it('should calculate average memory latency', async () => {
      const squadHealth = await getSquadHealth();

      expect(typeof squadHealth.avgMemoryLatencyMs).toBe('number');
    });

    it('should include timestamp', async () => {
      const squadHealth = await getSquadHealth();

      expect(squadHealth.timestamp).toBeDefined();
      expect(() => new Date(squadHealth.timestamp)).not.toThrow();
    });

    it('should handle individual agent failures gracefully', async () => {
      // Make one agent fail
      mockGetAgentActivity.mockImplementation((agentId) => {
        if (agentId === 'agent.legal') {
          throw new Error('Agent error');
        }
        return [{ agentId, timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 }];
      });

      const squadHealth = await getSquadHealth();

      // Should still return results
      expect(squadHealth.agents.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentsHealth', () => {
    it('should return health for specific agents', async () => {
      const health = await getAgentsHealth(['agent.legal', 'agent.finance']);

      expect(health.length).toBe(2);
      expect(health.some(h => h.agentId === 'agent.legal')).toBe(true);
      expect(health.some(h => h.agentId === 'agent.finance')).toBe(true);
    });
  });

  describe('getQuickAgentHealth', () => {
    it('should return health without memory check', () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 100, escalationLevel: 'AUTO_EXECUTE', latencyMs: 100 },
      ]);

      const health = getQuickAgentHealth('agent.orchestrator');

      expect(health.memoryStatus).toBe('unknown');
      expect(health.agentId).toBe('agent.orchestrator');
      expect(health.status).toBeDefined();
    });

    it('should be synchronous (no await needed)', () => {
      const health = getQuickAgentHealth('agent.legal');

      // If this compiles and runs without await, it's synchronous
      expect(health).toBeDefined();
      expect(health.agentId).toBe('agent.legal');
    });

    it('should still calculate all other metrics', () => {
      mockGetAgentActivity.mockReturnValue([
        { agentId: 'test', timestamp: Date.now(), wasExecuted: true, tokensUsed: 500, escalationLevel: 'AUTO_EXECUTE', latencyMs: 200 },
        { agentId: 'test', timestamp: Date.now() - 1000, wasExecuted: true, tokensUsed: 400, escalationLevel: 'AUTO_EXECUTE', latencyMs: 150 },
      ]);

      const health = getQuickAgentHealth('agent.orchestrator');

      expect(health.avgTokenUsage).toBe(450);
      expect(health.avgResponseLatencyMs).toBe(175);
      expect(health.totalRecentCalls).toBe(2);
    });
  });
});
