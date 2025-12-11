// @ts-nocheck
/**
 * Wrath Shield v3 - Metrics Collector Tests
 *
 * Tests for the Metrics Collector that gathers metrics from:
 * - WHOOP API (sleep, recovery, strain, HRV, RHR)
 * - System state (escalations, emails, tasks)
 * - Agent state (errors, activity)
 * - Memory system (proposals)
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock AgentInvoker
const mockGetPendingEscalations = jest.fn().mockReturnValue([
  { id: 'esc-1', level: 'CRITICAL' },
  { id: 'esc-2', level: 'PROPOSE' },
]);

jest.mock('@/lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    getPendingEscalations: mockGetPendingEscalations,
  },
}));

// Mock UnifiedBus
const mockGetAllAgentStates = jest.fn().mockReturnValue([
  { agentId: 'agent.orchestrator', status: 'idle' },
  { agentId: 'agent.legal', status: 'busy' },
  { agentId: 'agent.finance', status: 'error' },
]);
const mockGetRecentActivity = jest.fn().mockReturnValue([
  { agentId: 'agent.legal', action: 'invoke', timestamp: Date.now() },
  { agentId: 'agent.finance', action: 'invoke', timestamp: Date.now() - 1000 },
]);

jest.mock('@/lib/agents/UnifiedBus', () => ({
  getUnifiedBus: jest.fn().mockReturnValue({
    getAllAgentStates: mockGetAllAgentStates,
    getRecentActivity: mockGetRecentActivity,
  }),
}));

// Mock Zep
const mockGetProposalCounts = jest.fn().mockReturnValue({
  pending: 3,
  approved: 150,
});

jest.mock('@/lib/memory/zep', () => ({
  getProposalCounts: mockGetProposalCounts,
}));

// Mock global fetch for WHOOP API
global.fetch = jest.fn();

import {
  getMetricsCollector,
  METRIC_DEFINITIONS,
  type CollectedMetrics,
} from '@/lib/agents/MetricsCollector';

describe('Metrics Collector', () => {
  let collector: ReturnType<typeof getMetricsCollector>;

  beforeEach(() => {
    jest.clearAllMocks();
    collector = getMetricsCollector();
    collector.clearCache();

    // Default WHOOP mock response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        sleep: { score: 82 },
        recovery: { score: 75, hrv: 55, rhr: 52 },
        strain: { score: 12.5 },
      }),
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const collector1 = getMetricsCollector();
      const collector2 = getMetricsCollector();
      expect(collector1).toBe(collector2);
    });
  });

  describe('Metric Definitions', () => {
    it('should export metric definitions', () => {
      expect(METRIC_DEFINITIONS).toBeDefined();
      expect(METRIC_DEFINITIONS.whoop_sleep_score).toBeDefined();
      expect(METRIC_DEFINITIONS.whoop_recovery).toBeDefined();
    });

    it('should have required fields for each metric', () => {
      for (const [key, def] of Object.entries(METRIC_DEFINITIONS)) {
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.source).toBeDefined();
        expect(def.defaultValue).toBeDefined();
      }
    });

    it('should categorize metrics by source', () => {
      const sources = new Set(Object.values(METRIC_DEFINITIONS).map(d => d.source));
      expect(sources).toContain('whoop');
      expect(sources).toContain('system');
      expect(sources).toContain('agent');
      expect(sources).toContain('memory');
    });
  });

  describe('collectAll', () => {
    it('should collect all metrics', async () => {
      const metrics = await collector.collectAll();

      expect(metrics).toBeDefined();
      expect(metrics.collected_at).toBeDefined();
    });

    it('should include WHOOP metrics', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.whoop_sleep_score).toBeDefined();
      expect(metrics.whoop_recovery).toBeDefined();
      expect(metrics.whoop_strain).toBeDefined();
      expect(metrics.whoop_hrv).toBeDefined();
      expect(metrics.whoop_rhr).toBeDefined();
    });

    it('should include system metrics', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.pending_escalation_count).toBeDefined();
      expect(typeof metrics.pending_escalation_count).toBe('number');
    });

    it('should include agent metrics', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.agent_error_count).toBeDefined();
      expect(metrics.agent_busy_count).toBeDefined();
      expect(metrics.total_agent_invocations_24h).toBeDefined();
    });

    it('should include memory metrics', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.pending_proposal_count).toBeDefined();
      expect(metrics.total_memory_count).toBeDefined();
    });

    it('should cache results', async () => {
      const metrics1 = await collector.collectAll();
      const metrics2 = await collector.collectAll();

      // Should be cached (same collected_at time)
      expect(metrics1.collected_at).toBe(metrics2.collected_at);
    });

    it('should refresh after cache expiry', async () => {
      const metrics1 = await collector.collectAll();

      // Clear cache to simulate expiry
      collector.clearCache();

      const metrics2 = await collector.collectAll();

      // Should be different timestamps after cache clear
      expect(metrics1.collected_at).not.toBe(metrics2.collected_at);
    });
  });

  describe('WHOOP Metrics Collection', () => {
    it('should fetch from WHOOP API', async () => {
      await collector.collectAll();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4242/api/whoop/latest',
        expect.any(Object)
      );
    });

    it('should use default values when WHOOP unavailable', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const metrics = await collector.collectAll();

      // Should fall back to defaults
      expect(metrics.whoop_sleep_score).toBe(METRIC_DEFINITIONS.whoop_sleep_score.defaultValue);
      expect(metrics.whoop_recovery).toBe(METRIC_DEFINITIONS.whoop_recovery.defaultValue);
    });

    it('should parse WHOOP response correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          sleep: { score: 90 },
          recovery: { score: 85, hrv: 60, rhr: 48 },
          strain: { score: 15 },
        }),
      });

      const metrics = await collector.collectAll();

      expect(metrics.whoop_sleep_score).toBe(90);
      expect(metrics.whoop_recovery).toBe(85);
      expect(metrics.whoop_hrv).toBe(60);
      expect(metrics.whoop_rhr).toBe(48);
      expect(metrics.whoop_strain).toBe(15);
    });

    it('should handle alternate WHOOP response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          sleepScore: 88,
          recoveryScore: 72,
          strainScore: 10,
          hrv: 50,
          rhr: 55,
        }),
      });

      const metrics = await collector.collectAll();

      expect(metrics.whoop_sleep_score).toBe(88);
      expect(metrics.whoop_recovery).toBe(72);
    });
  });

  describe('System Metrics Collection', () => {
    it('should count pending escalations', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.pending_escalation_count).toBe(2);
    });

    it('should handle AgentInvoker errors gracefully', async () => {
      mockGetPendingEscalations.mockImplementationOnce(() => {
        throw new Error('Invoker unavailable');
      });

      const metrics = await collector.collectAll();

      expect(metrics.pending_escalation_count).toBe(0);
    });
  });

  describe('Agent Metrics Collection', () => {
    it('should count error agents', async () => {
      const metrics = await collector.collectAll();

      // One agent has 'error' status in mock
      expect(metrics.agent_error_count).toBe(1);
    });

    it('should count busy agents', async () => {
      const metrics = await collector.collectAll();

      // One agent has 'busy' status in mock
      expect(metrics.agent_busy_count).toBe(1);
    });

    it('should count 24h invocations', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.total_agent_invocations_24h).toBeGreaterThanOrEqual(0);
    });

    it('should handle UnifiedBus errors gracefully', async () => {
      const { getUnifiedBus } = require('@/lib/agents/UnifiedBus');
      getUnifiedBus.mockImplementationOnce(() => {
        throw new Error('Bus unavailable');
      });

      const metrics = await collector.collectAll();

      expect(metrics.agent_error_count).toBe(0);
      expect(metrics.agent_busy_count).toBe(0);
    });
  });

  describe('Memory Metrics Collection', () => {
    it('should count pending proposals', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.pending_proposal_count).toBe(3);
    });

    it('should count total memories', async () => {
      const metrics = await collector.collectAll();

      expect(metrics.total_memory_count).toBe(150);
    });

    it('should handle Zep errors gracefully', async () => {
      mockGetProposalCounts.mockImplementationOnce(() => {
        throw new Error('Zep unavailable');
      });

      const metrics = await collector.collectAll();

      expect(metrics.pending_proposal_count).toBe(0);
      expect(metrics.total_memory_count).toBe(0);
    });
  });

  describe('getMetric', () => {
    it('should get single metric', async () => {
      const value = await collector.getMetric('pending_escalation_count');

      expect(typeof value).toBe('number');
    });

    it('should return default for unknown metric', async () => {
      const value = await collector.getMetric('unknown_metric' as any);

      expect(value).toBe(0);
    });
  });

  describe('getDefinitions', () => {
    it('should return all metric definitions', () => {
      const defs = collector.getDefinitions();

      expect(defs).toBeDefined();
      expect(Object.keys(defs).length).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear cached metrics', async () => {
      await collector.collectAll();
      collector.clearCache();

      // Change mock return value
      mockGetPendingEscalations.mockReturnValue([]);

      const metrics = await collector.collectAll();

      // Should reflect updated value after cache clear
      expect(metrics.pending_escalation_count).toBe(0);
    });
  });
});
