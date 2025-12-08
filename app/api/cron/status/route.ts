/**
 * Cron Status Endpoint
 *
 * GET /api/cron/status
 *
 * Returns the current status of the cron system including:
 * - Last run timestamp
 * - Queue depth and status
 * - Recent execution history
 * - Recent errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStatus, getQueuedItemsByStatus } from '@/lib/pm/task-queue';
import { getAllJobExecutions, getRegisteredJobs } from '@/lib/pm/background-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CronStatus {
  ok: boolean;
  timestamp: string;
  last_run: {
    timestamp: string | null;
    job_id: string | null;
    status: string | null;
    duration_ms: number | null;
  };
  queue: {
    depth: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deferred: number;
    avg_processing_time_ms: number;
  };
  jobs: {
    total: number;
    enabled: number;
    due: number;
    job_list: Array<{
      id: string;
      name: string;
      enabled: boolean;
      last_run: string | null;
      is_due: boolean;
    }>;
  };
  recent_errors: Array<{
    timestamp: string;
    source: 'queue' | 'job';
    id: string;
    error: string;
  }>;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
  };
}

/**
 * GET /api/cron/status
 *
 * Returns cron system status (no auth required for status checks)
 */
export async function GET(req: NextRequest): Promise<NextResponse<CronStatus>> {
  const timestamp = new Date().toISOString();
  const issues: string[] = [];

  try {
    // Get queue status
    const queueStatus = await getQueueStatus();

    // Get registered jobs
    const jobs = getRegisteredJobs();
    const enabledJobs = jobs.filter(j => j.enabled);
    const dueJobs = jobs.filter(j => {
      if (!j.enabled) return false;
      if (!j.last_run) return true;
      const cooldownMs = j.cooldown_minutes * 60 * 1000;
      return Date.now() - j.last_run >= cooldownMs;
    });

    // Get recent executions
    const recentExecutions = getAllJobExecutions(20);

    // Find last successful run
    const lastExecution = recentExecutions.length > 0 ? recentExecutions[0] : null;

    // Get failed queue items
    const failedQueueItems = await getQueuedItemsByStatus('failed', 10);

    // Build recent errors list
    const recentErrors: CronStatus['recent_errors'] = [];

    // Add failed job executions
    for (const exec of recentExecutions) {
      if (exec.status === 'failed' && exec.error) {
        recentErrors.push({
          timestamp: new Date(exec.started_at * 1000).toISOString(),
          source: 'job',
          id: exec.job_id,
          error: exec.error,
        });
      }
    }

    // Add failed queue items
    for (const item of failedQueueItems) {
      if (item.error) {
        recentErrors.push({
          timestamp: new Date(item.created_at * 1000).toISOString(),
          source: 'queue',
          id: item.id,
          error: item.error,
        });
      }
    }

    // Sort by timestamp descending
    recentErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Health check logic
    // Check for concerning conditions
    if (queueStatus.pending > 100) {
      issues.push(`Queue backup: ${queueStatus.pending} pending items`);
    }

    if (queueStatus.failed > 10) {
      issues.push(`High failure rate: ${queueStatus.failed} failed items in queue`);
    }

    // Check if any jobs haven't run in too long (2x their interval)
    for (const job of enabledJobs) {
      if (job.last_run && job.interval_minutes) {
        const timeSinceLastRun = Date.now() - job.last_run;
        const expectedInterval = job.interval_minutes * 60 * 1000;
        if (timeSinceLastRun > expectedInterval * 2) {
          issues.push(`Job '${job.id}' overdue: last ran ${Math.round(timeSinceLastRun / 60000)} minutes ago`);
        }
      }
    }

    // Check for recent failures
    const recentFailures = recentExecutions.filter(e =>
      e.status === 'failed' &&
      e.started_at > (Date.now() / 1000) - 3600 // Last hour
    );
    if (recentFailures.length >= 3) {
      issues.push(`Recent job failures: ${recentFailures.length} in the last hour`);
    }

    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0 && issues.length <= 2) {
      healthStatus = 'degraded';
    } else if (issues.length > 2) {
      healthStatus = 'unhealthy';
    }

    const response: CronStatus = {
      ok: true,
      timestamp,
      last_run: {
        timestamp: lastExecution ? new Date(lastExecution.started_at * 1000).toISOString() : null,
        job_id: lastExecution?.job_id || null,
        status: lastExecution?.status || null,
        duration_ms: lastExecution?.result?.duration_ms || null,
      },
      queue: {
        depth: queueStatus.total_items,
        pending: queueStatus.pending,
        processing: queueStatus.processing,
        completed: queueStatus.completed,
        failed: queueStatus.failed,
        deferred: queueStatus.deferred,
        avg_processing_time_ms: queueStatus.avg_processing_time_ms,
      },
      jobs: {
        total: jobs.length,
        enabled: enabledJobs.length,
        due: dueJobs.length,
        job_list: jobs.map(j => ({
          id: j.id,
          name: j.name,
          enabled: j.enabled,
          last_run: j.last_run ? new Date(j.last_run).toISOString() : null,
          is_due: dueJobs.some(d => d.id === j.id),
        })),
      },
      recent_errors: recentErrors.slice(0, 10),
      health: {
        status: healthStatus,
        issues,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Cron Status] Error fetching status:', error);

    return NextResponse.json({
      ok: false,
      timestamp,
      last_run: {
        timestamp: null,
        job_id: null,
        status: null,
        duration_ms: null,
      },
      queue: {
        depth: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        deferred: 0,
        avg_processing_time_ms: 0,
      },
      jobs: {
        total: 0,
        enabled: 0,
        due: 0,
        job_list: [],
      },
      recent_errors: [{
        timestamp,
        source: 'job',
        id: 'status-check',
        error: error instanceof Error ? error.message : String(error),
      }],
      health: {
        status: 'unhealthy',
        issues: ['Failed to retrieve status: ' + (error instanceof Error ? error.message : String(error))],
      },
    }, { status: 500 });
  }
}
