/**
 * Agents Status API Route Tests
 * Tests for /api/agents/status endpoint
 */

import { GET } from '@/app/api/agents/status/route';
import { Agent } from '@/app/agents/agents.mock';

// Mock dependencies
jest.mock('@/lib/agents/registry', () => ({
  getAllAgentsStatus: jest.fn(),
}));

const { getAllAgentsStatus } = require('@/lib/agents/registry');

describe('Agents Status API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAgents: Agent[] = [
    {
      id: 'legal',
      name: 'Legal Agent',
      icon: 'scale',
      status: 'green',
      last_sync: '2025-01-31T12:00:00Z',
      hp: 95,
      mp: 80,
      open_items: 3,
    },
    {
      id: 'finance',
      name: 'Finance Agent',
      icon: 'dollar-sign',
      status: 'yellow',
      last_sync: '2025-01-31T11:30:00Z',
      hp: 70,
      mp: 60,
      open_items: 12,
    },
    {
      id: 'pm',
      name: 'PM Agent',
      icon: 'clipboard',
      status: 'red',
      last_sync: '2025-01-30T23:00:00Z',
      hp: 30,
      mp: 20,
      open_items: 25,
    },
  ];

  describe('GET /api/agents/status', () => {
    it('should return all agents status', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual(mockAgents);
    });

    it('should return empty array when no agents exist', async () => {
      getAllAgentsStatus.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
      expect(data.length).toBe(0);
    });

    it('should return 500 on error', async () => {
      getAllAgentsStatus.mockRejectedValue(new Error('Database connection failed'));

      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch agent status');
    });

    it('should return valid agent structure', async () => {
      getAllAgentsStatus.mockResolvedValue([mockAgents[0]]);

      const response = await GET();
      const data = await response.json();

      expect(data[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        icon: expect.any(String),
        status: expect.stringMatching(/^(green|yellow|red)$/),
        last_sync: expect.any(String),
        hp: expect.any(Number),
        mp: expect.any(Number),
        open_items: expect.any(Number),
      });
    });

    it('should include all required agent fields', async () => {
      getAllAgentsStatus.mockResolvedValue([mockAgents[0]]);

      const response = await GET();
      const data = await response.json();

      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('icon');
      expect(data[0]).toHaveProperty('status');
      expect(data[0]).toHaveProperty('last_sync');
      expect(data[0]).toHaveProperty('hp');
      expect(data[0]).toHaveProperty('mp');
      expect(data[0]).toHaveProperty('open_items');
    });

    it('should handle multiple agents with different statuses', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(data).toHaveLength(3);
      expect(data[0].status).toBe('green');
      expect(data[1].status).toBe('yellow');
      expect(data[2].status).toBe('red');
    });

    it('should preserve agent data integrity', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      const response = await GET();
      const data = await response.json();

      expect(data).toEqual(mockAgents);

      // Verify specific values are preserved
      expect(data[0].hp).toBe(95);
      expect(data[1].open_items).toBe(12);
      expect(data[2].last_sync).toBe('2025-01-30T23:00:00Z');
    });

    it('should handle agents with zero open items', async () => {
      const agentWithNoItems = { ...mockAgents[0], open_items: 0 };
      getAllAgentsStatus.mockResolvedValue([agentWithNoItems]);

      const response = await GET();
      const data = await response.json();

      expect(data[0].open_items).toBe(0);
    });

    it('should handle agents with max HP and MP', async () => {
      const fullHealthAgent = { ...mockAgents[0], hp: 100, mp: 100 };
      getAllAgentsStatus.mockResolvedValue([fullHealthAgent]);

      const response = await GET();
      const data = await response.json();

      expect(data[0].hp).toBe(100);
      expect(data[0].mp).toBe(100);
    });

    it('should call getAllAgentsStatus exactly once', async () => {
      getAllAgentsStatus.mockResolvedValue(mockAgents);

      await GET();

      expect(getAllAgentsStatus).toHaveBeenCalledTimes(1);
    });
  });
});
