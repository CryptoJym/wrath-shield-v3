// @ts-nocheck
/**
 * Wrath Shield v3 - Legal Sync Tests
 *
 * Tests for syncing from external legal advocate database:
 * - SyncStats type
 * - syncFromLegalAdvocate function
 * - Database file detection
 * - Error handling for missing tables
 */

// Mock fs module
const mockExistsSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

// Mock os module
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/Users/testuser'),
}));

// Mock better-sqlite3
const mockPrepare = jest.fn();
const mockAll = jest.fn();
const mockClose = jest.fn();
const mockDbInstance = {
  prepare: mockPrepare,
  close: mockClose,
};

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => mockDbInstance);
});

// Mock the store module
const mockCreateLegalContextRequestIfMissing = jest.fn();
jest.mock('@/lib/legal/store', () => ({
  createLegalContextRequestIfMissing: mockCreateLegalContextRequestIfMissing,
}));

import { syncFromLegalAdvocate } from '@/lib/legal/sync';
import BetterSqlite3 from 'better-sqlite3';

describe('Legal Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepare.mockReturnValue({ all: mockAll });
    mockAll.mockReturnValue([]);
    mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: false, request: {} });
  });

  describe('SyncStats type', () => {
    it('should return object with created, skipped, and source', () => {
      mockExistsSync.mockReturnValue(false);

      const result = syncFromLegalAdvocate();

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('source');
    });
  });

  describe('syncFromLegalAdvocate', () => {
    it('should return early if database file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = syncFromLegalAdvocate();

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.source).toBeTruthy();
      expect(BetterSqlite3).not.toHaveBeenCalled();
    });

    it('should use environment variable path when set', () => {
      const originalEnv = process.env.LEGAL_AI_DB_PATH;
      process.env.LEGAL_AI_DB_PATH = '/custom/path/to/db.sqlite';
      mockExistsSync.mockReturnValue(false);

      const result = syncFromLegalAdvocate();

      expect(result.source).toBe('/custom/path/to/db.sqlite');

      process.env.LEGAL_AI_DB_PATH = originalEnv;
    });

    it('should open database when file exists', () => {
      mockExistsSync.mockReturnValue(true);

      syncFromLegalAdvocate();

      expect(BetterSqlite3).toHaveBeenCalledWith(
        expect.any(String),
        { fileMustExist: true }
      );
    });

    it('should close database after sync', () => {
      mockExistsSync.mockReturnValue(true);

      syncFromLegalAdvocate();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should process requests table', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([
        {
          what_is_needed: 'Review contract',
          requested_by: 'Client A',
          deadline: '2025-02-01',
          requested_date: '2025-01-15',
        },
      ]).mockReturnValue([]); // Empty for deadlines table

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledWith({
        user_id: 'default',
        contact: 'Client A',
        topic: 'Attorney request',
        source: 'action_items.requests',
        summary: 'Review contract',
        due_date: '2025-02-01',
      });
      expect(result.created).toBe(1);
    });

    it('should process deadlines table', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([]).mockReturnValueOnce([
        {
          action_required: 'File motion',
          deadline_date: '2025-03-15',
          responsible_party: 'Attorney B',
        },
      ]);

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledWith({
        user_id: 'default',
        contact: 'Attorney B',
        topic: 'Deadline',
        source: 'action_items.deadlines',
        summary: 'File motion',
        due_date: '2025-03-15',
      });
      expect(result.created).toBe(1);
    });

    it('should use provided userId', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([
        {
          what_is_needed: 'Test request',
          requested_by: null,
          deadline: null,
        },
      ]).mockReturnValue([]);

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      syncFromLegalAdvocate('user-123');

      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
        })
      );
    });

    it('should count created vs skipped items', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([
        { what_is_needed: 'Request 1', requested_by: null, deadline: null },
        { what_is_needed: 'Request 2', requested_by: null, deadline: null },
        { what_is_needed: 'Request 3', requested_by: null, deadline: null },
      ]).mockReturnValue([]);

      mockCreateLegalContextRequestIfMissing
        .mockReturnValueOnce({ created: true, request: {} })
        .mockReturnValueOnce({ created: false, request: {} }) // Duplicate
        .mockReturnValueOnce({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('should handle empty tables', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValue([]);

      const result = syncFromLegalAdvocate();

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should handle null values in rows', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([
        {
          what_is_needed: null,
          requested_by: null,
          deadline: null,
        },
      ]).mockReturnValue([]);

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledWith({
        user_id: 'default',
        contact: null,
        topic: 'Attorney request',
        source: 'action_items.requests',
        summary: '',
        due_date: null,
      });
    });

    it('should handle missing requests table gracefully', () => {
      mockExistsSync.mockReturnValue(true);

      // First call (requests table) throws, second (deadlines) returns data
      mockPrepare
        .mockImplementationOnce(() => {
          throw new Error('no such table: requests');
        })
        .mockReturnValue({ all: jest.fn().mockReturnValue([
          { action_required: 'Deadline item', deadline_date: '2025-04-01', responsible_party: null },
        ])});

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      // Should still process deadlines even if requests fails
      expect(result.created).toBe(1);
    });

    it('should handle missing deadlines table gracefully', () => {
      mockExistsSync.mockReturnValue(true);

      // First call (requests) returns data, second (deadlines) throws
      let callCount = 0;
      mockPrepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            all: jest.fn().mockReturnValue([
              { what_is_needed: 'Request item', requested_by: null, deadline: null },
            ]),
          };
        }
        throw new Error('no such table: deadlines');
      });

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      // Should still have processed requests even if deadlines fails
      expect(result.created).toBe(1);
    });

    it('should process both tables when both exist', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll
        .mockReturnValueOnce([
          { what_is_needed: 'Request A', requested_by: 'Contact A', deadline: '2025-05-01' },
          { what_is_needed: 'Request B', requested_by: 'Contact B', deadline: '2025-05-15' },
        ])
        .mockReturnValueOnce([
          { action_required: 'Deadline X', deadline_date: '2025-06-01', responsible_party: 'Party X' },
        ]);

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      expect(result.created).toBe(3);
    });
  });

  describe('Database Path Resolution', () => {
    it('should check monorepo path first', () => {
      // The module checks monorepo path first, then home directory
      mockExistsSync.mockReturnValue(false);

      syncFromLegalAdvocate();

      // First call should be for monorepo path
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('should use home directory path as fallback', () => {
      mockExistsSync.mockReturnValue(false);

      const result = syncFromLegalAdvocate();

      // Result source should contain path
      expect(result.source).toBeTruthy();
    });
  });

  describe('Query Structure', () => {
    it('should query requests table with correct columns', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValue([]);

      syncFromLegalAdvocate();

      // Verify prepare was called with query containing expected columns
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('what_is_needed')
      );
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('requested_by')
      );
    });

    it('should query deadlines table with correct columns', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValue([]);

      syncFromLegalAdvocate();

      // Verify prepare was called with query containing expected columns
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('action_required')
      );
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('deadline_date')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle many rows efficiently', () => {
      mockExistsSync.mockReturnValue(true);

      // Generate many rows
      const manyRows = Array.from({ length: 100 }, (_, i) => ({
        what_is_needed: `Request ${i}`,
        requested_by: `Contact ${i}`,
        deadline: `2025-0${(i % 9) + 1}-01`,
      }));

      mockAll.mockReturnValueOnce(manyRows).mockReturnValue([]);
      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      const result = syncFromLegalAdvocate();

      expect(result.created).toBe(100);
      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledTimes(100);
    });

    it('should handle special characters in data', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([
        {
          what_is_needed: 'Review "special" <chars> & symbols',
          requested_by: "O'Connor & Associates",
          deadline: '2025-07-01',
        },
      ]).mockReturnValue([]);

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      syncFromLegalAdvocate();

      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'Review "special" <chars> & symbols',
          contact: "O'Connor & Associates",
        })
      );
    });

    it('should handle empty string values', () => {
      mockExistsSync.mockReturnValue(true);
      mockAll.mockReturnValueOnce([
        {
          what_is_needed: '',
          requested_by: '',
          deadline: '',
        },
      ]).mockReturnValue([]);

      mockCreateLegalContextRequestIfMissing.mockReturnValue({ created: true, request: {} });

      syncFromLegalAdvocate();

      expect(mockCreateLegalContextRequestIfMissing).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: '',
          contact: '',
          due_date: '',
        })
      );
    });
  });
});
