/**
 * Flags API Route Tests
 * Tests for /api/flags endpoint - Manipulation Detection Flags
 */

import { GET } from '@/app/api/flags/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/db/queries', () => ({
  getPendingFlags: jest.fn(),
  getResolvedFlags: jest.fn(),
  getAllFlags: jest.fn(),
}));

const { getPendingFlags, getResolvedFlags, getAllFlags } = require('@/lib/db/queries');

describe('Flags API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFlags = [
    {
      id: 'flag-1',
      event_id: 'evt-123',
      type: 'manipulation',
      severity: 'high',
      description: 'Potential guilt-tripping detected',
      status: 'pending',
      created_at: '2025-01-31T10:00:00Z',
    },
    {
      id: 'flag-2',
      event_id: 'evt-456',
      type: 'urgency',
      severity: 'medium',
      description: 'False urgency pattern',
      status: 'pending',
      created_at: '2025-01-31T09:00:00Z',
    },
    {
      id: 'flag-3',
      event_id: 'evt-789',
      type: 'manipulation',
      severity: 'low',
      description: 'Minor flattery detected',
      status: 'resolved',
      resolved_at: '2025-01-31T11:00:00Z',
      created_at: '2025-01-30T15:00:00Z',
    },
  ];

  describe('GET /api/flags', () => {
    it('should return all flags by default', async () => {
      getAllFlags.mockReturnValue(mockFlags);

      const request = new NextRequest('http://localhost/api/flags');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flags).toEqual(mockFlags);
      expect(getAllFlags).toHaveBeenCalled();
    });

    it('should return pending flags when status=pending', async () => {
      const pendingFlags = mockFlags.filter(f => f.status === 'pending');
      getPendingFlags.mockReturnValue(pendingFlags);

      const request = new NextRequest('http://localhost/api/flags?status=pending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flags).toEqual(pendingFlags);
      expect(getPendingFlags).toHaveBeenCalled();
      expect(getAllFlags).not.toHaveBeenCalled();
    });

    it('should return resolved flags when status=resolved', async () => {
      const resolvedFlags = mockFlags.filter(f => f.status === 'resolved');
      getResolvedFlags.mockReturnValue(resolvedFlags);

      const request = new NextRequest('http://localhost/api/flags?status=resolved');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flags).toEqual(resolvedFlags);
      expect(getResolvedFlags).toHaveBeenCalled();
    });

    it('should return all flags for status=all', async () => {
      getAllFlags.mockReturnValue(mockFlags);

      const request = new NextRequest('http://localhost/api/flags?status=all');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flags).toEqual(mockFlags);
      expect(getAllFlags).toHaveBeenCalled();
    });

    it('should return empty array when no flags', async () => {
      getAllFlags.mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/flags');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flags).toEqual([]);
    });

    it('should set Cache-Control header', async () => {
      getAllFlags.mockReturnValue([]);

      const request = new NextRequest('http://localhost/api/flags');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });

    it('should return 500 on error', async () => {
      getAllFlags.mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost/api/flags');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.flags).toEqual([]);
      expect(data.error).toBe('Failed to fetch flags');
    });

    it('should handle unknown status gracefully', async () => {
      getAllFlags.mockReturnValue(mockFlags);

      const request = new NextRequest('http://localhost/api/flags?status=unknown');
      const response = await GET(request);
      const data = await response.json();

      // Unknown status should fall through to getAllFlags
      expect(response.status).toBe(200);
      expect(getAllFlags).toHaveBeenCalled();
    });

    it('should preserve flag structure', async () => {
      getAllFlags.mockReturnValue([mockFlags[0]]);

      const request = new NextRequest('http://localhost/api/flags');
      const response = await GET(request);
      const data = await response.json();

      expect(data.flags[0]).toMatchObject({
        id: expect.any(String),
        event_id: expect.any(String),
        type: expect.any(String),
        severity: expect.any(String),
        description: expect.any(String),
        status: expect.any(String),
      });
    });
  });
});
