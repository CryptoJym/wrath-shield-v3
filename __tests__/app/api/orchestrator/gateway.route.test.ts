/**
 * Orchestrator Gateway API Route Tests
 * Tests for /api/orchestrator/gateway endpoint - Central Life OS Gateway
 */

import { GET, POST } from '@/app/api/orchestrator/gateway/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    invoke: jest.fn(),
    getPendingEscalations: jest.fn(() => []),
  },
}));

jest.mock('@/lib/memory/zep', () => ({
  searchAgentMemory: jest.fn(),
  searchOrgMemory: jest.fn(),
  searchAllMemory: jest.fn(),
  addAgentMemory: jest.fn(),
  proposeOrgMemory: jest.fn(),
  getPendingOrgProposals: jest.fn(() => []),
  getAllOrgProposals: jest.fn(() => []),
  approveOrgProposal: jest.fn(),
  rejectOrgProposal: jest.fn(),
  getProposalCounts: jest.fn(() => ({ pending: 0, approved: 0, rejected: 0 })),
}));

jest.mock('@/lib/agents/registry', () => ({
  getAllAgentsStatus: jest.fn(() => []),
}));

jest.mock('@/lib/life-os-config', () => ({
  getLifeCharter: jest.fn(() => ({ version: 1, lastUpdated: '2025-01-31' })),
  getDomains: jest.fn(() => ({ domains: [] })),
  getAgents: jest.fn(() => ({ agents: [] })),
  getMappings: jest.fn(() => ({})),
  getAgent: jest.fn(),
  getDomain: jest.fn(),
}));

jest.mock('@/lib/agents/UnifiedBus', () => ({
  getUnifiedBus: jest.fn(() => ({
    readAgentMemory: jest.fn(),
    writeAgentMemory: jest.fn(),
    searchAllAgentMemories: jest.fn(),
    readOrgMemory: jest.fn(),
    writeOrgMemory: jest.fn(),
    invokeAgent: jest.fn(),
    broadcast: jest.fn(),
    routeMessage: jest.fn(),
    getAgentState: jest.fn(),
    getAllAgentStates: jest.fn(() => ({})),
    getSystemOverview: jest.fn(),
  })),
}));

const { agentInvoker } = require('@/lib/agents/AgentInvoker');
const {
  searchAgentMemory,
  searchOrgMemory,
  addAgentMemory,
  proposeOrgMemory,
  approveOrgProposal,
  rejectOrgProposal,
  getAllOrgProposals,
  getProposalCounts,
} = require('@/lib/memory/zep');
const { getAllAgentsStatus } = require('@/lib/agents/registry');
const { getUnifiedBus } = require('@/lib/agents/UnifiedBus');

