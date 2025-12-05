/**
 * PM Background Jobs System
 *
 * Registers and executes background jobs for proactive PM agent behavior:
 * - Queue processing
 * - Stale task detection
 * - Deadline proximity alerts
 * - Queue cleanup
 *
 * Features:
 * - Cooldown enforcement (don't run same job within window)
 * - Job execution history tracking
 * - Manual and scheduled execution
 * - Job enable/disable
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { processQueue, cleanupQueue } from './task-queue';
import crypto from 'crypto';

ensureServerOnly('lib/pm/background-jobs');

// ============================================================================
// Types
// ============================================================================

export interface BackgroundJob {
  id: string;
  name: string;
  description: string;
  schedule: 'interval' | 'cron' | 'manual';
  interval_minutes?: number; // For interval jobs
  cron_expression?: string; // For cron jobs (not implemented yet)
  cooldown_minutes: number; // Don't run again within this window
  enabled: boolean;
  last_run?: number;
  next_run?: number;
  handler: () => Promise<JobResult>;
}

export interface JobResult {
  success: boolean;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  errors?: string[];
  duration_ms: number;
  next_run_suggestion?: number;
}

export interface JobExecution {
  id: string;
  job_id: string;
  started_at: number;
  completed_at?: number;
  status: 'running' | 'completed' | 'failed';
  result?: JobResult;
  error?: string;
}

// ============================================================================
// Database Schema
// ============================================================================

function ensureJobTables(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_job_executions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT DEFAULT 'running',
      result TEXT,
      error TEXT,

      CHECK (status IN ('running', 'completed', 'failed'))
    );

    CREATE INDEX IF NOT EXISTS idx_job_executions_job_id ON pm_job_executions(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_executions_started_at ON pm_job_executions(started_at);
  `);
}

// ============================================================================
// Job Registry (In-Memory)
// ============================================================================

const REGISTERED_JOBS: Map<string, BackgroundJob> = new Map();

/**
 * Register a background job
 */
export function registerJob(job: BackgroundJob): void {
  REGISTERED_JOBS.set(job.id, job);
  console.log(`[Background Jobs] Registered job: ${job.id}`);
}

/**
 * Unregister a job
 */
export function unregisterJob(jobId: string): boolean {
  const deleted = REGISTERED_JOBS.delete(jobId);
  if (deleted) {
    console.log(`[Background Jobs] Unregistered job: ${jobId}`);
  }
  return deleted;
}

/**
 * Get all registered jobs
 */
export function getRegisteredJobs(): BackgroundJob[] {
  return Array.from(REGISTERED_JOBS.values());
}

/**
 * Get a specific job
 */
export function getJob(jobId: string): BackgroundJob | undefined {
  return REGISTERED_JOBS.get(jobId);
}

/**
 * Update job schedule
 */
export function updateJobSchedule(
  jobId: string,
  updates: Partial<BackgroundJob>
): boolean {
  const job = REGISTERED_JOBS.get(jobId);
  if (!job) return false;

  // Update job with new properties
  const updated = { ...job, ...updates };
  REGISTERED_JOBS.set(jobId, updated);

  console.log(`[Background Jobs] Updated job: ${jobId}`);
  return true;
}

// ============================================================================
// Job Execution
// ============================================================================

/**
 * Check if job is due to run (respects cooldown)
 */
export function isJobDue(job: BackgroundJob): boolean {
  if (!job.enabled) return false;
  if (!job.last_run) return true;

  const cooldownMs = job.cooldown_minutes * 60 * 1000;
  const timeSinceLastRun = Date.now() - job.last_run;

  return timeSinceLastRun >= cooldownMs;
}

/**
 * Execute a specific job
 */
export async function executeJob(
  jobId: string,
  force: boolean = false
): Promise<JobResult> {
  ensureJobTables();

  const job = REGISTERED_JOBS.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!job.enabled && !force) {
    throw new Error(`Job is disabled: ${jobId}`);
  }

  if (!isJobDue(job) && !force) {
    const cooldownRemaining = job.cooldown_minutes * 60 * 1000 - (Date.now() - (job.last_run || 0));
    const minutesRemaining = Math.ceil(cooldownRemaining / (60 * 1000));
    throw new Error(`Job is on cooldown for ${minutesRemaining} more minutes`);
  }

  const executionId = `exec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const startTime = Date.now();
  const startTimestamp = Math.floor(startTime / 1000);

  const db = getDatabase().getRawDb();

  // Record execution start
  db.prepare(`
    INSERT INTO pm_job_executions (id, job_id, started_at, status)
    VALUES (@id, @job_id, @started_at, 'running')
  `).run({
    id: executionId,
    job_id: jobId,
    started_at: startTimestamp,
  });

  console.log(`[Background Jobs] Starting job: ${jobId} (${executionId})`);

  try {
    // Execute job handler
    const result = await job.handler();

    const endTime = Date.now();
    const duration = endTime - startTime;
    result.duration_ms = duration;

    // Record completion
    db.prepare(`
      UPDATE pm_job_executions
      SET status = 'completed', completed_at = @completed_at, result = @result
      WHERE id = @id
    `).run({
      id: executionId,
      completed_at: Math.floor(endTime / 1000),
      result: JSON.stringify(result),
    });

    // Update job's last_run
    job.last_run = endTime;
    if (result.next_run_suggestion) {
      job.next_run = result.next_run_suggestion;
    }

    console.log(`[Background Jobs] Completed job: ${jobId} in ${duration}ms`);
    console.log(`[Background Jobs] Result:`, result);

    return result;
  } catch (error) {
    const endTime = Date.now();

    // Record failure
    db.prepare(`
      UPDATE pm_job_executions
      SET status = 'failed', completed_at = @completed_at, error = @error
      WHERE id = @id
    `).run({
      id: executionId,
      completed_at: Math.floor(endTime / 1000),
      error: error instanceof Error ? error.message : String(error),
    });

    console.error(`[Background Jobs] Failed job: ${jobId}:`, error);

    throw error;
  }
}

/**
 * Execute all due jobs
 */
export async function executeDueJobs(): Promise<JobExecution[]> {
  ensureJobTables();

  const jobs = getRegisteredJobs();
  const dueJobs = jobs.filter(isJobDue);

  console.log(`[Background Jobs] Checking ${jobs.length} jobs, ${dueJobs.length} are due`);

  const executions: JobExecution[] = [];

  for (const job of dueJobs) {
    try {
      const result = await executeJob(job.id);
      executions.push({
        id: `exec_${Date.now()}`,
        job_id: job.id,
        started_at: Date.now(),
        completed_at: Date.now(),
        status: 'completed',
        result,
      });
    } catch (error) {
      console.error(`[Background Jobs] Error executing ${job.id}:`, error);
      executions.push({
        id: `exec_${Date.now()}`,
        job_id: job.id,
        started_at: Date.now(),
        completed_at: Date.now(),
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return executions;
}

/**
 * Get job execution history
 */
export function getJobHistory(jobId: string, limit: number = 20): JobExecution[] {
  ensureJobTables();

  const db = getDatabase().getRawDb();
  const rows = db.prepare(`
    SELECT * FROM pm_job_executions
    WHERE job_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(jobId, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    job_id: row.job_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    status: row.status as 'running' | 'completed' | 'failed',
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error,
  }));
}

