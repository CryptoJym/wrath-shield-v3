/**
 * Proactive Tick Endpoint
 *
 * This endpoint is called by cron (every minute) to:
 * 1. Run any due scheduled tasks
 * 2. Check all threshold monitors against current metrics
 * 3. Return execution results
 *
 * Security: Protected by PROACTIVE_SECRET environment variable
 *
 * Usage:
 *   GET /api/proactive/tick
 *   GET /api/proactive/tick?secret=YOUR_SECRET
 *   Header: X-Proactive-Secret: YOUR_SECRET
 *
 * Cron setup:
 *   * * * * * curl -s "http://localhost:4242/api/proactive/tick?secret=XXX"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProactiveEnablement } from '@/lib/agents/ProactiveEnablement';
import { getMetricsCollector } from '@/lib/agents/MetricsCollector';

// Validate secret token
function validateSecret(request: NextRequest): boolean {
  const secret = process.env.PROACTIVE_SECRET;

  // If no secret configured, allow in development
  if (!secret) {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    console.warn('[ProactiveTick] PROACTIVE_SECRET not configured');
    return false;
  }

  // Check header first
  const headerSecret = request.headers.get('X-Proactive-Secret');
  if (headerSecret === secret) return true;

  // Check query param
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');
  if (querySecret === secret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Validate authentication
  if (!validateSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing secret' },
      { status: 401 }
    );
  }

  try {
    const proactive = getProactiveEnablement();
    await proactive.initialize();

    // 1. Run due scheduled tasks
    const taskResults = await proactive.runDueTasks();

    // 2. Collect current metrics
    const metrics = await getMetricsCollector().collectAll();

    // 3. Check thresholds against metrics
    const thresholdResults = await proactive.checkThresholds(metrics);

    // 4. Get updated status
    const status = await proactive.getStatus();

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      tasks: {
        executed: taskResults.length,
        results: taskResults.map(r => ({
          success: r.success,
          wasExecuted: r.wasExecuted,
          escalationLevel: r.escalationLevel,
          error: r.error,
        })),
      },
      thresholds: {
        triggered: thresholdResults.length,
        results: thresholdResults.map(r => ({
          success: r.success,
          wasExecuted: r.wasExecuted,
          escalationLevel: r.escalationLevel,
          error: r.error,
        })),
      },
      metrics,
      status: {
        taskCount: status.taskCount,
        triggerCount: status.triggerCount,
        monitorCount: status.monitorCount,
        dueTasks: status.dueTasks,
        nextScheduledRun: status.nextScheduledRun,
      },
    });

  } catch (error) {
    console.error('[ProactiveTick] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Tick execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Also support POST for webhook-style cron services
export async function POST(request: NextRequest) {
  return GET(request);
}
