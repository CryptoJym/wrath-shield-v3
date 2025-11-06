/**
 * Wrath Shield v3 - WhoopClient Proxy Support Tests
 *
 * Tests for WHOOP client with httpsRequest proxy support
 * Ensures the client works through proxy environments
 */

import { WhoopClient, getWhoopClient } from '@/lib/WhoopClient';

// Disable server-only guard for testing
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  cfg: jest.fn(() => ({
    whoop: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
  })),
}));

// Mock crypto functions
jest.mock('@/lib/crypto', () => ({
  encryptData: jest.fn((data: string) => `encrypted_${data}`),
  decryptData: jest.fn((data: string) => data.replace('encrypted_', '')),
}));

// Mock database functions
let mockTokens: Record<string, any> = {};

jest.mock('@/lib/db/queries', () => ({
  getToken: jest.fn((provider: string) => mockTokens[provider] || null),
  insertTokens: jest.fn((tokens: any[]) => {
    tokens.forEach((token) => {
      mockTokens[token.provider] = token;
    });
  }),
}));

// Mock httpsRequest for proxy support
jest.mock('@/lib/https-proxy-request', () => ({
  httpsRequest: jest.fn(),
}));

import { httpsRequest } from '@/lib/https-proxy-request';

describe('WhoopClient - Proxy Support', () => {
  const mockHttpsRequest = httpsRequest as jest.MockedFunction<typeof httpsRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens = {};
    mockHttpsRequest.mockReset();
  });

  describe('CRITICAL: Uses httpsRequest instead of fetch', () => {
    it('should use httpsRequest for API calls', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_test_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: futureTime,
      };

      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({ user_id: 12345, email: 'test@example.com' }),
      });

      const client = new WhoopClient();
      await client.getUserProfile();

      // CRITICAL: Must use httpsRequest, not fetch
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/developer/v1/user/profile/basic',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_token',
          }),
        })
      );
    });

    it('should use httpsRequest for token refresh', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 30; // Expires soon

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_old_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: expiresAt,
      };

      // Mock token refresh
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          access_token: 'new_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh_token',
          scope: 'read:recovery read:cycles read:sleep',
        }),
      });

      // Mock API call
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({ user_id: 12345 }),
      });

      const client = new WhoopClient();
      await client.getUserProfile();

      // Should have called token refresh endpoint
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/oauth/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      );
    });
  });

  describe('Token Management', () => {
    it('should handle token refresh correctly', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 30;

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_old_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: expiresAt,
      };

      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          access_token: 'new_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh',
          scope: 'read:all',
        }),
      });

      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({ records: [] }),
      });

      const client = new WhoopClient();
      await client.fetchCycles('2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z');

      // Should have refreshed token
      expect(mockHttpsRequest).toHaveBeenCalledTimes(2);
      expect(mockTokens.whoop.access_token_enc).toBe('encrypted_new_token');
    });

    it('should throw error when no token exists', async () => {
      mockTokens = {}; // No token

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow(
        'No WHOOP token found. User must authenticate first.'
      );
    });

    it('should retry on 401 Unauthorized', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 7200;

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_token',
        refresh_token_enc: 'encrypted_refresh',
        expires_at: futureTime,
      };

      // First call returns 401
      mockHttpsRequest.mockResolvedValueOnce({
        status: 401,
        data: 'Unauthorized',
      });

      // Token refresh
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          access_token: 'refreshed_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh',
          scope: 'read:all',
        }),
      });

      // Retry succeeds
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({ user_id: 12345 }),
      });

      const client = new WhoopClient();
      const result = await client.getUserProfile();

      expect(result).toEqual({ user_id: 12345 });
      expect(mockHttpsRequest).toHaveBeenCalledTimes(3);
    });
  });

  describe('Data Fetching', () => {
    beforeEach(() => {
      const futureTime = Math.floor(Date.now() / 1000) + 7200;
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_token',
        refresh_token_enc: 'encrypted_refresh',
        expires_at: futureTime,
      };
    });

    it('should fetch cycles with pagination', async () => {
      // Page 1
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            { id: 1, start: '2024-01-01T00:00:00Z', end: '2024-01-01T23:59:59Z', score: { strain: 10.5 } },
          ],
          next_token: 'page2_token',
        }),
      });

      // Page 2
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            { id: 2, start: '2024-01-02T00:00:00Z', end: '2024-01-02T23:59:59Z', score: { strain: 12.3 } },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const cycles = await client.fetchCycles('2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z');

      expect(cycles).toHaveLength(2);
      expect(mockHttpsRequest).toHaveBeenCalledTimes(2);

      // Check pagination params
      const secondCall = mockHttpsRequest.mock.calls[1][0] as string;
      expect(secondCall).toContain('nextToken=page2_token');
    });

    it('should fetch recoveries', async () => {
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            {
              id: 1,
              cycle_id: 100,
              created_at: '2024-01-01T08:00:00Z',
              score: {
                recovery_score: 75,
                hrv_rmssd_milli: 50,
                resting_heart_rate: 55,
                spo2_percentage: 98,
                skin_temp_celsius: 36.5,
              },
            },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const recoveries = await client.fetchRecoveries('2024-01-01T00:00:00Z');

      expect(recoveries).toHaveLength(1);
      expect(recoveries[0].id).toBe(1);
    });

    it('should fetch sleeps', async () => {
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            {
              id: 1,
              start: '2024-01-01T22:00:00Z',
              end: '2024-01-02T06:00:00Z',
              score: {
                stage_summary: {
                  total_rem_sleep_time_milli: 90 * 60 * 1000,
                  total_slow_wave_sleep_time_milli: 60 * 60 * 1000,
                  total_light_sleep_time_milli: 180 * 60 * 1000,
                  total_awake_time_milli: 30 * 60 * 1000,
                },
                sleep_performance_percentage: 85,
                respiratory_rate: 14.5,
              },
            },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const sleeps = await client.fetchSleeps('2024-01-01T00:00:00Z');

      expect(sleeps).toHaveLength(1);
      expect(sleeps[0].id).toBe(1);
    });
  });

  describe('Parsing and Normalization', () => {
    it('should parse cycle data correctly', () => {
      const client = new WhoopClient();
      const rawCycle = {
        id: 12345,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        score: {
          strain: 15.7,
          kilojoule: 8500,
          average_heart_rate: 120,
          max_heart_rate: 165,
        },
      };

      const parsed = client.parseCycle(rawCycle);

      expect(parsed.id).toBe(12345);
      expect(parsed.strain).toBe(15.7);
      expect(parsed.strain_level).toBe('overdrive'); // 15.7 > 14
      expect(parsed.kilojoules).toBe(8500);
    });

    it('should classify strain levels correctly', () => {
      const client = new WhoopClient();

      expect(client.classifyStrain(5)).toBe('light');
      expect(client.classifyStrain(12)).toBe('moderate');
      expect(client.classifyStrain(18)).toBe('overdrive');
    });

    it('should classify recovery levels correctly', () => {
      const client = new WhoopClient();

      expect(client.classifyRecoveryScore(80)).toBe('high');
      expect(client.classifyRecoveryScore(55)).toBe('medium');
      expect(client.classifyRecoveryScore(25)).toBe('low');
    });

    it('should normalize cycle for database', () => {
      const client = new WhoopClient();
      const parsed = {
        id: 12345,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        strain: 15.7,
        strain_level: 'overdrive' as const,
        kilojoules: 8500,
        avg_heart_rate: 120,
        max_heart_rate: 165,
      };

      const normalized = client.normalizeCycleForDb(parsed);

      expect(normalized.id).toBe('12345');
      expect(normalized.date).toBe('2024-01-15');
      expect(normalized.strain).toBe(15.7);
      expect(normalized.avg_hr).toBe(120);
      expect(normalized.max_hr).toBe(165);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getWhoopClient', () => {
      const client1 = getWhoopClient();
      const client2 = getWhoopClient();

      expect(client1).toBe(client2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const futureTime = Math.floor(Date.now() / 1000) + 7200;
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_token',
        refresh_token_enc: 'encrypted_refresh',
        expires_at: futureTime,
      };
    });

    it('should handle API errors', async () => {
      mockHttpsRequest.mockResolvedValueOnce({
        status: 500,
        data: 'Internal Server Error',
      });

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow('WHOOP API error: 500');
    });

    it('should handle network errors', async () => {
      mockHttpsRequest.mockRejectedValueOnce(new Error('Network timeout'));

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow('Network timeout');
    });
  });

  describe('CRITICAL: Regression Prevention', () => {
    it('must NOT revert to using fetch()', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 7200;
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_token',
        refresh_token_enc: 'encrypted_refresh',
        expires_at: futureTime,
      };

      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({ user_id: 12345 }),
      });

      const client = new WhoopClient();
      await client.getUserProfile();

      // CRITICAL: Must have used httpsRequest
      expect(mockHttpsRequest).toHaveBeenCalled();
    });

    it('must use Bearer token authentication for WHOOP', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 7200;
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_test_token',
        refresh_token_enc: 'encrypted_refresh',
        expires_at: futureTime,
      };

      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({ user_id: 12345 }),
      });

      const client = new WhoopClient();
      await client.getUserProfile();

      // WHOOP uses Bearer tokens (OAuth2), not API keys
      expect(mockHttpsRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test_token',
          }),
        })
      );
    });
  });
});
