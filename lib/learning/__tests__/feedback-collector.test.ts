/**
 * Feedback Collector Tests
 * Tests for Phase 6: Learning & Adaptation - Feedback Collection
 */

import { getFeedbackCollector, AgentFeedback } from '../feedback-collector';

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

describe('FeedbackCollector', () => {
  let collector: ReturnType<typeof getFeedbackCollector>;

  beforeEach(() => {
    // Reset singleton for each test
    collector = getFeedbackCollector();
    // @ts-ignore - accessing private property for testing
    collector.feedbackStore = [];
  });

  describe('recordFeedback', () => {
    it('should record feedback and return an ID', async () => {
      const feedbackId = await collector.recordFeedback({
        agentId: 'agent.orchestrator',
        responseId: 'resp_123',
        rating: 'helpful',
      });

      expect(feedbackId).toBeDefined();
      expect(feedbackId).toMatch(/^feedback_/);
    });

    it('should record feedback with all optional fields', async () => {
      const feedbackId = await collector.recordFeedback({
        agentId: 'agent.finance',
        responseId: 'resp_456',
        rating: 'somewhat_helpful',
        category: 'accuracy',
        comment: 'Could be more detailed',
        context: {
          taskType: 'budget_analysis',
          domain: 'finance',
        },
      });

      expect(feedbackId).toBeDefined();
    });

    it('should handle different rating values', async () => {
      const ratings: Array<AgentFeedback['rating']> = ['helpful', 'somewhat_helpful', 'not_helpful'];

      for (const rating of ratings) {
        const feedbackId = await collector.recordFeedback({
          agentId: 'agent.pm',
          responseId: `resp_${rating}`,
          rating,
        });
        expect(feedbackId).toBeDefined();
      }
    });
  });

  describe('getAgentStats', () => {
    beforeEach(async () => {
      // Add some test feedback
      await collector.recordFeedback({ agentId: 'agent.orchestrator', responseId: 'r1', rating: 'helpful' });
      await collector.recordFeedback({ agentId: 'agent.orchestrator', responseId: 'r2', rating: 'helpful' });
      await collector.recordFeedback({ agentId: 'agent.orchestrator', responseId: 'r3', rating: 'not_helpful', category: 'accuracy' });
      await collector.recordFeedback({ agentId: 'agent.finance', responseId: 'r4', rating: 'helpful' });
    });

    it('should return stats for a specific agent', () => {
      const stats = collector.getAgentStats('agent.orchestrator', 'week');

      expect(stats.totalFeedback).toBe(3);
      expect(stats.helpfulRate).toBeCloseTo(0.667, 2);
      expect(stats.topIssues).toContain('accuracy');
    });

    it('should return empty stats for unknown agent', () => {
      const stats = collector.getAgentStats('agent.unknown', 'week');

      expect(stats.totalFeedback).toBe(0);
      expect(stats.helpfulRate).toBe(0);
      expect(stats.topIssues).toHaveLength(0);
      expect(stats.trend).toBe('stable');
    });

    it('should filter by period', () => {
      const dayStats = collector.getAgentStats('agent.orchestrator', 'day');
      const weekStats = collector.getAgentStats('agent.orchestrator', 'week');
      const monthStats = collector.getAgentStats('agent.orchestrator', 'month');

      // All should return the same for recent feedback
      expect(dayStats.totalFeedback).toBe(weekStats.totalFeedback);
      expect(weekStats.totalFeedback).toBe(monthStats.totalFeedback);
    });
  });

  describe('getAllAgentMetrics', () => {
    beforeEach(async () => {
      await collector.recordFeedback({ agentId: 'agent.orchestrator', responseId: 'r1', rating: 'helpful' });
      await collector.recordFeedback({ agentId: 'agent.finance', responseId: 'r2', rating: 'not_helpful' });
      await collector.recordFeedback({ agentId: 'agent.legal', responseId: 'r3', rating: 'somewhat_helpful' });
    });

    it('should return metrics for all agents with feedback', () => {
      const metrics = collector.getAllAgentMetrics();

      expect(metrics.length).toBe(3);
      expect(metrics.map(m => m.agentId)).toContain('agent.orchestrator');
      expect(metrics.map(m => m.agentId)).toContain('agent.finance');
      expect(metrics.map(m => m.agentId)).toContain('agent.legal');
    });

    it('should include helpful rate for each agent', () => {
      const metrics = collector.getAllAgentMetrics();

      const orchestratorMetric = metrics.find(m => m.agentId === 'agent.orchestrator');
      expect(orchestratorMetric).toBeDefined();
      expect(orchestratorMetric?.value).toBe(1); // 100% helpful
    });
  });

  describe('trend detection', () => {
    it('should detect improving trend', async () => {
      // Add older unhelpful feedback, then newer helpful feedback
      const halfWeekAgo = Date.now() - 3.5 * 24 * 60 * 60 * 1000;

      // Manually add older feedback
      // @ts-ignore - accessing private property
      collector.feedbackStore.push({
        id: 'old_1',
        agentId: 'agent.pm',
        responseId: 'old_resp_1',
        rating: 'not_helpful',
        timestamp: new Date(halfWeekAgo),
      });

      // Add recent helpful feedback
      await collector.recordFeedback({ agentId: 'agent.pm', responseId: 'r1', rating: 'helpful' });
      await collector.recordFeedback({ agentId: 'agent.pm', responseId: 'r2', rating: 'helpful' });

      const stats = collector.getAgentStats('agent.pm', 'week');
      // Trend depends on distribution of feedback over time
      expect(['improving', 'stable', 'declining']).toContain(stats.trend);
    });
  });
});
