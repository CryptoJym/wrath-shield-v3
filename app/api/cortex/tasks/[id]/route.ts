/**
 * Cognitive Synthesis Engine - Individual Task Operations
 *
 * GET /api/cortex/tasks/[id] - Get single task with full lineage (source events)
 * PATCH /api/cortex/tasks/[id] - Update task properties
 * DELETE /api/cortex/tasks/[id] - Archive task
 * POST /api/cortex/tasks/[id] - Handle proposed actions
 *   Body: { action: 'approve' | 'reject' | 'execute' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { currentUserOrThrow } from '@/lib/auth/user';
import { taskStore } from '@/lib/cortex/task-store';
import { getWorkingMemory } from '@/lib/cortex/working-memory';
import type { UnifiedTask } from '@/lib/cortex/types';

ensureServerOnly('app/api/cortex/tasks/[id]/route');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// GET - Get Task with Full Lineage
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = currentUserOrThrow();
    const taskId = params.id;

    // Get task
    const task = await taskStore.getTask(taskId);

    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }

    // Get source events for full lineage
    const workingMemory = getWorkingMemory();
    const sourceEvents = await workingMemory.getByIds(task.sourceEvents);

    return NextResponse.json({
      ok: true,
      task,
      sourceEvents,
      lineage: {
        eventCount: sourceEvents.length,
        sources: [...new Set(sourceEvents.map((e) => e.source))],
        timeRange: {
          earliest: sourceEvents.reduce(
            (min, e) => (e.timestamp < min ? e.timestamp : min),
            sourceEvents[0]?.timestamp || new Date().toISOString()
          ),
          latest: sourceEvents.reduce(
            (max, e) => (e.timestamp > max ? e.timestamp : max),
            sourceEvents[0]?.timestamp || new Date().toISOString()
          ),
        },
      },
    });
  } catch (e) {
    console.error('[Cortex Tasks API] Error getting task:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to get task' }, { status });
  }
}

// ============================================================================
// PATCH - Update Task
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = currentUserOrThrow();
    const taskId = params.id;

    const body = await request.json();
    const updates = body as Partial<UnifiedTask>;

    // Update task
    const updated = await taskStore.updateTask(taskId, updates);

    return NextResponse.json({
      ok: true,
      task: updated,
      message: 'Task updated successfully',
    });
  } catch (e) {
    console.error('[Cortex Tasks API] Error updating task:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to update task' }, { status });
  }
}

// ============================================================================
// DELETE - Archive Task
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = currentUserOrThrow();
    const taskId = params.id;

    // Archive task (set status to dismissed)
    await taskStore.archiveTask(taskId);

    return NextResponse.json({
      ok: true,
      message: 'Task archived successfully',
    });
  } catch (e) {
    console.error('[Cortex Tasks API] Error archiving task:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to archive task' }, { status });
  }
}

// ============================================================================
// POST - Handle Proposed Actions
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = currentUserOrThrow();
    const taskId = params.id;

    const body = await request.json();
    const { action } = body as { action: 'approve' | 'reject' | 'execute' };

    if (!action) {
      return NextResponse.json({ ok: false, error: 'Missing action parameter' }, { status: 400 });
    }

    // Get task
    const task = await taskStore.getTask(taskId);

    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }

    if (!task.proposedAction) {
      return NextResponse.json(
        { ok: false, error: 'Task has no proposed action' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'approve': {
        // Mark action as approved (ready for execution)
        const updated = await taskStore.updateTask(taskId, {
          status: 'approved',
        });

        return NextResponse.json({
          ok: true,
          task: updated,
          message: 'Action approved - ready for execution',
        });
      }

      case 'reject': {
        // Remove proposed action and mark task as ready
        const updated = await taskStore.updateTask(taskId, {
          proposedAction: undefined,
          status: 'ready',
        });

        return NextResponse.json({
          ok: true,
          task: updated,
          message: 'Action rejected',
        });
      }

      case 'execute': {
        // TODO: Actually execute the action via agent executor
        // For now, just mark as executed and update status

        const updatedAction = {
          ...task.proposedAction,
          executed: true,
          executedAt: new Date().toISOString(),
          executionResult: {
            success: true,
            message: 'Action execution not yet implemented',
          },
        };

        const updated = await taskStore.updateTask(taskId, {
          proposedAction: updatedAction,
          status: 'executing',
        });

        return NextResponse.json({
          ok: true,
          task: updated,
          message: 'Action execution initiated (not yet implemented)',
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e) {
    console.error('[Cortex Tasks API] Error handling action:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to handle action' }, { status });
  }
}
