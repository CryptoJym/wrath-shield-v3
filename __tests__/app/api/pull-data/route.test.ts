/**
 * Wrath Shield v3 - Pull Data API Route Tests
 *
 * Tests for POST /api/pull-data endpoint
 */

import { POST } from '@/app/api/pull-data/route';
import { NextRequest } from 'next/server';
import * as WhoopClient from '@/lib/WhoopClient';
import * as LimitlessClient from '@/lib/LimitlessClient';
import * as db from '@/lib/db/queries';

// Mock dependencies
jest.mock('@/lib/WhoopClient');
jest.mock('@/lib/LimitlessClient');
jest.mock('@/lib/db/queries');

describe('POST /api/pull-data - Successful Pulls', () => {
  const mockWhoopClient = {
    fetchCyclesForDb: jest.fn(),
    fetchRecoveriesForDb: jest.fn(),
    fetchSleepsForDb: jest.fn(),
  };

  const mockLimitlessClient = {
    syncNewLifelogs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (WhoopClient.getWhoopClient as jest.Mock).mockReturnValue(mockWhoopClient);
    (LimitlessClient.getLimitlessClient as jest.Mock).mockReturnValue(mockLimitlessClient);
  });

  it('should successfully pull all data sources', async () => {
    // Mock successful data fetches
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(3);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.whoop.cycles).toBe(1);
    expect(data.whoop.recoveries).toBe(1);
    expect(data.whoop.sleeps).toBe(1);
    expect(data.limitless.lifelogs).toBe(3);
    expect(data.errors).toEqual([]);

    // Verify all clients were called
    expect(mockWhoopClient.fetchCyclesForDb).toHaveBeenCalledWith('2025-01-15', '2025-01-15');
    expect(mockWhoopClient.fetchRecoveriesForDb).toHaveBeenCalledWith('2025-01-15', '2025-01-15');
    expect(mockWhoopClient.fetchSleepsForDb).toHaveBeenCalledWith('2025-01-15', '2025-01-15');
    expect(mockLimitlessClient.syncNewLifelogs).toHaveBeenCalled();

    // Verify database inserts were called
    expect(db.insertCycles).toHaveBeenCalledWith([{ id: 1, date: '2025-01-15', raw_json: '{}' }]);
    expect(db.insertRecoveries).toHaveBeenCalledWith([{ id: 1, date: '2025-01-15', raw_json: '{}' }]);
    expect(db.insertSleeps).toHaveBeenCalledWith([{ id: 1, date: '2025-01-15', raw_json: '{}' }]);
  });

  it('should default to today when no targetDate provided', async () => {
    // Mock empty results
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    // Empty results with no errors = 200 (successful API calls, just no data)
    expect(response.status).toBe(200);
    expect(data.success).toBe(true); // No errors occurred
    expect(data.errors).toEqual([]);

    // Verify it used today's date (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];
    expect(mockWhoopClient.fetchCyclesForDb).toHaveBeenCalledWith(today, today);
  });

  it('should handle empty results gracefully', async () => {
    // Mock empty results
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    // Empty results with no errors = 200 (successful API calls)
    expect(response.status).toBe(200);
    expect(data.success).toBe(true); // No errors occurred
    expect(data.whoop.cycles).toBe(0);
    expect(data.whoop.recoveries).toBe(0);
    expect(data.whoop.sleeps).toBe(0);
    expect(data.limitless.lifelogs).toBe(0);
    expect(data.errors).toEqual([]);

    // Verify inserts were NOT called with empty arrays
    expect(db.insertCycles).not.toHaveBeenCalled();
    expect(db.insertRecoveries).not.toHaveBeenCalled();
    expect(db.insertSleeps).not.toHaveBeenCalled();
  });

  it('should handle malformed JSON body by defaulting to today', async () => {
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    }) as NextRequest;

    const response = await POST(request);

    // Should not crash - defaults to today, empty results with no errors = 200
    expect(response.status).toBe(200);
    const today = new Date().toISOString().split('T')[0];
    expect(mockWhoopClient.fetchCyclesForDb).toHaveBeenCalledWith(today, today);
  });
});

