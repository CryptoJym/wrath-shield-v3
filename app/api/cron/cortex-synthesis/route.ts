/**
 * Cortex Synthesis Cron Endpoint - Background Processing
 *
 * POST /api/cron/cortex-synthesis
 *
 * This endpoint runs the Cognitive Synthesis Engine on a schedule:
 * 1. Processes unprocessed events from Working Memory
 * 2. Synthesizes events into unified tasks using LLM
 * 3. Prunes old processed events from the buffer
 *
 * Called by Vercel Cron on schedule (e.g., every 5 minutes)
 *
 * Authentication: Bearer token or x-cron-secret header
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkingMemory } from '@/lib/cortex/working-memory';
import { getSynthesisLoop } from '@/lib/cortex/synthesis-loop';
import { taskStore, applySynthesisResult } from '@/lib/cortex/task-store';
import { learnFromSynthesis, prunePatterns } from '@/lib/cortex/pattern-learner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum execution time (60s for Pro, 10s for Hobby)
export const maxDuration = 60;

interface CortexSynthesisResult {
  ok: boolean;
  timestamp: string;
  synthesis: {
    performed: boolean;
    tasksCreated: number;
    tasksUpdated: number;
    actionsProposed: number;
    eventsProcessed: number;
    patternsLearned: number;
    summary: string | null;
  } | null;
  pruning: {
    eventsRemoved: number;
    pruneWindowHours: number;
  } | null;
  stats: {
    totalEvents: number;
    unprocessedEvents: number;
    eventsBySource: Record<string, number>;
  } | null;
  errors: string[];
  duration_ms: number;
}

/**
 * Verify request authorization
 * Accepts:
 * - x-cron-secret header (Vercel Cron)
 * - x-vercel-cron header (Vercel automatic)
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

  // Check for Vercel automatic cron header
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  if (vercelCronHeader === '1') {
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
 * POST /api/cron/cortex-synthesis
 *
 * Execute the Cortex synthesis cron job
 */
