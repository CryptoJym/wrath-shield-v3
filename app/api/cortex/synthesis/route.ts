/**
 * Cognitive Synthesis Engine - Manual Synthesis Trigger
 *
 * POST /api/cortex/synthesis - Trigger immediate synthesis pass
 * Returns: { ok: true, result: SynthesisResult }
 *
 * GET /api/cortex/synthesis - Get synthesis history
 * Query: ?limit=10
 * Returns: { ok: true, history: SynthesisHistoryEntry[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { currentUserOrThrow } from '@/lib/auth/user';
import { getSynthesisLoop } from '@/lib/cortex/synthesis-loop';
import { taskStore, applySynthesisResult } from '@/lib/cortex/task-store';
import type { SynthesisResult } from '@/lib/cortex/types';

ensureServerOnly('app/api/cortex/synthesis/route');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// Types
// ============================================================================

interface SynthesisHistoryEntry {
  timestamp: string;
  tasksCreated: number;
  tasksUpdated: number;
  actionsProposed: number;
  eventsProcessed: number;
  summary: string;
}

// In-memory history (could be moved to DB later)
const synthesisHistory: SynthesisHistoryEntry[] = [];
const MAX_HISTORY = 50;

// ============================================================================
// POST - Trigger Synthesis
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const synthesisLoop = getSynthesisLoop();

    // Run manual synthesis pass
    console.log('[Cortex Synthesis API] Triggering manual synthesis pass...');
    const result = await synthesisLoop.runSynthesisPass();

    if (!result) {
      return NextResponse.json({
        ok: false,
        error: 'No synthesis performed - not enough events in buffer',
      });
    }

    // Apply the synthesis result to the database
    const applied = await applySynthesisResult(result, taskStore);

    // Add to history
    const historyEntry: SynthesisHistoryEntry = {
      timestamp: new Date().toISOString(),
      tasksCreated: applied.tasksCreated,
      tasksUpdated: applied.tasksUpdated,
      actionsProposed: applied.actionsProposed,
      eventsProcessed: result.events_fully_processed.length,
      summary: result.synthesis_summary,
    };

    synthesisHistory.unshift(historyEntry);
    if (synthesisHistory.length > MAX_HISTORY) {
      synthesisHistory.pop();
    }

    return NextResponse.json({
      ok: true,
      result: {
        summary: result.synthesis_summary,
        tasksCreated: applied.tasksCreated,
        tasksUpdated: applied.tasksUpdated,
        actionsProposed: applied.actionsProposed,
        eventsProcessed: result.events_fully_processed.length,
        needsMoreContext: result.needs_more_context.length,
        patternsLearned: result.new_patterns.length,
      },
      timestamp: historyEntry.timestamp,
    });
  } catch (e) {
    console.error('[Cortex Synthesis API] Error running synthesis:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to run synthesis' }, { status });
  }
}

// ============================================================================
// GET - Synthesis History
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const history = synthesisHistory.slice(0, limit);

    return NextResponse.json({
      ok: true,
      history,
      total: synthesisHistory.length,
    });
  } catch (e) {
    console.error('[Cortex Synthesis API] Error getting history:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to get synthesis history' }, { status });
  }
}
