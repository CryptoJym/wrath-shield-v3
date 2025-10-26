/**
 * Wrath Shield v3 - OAuth Callback Route Tests
 *
 * Tests for /api/whoop/oauth/callback endpoint with token exchange
 */

import { GET } from '@/app/api/whoop/oauth/callback/route';
import { NextRequest } from 'next/server';

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
    openRouter: {
      apiKey: 'test-openrouter-key',
    },
    encryption: {
      key: 'test-encryption-key-32-bytes-long!',
    },
  })),
}));

// Mock crypto functions
jest.mock('@/lib/crypto', () => ({
  encryptData: jest.fn((data: string) => `encrypted_${data}`),
  decryptData: jest.fn((data: string) => data.replace('encrypted_', '')),
}));

// Mock database functions
jest.mock('@/lib/db/queries', () => ({
  insertTokens: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('WHOOP OAuth Callback Route', () => {
  const mockRequest = (url: string, cookies: Record<string, string> = {}) => {
    return {
      url,
      headers: new Headers({
        host: 'localhost:3000',
      }),
      cookies: {
        get: jest.fn((name: string) => {
          const value = cookies[name];
          return value ? { value } : undefined;
        }),
        set: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('State Validation (CSRF Protection)', () => {
    it('should reject request with missing state parameter', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/callback?code=test-code');

      const response = await GET(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required OAuth parameters');
    });

    it('should reject request with missing code parameter', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/callback?state=test-state');

      const response = await GET(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required OAuth parameters');
    });

    it('should reject request with no oauth_state cookie', async () => {
      const req = mockRequest(
        'http://localhost:3000/api/whoop/oauth/callback?code=test-code&state=test-state'
        // No cookies set
      );

      const response = await GET(req);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('CSRF validation failed');
    });

    it('should reject request with mismatched state', async () => {
      const req = mockRequest(
        'http://localhost:3000/api/whoop/oauth/callback?code=test-code&state=different-state',
        { oauth_state: 'original-state' }
      );

      const response = await GET(req);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('CSRF validation failed');
    });
  });

  describe('Authorization Errors', () => {
    it('should handle access_denied error', async () => {
      const req = mockRequest(
        'http://localhost:3000/api/whoop/oauth/callback?error=access_denied&error_description=User%20denied%20access'
      );

      const response = await GET(req);

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toMatch(/oauth_error=User(\+|%20)denied(\+|%20)access/);
    });

    it('should handle server_error', async () => {
      const req = mockRequest(
        'http://localhost:3000/api/whoop/oauth/callback?error=server_error&error_description=Internal%20server%20error'
      );

      const response = await GET(req);

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toMatch(/oauth_error=Internal(\+|%20)server(\+|%20)error/);
    });

    it('should handle error without description', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/callback?error=unknown_error');

      const response = await GET(req);

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toMatch(/oauth_error=Unknown(\+|%20)error/);
    });

    it('should redirect to home page on error', async () => {
      const req = mockRequest(
        'http://localhost:3000/api/whoop/oauth/callback?error=access_denied&error_description=Denied'
      );

      const response = await GET(req);

      const location = response.headers.get('location');
      expect(location).toContain('http://localhost:3000/');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens and store encrypted', async () => {
      const state = 'valid-state';
      const code = 'auth-code-123';

      // Mock successful token response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'whoop_access_token_xyz',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'whoop_refresh_token_abc',
          scope: 'read:recovery read:cycles read:sleep',
        }),
      });

      const req = mockRequest(
        `http://localhost:3000/api/whoop/oauth/callback?code=${code}&state=${state}`,
        { oauth_state: state }
      );

      const response = await GET(req);

      // Should redirect to success page
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('/?oauth_success=true');

      // Verify token exchange was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.prod.whoop.com/oauth/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify tokens were encrypted
      const { encryptData } = require('@/lib/crypto');
      expect(encryptData).toHaveBeenCalledWith('whoop_access_token_xyz');
      expect(encryptData).toHaveBeenCalledWith('whoop_refresh_token_abc');

      // Verify tokens were stored in database
      const { insertTokens } = require('@/lib/db/queries');
      expect(insertTokens).toHaveBeenCalledWith([
        {
          provider: 'whoop',
          access_token_enc: 'encrypted_whoop_access_token_xyz',
          refresh_token_enc: 'encrypted_whoop_refresh_token_abc',
          expires_at: expect.any(Number),
        },
      ]);
    });

    it('should handle token exchange failure', async () => {
      const state = 'valid-state';
      const code = 'auth-code-456';

      // Mock failed token response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      const req = mockRequest(
        `http://localhost:3000/api/whoop/oauth/callback?code=${code}&state=${state}`,
        { oauth_state: state }
      );

      const response = await GET(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to exchange authorization code for tokens');
    });

    it('should calculate correct expires_at timestamp', async () => {
      const state = 'valid-state';
      const code = 'auth-code-789';
      const expiresIn = 3600; // 1 hour

      const beforeTimestamp = Math.floor(Date.now() / 1000);

      // Mock successful token response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access',
          token_type: 'Bearer',
          expires_in: expiresIn,
          refresh_token: 'refresh',
          scope: 'read:recovery',
        }),
      });

      const req = mockRequest(
        `http://localhost:3000/api/whoop/oauth/callback?code=${code}&state=${state}`,
        { oauth_state: state }
      );

      await GET(req);

      const afterTimestamp = Math.floor(Date.now() / 1000);

      const { insertTokens } = require('@/lib/db/queries');
      const callArgs = (insertTokens as jest.Mock).mock.calls[0][0];
      const expiresAt = callArgs[0].expires_at;

      // Verify expires_at is approximately current time + expires_in
      expect(expiresAt).toBeGreaterThanOrEqual(beforeTimestamp + expiresIn);
      expect(expiresAt).toBeLessThanOrEqual(afterTimestamp + expiresIn);
    });

    it('should use correct redirect_uri in token exchange', async () => {
      const state = 'valid-state';
      const code = 'auth-code-redirect';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh',
          scope: 'read:recovery',
        }),
      });

      const req = mockRequest(
        `http://localhost:3000/api/whoop/oauth/callback?code=${code}&state=${state}`,
        { oauth_state: state }
      );

      await GET(req);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const bodyParams = new URLSearchParams(fetchCall[1].body);

      expect(bodyParams.get('grant_type')).toBe('authorization_code');
      expect(bodyParams.get('code')).toBe(code);
      expect(bodyParams.get('redirect_uri')).toBe('http://localhost:3000/api/whoop/oauth/callback');
      expect(bodyParams.get('client_id')).toBe('test-client-id');
      expect(bodyParams.get('client_secret')).toBe('test-client-secret');
    });
  });

  describe('Error Handling', () => {
    it('should catch and handle unexpected errors gracefully', async () => {
      // Create a request that will cause URL parsing to fail
      const req = {
        url: 'not-a-valid-url',
        cookies: {
          get: jest.fn(),
        },
      } as unknown as NextRequest;

      const response = await GET(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to process OAuth callback');
    });
  });
});
