/**
 * Cognitive Synthesis Engine - Unified Tasks CRUD
 *
 * GET /api/cortex/tasks - List tasks with filters
 * Query params: ?status=active&domain=legal&minConfidence=0.5&limit=50&offset=0
 *
 * POST /api/cortex/tasks - Create manual task (bypassing synthesis)
 * Body: { title, description, domain, urgency, confidence, sourceEvents? }
 *
 * PATCH /api/cortex/tasks - Bulk update tasks
 * Body: { taskIds: string[], updates: Partial<UnifiedTask> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { currentUserOrThrow } from '@/lib/auth/user';
import { taskStore } from '@/lib/cortex/task-store';
import type { UnifiedTask, UnifiedTaskStatus, UrgencyLevel, TaskQuery } from '@/lib/cortex/types';
import type { Domain } from '@/lib/ea/preference-model';

ensureServerOnly('app/api/cortex/tasks/route');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// GET - List Tasks
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const { searchParams } = new URL(request.url);

    // Build query from search params
    const query: TaskQuery = {};

    // Status filter (can be comma-separated)
    const statusParam = searchParams.get('status');
    if (statusParam) {
      query.status = statusParam.includes(',')
        ? (statusParam.split(',') as UnifiedTaskStatus[])
        : (statusParam as UnifiedTaskStatus);
    }

    // Domain filter (can be comma-separated)
    const domainParam = searchParams.get('domain');
    if (domainParam) {
      query.domain = domainParam.includes(',')
        ? (domainParam.split(',') as Domain[])
        : (domainParam as Domain);
    }

    // Urgency filter (can be comma-separated)
    const urgencyParam = searchParams.get('urgency');
    if (urgencyParam) {
      query.urgency = urgencyParam.includes(',')
        ? (urgencyParam.split(',') as UrgencyLevel[])
        : (urgencyParam as UrgencyLevel);
    }

    // Minimum confidence
    const minConfidenceParam = searchParams.get('minConfidence');
    if (minConfidenceParam) {
      query.minConfidence = parseFloat(minConfidenceParam);
    }

    // Sorting
    const sortBy = searchParams.get('sortBy') as TaskQuery['sortBy'];
    if (sortBy) {
      query.sortBy = sortBy;
    }

    const sortDirection = searchParams.get('sortDirection') as 'asc' | 'desc';
    if (sortDirection) {
      query.sortDirection = sortDirection;
    }

    // Pagination
    const limitParam = searchParams.get('limit');
    if (limitParam) {
      query.limit = parseInt(limitParam, 10);
    }

    const offsetParam = searchParams.get('offset');
    if (offsetParam) {
      query.offset = parseInt(offsetParam, 10);
    }

    // Get tasks
    const tasks = await taskStore.getTasks(query);

    return NextResponse.json({
      ok: true,
      tasks,
      total: tasks.length,
      query,
    });
  } catch (e) {
    console.error('[Cortex Tasks API] Error listing tasks:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to list tasks' }, { status });
  }
}

// ============================================================================
// POST - Create Manual Task
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const body = await request.json();
    const { title, description, domain, urgency, confidence, sourceEvents, proposedAction } = body;

    // Validate required fields
    if (!title || !description || !domain || !urgency || confidence === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields: title, description, domain, urgency, confidence',
        },
        { status: 400 }
      );
    }

    // Create task
    const task = await taskStore.createTask({
      title,
      description,
      domain,
      urgency,
      confidence,
      sourceEvents: sourceEvents || [],
      proposedAction,
      status: 'ready',
      createdAt: new Date().toISOString(),
      refinementCount: 0,
    });

    return NextResponse.json({
      ok: true,
      task,
      message: 'Task created successfully',
    });
  } catch (e) {
    console.error('[Cortex Tasks API] Error creating task:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to create task' }, { status });
  }
}

// ============================================================================
// PATCH - Bulk Update Tasks
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const body = await request.json();
    const { taskIds, updates } = body as {
      taskIds: string[];
      updates: Partial<UnifiedTask>;
    };

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid taskIds' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ ok: false, error: 'Missing or invalid updates' }, { status: 400 });
    }

    // Update each task
    const updatedTasks: UnifiedTask[] = [];
    for (const taskId of taskIds) {
      const updated = await taskStore.updateTask(taskId, updates);
      updatedTasks.push(updated);
    }

    return NextResponse.json({
      ok: true,
      tasks: updatedTasks,
      updated: updatedTasks.length,
    });
  } catch (e) {
    console.error('[Cortex Tasks API] Error updating tasks:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to update tasks' }, { status });
  }
}
