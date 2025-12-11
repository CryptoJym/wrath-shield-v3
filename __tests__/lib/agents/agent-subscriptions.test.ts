// @ts-nocheck
/**
 * Wrath Shield v3 - Agent Subscriptions Tests
 *
 * Tests for agent subscription configuration:
 * - Default subscription patterns
 * - Subscription initialization
 * - Stats reporting
 */

// Mock life-os-event-bus
const mockSubscribe = jest.fn().mockReturnValue(() => {});
const mockGetEventBus = jest.fn().mockReturnValue({
  subscribe: mockSubscribe,
});

jest.mock('@/lib/agents/life-os-event-bus', () => ({
  getEventBus: mockGetEventBus,
  DOMAINS: {
    FAMILY: 'family',
    WORK: 'work',
    HEALTH: 'health',
    FINANCE: 'finance',
    LEARNING: 'learning',
    LEGAL: 'legal',
  },
}));

import {
  AGENT_SUBSCRIPTIONS,
  initializeAgentSubscriptions,
  getSubscriptionStats,
} from '@/lib/agents/agent-subscriptions';

describe('Agent Subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AGENT_SUBSCRIPTIONS', () => {
    it('should define subscriptions for orchestrator', () => {
      const orchestrator = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.orchestrator');

      expect(orchestrator).toBeDefined();
      expect(orchestrator?.patterns.length).toBeGreaterThan(0);
    });

    it('should have orchestrator subscribe to everything (*)', () => {
      const orchestrator = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.orchestrator');
      const wildcardPattern = orchestrator?.patterns.find(p => p.pattern === '*');

      expect(wildcardPattern).toBeDefined();
      expect(wildcardPattern?.priority).toBe(100);
    });

    it('should have orchestrator subscribe to escalations', () => {
      const orchestrator = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.orchestrator');
      const escalationPattern = orchestrator?.patterns.find(p => p.pattern === 'escalation.*');

      expect(escalationPattern).toBeDefined();
    });

    it('should define subscriptions for EA agent', () => {
      const ea = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.ea');

      expect(ea).toBeDefined();
      expect(ea?.patterns.some(p => p.pattern.includes('family'))).toBe(true);
      expect(ea?.patterns.some(p => p.pattern.includes('work'))).toBe(true);
    });

    it('should define subscriptions for comms agent', () => {
      const comms = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.comms');

      expect(comms).toBeDefined();
      expect(comms?.patterns.some(p => p.pattern === 'type.message')).toBe(true);
    });

    it('should define subscriptions for finance agent', () => {
      const finance = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.finance');

      expect(finance).toBeDefined();
      expect(finance?.patterns.some(p => p.pattern.includes('finance'))).toBe(true);
    });

    it('should define subscriptions for legal agent', () => {
      const legal = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.legal');

      expect(legal).toBeDefined();
      expect(legal?.patterns.some(p => p.pattern.includes('legal'))).toBe(true);
      expect(legal?.patterns.some(p => p.pattern.includes('escalation'))).toBe(true);
    });

    it('should define subscriptions for PM agent', () => {
      const pm = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.pm');

      expect(pm).toBeDefined();
      expect(pm?.patterns.some(p => p.pattern.includes('work'))).toBe(true);
      expect(pm?.patterns.some(p => p.pattern === 'type.task')).toBe(true);
    });

    it('should define subscriptions for Hyro education agent', () => {
      const hyro = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.hyro.education');

      expect(hyro).toBeDefined();
      expect(hyro?.patterns.some(p => p.pattern.includes('family.hyro'))).toBe(true);
    });

    it('should define subscriptions for James learning agent', () => {
      const learning = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.james.learning');

      expect(learning).toBeDefined();
      expect(learning?.patterns.some(p => p.pattern.includes('learning'))).toBe(true);
    });

    it('should define subscriptions for health agent', () => {
      const health = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.health');

      expect(health).toBeDefined();
      expect(health?.patterns.some(p => p.pattern.includes('health'))).toBe(true);
    });

    it('should define subscriptions for relationships agent', () => {
      const relationships = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.relationships');

      expect(relationships).toBeDefined();
      expect(relationships?.patterns.some(p => p.pattern.includes('family'))).toBe(true);
    });

    it('should have valid priorities (positive numbers)', () => {
      for (const agent of AGENT_SUBSCRIPTIONS) {
        for (const pattern of agent.patterns) {
          expect(pattern.priority).toBeGreaterThan(0);
          expect(pattern.priority).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should have unique agent IDs', () => {
      const ids = AGENT_SUBSCRIPTIONS.map(a => a.agentId);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('initializeAgentSubscriptions', () => {
    it('should call subscribe for each pattern', () => {
      initializeAgentSubscriptions();

      const totalPatterns = AGENT_SUBSCRIPTIONS.reduce(
        (sum, a) => sum + a.patterns.length,
        0
      );

      expect(mockSubscribe).toHaveBeenCalledTimes(totalPatterns);
    });

    it('should pass correct parameters to subscribe', () => {
      initializeAgentSubscriptions();

      // Check first call matches expected structure
      expect(mockSubscribe).toHaveBeenCalledWith(
        expect.any(String), // pattern
        expect.any(Function), // handler
        expect.any(Number), // priority
        expect.any(String) // agentId
      );
    });

    it('should pass agentId to subscribe', () => {
      initializeAgentSubscriptions();

      // Find a call that used orchestrator
      const orchestratorCalls = mockSubscribe.mock.calls.filter(
        call => call[3] === 'agent.orchestrator'
      );

      expect(orchestratorCalls.length).toBeGreaterThan(0);
    });

    it('should use correct priorities', () => {
      initializeAgentSubscriptions();

      // Find orchestrator's '*' subscription (priority 100)
      const orchestratorWildcard = AGENT_SUBSCRIPTIONS
        .find(a => a.agentId === 'agent.orchestrator')
        ?.patterns.find(p => p.pattern === '*');

      const matchingCall = mockSubscribe.mock.calls.find(
        call => call[0] === '*' && call[3] === 'agent.orchestrator'
      );

      expect(matchingCall?.[2]).toBe(orchestratorWildcard?.priority);
    });
  });

  describe('getSubscriptionStats', () => {
    it('should return total agent count', () => {
      const stats = getSubscriptionStats();

      expect(stats.totalAgents).toBe(AGENT_SUBSCRIPTIONS.length);
    });

    it('should return total pattern count', () => {
      const stats = getSubscriptionStats();

      const expectedTotal = AGENT_SUBSCRIPTIONS.reduce(
        (sum, a) => sum + a.patterns.length,
        0
      );

      expect(stats.totalPatterns).toBe(expectedTotal);
    });

    it('should return agent details', () => {
      const stats = getSubscriptionStats();

      expect(stats.agentDetails).toBeDefined();
      expect(Array.isArray(stats.agentDetails)).toBe(true);
      expect(stats.agentDetails.length).toBe(AGENT_SUBSCRIPTIONS.length);
    });

    it('should include patternCount for each agent', () => {
      const stats = getSubscriptionStats();

      for (const detail of stats.agentDetails) {
        expect(detail.agentId).toBeDefined();
        expect(typeof detail.patternCount).toBe('number');
        expect(detail.patternCount).toBeGreaterThan(0);
      }
    });

    it('should match individual agent pattern counts', () => {
      const stats = getSubscriptionStats();

      for (const agent of AGENT_SUBSCRIPTIONS) {
        const detail = stats.agentDetails.find(d => d.agentId === agent.agentId);
        expect(detail?.patternCount).toBe(agent.patterns.length);
      }
    });
  });

  describe('Handler Creation', () => {
    it('should create handlers that log events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initializeAgentSubscriptions();

      // Get a handler from one of the subscribe calls
      const handler = mockSubscribe.mock.calls[0][1];
      const testEvent = {
        id: 'test-event',
        type: 'message',
        source: 'test-source',
        priority: 'normal',
        payload: {},
        timestamp: new Date(),
      };

      // Call the handler
      handler(testEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('received event')
      );

      consoleSpy.mockRestore();
    });
  });
});