describe('POST /api/pull-data - Partial Failures', () => {
  const mockWhoopClient = {
    fetchCyclesForDb: jest.fn(),
    fetchRecoveriesForDb: jest.fn(),
    fetchSleepsForDb: jest.fn(),
  };

  const mockLimitlessClient = {
    syncNewLifelogs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (WhoopClient.getWhoopClient as jest.Mock).mockReturnValue(mockWhoopClient);
    (LimitlessClient.getLimitlessClient as jest.Mock).mockReturnValue(mockLimitlessClient);
  });

  it('should return 200 when WHOOP succeeds but Limitless fails', async () => {
    // WHOOP succeeds
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);

    // Limitless fails
    mockLimitlessClient.syncNewLifelogs.mockRejectedValue(new Error('API key not configured'));

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200); // Partial success
    expect(data.success).toBe(true); // Some data was fetched
    expect(data.whoop.cycles).toBe(1);
    expect(data.limitless.lifelogs).toBe(0);
    expect(data.errors).toContain('Limitless: API key not configured');
  });

  it('should return 200 when Limitless succeeds but WHOOP fails', async () => {
    // WHOOP fails
    mockWhoopClient.fetchCyclesForDb.mockRejectedValue(new Error('Token expired'));
    mockWhoopClient.fetchRecoveriesForDb.mockRejectedValue(new Error('Token expired'));
    mockWhoopClient.fetchSleepsForDb.mockRejectedValue(new Error('Token expired'));

    // Limitless succeeds
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(2);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200); // Partial success
    expect(data.success).toBe(true); // Some data was fetched
    expect(data.whoop.cycles).toBe(0);
    expect(data.limitless.lifelogs).toBe(2);
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.errors.some((e: string) => e.includes('Token expired'))).toBe(true);
  });

  it('should return 200 when only some WHOOP endpoints succeed', async () => {
    // Cycles succeeds
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    // Recoveries fails
    mockWhoopClient.fetchRecoveriesForDb.mockRejectedValue(new Error('Rate limit exceeded'));
    // Sleeps succeeds
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    // Limitless fails
    mockLimitlessClient.syncNewLifelogs.mockRejectedValue(new Error('Network error'));

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200); // Partial success
    expect(data.success).toBe(true); // Some data was fetched
    expect(data.whoop.cycles).toBe(1);
    expect(data.whoop.recoveries).toBe(0);
    expect(data.whoop.sleeps).toBe(1);
    expect(data.limitless.lifelogs).toBe(0);
    expect(data.errors).toContain('WHOOP recoveries: Rate limit exceeded');
    expect(data.errors).toContain('Limitless: Network error');
  });

  it('should return 500 when all endpoints fail', async () => {
    // All WHOOP endpoints fail
    mockWhoopClient.fetchCyclesForDb.mockRejectedValue(new Error('Auth failed'));
    mockWhoopClient.fetchRecoveriesForDb.mockRejectedValue(new Error('Auth failed'));
    mockWhoopClient.fetchSleepsForDb.mockRejectedValue(new Error('Auth failed'));

    // Limitless fails
    mockLimitlessClient.syncNewLifelogs.mockRejectedValue(new Error('API key missing'));

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500); // Total failure
    expect(data.success).toBe(false); // No data fetched
    expect(data.whoop.cycles).toBe(0);
    expect(data.whoop.recoveries).toBe(0);
    expect(data.whoop.sleeps).toBe(0);
    expect(data.limitless.lifelogs).toBe(0);
    expect(data.errors.length).toBeGreaterThan(0);
  });
});

