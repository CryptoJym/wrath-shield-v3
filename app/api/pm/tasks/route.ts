/**
 * PM Tasks API
 *
 * GET /api/pm/tasks - Returns aggregated tasks from GitHub, Motion, and local
 * POST /api/pm/tasks - Create a new task
 * PATCH /api/pm/tasks - Update a task
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, createTask, updateTask } from '@/lib/pm/integration';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tasks = await getAllTasks();

    return NextResponse.json({
      ok: true,
      count: tasks.length,
      tasks,
      sources: {
        github: tasks.filter(t => t.source === 'github').length,
        motion: tasks.filter(t => t.source === 'motion').length,
        local: tasks.filter(t => t.source === 'local').length,
      },
    });
  } catch (error) {
    console.error('[PM Tasks API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, priority, source, project_id } = body;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    const task = await createTask({
      title,
      description,
      priority,
      source,
      project_id,
    });

    if (!task) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create task' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      task,
    });
  } catch (error) {
    console.error('[PM Tasks API] Create error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, title, description, priority } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const task = await updateTask(id, {
      status,
      title,
      description,
      priority,
    });

    if (!task) {
      return NextResponse.json(
        { ok: false, error: 'Failed to update task' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      task,
    });
  } catch (error) {
    console.error('[PM Tasks API] Update error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