/**
 * Get all job executions (recent)
 */
export function getAllJobExecutions(limit: number = 50): JobExecution[] {
  ensureJobTables();

  const db = getDatabase().getRawDb();
  const rows = db.prepare(`
    SELECT * FROM pm_job_executions
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(row => ({
    id: row.id,
    job_id: row.job_id,
    started_at: row.started_at,
    completed_at: row.completed_at,
    status: row.status as 'running' | 'completed' | 'failed',
    result: row.result ? JSON.parse(row.result) : undefined,
    error: row.error,
  }));
}

// ============================================================================
// Built-in Jobs
// ============================================================================

/**
 * Job: Process Task Queue
 */
const QUEUE_PROCESSOR_JOB: BackgroundJob = {
  id: 'process-queue',
  name: 'Process Task Queue',
  description: 'Process pending items in the task queue',
  schedule: 'interval',
  interval_minutes: 5,
  cooldown_minutes: 3,
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      const result = await processQueue(10); // Process up to 10 items

      return {
        success: true,
        items_processed: result.processed,
        items_succeeded: result.succeeded,
        items_failed: result.failed,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: Date.now() - startTime,
      };
    }
  },
};

/**
 * Job: Stale Task Detection
 * Detects tasks that haven't been updated in too long
 */
const STALE_TASK_JOB: BackgroundJob = {
  id: 'check-stale-tasks',
  name: 'Stale Task Detection',
  description: 'Detect tasks with no recent activity (priority-based thresholds)',
  schedule: 'interval',
  interval_minutes: 1440, // Daily
  cooldown_minutes: 720, // 12 hours
  enabled: true, // ENABLED for Phase 3a
  handler: async (): Promise<JobResult> => {
    const { staleTaskJobHandler } = await import('./alerts/stale-task-detector');
    return staleTaskJobHandler();
  },
};

/**
 * Job: Deadline Proximity Check
 * (Implemented in Phase 3b)
 */
const DEADLINE_CHECK_JOB: BackgroundJob = {
  id: 'check-deadlines',
  name: 'Deadline Proximity Alerts',
  description: 'Detect approaching and overdue deadlines',
  schedule: 'interval',
  interval_minutes: 720, // Twice daily (12 hours)
  cooldown_minutes: 720, // 12 hours
  enabled: true, // Enabled in Phase 3b
  handler: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      // Import detector (lazy load to avoid circular dependencies)
      const { detectApproachingDeadlines } = await import('./alerts/deadline-proximity-detector');

      const alerts = await detectApproachingDeadlines();

      return {
        success: true,
        items_processed: alerts.length,
        items_succeeded: alerts.filter(a => a.severity === 'critical').length,
        items_failed: 0,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: Date.now() - startTime,
      };
    }
  },
};

/**
 * Job: Queue Cleanup
 */
const QUEUE_CLEANUP_JOB: BackgroundJob = {
  id: 'cleanup-queue',
  name: 'Queue Cleanup',
  description: 'Remove completed items older than 30 days',
  schedule: 'interval',
  interval_minutes: 1440, // Daily
  cooldown_minutes: 1440, // 24 hours
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      const deleted = await cleanupQueue(30);

      return {
        success: true,
        items_processed: deleted,
        items_succeeded: deleted,
        items_failed: 0,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: Date.now() - startTime,
      };
    }
  },
};

// ============================================================================
// Auto-register built-in jobs on module load
// ============================================================================

registerJob(QUEUE_PROCESSOR_JOB);
registerJob(STALE_TASK_JOB);
registerJob(DEADLINE_CHECK_JOB);
registerJob(QUEUE_CLEANUP_JOB);

console.log('[Background Jobs] Initialized with 4 built-in jobs');