export async function POST(req: NextRequest): Promise<NextResponse<CortexSynthesisResult>> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Verify authorization
  const auth = verifyAuthorization(req);
  if (!auth.authorized) {
    console.warn('[Cron Cortex Synthesis] Authorization failed:', auth.error);
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        synthesis: null,
        pruning: null,
        stats: null,
        errors: [auth.error || 'Unauthorized'],
        duration_ms: Date.now() - startTime,
      },
      { status: auth.error === 'CRON_SECRET not configured' ? 500 : 401 }
    );
  }

  // Parse optional parameters
  const url = new URL(req.url);
  const skipSynthesis = url.searchParams.get('skipSynthesis') === 'true';
  const skipPrune = url.searchParams.get('skipPrune') === 'true';
  const pruneHours = parseInt(url.searchParams.get('pruneHours') || '168', 10); // Default 1 week

  console.log(`[Cron Cortex Synthesis] Starting at ${new Date().toISOString()}`);
  console.log(`[Cron Cortex Synthesis] Options: skipSynthesis=${skipSynthesis}, skipPrune=${skipPrune}, pruneHours=${pruneHours}`);

  let synthesisResult: CortexSynthesisResult['synthesis'] = null;
  let pruningResult: CortexSynthesisResult['pruning'] = null;
  let statsResult: CortexSynthesisResult['stats'] = null;

  const workingMemory = getWorkingMemory();

  // Step 1: Get current stats
  try {
    console.log('[Cron Cortex Synthesis] Step 1: Fetching working memory stats...');
    const stats = await workingMemory.getStats();
    statsResult = {
      totalEvents: stats.totalEvents,
      unprocessedEvents: stats.unprocessedEvents,
      eventsBySource: stats.eventsBySource,
    };
    console.log(`[Cron Cortex Synthesis] Stats: ${stats.totalEvents} total, ${stats.unprocessedEvents} unprocessed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cron Cortex Synthesis] Failed to get stats:', errorMessage);
    errors.push(`Stats error: ${errorMessage}`);
  }

  // Step 2: Run synthesis if not skipped and enough events
  if (!skipSynthesis) {
    try {
      console.log('[Cron Cortex Synthesis] Step 2: Running synthesis loop...');
      const synthesisLoop = getSynthesisLoop();
      const result = await synthesisLoop.runSynthesisPass();

      if (result) {
        // Apply the synthesis result to the database
        const applied = await applySynthesisResult(result, taskStore);

        // Step 2b: Learn from synthesis results (pattern extraction)
        const patternsLearned = result.new_patterns.length;
        if (patternsLearned > 0) {
          try {
            await learnFromSynthesis(result);
            console.log(`[Cron Cortex Synthesis] Stored ${patternsLearned} patterns from synthesis`);
          } catch (learnError) {
            const learnErrorMessage = learnError instanceof Error ? learnError.message : String(learnError);
            console.warn('[Cron Cortex Synthesis] Pattern learning warning:', learnErrorMessage);
            // Non-fatal - continue even if pattern learning fails
          }
        }

        synthesisResult = {
          performed: true,
          tasksCreated: applied.tasksCreated,
          tasksUpdated: applied.tasksUpdated,
          actionsProposed: applied.actionsProposed,
          eventsProcessed: result.events_fully_processed.length,
          patternsLearned: patternsLearned,
          summary: result.synthesis_summary,
        };
        console.log(`[Cron Cortex Synthesis] Synthesis complete: ${applied.tasksCreated} created, ${applied.tasksUpdated} updated, ${patternsLearned} patterns learned`);
      } else {
        synthesisResult = {
          performed: false,
          tasksCreated: 0,
          tasksUpdated: 0,
          actionsProposed: 0,
          eventsProcessed: 0,
          patternsLearned: 0,
          summary: 'Not enough events to synthesize',
        };
        console.log('[Cron Cortex Synthesis] Synthesis skipped - not enough events');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Cron Cortex Synthesis] Synthesis failed:', errorMessage);
      errors.push(`Synthesis error: ${errorMessage}`);
      synthesisResult = {
        performed: false,
        tasksCreated: 0,
        tasksUpdated: 0,
        actionsProposed: 0,
        eventsProcessed: 0,
        patternsLearned: 0,
        summary: `Error: ${errorMessage}`,
      };
    }
  }

  // Step 3: Prune old processed events if not skipped
  if (!skipPrune) {
    try {
      console.log(`[Cron Cortex Synthesis] Step 3: Pruning events older than ${pruneHours} hours...`);
      const pruned = await workingMemory.prune(pruneHours);

      // Also prune old patterns (runs weekly cleanup internally)
      let patternsPruned = 0;
      try {
        patternsPruned = await prunePatterns();
        if (patternsPruned > 0) {
          console.log(`[Cron Cortex Synthesis] Pruned ${patternsPruned} old patterns`);
        }
      } catch (patternPruneError) {
        // Non-fatal - pattern pruning is optional
        console.warn('[Cron Cortex Synthesis] Pattern pruning warning:', patternPruneError);
      }

      pruningResult = {
        eventsRemoved: pruned,
        pruneWindowHours: pruneHours,
      };
      console.log(`[Cron Cortex Synthesis] Pruned ${pruned} old events`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Cron Cortex Synthesis] Pruning failed:', errorMessage);
      errors.push(`Pruning error: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  console.log(`[Cron Cortex Synthesis] Completed in ${duration}ms with ${errors.length} errors`);

  return NextResponse.json({
    ok: success,
    timestamp: new Date().toISOString(),
    synthesis: synthesisResult,
    pruning: pruningResult,
    stats: statsResult,
    errors,
    duration_ms: duration,
  });
}

/**
 * GET /api/cron/cortex-synthesis
 *
 * Health check and documentation
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Get current stats for health check
  let stats = null;
  try {
    const workingMemory = getWorkingMemory();
    stats = await workingMemory.getStats();
  } catch (e) {
    // Ignore errors for health check
  }

  return NextResponse.json({
    endpoint: '/api/cron/cortex-synthesis',
    method: 'POST',
    description: 'Cognitive Synthesis Engine cron job - processes Working Memory events into unified tasks',
    authentication: 'Requires x-cron-secret header, x-vercel-cron header, or Authorization: Bearer <CRON_SECRET>',
    parameters: {
      skipSynthesis: 'Optional query param - skip synthesis pass (default: false)',
      skipPrune: 'Optional query param - skip pruning old events (default: false)',
      pruneHours: 'Optional query param - hours threshold for pruning (default: 168 = 1 week)',
    },
    actions: [
      '1. Get Working Memory stats',
      '2. Run synthesis loop (if enough events)',
      '3. Apply synthesis results to task store',
      '4. Prune old processed events',
    ],
    response: {
      ok: 'boolean - overall success',
      timestamp: 'ISO timestamp of execution',
      synthesis: 'Synthesis results (tasksCreated, tasksUpdated, eventsProcessed, etc.)',
      pruning: 'Pruning results (eventsRemoved, pruneWindowHours)',
      stats: 'Current Working Memory stats',
      errors: 'Array of error messages',
      duration_ms: 'Total execution time in milliseconds',
    },
    status: 'ready',
    current_stats: stats,
  });
}
