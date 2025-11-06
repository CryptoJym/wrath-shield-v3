/**
 * Wrath Shield v3 - LimitlessClient Tests (New API Structure)
 *
 * Tests specifically for the NEW Limitless API response format:
 * - { data: { lifelogs: [...] }, meta: { cursor: ... } }
 * - Lifelogs with: startTime, endTime, markdown, title
 * - Proxy-aware httpsRequest instead of fetch
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

// Mock httpsRequest for proxy support
jest.mock('@/lib/https-proxy-request', () => ({
  httpsRequest: jest.fn(),
}));

import { httpsRequest } from '@/lib/https-proxy-request';

/**
 * Helper: Create mock API response in NEW format
 */
const mockApiResponse = (lifelogs: any[], cursor?: string | null) => ({
  status: 200,
  data: JSON.stringify({
    data: { lifelogs },
    meta: cursor ? { cursor } : {},
  }),
});

/**
 * Helper: Create lifelog in NEW format
 */
const mockLifelog = (
  id: string,
  startTime: string,
  transcript: string,
  title: string
) => {
  // Calculate endTime as 1 hour after startTime
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    id,
    startTime,
    endTime: end.toISOString(),
    markdown: transcript,
    title,
    contents: [],
    isStarred: false,
    updatedAt: new Date().toISOString(),
  };
};

