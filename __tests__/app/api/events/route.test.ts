/**
 * Events API Route Tests
 * Tests for /api/events endpoint
 */

import { GET } from '@/app/api/events/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/events', () => ({
  listRecentEvents: jest.fn(),
}));

jest.mock('@/lib/auth/user', () => ({
  currentUserOrThrow: jest.fn(),
}));

const { listRecentEvents } = require('@/lib/events');
const { currentUserOrThrow } = require('@/lib/auth/user');

describe('Events API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUserOrThrow.mockReturnValue({ userId: 'test-user-id' });
  });

  const mockEvents = [
    {
      id: 'evt-1',
      source: 'email',
      channel: 'gmail',
      subject: 'Meeting Tomorrow',
      preview: 'Let\'s discuss the project...',
      ts: Math.floor(Date.now() / 1000) - 3600,
      classification: 'meeting',
      confidence: 0.85,
      routed_target: 'pm',
    },
    {
      id: 'evt-2',
      source: 'calendar',
      channel: 'google',
      subject: 'Sprint Planning',
      preview: 'Weekly sprint planning session',
      ts: Math.floor(Date.now() / 1000) - 7200,
      classification: 'meeting',
      confidence: 0.92,
      routed_target: 'ea',
    },
    {
      id: 'evt-3',
      source: 'chat',
      channel: 'slack',
      subject: null,
      preview: 'Can you review this PR?',
      ts: Math.floor(Date.now() / 1000) - 10800,
      classification: 'task',
      confidence: 0.78,
      routed_target: 'pm',
    },
  ];

  describe('GET /api/events', () => {
    it('should return events with default limit', async () => {
      listRecentEvents.mockReturnValue(mockEvents);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('events');
      expect(Array.isArray(data.events)).toBe(true);
      expect(listRecentEvents).toHaveBeenCalledWith(300, 'test-user-id');
    });

    it('should respect custom limit parameter', async () => {
      listRecentEvents.mockReturnValue(mockEvents.slice(0, 2));

      const request = new NextRequest('http://localhost/api/events?limit=50');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(listRecentEvents).toHaveBeenCalledWith(50, 'test-user-id');
    });

    it('should cap limit at 1000', async () => {
      listRecentEvents.mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/events?limit=5000');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(listRecentEvents).toHaveBeenCalledWith(1000, 'test-user-id');
    });

    it('should handle invalid limit parameter', async () => {
      listRecentEvents.mockReturnValue(mockEvents);

      const request = new NextRequest('http://localhost/api/events?limit=invalid');
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Should fall back to default of 300
      expect(listRecentEvents).toHaveBeenCalledWith(300, 'test-user-id');
    });

    it('should return empty array when no events', async () => {
      listRecentEvents.mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toEqual([]);
    });

    it('should return events with correct structure', async () => {
      listRecentEvents.mockReturnValue([mockEvents[0]]);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(data.events[0]).toMatchObject({
        id: expect.any(String),
        source: expect.any(String),
        channel: expect.any(String),
        ts: expect.any(Number),
      });
    });

    it('should preserve all event fields', async () => {
      listRecentEvents.mockReturnValue(mockEvents);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(data.events).toEqual(mockEvents);
    });

    it('should return 401 when unauthorized', async () => {
      currentUserOrThrow.mockImplementation(() => {
        throw new Error('unauthorized');
      });

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('failed to load events');
    });

    it('should return 500 on internal error', async () => {
      listRecentEvents.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('failed to load events');
    });

    it('should handle events with null fields', async () => {
      const eventsWithNulls = [
        {
          id: 'evt-null',
          source: 'email',
          channel: 'gmail',
          subject: null,
          preview: null,
          ts: Math.floor(Date.now() / 1000),
          classification: null,
          confidence: null,
          routed_target: null,
        },
      ];

      listRecentEvents.mockReturnValue(eventsWithNulls);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events[0].subject).toBeNull();
      expect(data.events[0].classification).toBeNull();
    });

    it('should handle large event sets', async () => {
      const largeEventSet = Array.from({ length: 500 }, (_, i) => ({
        id: `evt-${i}`,
        source: 'email',
        channel: 'gmail',
        subject: `Event ${i}`,
        preview: `Preview for event ${i}`,
        ts: Math.floor(Date.now() / 1000) - i * 60,
      }));

      listRecentEvents.mockReturnValue(largeEventSet);

      const request = new NextRequest('http://localhost/api/events?limit=500');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(500);
    });

    it('should call listRecentEvents exactly once', async () => {
      listRecentEvents.mockReturnValue(mockEvents);

      const request = new NextRequest('http://localhost/api/events');
      await GET(request);

      expect(listRecentEvents).toHaveBeenCalledTimes(1);
    });
  });
});
