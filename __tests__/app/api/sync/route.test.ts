/**
 * Sync API Route Tests
 * Tests for /api/sync endpoint - WHOOP and Limitless Data Sync
 */

import { GET, POST } from '@/app/api/sync/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/WhoopClient', () => ({
  getWhoopClient: jest.fn(),
}));

jest.mock('@/lib/LimitlessClient', () => ({
  getLimitlessClient: jest.fn(),
}));

jest.mock('@/lib/db/Database', () => ({
  Database: {
    getInstance: jest.fn(() => ({
      getRawDb: jest.fn(() => ({
        prepare: jest.fn(() => ({
          get: jest.fn(() => ({ c: 0, d: null })),
        })),
      })),
    })),
  },
}));

jest.mock('@/lib/db/queries', () => ({
  insertCycles: jest.fn(),
  insertRecoveries: jest.fn(),
  insertSleeps: jest.fn(),
}));

const { getWhoopClient } = require('@/lib/WhoopClient');
const { getLimitlessClient } = require('@/lib/LimitlessClient');

describe('Sync API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockWhoopClient = {
    fetchCyclesForDb: jest.fn(),
    fetchRecoveriesForDb: jest.fn(),
    fetchSleepsForDb: jest.fn(),
  };

  const mockLimitlessClient = {
    syncNewLifelogs: jest.fn(),
    backfillRangeForDb: jest.fn(),
  };

  beforeEach(() => {
    getWhoopClient.mockReturnValue(mockWhoopClient);
    getLimitlessClient.mockReturnValue(mockLimitlessClient);

    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(0);
    mockLimitlessClient.backfillRangeForDb.mockResolvedValue(0);
  });

  describe('GET /api/sync', () => {
    it('should sync with default parameters', async () => {
      const request = new NextRequest('http://localhost/api/sync');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data).toHaveProperty('before');
      expect(data).toHaveProperty('after');
      expect(data).toHaveProperty('whoopPulled');
      expect(data).toHaveProperty('limitlessPulled');
    });

    it('should respect days parameter', async () => {
      const request = new NextRequest('http://localhost/api/sync?days=7');
      await GET(request);

      // Should call WHOOP for 7 days
      expect(mockWhoopClient.fetchCyclesForDb).toHaveBeenCalledTimes(7);
    });

    it('should disable WHOOP sync with whoop=0', async () => {
      const request = new NextRequest('http://localhost/api/sync?whoop=0');
      await GET(request);

      expect(mockWhoopClient.fetchCyclesForDb).not.toHaveBeenCalled();
    });

    it('should disable Limitless sync with limitless=0', async () => {
      const request = new NextRequest('http://localhost/api/sync?limitless=0');
      await GET(request);

      expect(mockLimitlessClient.syncNewLifelogs).not.toHaveBeenCalled();
    });

    it('should use start_date for Limitless backfill', async () => {
      mockLimitlessClient.backfillRangeForDb.mockResolvedValue(10);

      const request = new NextRequest('http://localhost/api/sync?start_date=2025-01-01&end_date=2025-01-15');
      const response = await GET(request);
      const data = await response.json();

      expect(mockLimitlessClient.backfillRangeForDb).toHaveBeenCalledWith('2025-01-01', '2025-01-15');
      expect(data.limitlessPulled).toBe(10);
    });

    it('should handle WHOOP errors gracefully', async () => {
      mockWhoopClient.fetchCyclesForDb.mockRejectedValue(new Error('API rate limit'));

      const request = new NextRequest('http://localhost/api/sync?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.errors.length).toBeGreaterThan(0);
    });

    it('should handle Limitless errors gracefully', async () => {
      mockLimitlessClient.syncNewLifelogs.mockRejectedValue(new Error('Auth expired'));

      const request = new NextRequest('http://localhost/api/sync?days=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.errors.some((e: string) => e.includes('Limitless'))).toBe(true);
    });

    it('should report counts before and after sync', async () => {
      const request = new NextRequest('http://localhost/api/sync');
      const response = await GET(request);
      const data = await response.json();

      expect(data.before).toHaveProperty('cycles');
      expect(data.before).toHaveProperty('recoveries');
      expect(data.before).toHaveProperty('sleeps');
      expect(data.before).toHaveProperty('lifelogs');
      expect(data.after).toHaveProperty('cycles');
    });

    it('should cap days parameter at 31', async () => {
      const request = new NextRequest('http://localhost/api/sync?days=100');
      await GET(request);

      // Should only call for 31 days maximum
      expect(mockWhoopClient.fetchCyclesForDb.mock.calls.length).toBeLessThanOrEqual(31);
    });

    it('should ensure minimum days is 1', async () => {
      const request = new NextRequest('http://localhost/api/sync?days=0');
      await GET(request);

      // Should call at least once
      expect(mockWhoopClient.fetchCyclesForDb).toHaveBeenCalled();
    });
  });

  describe('POST /api/sync', () => {
    it('should sync with body parameters', async () => {
      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ days: 3 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mockWhoopClient.fetchCyclesForDb).toHaveBeenCalledTimes(3);
    });

    it('should support whoop: false in body', async () => {
      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ whoop: false }),
      });

      await POST(request);

      expect(mockWhoopClient.fetchCyclesForDb).not.toHaveBeenCalled();
    });

    it('should support limitless: false in body', async () => {
      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ limitless: false }),
      });

      await POST(request);

      expect(mockLimitlessClient.syncNewLifelogs).not.toHaveBeenCalled();
    });

    it('should support date range in body', async () => {
      mockLimitlessClient.backfillRangeForDb.mockResolvedValue(5);

      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          start_date: '2025-01-10',
          end_date: '2025-01-20',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(mockLimitlessClient.backfillRangeForDb).toHaveBeenCalledWith('2025-01-10', '2025-01-20');
      expect(data.limitlessPulled).toBe(5);
    });

    it('should handle empty body gracefully', async () => {
      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      // Should use defaults when body parsing fails
      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('should count pulled records correctly', async () => {
      mockWhoopClient.fetchCyclesForDb.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([{ id: 1 }]);
      mockWhoopClient.fetchSleepsForDb.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const request = new NextRequest('http://localhost/api/sync', {
        method: 'POST',
        body: JSON.stringify({ days: 1, limitless: false }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.whoopPulled).toBe(6); // 2 cycles + 1 recovery + 3 sleeps
    });
  });
});
