// @ts-nocheck
/**
 * Wrath Shield v3 - Orchestrator Memory Tests
 *
 * Tests for the orchestrator's specialized memory operations:
 * - Private orchestrator graph access
 * - Org-council graph read access
 * - Decision recording and tracking
 * - Policy proposals to council
 * - Context retrieval for system prompts
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep memory module
const mockAddAgentMemory = jest.fn().mockResolvedValue(undefined);
const mockSearchAgentMemory = jest.fn().mockResolvedValue([]);
const mockSearchOrgMemory = jest.fn().mockResolvedValue([]);
const mockSearchAllMemory = jest.fn().mockResolvedValue({ agent: [], org: [] });
const mockProposeOrgMemory = jest.fn().mockResolvedValue({
  id: 'proposal-123',
  proposedBy: 'orchestrator-agent',
  text: 'test proposal',
  status: 'pending',
});
const mockGetPendingOrgProposals = jest.fn().mockReturnValue([]);
const mockGetAllOrgProposals = jest.fn().mockReturnValue([]);
const mockGetProposalCounts = jest.fn().mockReturnValue({ pending: 0, approved: 0, rejected: 0 });
const mockGetUnreadNotifications = jest.fn().mockReturnValue([]);
const mockGetUnreadNotificationCount = jest.fn().mockReturnValue(0);

jest.mock('@/lib/memory/zep', () => ({
  addAgentMemory: mockAddAgentMemory,
  searchAgentMemory: mockSearchAgentMemory,
  searchOrgMemory: mockSearchOrgMemory,
  searchAllMemory: mockSearchAllMemory,
  proposeOrgMemory: mockProposeOrgMemory,
  getPendingOrgProposals: mockGetPendingOrgProposals,
  getAllOrgProposals: mockGetAllOrgProposals,
  getProposalCounts: mockGetProposalCounts,
  getUnreadNotifications: mockGetUnreadNotifications,
  getUnreadNotificationCount: mockGetUnreadNotificationCount,
}));

import {
  getOrchestratorContext,
  getPrivateMemory,
  getOrganizationalMemory,
  recordOrchestratorDecision,
  recordRoutingDecision,
  recordEscalationDecision,
  learnFromInteraction,
  proposeOrchestratorPolicy,
  getCouncilStatus,
  getOrchestratorNotifications,
  recordCoordinationAction,
  recordDelegation,
  findSimilarDecisions,
  getContextForSystemPrompt,
  ORCHESTRATOR_AGENT_ID,
} from '@/lib/agents/orchestrator-memory';

describe('Orchestrator Memory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export orchestrator agent ID', () => {
      expect(ORCHESTRATOR_AGENT_ID).toBe('orchestrator-agent');
    });
  });

  describe('getOrchestratorContext', () => {
    it('should return both private and org memory results', async () => {
      mockSearchAllMemory.mockResolvedValueOnce({
        agent: [{ memory: { id: '1', text: 'private' } }],
        org: [{ memory: { id: '2', text: 'org' } }],
      });

      const result = await getOrchestratorContext('test query');

      expect(result.private).toHaveLength(1);
      expect(result.org).toHaveLength(1);
      expect(mockSearchAllMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        'test query',
        5
      );
    });

    it('should respect custom limit', async () => {
      mockSearchAllMemory.mockResolvedValueOnce({ agent: [], org: [] });

      await getOrchestratorContext('query', 10);

      expect(mockSearchAllMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        'query',
        10
      );
    });
  });

  describe('getPrivateMemory', () => {
    it('should search orchestrator private memory', async () => {
      const mockResults = [{ memory: { id: '1', text: 'result' } }];
      mockSearchAgentMemory.mockResolvedValueOnce(mockResults);

      const result = await getPrivateMemory('test query');

      expect(result).toEqual(mockResults);
      expect(mockSearchAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        'test query',
        10
      );
    });

    it('should use custom limit', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([]);

      await getPrivateMemory('query', 5);

      expect(mockSearchAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        'query',
        5
      );
    });
  });

  describe('getOrganizationalMemory', () => {
    it('should search org council memory', async () => {
      const mockResults = [{ memory: { id: '1', text: 'org result' } }];
      mockSearchOrgMemory.mockResolvedValueOnce(mockResults);

      const result = await getOrganizationalMemory('org query');

      expect(result).toEqual(mockResults);
      expect(mockSearchOrgMemory).toHaveBeenCalledWith('org query', 10);
    });
  });

  describe('recordOrchestratorDecision', () => {
    it('should record a decision to memory', async () => {
      const decision = {
        type: 'routing' as const,
        description: 'Routed to finance agent',
        targetAgents: ['agent.finance'],
        rationale: 'Query related to finances',
      };

      const id = await recordOrchestratorDecision(decision);

      expect(id).toMatch(/^decision_\d+_[a-z0-9]+$/);
      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('[ORCHESTRATOR DECISION] ROUTING'),
        expect.objectContaining({
          type: 'decision',
          decision_type: 'routing',
          target_agents: ['agent.finance'],
        })
      );
    });

    it('should include escalation level when provided', async () => {
      const decision = {
        type: 'escalation' as const,
        description: 'Escalated to critical',
        rationale: 'Urgent matter',
        escalationLevel: 'CRITICAL' as const,
      };

      await recordOrchestratorDecision(decision);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('Escalation: CRITICAL'),
        expect.objectContaining({
          escalation_level: 'CRITICAL',
        })
      );
    });

    it('should include outcome when provided', async () => {
      const decision = {
        type: 'delegation' as const,
        description: 'Delegated task',
        rationale: 'Appropriate specialist',
        outcome: 'Successfully completed',
      };

      await recordOrchestratorDecision(decision);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('Outcome: Successfully completed'),
        expect.any(Object)
      );
    });
  });

  describe('recordRoutingDecision', () => {
    it('should record routing with target agents', async () => {
      const id = await recordRoutingDecision(
        'What are my finances?',
        ['agent.finance'],
        'Query is about financial matters'
      );

      expect(id).toMatch(/^decision_/);
      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('Target Agents: agent.finance'),
        expect.objectContaining({
          original_request: 'What are my finances?',
        })
      );
    });

    it('should include additional metadata', async () => {
      await recordRoutingDecision(
        'Help me',
        ['agent.ea', 'agent.pm'],
        'Multiple domains',
        { confidence: 0.9 }
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.any(String),
        expect.objectContaining({
          confidence: 0.9,
        })
      );
    });
  });

  describe('recordEscalationDecision', () => {
    it('should record escalation with level', async () => {
      await recordEscalationDecision(
        'Legal matter requiring review',
        'PROPOSE',
        'Sensitive legal issue'
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('[ORCHESTRATOR DECISION] ESCALATION'),
        expect.objectContaining({
          escalation_level: 'PROPOSE',
        })
      );
    });

    it('should handle all escalation levels', async () => {
      for (const level of ['AUTO_EXECUTE', 'PROPOSE', 'CRITICAL'] as const) {
        jest.clearAllMocks();
        await recordEscalationDecision('Test', level, 'Reason');
        expect(mockAddAgentMemory).toHaveBeenCalled();
      }
    });
  });

  describe('learnFromInteraction', () => {
    it('should add pattern learning to memory', async () => {
      await learnFromInteraction(
        'User prefers morning meetings',
        'preference'
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        '[PREFERENCE] User prefers morning meetings',
        expect.objectContaining({
          type: 'learning',
          category: 'preference',
        })
      );
    });

    it('should support all learning categories', async () => {
      const categories = ['pattern', 'preference', 'context', 'observation'] as const;

      for (const category of categories) {
        jest.clearAllMocks();
        await learnFromInteraction('Test learning', category);

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'orchestrator-agent',
          `[${category.toUpperCase()}] Test learning`,
          expect.objectContaining({ category })
        );
      }
    });

    it('should include additional metadata', async () => {
      await learnFromInteraction('Observation', 'observation', { source: 'user' });

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.any(String),
        expect.objectContaining({
          source: 'user',
        })
      );
    });
  });

  describe('proposeOrchestratorPolicy', () => {
    it('should submit policy proposal to council', async () => {
      const proposal = await proposeOrchestratorPolicy(
        'Always route legal queries to legal agent',
        'Improves accuracy',
        'routing'
      );

      expect(proposal.id).toBe('proposal-123');
      expect(mockProposeOrgMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('[POLICY PROPOSAL - ROUTING]'),
        expect.objectContaining({
          type: 'policy_proposal',
          category: 'routing',
        })
      );
    });

    it('should also record submission in private memory', async () => {
      await proposeOrchestratorPolicy(
        'New escalation rule',
        'Reduces delays',
        'escalation'
      );

      // Should call addAgentMemory for private record
      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('Submitted policy proposal to council'),
        expect.objectContaining({
          type: 'proposal_submitted',
        })
      );
    });

    it('should support all policy categories', async () => {
      const categories = ['routing', 'escalation', 'coordination', 'governance'] as const;

      for (const category of categories) {
        jest.clearAllMocks();
        await proposeOrchestratorPolicy('Policy', 'Reason', category);

        expect(mockProposeOrgMemory).toHaveBeenCalledWith(
          'orchestrator-agent',
          expect.stringContaining(`[POLICY PROPOSAL - ${category.toUpperCase()}]`),
          expect.objectContaining({ category })
        );
      }
    });
  });

  describe('getCouncilStatus', () => {
    it('should return council status summary', () => {
      mockGetProposalCounts.mockReturnValueOnce({ pending: 3, approved: 10, rejected: 2 });
      mockGetPendingOrgProposals.mockReturnValueOnce([
        { id: '1', proposedBy: 'orchestrator-agent' },
        { id: '2', proposedBy: 'other-agent' },
      ]);
      mockGetAllOrgProposals.mockReturnValueOnce([]);
      mockGetUnreadNotificationCount.mockReturnValueOnce(5);

      const status = getCouncilStatus();

      expect(status.pendingProposals).toBe(3);
      expect(status.unreadNotifications).toBe(5);
      expect(status.orchestratorProposals).toHaveLength(1);
    });

    it('should filter orchestrator proposals only', () => {
      mockGetProposalCounts.mockReturnValueOnce({ pending: 2 });
      mockGetPendingOrgProposals.mockReturnValueOnce([
        { id: '1', proposedBy: 'orchestrator-agent' },
        { id: '2', proposedBy: 'orchestrator-agent' },
        { id: '3', proposedBy: 'legal-agent' },
      ]);
      mockGetAllOrgProposals.mockReturnValueOnce([]);
      mockGetUnreadNotificationCount.mockReturnValueOnce(0);

      const status = getCouncilStatus();

      expect(status.orchestratorProposals).toHaveLength(2);
    });
  });

  describe('getOrchestratorNotifications', () => {
    it('should get notifications for orchestrator', () => {
      const mockNotifications = [{ id: '1', message: 'Proposal approved' }];
      mockGetUnreadNotifications.mockReturnValueOnce(mockNotifications);

      const result = getOrchestratorNotifications();

      expect(result).toEqual(mockNotifications);
      expect(mockGetUnreadNotifications).toHaveBeenCalledWith('orchestrator-agent');
    });
  });

  describe('recordCoordinationAction', () => {
    it('should record coordination between agents', async () => {
      await recordCoordinationAction(
        'Synced calendars',
        ['agent.ea', 'agent.pm'],
        'Calendars now in sync'
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('[ORCHESTRATOR DECISION] COORDINATION'),
        expect.objectContaining({
          decision_type: 'coordination',
        })
      );
    });
  });

  describe('recordDelegation', () => {
    it('should record task delegation', async () => {
      await recordDelegation(
        'Handle billing inquiry',
        'agent.finance',
        'Finance specialist needed'
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('Delegated task to agent.finance'),
        expect.objectContaining({
          decision_type: 'delegation',
          target_agents: ['agent.finance'],
        })
      );
    });
  });

  describe('findSimilarDecisions', () => {
    it('should filter to decision-type memories only', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([
        { memory: { id: '1', text: 'decision', metadata: { type: 'decision' } } },
        { memory: { id: '2', text: 'learning', metadata: { type: 'learning' } } },
        { memory: { id: '3', text: 'decision2', metadata: { type: 'decision' } } },
      ]);

      const results = await findSimilarDecisions('routing query');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.memory.metadata?.type === 'decision')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([
        { memory: { id: '1', metadata: { type: 'decision' } } },
        { memory: { id: '2', metadata: { type: 'decision' } } },
        { memory: { id: '3', metadata: { type: 'decision' } } },
      ]);

      const results = await findSimilarDecisions('query', 2);

      expect(results).toHaveLength(2);
    });
  });

  describe('getContextForSystemPrompt', () => {
    it('should format context with both memory types', async () => {
      mockSearchAllMemory.mockResolvedValueOnce({
        agent: [{ memory: { text: 'Private knowledge' } }],
        org: [{ memory: { text: 'Org knowledge' } }],
      });
      mockGetProposalCounts.mockReturnValueOnce({ pending: 2 });
      mockGetPendingOrgProposals.mockReturnValueOnce([]);
      mockGetAllOrgProposals.mockReturnValueOnce([]);
      mockGetUnreadNotificationCount.mockReturnValueOnce(3);

      const context = await getContextForSystemPrompt('user request');

      expect(context).toContain('### Relevant Orchestrator Memory:');
      expect(context).toContain('Private knowledge');
      expect(context).toContain('### Organizational Knowledge:');
      expect(context).toContain('Org knowledge');
      expect(context).toContain('### Council Status: 2 pending proposal(s)');
      expect(context).toContain('### Unread Notifications: 3');
    });

    it('should handle empty results gracefully', async () => {
      mockSearchAllMemory.mockResolvedValueOnce({ agent: [], org: [] });
      mockGetProposalCounts.mockReturnValueOnce({ pending: 0 });
      mockGetPendingOrgProposals.mockReturnValueOnce([]);
      mockGetAllOrgProposals.mockReturnValueOnce([]);
      mockGetUnreadNotificationCount.mockReturnValueOnce(0);

      const context = await getContextForSystemPrompt('request');

      expect(context).toBe('');
    });
  });
});
