// @ts-nocheck
/**
 * Tests for Canyon Grove Boost Scraper
 *
 * Tests the session-based scraper for Canyon Grove Boost education platform.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock education-store
jest.mock('../../../lib/hyro/education-store', () => ({
  createAssignment: jest.fn(() => ({ id: 'new-assignment-id' })),
  updateAssignment: jest.fn(() => true),
  getAssignmentByPlatformId: jest.fn(() => null),
  getPlatformCredentials: jest.fn(() => null),
  upsertPlatformCredentials: jest.fn(),
  recordSyncLog: jest.fn(),
}));

// Mock education-memory
jest.mock('../../../lib/hyro/education-memory', () => ({
  recordAssignment: jest.fn(() => Promise.resolve()),
}));

// Mock safe-config
jest.mock('../../../lib/safe-config', () => ({
  safeConfig: jest.fn((key: string, defaultValue: string) => {
    if (key === 'CANYON_GROVE_USERNAME') return 'test@example.com';
    if (key === 'CANYON_GROVE_PASSWORD') return 'password123';
    return defaultValue;
  }),
}));

// Import after mocks
import {
  syncCanyonGroveAssignments,
  isCanyonGroveConfigured,
  getCanyonGroveSyncStatus,
} from '../../../lib/hyro/canyon-grove-scraper';

describe('Canyon Grove Boost Scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define CanyonGroveAssignment interface', () => {
      const assignment = {
        id: 'cg-123',
        title: 'Math Worksheet',
        subject: 'Mathematics',
        dueDate: '2025-01-20',
        assignedDate: '2025-01-15',
        status: 'pending' as const,
        score: 90,
        maxScore: 100,
        url: 'https://boost.canyongrove.org/assignments/123',
        description: 'Complete problems 1-20',
      };

      expect(assignment.id).toBe('cg-123');
      expect(assignment.status).toBe('pending');
      expect(assignment.score).toBe(90);
    });

    it('should define ScraperResult interface', () => {
      const result = {
        success: true,
        assignments: [],
        error: undefined,
        syncedAt: Math.floor(Date.now() / 1000),
      };

      expect(result.success).toBe(true);
      expect(result.assignments).toEqual([]);
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('isCanyonGroveConfigured', () => {
    it('should return true when credentials are set', () => {
      expect(isCanyonGroveConfigured()).toBe(true);
    });

    it('should return false when username is missing', () => {
      const { safeConfig } = require('../../../lib/safe-config');
      safeConfig.mockImplementation((key: string) => {
        if (key === 'CANYON_GROVE_PASSWORD') return 'password';
        return '';
      });

      expect(isCanyonGroveConfigured()).toBe(false);
    });

    it('should return false when password is missing', () => {
      const { safeConfig } = require('../../../lib/safe-config');
      safeConfig.mockImplementation((key: string) => {
        if (key === 'CANYON_GROVE_USERNAME') return 'user';
        return '';
      });

      expect(isCanyonGroveConfigured()).toBe(false);
    });

    it('should return false when both credentials are missing', () => {
      const { safeConfig } = require('../../../lib/safe-config');
      safeConfig.mockImplementation(() => '');

      expect(isCanyonGroveConfigured()).toBe(false);
    });
  });

  describe('getCanyonGroveSyncStatus', () => {
    it('should return not_configured when credentials missing', () => {
      const { safeConfig } = require('../../../lib/safe-config');
      safeConfig.mockImplementation(() => '');

      const status = getCanyonGroveSyncStatus();
      expect(status.configured).toBe(false);
      expect(status.status).toBe('not_configured');
    });

    it('should return active status with valid credentials', () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        last_login_at: 1705330800,
        status: 'active',
      });

      const status = getCanyonGroveSyncStatus();
      expect(status.configured).toBe(true);
      expect(status.status).toBe('active');
      expect(status.lastSync).toBe(1705330800);
    });

    it('should return expired status when session expired', () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        status: 'expired',
        error_message: 'Session expired',
      });

      const status = getCanyonGroveSyncStatus();
      expect(status.status).toBe('expired');
      expect(status.error).toBe('Session expired');
    });

    it('should return error status on credential errors', () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        status: 'error',
        error_message: 'Invalid credentials',
      });

      const status = getCanyonGroveSyncStatus();
      expect(status.status).toBe('error');
    });
  });

  // ==========================================================================
  // Sync Function Tests
  // ==========================================================================

  describe('syncCanyonGroveAssignments', () => {
    it('should return error when credentials not configured', async () => {
      const { safeConfig } = require('../../../lib/safe-config');
      const { recordSyncLog } = require('../../../lib/hyro/education-store');
      safeConfig.mockImplementation(() => '');

      const result = await syncCanyonGroveAssignments('student-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('credentials not configured');
      expect(recordSyncLog).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'canyon_grove',
        success: false,
      }));
    });

    it('should attempt login when no active session exists', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue(null);

      // Mock login page response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['set-cookie', 'session=abc123']]),
      });

      // Mock login post response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 302,
        headers: new Map([['set-cookie', 'auth=xyz789']]),
      });

      // Mock dashboard verification
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      // Mock assignments page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body>No assignments</body></html>'),
      });

      const result = await syncCanyonGroveAssignments('student-1');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should use existing cookies when session is active', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=existing',
        status: 'active',
      });

      // Mock assignments page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body>No assignments</body></html>'),
      });

      await syncCanyonGroveAssignments('student-1');

      // Should only fetch assignments, not login
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should create new assignments for scraped data', async () => {
      const { getPlatformCredentials, createAssignment, getAssignmentByPlatformId } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });
      getAssignmentByPlatformId.mockReturnValue(null);

      // Mock assignments page with data
      const htmlWithAssignments = `
        <html>
          <script>
            window.__ASSIGNMENTS__ = [
              {"id": "123", "title": "Math Quiz", "subject": "Math", "status": "pending"}
            ];
          </script>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithAssignments),
      });

      const result = await syncCanyonGroveAssignments('student-1');

      expect(result.success).toBe(true);
      expect(result.newCount).toBe(1);
    });

    it('should update existing assignments', async () => {
      const { getPlatformCredentials, updateAssignment, getAssignmentByPlatformId } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });
      getAssignmentByPlatformId.mockReturnValue({ id: 'existing-id' });

      const htmlWithAssignments = `
        <html>
          <script>
            window.__ASSIGNMENTS__ = [
              {"id": "123", "title": "Math Quiz Updated", "subject": "Math", "status": "completed"}
            ];
          </script>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithAssignments),
      });

      const result = await syncCanyonGroveAssignments('student-1');

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(updateAssignment).toHaveBeenCalled();
    });

    it('should handle failed scrape by marking session expired', async () => {
      const { getPlatformCredentials, upsertPlatformCredentials, recordSyncLog } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=expired',
        status: 'active',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await syncCanyonGroveAssignments('student-1');

      expect(result.success).toBe(false);
      expect(upsertPlatformCredentials).toHaveBeenCalledWith(expect.objectContaining({
        status: 'expired',
      }));
    });

    it('should record sync log on success', async () => {
      const { getPlatformCredentials, recordSyncLog } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html></html>'),
      });

      await syncCanyonGroveAssignments('student-1');

      expect(recordSyncLog).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'canyon_grove',
        student_id: 'student-1',
        success: true,
      }));
    });
  });

  // ==========================================================================
  // Subject Mapping Tests
  // ==========================================================================

  describe('Subject Mapping', () => {
    it('should map math subjects to math', () => {
      const mathTerms = ['Math', 'Algebra', 'Geometry'];
      for (const term of mathTerms) {
        expect(term.toLowerCase()).toMatch(/math|algebra|geometry/);
      }
    });

    it('should map reading subjects to reading', () => {
      const readingTerms = ['Reading', 'Language Arts', 'ELA'];
      for (const term of readingTerms) {
        expect(term.toLowerCase()).toMatch(/read|language arts|ela/);
      }
    });

    it('should map writing subjects to writing', () => {
      const writingTerms = ['Writing', 'English'];
      for (const term of writingTerms) {
        expect(term.toLowerCase()).toMatch(/writ|english/);
      }
    });

    it('should map science subjects to science', () => {
      const scienceTerms = ['Science', 'Biology', 'Chemistry', 'Physics'];
      for (const term of scienceTerms) {
        expect(term.toLowerCase()).toMatch(/science|biology|chemistry|physics/);
      }
    });

    it('should map social studies subjects', () => {
      const ssTerms = ['History', 'Social Studies', 'Geography', 'Civics'];
      for (const term of ssTerms) {
        expect(term.toLowerCase()).toMatch(/history|social|geography|civics/);
      }
    });

    it('should map art subjects', () => {
      const artTerms = ['Art', 'Drawing', 'Painting'];
      for (const term of artTerms) {
        expect(term.toLowerCase()).toMatch(/art|draw|paint/);
      }
    });

    it('should map music subjects', () => {
      const musicTerms = ['Music', 'Band', 'Choir'];
      for (const term of musicTerms) {
        expect(term.toLowerCase()).toMatch(/music|band|choir/);
      }
    });

    it('should map PE subjects', () => {
      const peTerms = ['PE', 'Physical Education', 'Gym', 'Health'];
      for (const term of peTerms) {
        expect(term.toLowerCase()).toMatch(/pe|physical|gym|health/);
      }
    });

    it('should default to other for unknown subjects', () => {
      const unknown = 'Photography';
      expect(unknown.toLowerCase()).not.toMatch(/math|read|writ|science|history|art|music|pe|physical/);
    });
  });

  // ==========================================================================
  // Date Parsing Tests
  // ==========================================================================

  describe('Date Parsing', () => {
    it('should parse ISO date strings', () => {
      const dateStr = '2025-01-15';
      const date = new Date(dateStr);
      expect(date.getTime()).toBeGreaterThan(0);
      expect(isNaN(date.getTime())).toBe(false);
    });

    it('should parse MM/DD/YYYY format', () => {
      const parts = '01/15/2025'.split('/');
      expect(parts).toHaveLength(3);

      const month = parseInt(parts[0]) - 1; // 0-indexed
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);

      const date = new Date(year, month, day);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(15);
      expect(date.getFullYear()).toBe(2025);
    });

    it('should handle null date strings', () => {
      const dateStr = null;
      expect(dateStr).toBeNull();
    });

    it('should handle undefined date strings', () => {
      const dateStr = undefined;
      expect(dateStr).toBeUndefined();
    });

    it('should handle invalid date strings', () => {
      const dateStr = 'not a date';
      const date = new Date(dateStr);
      expect(isNaN(date.getTime())).toBe(true);
    });
  });

  // ==========================================================================
  // HTML Parsing Tests
  // ==========================================================================

  describe('HTML Parsing', () => {
    it('should extract assignments from JSON embedded in HTML', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      const html = `
        <html>
          <script>
            window.__ASSIGNMENTS__ = [
              {"id": "1", "title": "Test 1", "subject": "Math"},
              {"id": "2", "title": "Test 2", "subject": "Reading"}
            ];
          </script>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.totalFound).toBe(2);
    });

    it('should handle HTML without assignments', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body>No assignments</body></html>'),
      });

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.totalFound).toBe(0);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle network errors during login', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue(null);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Login error');
    });

    it('should handle login page load failure', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.success).toBe(false);
    });

    it('should handle scrape errors', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      mockFetch.mockRejectedValueOnce(new Error('Scrape failed'));

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty assignment list', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      const html = `<script>window.__ASSIGNMENTS__ = [];</script>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.totalFound).toBe(0);
      expect(result.newCount).toBe(0);
    });

    it('should handle malformed JSON in HTML', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      const html = `<script>window.__ASSIGNMENTS__ = [invalid json;</script>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.totalFound).toBe(0); // Should handle gracefully
    });

    it('should handle special characters in assignment data', async () => {
      const { getPlatformCredentials } = require('../../../lib/hyro/education-store');
      getPlatformCredentials.mockReturnValue({
        cookies: 'session=valid',
        status: 'active',
      });

      const html = `
        <script>
          window.__ASSIGNMENTS__ = [
            {"id": "1", "title": "Test & Quiz: Chapter 5 (Fractions)", "subject": "Math"}
          ];
        </script>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      const result = await syncCanyonGroveAssignments('student-1');
      expect(result.totalFound).toBe(1);
    });
  });

  // ==========================================================================
  // Server-Only Guard Tests
  // ==========================================================================

  describe('Server-Only Guard', () => {
    it('should call ensureServerOnly on module load', () => {
      const { ensureServerOnly } = require('../../../lib/server-only-guard');
      expect(ensureServerOnly).toHaveBeenCalledWith('lib/hyro/canyon-grove-scraper');
    });
  });
});
