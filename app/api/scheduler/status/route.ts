/**
 * Scheduler Status API
 * GET /api/scheduler/status
 *
 * Returns the current status of the Life OS Scheduler
 */

import { NextRequest } from 'next/server';
import { getScheduler } from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  try {
    const scheduler = getScheduler();
    const status = scheduler.getStatus();

    return Response.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Scheduler API] Failed to get status:', error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scheduler status'
      },
      { status: 500 }
    );
  }
}
