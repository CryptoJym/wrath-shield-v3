/**
 * EA Status API Route Tests
 * Tests for /api/ea/status endpoint - Executive Assistant Agent
 */

import { GET } from '@/app/api/ea/status/route';

// Mock dependencies
jest.mock('@/lib/agents/ea-agent', () => ({
  getEAAgent: jest.fn(),
}));

const { getEAAgent } = require('@/lib/agents/ea-agent');

describe('EA Status API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockEAAgent = {
    generateDailyAgenda: jest.fn(),
    getUpcomingEvents: jest.fn(),
  };

  const mockAgenda = {
    date: '2025-01-31',
    summary: 'Today you have 5 meetings and 2 free hours.',
    events: [
      {
        id: 'evt-1',
        title: 'Morning Standup',
        start: new Date('2025-01-31T09:00:00Z'),
        end: new Date('2025-01-31T09:30:00Z'),
      },
      {
        id: 'evt-2',
        title: 'Sprint Planning',
        start: new Date('2025-01-31T10:00:00Z'),
        end: new Date('2025-01-31T11:00:00Z'),
      },
    ],
    freeSlots: [
      {
        start: new Date('2025-01-31T11:00:00Z'),
        end: new Date('2025-01-31T12:00:00Z'),
      },
      {
        start: new Date('2025-01-31T14:00:00Z'),
        end: new Date('2025-01-31T15:00:00Z'),
      },
    ],
  };

  const mockUpcomingEvents = [
    {
      id: 'evt-1',
      title: 'Morning Standup',
      start: new Date('2025-01-31T09:00:00Z'),
      end: new Date('2025-01-31T09:30:00Z'),
      location: 'Zoom',
      attendees: ['alice@example.com', 'bob@example.com'],
    },
    {
      id: 'evt-2',
      title: 'Sprint Planning',
      start: new Date('2025-01-31T10:00:00Z'),
      end: new Date('2025-01-31T11:00:00Z'),
      location: 'Conference Room A',
      attendees: ['team@example.com'],
    },
    {
      id: 'evt-3',
      title: 'Client Call',
      start: new Date('2025-02-01T14:00:00Z'),
      end: new Date('2025-02-01T15:00:00Z'),
      location: 'Phone',
      attendees: ['client@example.com'],
    },
  ];

  describe('GET /api/ea/status', () => {
    beforeEach(() => {
      getEAAgent.mockReturnValue(mockEAAgent);
      mockEAAgent.generateDailyAgenda.mockResolvedValue(mockAgenda);
      mockEAAgent.getUpcomingEvents.mockResolvedValue(mockUpcomingEvents);
    });

    it('should return complete EA status structure', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.status).toBe('active');
      expect(data.agent).toBe('agent.ea');
      expect(data.name).toBe('Executive Assistant');
      expect(data).toHaveProperty('capabilities');
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('dailyAgenda');
      expect(data).toHaveProperty('upcomingEvents');
    });

    it('should return correct capabilities', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.capabilities).toContain('calendar_management');
      expect(data.capabilities).toContain('meeting_scheduling');
      expect(data.capabilities).toContain('daily_agenda');
      expect(data.capabilities).toContain('conflict_detection');
      expect(data.capabilities).toContain('time_blocking');
    });

    it('should calculate correct stats', async () => {
      // Mock events where 2 are today
      const today = new Date();
      const todayEvents = [
        {
          id: 'evt-today-1',
          title: 'Today Event 1',
          start: today,
          end: new Date(today.getTime() + 3600000),
          location: 'Room A',
          attendees: [],
        },
        {
          id: 'evt-today-2',
          title: 'Today Event 2',
          start: new Date(today.getTime() + 7200000),
          end: new Date(today.getTime() + 10800000),
          location: 'Room B',
          attendees: [],
        },
        {
          id: 'evt-tomorrow',
          title: 'Tomorrow Event',
          start: new Date(today.getTime() + 86400000),
          end: new Date(today.getTime() + 90000000),
          location: 'Room C',
          attendees: [],
        },
      ];

      mockEAAgent.getUpcomingEvents.mockResolvedValue(todayEvents);

      const response = await GET();
      const data = await response.json();

      expect(data.stats.upcomingEvents).toBe(3);
      expect(data.stats.weekEvents).toBe(3);
      expect(data.stats.todayEvents).toBe(2);
    });

    it('should format daily agenda correctly', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.dailyAgenda.date).toBe('2025-01-31');
      expect(data.dailyAgenda.summary).toBe('Today you have 5 meetings and 2 free hours.');
      expect(data.dailyAgenda.eventCount).toBe(2);
      expect(data.dailyAgenda.events).toHaveLength(2);
      expect(data.dailyAgenda.freeSlots).toHaveLength(2);
    });

    it('should convert dates to ISO strings', async () => {
      const response = await GET();
      const data = await response.json();

      // Events should have ISO date strings
      expect(data.dailyAgenda.events[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(data.dailyAgenda.events[0].end).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Free slots should have ISO date strings
      expect(data.dailyAgenda.freeSlots[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(data.dailyAgenda.freeSlots[0].end).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Upcoming events should have ISO date strings
      expect(data.upcomingEvents[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should calculate duration in minutes', async () => {
      const response = await GET();
      const data = await response.json();

      // First event: 09:00 to 09:30 = 30 minutes
      expect(data.dailyAgenda.events[0].duration).toBe(30);

      // Second event: 10:00 to 11:00 = 60 minutes
      expect(data.dailyAgenda.events[1].duration).toBe(60);

      // Free slot: 11:00 to 12:00 = 60 minutes
      expect(data.dailyAgenda.freeSlots[0].durationMinutes).toBe(60);
    });

    it('should include upcoming events with all fields', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.upcomingEvents[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        start: expect.any(String),
        end: expect.any(String),
        location: expect.any(String),
        attendees: expect.any(Array),
      });
    });

    it('should call getUpcomingEvents with 7 days', async () => {
      await GET();

      expect(mockEAAgent.getUpcomingEvents).toHaveBeenCalledWith(7);
    });

    it('should handle empty agenda', async () => {
      mockEAAgent.generateDailyAgenda.mockResolvedValue({
        date: '2025-01-31',
        summary: 'No meetings today!',
        events: [],
        freeSlots: [],
      });
      mockEAAgent.getUpcomingEvents.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.dailyAgenda.eventCount).toBe(0);
      expect(data.dailyAgenda.events).toHaveLength(0);
      expect(data.stats.upcomingEvents).toBe(0);
    });

    it('should return error status on failure', async () => {
      mockEAAgent.generateDailyAgenda.mockRejectedValue(new Error('Calendar API error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.status).toBe('error');
      expect(data.error).toBe('Calendar API error');
    });

    it('should handle unknown errors gracefully', async () => {
      mockEAAgent.generateDailyAgenda.mockRejectedValue('Unknown error');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Unknown error');
    });

    it('should call getEAAgent exactly once', async () => {
      await GET();

      expect(getEAAgent).toHaveBeenCalledTimes(1);
    });
  });
});
