/**
 * Cron Process Endpoint - Activation Layer
 *
 * POST /api/cron/process
 *
 * This endpoint activates the PM task queue processor and background jobs.
 * It is designed to be called by:
 * - Vercel Cron (uses CRON_SECRET header)
 * - Manual triggers with Bearer token
 *
 * Executes:
 * 1. processQueue() - Process pending items in the PM task queue
 * 2. executeDueJobs() - Execute any scheduled background jobs that are due
 */

import { NextRequest, NextResponse } from 'next/server';
import { processQueue, getQueueStatus } from '@/lib/pm/task-queue';
import { executeDueJobs, JobExecution } from '@/lib/pm/background-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum time for cron execution (Vercel has 10s limit for hobby, 60s for pro)
export const maxDuration = 60;

interface ProcessResult {
  ok: boolean;
  timestamp: string;
  queue: {
    processed: number;
    succeeded: number;
    failed: number;
    deferred: number;
  } | null;
  jobs: {
    executed: number;
    completed: number;
    failed: number;
    executions: Array<{
      job_id: string;
      status: string;
      error?: string;
    }>;
  } | null;
  errors: string[];
  duration_ms: number;
}

/**
 * Verify request authorization
 * Accepts either:
 * - x-cron-secret header (for Vercel Cron)
 * - Authorization: Bearer <token> header
 */
function verifyAuthorization(req: NextRequest): { authorized: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return { authorized: false, error: 'CRON_SECRET not configured' };
  }

  // Check for Vercel Cron secret header
  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return { authorized: true };
  }

  // Check for Bearer token
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token === cronSecret) {
      return { authorized: true };
    }
  }

  return { authorized: false, error: 'Unauthorized - invalid or missing credentials' };
}

/**
 * POST /api/cron/process
 *
 * Execute the cron process: queue processing + background jobs
 */
export async function POST(req: NextRequest): Promise<NextResponse<ProcessResult>> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Verify authorization
  const auth = verifyAuthorization(req);
  if (!auth.authorized) {
    console.warn('[Cron Process] Authorization failed:', auth.error);
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        queue: null,
        jobs: null,
        errors: [auth.error || 'Unauthorized'],
        duration_ms: Date.now() - startTime,
      },
      { status: auth.error === 'CRON_SECRET not configured' ? 500 : 401 }
    );
  }

  // Parse optional parameters
  const url = new URL(req.url);
  const queueLimit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

  console.log(`[Cron Process] Starting activation run at ${new Date().toISOString()}`);
  console.log(`[Cron Process] Queue limit: ${queueLimit}`);

  let queueResult: ProcessResult['queue'] = null;
  let jobsResult: ProcessResult['jobs'] = null;

  // Step 1: Process the task queue
  try {
    console.log('[Cron Process] Step 1: Processing task queue...');
    const result = await processQueue(queueLimit);
    queueResult = {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      deferred: result.deferred,
    };
    console.log(`[Cron Process] Queue processed: ${result.processed} items (${result.succeeded} succeeded, ${result.failed} failed)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cron Process] Queue processing failed:', errorMessage);
    errors.push(`Queue processing error: ${errorMessage}`);
    // Continue to jobs even if queue fails
  }

  // Step 2: Execute due background jobs
  try {
    console.log('[Cron Process] Step 2: Executing due background jobs...');
    const executions: JobExecution[] = await executeDueJobs();

    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    jobsResult = {
      executed: executions.length,
      completed,
      failed,
      executions: executions.map(e => ({
        job_id: e.job_id,
        status: e.status,
        error: e.error,
      })),
    };

    console.log(`[Cron Process] Jobs executed: ${executions.length} (${completed} completed, ${failed} failed)`);

    // Collect job errors
    for (const exec of executions) {
      if (exec.status === 'failed' && exec.error) {
        errors.push(`Job ${exec.job_id}: ${exec.error}`);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cron Process] Job execution failed:', errorMessage);
    errors.push(`Job execution error: ${errorMessage}`);
  }

  const duration = Date.now() - startTime;
  const success = queueResult !== null || jobsResult !== null;

  console.log(`[Cron Process] Completed in ${duration}ms with ${errors.length} errors`);

  return NextResponse.json({
    ok: success,
    timestamp: new Date().toISOString(),
    queue: queueResult,
    jobs: jobsResult,
    errors,
    duration_ms: duration,
  });
}

/**
 * GET /api/cron/process
 *
 * Health check and documentation for the cron endpoint
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Don't require auth for GET - it's just documentation/health check
  return NextResponse.json({
    endpoint: '/api/cron/process',
    method: 'POST',
    description: 'Activation layer for PM task queue and background jobs',
    authentication: 'Requires x-cron-secret header or Authorization: Bearer <CRON_SECRET>',
    parameters: {
      limit: 'Optional query param - max queue items to process (default: 10, max: 50)',
    },
    actions: [
      'processQueue() - Process pending PM queue items',
      'executeDueJobs() - Execute scheduled background jobs',
    ],
    response: {
      ok: 'boolean - overall success',
      timestamp: 'ISO timestamp of execution',
      queue: 'Queue processing results (processed, succeeded, failed, deferred)',
      jobs: 'Background job results (executed, completed, failed, executions[])',
      errors: 'Array of error messages encountered',
      duration_ms: 'Total execution time in milliseconds',
    },
    status: 'ready',
  });
}
