/**
 * Cortex Health Check API
 *
 * GET /api/cortex/health
 * Returns health status of the Cognitive Synthesis Engine
 */

import { NextResponse } from 'next/server';
import { getCortexHealth, initializeCortex, isCortexInitialized } from '@/lib/cortex/init';
import { getIngestionStats } from '@/lib/cortex/event-ingestor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Get Cortex health status
 */
export async function GET(request: Request) {
  try {
    // Check if Cortex is initialized, initialize if not
    if (!isCortexInitialized()) {
      console.log('[Cortex Health] Not initialized, initializing now...');
      try {
        await initializeCortex({
          startSynthesisLoop: false, // Don't auto-start synthesis loop
        });
      } catch (initError) {
        console.error('[Cortex Health] Initialization failed:', initError);
        return NextResponse.json({
          ok: false,
          status: 'initialization_failed',
          error: initError instanceof Error ? initError.message : String(initError),
        });
      }
    }

    // Get health status
    const health = await getCortexHealth();

    // Get ingestion stats
    let ingestionStats;
    try {
      ingestionStats = await getIngestionStats();
    } catch (statsError) {
      console.error('[Cortex Health] Failed to get ingestion stats:', statsError);
      ingestionStats = null;
    }

    // Determine overall status
    let overallStatus = 'healthy';
    const warnings: string[] = [];

    if (health.status !== 'healthy') {
      overallStatus = health.status;
    }

    if (!health.workingMemoryReady) {
      overallStatus = 'degraded';
      warnings.push('Working Memory not ready');
    }

    if (ingestionStats && ingestionStats.unprocessedEvents > 100) {
      warnings.push(`High backlog: ${ingestionStats.unprocessedEvents} unprocessed events`);
    }

    return NextResponse.json({
      ok: overallStatus === 'healthy',
      status: overallStatus,
      health: {
        initialized: health.initialized,
        workingMemoryReady: health.workingMemoryReady,
        synthesisLoopRunning: health.synthesisLoopRunning,
        lastInitialized: health.lastInitialized,
      },
      workingMemory: health.workingMemoryStats || null,
      ingestion: ingestionStats || null,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('[Cortex Health] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to initialize Cortex manually
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const startSynthesisLoop = body.startSynthesisLoop ?? false;

    console.log('[Cortex Health] Manual initialization requested', { startSynthesisLoop });

    await initializeCortex({
      startSynthesisLoop,
    });

    const health = await getCortexHealth();

    return NextResponse.json({
      ok: true,
      message: 'Cortex initialized successfully',
      health,
    });
  } catch (error) {
    console.error('[Cortex Health] Initialization error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
