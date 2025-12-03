/**
 * Gateway API Unit Tests
 *
 * Tests the orchestrator gateway API endpoints.
 * These are unit tests that mock the underlying services.
 */

import { NextRequest } from 'next/server';

// Mock all dependencies before importing the route
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

jest.mock('@/lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    invoke: jest.fn().mockResolvedValue({
      agentId: 'agent.legal',
      content: 'Mock response',
      escalationLevel: 'AUTO_EXECUTE',
      shouldExecute: true,
      model: 'grok-4-1-fast',
      latencyMs: 100,
      detectedDomain: 'legal',
    }),
    getPendingEscalations: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('@/lib/memory/zep', () => ({
  searchAgentMemory: jest.fn().mockResolvedValue([]),
  searchOrgMemory: jest.fn().mockResolvedValue([]),
  searchAllMemory: jest.fn().mockResolvedValue({ agent: [], org: [] }),
  addAgentMemory: jest.fn().mockResolvedValue(undefined),
  proposeOrgMemory: jest.fn().mockResolvedValue({ id: 'proposal_123' }),
  getPendingOrgProposals: jest.fn().mockReturnValue([]),
  getAllOrgProposals: jest.fn().mockReturnValue([]),
  approveOrgProposal: jest.fn().mockReturnValue(true),
  rejectOrgProposal: jest.fn().mockReturnValue(true),
  getProposalCounts: jest.fn().mockReturnValue({ pending: 0, approved: 5, rejected: 2 }),
}));

jest.mock('@/lib/agents/registry', () => ({
  getAllAgentsStatus: jest.fn().mockResolvedValue([
    { id: 'orchestrator', name: 'Conductor', status: 'green', last_sync: new Date().toISOString(), open_items: 0 },
    { id: 'legal', name: 'Legal', status: 'green', last_sync: new Date().toISOString(), open_items: 2 },
  ]),
}));

jest.mock('@/lib/life-os-config', () => ({
  getLifeCharter: jest.fn().mockReturnValue({
    version: 1,
    lastUpdated: new Date().toISOString(),
    principles: ['Family first'],
  }),
  getDomains: jest.fn().mockReturnValue({ domains: [] }),
  getAgents: jest.fn().mockReturnValue({ agents: [] }),
  getMappings: jest.fn().mockReturnValue({}),
  getAgent: jest.fn().mockReturnValue(null),
  getDomain: jest.fn().mockReturnValue(null),
}));

jest.mock('@/lib/agents/UnifiedBus', () => ({
  getUnifiedBus: jest.fn().mockReturnValue({
    readAgentMemory: jest.fn().mockResolvedValue([]),
    writeAgentMemory: jest.fn().mockResolvedValue(true),
    searchAllAgentMemories: jest.fn().mockResolvedValue({}),
    readOrgMemory: jest.fn().mockResolvedValue([]),
    writeOrgMemory: jest.fn().mockResolvedValue(true),
    invokeAgent: jest.fn().mockResolvedValue({
      success: true,
      agentId: 'agent.legal',
      response: 'Mock response',
      escalationLevel: 'AUTO_EXECUTE',
      wasExecuted: true,
      latencyMs: 100,
      model: 'grok-4-1-fast',
    }),
    broadcast: jest.fn().mockResolvedValue({
      success: true,
      responses: [],
      totalAgents: 5,
      successCount: 5,
      failCount: 0,
    }),
    routeMessage: jest.fn().mockResolvedValue({
      agentId: 'agent.legal',
      response: { success: true, response: 'Routed' },
    }),
    getAgentState: jest.fn().mockReturnValue({
      agentId: 'agent.legal',
      status: 'idle',
      lastActivity: new Date().toISOString(),
    }),
    getAllAgentStates: jest.fn().mockReturnValue([]),
    getSystemOverview: jest.fn().mockResolvedValue({
      agents: [],
      orgMemoryCount: 5,
      recentActivity: [],
      pendingEscalations: 0,
      systemHealth: 'healthy',
    }),
  }),
}));

// Import the route handler after mocks are set up
import { POST, GET } from '@/app/api/orchestrator/gateway/route';

describe('Gateway API - POST Operations', () => {
  const createRequest = (body: object) => {
    return new NextRequest('http://localhost:4242/api/orchestrator/gateway', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  describe('invoke operation', () => {
    it('should invoke an agent successfully', async () => {
      const request = createRequest({
        gatewayOperation: 'invoke',
        agentId: 'agent.legal',
        message: 'Test message',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agentId).toBe('agent.legal');
    });

    it('should return error for missing agentId', async () => {
      const request = createRequest({
        gatewayOperation: 'invoke',
        message: 'Test message',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return error for missing message', async () => {
      const request = createRequest({
        gatewayOperation: 'invoke',
        agentId: 'agent.legal',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('memory operation', () => {
    it('should search agent memory', async () => {
      const request = createRequest({
        gatewayOperation: 'memory',
        operation: 'search',
        graphType: 'agent',
        agentId: 'legal-agent',
        query: 'test query',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.operation).toBe('search');
    });

    it('should require query for search', async () => {
      const request = createRequest({
        gatewayOperation: 'memory',
        operation: 'search',
        graphType: 'agent',
        agentId: 'legal-agent',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('unified operation', () => {
    it('should read agent memory', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'read_agent_memory',
        agentId: 'agent.legal',
        query: 'test query',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should write agent memory', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'write_agent_memory',
        agentId: 'agent.legal',
        text: 'Test memory entry',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should search all memories', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'search_all_memories',
        query: 'test query',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should invoke agent via unified bus', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'invoke_agent',
        agentId: 'agent.legal',
        message: 'Test message',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should broadcast to agents', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'broadcast',
        message: 'Broadcast test',
        priority: 'normal',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should route message', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'route_message',
        message: '@legal check this',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should get agent state', async () => {
      const request = createRequest({
        gatewayOperation: 'unified',
        operation: 'get_agent_state',
        agentId: 'agent.legal',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('unknown operation', () => {
    it('should return error for unknown operation', async () => {
      const request = createRequest({
        gatewayOperation: 'unknown',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown gateway operation');
    });
  });
});

describe('Gateway API - GET Operations', () => {
  const createGetRequest = (params: Record<string, string>) => {
    const url = new URL('http://localhost:4242/api/orchestrator/gateway');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url.toString(), { method: 'GET' });
  };

  describe('pulse operation', () => {
    it('should return system pulse', async () => {
      const request = createGetRequest({ operation: 'pulse' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timestamp).toBeDefined();
      expect(data.systemHealth).toBeDefined();
    });
  });

  describe('config operation', () => {
    it('should return life charter', async () => {
      const request = createGetRequest({ operation: 'config', scope: 'life_charter' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.lifeCharter).toBeDefined();
    });

    it('should return all config', async () => {
      const request = createGetRequest({ operation: 'config', scope: 'all' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('states operation', () => {
    it('should return all agent states', async () => {
      const request = createGetRequest({ operation: 'states' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.states).toBeDefined();
    });
  });

  describe('overview operation', () => {
    it('should return system overview', async () => {
      const request = createGetRequest({ operation: 'overview' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.overview).toBeDefined();
    });
  });

  describe('unknown operation', () => {
    it('should return error for unknown operation', async () => {
      const request = createGetRequest({ operation: 'unknown' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown gateway operation');
    });
  });
});
