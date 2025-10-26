/**
 * Wrath Shield v3 - Metrics API Tests
 *
 * Tests for Task #15.1: Implement Metrics API with Aggregation and In-Process Caching
 */

import { GET, clearMetricsCache } from '@/app/api/metrics/route';
import { NextRequest } from 'next/server';
import type { Recovery, Cycle, Sleep, Lifelog, DailyMetrics } from '@/lib/db/types';

// Mock dependencies
jest.mock('@/lib/db/queries', () => ({
  getLatestRecovery: jest.fn(),
  getLatestCycle: jest.fn(),
  getLatestSleep: jest.fn(),
  getLifelogsForDate: jest.fn(),
  getMetricsLastNDays: jest.fn(),
  calculateUnbendingScore: jest.fn(),
}));

// Get mocked functions
const {
  getLatestRecovery,
  getLatestCycle,
  getLatestSleep,
  getLifelogsForDate,
  getMetricsLastNDays,
  calculateUnbendingScore,
} = require('@/lib/db/queries');

describe('Metrics API Route', () => {
  // Mock current date
  const mockToday = '2025-01-31';

  beforeEach(() => {
    jest.clearAllMocks();
    clearMetricsCache(); // Clear in-memory cache between tests

    // Mock Date.prototype methods
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(`${mockToday}T12:00:00.000Z`);
    jest.spyOn(Date, 'now').mockReturnValue(1706702400000); // Fixed timestamp
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockRecovery: Recovery = {
    id: '1',
    date: mockToday,
    score: 78,
    hrv: 50,
    rhr: 60,
    spo2: 98,
    skin_temp: 36.5,
    created_at: 1706702400,
    updated_at: 1706702400,
  };

  const mockCycle: Cycle = {
    id: '1',
    date: mockToday,
    strain: 12.4,
    kilojoules: 1000,
    avg_hr: 120,
    max_hr: 160,
    created_at: 1706702400,
    updated_at: 1706702400,
  };

  const mockSleep: Sleep = {
    id: '1',
    date: mockToday,
    performance: 85,
    rem_min: 90,
    sws_min: 60,
    light_min: 120,
    respiration: 14,
    sleep_debt_min: 0,
    created_at: 1706702400,
    updated_at: 1706702400,
  };

  const mockLifelogs: Lifelog[] = [
    {
      id: 'lifelog1',
      date: mockToday,
      title: 'Morning interaction',
      manipulation_count: 2,
      wrath_deployed: 1,
      raw_json: '{}',
      created_at: 1706702400,
      updated_at: 1706702400,
    },
    {
      id: 'lifelog2',
      date: mockToday,
      title: 'Afternoon interaction',
      manipulation_count: 1,
      wrath_deployed: 0,
      raw_json: '{}',
      created_at: 1706702400,
      updated_at: 1706702400,
    },
  ];

  const mockMetrics7Days: DailyMetrics[] = [
    {
      date: '2025-01-31',
      strain: 12.4,
      recovery_score: 78,
      sleep_performance: 85,
      manipulation_count: 3,
      wrath_deployed: 1,
      unbending_score: 33.33,
    },
    {
      date: '2025-01-30',
      strain: 10.2,
      recovery_score: 65,
      sleep_performance: 75,
      manipulation_count: 2,
      wrath_deployed: 1,
      unbending_score: 50,
    },
    {
      date: '2025-01-29',
      strain: 15.8,
      recovery_score: 55,
      sleep_performance: 70,
      manipulation_count: 5,
      wrath_deployed: 2,
      unbending_score: 40,
    },
  ];

  const mockMetrics30Days: DailyMetrics[] = [
    ...mockMetrics7Days,
    {
      date: '2025-01-28',
      strain: 11.5,
      recovery_score: 72,
      sleep_performance: 80,
      manipulation_count: 1,
      wrath_deployed: 0,
      unbending_score: 0,
    },
    {
      date: '2025-01-27',
      strain: 9.3,
      recovery_score: 81,
      sleep_performance: 88,
      manipulation_count: 0,
      wrath_deployed: 0,
      unbending_score: null,
    },
  ];

  describe('Today\'s Metrics Aggregation', () => {
    it('should fetch and aggregate today\'s data', async () => {
      getLatestRecovery.mockResolvedValue(mockRecovery);
      getLatestCycle.mockResolvedValue(mockCycle);
      getLatestSleep.mockResolvedValue(mockSleep);
      getLifelogsForDate.mockResolvedValue(mockLifelogs);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.date).toBe(mockToday);
      expect(data.today.recovery).toEqual(mockRecovery);
      expect(data.today.cycle).toEqual(mockCycle);
      expect(data.today.sleep).toEqual(mockSleep);
      expect(data.today.lifelogs.count).toBe(2);
      expect(data.today.lifelogs.total_manipulations).toBe(3);
      expect(data.today.lifelogs.wrath_deployed).toBe(true);
    });

    it('should handle missing WHOOP data', async () => {
      getLatestRecovery.mockResolvedValue(null);
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([]);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.recovery).toBeNull();
      expect(data.today.cycle).toBeNull();
      expect(data.today.sleep).toBeNull();
      expect(data.today.lifelogs.count).toBe(0);
      expect(data.today.lifelogs.total_manipulations).toBe(0);
      expect(data.today.lifelogs.wrath_deployed).toBe(false);
    });

    it('should correctly detect wrath deployment', async () => {
      getLatestRecovery.mockResolvedValue(null);
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([
        { ...mockLifelogs[0], wrath_deployed: 0 },
        { ...mockLifelogs[1], wrath_deployed: 1 }, // One has wrath
      ]);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.lifelogs.wrath_deployed).toBe(true);
    });

    it('should handle no wrath deployment', async () => {
      getLatestRecovery.mockResolvedValue(null);
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([
        { ...mockLifelogs[0], wrath_deployed: 0 },
        { ...mockLifelogs[1], wrath_deployed: 0 },
      ]);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.lifelogs.wrath_deployed).toBe(false);
    });
  });

  describe('7-Day and 30-Day Aggregation', () => {
    beforeEach(() => {
      getLatestRecovery.mockResolvedValue(mockRecovery);
      getLatestCycle.mockResolvedValue(mockCycle);
      getLatestSleep.mockResolvedValue(mockSleep);
      getLifelogsForDate.mockResolvedValue([]);
    });

    it('should calculate 7-day averages correctly', async () => {
      getMetricsLastNDays.mockImplementation((days: number) => {
        if (days === 7) return Promise.resolve(mockMetrics7Days);
        return Promise.resolve(mockMetrics30Days);
      });

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      // Average of [78, 65, 55] = 66
      expect(data.last7Days.averages.recovery_score).toBe(66);

      // Average of [12.4, 10.2, 15.8] = 12.8
      expect(data.last7Days.averages.strain).toBe(12.8);

      // Average of [85, 75, 70] = 76.67 → 77
      expect(data.last7Days.averages.sleep_performance).toBe(77);

      // Total manipulations: 3 + 2 + 5 = 10
      expect(data.last7Days.totals.manipulation_count).toBe(10);

      // Total wrath: 1 + 1 + 2 = 4
      expect(data.last7Days.totals.wrath_deployed).toBe(4);

      // Average unbending: (33.33 + 50 + 40) / 3 = 41.11 → 41
      expect(data.last7Days.unbending_score_avg).toBe(41);
    });

    it('should calculate 30-day averages correctly', async () => {
      getMetricsLastNDays.mockImplementation((days: number) => {
        if (days === 7) return Promise.resolve([]);
        return Promise.resolve(mockMetrics30Days);
      });

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      // Average of [78, 65, 55, 72, 81] = 70.2 → 70
      expect(data.last30Days.averages.recovery_score).toBe(70);

      // Total manipulations: 3 + 2 + 5 + 1 + 0 = 11
      expect(data.last30Days.totals.manipulation_count).toBe(11);

      // Total wrath: 1 + 1 + 2 + 0 + 0 = 4
      expect(data.last30Days.totals.wrath_deployed).toBe(4);
    });

    it('should handle metrics with null values', async () => {
      const metricsWithNulls: DailyMetrics[] = [
        {
          date: '2025-01-31',
          strain: null,
          recovery_score: null,
          sleep_performance: null,
          manipulation_count: 0,
          wrath_deployed: 0,
          unbending_score: null,
        },
        {
          date: '2025-01-30',
          strain: 10.0,
          recovery_score: 65,
          sleep_performance: 75,
          manipulation_count: 2,
          wrath_deployed: 1,
          unbending_score: 50,
        },
      ];

      getMetricsLastNDays.mockImplementation((days: number) => {
        if (days === 7) return Promise.resolve(metricsWithNulls);
        return Promise.resolve([]);
      });

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      // Should only average non-null values
      expect(data.last7Days.averages.recovery_score).toBe(65);
      expect(data.last7Days.averages.strain).toBe(10.0);
      expect(data.last7Days.averages.sleep_performance).toBe(75);
      expect(data.last7Days.unbending_score_avg).toBe(50);
    });

    it('should return null averages for empty metrics', async () => {
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.last7Days.averages.recovery_score).toBeNull();
      expect(data.last7Days.averages.strain).toBeNull();
      expect(data.last7Days.averages.sleep_performance).toBeNull();
      expect(data.last7Days.totals.manipulation_count).toBe(0);
      expect(data.last7Days.totals.wrath_deployed).toBe(0);
      expect(data.last7Days.unbending_score_avg).toBeNull();
    });

    it('should round recovery and sleep to integers', async () => {
      const metricsWithFractional: DailyMetrics[] = [
        {
          date: '2025-01-31',
          strain: 12.45,
          recovery_score: 78.7,
          sleep_performance: 85.3,
          manipulation_count: 1,
          wrath_deployed: 0,
          unbending_score: 33.33,
        },
        {
          date: '2025-01-30',
          strain: 10.24,
          recovery_score: 64.2,
          sleep_performance: 74.8,
          manipulation_count: 2,
          wrath_deployed: 1,
          unbending_score: 50,
        },
      ];

      getMetricsLastNDays.mockImplementation((days: number) => {
        if (days === 7) return Promise.resolve(metricsWithFractional);
        return Promise.resolve([]);
      });

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      // Recovery: (78.7 + 64.2) / 2 = 71.45 → 71
      expect(data.last7Days.averages.recovery_score).toBe(71);

      // Sleep: (85.3 + 74.8) / 2 = 80.05 → 80
      expect(data.last7Days.averages.sleep_performance).toBe(80);

      // Strain: (12.45 + 10.24) / 2 = 11.345 → 11.3 (rounded to 1 decimal)
      expect(data.last7Days.averages.strain).toBe(11.3);
    });
  });

  describe('Caching Behavior', () => {
    beforeEach(() => {
      getLatestRecovery.mockResolvedValue(mockRecovery);
      getLatestCycle.mockResolvedValue(mockCycle);
      getLatestSleep.mockResolvedValue(mockSleep);
      getLifelogsForDate.mockResolvedValue(mockLifelogs);
      getMetricsLastNDays.mockResolvedValue(mockMetrics7Days);
    });

    it('should return cache miss on first request', async () => {
      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);

      expect(response.headers.get('X-Cache')).toBe('MISS');
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    });

    it('should return cache hit on subsequent request', async () => {
      // First request
      const request1 = new NextRequest('http://localhost:3000/api/metrics');
      await GET(request1);

      // Second request should hit cache
      const request2 = new NextRequest('http://localhost:3000/api/metrics');
      const response2 = await GET(request2);

      expect(response2.headers.get('X-Cache')).toBe('HIT');
    });

    it('should not query database on cache hit', async () => {
      // First request
      const request1 = new NextRequest('http://localhost:3000/api/metrics');
      await GET(request1);

      // Clear mock call counts
      jest.clearAllMocks();

      // Second request should hit cache
      const request2 = new NextRequest('http://localhost:3000/api/metrics');
      await GET(request2);

      // Database should not be queried
      expect(getLatestRecovery).not.toHaveBeenCalled();
      expect(getLatestCycle).not.toHaveBeenCalled();
      expect(getLatestSleep).not.toHaveBeenCalled();
      expect(getLifelogsForDate).not.toHaveBeenCalled();
      expect(getMetricsLastNDays).not.toHaveBeenCalled();
    });

    it('should return same data on cache hit', async () => {
      // First request
      const request1 = new NextRequest('http://localhost:3000/api/metrics');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Second request
      const request2 = new NextRequest('http://localhost:3000/api/metrics');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(data1).toEqual(data2);
    });

    it('should expire cache after TTL', async () => {
      // First request
      const request1 = new NextRequest('http://localhost:3000/api/metrics');
      await GET(request1);

      // Advance time past TTL (5 minutes = 300,000ms)
      jest.spyOn(Date, 'now').mockReturnValue(1706702400000 + 350000);

      // Second request should miss cache
      const request2 = new NextRequest('http://localhost:3000/api/metrics');
      const response2 = await GET(request2);

      expect(response2.headers.get('X-Cache')).toBe('MISS');
    });

    it('should not expire before TTL', async () => {
      // First request
      const request1 = new NextRequest('http://localhost:3000/api/metrics');
      await GET(request1);

      // Advance time within TTL (4 minutes = 240,000ms)
      jest.spyOn(Date, 'now').mockReturnValue(1706702400000 + 240000);

      // Second request should hit cache
      const request2 = new NextRequest('http://localhost:3000/api/metrics');
      const response2 = await GET(request2);

      expect(response2.headers.get('X-Cache')).toBe('HIT');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      getLatestRecovery.mockRejectedValue(new Error('Database connection failed'));
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([]);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch metrics');
    });

    it('should handle partial database failures gracefully', async () => {
      getLatestRecovery.mockResolvedValue(mockRecovery);
      getLatestCycle.mockRejectedValue(new Error('Cycle query failed'));
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([]);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero manipulations', async () => {
      getLatestRecovery.mockResolvedValue(null);
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([
        { ...mockLifelogs[0], manipulation_count: 0, wrath_deployed: 0 },
      ]);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.lifelogs.total_manipulations).toBe(0);
      expect(data.today.lifelogs.wrath_deployed).toBe(false);
    });

    it('should handle very large manipulation counts', async () => {
      const largeLifelogs: Lifelog[] = Array.from({ length: 50 }, (_, i) => ({
        id: `lifelog${i}`,
        date: mockToday,
        title: `Interaction ${i}`,
        manipulation_count: 5,
        wrath_deployed: i % 2,
        raw_json: '{}',
        created_at: 1706702400,
        updated_at: 1706702400,
      }));

      getLatestRecovery.mockResolvedValue(null);
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue(largeLifelogs);
      getMetricsLastNDays.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.lifelogs.count).toBe(50);
      expect(data.today.lifelogs.total_manipulations).toBe(250);
      expect(data.today.lifelogs.wrath_deployed).toBe(true);
    });

    it('should handle WHOOP metrics with zero values', async () => {
      getLatestRecovery.mockResolvedValue({ ...mockRecovery, score: 0 });
      getLatestCycle.mockResolvedValue({ ...mockCycle, strain: 0 });
      getLatestSleep.mockResolvedValue({ ...mockSleep, performance: 0 });
      getLifelogsForDate.mockResolvedValue([]);
      getMetricsLastNDays.mockResolvedValue([
        {
          date: mockToday,
          strain: 0,
          recovery_score: 0,
          sleep_performance: 0,
          manipulation_count: 0,
          wrath_deployed: 0,
          unbending_score: null,
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.recovery.score).toBe(0);
      expect(data.today.cycle.strain).toBe(0);
      expect(data.today.sleep.performance).toBe(0);
      expect(data.last7Days.averages.recovery_score).toBe(0);
    });

    it('should handle all-null metrics gracefully', async () => {
      const allNullMetrics: DailyMetrics[] = [
        {
          date: '2025-01-31',
          strain: null,
          recovery_score: null,
          sleep_performance: null,
          manipulation_count: 0,
          wrath_deployed: 0,
          unbending_score: null,
        },
        {
          date: '2025-01-30',
          strain: null,
          recovery_score: null,
          sleep_performance: null,
          manipulation_count: 0,
          wrath_deployed: 0,
          unbending_score: null,
        },
      ];

      getLatestRecovery.mockResolvedValue(null);
      getLatestCycle.mockResolvedValue(null);
      getLatestSleep.mockResolvedValue(null);
      getLifelogsForDate.mockResolvedValue([]);
      getMetricsLastNDays.mockResolvedValue(allNullMetrics);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.last7Days.averages.recovery_score).toBeNull();
      expect(data.last7Days.averages.strain).toBeNull();
      expect(data.last7Days.averages.sleep_performance).toBeNull();
      expect(data.last7Days.unbending_score_avg).toBeNull();
    });
  });

  describe('Response Structure', () => {
    it('should return complete response structure', async () => {
      getLatestRecovery.mockResolvedValue(mockRecovery);
      getLatestCycle.mockResolvedValue(mockCycle);
      getLatestSleep.mockResolvedValue(mockSleep);
      getLifelogsForDate.mockResolvedValue(mockLifelogs);
      getMetricsLastNDays.mockResolvedValue(mockMetrics7Days);
      calculateUnbendingScore.mockResolvedValue(50);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      // Verify top-level structure
      expect(data).toHaveProperty('today');
      expect(data).toHaveProperty('last7Days');
      expect(data).toHaveProperty('last30Days');

      // Verify today structure
      expect(data.today).toHaveProperty('date');
      expect(data.today).toHaveProperty('recovery');
      expect(data.today).toHaveProperty('cycle');
      expect(data.today).toHaveProperty('sleep');
      expect(data.today).toHaveProperty('lifelogs');
      expect(data.today).toHaveProperty('unbending_score');

      // Verify lifelogs structure
      expect(data.today.lifelogs).toHaveProperty('count');
      expect(data.today.lifelogs).toHaveProperty('total_manipulations');
      expect(data.today.lifelogs).toHaveProperty('wrath_deployed');

      // Verify 7-day structure
      expect(data.last7Days).toHaveProperty('averages');
      expect(data.last7Days).toHaveProperty('totals');
      expect(data.last7Days).toHaveProperty('unbending_score_avg');

      expect(data.last7Days.averages).toHaveProperty('recovery_score');
      expect(data.last7Days.averages).toHaveProperty('strain');
      expect(data.last7Days.averages).toHaveProperty('sleep_performance');

      expect(data.last7Days.totals).toHaveProperty('manipulation_count');
      expect(data.last7Days.totals).toHaveProperty('wrath_deployed');
    });
  });
});
