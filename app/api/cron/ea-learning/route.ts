/**
 * EA Preference Learning Cron Endpoint - Background Learning Loop
 *
 * POST /api/cron/ea-learning
 *
 * This endpoint runs the EA Preference Model Learning Loop on a schedule:
 * 1. Fetches recent user corrections from Zep memory
 * 2. Analyzes patterns in urgency/domain corrections
 * 3. Reinforces effective patterns (increases weights)
 * 4. Weakens ineffective patterns (decreases weights)
 * 5. Prunes stale patterns below threshold
 * 6. Infers new patterns from recurring themes
 *
 * Called by Vercel Cron daily at midnight (0 0 * * *)
 *
 * Authentication: Bearer token or x-cron-secret header
 */

import { NextRequest, NextResponse } from 'next/server';
import { runLearningLoop, getLearningStats, type LearningLoopResult } from '@/lib/ea/preference-model';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum execution time (60s for Pro, 10s for Hobby)
export const maxDuration = 60;

interface EALearningStats {
  model: {
    version: string;
    lastUpdated: string;
    correctionsCount: number;
    lastCorrection: string | null;
  };
  patterns: {
    urgencyTriggers: { total: number; manual: number; learned: number; inferred: number };
    archivePatterns: { total: number; manual: number; learned: number; inferred: number };
    priorityContacts: { total: number; manual: number; learned: number; inferred: number };
  };
  domainSensitivity: Array<{ domain: string; weight: number }>;
}

interface EALearningResult {
  ok: boolean;
  timestamp: string;
  learning: LearningLoopResult | null;
  stats: EALearningStats | null;
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
 * POST /api/cron/ea-learning
 *
 * Execute the EA Preference Learning Loop cron job
 */
export async function POST(req: NextRequest): Promise<NextResponse<EALearningResult>> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Verify authorization
  const auth = verifyAuthorization(req);
  if (!auth.authorized) {
    console.warn('[Cron EA Learning] Authorization failed:', auth.error);
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        learning: null,
        stats: null,
        errors: [auth.error || 'Unauthorized'],
        duration_ms: Date.now() - startTime,
      },
      { status: auth.error === 'CRON_SECRET not configured' ? 500 : 401 }
    );
  }

  // Parse optional parameters
  const url = new URL(req.url);
  const skipLearning = url.searchParams.get('skipLearning') === 'true';
  const lookbackDays = parseInt(url.searchParams.get('lookbackDays') || '7', 10);

  console.log(`[Cron EA Learning] Starting at ${new Date().toISOString()}`);
  console.log(`[Cron EA Learning] Options: skipLearning=${skipLearning}, lookbackDays=${lookbackDays}`);

  let learningResult: LearningLoopResult | null = null;
  let statsResult: EALearningResult['stats'] = null;

  // Step 1: Get current stats
  try {
    console.log('[Cron EA Learning] Step 1: Fetching learning stats...');
    const stats = await getLearningStats();
    statsResult = {
      model: stats.model,
      patterns: stats.patterns,
      domainSensitivity: stats.domainSensitivity,
    };
    const totalPatterns =
      stats.patterns.urgencyTriggers.total +
      stats.patterns.archivePatterns.total +
      stats.patterns.priorityContacts.total;
    console.log(`[Cron EA Learning] Stats: ${totalPatterns} total patterns, ${stats.model.correctionsCount} corrections processed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Cron EA Learning] Failed to get stats:', errorMessage);
    errors.push(`Stats error: ${errorMessage}`);
  }

  // Step 2: Run learning loop if not skipped
  if (!skipLearning) {
    try {
      console.log('[Cron EA Learning] Step 2: Running learning loop...');
      learningResult = await runLearningLoop();

      console.log(
        `[Cron EA Learning] Learning complete: ${learningResult.correctionsAnalyzed} corrections analyzed, ` +
          `${learningResult.patternsReinforced} reinforced, ${learningResult.patternsWeakened} weakened, ` +
          `${learningResult.patternsPruned} pruned, ${learningResult.newPatternsCreated} created`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Cron EA Learning] Learning loop failed:', errorMessage);
      errors.push(`Learning error: ${errorMessage}`);
    }
  } else {
    console.log('[Cron EA Learning] Learning skipped by request');
  }

  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  console.log(`[Cron EA Learning] Completed in ${duration}ms with ${errors.length} errors`);

  return NextResponse.json({
    ok: success,
    timestamp: new Date().toISOString(),
    learning: learningResult,
    stats: statsResult,
    errors,
    duration_ms: duration,
  });
}

/**
 * GET /api/cron/ea-learning
 *
 * Health check and documentation
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Get current stats for health check
  let stats = null;
  try {
    stats = await getLearningStats();
  } catch (e) {
    // Ignore errors for health check
  }

  return NextResponse.json({
    endpoint: '/api/cron/ea-learning',
    method: 'POST',
    description:
      'EA Preference Model Learning Loop - analyzes corrections and improves classification patterns',
    authentication:
      'Requires x-cron-secret header, x-vercel-cron header, or Authorization: Bearer <CRON_SECRET>',
    parameters: {
      skipLearning: 'Optional query param - skip learning pass (default: false)',
      lookbackDays: 'Optional query param - days to look back for corrections (default: 7)',
    },
    actions: [
      '1. Get current learning stats',
      '2. Fetch recent corrections from Zep memory',
      '3. Analyze patterns in corrections',
      '4. Reinforce effective patterns (increase weights)',
      '5. Weaken ineffective patterns (decrease weights)',
      '6. Prune stale patterns below threshold (< 0.25)',
      '7. Infer new patterns from recurring themes',
    ],
    response: {
      ok: 'boolean - overall success',
      timestamp: 'ISO timestamp of execution',
      learning: {
        correctionsAnalyzed: 'Number of corrections processed',
        patternsReinforced: 'Patterns with increased weight',
        patternsWeakened: 'Patterns with decreased weight',
        patternsPruned: 'Patterns removed (weight < 0.25)',
        newPatternsCreated: 'New patterns inferred from themes',
        modelVersion: 'Current model version',
        duration_ms: 'Learning loop duration',
      },
      stats: 'Current learning statistics',
      errors: 'Array of error messages',
      duration_ms: 'Total execution time in milliseconds',
    },
    schedule: 'Daily at midnight (0 0 * * *)',
    status: 'ready',
    current_stats: stats,
  });
}
