/**
 * System Status API Route Tests
 * Tests for /api/system/status endpoint - System Health and Status
 */

import { GET } from '@/app/api/system/status/route';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock dependencies
jest.mock('@/lib/crypto', () => ({
  decryptData: jest.fn((data) => data),
}));

jest.mock('@/lib/MemoryWrapper', () => ({
  getMemoryConfig: jest.fn(),
}));

jest.mock('@/lib/db/Database', () => ({
  Database: {
    getInstance: jest.fn(() => ({
      getRawDb: jest.fn(() => ({
        prepare: jest.fn((sql: string) => ({
          get: jest.fn((...args: any[]) => {
            if (sql.includes('COUNT(*)')) return { c: 10 };
            if (sql.includes('provider = \'whoop\'')) return { expires_at: Math.floor(Date.now() / 1000) + 86400 };
            if (sql.includes('limitless_last_pull')) return { value_enc: '2025-01-31' };
            if (sql.includes('psych_signals ORDER BY')) return { date: '2025-01-30' };
            return null;
          }),
        })),
      })),
    })),
  },
}));

const { getMemoryConfig } = require('@/lib/MemoryWrapper');

describe('System Status API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('GET /api/system/status', () => {
    beforeEach(() => {
      getMemoryConfig.mockReturnValue({ provider: 'zep', enabled: true });
    });

    it('should return complete status structure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ status: 'ok', uptime: 12345 }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ tables: ['cycles', 'recoveries'] }),
        });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('agentic');
      expect(data).toHaveProperty('db');
      expect(data).toHaveProperty('local');
    });

    it('should include local database counts', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.local.ok).toBe(true);
      expect(data.local.counts).toHaveProperty('cycles');
      expect(data.local.counts).toHaveProperty('recoveries');
      expect(data.local.counts).toHaveProperty('sleeps');
      expect(data.local.counts).toHaveProperty('lifelogs');
    });

    it('should include WHOOP token status', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.local.whoop).toHaveProperty('token');
      expect(data.local.whoop.token).toHaveProperty('expires_at');
      expect(data.local.whoop.token).toHaveProperty('seconds_left');
      expect(data.local.whoop.token).toHaveProperty('days_left');
    });

    it('should include Limitless status', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.local.limitless).toHaveProperty('last_pull_date');
    });

    it('should include psych signals status', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.local.psych).toHaveProperty('latest_date');
    });

    it('should include memory config', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.local.memory).toEqual({ provider: 'zep', enabled: true });
    });

    it('should handle agentic service unavailable', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          json: () => Promise.resolve({}),
        });

      const response = await GET();
      const data = await response.json();

      expect(data.agentic.status).toBe('unavailable');
      expect(data.agentic.error).toContain('Connection refused');
    });

    it('should handle db service unavailable', async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ status: 'ok' }),
        })
        .mockRejectedValueOnce(new Error('DB service down'));

      const response = await GET();
      const data = await response.json();

      expect(data.agentic.status).toBe('ok');
      expect(data.db.error).toContain('DB service down');
    });

    it('should use correct health check URLs', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      await GET();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/agentic/health'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/db/status'),
        expect.any(Object)
      );
    });

    it('should disable caching for health checks', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      await GET();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cache: 'no-store' })
      );
    });

    it('should handle null memory config', async () => {
      getMemoryConfig.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({}),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.local.memory).toBeNull();
    });
  });
});
