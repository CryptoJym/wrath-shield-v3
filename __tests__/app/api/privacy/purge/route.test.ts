/**
 * Tests for Privacy Purge API Route
 *
 * Verifies data purge operations for WHOOP and Limitless sources
 * including complete deletion and no residual data.
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/privacy/purge/route';

// Mock Database
const mockDatabase = {
  prepare: jest.fn(),
  transaction: jest.fn(),
};

// Mock statement results
const createMockStatement = (changes: number) => ({
  run: jest.fn().mockReturnValue({ changes }),
  get: jest.fn().mockReturnValue({ count: changes }),
});

jest.mock('@/lib/db/Database', () => ({
  Database: {
    getInstance: jest.fn(() => mockDatabase),
  },
}));

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('Privacy Purge API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST - Purge Operations', () => {
    it('should purge all WHOOP data', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'whoop' }),
      });

      // Mock DELETE statements
      const deleteCycles = createMockStatement(10);
      const deleteRecoveries = createMockStatement(10);
      const deleteSleeps = createMockStatement(10);
      const deleteTokens = createMockStatement(1);

      mockDatabase.prepare
        .mockReturnValueOnce(deleteCycles) // cycles
        .mockReturnValueOnce(deleteRecoveries) // recoveries
        .mockReturnValueOnce(deleteSleeps) // sleeps
        .mockReturnValueOnce(deleteTokens); // tokens

      // Mock transaction to execute immediately
      mockDatabase.transaction.mockImplementation((fn: () => void) => {
        return () => fn();
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('whoop');
      expect(data.deletedRecords).toBe(31); // 10 + 10 + 10 + 1

      // Verify correct SQL was prepared
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM cycles');
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM recoveries');
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM sleeps');
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM tokens WHERE provider = ?');

      // Verify delete was called
      expect(deleteTokens.run).toHaveBeenCalledWith('whoop');
    });

    it('should purge all Limitless data', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'limitless' }),
      });

      // Mock DELETE statements
      const deleteLifelogs = createMockStatement(50);
      const deleteSettings = createMockStatement(1);
      const deletePullTimestamp = createMockStatement(1);

      mockDatabase.prepare
        .mockReturnValueOnce(deleteLifelogs) // lifelogs
        .mockReturnValueOnce(deleteSettings) // api key
        .mockReturnValueOnce(deletePullTimestamp); // last pull timestamp

      mockDatabase.transaction.mockImplementation((fn: () => void) => {
        return () => fn();
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.source).toBe('limitless');
      expect(data.deletedRecords).toBe(52); // 50 + 1 + 1

      // Verify correct SQL was prepared
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM lifelogs');
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM settings WHERE key = ?');

      // Verify deletes were called with correct keys
      expect(deleteSettings.run).toHaveBeenCalledWith('limitless_api_key');
      expect(deletePullTimestamp.run).toHaveBeenCalledWith('limitless_last_pull');
    });

    it('should return 400 if source parameter is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required parameter: source');
    });

    it('should return 400 for invalid source', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'invalid' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid source');
    });

    it('should handle database errors gracefully', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'whoop' }),
      });

      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to purge data');
    });

    it('should use transactions to ensure atomic operations', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'whoop' }),
      });

      const deleteCycles = createMockStatement(5);
      const deleteRecoveries = createMockStatement(5);
      const deleteSleeps = createMockStatement(5);
      const deleteTokens = createMockStatement(1);

      mockDatabase.prepare
        .mockReturnValueOnce(deleteCycles)
        .mockReturnValueOnce(deleteRecoveries)
        .mockReturnValueOnce(deleteSleeps)
        .mockReturnValueOnce(deleteTokens);

      let transactionFn: (() => void) | null = null;
      mockDatabase.transaction.mockImplementation((fn: () => void) => {
        transactionFn = fn;
        return () => fn();
      });

      await POST(req);

      // Verify transaction was created
      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(transactionFn).not.toBeNull();
    });
  });

  describe('GET - Purge Status', () => {
    it('should return record count for WHOOP data', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge?source=whoop');

      // Mock COUNT statements
      mockDatabase.prepare
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 10 }) }) // cycles
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 10 }) }) // recoveries
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 10 }) }) // sleeps
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 1 }) }); // tokens

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe('whoop');
      expect(data.recordCount).toBe(31); // 10 + 10 + 10 + 1
      expect(data.hasData).toBe(true);
    });

    it('should return record count for Limitless data', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge?source=limitless');

      mockDatabase.prepare
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 50 }) }) // lifelogs
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 2 }) }); // settings

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe('limitless');
      expect(data.recordCount).toBe(52); // 50 + 2
      expect(data.hasData).toBe(true);
    });

    it('should return hasData=false when no records exist', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge?source=whoop');

      mockDatabase.prepare
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recordCount).toBe(0);
      expect(data.hasData).toBe(false);
    });

    it('should return 400 if source parameter is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge');

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required parameter: source');
    });

    it('should return 400 for invalid source', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge?source=invalid');

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid source');
    });

    it('should handle database errors gracefully', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge?source=whoop');

      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to get purge status');
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full purge lifecycle: check status -> purge -> verify empty', async () => {
      // Step 1: Check initial status
      const getReq = new NextRequest('http://localhost:3000/api/privacy/purge?source=whoop');

      mockDatabase.prepare
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 5 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 5 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 5 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 1 }) });

      const statusResponse1 = await GET(getReq);
      const statusData1 = await statusResponse1.json();

      expect(statusData1.recordCount).toBe(16);
      expect(statusData1.hasData).toBe(true);

      // Step 2: Perform purge
      const postReq = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'whoop' }),
      });

      const deleteCycles = createMockStatement(5);
      const deleteRecoveries = createMockStatement(5);
      const deleteSleeps = createMockStatement(5);
      const deleteTokens = createMockStatement(1);

      mockDatabase.prepare
        .mockReturnValueOnce(deleteCycles)
        .mockReturnValueOnce(deleteRecoveries)
        .mockReturnValueOnce(deleteSleeps)
        .mockReturnValueOnce(deleteTokens);

      mockDatabase.transaction.mockImplementation((fn: () => void) => {
        return () => fn();
      });

      const purgeResponse = await POST(postReq);
      const purgeData = await purgeResponse.json();

      expect(purgeData.success).toBe(true);
      expect(purgeData.deletedRecords).toBe(16);

      // Step 3: Verify empty
      const getReq2 = new NextRequest('http://localhost:3000/api/privacy/purge?source=whoop');

      mockDatabase.prepare
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) })
        .mockReturnValueOnce({ get: jest.fn().mockReturnValue({ count: 0 }) });

      const statusResponse2 = await GET(getReq2);
      const statusData2 = await statusResponse2.json();

      expect(statusData2.recordCount).toBe(0);
      expect(statusData2.hasData).toBe(false);
    });
  });

  describe('No Residual Data Verification', () => {
    it('should delete all related WHOOP records in single transaction', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'whoop' }),
      });

      const deleteCycles = createMockStatement(100);
      const deleteRecoveries = createMockStatement(100);
      const deleteSleeps = createMockStatement(100);
      const deleteTokens = createMockStatement(1);

      mockDatabase.prepare
        .mockReturnValueOnce(deleteCycles)
        .mockReturnValueOnce(deleteRecoveries)
        .mockReturnValueOnce(deleteSleeps)
        .mockReturnValueOnce(deleteTokens);

      mockDatabase.transaction.mockImplementation((fn: () => void) => {
        return () => fn();
      });

      const response = await POST(req);
      const data = await response.json();

      // Verify all 4 tables were targeted
      expect(mockDatabase.prepare).toHaveBeenCalledTimes(4);
      expect(data.deletedRecords).toBe(301);

      // Verify no partial deletes (all or nothing via transaction)
      expect(mockDatabase.transaction).toHaveBeenCalledTimes(1);
    });

    it('should delete all related Limitless records including settings', async () => {
      const req = new NextRequest('http://localhost:3000/api/privacy/purge', {
        method: 'POST',
        body: JSON.stringify({ source: 'limitless' }),
      });

      const deleteLifelogs = createMockStatement(200);
      const deleteSettings = createMockStatement(1);
      const deletePullTimestamp = createMockStatement(1);

      mockDatabase.prepare
        .mockReturnValueOnce(deleteLifelogs)
        .mockReturnValueOnce(deleteSettings)
        .mockReturnValueOnce(deletePullTimestamp);

      mockDatabase.transaction.mockImplementation((fn: () => void) => {
        return () => fn();
      });

      const response = await POST(req);
      const data = await response.json();

      // Verify lifelogs table + 2 settings were targeted
      expect(mockDatabase.prepare).toHaveBeenCalledTimes(3);
      expect(data.deletedRecords).toBe(202);

      // Verify settings keys are correct
      expect(deleteSettings.run).toHaveBeenCalledWith('limitless_api_key');
      expect(deletePullTimestamp.run).toHaveBeenCalledWith('limitless_last_pull');
    });
  });
});
