/**
 * Wrath Shield v3 - Settings API Route Tests
 *
 * Tests for POST /api/settings and GET /api/settings endpoints
 */

import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import * as crypto from '@/lib/crypto';
import * as db from '@/lib/db/queries';

// Mock dependencies with explicit factory functions
jest.mock('@/lib/crypto', () => ({
  encryptData: jest.fn(),
  decryptData: jest.fn(),
}));

jest.mock('@/lib/db/queries', () => ({
  insertSettings: jest.fn(),
  getSetting: jest.fn(),
}));

// Mock httpsRequest for proxy support
jest.mock('@/lib/https-proxy-request', () => ({
  httpsRequest: jest.fn(),
}));

import { httpsRequest } from '@/lib/https-proxy-request';

describe('POST /api/settings - Limitless API Key', () => {
  const mockEncryptData = crypto.encryptData as jest.MockedFunction<typeof crypto.encryptData>;
  const mockInsertSettings = db.insertSettings as jest.MockedFunction<typeof db.insertSettings>;
  const mockHttpsRequest = httpsRequest as jest.MockedFunction<typeof httpsRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpsRequest.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should accept valid Limitless API key and store encrypted', async () => {
    // Mock successful API key validation (200) with new httpsRequest
    mockHttpsRequest.mockResolvedValueOnce({
      status: 200,
      data: JSON.stringify({ data: { lifelogs: [] }, meta: {} }),
    });

    // Mock encryption
    mockEncryptData.mockReturnValue('encrypted_key_data');

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'test_valid_key',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('limitless API key validated and stored successfully');

    // Verify API key was validated with correct header (X-API-Key, not Authorization Bearer)
    expect(mockHttpsRequest).toHaveBeenCalledWith(
      'https://api.limitless.ai/v1/lifelogs?limit=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'test_valid_key',
        }),
      })
    );

    // Verify encryption was called
    expect(mockEncryptData).toHaveBeenCalledWith('test_valid_key');

    // Verify database storage
    expect(mockInsertSettings).toHaveBeenCalledWith([
      {
        key: 'limitless_api_key',
        value_enc: 'encrypted_key_data',
      },
    ]);
  });

  it('should accept valid Limitless API key with 204 response', async () => {
    // Mock successful API key validation (204 No Content)
    mockHttpsRequest.mockResolvedValueOnce({
      ok: false,
      status: 204,
    });

    mockEncryptData.mockReturnValue('encrypted_key_data');

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'test_valid_key_204',
      }),
    }) as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockEncryptData).toHaveBeenCalled();
    expect(mockInsertSettings).toHaveBeenCalled();
  });

  it('should reject invalid Limitless API key (401)', async () => {
    // Mock failed API key validation (401 Unauthorized)
    mockHttpsRequest.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'test_invalid_key',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Invalid Limitless API key');

    // Verify encryption and storage were NOT called
    expect(mockEncryptData).not.toHaveBeenCalled();
    expect(mockInsertSettings).not.toHaveBeenCalled();
  });

  it('should reject invalid Limitless API key (403)', async () => {
    // Mock failed API key validation (403 Forbidden)
    mockHttpsRequest.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'test_forbidden_key',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Invalid Limitless API key');

    // Verify encryption and storage were NOT called
    expect(mockEncryptData).not.toHaveBeenCalled();
    expect(mockInsertSettings).not.toHaveBeenCalled();
  });

  it('should reject request with missing provider', async () => {
    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'test_key',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should reject request with missing key', async () => {
    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should reject unsupported provider', async () => {
    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'unsupported_provider',
        key: 'test_key',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Unsupported provider');
    expect(data.error).toContain('limitless');
  });

  it('should handle network errors during validation gracefully', async () => {
    // Mock network error
    mockHttpsRequest.mockRejectedValueOnce(new Error('Network error'));

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'test_key_network_error',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Invalid Limitless API key');

    // Verify encryption and storage were NOT called
    expect(mockEncryptData).not.toHaveBeenCalled();
    expect(mockInsertSettings).not.toHaveBeenCalled();
  });

  it('should handle database errors and return 500', async () => {
    // Mock successful validation
    mockHttpsRequest.mockResolvedValueOnce({
      status: 200,
      data: JSON.stringify({ data: { lifelogs: [] }, meta: {} }),
    });

    mockEncryptData.mockReturnValue('encrypted_key_data');

    // Mock database error
    mockInsertSettings.mockImplementationOnce(() => {
      throw new Error('Database connection failed');
    });

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'test_key_db_error',
      }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });

  it('should not expose raw API key in error logs', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock failed validation
    mockHttpsRequest.mockResolvedValueOnce({
      status: 401,
      data: 'Unauthorized',
    });

    const request = new Request('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'limitless',
        key: 'secret_api_key_should_not_be_logged',
      }),
    }) as NextRequest;

    await POST(request);

    // Verify console.error was NOT called with the raw key
    const errorCalls = consoleErrorSpy.mock.calls.flat();
    const containsRawKey = errorCalls.some((call) =>
      String(call).includes('secret_api_key_should_not_be_logged')
    );

    expect(containsRawKey).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});

describe('GET /api/settings - Check Configuration', () => {
  const mockGetSetting = db.getSetting as jest.MockedFunction<typeof db.getSetting>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return configured=true when API key exists', () => {
    // Mock existing setting
    mockGetSetting.mockReturnValueOnce({
      key: 'limitless_api_key',
      value_enc: 'encrypted_data',
    });

    const request = new Request(
      'http://localhost:3000/api/settings?provider=limitless',
      {
        method: 'GET',
      }
    ) as NextRequest;

    const response = GET(request);

    response.then(async (res) => {
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.configured).toBe(true);
      expect(data.provider).toBe('limitless');

      // Verify database query was called
      expect(mockGetSetting).toHaveBeenCalledWith('limitless_api_key');

      // Verify encrypted value is NOT exposed
      expect(data).not.toHaveProperty('value_enc');
      expect(JSON.stringify(data)).not.toContain('encrypted_data');
    });
  });

  it('should return configured=false when API key does not exist', () => {
    // Mock no existing setting
    mockGetSetting.mockReturnValueOnce(undefined);

    const request = new Request(
      'http://localhost:3000/api/settings?provider=limitless',
      {
        method: 'GET',
      }
    ) as NextRequest;

    const response = GET(request);

    response.then(async (res) => {
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.configured).toBe(false);
      expect(data.provider).toBe('limitless');

      expect(mockGetSetting).toHaveBeenCalledWith('limitless_api_key');
    });
  });

  it('should return 400 when provider parameter is missing', () => {
    const request = new Request('http://localhost:3000/api/settings', {
      method: 'GET',
    }) as NextRequest;

    const response = GET(request);

    response.then(async (res) => {
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Missing provider parameter');
    });
  });

  it('should handle database errors and return 500', () => {
    // Mock database error
    mockGetSetting.mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    const request = new Request(
      'http://localhost:3000/api/settings?provider=limitless',
      {
        method: 'GET',
      }
    ) as NextRequest;

    const response = GET(request);

    response.then(async (res) => {
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });
});
