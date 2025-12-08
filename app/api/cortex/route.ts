/**
 * Cognitive Synthesis Engine - Main Status and Control
 *
 * GET /api/cortex - Get cortex status
 * Returns: { ok: true, status, lastSynthesisAt, eventCount, taskCount, config }
 *
 * POST /api/cortex - Control cortex loop
 * Body: { action: 'start' | 'stop' | 'configure', config?: Partial<SynthesisLoopConfig> }
 * Returns: { ok: true, status, message }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { currentUserOrThrow } from '@/lib/auth/user';
import { getSynthesisLoop } from '@/lib/cortex/synthesis-loop';
import { getWorkingMemory } from '@/lib/cortex/working-memory';
import type { SynthesisLoopConfig } from '@/lib/cortex/types';

ensureServerOnly('app/api/cortex/route');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// GET - Cortex Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    // Get synthesis loop status
    const synthesisLoop = getSynthesisLoop();
    const loopStatus = synthesisLoop.getStatus();

    // Get working memory stats
    const workingMemory = getWorkingMemory();
    const memoryStats = await workingMemory.getStats();

    // Determine overall status
    let status: 'active' | 'idle' | 'disabled';
    if (!loopStatus.isRunning) {
      status = 'disabled';
    } else if (memoryStats.unprocessedEvents >= 3) {
      status = 'active';
    } else {
      status = 'idle';
    }

    return NextResponse.json({
      ok: true,
      status,
      lastSynthesisAt: loopStatus.lastSynthesisAt,
      nextSynthesisAt: loopStatus.nextSynthesisAt,
      eventCount: memoryStats.unprocessedEvents,
      totalEventCount: memoryStats.totalEvents,
      taskCount: loopStatus.taskCount,
      eventsBySource: memoryStats.eventsBySource,
      processedLast24h: memoryStats.processedLast24h,
      config: {
        isRunning: loopStatus.isRunning,
        // Note: We don't expose the full config for security
      },
    });
  } catch (e) {
    console.error('[Cortex API] Error getting status:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to get cortex status' }, { status });
  }
}

// ============================================================================
// POST - Control Loop
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const body = await request.json();
    const { action, config } = body as {
      action: 'start' | 'stop' | 'configure';
      config?: Partial<SynthesisLoopConfig>;
    };

    if (!action) {
      return NextResponse.json({ ok: false, error: 'Missing action parameter' }, { status: 400 });
    }

    const synthesisLoop = getSynthesisLoop();

    switch (action) {
      case 'start': {
        synthesisLoop.start();
        const status = synthesisLoop.getStatus();
        return NextResponse.json({
          ok: true,
          status: 'active',
          message: 'Synthesis loop started',
          nextSynthesisAt: status.nextSynthesisAt,
        });
      }

      case 'stop': {
        synthesisLoop.stop();
        return NextResponse.json({
          ok: true,
          status: 'disabled',
          message: 'Synthesis loop stopped',
        });
      }

      case 'configure': {
        if (!config) {
          return NextResponse.json(
            { ok: false, error: 'Missing config parameter' },
            { status: 400 }
          );
        }

        // For configuration updates, we'd need to restart the loop
        // For now, return a message that this isn't supported
        return NextResponse.json(
          {
            ok: false,
            error: 'Configuration updates require restart - use stop then start with new config',
          },
          { status: 501 }
        );
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    console.error('[Cortex API] Error controlling loop:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to control cortex loop' }, { status });
  }
}