describe('LimitlessClient - New API Structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = {};
    (httpsRequest as jest.Mock).mockReset();

    // Set up valid API key by default
    mockSettings.limitless_api_key = {
      key: 'limitless_api_key',
      value_enc: 'encrypted_test_api_key',
    };
  });

  describe('NEW API Response Structure', () => {
    it('should parse response with data.lifelogs structure', async () => {
      const lifelog = mockLifelog(
        'L1test123',
        '2025-11-06T17:47:34Z',
        '## Test conversation\n\n- User: Hello',
        'Test conversation summary'
      );

      (httpsRequest as jest.Mock).mockResolvedValueOnce(
        mockApiResponse([lifelog])
      );

      const client = new LimitlessClient();
      const lifelogs = await client.fetchLifelogs();

      expect(lifelogs).toHaveLength(1);
      expect(lifelogs[0].id).toBe('L1test123');
      expect(lifelogs[0].markdown).toContain('Test conversation');
      expect(lifelogs[0].title).toBe('Test conversation summary');
    });

    it('should handle meta.cursor from new API', async () => {
      (httpsRequest as jest.Mock).mockResolvedValueOnce(
        mockApiResponse(
          [mockLifelog('page1', '2025-11-06T10:00:00Z', 'Page 1', 'Title 1')],
          'cursor_page2'
        )
      );

      (httpsRequest as jest.Mock).mockResolvedValueOnce(
        mockApiResponse(
          [mockLifelog('page2', '2025-11-06T11:00:00Z', 'Page 2', 'Title 2')],
          null
        )
      );

      const client = new LimitlessClient();
      const lifelogs = await client.fetchLifelogs();

      expect(lifelogs).toHaveLength(2);
      expect(httpsRequest).toHaveBeenCalledTimes(2);
    });

    it('should correctly map NEW field names (startTime, markdown, title)', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'L1xyz789',
        startTime: '2025-11-06T14:30:00Z',
        endTime: '2025-11-06T15:45:00Z',
        markdown: '## Technical discussion\n\n- Speaker: Detailed notes...',
        title: 'Technical discussion about APIs',
        contents: [],
        isStarred: true,
      };

      const parsed = client.parseLifelog(raw);

      expect(parsed.id).toBe('L1xyz789');
      expect(parsed.date).toBe('2025-11-06');
      expect(parsed.start_time).toBe('2025-11-06T14:30:00Z');
      expect(parsed.end_time).toBe('2025-11-06T15:45:00Z');
      expect(parsed.transcript).toContain('Technical discussion');
      expect(parsed.summary).toBe('Technical discussion about APIs');
    });

    it('should preserve raw JSON with ALL fields including new ones', () => {
      const client = new LimitlessClient();
      const raw = {
        id: 'L1preserve',
        startTime: '2025-11-06T16:00:00Z',
        endTime: '2025-11-06T17:00:00Z',
        markdown: 'Full transcript here',
        title: 'Meeting title',
        contents: [{ type: 'note', text: 'Extra data' }],
        isStarred: true,
        updatedAt: '2025-11-06T17:00:00Z',
      };

      const parsed = client.parseLifelog(raw);
      const restored = JSON.parse(parsed.raw_json);

      expect(restored.contents).toEqual([{ type: 'note', text: 'Extra data' }]);
      expect(restored.isStarred).toBe(true);
      expect(restored.updatedAt).toBe('2025-11-06T17:00:00Z');
    });
  });

  describe('Proxy-Aware HTTPS Requests', () => {
    it('should use httpsRequest instead of fetch', async () => {
      (httpsRequest as jest.Mock).mockResolvedValueOnce(mockApiResponse([]));

      const client = new LimitlessClient();
      await client.fetchLifelogs();

      expect(httpsRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://api.limitless.ai'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': 'test_api_key',
          }),
        })
      );
    });

    it('should pass X-API-Key header (not Authorization Bearer)', async () => {
      (httpsRequest as jest.Mock).mockResolvedValueOnce(mockApiResponse([]));

      const client = new LimitlessClient();
      await client.fetchLifelogs();

      const calls = (httpsRequest as jest.Mock).mock.calls;
      const headers = calls[0][1].headers;

      expect(headers['X-API-Key']).toBeDefined();
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('Real API Response Examples', () => {
    it('should handle actual API response structure from production', async () => {
      // This is the ACTUAL structure we receive from Limitless API
      const realResponse = {
        status: 200,
        data: JSON.stringify({
          data: {
            lifelogs: [
              {
                contents: [],
                id: 'L1daCOJGCDE2pKbqoE0p',
                markdown:
                  '## Addressing issues with a current model\'s performance\n\n- Unknown (11/6/25 5:47 PM): we already have all the credits we need.',
                title:
                  'A technical discussion about optimizing a processing model',
                startTime: '2025-11-06T17:47:34Z',
                endTime: '2025-11-06T17:48:57Z',
                isStarred: false,
                updatedAt: '2025-11-06T17:56:16Z',
              },
            ],
          },
          meta: {
            cursor: null,
          },
        }),
      };

      (httpsRequest as jest.Mock).mockResolvedValueOnce(realResponse);

      const client = new LimitlessClient();
      const lifelogs = await client.fetchLifelogs();

      expect(lifelogs).toHaveLength(1);
      expect(lifelogs[0].id).toBe('L1daCOJGCDE2pKbqoE0p');
      expect(lifelogs[0].markdown).toContain('Addressing issues');
      expect(lifelogs[0].title).toContain('technical discussion');
    });
  });

  describe('Error Handling with httpsRequest', () => {
    it('should handle network errors from httpsRequest', async () => {
      (httpsRequest as jest.Mock).mockRejectedValueOnce(
        new Error('Network error: ECONNREFUSED')
      );

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow('Network error');
    });

    it('should handle non-200 status codes', async () => {
      (httpsRequest as jest.Mock).mockResolvedValueOnce({
        status: 401,
        data: 'Unauthorized',
      });

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow(
        'Limitless API error: 401'
      );
    });

    it('should handle malformed JSON in response', async () => {
      (httpsRequest as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: 'not valid json',
      });

      const client = new LimitlessClient();

      await expect(client.fetchLifelogs()).rejects.toThrow();
    });
  });

  describe('Critical Regression Prevention', () => {
    it('CRITICAL: must NOT revert to old response structure', async () => {
      // If someone accidentally reverts the code to expect old structure,
      // this test will fail
      const oldStructure = {
        status: 200,
        data: JSON.stringify({
          lifelogs: [{ id: 'test' }], // OLD: direct lifelogs array
          cursor: null, // OLD: direct cursor
        }),
      };

      (httpsRequest as jest.Mock).mockResolvedValueOnce(oldStructure);

      const client = new LimitlessClient();

      // Should throw because code expects data.lifelogs, not direct lifelogs
      await expect(client.fetchLifelogs()).rejects.toThrow();
    });

    it('CRITICAL: must NOT use old field names', () => {
      const client = new LimitlessClient();

      // If someone reverts to old field names, this will fail
      const newLifelog = {
        id: 'test',
        startTime: '2025-11-06T10:00:00Z', // NEW
        endTime: '2025-11-06T11:00:00Z', // NEW
        markdown: 'Transcript', // NEW
        title: 'Summary', // NEW
      };

      const parsed = client.parseLifelog(newLifelog);

      // Should successfully parse with NEW field names
      expect(parsed.transcript).toBe('Transcript');
      expect(parsed.summary).toBe('Summary');
      expect(parsed.start_time).toBe('2025-11-06T10:00:00Z');
    });

    it('CRITICAL: must use httpsRequest, not fetch', async () => {
      (httpsRequest as jest.Mock).mockResolvedValueOnce(mockApiResponse([]));

      const client = new LimitlessClient();
      await client.fetchLifelogs();

      // Verify httpsRequest was called (not global.fetch)
      expect(httpsRequest).toHaveBeenCalled();
    });
  });
});