describe('POST /api/pull-data - Validation', () => {
  const mockWhoopClient = {
    fetchCyclesForDb: jest.fn(),
    fetchRecoveriesForDb: jest.fn(),
    fetchSleepsForDb: jest.fn(),
  };

  const mockLimitlessClient = {
    syncNewLifelogs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (WhoopClient.getWhoopClient as jest.Mock).mockReturnValue(mockWhoopClient);
    (LimitlessClient.getLimitlessClient as jest.Mock).mockReturnValue(mockLimitlessClient);
  });

  it('should reject invalid date format (missing dashes)', async () => {
    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '20250115' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.errors).toContain('Invalid date format. Expected YYYY-MM-DD.');

    // Verify clients were NOT called
    expect(mockWhoopClient.fetchCyclesForDb).not.toHaveBeenCalled();
    expect(mockLimitlessClient.syncNewLifelogs).not.toHaveBeenCalled();
  });

  it('should reject invalid date format (wrong separators)', async () => {
    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025/01/15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toContain('Invalid date format. Expected YYYY-MM-DD.');
  });

  it('should reject invalid date format (text)', async () => {
    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: 'January 15, 2025' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toContain('Invalid date format. Expected YYYY-MM-DD.');
  });
});

describe('POST /api/pull-data - Error Handling', () => {
  const mockWhoopClient = {
    fetchCyclesForDb: jest.fn(),
    fetchRecoveriesForDb: jest.fn(),
    fetchSleepsForDb: jest.fn(),
  };

  const mockLimitlessClient = {
    syncNewLifelogs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle WHOOP authentication failure gracefully', async () => {
    // Simulate getWhoopClient() throwing due to missing token
    (WhoopClient.getWhoopClient as jest.Mock).mockImplementation(() => {
      throw new Error('No WHOOP access token found');
    });

    (LimitlessClient.getLimitlessClient as jest.Mock).mockReturnValue(mockLimitlessClient);
    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(1);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200); // Limitless succeeded
    expect(data.success).toBe(true); // Partial success
    expect(data.whoop.cycles).toBe(0);
    expect(data.limitless.lifelogs).toBe(1);
    expect(data.errors).toContain('WHOOP authentication: No WHOOP access token found');
  });

  it('should handle Limitless API key not configured', async () => {
    (WhoopClient.getWhoopClient as jest.Mock).mockReturnValue(mockWhoopClient);
    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);

    // Simulate Limitless client throwing due to missing API key
    (LimitlessClient.getLimitlessClient as jest.Mock).mockReturnValue(mockLimitlessClient);
    mockLimitlessClient.syncNewLifelogs.mockRejectedValue(
      new Error('No Limitless API key found. Configure via POST /api/settings first.')
    );

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200); // WHOOP succeeded
    expect(data.success).toBe(true); // Partial success
    expect(data.whoop.cycles).toBe(1);
    expect(data.limitless.lifelogs).toBe(0);
    expect(data.errors.some((e: string) => e.includes('No Limitless API key found'))).toBe(true);
  });

  it('should handle database insert failures gracefully', async () => {
    (WhoopClient.getWhoopClient as jest.Mock).mockReturnValue(mockWhoopClient);
    (LimitlessClient.getLimitlessClient as jest.Mock).mockReturnValue(mockLimitlessClient);

    mockWhoopClient.fetchCyclesForDb.mockResolvedValue([
      { id: 1, date: '2025-01-15', raw_json: '{}' },
    ]);
    mockWhoopClient.fetchRecoveriesForDb.mockResolvedValue([]);
    mockWhoopClient.fetchSleepsForDb.mockResolvedValue([]);

    // Mock database insert throwing error
    (db.insertCycles as jest.Mock).mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    mockLimitlessClient.syncNewLifelogs.mockResolvedValue(0);

    const request = new Request('http://localhost:3000/api/pull-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate: '2025-01-15' }),
    }) as NextRequest;

    const response = await POST(request);
    const data = await response.json();

    // Database error caught at WHOOP cycles level, not top level
    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.errors).toContain('WHOOP cycles: Database connection failed');
  });
});
