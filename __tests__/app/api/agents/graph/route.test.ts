/**
 * Agents Graph API Route Tests
 * Tests for /api/agents/graph endpoint
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
      name: 'Memory/Research',
      icon: 'brain',
      status: 'green',
      last_sync: '2025-01-31T12:00:00Z',
      hp: 95,
      mp: 80,
      open_items: 3,
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
    },
  ];

  describe('GET /api/agents/graph', () => {
    it('should return graph data with nodes and edges', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
      expect(data).toHaveProperty('timestamp');
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
    });

    it('should create nodes with correct structure', async () => {
      getAllAgentsStatus.mockResolvedValue([mockAgents[0]]);

      const response = await GET();
      const data = await response.json();

      expect(data.nodes[0]).toMatchObject({
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

    it('should place grok agent in center position', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      const grokNode = data.nodes.find((n: any) => n.id === 'grok');
      expect(grokNode).toBeDefined();
      expect(grokNode.position).toEqual({ x: 500, y: 300 });
    });

    it('should position non-grok agents in circle', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      const nonGrokNodes = data.nodes.filter((n: any) => n.id !== 'grok');

      nonGrokNodes.forEach((node: any) => {
        // Non-grok agents should NOT be at the center position (500, 300)
        const isAtCenter = node.position.x === 500 && node.position.y === 300;
        expect(isAtCenter).toBe(false);
        // Verify it's on a circle with radius 250 centered at (500, 300)
        const distance = Math.sqrt(
          Math.pow(node.position.x - 500, 2) +
          Math.pow(node.position.y - 300, 2)
        );
        // Allow 1 pixel tolerance for floating point errors
        expect(distance).toBeGreaterThan(248);
        expect(distance).toBeLessThan(252);
      });
    });

    it('should create edges with correct structure', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      if (data.edges.length > 0) {
        expect(data.edges[0]).toMatchObject({
          from: expect.any(String),
          to: expect.any(String),
          type: expect.stringMatching(/^(data|control|bidirectional)$/),
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
        const fromAgent = mockAgents.find(a => a.id === e.from);
        const toAgent = mockAgents.find(a => a.id === e.to);
        return fromAgent && toAgent &&
               fromAgent.status !== 'red' && toAgent.status !== 'red';
      });

      edgesBetweenHealthy.forEach((edge: any) => {
        expect(edge.healthy).toBe(true);
        expect(edge.errorLog).toBeUndefined();
      });
    });

    it('should return 500 on error', async () => {
      getAllAgentsStatus.mockRejectedValue(new Error('Database error'));

      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch agent graph');
    });

    it('should include timestamp in ISO format', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should handle empty agents array', async () => {
      getAllAgentsStatus.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(data.nodes).toEqual([]);
      expect(data.edges).toEqual([]);
      expect(data.timestamp).toBeDefined();
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

      expect(data.nodes[0].id).toBe('grok');
      expect(data.nodes[0].name).toBe('Memory/Research');
      expect(data.nodes[0].hp).toBe(95);
      expect(data.nodes[0].mp).toBe(80);
      expect(data.nodes[0].openItems).toBe(3);
      expect(data.nodes[0].status).toBe('green');
    });
  });
});
