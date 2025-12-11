/**
 * Tests for Agent Subscription Configuration
 */

import {
  AGENT_SUBSCRIPTIONS,
  initializeAgentSubscriptions,
  getSubscriptionStats
} from '../agent-subscriptions';
import { getEventBus } from '../life-os-event-bus';

describe('Agent Subscriptions', () => {

  describe('AGENT_SUBSCRIPTIONS', () => {
    it('should define subscriptions for all core agents', () => {
      const agentIds = AGENT_SUBSCRIPTIONS.map(a => a.agentId);

      expect(agentIds).toContain('agent.orchestrator');
      expect(agentIds).toContain('agent.ea');
      expect(agentIds).toContain('agent.comms');
      expect(agentIds).toContain('agent.finance');
      expect(agentIds).toContain('agent.legal');
      expect(agentIds).toContain('agent.pm');
    });

    it('should have at least one pattern per agent', () => {
      for (const config of AGENT_SUBSCRIPTIONS) {
        expect(config.patterns.length).toBeGreaterThan(0);
      }
    });

    it('should have valid priorities (0-100)', () => {
      for (const config of AGENT_SUBSCRIPTIONS) {
        for (const { priority } of config.patterns) {
          expect(priority).toBeGreaterThanOrEqual(0);
          expect(priority).toBeLessThanOrEqual(100);
        }
      }
    });

    it('orchestrator should have wildcard pattern', () => {
      const orchestrator = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.orchestrator');
      expect(orchestrator).toBeDefined();

      const hasWildcard = orchestrator!.patterns.some(p => p.pattern === '*');
      expect(hasWildcard).toBe(true);
    });

    it('finance agent should subscribe to finance domain', () => {
      const finance = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.finance');
      expect(finance).toBeDefined();

      const hasFinancePattern = finance!.patterns.some(p => p.pattern.includes('finance'));
      expect(hasFinancePattern).toBe(true);
    });
  });

  describe('initializeAgentSubscriptions', () => {
    it('should register all agent subscriptions without errors', () => {
      expect(() => {
        initializeAgentSubscriptions();
      }).not.toThrow();
    });

    it('should register subscriptions on the event bus', () => {
      const bus = getEventBus();

      initializeAgentSubscriptions();

      const stats = bus.getStats();
      expect(stats.patterns).toBeGreaterThan(0);
      expect(stats.totalSubscriptions).toBeGreaterThan(0);
    });

    it('should have consistent subscription count', () => {
      // Test that getSubscriptionStats matches the actual subscriptions
      const stats = getSubscriptionStats();
      const expectedPatterns = AGENT_SUBSCRIPTIONS.reduce((sum, a) => sum + a.patterns.length, 0);
      expect(stats.totalPatterns).toBe(expectedPatterns);
    });
  });

  describe('getSubscriptionStats', () => {
    it('should return correct total agent count', () => {
      const stats = getSubscriptionStats();
      expect(stats.totalAgents).toBe(AGENT_SUBSCRIPTIONS.length);
    });

    it('should return correct total pattern count', () => {
      const stats = getSubscriptionStats();
      const expectedTotal = AGENT_SUBSCRIPTIONS.reduce((sum, a) => sum + a.patterns.length, 0);
      expect(stats.totalPatterns).toBe(expectedTotal);
    });

    it('should return agent details array', () => {
      const stats = getSubscriptionStats();
      expect(Array.isArray(stats.agentDetails)).toBe(true);
      expect(stats.agentDetails.length).toBe(AGENT_SUBSCRIPTIONS.length);
    });

    it('should have correct pattern counts per agent', () => {
      const stats = getSubscriptionStats();

      for (const detail of stats.agentDetails) {
        const config = AGENT_SUBSCRIPTIONS.find(a => a.agentId === detail.agentId);
        expect(config).toBeDefined();
        expect(detail.patternCount).toBe(config!.patterns.length);
      }
    });
  });
});
