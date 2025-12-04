/**
 * Proactive Status Endpoint
 *
 * Returns the current status of all proactive components:
 * - Scheduled tasks
 * - Event triggers
 * - Threshold monitors
 * - Action history
 * - Current metrics
 *
 * Usage:
 *   GET /api/proactive/status
 *   GET /api/proactive/status?include=tasks,triggers,monitors,history,metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProactiveEnablement } from '@/lib/agents/ProactiveEnablement';
import { getMetricsCollector, METRIC_DEFINITIONS } from '@/lib/agents/MetricsCollector';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeParam = searchParams.get('include');
    const historyLimit = parseInt(searchParams.get('historyLimit') || '20', 10);

    // Parse what to include (default: all)
    const includeAll = !includeParam;
    const include = new Set(includeParam?.split(',') || []);

    const proactive = getProactiveEnablement();
    await proactive.initialize();

    const response: any = {
      timestamp: new Date().toISOString(),
    };

    // Get system status
    const status = await proactive.getStatus();
    response.summary = {
      initialized: status.initialized,
      taskCount: status.taskCount,
      triggerCount: status.triggerCount,
      monitorCount: status.monitorCount,
      dueTasks: status.dueTasks,
      recentActions: status.recentActions,
      nextScheduledRun: status.nextScheduledRun,
    };

    // Include scheduled tasks
    if (includeAll || include.has('tasks')) {
      const tasks = proactive.getScheduledTasks();
      response.tasks = tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        agentId: task.agentId,
        frequency: task.frequency,
        enabled: task.enabled,
        lastRun: task.lastRun,
        nextRun: task.nextRun,
        runCount: task.runCount,
        failCount: task.failCount,
        action: {
          type: task.action.type,
          escalationLevel: task.action.escalationLevel,
          confidence: task.action.confidence,
          description: task.action.description,
        },
      }));
    }

    // Include event triggers
    if (includeAll || include.has('triggers')) {
      const triggers = proactive.getEventTriggers();
      response.triggers = triggers.map(trigger => ({
        id: trigger.id,
        name: trigger.name,
        type: trigger.type,
        agentId: trigger.agentId,
        conditions: trigger.conditions,
        enabled: trigger.enabled,
        triggerCount: trigger.triggerCount,
        lastTriggered: trigger.lastTriggered,
        action: {
          type: trigger.action.type,
          escalationLevel: trigger.action.escalationLevel,
          confidence: trigger.action.confidence,
          description: trigger.action.description,
        },
      }));
    }

    // Include threshold monitors
    if (includeAll || include.has('monitors')) {
      const monitors = proactive.getThresholdMonitors();
      response.monitors = monitors.map(monitor => ({
        id: monitor.id,
        name: monitor.name,
        agentId: monitor.agentId,
        metric: monitor.metric,
        threshold: monitor.threshold,
        comparison: monitor.comparison,
        enabled: monitor.enabled,
        currentValue: monitor.currentValue,
        lastAlert: monitor.lastAlert,
        alertCount: monitor.alertCount,
        cooldownMs: monitor.cooldownMs,
        action: {
          type: monitor.action.type,
          escalationLevel: monitor.action.escalationLevel,
          confidence: monitor.action.confidence,
          description: monitor.action.description,
        },
      }));
    }

    // Include action history
    if (includeAll || include.has('history')) {
      const history = proactive.getActionHistory(historyLimit);
      response.history = history;
    }

    // Include current metrics
    if (includeAll || include.has('metrics')) {
      const metricsCollector = getMetricsCollector();
      const metrics = await metricsCollector.collectAll();
      response.metrics = metrics;
      response.metricDefinitions = METRIC_DEFINITIONS;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[ProactiveStatus] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get proactive status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
