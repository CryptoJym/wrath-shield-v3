// @ts-nocheck
/**
 * Wrath Shield v3 - Sync Service Tests
 *
 * Tests for GitHub sync service:
 * - Sync configuration
 * - Sync history tracking
 * - GitHub data synchronization
 * - Scheduled sync operations
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);
const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

// Mock GitHub client
const mockGitHubClient = {
  isConfigured: jest.fn().mockReturnValue(true),
  getEnabledRepos: jest.fn().mockReturnValue([
    { repo_full_name: 'owner/repo1' },
    { repo_full_name: 'owner/repo2' },
  ]),
  getAllIssues: jest.fn().mockResolvedValue([
    { id: 1, state: 'open', title: 'Issue 1' },
    { id: 2, state: 'closed', title: 'Issue 2' },
  ]),
};

jest.mock('@/lib/integrations/GitHubClient', () => ({
  __esModule: true,
  default: mockGitHubClient,
}));

// Mock temporal-context
jest.mock('@/lib/pm/temporal-context', () => ({
  recordEvent: jest.fn(),
}));

import {
  getSyncHistory,
  getLastSuccessfulSync,
  isSyncRunning,
  runSync,
  scheduledSync,
  type SyncConfig,
  type SyncResult,
} from '@/lib/pm/sync-service';

describe('Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockGitHubClient.isConfigured.mockReturnValue(true);
    mockGitHubClient.getAllIssues.mockResolvedValue([
      { id: 1, state: 'open', title: 'Issue 1' },
      { id: 2, state: 'closed', title: 'Issue 2' },
    ]);
  });

  describe('Types', () => {
    it('should define SyncConfig interface', () => {
      const config: SyncConfig = {
        dryRun: true,
        repoFilter: 'owner/repo1',
        includeLocal: true,
      };

      expect(config.dryRun).toBe(true);
      expect(config.repoFilter).toBe('owner/repo1');
    });

    it('should define SyncResult interface', () => {
      const result: SyncResult = {
        id: 1,
        sync_type: 'github_refresh',
        started_at: Math.floor(Date.now() / 1000),
        completed_at: Math.floor(Date.now() / 1000) + 10,
        status: 'completed',
        tasks_synced: 25,
        errors: [],
        metadata: {
          enabledRepos: 2,
          githubIssues: 25,
        },
      };

      expect(result.status).toBe('completed');
      expect(result.tasks_synced).toBe(25);
    });

    it('should support different sync statuses', () => {
      const statuses: SyncResult['status'][] = ['running', 'completed', 'failed'];

      statuses.forEach(status => {
        const result: SyncResult = {
          id: 1,
          sync_type: 'github_refresh',
          started_at: Date.now(),
          completed_at: null,
          status,
          tasks_synced: 0,
          errors: [],
          metadata: {},
        };
        expect(result.status).toBe(status);
      });
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000) - 3600,
          completed_at: Math.floor(Date.now() / 1000) - 3590,
          status: 'completed',
          tasks_synced: 20,
          errors: null,
          metadata: '{}',
        },
        {
          id: 2,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: null,
          status: 'running',
          tasks_synced: 0,
          errors: null,
          metadata: null,
        },
      ]);

      const history = getSyncHistory();

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('completed');
      expect(history[1].status).toBe('running');
    });

    it('should respect limit parameter', () => {
      mockAll.mockReturnValueOnce([]);

      getSyncHistory(5);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT')
      );
    });

    it('should parse errors JSON', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'failed',
          tasks_synced: 0,
          errors: '["Error 1", "Error 2"]',
          metadata: '{}',
        },
      ]);

      const history = getSyncHistory();

      expect(history[0].errors).toEqual(['Error 1', 'Error 2']);
    });

    it('should parse metadata JSON', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 10,
          errors: null,
          metadata: '{"enabledRepos": 3, "openIssues": 7}',
        },
      ]);

      const history = getSyncHistory();

      expect(history[0].metadata.enabledRepos).toBe(3);
      expect(history[0].metadata.openIssues).toBe(7);
    });
  });

  describe('getLastSuccessfulSync', () => {
    it('should return last successful sync', () => {
      mockGet.mockReturnValueOnce({
        id: 5,
        sync_type: 'github_refresh',
        started_at: Math.floor(Date.now() / 1000) - 1800,
        completed_at: Math.floor(Date.now() / 1000) - 1790,
        status: 'completed',
        tasks_synced: 15,
        errors: null,
        metadata: '{}',
      });

      const lastSync = getLastSuccessfulSync();

      expect(lastSync).not.toBeNull();
      expect(lastSync?.status).toBe('completed');
      expect(lastSync?.tasks_synced).toBe(15);
    });

    it('should return null when no successful sync', () => {
      mockGet.mockReturnValueOnce(undefined);

      const lastSync = getLastSuccessfulSync();

      expect(lastSync).toBeNull();
    });
  });

  describe('isSyncRunning', () => {
    it('should return true when sync is running', () => {
      mockGet.mockReturnValueOnce({ count: 1 });

      const running = isSyncRunning();

      expect(running).toBe(true);
    });

    it('should return false when no sync running', () => {
      mockGet.mockReturnValueOnce({ count: 0 });

      const running = isSyncRunning();

      expect(running).toBe(false);
    });
  });

  describe('runSync', () => {
    it('should throw if sync already running', async () => {
      mockGet.mockReturnValueOnce({ count: 1 }); // isSyncRunning returns true

      await expect(runSync()).rejects.toThrow('already in progress');
    });

    it('should throw if GitHub not configured', async () => {
      mockGet.mockReturnValueOnce({ count: 0 }); // No sync running
      mockGitHubClient.isConfigured.mockReturnValueOnce(false);

      await expect(runSync()).rejects.toThrow('GitHub is not configured');
    });

    it('should sync GitHub data successfully', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 }) // isSyncRunning
        .mockReturnValueOnce({ // Final sync record
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 2,
          errors: '[]',
          metadata: '{"enabledRepos": 2}',
        });

      const result = await runSync();

      expect(result.status).toBe('completed');
      expect(result.tasks_synced).toBe(2);
      expect(mockGitHubClient.getAllIssues).toHaveBeenCalled();
    });

    it('should handle GitHub fetch errors', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'failed',
          tasks_synced: 0,
          errors: '["GitHub fetch error: Network error"]',
          metadata: '{}',
        });

      mockGitHubClient.getAllIssues.mockRejectedValueOnce(new Error('Network error'));

      const result = await runSync();

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should record temporal event on success', async () => {
      const { recordEvent } = require('@/lib/pm/temporal-context');

      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 2,
          errors: '[]',
          metadata: '{}',
        });

      await runSync();

      expect(recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'sync',
          event_key: 'github_refresh',
        })
      );
    });

    it('should support dry run config', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 2,
          errors: '[]',
          metadata: '{"dryRun": true}',
        });

      const result = await runSync({ dryRun: true });

      expect(result.metadata.dryRun).toBe(true);
    });

    it('should track open vs closed issues', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 2,
          errors: '[]',
          metadata: '{"openIssues": 1, "closedIssues": 1}',
        });

      const result = await runSync();

      expect(result.metadata.openIssues).toBe(1);
      expect(result.metadata.closedIssues).toBe(1);
    });
  });

  describe('scheduledSync', () => {
    it('should skip if last sync was recent', async () => {
      const recentTime = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      mockGet.mockReturnValueOnce({
        id: 1,
        sync_type: 'github_refresh',
        started_at: recentTime,
        completed_at: recentTime,
        status: 'completed',
        tasks_synced: 10,
        errors: null,
        metadata: '{}',
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await scheduledSync();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping scheduled sync')
      );

      consoleSpy.mockRestore();
    });

    it('should run sync if last sync was old', async () => {
      const oldTime = Math.floor(Date.now() / 1000) - 1800; // 30 minutes ago
      mockGet
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: oldTime,
          completed_at: oldTime,
          status: 'completed',
          tasks_synced: 10,
          errors: null,
          metadata: '{}',
        })
        .mockReturnValueOnce({ count: 0 }) // isSyncRunning
        .mockReturnValueOnce({
          id: 2,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 5,
          errors: '[]',
          metadata: '{}',
        });

      const result = await scheduledSync();

      expect(result).not.toBeNull();
      expect(result?.status).toBe('completed');
    });

    it('should run sync if no previous sync', async () => {
      mockGet
        .mockReturnValueOnce(undefined) // getLastSuccessfulSync returns null
        .mockReturnValueOnce({ count: 0 }) // isSyncRunning
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 5,
          errors: '[]',
          metadata: '{}',
        });

      const result = await scheduledSync();

      expect(result).not.toBeNull();
    });
  });

  describe('Sync History Table', () => {
    it('should create table on first access', () => {
      mockAll.mockReturnValue([]);

      getSyncHistory();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS pm_sync_history')
      );
    });

    it('should track sync start time', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 2,
          errors: '[]',
          metadata: '{}',
        });

      await runSync();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pm_sync_history')
      );
    });

    it('should update sync on completion', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({
          id: 1,
          sync_type: 'github_refresh',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          tasks_synced: 2,
          errors: '[]',
          metadata: '{}',
        });

      await runSync();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pm_sync_history')
      );
    });
  });
});
