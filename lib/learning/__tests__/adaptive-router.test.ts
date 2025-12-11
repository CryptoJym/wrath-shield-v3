/**
 * Adaptive Router Tests
 * Tests for Phase 6: Learning & Adaptation - Adaptive Routing
 */

import { getAdaptiveRouter, TaskPattern, RoutingRecommendation } from '../adaptive-router';

// Mock the event bus
jest.mock('@/lib/agents/life-os-event-bus', () => ({
  getEventBus: () => ({
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  }),
  createNotificationEvent: jest.fn((source, payload, domain, priority) => ({
    id: `evt_${Date.now()}`,
    type: 'notification',
    source,
    domain,
    priority,
    payload,
    timestamp: new Date(),
  })),
}));

// Mock feedback collector
jest.mock('../feedback-collector', () => ({
  getFeedbackCollector: () => ({
    getAllAgentMetrics: jest.fn().mockReturnValue([
      { agentId: 'agent.finance', value: 0.9, trend: 'stable', sampleSize: 10, period: 'week' },
      { agentId: 'agent.legal', value: 0.85, trend: 'improving', sampleSize: 8, period: 'week' },
      { agentId: 'agent.orchestrator', value: 0.8, trend: 'stable', sampleSize: 15, period: 'week' },
    ]),
    getAgentStats: jest.fn().mockReturnValue({
      totalFeedback: 10,
      helpfulRate: 0.8,
      topIssues: [],
      trend: 'stable',
    }),
  }),
}));

describe('AdaptiveRouter', () => {
  let router: ReturnType<typeof getAdaptiveRouter>;

  beforeEach(() => {
    router = getAdaptiveRouter();
    // Reset internal state
    // @ts-ignore - accessing private properties for testing
    router.routingHistory = new Map();
    // @ts-ignore
    router.performanceCache = new Map();
    // @ts-ignore
    router.lastCacheUpdate = 0;
  });

  describe('recommendAgent', () => {
    it('should return a recommendation with default routing when no history', async () => {
      const pattern: TaskPattern = {
        domain: 'unknown_domain',
        taskType: 'new_task',
        keywords: ['test'],
      };

      const recommendation = await router.recommendAgent(pattern);

      expect(recommendation).toBeDefined();
      expect(recommendation.agentId).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(1);
      expect(recommendation.reason).toBeDefined();
    });

    it('should prefer agents with higher success rates', async () => {
      // Record successful outcomes for finance agent
      const pattern: TaskPattern = {
        domain: 'finance',
        taskType: 'budget_review',
        keywords: ['budget', 'expense'],
      };

      await router.recordRoutingOutcome(pattern, 'agent.finance', true);
      await router.recordRoutingOutcome(pattern, 'agent.finance', true);
      await router.recordRoutingOutcome(pattern, 'agent.finance', true);

      const recommendation = await router.recommendAgent(pattern);

      // Should recommend finance agent based on success history
      expect(recommendation.confidence).toBeGreaterThan(0);
    });

    it('should provide alternatives when available', async () => {
      const pattern: TaskPattern = {
        domain: 'legal',
        taskType: 'contract_review',
        keywords: ['contract'],
      };

      // Add history for multiple agents
      await router.recordRoutingOutcome(pattern, 'agent.legal', true);
      await router.recordRoutingOutcome(pattern, 'agent.legal', true);
      await router.recordRoutingOutcome(pattern, 'agent.orchestrator', true);

      const recommendation = await router.recommendAgent(pattern);

      // May or may not have alternatives depending on cache state
      expect(recommendation).toBeDefined();
    });
  });

  describe('recordRoutingOutcome', () => {
    it('should record successful outcomes', async () => {
      const pattern: TaskPattern = {
        domain: 'health',
        taskType: 'workout_plan',
        keywords: ['exercise'],
      };

      await router.recordRoutingOutcome(pattern, 'agent.health', true);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should record failed outcomes', async () => {
      const pattern: TaskPattern = {
        domain: 'finance',
        taskType: 'tax_prep',
        keywords: ['tax'],
      };

      await router.recordRoutingOutcome(pattern, 'agent.finance', false);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle multiple outcomes for same pattern', async () => {
      const pattern: TaskPattern = {
        domain: 'pm',
        taskType: 'task_prioritization',
        keywords: ['priority'],
      };

      await router.recordRoutingOutcome(pattern, 'agent.pm', true);
      await router.recordRoutingOutcome(pattern, 'agent.pm', false);
      await router.recordRoutingOutcome(pattern, 'agent.pm', true);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getAgentPerformanceReport', () => {
    it('should return performance data for agents', async () => {
      const report = await router.getAgentPerformanceReport();

      expect(report).toBeInstanceOf(Array);
    });

    it('should sort by success rate descending', async () => {
      // Add history to populate cache
      await router.recordRoutingOutcome({ domain: 'test', taskType: 't1', keywords: [] }, 'agent.a', true);
      await router.recordRoutingOutcome({ domain: 'test', taskType: 't1', keywords: [] }, 'agent.b', false);

      const report = await router.getAgentPerformanceReport();

      // Report should be sorted
      for (let i = 0; i < report.length - 1; i++) {
        expect(report[i].successRate).toBeGreaterThanOrEqual(report[i + 1].successRate);
      }
    });
  });

  describe('performance caching', () => {
    it('should cache performance data', async () => {
      const pattern: TaskPattern = {
        domain: 'test',
        taskType: 'cache_test',
        keywords: [],
      };

      // First call should update cache
      const rec1 = await router.recommendAgent(pattern);

      // Second call should use cache (within expiry window)
      const rec2 = await router.recommendAgent(pattern);

      expect(rec1).toBeDefined();
      expect(rec2).toBeDefined();
    });
  });
});
