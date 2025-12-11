/**
 * Scheduler Tasks API
 * GET /api/scheduler/tasks
 *
 * Returns all registered tasks
 */

import { NextRequest } from 'next/server';
import { getScheduler } from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  try {
    const scheduler = getScheduler();
    const tasks = scheduler.getAllTasks();

    // Sanitize tasks for API response (remove handler functions)
    const sanitizedTasks = tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      cronExpression: task.cronExpression,
      enabled: task.enabled,
      lastRun: task.lastRun?.toISOString(),
      nextRun: task.nextRun?.toISOString()
    }));

    return Response.json({
      success: true,
      data: {
        tasks: sanitizedTasks,
        count: sanitizedTasks.length
      }
    });
  } catch (error) {
    console.error('[Scheduler API] Failed to get tasks:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tasks'
      },
      { status: 500 }
    );
  }
}
