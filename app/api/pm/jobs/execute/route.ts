/**
 * PM Background Jobs Execution API
 *
 * POST /api/pm/jobs/execute - Execute specific job or all due jobs
 * GET /api/pm/jobs/execute - Get job list and execution history
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRegisteredJobs,
  executeJob,
  executeDueJobs,
  getJobHistory,
  getAllJobExecutions,
  updateJobSchedule,
} from '@/lib/pm/background-jobs';

export const dynamic = 'force-dynamic';

/**
 * POST - Execute jobs
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { job_id, force, update } = body;

    // Update job configuration
    if (update && job_id) {
      const success = updateJobSchedule(job_id, update);
      if (!success) {
        return NextResponse.json(
          { ok: false, error: `Job not found: ${job_id}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, updated: job_id });
    }

    // Execute specific job
    if (job_id) {
      try {
        const result = await executeJob(job_id, force);
        return NextResponse.json({
          ok: true,
          job_id,
          result,
        });
      } catch (error) {
        return NextResponse.json(
          {
            ok: false,
            job_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 400 }
        );
      }
    }

    // Execute all due jobs
    const executions = await executeDueJobs();
    return NextResponse.json({
      ok: true,
      executed: executions.length,
      executions,
    });
  } catch (error) {
    console.error('[PM Jobs API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get job information
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const job_id = searchParams.get('job_id');
    const history_limit = parseInt(searchParams.get('history_limit') || '20');
    const all_executions = searchParams.get('all_executions') === 'true';

    // Get execution history for specific job
    if (job_id) {
      const jobs = getRegisteredJobs();
      const job = jobs.find(j => j.id === job_id);

      if (!job) {
        return NextResponse.json(
          { ok: false, error: `Job not found: ${job_id}` },
          { status: 404 }
        );
      }

      const history = getJobHistory(job_id, history_limit);

      return NextResponse.json({
        ok: true,
        job: {
          id: job.id,
          name: job.name,
          description: job.description,
          schedule: job.schedule,
          interval_minutes: job.interval_minutes,
          cooldown_minutes: job.cooldown_minutes,
          enabled: job.enabled,
          last_run: job.last_run,
          next_run: job.next_run,
        },
        history,
      });
    }

    // Get all recent executions
    if (all_executions) {
      const executions = getAllJobExecutions(50);
      return NextResponse.json({
        ok: true,
        executions,
      });
    }

    // Get all registered jobs
    const jobs = getRegisteredJobs();
    const jobsInfo = jobs.map(job => ({
      id: job.id,
      name: job.name,
      description: job.description,
      schedule: job.schedule,
      interval_minutes: job.interval_minutes,
      cooldown_minutes: job.cooldown_minutes,
      enabled: job.enabled,
      last_run: job.last_run,
      next_run: job.next_run,
      is_due: job.enabled && (!job.last_run || (Date.now() - job.last_run) >= (job.cooldown_minutes * 60 * 1000)),
    }));

    return NextResponse.json({
      ok: true,
      jobs: jobsInfo,
      total: jobsInfo.length,
      enabled: jobsInfo.filter(j => j.enabled).length,
      due: jobsInfo.filter(j => j.is_due).length,
    });
  } catch (error) {
    console.error('[PM Jobs API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
