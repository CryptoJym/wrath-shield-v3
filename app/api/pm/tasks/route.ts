/**
 * PM Tasks API - GitHub Native
 *
 * GET /api/pm/tasks - Returns aggregated tasks from GitHub and local
 * POST /api/pm/tasks - Create a new task (GitHub issue or local)
 * PATCH /api/pm/tasks - Update a task (uses intelligent completion for 'done' status)
 * DELETE /api/pm/tasks - Delete a task
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, createTask, updateTask, deleteTask } from '@/lib/pm/integration';
import { completeTaskWithIntelligence } from '@/lib/pm/task-completion';

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
    const {
      title,
      description,
      priority,
      source,
      project_id,
      project_name,
      due_date,
      assignee,
      labels,
      repo_full_name,
    } = body;

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
      project_name,
      due_date,
      assignee,
      labels,
      repo_full_name,
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
    const { id, status, title, description, priority, due_date, assignee, labels, completionNote } = body;

    console.log('[PM Tasks API] PATCH request:', { id, status, title: title?.slice(0, 50) });

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // For GitHub tasks being marked as 'done', use intelligent completion
    if (status === 'done' && id.startsWith('github-')) {
      console.log('[PM Tasks API] Using intelligent completion for GitHub task');
      // Parse the task ID: github-owner-repo-issueNumber
      const parts = id.split('-');
      if (parts.length >= 4) {
        const issueNumber = parseInt(parts[parts.length - 1]);
        const owner = parts[1];
        const repo = parts.slice(2, parts.length - 1).join('-');
        const repoFullName = `${owner}/${repo}`;

        // Get task title from body or fetch it
        const taskTitle = title || `Task #${issueNumber}`;

        // Use intelligent completion
        console.log('[PM Tasks API] Calling completeTaskWithIntelligence:', { taskId: id, repoFullName, issueNumber });
        const result = await completeTaskWithIntelligence({
          taskId: id,
          title: taskTitle,
          description: description || null,
          repoFullName,
          issueNumber,
          completionNote,
        });

        console.log('[PM Tasks API] Intelligent completion result:', result);

        if (result.success) {
          // The GitHub issue is already closed by completeTaskWithIntelligence
          // Just return success - no need to call updateTask again
          console.log('[PM Tasks API] Task completed successfully via intelligent completion');
          return NextResponse.json({
            ok: true,
            task: { id, status: 'done' }, // Return minimal task info
            completion: {
              summary: result.summary,
              commentUrl: result.commentUrl,
            },
          });
        } else {
          // Fall back to regular update if intelligent completion fails
          console.warn('[PM Tasks API] Intelligent completion failed, falling back:', result.error);
        }
      }
    }

    // Regular update for non-completion actions or fallback
    const task = await updateTask(id, {
      status,
      title,
      description,
      priority,
      due_date,
      assignee,
      labels,
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

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    const success = await deleteTask(id);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Failed to delete task or task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: id,
    });
  } catch (error) {
    console.error('[PM Tasks API] Delete error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
