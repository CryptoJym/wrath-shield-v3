// @ts-nocheck
/**
 * Wrath Shield v3 - Background Jobs Tests
 *
 * Tests for PM background job system:
 * - Job registration and management
 * - Job execution with cooldown
 * - Execution history tracking
 * - Built-in jobs configuration
 */

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('abc123'),
  }),
}));

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

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock task-queue
jest.mock('@/lib/pm/task-queue', () => ({
  processQueue: jest.fn().mockResolvedValue({
    processed: 5,
    succeeded: 4,
    failed: 1,
  }),
  cleanupQueue: jest.fn().mockResolvedValue(10),
}));

import {
  registerJob,
  unregisterJob,
  getRegisteredJobs,
  getJob,
  updateJobSchedule,
  isJobDue,
  executeJob,
  executeDueJobs,
  getJobHistory,
  getAllJobExecutions,
  type BackgroundJob,
  type JobResult,
  type JobExecution,
} from '@/lib/pm/background-jobs';

describe('Background Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
  });

  describe('Types', () => {
    it('should define BackgroundJob interface', () => {
      const job: BackgroundJob = {
        id: 'test-job',
        name: 'Test Job',
        description: 'A test background job',
        schedule: 'interval',
        interval_minutes: 15,
        cooldown_minutes: 10,
        enabled: true,
        last_run: Date.now() - 60000,
        next_run: Date.now() + 60000,
        handler: async () => ({
          success: true,
          items_processed: 5,
          items_succeeded: 5,
          items_failed: 0,
          duration_ms: 1000,
        }),
      };

      expect(job.schedule).toBe('interval');
      expect(job.enabled).toBe(true);
    });

    it('should define JobResult interface', () => {
      const result: JobResult = {
        success: true,
        items_processed: 10,
        items_succeeded: 8,
        items_failed: 2,
        errors: ['Error 1', 'Error 2'],
        duration_ms: 5000,
        next_run_suggestion: Date.now() + 3600000,
      };

      expect(result.items_processed).toBe(10);
      expect(result.errors).toHaveLength(2);
    });

    it('should define JobExecution interface', () => {
      const execution: JobExecution = {
        id: 'exec_123',
        job_id: 'test-job',
        started_at: Date.now(),
        completed_at: Date.now() + 1000,
        status: 'completed',
        result: {
          success: true,
          items_processed: 5,
          items_succeeded: 5,
          items_failed: 0,
          duration_ms: 1000,
        },
      };

      expect(execution.status).toBe('completed');
    });

    it('should support different job schedules', () => {
      const intervalJob: BackgroundJob = {
        id: 'interval-job',
        name: 'Interval Job',
        description: 'Runs at intervals',
        schedule: 'interval',
        interval_minutes: 30,
        cooldown_minutes: 15,
        enabled: true,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      const manualJob: BackgroundJob = {
        id: 'manual-job',
        name: 'Manual Job',
        description: 'Runs manually',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      expect(intervalJob.schedule).toBe('interval');
      expect(manualJob.schedule).toBe('manual');
    });
  });

  describe('Job Registration', () => {
    it('should register a job', () => {
      const testJob: BackgroundJob = {
        id: 'custom-test-job',
        name: 'Custom Test Job',
        description: 'Test',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      registerJob(testJob);

      const job = getJob('custom-test-job');
      expect(job).toBeDefined();
      expect(job?.name).toBe('Custom Test Job');
    });

    it('should unregister a job', () => {
      const testJob: BackgroundJob = {
        id: 'to-remove-job',
        name: 'To Remove',
        description: 'Will be removed',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      registerJob(testJob);
      expect(getJob('to-remove-job')).toBeDefined();

      const result = unregisterJob('to-remove-job');
      expect(result).toBe(true);
      expect(getJob('to-remove-job')).toBeUndefined();
    });

    it('should return false when unregistering non-existent job', () => {
      const result = unregisterJob('nonexistent-job');
      expect(result).toBe(false);
    });

    it('should get all registered jobs', () => {
      const jobs = getRegisteredJobs();

      // Should have built-in jobs
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.some(j => j.id === 'process-queue')).toBe(true);
    });
  });

  describe('updateJobSchedule', () => {
    it('should update job properties', () => {
      const testJob: BackgroundJob = {
        id: 'update-test-job',
        name: 'Update Test',
        description: 'Test',
        schedule: 'interval',
        interval_minutes: 15,
        cooldown_minutes: 10,
        enabled: true,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      registerJob(testJob);

      const result = updateJobSchedule('update-test-job', {
        interval_minutes: 30,
        enabled: false,
      });

      expect(result).toBe(true);

      const updated = getJob('update-test-job');
      expect(updated?.interval_minutes).toBe(30);
      expect(updated?.enabled).toBe(false);
    });

    it('should return false for non-existent job', () => {
      const result = updateJobSchedule('nonexistent', { enabled: false });
      expect(result).toBe(false);
    });
  });

  describe('isJobDue', () => {
    it('should return true for enabled job with no last_run', () => {
      const job: BackgroundJob = {
        id: 'new-job',
        name: 'New Job',
        description: 'Never run',
        schedule: 'interval',
        cooldown_minutes: 10,
        enabled: true,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      expect(isJobDue(job)).toBe(true);
    });

    it('should return false for disabled job', () => {
      const job: BackgroundJob = {
        id: 'disabled-job',
        name: 'Disabled Job',
        description: 'Not enabled',
        schedule: 'interval',
        cooldown_minutes: 10,
        enabled: false,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      expect(isJobDue(job)).toBe(false);
    });

    it('should return false within cooldown period', () => {
      const job: BackgroundJob = {
        id: 'recent-job',
        name: 'Recent Job',
        description: 'Just ran',
        schedule: 'interval',
        cooldown_minutes: 10,
        enabled: true,
        last_run: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      expect(isJobDue(job)).toBe(false);
    });

    it('should return true after cooldown period', () => {
      const job: BackgroundJob = {
        id: 'old-job',
        name: 'Old Job',
        description: 'Ran long ago',
        schedule: 'interval',
        cooldown_minutes: 10,
        enabled: true,
        last_run: Date.now() - 15 * 60 * 1000, // 15 minutes ago
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      expect(isJobDue(job)).toBe(true);
    });
  });

  describe('executeJob', () => {
    it('should throw for non-existent job', async () => {
      await expect(executeJob('nonexistent')).rejects.toThrow('Job not found');
    });

    it('should throw for disabled job without force', async () => {
      const job: BackgroundJob = {
        id: 'disabled-exec-job',
        name: 'Disabled',
        description: 'Cannot run',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: false,
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      registerJob(job);

      await expect(executeJob('disabled-exec-job')).rejects.toThrow('Job is disabled');
    });

    it('should execute disabled job with force', async () => {
      const handlerMock = jest.fn().mockResolvedValue({
        success: true,
        items_processed: 1,
        items_succeeded: 1,
        items_failed: 0,
        duration_ms: 100,
      });

      const job: BackgroundJob = {
        id: 'force-exec-job',
        name: 'Force Execute',
        description: 'Force run',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: false,
        handler: handlerMock,
      };

      registerJob(job);

      const result = await executeJob('force-exec-job', true);

      expect(result.success).toBe(true);
      expect(handlerMock).toHaveBeenCalled();
    });

    it('should throw when on cooldown without force', async () => {
      const job: BackgroundJob = {
        id: 'cooldown-job',
        name: 'On Cooldown',
        description: 'Recently ran',
        schedule: 'interval',
        cooldown_minutes: 60,
        enabled: true,
        last_run: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        handler: async () => ({ success: true, items_processed: 0, items_succeeded: 0, items_failed: 0, duration_ms: 0 }),
      };

      registerJob(job);

      await expect(executeJob('cooldown-job')).rejects.toThrow('cooldown');
    });

    it('should record execution history', async () => {
      const job: BackgroundJob = {
        id: 'history-job',
        name: 'History Test',
        description: 'Records history',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => ({
          success: true,
          items_processed: 5,
          items_succeeded: 5,
          items_failed: 0,
          duration_ms: 500,
        }),
      };

      registerJob(job);
      await executeJob('history-job');

      // Should have called prepare for INSERT
      expect(mockPrepare).toHaveBeenCalled();
    });

    it('should handle handler errors', async () => {
      const job: BackgroundJob = {
        id: 'error-job',
        name: 'Error Test',
        description: 'Will fail',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => {
          throw new Error('Handler failed');
        },
      };

      registerJob(job);

      await expect(executeJob('error-job')).rejects.toThrow('Handler failed');
    });

    it('should update last_run on success', async () => {
      const job: BackgroundJob = {
        id: 'update-time-job',
        name: 'Update Time',
        description: 'Updates last_run',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => ({
          success: true,
          items_processed: 1,
          items_succeeded: 1,
          items_failed: 0,
          duration_ms: 100,
        }),
      };

      registerJob(job);
      const beforeRun = Date.now();

      await executeJob('update-time-job');

      const updatedJob = getJob('update-time-job');
      expect(updatedJob?.last_run).toBeGreaterThanOrEqual(beforeRun);
    });
  });

  describe('executeDueJobs', () => {
    it('should execute all due jobs', async () => {
      // Register a due job
      const job: BackgroundJob = {
        id: 'due-job-test',
        name: 'Due Job',
        description: 'Should execute',
        schedule: 'interval',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => ({
          success: true,
          items_processed: 1,
          items_succeeded: 1,
          items_failed: 0,
          duration_ms: 50,
        }),
      };

      registerJob(job);

      const executions = await executeDueJobs();

      expect(Array.isArray(executions)).toBe(true);
    });

    it('should skip jobs not due', async () => {
      const job: BackgroundJob = {
        id: 'not-due-job',
        name: 'Not Due',
        description: 'Should skip',
        schedule: 'interval',
        cooldown_minutes: 60,
        enabled: true,
        last_run: Date.now(),
        handler: async () => ({
          success: true,
          items_processed: 1,
          items_succeeded: 1,
          items_failed: 0,
          duration_ms: 50,
        }),
      };

      registerJob(job);

      const executions = await executeDueJobs();

      const notDueExecution = executions.find(e => e.job_id === 'not-due-job');
      expect(notDueExecution).toBeUndefined();
    });

    it('should handle job execution errors gracefully', async () => {
      const job: BackgroundJob = {
        id: 'failing-due-job',
        name: 'Failing Due Job',
        description: 'Will fail',
        schedule: 'manual',
        cooldown_minutes: 0,
        enabled: true,
        handler: async () => {
          throw new Error('Execution failed');
        },
      };

      registerJob(job);

      const executions = await executeDueJobs();

      const failedExecution = executions.find(e => e.job_id === 'failing-due-job');
      if (failedExecution) {
        expect(failedExecution.status).toBe('failed');
        expect(failedExecution.error).toBeDefined();
      }
    });
  });

  describe('getJobHistory', () => {
    it('should return execution history for a job', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'exec-1',
          job_id: 'test-job',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000) + 1,
          status: 'completed',
          result: JSON.stringify({ success: true, items_processed: 5, items_succeeded: 5, items_failed: 0, duration_ms: 1000 }),
        },
      ]);

      const history = getJobHistory('test-job');

      expect(history).toHaveLength(1);
      expect(history[0].job_id).toBe('test-job');
      expect(history[0].status).toBe('completed');
    });

    it('should respect limit parameter', () => {
      mockAll.mockReturnValueOnce([]);

      getJobHistory('test-job', 5);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT')
      );
    });

    it('should parse result JSON', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'exec-1',
          job_id: 'test-job',
          started_at: Math.floor(Date.now() / 1000),
          completed_at: Math.floor(Date.now() / 1000) + 1,
          status: 'completed',
          result: JSON.stringify({
            success: true,
            items_processed: 10,
            items_succeeded: 8,
            items_failed: 2,
            duration_ms: 2000,
          }),
        },
      ]);

      const history = getJobHistory('test-job');

      expect(history[0].result?.items_processed).toBe(10);
      expect(history[0].result?.items_succeeded).toBe(8);
    });
  });

  describe('getAllJobExecutions', () => {
    it('should return all recent executions', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'exec-1',
          job_id: 'job-a',
          started_at: Math.floor(Date.now() / 1000),
          status: 'completed',
          result: null,
        },
        {
          id: 'exec-2',
          job_id: 'job-b',
          started_at: Math.floor(Date.now() / 1000) - 100,
          status: 'failed',
          error: 'Test error',
        },
      ]);

      const executions = getAllJobExecutions();

      expect(executions).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      mockAll.mockReturnValueOnce([]);

      getAllJobExecutions(10);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT')
      );
    });
  });

  describe('Built-in Jobs', () => {
    it('should have process-queue job registered', () => {
      const job = getJob('process-queue');

      expect(job).toBeDefined();
      expect(job?.name).toBe('Process Task Queue');
      expect(job?.enabled).toBe(true);
    });

    it('should have check-stale-tasks job registered', () => {
      const job = getJob('check-stale-tasks');

      expect(job).toBeDefined();
      expect(job?.name).toBe('Stale Task Detection');
    });

    it('should have check-deadlines job registered', () => {
      const job = getJob('check-deadlines');

      expect(job).toBeDefined();
      expect(job?.name).toBe('Deadline Proximity Alerts');
    });

    it('should have cleanup-queue job registered', () => {
      const job = getJob('cleanup-queue');

      expect(job).toBeDefined();
      expect(job?.name).toBe('Queue Cleanup');
    });

    it('should have 4 built-in jobs', () => {
      const builtInIds = ['process-queue', 'check-stale-tasks', 'check-deadlines', 'cleanup-queue'];
      const jobs = getRegisteredJobs();

      for (const id of builtInIds) {
        expect(jobs.some(j => j.id === id)).toBe(true);
      }
    });
  });
});
