/**
 * Scheduler Task Management API
 * GET /api/scheduler/tasks/[taskId] - Get task details
 * PATCH /api/scheduler/tasks/[taskId] - Enable/disable task
 * DELETE /api/scheduler/tasks/[taskId] - Unregister task
 */

import { NextRequest } from 'next/server';
import { getScheduler } from '@/lib/scheduler';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const scheduler = getScheduler();
    const task = scheduler.getTask(params.taskId);

    if (!task) {
      return Response.json(
        {
          success: false,
          error: 'Task not found'
        },
        { status: 404 }
      );
    }

    // Sanitize task for API response
    const sanitizedTask = {
      id: task.id,
      name: task.name,
      description: task.description,
      cronExpression: task.cronExpression,
      enabled: task.enabled,
      lastRun: task.lastRun?.toISOString(),
      nextRun: task.nextRun?.toISOString()
    };

    return Response.json({
      success: true,
      data: sanitizedTask
    });
  } catch (error) {
    console.error('[Scheduler API] Failed to get task:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get task'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return Response.json(
        {
          success: false,
          error: 'Invalid request: enabled must be a boolean'
        },
        { status: 400 }
      );
    }

    const scheduler = getScheduler();

    if (enabled) {
      scheduler.enableTask(params.taskId);
    } else {
      scheduler.disableTask(params.taskId);
    }

    const task = scheduler.getTask(params.taskId);

    if (!task) {
      return Response.json(
        {
          success: false,
          error: 'Task not found'
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        id: task.id,
        name: task.name,
        enabled: task.enabled
      }
    });
  } catch (error) {
    console.error('[Scheduler API] Failed to update task:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const scheduler = getScheduler();

    // Check if task exists
    const task = scheduler.getTask(params.taskId);
    if (!task) {
      return Response.json(
        {
          success: false,
          error: 'Task not found'
        },
        { status: 404 }
      );
    }

    scheduler.unregisterTask(params.taskId);

    return Response.json({
      success: true,
      data: {
        message: `Task ${params.taskId} unregistered successfully`
      }
    });
  } catch (error) {
    console.error('[Scheduler API] Failed to delete task:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete task'
      },
      { status: 500 }
    );
  }
}
