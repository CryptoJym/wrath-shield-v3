/**
 * Wrath Shield v3 - WhoopClient Tests
 *
 * Tests for automatic token refresh logic
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

// Mock fetch globally
global.fetch = jest.fn();

describe('WhoopClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens = {};
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Token Refresh on Expiry', () => {
    it('should refresh token when expires_at is within 60 seconds', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 30; // Expires in 30 seconds (within buffer)

      // Set up initial expired token
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_old_access_token',
        refresh_token_enc: 'encrypted_old_refresh_token',
        expires_at: expiresAt,
      };

      // Mock token refresh response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh_token',
          scope: 'read:recovery read:cycles read:sleep',
        }),
      });

      // Mock WHOOP API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 12345, email: 'test@example.com' }),
      });

      const client = new WhoopClient();
      const profile = await client.getUserProfile();

      // Verify token refresh was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/oauth/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify new tokens were encrypted and stored
      const { encryptData } = require('@/lib/crypto');
      expect(encryptData).toHaveBeenCalledWith('new_access_token');
      expect(encryptData).toHaveBeenCalledWith('new_refresh_token');

      const { insertTokens } = require('@/lib/db/queries');
      expect(insertTokens).toHaveBeenCalledWith([
        {
          provider: 'whoop',
          access_token_enc: 'encrypted_new_access_token',
          refresh_token_enc: 'encrypted_new_refresh_token',
          expires_at: expect.any(Number),
        },
      ]);

      // Verify API call was made with new token
      expect(profile).toEqual({ user_id: 12345, email: 'test@example.com' });
    });

    it('should not refresh token when expires_at is more than 60 seconds away', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 3600; // Expires in 1 hour

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_valid_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: expiresAt,
      };

      // Mock WHOOP API response only (no token refresh)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 12345 }),
      });

      const client = new WhoopClient();
      await client.getUserProfile();

      // Verify token refresh was NOT called (only 1 fetch for API request)
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/developer/v1/user/profile/basic',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid_token',
          }),
        })
      );
    });
  });

  describe('Token Refresh on 401', () => {
    it('should refresh token and retry request on 401 response', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 3600; // Valid token

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_old_access_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: expiresAt,
      };

      // First API call returns 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      // Token refresh succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refreshed_refresh_token',
          scope: 'read:recovery',
        }),
      });

      // Retry API call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 12345 }),
      });

      const client = new WhoopClient();
      const profile = await client.getUserProfile();

      // Verify sequence: API call (401) -> token refresh -> retry API call
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Verify new token was used in retry
      const calls = (global.fetch as jest.Mock).mock.calls;
      const retryCall = calls[2];
      expect(retryCall[1].headers.Authorization).toBe('Bearer refreshed_access_token');

      expect(profile).toEqual({ user_id: 12345 });
    });

    it('should not retry more than once on 401', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_access_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: now + 3600,
      };

      // First API call returns 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      // Token refresh succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh',
          scope: 'read:recovery',
        }),
      });

      // Retry still returns 401
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Still unauthorized',
      });

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow(
        'WHOOP API error: 401 Still unauthorized'
      );

      // Should have made 3 calls total: initial (401), refresh, retry (401)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Refresh Protection', () => {
    it('should only refresh token once when multiple requests trigger refresh', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 30; // Expires soon

      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_old_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: expiresAt,
      };

      // Mock token refresh (will be called once)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'new_refresh',
          scope: 'read:recovery',
        }),
      });

      // Mock two API responses
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'response1' }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'response2' }),
      });

      const client = new WhoopClient();

      // Make two concurrent requests
      const [result1, result2] = await Promise.all([
        client.get('/developer/v1/test1'),
        client.get('/developer/v1/test2'),
      ]);

      // Token refresh should have been called only once
      const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('oauth2/token')
      );
      expect(refreshCalls).toHaveLength(1);

      expect(result1).toEqual({ data: 'response1' });
      expect(result2).toEqual({ data: 'response2' });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no token exists', async () => {
      mockTokens = {}; // No tokens

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow(
        'No WHOOP token found. User must authenticate first.'
      );
    });

    it('should throw error when token refresh fails', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_token',
        refresh_token_enc: 'encrypted_refresh',
        expires_at: now + 30, // Needs refresh
      };

      // Mock failed token refresh
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow(
        'Token refresh failed: 400 invalid_grant'
      );
    });

    it('should throw error when no refresh token available', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_token',
        refresh_token_enc: null, // No refresh token
        expires_at: now + 30,
      };

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow(
        'No refresh token available. User must re-authenticate.'
      );
    });
  });

  describe('API Methods', () => {
    beforeEach(() => {
      const now = Math.floor(Date.now() / 1000);
      mockTokens.whoop = {
        provider: 'whoop',
        access_token_enc: 'encrypted_valid_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: now + 3600,
      };
    });

    it('should make GET request to recovery endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [{ recovery_score: 85 }] }),
      });

      const client = new WhoopClient();
      const recovery = await client.getRecovery({ start: '2024-01-01', end: '2024-01-31' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/developer/v1/recovery?start=2024-01-01&end=2024-01-31',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid_token',
          }),
        })
      );

      expect(recovery).toEqual({ records: [{ recovery_score: 85 }] });
    });

    it('should make GET request to cycles endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [{ strain: 12.5 }] }),
      });

      const client = new WhoopClient();
      const cycles = await client.getCycles({ start: '2024-01-01' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/developer/v1/cycle?start=2024-01-01',
        expect.any(Object)
      );

      expect(cycles).toEqual({ records: [{ strain: 12.5 }] });
    });

    it('should make GET request to sleep endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ records: [{ total_sleep_time: 28000 }] }),
      });

      const client = new WhoopClient();
      const sleep = await client.getSleep();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/developer/v1/activity/sleep',
        expect.any(Object)
      );

      expect(sleep).toEqual({ records: [{ total_sleep_time: 28000 }] });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = new WhoopClient();

      await expect(client.getUserProfile()).rejects.toThrow(
        'WHOOP API error: 500 Internal Server Error'
      );
    });
  });

  describe('Singleton Instance', () => {
    it('should return the same instance from getWhoopClient', () => {
      const client1 = getWhoopClient();
      const client2 = getWhoopClient();

      expect(client1).toBe(client2);
    });
  });
});
