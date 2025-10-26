/**
 * Wrath Shield v3 - OAuth Initiate Route Tests
 *
 * Tests for /api/whoop/oauth/initiate endpoint
 */

import { GET } from '@/app/api/whoop/oauth/initiate/route';
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
  })),
}));

describe('WHOOP OAuth Initiate Route', () => {
  const mockRequest = (url: string, headers: Record<string, string> = {}) => {
    return {
      url,
      headers: new Headers({
        host: 'localhost:3000',
        ...headers,
      }),
      cookies: {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as NextRequest;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization URL Construction', () => {
    it('should build correct authorization URL with all required parameters', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const response = await GET(req);

      expect(response.status).toBe(302);

      const location = response.headers.get('location');
      expect(location).toBeTruthy();

      const authUrl = new URL(location!);
      expect(authUrl.origin).toBe('https://api.prod.whoop.com');
      expect(authUrl.pathname).toBe('/oauth/oauth2/auth');

      // Verify all required parameters
      const params = authUrl.searchParams;
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('redirect_uri')).toBe('http://localhost:3000/api/whoop/oauth/callback');
      expect(params.get('response_type')).toBe('code');
      expect(params.get('scope')).toBe('read:recovery read:cycles read:sleep');
      expect(params.get('state')).toBeTruthy();
      expect(params.get('state')!.length).toBeGreaterThan(20); // Base64url encoded random bytes
    });

    it('should use https protocol in production', async () => {
      const req = mockRequest('https://app.example.com/api/whoop/oauth/initiate', {
        'x-forwarded-proto': 'https',
        host: 'app.example.com',
      });

      const response = await GET(req);
      const location = response.headers.get('location');
      const authUrl = new URL(location!);

      expect(authUrl.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/whoop/oauth/callback');
    });

    it('should generate unique state parameter for each request', async () => {
      const req1 = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const req2 = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');

      const response1 = await GET(req1);
      const response2 = await GET(req2);

      const location1 = response1.headers.get('location');
      const location2 = response2.headers.get('location');

      const state1 = new URL(location1!).searchParams.get('state');
      const state2 = new URL(location2!).searchParams.get('state');

      expect(state1).not.toBe(state2);
    });
  });

  describe('State Cookie Handling', () => {
    it('should set oauth_state cookie with correct attributes', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const response = await GET(req);

      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toBeTruthy();

      // Verify cookie attributes
      expect(setCookieHeader).toContain('oauth_state=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader.toLowerCase()).toContain('samesite=lax');
      expect(setCookieHeader).toContain('Path=/api/whoop/oauth');
      expect(setCookieHeader).toContain('Max-Age=600'); // 10 minutes
    });

    it('should set Secure flag in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = mockRequest('https://app.example.com/api/whoop/oauth/initiate', {
        'x-forwarded-proto': 'https',
        host: 'app.example.com',
      });

      const response = await GET(req);
      const setCookieHeader = response.headers.get('set-cookie');

      expect(setCookieHeader).toContain('Secure');

      process.env.NODE_ENV = originalEnv;
    });

    it('should match state in cookie and URL', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const response = await GET(req);

      const location = response.headers.get('location');
      const urlState = new URL(location!).searchParams.get('state');

      const setCookieHeader = response.headers.get('set-cookie');
      const cookieState = setCookieHeader!.match(/oauth_state=([^;]+)/)?.[1];

      expect(urlState).toBe(cookieState);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 if config is invalid', async () => {
      // Temporarily mock config to throw error
      const { cfg } = require('@/lib/config');
      cfg.mockImplementationOnce(() => {
        throw new Error('Missing WHOOP_CLIENT_ID');
      });

      const req = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const response = await GET(req);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to initiate OAuth flow');
    });
  });

  describe('Redirect Behavior', () => {
    it('should return 302 redirect status', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const response = await GET(req);

      expect(response.status).toBe(302);
    });

    it('should include Location header', async () => {
      const req = mockRequest('http://localhost:3000/api/whoop/oauth/initiate');
      const response = await GET(req);

      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      expect(location).toContain('https://api.prod.whoop.com/oauth/oauth2/auth');
    });
  });
});
