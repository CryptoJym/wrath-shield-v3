/**
 * Wrath Shield v3 - LimitlessClient Incremental Sync Tests
 *
 * Tests for syncNewLifelogs() method:
 * - First sync (no previous timestamp)
 * - Incremental sync with last_successful_pull
 * - Empty result handling
 * - Timestamp storage and encryption
 * - Database deduplication via insertLifelogs()
 */

import { LimitlessClient } from '@/lib/LimitlessClient';
import * as crypto from '@/lib/crypto';
import * as db from '@/lib/db/queries';

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
let insertedLifelogs: any[] = [];
let insertedSettings: any[] = [];

jest.mock('@/lib/db/queries', () => ({
  getSettings: jest.fn((key: string) => mockSettings[key] || null),
  insertSettings: jest.fn((settings: any[]) => {
    settings.forEach((setting) => {
      mockSettings[setting.key] = setting;
      insertedSettings.push(setting);
    });
  }),
  insertLifelogs: jest.fn((lifelogs: any[]) => {
    insertedLifelogs.push(...lifelogs);
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('LimitlessClient - Incremental Sync', () => {
  const mockEncryptData = crypto.encryptData as jest.MockedFunction<typeof crypto.encryptData>;
  const mockDecryptData = crypto.decryptData as jest.MockedFunction<typeof crypto.decryptData>;
  const mockGetSettings = db.getSettings as jest.MockedFunction<typeof db.getSettings>;
  const mockInsertSettings = db.insertSettings as jest.MockedFunction<typeof db.insertSettings>;
  const mockInsertLifelogs = db.insertLifelogs as jest.MockedFunction<typeof db.insertLifelogs>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = {};
    insertedLifelogs = [];
    insertedSettings = [];
    (global.fetch as jest.Mock).mockReset();

    // Set up valid API key by default
    mockSettings.limitless_api_key = {
      key: 'limitless_api_key',
      value_enc: 'encrypted_test_api_key',
    };

    // Mock Date.now() for consistent timestamp testing
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-31T12:00:00Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('First Sync (No Previous Timestamp)', () => {
    it('should fetch all lifelogs when no last_successful_pull exists', async () => {
      // No last_successful_pull setting exists
      mockGetSettings.mockReturnValueOnce(null);

      // Mock API response with 2 lifelogs
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_1',
              start_time: '2024-01-30T10:00:00Z',
              end_time: '2024-01-30T11:00:00Z',
              transcript: 'First lifelog',
              summary: 'Summary 1',
            },
            {
              id: 'lifelog_2',
              start_time: '2024-01-30T14:00:00Z',
              end_time: '2024-01-30T15:00:00Z',
              transcript: 'Second lifelog',
              summary: 'Summary 2',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(2);

      // Verify no start_date filter was used (fetch all)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/lifelogs'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.not.stringContaining('start_date='),
        expect.any(Object)
      );

      // Verify lifelogs were stored
      expect(mockInsertLifelogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'lifelog_1' }),
          expect.objectContaining({ id: 'lifelog_2' }),
        ])
      );

      // Verify last_successful_pull was updated
      expect(mockInsertSettings).toHaveBeenCalledWith([
        {
          key: 'limitless_last_pull',
          value_enc: 'encrypted_2024-01-31', // Today's date
        },
      ]);
    });

    it('should update last_successful_pull to today after first sync', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_first',
              start_time: '2024-01-15T10:00:00Z',
              end_time: '2024-01-15T11:00:00Z',
              transcript: 'First sync',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.syncNewLifelogs();

      // Verify encryptData was called with today's date (YYYY-MM-DD)
      expect(mockEncryptData).toHaveBeenCalledWith('2024-01-31');

      // Verify settings were inserted with encrypted timestamp
      expect(insertedSettings).toEqual([
        {
          key: 'limitless_last_pull',
          value_enc: 'encrypted_2024-01-31',
        },
      ]);
    });
  });

  describe('Incremental Sync', () => {
    it('should fetch only lifelogs since last_successful_pull', async () => {
      // Mock existing last_successful_pull timestamp
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-25',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-25');

      // Mock API response with 1 new lifelog
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_new',
              start_time: '2024-01-30T10:00:00Z',
              end_time: '2024-01-30T11:00:00Z',
              transcript: 'New lifelog since last pull',
              summary: 'Recent activity',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(1);

      // Verify decryption of stored timestamp
      expect(mockDecryptData).toHaveBeenCalledWith('encrypted_2024-01-25');

      // Verify start_date filter was used
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2024-01-25'),
        expect.any(Object)
      );

      // Verify new lifelog was stored
      expect(mockInsertLifelogs).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'lifelog_new',
          title: 'Recent activity',
        }),
      ]);

      // Verify last_successful_pull was updated to today
      expect(mockInsertSettings).toHaveBeenCalledWith([
        {
          key: 'limitless_last_pull',
          value_enc: 'encrypted_2024-01-31',
        },
      ]);
    });

    it('should handle multiple pages in incremental sync', async () => {
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-20',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-20');

      // Mock first page with cursor
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_page1',
              start_time: '2024-01-25T10:00:00Z',
              end_time: '2024-01-25T11:00:00Z',
              transcript: 'Page 1',
            },
          ],
          cursor: 'page2_cursor',
        }),
      });

      // Mock second page without cursor
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_page2',
              start_time: '2024-01-28T10:00:00Z',
              end_time: '2024-01-28T11:00:00Z',
              transcript: 'Page 2',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(2);

      // Verify both pages were fetched
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify all lifelogs were stored
      expect(insertedLifelogs).toHaveLength(2);
      expect(insertedLifelogs[0].id).toBe('lifelog_page1');
      expect(insertedLifelogs[1].id).toBe('lifelog_page2');
    });
  });

  describe('Empty Result Handling', () => {
    it('should return 0 when no new lifelogs are available', async () => {
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-30',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-30');

      // Mock empty API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(0);

      // Verify insertLifelogs was NOT called
      expect(mockInsertLifelogs).not.toHaveBeenCalled();

      // Verify last_successful_pull was NOT updated (no new data)
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });

    it('should not update timestamp when fetch returns empty array', async () => {
      mockGetSettings.mockReturnValueOnce(null); // First sync

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(0);
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });
  });

  describe('Timestamp Storage', () => {
    it('should encrypt timestamp before storing in database', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_test',
              start_time: '2024-01-30T10:00:00Z',
              end_time: '2024-01-30T11:00:00Z',
              transcript: 'Test',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.syncNewLifelogs();

      // Verify encryptData was called with YYYY-MM-DD format
      expect(mockEncryptData).toHaveBeenCalledWith('2024-01-31');
      expect(mockEncryptData).toHaveBeenCalledTimes(1);

      // Verify insertSettings received encrypted value
      expect(mockInsertSettings).toHaveBeenCalledWith([
        expect.objectContaining({
          value_enc: expect.stringContaining('encrypted_'),
        }),
      ]);
    });

    it('should use YYYY-MM-DD format for timestamp', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      // Mock specific date
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-12-25T23:59:59.999Z');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_christmas',
              start_time: '2024-12-25T10:00:00Z',
              end_time: '2024-12-25T11:00:00Z',
              transcript: 'Christmas lifelog',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.syncNewLifelogs();

      // Verify YYYY-MM-DD extraction from ISO string
      expect(mockEncryptData).toHaveBeenCalledWith('2024-12-25');
    });

    it('should decrypt stored timestamp when reading last_successful_pull', async () => {
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-15',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-15');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.syncNewLifelogs();

      // Verify decryptData was called with encrypted value
      expect(mockDecryptData).toHaveBeenCalledWith('encrypted_2024-01-15');

      // Verify decrypted value was used as start_date
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2024-01-15'),
        expect.any(Object)
      );
    });
  });

  describe('Database Deduplication', () => {
    it('should rely on insertLifelogs upsert behavior for deduplication', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      // Mock response with duplicate IDs (simulating multiple syncs)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'duplicate_id_123',
              start_time: '2024-01-30T10:00:00Z',
              end_time: '2024-01-30T11:00:00Z',
              transcript: 'First version',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.syncNewLifelogs();

      // Verify insertLifelogs was called (handles upsert internally)
      expect(mockInsertLifelogs).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'duplicate_id_123',
        }),
      ]);

      // Note: Actual upsert behavior (INSERT ... ON CONFLICT DO UPDATE)
      // is tested in database layer tests (__tests__/lib/db/queries.test.ts)
    });

    it('should pass all normalized lifelogs to insertLifelogs', async () => {
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-20',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-20');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            {
              id: 'lifelog_a',
              start_time: '2024-01-25T10:00:00Z',
              end_time: '2024-01-25T11:00:00Z',
              transcript: 'Lifelog A',
              summary: 'Summary A',
            },
            {
              id: 'lifelog_b',
              start_time: '2024-01-26T10:00:00Z',
              end_time: '2024-01-26T11:00:00Z',
              transcript: 'Lifelog B',
              summary: 'Summary B',
            },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      await client.syncNewLifelogs();

      // Verify both lifelogs were normalized and passed to database
      expect(mockInsertLifelogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'lifelog_a',
            date: '2024-01-25',
            title: 'Summary A',
            manipulation_count: 0,
            wrath_deployed: 0,
          }),
          expect.objectContaining({
            id: 'lifelog_b',
            date: '2024-01-26',
            title: 'Summary B',
            manipulation_count: 0,
            wrath_deployed: 0,
          }),
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when API key is not configured', async () => {
      mockSettings = {}; // No API key

      const client = new LimitlessClient();

      await expect(client.syncNewLifelogs()).rejects.toThrow(
        'No Limitless API key found. Configure via POST /api/settings first.'
      );

      // Verify no database operations were attempted
      expect(mockInsertLifelogs).not.toHaveBeenCalled();
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });

    it('should propagate API errors', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = new LimitlessClient();

      await expect(client.syncNewLifelogs()).rejects.toThrow(
        'Limitless API error: 500 Internal Server Error'
      );

      // Verify timestamp was NOT updated on error
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });

    it('should propagate network errors', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      const client = new LimitlessClient();

      await expect(client.syncNewLifelogs()).rejects.toThrow('Network failure');

      // Verify timestamp was NOT updated on error
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Pagination', () => {
    it('should use existing pagination logic during sync', async () => {
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-01',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-01');

      // Mock 3 pages of results
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lifelogs: [{ id: 'page1', start_time: '2024-01-15T10:00:00Z', end_time: '2024-01-15T11:00:00Z', transcript: 'P1' }],
            cursor: 'cursor_2',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lifelogs: [{ id: 'page2', start_time: '2024-01-20T10:00:00Z', end_time: '2024-01-20T11:00:00Z', transcript: 'P2' }],
            cursor: 'cursor_3',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lifelogs: [{ id: 'page3', start_time: '2024-01-25T10:00:00Z', end_time: '2024-01-25T11:00:00Z', transcript: 'P3' }],
            cursor: null,
          }),
        });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(3);

      // Verify all 3 pages were fetched
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Verify cursor was used correctly
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[1][0]).toContain('cursor=cursor_2');
      expect(calls[2][0]).toContain('cursor=cursor_3');

      // Verify all lifelogs from all pages were stored
      expect(insertedLifelogs).toHaveLength(3);
      expect(insertedLifelogs.map((l) => l.id)).toEqual(['page1', 'page2', 'page3']);
    });
  });

  describe('Observability', () => {
    it('should return count of new lifelogs for monitoring', async () => {
      mockGetSettings.mockReturnValueOnce(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [
            { id: 'l1', start_time: '2024-01-30T10:00:00Z', end_time: '2024-01-30T11:00:00Z', transcript: 'L1' },
            { id: 'l2', start_time: '2024-01-30T12:00:00Z', end_time: '2024-01-30T13:00:00Z', transcript: 'L2' },
            { id: 'l3', start_time: '2024-01-30T14:00:00Z', end_time: '2024-01-30T15:00:00Z', transcript: 'L3' },
          ],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      // Return value should match number of new lifelogs
      expect(count).toBe(3);
    });

    it('should return 0 for empty syncs', async () => {
      mockGetSettings.mockReturnValueOnce({
        key: 'limitless_last_pull',
        value_enc: 'encrypted_2024-01-30',
      });

      mockDecryptData.mockReturnValueOnce('2024-01-30');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lifelogs: [],
          cursor: null,
        }),
      });

      const client = new LimitlessClient();
      const count = await client.syncNewLifelogs();

      expect(count).toBe(0);
    });
  });
});
