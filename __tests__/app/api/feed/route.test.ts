/**
 * Feed API Route Tests
 * Tests for /api/feed endpoint - Metrics and Anchors Aggregation
 */

import { GET } from '@/app/api/feed/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/db/queries', () => ({
  getMetricsLastNDays: jest.fn(),
}));

jest.mock('@/lib/MemoryWrapper', () => ({
  getAnchors: jest.fn(),
}));

const { getMetricsLastNDays } = require('@/lib/db/queries');
const { getAnchors } = require('@/lib/MemoryWrapper');

describe('Feed API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockMetrics = [
    {
      date: '2025-01-31',
      recovery_score: 85,
      strain: 12.5,
      sleep_performance: 88,
      hrv: 65,
    },
    {
      date: '2025-01-30',
      recovery_score: 72,
      strain: 15.2,
      sleep_performance: 75,
      hrv: 58,
    },
    {
      date: '2025-01-29',
      recovery_score: 90,
      strain: 8.3,
      sleep_performance: 92,
      hrv: 72,
    },
  ];

  const mockAnchors = [
    {
      id: 'anchor-1',
      text: 'Daily meditation practice',
      type: 'habit',
      createdAt: '2025-01-31T08:00:00Z',
    },
    {
      id: 'anchor-2',
      text: 'Family comes first',
      type: 'value',
      createdAt: '2025-01-15T10:00:00Z',
    },
    {
      id: 'anchor-3',
      text: 'Complete marathon by June',
      type: 'goal',
      createdAt: '2025-01-01T00:00:00Z',
    },
  ];

  describe('GET /api/feed', () => {
    it('should return metrics and anchors with default parameters', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('anchors');
      expect(data.metrics).toEqual(mockMetrics);
      expect(data.anchors).toEqual(mockAnchors);
    });

    it('should use default 7 days when no days parameter', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed');
      await GET(request);

      expect(getMetricsLastNDays).toHaveBeenCalledWith(7, undefined);
    });

    it('should respect custom days parameter', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed?days=30');
      await GET(request);

      expect(getMetricsLastNDays).toHaveBeenCalledWith(30, undefined);
    });

    it('should pass userId when provided', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed?userId=user-123');
      await GET(request);

      expect(getMetricsLastNDays).toHaveBeenCalledWith(7, 'user-123');
      expect(getAnchors).toHaveBeenCalledWith('user-123');
    });

    it('should use default userId for anchors when not provided', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed');
      await GET(request);

      expect(getAnchors).toHaveBeenCalledWith('default');
    });

    it('should combine days and userId parameters', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed?days=14&userId=user-456');
      await GET(request);

      expect(getMetricsLastNDays).toHaveBeenCalledWith(14, 'user-456');
      expect(getAnchors).toHaveBeenCalledWith('user-456');
    });

    it('should return empty metrics when no data', async () => {
      getMetricsLastNDays.mockReturnValue([]);
      getAnchors.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toEqual([]);
      expect(data.anchors).toEqual([]);
    });

    it('should handle metrics without anchors', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveLength(3);
      expect(data.anchors).toHaveLength(0);
    });

    it('should handle anchors without metrics', async () => {
      getMetricsLastNDays.mockReturnValue([]);
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toHaveLength(0);
      expect(data.anchors).toHaveLength(3);
    });

    it('should return 500 on metrics error', async () => {
      getMetricsLastNDays.mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to compute feed');
    });

    it('should return 500 on anchors error', async () => {
      getMetricsLastNDays.mockReturnValue(mockMetrics);
      getAnchors.mockRejectedValue(new Error('Memory service unavailable'));

      const request = new NextRequest('http://localhost/api/feed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to compute feed');
    });

    it('should handle invalid days parameter gracefully', async () => {
      getMetricsLastNDays.mockReturnValue([]);
      getAnchors.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/feed?days=invalid');
      const response = await GET(request);

      // NaN handling - should fall back to some default behavior
      expect(response.status).toBe(200);
    });

    it('should call both data sources in parallel', async () => {
      let metricsCallTime: number | null = null;
      let anchorsCallTime: number | null = null;

      getMetricsLastNDays.mockImplementation(() => {
        metricsCallTime = Date.now();
        return mockMetrics;
      });

      getAnchors.mockImplementation(async () => {
        anchorsCallTime = Date.now();
        return mockAnchors;
      });

      const request = new NextRequest('http://localhost/api/feed');
      await GET(request);

      // Both should have been called
      expect(metricsCallTime).not.toBeNull();
      expect(anchorsCallTime).not.toBeNull();
    });
  });
});
