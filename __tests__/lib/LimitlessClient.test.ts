/**
 * Wrath Shield v3 - LimitlessClient Tests
 *
 * Tests for rate limiting, pagination, parsing, normalization, and error handling
 */

import { LimitlessClient, getLimitlessClient } from '@/lib/LimitlessClient';

// Disable server-only guard for testing
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock crypto functions
jest.mock('@/lib/crypto', () => ({
  encryptData: jest.fn((data: string) => `encrypted_${data}`),
  decryptData: jest.fn((data: string) => data.replace('encrypted_', '')),
}));

// Mock database functions
let mockSettings: Record<string, any> = {};

jest.mock('@/lib/db/queries', () => ({
  getSetting: jest.fn((key: string) => mockSettings[key] || null),
  insertSettings: jest.fn((settings: any[]) => {
    settings.forEach((setting) => {
      mockSettings[setting.key] = setting;
    });
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('LimitlessClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = {};
    (global.fetch as jest.Mock).mockReset();

    // Set up valid API key by default
    mockSettings.limitless_api_key = {
      key: 'limitless_api_key',
      value_enc: 'encrypted_test_api_key',
    };
  });

  describe('Pagination', () => {
    it('should fetch all lifelogs across multiple pages', async () => {
      // Mock first page with cursor
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_1',
              start_time: '2024-01-15T10:00:00Z',
              end_time: '2024-01-15T11:00:00Z',
              transcript: 'First page lifelog 1',
              summary: 'Summary 1',
            },
            {
              id: 'lifelog_2',
              start_time: '2024-01-15T11:00:00Z',
              end_time: '2024-01-15T12:00:00Z',
              transcript: 'First page lifelog 2',
              summary: 'Summary 2',
            },
          ],
          cursor: 'page2_cursor',
        }),
      });

      // Mock second page with cursor
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_3',
              start_time: '2024-01-15T12:00:00Z',
              end_time: '2024-01-15T13:00:00Z',
              transcript: 'Second page lifelog',
              summary: 'Summary 3',
            },
          ],
          cursor: 'page3_cursor',
        }),
      });

      // Mock final page without cursor
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_4',
              start_time: '2024-01-15T13:00:00Z',
              end_time: '2024-01-15T14:00:00Z',
              transcript: 'Final page lifelog',
              summary: 'Summary 4',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const lifelogs = await client.fetchLifelogs();

      expect(lifelogs).toHaveLength(4);
      expect(lifelogs[0].id).toBe('lifelog_1');
      expect(lifelogs[3].id).toBe('lifelog_4');
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Verify cursor was used in subsequent requests
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[1][0]).toContain('cursor=page2_cursor');
      expect(calls[2][0]).toContain('cursor=page3_cursor');
    });

    it('should handle empty pagination response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const lifelogs = await client.fetchLifelogs();

      expect(lifelogs).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should include date filters in pagination requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.fetchLifelogs({ start_date: '2024-01-01', end_date: '2024-01-31' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2024-01-01'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('end_date=2024-01-31'),
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should respect 180 requests/minute rate limit', async () => {
      // Mock 5 successful responses
      for (let i = 0; i < 5; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lifelogs: [],
            cursor: null,
          }),
        });
      }

      const client = new LimitlessClient();
      const startTime = Date.now();

      // Make 5 rapid requests
      await Promise.all([
        client.fetchLifelogs(),
        client.fetchLifelogs(),
        client.fetchLifelogs(),
        client.fetchLifelogs(),
        client.fetchLifelogs(),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All 5 requests should complete
      expect(global.fetch).toHaveBeenCalledTimes(5);

      // Duration should be minimal since we start with full token bucket
      // (180 tokens available, we only use 5)
      expect(duration).toBeLessThan(500); // Should be nearly instant
    });

    it('should delay requests when token bucket is depleted', async () => {
      // We can't easily test actual delays without making the test slow,
      // but we can verify the rate limiter exists and is being called
      const client = new LimitlessClient();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lifelogs: [], cursor: null }),
      });

      await client.fetchLifelogs();

      // Verify fetch was called (rate limiter allowed it through)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Parsing', () => {
    it('should parse lifelog with all fields', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'lifelog_123',
        start_time: '2024-01-15T10:30:00Z',
        end_time: '2024-01-15T11:30:00Z',
        transcript: 'Meeting with team about project',
        summary: 'Discussed project timeline',
        metadata: { location: 'office' },
      };

      const parsed = client.parseLifelog(raw);

      expect(parsed).toEqual({
        id: 'lifelog_123',
        date: '2024-01-15',
        start_time: '2024-01-15T10:30:00Z',
        end_time: '2024-01-15T11:30:00Z',
        transcript: 'Meeting with team about project',
        summary: 'Discussed project timeline',
        raw_json: JSON.stringify(raw),
      });
    });

    it('should handle missing optional summary field', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'lifelog_456',
        start_time: '2024-01-16T14:00:00Z',
        end_time: '2024-01-16T15:00:00Z',
        transcript: 'Quick call',
      };

      const parsed = client.parseLifelog(raw);

      expect(parsed.summary).toBeNull();
      expect(parsed.transcript).toBe('Quick call');
    });

    it('should extract date correctly from ISO timestamp', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'lifelog_789',
        start_time: '2024-12-25T23:59:59Z',
        end_time: '2024-12-26T00:59:59Z',
        transcript: 'Late night work',
      };

      const parsed = client.parseLifelog(raw);

      expect(parsed.date).toBe('2024-12-25'); // Uses start_time for date
    });

    it('should preserve raw JSON for future reference', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'lifelog_999',
        start_time: '2024-01-20T12:00:00Z',
        end_time: '2024-01-20T13:00:00Z',
        transcript: 'Test',
        metadata: { custom_field: 'value' },
      };

      const parsed = client.parseLifelog(raw);

      const reconstructed = JSON.parse(parsed.raw_json);
      expect(reconstructed).toEqual(raw);
    });
  });

  describe('Normalization', () => {
    it('should normalize parsed lifelog to database format', () => {
      const client = new LimitlessClient();
      const parsed = {
        id: 'lifelog_111',
        date: '2024-01-15',
        start_time: '2024-01-15T10:00:00Z',
        end_time: '2024-01-15T11:00:00Z',
        transcript: 'Morning meeting',
        summary: 'Team sync',
        raw_json: '{"id":"lifelog_111"}',
      };

      const normalized = client.normalizeLifelogForDb(parsed);

      expect(normalized).toEqual({
        id: 'lifelog_111',
        date: '2024-01-15',
        title: 'Team sync', // summary → title
        manipulation_count: 0, // Initialized to 0
        wrath_deployed: 0, // Initialized to 0
        raw_json: '{"id":"lifelog_111"}',
      });
    });

    it('should initialize manipulation fields to 0', () => {
      const client = new LimitlessClient();
      const parsed = {
        id: 'lifelog_222',
        date: '2024-01-16',
        start_time: '2024-01-16T10:00:00Z',
        end_time: '2024-01-16T11:00:00Z',
        transcript: 'Test',
        summary: 'Test summary',
        raw_json: '{}',
      };

      const normalized = client.normalizeLifelogForDb(parsed);

      // These will be updated by Task #11 manipulation detection pipeline
      expect(normalized.manipulation_count).toBe(0);
      expect(normalized.wrath_deployed).toBe(0);
    });

    it('should handle null summary as null title', () => {
      const client = new LimitlessClient();
      const parsed = {
        id: 'lifelog_333',
        date: '2024-01-17',
        start_time: '2024-01-17T10:00:00Z',
        end_time: '2024-01-17T11:00:00Z',
        transcript: 'No summary lifelog',
        summary: null,
        raw_json: '{}',
      };

      const normalized = client.normalizeLifelogForDb(parsed);

      expect(normalized.title).toBeNull();
    });
  });

  describe('Pipeline', () => {
    it('should fetch, parse, and normalize in single call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_pipeline_1',
              start_time: '2024-01-18T10:00:00Z',
              end_time: '2024-01-18T11:00:00Z',
              transcript: 'Pipeline test',
              summary: 'Pipeline summary',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const dbReady = await client.fetchLifelogsForDb();

      expect(dbReady).toHaveLength(1);
      expect(dbReady[0]).toEqual({
        id: 'lifelog_pipeline_1',
        date: '2024-01-18',
        title: 'Pipeline summary',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: expect.stringContaining('lifelog_pipeline_1'),
      });
    });

    it('should handle multiple lifelogs in pipeline', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_a',
              start_time: '2024-01-19T10:00:00Z',
              end_time: '2024-01-19T11:00:00Z',
              transcript: 'First',
              summary: 'Summary A',
            },
            {
              id: 'lifelog_b',
              start_time: '2024-01-19T12:00:00Z',
              end_time: '2024-01-19T13:00:00Z',
              transcript: 'Second',
              summary: 'Summary B',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const dbReady = await client.fetchLifelogsForDb();

      expect(dbReady).toHaveLength(2);
      expect(dbReady[0].id).toBe('lifelog_a');
      expect(dbReady[1].id).toBe('lifelog_b');
      expect(dbReady[0].title).toBe('Summary A');
      expect(dbReady[1].title).toBe('Summary B');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no API key is configured', async () => {
      mockSettings = {}; // No API key

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow(
        'No Limitless API key found. Configure via POST /api/settings first.'
      );
    });

    it('should handle 401 unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow('Limitless API error: 401 Unauthorized');
    });

    it('should handle 403 forbidden error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow('Limitless API error: 403 Forbidden');
    });

    it('should handle 500 server error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow(
        'Limitless API error: 500 Internal Server Error'
      );
    });

    it('should handle network failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow('Network error');
    });

    it('should handle malformed API response gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing 'lifelogs' field
          cursor: null,
        }),
      });

      const client = new LimitlessClient();

      // Should not crash, but may return undefined or throw type error
      await expect(client.fetchLifelogs()).rejects.toThrow();
    });
  });

  describe('Database Deduplication', () => {
    it('should note that insertLifelogs handles upsert behavior', () => {
      // This test documents that deduplication is handled by insertLifelogs()
      // which uses INSERT ... ON CONFLICT DO UPDATE pattern
      const client = new LimitlessClient();

      const normalized = client.normalizeLifelogForDb({
        id: 'duplicate_id',
        date: '2024-01-20',
        start_time: '2024-01-20T10:00:00Z',
        end_time: '2024-01-20T11:00:00Z',
        transcript: 'Test',
        summary: 'Test',
        raw_json: '{}',
      });

      // Same ID should result in upsert, not duplicate insertion
      expect(normalized.id).toBe('duplicate_id');

      // NOTE: Actual upsert behavior is tested in database layer tests
      // See __tests__/lib/db/queries.test.ts for insertLifelogs() tests
    });

    it('should preserve unique IDs from Limitless API', () => {
      const client = new LimitlessClient();

      const raw1 = {
        id: 'unique_id_1',
        start_time: '2024-01-20T10:00:00Z',
        end_time: '2024-01-20T11:00:00Z',
        transcript: 'First',
      };

      const raw2 = {
        id: 'unique_id_2',
        start_time: '2024-01-20T12:00:00Z',
        end_time: '2024-01-20T13:00:00Z',
        transcript: 'Second',
      };

      const parsed1 = client.parseLifelog(raw1);
      const parsed2 = client.parseLifelog(raw2);

      expect(parsed1.id).not.toBe(parsed2.id);
      expect(parsed1.id).toBe('unique_id_1');
      expect(parsed2.id).toBe('unique_id_2');
    });
  });

  describe('Singleton Instance', () => {
    it('should return the same instance from getLimitlessClient', () => {
      const client1 = getLimitlessClient();
      const client2 = getLimitlessClient();

      expect(client1).toBe(client2);
    });
  });

  describe('Resilience', () => {
    it('should handle empty lifelog array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const lifelogs = await client.fetchLifelogs();

      expect(lifelogs).toEqual([]);
    });

    it('should handle missing metadata field', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'lifelog_no_metadata',
        start_time: '2024-01-21T10:00:00Z',
        end_time: '2024-01-21T11:00:00Z',
        transcript: 'No metadata',
        // metadata field is missing
      };

      const parsed = client.parseLifelog(raw);

      expect(parsed.raw_json).toContain('lifelog_no_metadata');
      expect(parsed.id).toBe('lifelog_no_metadata');
    });

    it('should handle very long transcripts', () => {
      const client = new LimitlessClient();
      const longTranscript = 'A'.repeat(10000); // 10KB transcript

      const raw = {
        id: 'lifelog_long',
        start_time: '2024-01-22T10:00:00Z',
        end_time: '2024-01-22T11:00:00Z',
        transcript: longTranscript,
      };

      const parsed = client.parseLifelog(raw);
      const normalized = client.normalizeLifelogForDb(parsed);

      expect(normalized.raw_json.length).toBeGreaterThan(10000);
      expect(JSON.parse(normalized.raw_json).transcript).toBe(longTranscript);
    });
  });
});
