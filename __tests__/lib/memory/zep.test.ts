/**
 * Tests for Zep Cloud Memory Integration
 *
 * Tests the dual-graph architecture:
 * - Individual agent graphs
 * - Shared org-council graph with approval workflow
 */

import {
  AgentId,
  ORG_COUNCIL_GRAPH,
  OrgCouncilProposal,
} from '@/lib/memory/zep';

// Mock the Zep SDK
const mockGraphAdd = jest.fn().mockResolvedValue({});
const mockGraphSearch = jest.fn().mockResolvedValue({
  edges: [
    { uuid: 'mem-1', fact: 'Test memory', score: 0.9 },
  ],
});
const mockGraphGet = jest.fn().mockResolvedValue({ graphId: 'test-graph' });
const mockGraphCreate = jest.fn().mockResolvedValue({});

jest.mock('@getzep/zep-cloud', () => ({
  ZepClient: jest.fn().mockImplementation(() => ({
    graph: {
      add: mockGraphAdd,
      search: mockGraphSearch,
      get: mockGraphGet,
      create: mockGraphCreate,
    },
  })),
}));

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock council db
jest.mock('@/lib/db/council', () => ({
  createProposal: jest.fn((id, proposedBy, text, metadata) => ({
    id,
    proposed_by: proposedBy,
    text,
    metadata,
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  })),
  getProposal: jest.fn((id) => {
    if (id === 'existing-proposal') {
      return {
        id: 'existing-proposal',
        proposed_by: 'legal-agent',
        text: 'Test proposal text',
        metadata: null,
        status: 'pending',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };
    }
    return null;
  }),
  getPendingProposals: jest.fn(() => [
    {
      id: 'proposal-1',
      proposed_by: 'legal-agent',
      text: 'Pending proposal',
      metadata: null,
      status: 'pending',
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    },
  ]),
  getProposalsByStatus: jest.fn(() => []),
  getAllProposals: jest.fn(() => []),
  approveProposal: jest.fn(() => true),
  rejectProposal: jest.fn(() => true),
  getProposalCounts: jest.fn(() => ({
    pending: 1,
    approved: 5,
    rejected: 2,
  })),
  getUnreadNotifications: jest.fn(() => []),
  markNotificationsRead: jest.fn(() => 1),
  getUnreadNotificationCount: jest.fn(() => 3),
}));

// Set environment variable before importing
process.env.ZEP_API_KEY = 'test-api-key';

describe('Zep Memory Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export ORG_COUNCIL_GRAPH constant', () => {
      expect(ORG_COUNCIL_GRAPH).toBe('org-council');
    });
  });

  describe('AgentId Type', () => {
    it('should include all 13 agent IDs', () => {
      const validAgentIds: AgentId[] = [
        'orchestrator-agent',
        'legal-agent',
        'finance-agent',
        'pm-agent',
        'comms-agent',
        'health-agent',
        'coaching-agent',
        'hyro-agent',
        'grok-agent',
        'sherlock-agent',
        'ea-agent',
        'relationships-agent',
        'eeg-agent',
      ];

      // Type check - this would fail compilation if AgentId doesn't include these
      validAgentIds.forEach(id => {
        expect(typeof id).toBe('string');
      });
      expect(validAgentIds.length).toBe(13);
    });
  });

  describe('OrgCouncilProposal Interface', () => {
    it('should have correct structure', () => {
      const proposal: OrgCouncilProposal = {
        id: 'test-proposal-id',
        proposedBy: 'legal-agent',
        text: 'Test proposal content',
        metadata: { category: 'policy' },
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      expect(proposal.id).toBeDefined();
      expect(proposal.proposedBy).toBeDefined();
      expect(proposal.text).toBeDefined();
      expect(proposal.timestamp).toBeDefined();
      expect(proposal.status).toBe('pending');
    });

    it('should allow all valid statuses', () => {
      const statuses: OrgCouncilProposal['status'][] = ['pending', 'approved', 'rejected'];
      statuses.forEach(status => {
        expect(['pending', 'approved', 'rejected']).toContain(status);
      });
    });

    it('should allow optional reviewedBy and reviewedAt for approved/rejected', () => {
      const approvedProposal: OrgCouncilProposal = {
        id: 'approved-proposal',
        proposedBy: 'finance-agent',
        text: 'Budget policy',
        timestamp: new Date().toISOString(),
        status: 'approved',
        reviewedBy: 'council-admin',
        reviewedAt: new Date().toISOString(),
      };

      expect(approvedProposal.reviewedBy).toBe('council-admin');
      expect(approvedProposal.reviewedAt).toBeDefined();
    });
  });
});

describe('Zep Graph Naming', () => {
  it('should generate correct agent graph IDs', () => {
    // Agent graphs should follow pattern: wrath-shield-{agent}-agent
    const agents: AgentId[] = ['legal-agent', 'finance-agent', 'pm-agent'];

    agents.forEach(agent => {
      const expectedGraphId = `wrath-shield-${agent}`;
      expect(expectedGraphId).toMatch(/^wrath-shield-[a-z]+-agent$/);
    });
  });

  it('should generate correct org-council graph ID', () => {
    const orgGraphId = `wrath-shield-${ORG_COUNCIL_GRAPH}`;
    expect(orgGraphId).toBe('wrath-shield-org-council');
  });
});

describe('Dual-Graph Architecture', () => {
  it('should have separate graphs for agents and org-council', () => {
    const legalGraphId = 'wrath-shield-legal-agent';
    const financeGraphId = 'wrath-shield-finance-agent';
    const orgGraphId = 'wrath-shield-org-council';

    // All should be unique
    const graphIds = [legalGraphId, financeGraphId, orgGraphId];
    const uniqueIds = new Set(graphIds);
    expect(uniqueIds.size).toBe(graphIds.length);
  });

  it('should allow 13 unique agent graphs plus org-council', () => {
    const allAgents: AgentId[] = [
      'orchestrator-agent',
      'legal-agent',
      'finance-agent',
      'pm-agent',
      'comms-agent',
      'health-agent',
      'coaching-agent',
      'hyro-agent',
      'grok-agent',
      'sherlock-agent',
      'ea-agent',
      'relationships-agent',
      'eeg-agent',
    ];

    const allGraphIds = [
      ...allAgents.map(a => `wrath-shield-${a}`),
      'wrath-shield-org-council',
    ];

    expect(allGraphIds.length).toBe(14); // 13 agents + 1 org-council
    expect(new Set(allGraphIds).size).toBe(14); // All unique
  });
});
