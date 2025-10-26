/**
 * Integration Tests for Dashboard API + UI
 * Task 15.3: API-UI Integration with Performance Testing
 */

import { GET, clearMetricsCache } from '@/app/api/metrics/route';
import { getMetricsLastNDays, getLatestRecovery, getLatestCycle, getLatestSleep, getLifelogsForDate, calculateUnbendingScore } from '@/lib/db/queries';
import { NextRequest } from 'next/server';

// Mock database queries
jest.mock('@/lib/db/queries', () => ({
  getMetricsLastNDays: jest.fn(),
  getLatestRecovery: jest.fn(),
  getLatestCycle: jest.fn(),
  getLatestSleep: jest.fn(),
  getLifelogsForDate: jest.fn(),
  calculateUnbendingScore: jest.fn(),
}));

describe('Dashboard API Integration Tests', () => {
  // Use actual today's date like the API does
  const getTodayDate = () => new Date().toISOString().slice(0, 10);

  beforeEach(() => {
    // Reset all mocks completely (clears implementations, not just call history)
    jest.resetAllMocks();
    // Clear API cache to prevent cached data from interfering with tests
    clearMetricsCache();
  });

  describe('GET /api/metrics - Data Integration', () => {
    it('should return complete metrics response with all data sources', async () => {
      const today = getTodayDate();

      // Mock today's data
      (getLatestRecovery as jest.Mock).mockResolvedValue({
        id: '1',
        date: today,
        score: 78,
        hrv: 65,
        rhr: 58,
        spo2: 97,
        skin_temp: 36.5,
      });

      (getLatestCycle as jest.Mock).mockResolvedValue({
        id: '1',
        date: today,
        strain: 12.4,
        kilojoule: 8500,
        avg_hr: 105,
        max_hr: 165,
      });

      (getLatestSleep as jest.Mock).mockResolvedValue({
        id: '1',
        date: today,
        performance: 85,
        rem_min: 95,
        sws_min: 62,
        light_min: 180,
        awake_min: 15,
        respiration: 14.2,
        sleep_debt_min: 10,
      });

      (getLifelogsForDate as jest.Mock).mockResolvedValue([
        {
          id: '1',
          date: today,
          title: 'Morning conversation',
          raw_json: '{}',
          manipulation_count: 2,
          wrath_deployed: 1,
        },
        {
          id: '2',
          date: today,
          title: 'Afternoon meeting',
          raw_json: '{}',
          manipulation_count: 0,
          wrath_deployed: 0,
        },
      ]);

      (calculateUnbendingScore as jest.Mock).mockResolvedValue(50);

      // Mock trends data - getMetricsLastNDays returns array of DailyMetrics
      (getMetricsLastNDays as jest.Mock).mockImplementation((days: number) => {
        if (days === 7) {
          // 7 days of sample data
          return Promise.resolve([
            { date: '2025-01-31', recovery_score: 78, strain: 12.4, sleep_performance: 85, manipulation_count: 1, wrath_deployed: 1, unbending_score: 50 },
            { date: '2025-01-30', recovery_score: 75, strain: 11.0, sleep_performance: 80, manipulation_count: 1, wrath_deployed: 0, unbending_score: 45 },
            { date: '2025-01-29', recovery_score: 72, strain: 10.5, sleep_performance: 78, manipulation_count: 0, wrath_deployed: 0, unbending_score: null },
            { date: '2025-01-28', recovery_score: 80, strain: 13.0, sleep_performance: 88, manipulation_count: 2, wrath_deployed: 1, unbending_score: 60 },
            { date: '2025-01-27', recovery_score: 76, strain: 11.5, sleep_performance: 82, manipulation_count: 1, wrath_deployed: 0, unbending_score: 40 },
            { date: '2025-01-26', recovery_score: 74, strain: 10.0, sleep_performance: 79, manipulation_count: 0, wrath_deployed: 0, unbending_score: null },
            { date: '2025-01-25', recovery_score: 73, strain: 9.8, sleep_performance: 82, manipulation_count: 0, wrath_deployed: 0, unbending_score: null },
          ]);
        } else {
          // 30 days of sample data (simplified - just return array with more entries)
          const thirtyDays = [];
          for (let i = 0; i < 30; i++) {
            thirtyDays.push({
              date: `2025-01-${String(31 - i).padStart(2, '0')}`,
              recovery_score: 70 + Math.floor(Math.random() * 10),
              strain: 10 + Math.random() * 3,
              sleep_performance: 75 + Math.floor(Math.random() * 15),
              manipulation_count: Math.floor(Math.random() * 2),
              wrath_deployed: Math.random() > 0.7 ? 1 : 0,
              unbending_score: Math.random() > 0.5 ? 40 + Math.floor(Math.random() * 30) : null,
            });
          }
          return Promise.resolve(thirtyDays);
        }
      });

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('today');
      expect(data).toHaveProperty('last7Days');
      expect(data).toHaveProperty('last30Days');

      // Verify today's data
      expect(data.today.date).toBe(today);
      expect(data.today.recovery).toMatchObject({ score: 78, hrv: 65 });
      expect(data.today.cycle).toMatchObject({ strain: 12.4 });
      expect(data.today.sleep).toMatchObject({ performance: 85 });
      expect(data.today.lifelogs.total_manipulations).toBe(2);
      expect(data.today.lifelogs.wrath_deployed).toBe(true);
      expect(data.today.unbending_score).toBe(50);

      // Verify 7-day trends (API calculates averages from array)
      expect(data.last7Days.averages.recovery_score).toBeGreaterThan(70);
      expect(data.last7Days.totals.manipulation_count).toBeGreaterThan(0);

      // Verify 30-day trends
      expect(data.last30Days.averages.recovery_score).toBeGreaterThan(65);
      expect(data.last30Days.totals.manipulation_count).toBeGreaterThan(0);
    });

    it('should handle missing today data gracefully', async () => {
      (getLatestRecovery as jest.Mock).mockResolvedValue(null);
      (getLatestCycle as jest.Mock).mockResolvedValue(null);
      (getLatestSleep as jest.Mock).mockResolvedValue(null);
      (getLifelogsForDate as jest.Mock).mockResolvedValue([]);
      (calculateUnbendingScore as jest.Mock).mockResolvedValue(null);
      (getMetricsLastNDays as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.recovery).toBeNull();
      expect(data.today.cycle).toBeNull();
      expect(data.today.sleep).toBeNull();
      expect(data.today.lifelogs.count).toBe(0);
      expect(data.today.unbending_score).toBeNull();
    });

    it('should aggregate manipulation count correctly from multiple lifelogs', async () => {
      const today = getTodayDate();

      (getLatestRecovery as jest.Mock).mockResolvedValue(null);
      (getLatestCycle as jest.Mock).mockResolvedValue(null);
      (getLatestSleep as jest.Mock).mockResolvedValue(null);
      (getLifelogsForDate as jest.Mock).mockResolvedValue([
        {
          id: '1',
          date: today,
          title: 'Conversation 1',
          raw_json: '{}',
          manipulation_count: 3,
          wrath_deployed: 1,
        },
        {
          id: '2',
          date: today,
          title: 'Conversation 2',
          raw_json: '{}',
          manipulation_count: 5,
          wrath_deployed: 0,
        },
        {
          id: '3',
          date: today,
          title: 'Conversation 3',
          raw_json: '{}',
          manipulation_count: 2,
          wrath_deployed: 1,
        },
      ]);
      (calculateUnbendingScore as jest.Mock).mockResolvedValue(66);
      (getMetricsLastNDays as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today.lifelogs.count).toBe(3);
      expect(data.today.lifelogs.total_manipulations).toBe(10); // 3 + 5 + 2
      expect(data.today.lifelogs.wrath_deployed).toBe(true); // At least one wrath
    });
  });

  describe('API Performance Tests', () => {
    it('should complete request in under 200ms with cached data', async () => {
      const today = getTodayDate();

      // Setup mock data
      (getLatestRecovery as jest.Mock).mockResolvedValue({ id: '1', date: today, score: 78, hrv: 65, rhr: 58, spo2: 97, skin_temp: 36.5 });
      (getLatestCycle as jest.Mock).mockResolvedValue({ id: '1', date: today, strain: 12.4, kilojoule: 8500, avg_hr: 105, max_hr: 165 });
      (getLatestSleep as jest.Mock).mockResolvedValue({ id: '1', date: today, performance: 85, rem_min: 95, sws_min: 62, light_min: 180, awake_min: 15, respiration: 14.2, sleep_debt_min: 10 });
      (getLifelogsForDate as jest.Mock).mockResolvedValue([]);
      (calculateUnbendingScore as jest.Mock).mockResolvedValue(50);
      (getMetricsLastNDays as jest.Mock).mockResolvedValue([
        { date: today, recovery_score: 75, strain: 11.2, sleep_performance: 82, manipulation_count: 1, wrath_deployed: 0, unbending_score: 50 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/metrics');

      const startTime = performance.now();
      await GET(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200); // Should be fast with mocks
    });

    it('should handle concurrent requests efficiently', async () => {
      const today = getTodayDate();

      (getLatestRecovery as jest.Mock).mockResolvedValue({ id: '1', date: today, score: 78, hrv: 65, rhr: 58, spo2: 97, skin_temp: 36.5 });
      (getLatestCycle as jest.Mock).mockResolvedValue({ id: '1', date: today, strain: 12.4, kilojoule: 8500, avg_hr: 105, max_hr: 165 });
      (getLatestSleep as jest.Mock).mockResolvedValue({ id: '1', date: today, performance: 85, rem_min: 95, sws_min: 62, light_min: 180, awake_min: 15, respiration: 14.2, sleep_debt_min: 10 });
      (getLifelogsForDate as jest.Mock).mockResolvedValue([]);
      (calculateUnbendingScore as jest.Mock).mockResolvedValue(50);
      (getMetricsLastNDays as jest.Mock).mockResolvedValue([
        { date: today, recovery_score: 75, strain: 11.2, sleep_performance: 82, manipulation_count: 1, wrath_deployed: 0, unbending_score: 50 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/metrics');

      // Make 5 concurrent requests
      const startTime = performance.now();
      await Promise.all([
        GET(request),
        GET(request),
        GET(request),
        GET(request),
        GET(request),
      ]);
      const endTime = performance.now();

      const duration = endTime - startTime;
      // All 5 requests should complete quickly
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      // API uses Promise.all() which fails fast on ANY error
      (getLatestRecovery as jest.Mock).mockRejectedValue(new Error('Database connection failed'));
      (getLatestCycle as jest.Mock).mockResolvedValue(null);
      (getLatestSleep as jest.Mock).mockResolvedValue(null);
      (getLifelogsForDate as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 500 on any data source failure due to Promise.all', async () => {
      const today = getTodayDate();

      // API uses Promise.all() for fetching today's data, so ANY failure results in 500
      (getLatestRecovery as jest.Mock).mockResolvedValue({ id: '1', date: today, score: 78, hrv: 65, rhr: 58, spo2: 97, skin_temp: 36.5 });
      (getLatestCycle as jest.Mock).mockRejectedValue(new Error('Cycle data unavailable'));
      (getLatestSleep as jest.Mock).mockResolvedValue({ id: '1', date: today, performance: 85, rem_min: 95, sws_min: 62, light_min: 180, awake_min: 15, respiration: 14.2, sleep_debt_min: 10 });
      (getLifelogsForDate as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await GET(request);

      // Promise.all() fails fast - should return 500, not partial data
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Failed to fetch metrics');
    });
  });
});