describe('Orchestrator Gateway API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/orchestrator/gateway - Invoke Operation', () => {
    it('should invoke agent successfully', async () => {
      agentInvoker.invoke.mockResolvedValue({
        agentId: 'agent.ea',
        content: 'Meeting scheduled for tomorrow at 2pm',
        escalationLevel: 'AUTO_EXECUTE',
        shouldExecute: true,
        model: 'claude-3-sonnet',
        latencyMs: 250,
        detectedDomain: 'work',
      });

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'invoke',
          agentId: 'agent.ea',
          message: 'Schedule a meeting for tomorrow',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agentId).toBe('agent.ea');
      expect(data.content).toContain('Meeting scheduled');
      expect(data.wasExecuted).toBe(true);
    });

    it('should return 400 when agentId missing', async () => {
      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'invoke',
          message: 'Test message',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('agentId');
    });

    it('should return 400 when message missing', async () => {
      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'invoke',
          agentId: 'agent.ea',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('message');
    });

    it('should handle invoke errors', async () => {
      agentInvoker.invoke.mockRejectedValue(new Error('Agent unavailable'));

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'invoke',
          agentId: 'agent.ea',
          message: 'Test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Agent unavailable');
    });
  });

  describe('POST /api/orchestrator/gateway - Memory Operation', () => {
    it('should search agent memory', async () => {
      searchAgentMemory.mockResolvedValue([
        { id: 'mem-1', content: 'Test memory', score: 0.9 },
      ]);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'memory',
          operation: 'search',
          graphType: 'agent',
          agentId: 'agent.ea',
          query: 'meetings',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(1);
    });

    it('should add agent memory', async () => {
      addAgentMemory.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'memory',
          operation: 'add',
          graphType: 'agent',
          agentId: 'agent.ea',
          text: 'New memory content',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(addAgentMemory).toHaveBeenCalledWith('agent.ea', 'New memory content', undefined);
    });

    it('should propose org memory', async () => {
      proposeOrgMemory.mockResolvedValue({ id: 'proposal-123' });

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'memory',
          operation: 'propose',
          text: 'New org policy',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.proposalId).toBe('proposal-123');
    });

    it('should approve proposal', async () => {
      approveOrgProposal.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'memory',
          operation: 'approve',
          proposalId: 'proposal-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should list proposals', async () => {
      getAllOrgProposals.mockReturnValue([{ id: 'p1' }, { id: 'p2' }]);
      getProposalCounts.mockReturnValue({ pending: 2, approved: 5, rejected: 1 });

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'memory',
          operation: 'list-proposals',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.proposals).toHaveLength(2);
      expect(data.counts.pending).toBe(2);
    });
  });

  describe('POST /api/orchestrator/gateway - Unified Bus Operation', () => {
    it('should read agent memory via unified bus', async () => {
      const mockBus = {
        readAgentMemory: jest.fn().mockResolvedValue([{ content: 'test' }]),
      };
      getUnifiedBus.mockReturnValue(mockBus);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'read_agent_memory',
          agentId: 'agent.pm',
          query: 'projects',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockBus.readAgentMemory).toHaveBeenCalledWith('agent.pm', 'projects', 5);
    });

    it('should invoke agent via unified bus', async () => {
      const mockBus = {
        invokeAgent: jest.fn().mockResolvedValue({
          success: true,
          content: 'Response from agent',
        }),
      };
      getUnifiedBus.mockReturnValue(mockBus);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'invoke_agent',
          agentId: 'agent.pm',
          message: 'Check project status',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should broadcast message', async () => {
      const mockBus = {
        broadcast: jest.fn().mockResolvedValue({ success: true, delivered: 3 }),
      };
      getUnifiedBus.mockReturnValue(mockBus);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'unified',
          operation: 'broadcast',
          message: 'System maintenance in 1 hour',
          priority: 'high',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/orchestrator/gateway - Pulse Operation', () => {
    it('should return system pulse', async () => {
      getAllAgentsStatus.mockResolvedValue([
        { id: 'ea', name: 'EA', status: 'green', open_items: 0 },
        { id: 'pm', name: 'PM', status: 'yellow', open_items: 3 },
      ]);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway?operation=pulse');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('systemHealth');
      expect(data).toHaveProperty('agents');
      expect(data).toHaveProperty('bus');
      expect(data).toHaveProperty('memory');
    });

    it('should calculate system health correctly', async () => {
      agentInvoker.getPendingEscalations.mockReturnValue([
        { escalationLevel: 'CRITICAL' },
      ]);
      getAllAgentsStatus.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway?operation=pulse');
      const response = await GET(request);
      const data = await response.json();

      expect(data.systemHealth).toBe('critical');
    });
  });

  describe('GET /api/orchestrator/gateway - Config Operation', () => {
    it('should return all config', async () => {
      const request = new NextRequest('http://localhost/api/orchestrator/gateway?operation=config&scope=all');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('lifeCharter');
      expect(data).toHaveProperty('domains');
      expect(data).toHaveProperty('agents');
      expect(data).toHaveProperty('mappings');
    });
  });

  describe('GET /api/orchestrator/gateway - States Operation', () => {
    it('should return all agent states', async () => {
      const mockBus = {
        getAllAgentStates: jest.fn().mockReturnValue({
          'agent.ea': { status: 'active', lastUpdate: Date.now() },
          'agent.pm': { status: 'idle', lastUpdate: Date.now() },
        }),
      };
      getUnifiedBus.mockReturnValue(mockBus);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway?operation=states');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('states');
    });
  });

  describe('GET /api/orchestrator/gateway - Overview Operation', () => {
    it('should return system overview', async () => {
      const mockBus = {
        getSystemOverview: jest.fn().mockResolvedValue({
          totalAgents: 5,
          activeAgents: 3,
          pendingTasks: 10,
        }),
      };
      getUnifiedBus.mockReturnValue(mockBus);

      const request = new NextRequest('http://localhost/api/orchestrator/gateway?operation=overview');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('overview');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for unknown gateway operation', async () => {
      const request = new NextRequest('http://localhost/api/orchestrator/gateway', {
        method: 'POST',
        body: JSON.stringify({
          gatewayOperation: 'unknown',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown gateway operation');
    });

    it('should return 400 for unknown GET operation', async () => {
      const request = new NextRequest('http://localhost/api/orchestrator/gateway?operation=unknown');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown gateway operation');
    });
  });
});
