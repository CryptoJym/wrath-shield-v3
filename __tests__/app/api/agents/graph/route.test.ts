/**
 * Agents Graph API Route Tests
 * Tests for /api/agents/graph endpoint
 *
 * Updated to reflect comprehensive network topology with:
 * - Multiple node types (agent, integration, llm, memory, cron)
 * - Multiple edge types (data, control, bidirectional, cron, llm, memory)
 * - Layered radial positioning
 */

import { GET } from '@/app/api/agents/graph/route';
import { Agent } from '@/app/agents/agents.mock';

// Mock dependencies
jest.mock('@/lib/agents/registry', () => ({
  getAllAgentsStatus: jest.fn(),
}));

const { getAllAgentsStatus } = require('@/lib/agents/registry');

describe('Agents Graph API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAgents: Agent[] = [
    {
      id: 'grok',
      name: 'Central Intelligence (Grok)',
      icon: 'brain',
      status: 'green',
      last_sync: '2025-01-31T12:00:00Z',
      hp: 95,
      mp: 80,
      open_items: 3,
      capabilities: ['Deep research', 'Synthesis'],
      link: '/chat',
      avatar: '/assets/agents/grok.png',
      nodeType: 'agent',
      category: 'core',
    },
    {
      id: 'legal',
      name: 'Legal Agent',
      icon: 'scale',
      status: 'green',
      last_sync: '2025-01-31T11:30:00Z',
      hp: 90,
      mp: 75,
      open_items: 5,
      capabilities: ['Case management'],
      link: '/legal',
      avatar: '/assets/agents/legal.png',
      nodeType: 'agent',
      category: 'core',
    },
    {
      id: 'finance',
      name: 'Finance Agent',
      icon: 'dollar-sign',
      status: 'yellow',
      last_sync: '2025-01-31T11:00:00Z',
      hp: 70,
      mp: 60,
      open_items: 12,
      capabilities: ['Transaction tracking'],
      link: '/finance',
      avatar: '/assets/agents/finance.png',
      nodeType: 'agent',
      category: 'core',
    },
  ];

  describe('GET /api/agents/graph', () => {
    it('should return graph data with nodes, edges, and stats', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('stats');
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
    });

    it('should create nodes with correct structure including new fields', async () => {
      getAllAgentsStatus.mockResolvedValue([mockAgents[0]]);

      const response = await GET();
      const data = await response.json();

      // Find the grok node (API merges with additional mock nodes)
      const grokNode = data.nodes.find((n: any) => n.id === 'grok');
      expect(grokNode).toBeDefined();
      expect(grokNode).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        status: expect.stringMatching(/^(green|yellow|red)$/),
        lastSeen: expect.any(String),
        hp: expect.any(Number),
        mp: expect.any(Number),
        openItems: expect.any(Number),
        position: {
          x: expect.any(Number),
          y: expect.any(Number),
        },
      });
    });

    it('should place grok agent in center position (600, 400)', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      const grokNode = data.nodes.find((n: any) => n.id === 'grok');
      expect(grokNode).toBeDefined();
      // New center position is (600, 400)
      expect(grokNode.position).toEqual({ x: 600, y: 400 });
    });

    it('should position core agents in inner ring around grok', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      // Filter to only the agents from our mock (not additional integrations/llms)
      const coreAgentNodes = data.nodes.filter((n: any) =>
        n.nodeType === 'agent' && n.category === 'core' && n.id !== 'grok'
      );

      coreAgentNodes.forEach((node: any) => {
        // Core agents should NOT be at the center position (600, 400)
        const isAtCenter = node.position.x === 600 && node.position.y === 400;
        expect(isAtCenter).toBe(false);

        // Verify it's on the inner ring (radius 180 centered at 600, 400)
        const distance = Math.sqrt(
          Math.pow(node.position.x - 600, 2) +
          Math.pow(node.position.y - 400, 2)
        );
        // Allow tolerance for floating point errors
        expect(distance).toBeGreaterThan(170);
        expect(distance).toBeLessThan(190);
      });
    });

    it('should create edges with correct structure including new types', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      if (data.edges.length > 0) {
        expect(data.edges[0]).toMatchObject({
          from: expect.any(String),
          to: expect.any(String),
          type: expect.stringMatching(/^(data|control|bidirectional|cron|llm|memory)$/),
          healthy: expect.any(Boolean),
        });

        expect(data.edges[0]).toHaveProperty('lastRun');
        expect(data.edges[0]).toHaveProperty('bandwidth');
        expect(data.edges[0]).toHaveProperty('volume');
      }
    });

    it('should mark edges unhealthy when agents are red', async () => {
      const unhealthyAgents: Agent[] = [
        { ...mockAgents[0], status: 'red' },
        { ...mockAgents[1], status: 'green' },
      ];
      getAllAgentsStatus.mockResolvedValue(unhealthyAgents);

      const response = await GET();
      const data = await response.json();

      const edgesFromGrok = data.edges.filter((e: any) => e.from === 'grok');
      edgesFromGrok.forEach((edge: any) => {
        expect(edge.healthy).toBe(false);
        expect(edge.errorLog).toBeDefined();
        expect(edge.errorLog).toContain('degraded');
      });
    });

    it('should mark edges healthy when both agents are green or yellow', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      const edgesBetweenHealthy = data.edges.filter((e: any) => {
        const fromNode = data.nodes.find((n: any) => n.id === e.from);
        const toNode = data.nodes.find((n: any) => n.id === e.to);
        return fromNode && toNode &&
               fromNode.status !== 'red' && toNode.status !== 'red';
      });

      edgesBetweenHealthy.forEach((edge: any) => {
        expect(edge.healthy).toBe(true);
        expect(edge.errorLog).toBeUndefined();
      });
    });

    it('should fall back to mock data on registry error', async () => {
      getAllAgentsStatus.mockRejectedValue(new Error('Database error'));

      const response = await GET();
      const data = await response.json();

      // Should still return 200 with fallback mock data
      expect(response.status).toBe(200);
      expect(data.nodes.length).toBeGreaterThan(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should include timestamp in ISO format', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should include all node types in response when using fallback', async () => {
      getAllAgentsStatus.mockRejectedValue(new Error('Registry unavailable'));

      const response = await GET();
      const data = await response.json();

      // With fallback data, we should have all node types
      const nodeTypes = [...new Set(data.nodes.map((n: any) => n.nodeType))];
      expect(nodeTypes).toContain('agent');
      expect(nodeTypes).toContain('integration');
      expect(nodeTypes).toContain('llm');
      expect(nodeTypes).toContain('memory');
      expect(nodeTypes).toContain('cron');
    });

    it('should create bidirectional edges for grok connections', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      const grokEdges = data.edges.filter((e: any) => e.from === 'grok');
      grokEdges.forEach((edge: any) => {
        expect(edge.type).toBe('bidirectional');
        expect(edge.label).toBe('sync');
      });
    });

    it('should calculate bandwidth and volume metrics', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      if (data.edges.length > 0) {
        data.edges.forEach((edge: any) => {
          expect(edge.bandwidth).toBeGreaterThanOrEqual(100);
          expect(edge.bandwidth).toBeLessThanOrEqual(1100);
          expect(edge.volume).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should preserve agent data in nodes', async () => {
      getAllAgentsStatus.mockResolvedValue([mockAgents[0]]);

      const response = await GET();
      const data = await response.json();

      // Find grok node (there will be additional nodes from fallback)
      const grokNode = data.nodes.find((n: any) => n.id === 'grok');
      expect(grokNode.id).toBe('grok');
      expect(grokNode.name).toBe('Central Intelligence (Grok)');
      expect(grokNode.hp).toBe(95);
      expect(grokNode.mp).toBe(80);
      expect(grokNode.openItems).toBe(3);
      expect(grokNode.status).toBe('green');
    });

    it('should include stats in response', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalAgents');
      expect(data.stats).toHaveProperty('totalIntegrations');
      expect(data.stats).toHaveProperty('totalConnections');
      expect(data.stats).toHaveProperty('healthyConnections');
      expect(data.stats).toHaveProperty('activeDataFlows');
    });

    it('should position integrations on left side', async () => {
      getAllAgentsStatus.mockRejectedValue(new Error('Use fallback'));

      const response = await GET();
      const data = await response.json();

      const integrations = data.nodes.filter((n: any) => n.nodeType === 'integration');

      integrations.forEach((node: any) => {
        // Integrations should be on left side (x < 200)
        expect(node.position.x).toBeLessThan(200);
      });
    });

    it('should position LLM providers on right side', async () => {
      getAllAgentsStatus.mockRejectedValue(new Error('Use fallback'));

      const response = await GET();
      const data = await response.json();

      const llms = data.nodes.filter((n: any) => n.nodeType === 'llm');

      llms.forEach((node: any) => {
        // LLMs should be on right side (x > 1000)
        expect(node.position.x).toBeGreaterThan(1000);
      });
    });
  });
});
