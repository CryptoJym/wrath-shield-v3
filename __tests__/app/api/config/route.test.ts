/**
 * Config API Route Tests
 * Tests for /api/config endpoint - Life OS Configuration
 */

import { GET } from '@/app/api/config/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/life-os-config', () => ({
  getLifeCharter: jest.fn(),
  getDomains: jest.fn(),
  getAgents: jest.fn(),
  getMappings: jest.fn(),
  getAgent: jest.fn(),
  getDomain: jest.fn(),
  getMappingForDomain: jest.fn(),
  getAgentsForDomain: jest.fn(),
}));

const {
  getLifeCharter,
  getDomains,
  getAgents,
  getMappings,
  getAgent,
  getDomain,
  getMappingForDomain,
  getAgentsForDomain,
} = require('@/lib/life-os-config');

describe('Config API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCharter = {
    mission: 'Enable focused productivity',
    values: ['autonomy', 'clarity', 'efficiency'],
    principles: ['Automate the mundane', 'Escalate the critical'],
  };

  const mockDomains = {
    domains: [
      { id: 'work', name: 'Work', parent_domain: null },
      { id: 'personal', name: 'Personal', parent_domain: null },
      { id: 'engineering', name: 'Engineering', parent_domain: 'work' },
    ],
  };

  const mockAgents = {
    agents: [
      { id: 'agent.ea', name: 'Executive Assistant', domains: ['*'] },
      { id: 'agent.pm', name: 'Project Manager', domains: ['work', 'engineering'] },
      { id: 'agent.finance', name: 'Finance Agent', domains: ['personal'] },
    ],
  };

  const mockMappings = {
    motion: {
      workspaces: [
        { id: 'ws-1', name: 'Main Workspace' },
      ],
    },
    github: {
      organizations: [
        { id: 'org-1', name: 'my-org' },
      ],
      repos: [
        { id: 'repo-1', full_name: 'my-org/my-repo', sensitivity: 'normal' },
      ],
    },
    project_mappings: [
      {
        domains: ['work'],
        motion_workspace_id: 'ws-1',
        github_repos: ['repo-1'],
        direction: 'bidirectional',
        auto_create_issue: true,
        auto_create_task: true,
      },
    ],
  };

  beforeEach(() => {
    getLifeCharter.mockReturnValue(mockCharter);
    getDomains.mockReturnValue(mockDomains);
    getAgents.mockReturnValue(mockAgents);
    getMappings.mockReturnValue(mockMappings);
  });

  describe('GET /api/config - Full Config', () => {
    it('should return complete config bundle', async () => {
      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('charter');
      expect(data).toHaveProperty('domains');
      expect(data).toHaveProperty('agents');
      expect(data).toHaveProperty('mappings');
      expect(data).toHaveProperty('graph');
    });

    it('should build graph data with nodes', async () => {
      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data.graph.nodes)).toBe(true);
      expect(data.graph.nodes.length).toBeGreaterThan(0);

      // Should have domain nodes
      const domainNodes = data.graph.nodes.filter((n: any) => n.type === 'domain');
      expect(domainNodes.length).toBe(3);

      // Should have agent nodes
      const agentNodes = data.graph.nodes.filter((n: any) => n.type === 'agent');
      expect(agentNodes.length).toBe(3);
    });

    it('should build graph data with edges', async () => {
      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data.graph.edges)).toBe(true);
      expect(data.graph.edges.length).toBeGreaterThan(0);

      // Should have agent-to-domain edges
      const handleEdges = data.graph.edges.filter((e: any) => e.type === 'handles');
      expect(handleEdges.length).toBeGreaterThan(0);
    });

    it('should include parent-child domain relationships', async () => {
      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      const parentEdges = data.graph.edges.filter((e: any) => e.type === 'parent_of');
      expect(parentEdges.length).toBe(1);
      expect(parentEdges[0].source).toBe('domain-work');
      expect(parentEdges[0].target).toBe('domain-engineering');
    });
  });

  describe('GET /api/config?type=charter', () => {
    it('should return only charter', async () => {
      const request = new NextRequest('http://localhost/api/config?type=charter');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual(mockCharter);
    });
  });

  describe('GET /api/config?type=domains', () => {
    it('should return all domains', async () => {
      const request = new NextRequest('http://localhost/api/config?type=domains');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual(mockDomains);
    });

    it('should return specific domain with enriched data', async () => {
      const domainData = { id: 'work', name: 'Work' };
      const domainAgents = [mockAgents.agents[1]];
      const domainMapping = mockMappings.project_mappings[0];

      getDomain.mockReturnValue(domainData);
      getAgentsForDomain.mockReturnValue(domainAgents);
      getMappingForDomain.mockReturnValue(domainMapping);

      const request = new NextRequest('http://localhost/api/config?type=domains&id=work');
      const response = await GET(request);
      const data = await response.json();

      expect(data.domain).toEqual(domainData);
      expect(data.agents).toEqual(domainAgents);
      expect(data.mapping).toEqual(domainMapping);
    });

    it('should return 404 for unknown domain', async () => {
      getDomain.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/config?type=domains&id=unknown');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Domain not found');
    });
  });

  describe('GET /api/config?type=agents', () => {
    it('should return all agents', async () => {
      const request = new NextRequest('http://localhost/api/config?type=agents');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual(mockAgents);
    });

    it('should return specific agent', async () => {
      const agent = mockAgents.agents[0];
      getAgent.mockReturnValue(agent);

      const request = new NextRequest('http://localhost/api/config?type=agents&id=agent.ea');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual(agent);
    });

    it('should return 404 for unknown agent', async () => {
      getAgent.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/config?type=agents&id=agent.unknown');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Agent not found');
    });
  });

  describe('GET /api/config?type=mappings', () => {
    it('should return all mappings', async () => {
      const request = new NextRequest('http://localhost/api/config?type=mappings');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual(mockMappings);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on error', async () => {
      getLifeCharter.mockImplementation(() => {
        throw new Error('Config file not found');
      });

      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Config file not found');
    });

    it('should handle unknown errors', async () => {
      getLifeCharter.mockImplementation(() => {
        throw 'Unknown failure';
      });

      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Unknown error');
    });
  });

  describe('Graph Building - Wildcard Agents', () => {
    it('should connect wildcard agents to all domains', async () => {
      const request = new NextRequest('http://localhost/api/config');
      const response = await GET(request);
      const data = await response.json();

      // EA agent has domains: ['*'], should connect to all 3 domains
      const eaEdges = data.graph.edges.filter(
        (e: any) => e.source === 'agent.ea' && e.type === 'handles'
      );
      expect(eaEdges.length).toBe(3);
    });
  });
});
