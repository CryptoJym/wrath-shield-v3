/**
 * Tests for https-proxy-request module
 *
 * CRITICAL: These tests ensure proxy tunneling continues to work
 * DO NOT modify without understanding the proxy requirements
 */

import { httpsRequest } from '@/lib/https-proxy-request';
import * as tunnel from 'tunnel';

// Disable server-only guard for testing
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock tunnel module
jest.mock('tunnel');

// Mock https module
jest.mock('https', () => ({
  request: jest.fn(),
}));

import * as https from 'https';

describe('https-proxy-request', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Proxy Detection', () => {
    it('should detect HTTPS_PROXY environment variable', async () => {
      process.env.HTTPS_PROXY =
        'http://proxy.example.com:8080';

      const mockAgent = {};
      (tunnel.httpsOverHttp as jest.Mock).mockReturnValue(mockAgent);

      // Mock https.request to immediately call callback with response
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('{"success":true}'));
          }
          if (event === 'end') {
            handler();
          }
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.example.com/test', {
        method: 'GET',
        headers: { 'X-Test': 'value' },
      });

      // Should create tunnel agent when proxy is set
      expect(tunnel.httpsOverHttp).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'proxy.example.com',
            port: 8080,
          }),
        })
      );
    });

    it('should use HTTP_PROXY as fallback', async () => {
      delete process.env.HTTPS_PROXY;
      process.env.HTTP_PROXY = 'http://fallback-proxy.example.com:3128';

      const mockAgent = {};
      (tunnel.httpsOverHttp as jest.Mock).mockReturnValue(mockAgent);

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.example.com/test');

      expect(tunnel.httpsOverHttp).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'fallback-proxy.example.com',
            port: 3128,
          }),
        })
      );
    });

    it('should NOT use proxy when no env vars set', async () => {
      delete process.env.HTTPS_PROXY;
      delete process.env.HTTP_PROXY;

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.example.com/test');

      // Should NOT create tunnel agent
      expect(tunnel.httpsOverHttp).not.toHaveBeenCalled();

      // Should make direct HTTPS request
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.example.com',
          port: 443,
          path: '/test',
        }),
        expect.any(Function)
      );
    });
  });

  describe('Proxy Authentication', () => {
    it('should include proxy auth when credentials in URL', async () => {
      process.env.HTTPS_PROXY =
        'http://user:pass@secure-proxy.example.com:8080';

      const mockAgent = {};
      (tunnel.httpsOverHttp as jest.Mock).mockReturnValue(mockAgent);

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.example.com/test');

      expect(tunnel.httpsOverHttp).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'secure-proxy.example.com',
            port: 8080,
            proxyAuth: 'user:pass',
          }),
        })
      );
    });

    it('should decode URL-encoded passwords', async () => {
      // Password contains special chars that get URL-encoded
      process.env.HTTPS_PROXY =
        'http://user:p%40ss%3Dw0rd@proxy.example.com:8080';

      const mockAgent = {};
      (tunnel.httpsOverHttp as jest.Mock).mockReturnValue(mockAgent);

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.example.com/test');

      expect(tunnel.httpsOverHttp).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            proxyAuth: 'user:p@ss=w0rd', // Decoded
          }),
        })
      );
    });
  });

  describe('Request Options', () => {
    it('should pass custom headers', async () => {
      delete process.env.HTTPS_PROXY;

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.example.com/test', {
        method: 'POST',
        headers: {
          'X-API-Key': 'test-key-123',
          'Content-Type': 'application/json',
        },
      });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-key-123',
            'Content-Type': 'application/json',
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('Response Handling', () => {
    it('should return status and data', async () => {
      delete process.env.HTTPS_PROXY;

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('{"result":"success"}'));
          }
          if (event === 'end') {
            handler();
          }
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const response = await httpsRequest('https://api.example.com/test');

      expect(response.status).toBe(200);
      expect(response.data).toBe('{"result":"success"}');
    });

    it('should handle chunked responses', async () => {
      delete process.env.HTTPS_PROXY;

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('{"chunk":'));
            handler(Buffer.from('"1"}'));
          }
          if (event === 'end') {
            handler();
          }
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const response = await httpsRequest('https://api.example.com/test');

      expect(response.data).toBe('{"chunk":"1"}');
    });

    it('should handle error responses', async () => {
      delete process.env.HTTPS_PROXY;

      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Connection refused'));
          }
          return mockRequest;
        }),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation(() => mockRequest);

      await expect(
        httpsRequest('https://api.example.com/test')
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('CRITICAL: Regression Prevention', () => {
    it('MUST use tunnel.httpsOverHttp when proxy is set', async () => {
      process.env.HTTPS_PROXY = 'http://critical-proxy.com:8080';

      const mockAgent = {};
      (tunnel.httpsOverHttp as jest.Mock).mockReturnValue(mockAgent);

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await httpsRequest('https://api.limitless.ai/v1/lifelogs?limit=100');

      // CRITICAL: Must create tunnel agent
      expect(tunnel.httpsOverHttp).toHaveBeenCalled();

      // CRITICAL: Must pass agent to https.request
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: mockAgent,
        }),
        expect.any(Function)
      );
    });

    it('MUST NOT revert to using fetch()', async () => {
      // This test will fail if someone reverts to using fetch()
      // The httpsRequest function must exist and be callable

      delete process.env.HTTPS_PROXY;

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'end') handler();
          return mockResponse;
        }),
      };

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      // Should be able to call httpsRequest (proves it exists)
      await expect(
        httpsRequest('https://api.example.com/test')
      ).resolves.toBeDefined();

      // Should have used https.request, not fetch
      expect(https.request).toHaveBeenCalled();
    });
  });
});
