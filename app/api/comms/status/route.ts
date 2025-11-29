/**
 * Comms Status API
 *
 * GET /api/comms/status - Returns pipeline health and metrics
 *
 * Returns:
 * - Source health (last sync times, error counts)
 * - Recent routed items
 * - Pending by target (finance/legal/pm/ea)
 * - Junk counts
 * - Pipeline metrics (classifications, routing accuracy)
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { listRecentEvents } from '@/lib/events';
import { getPipelineMetrics, getPipelineLogs } from '@/lib/comms/pipeline';
import { getAllContextRequests, getPendingCountByTarget } from '@/lib/context_requests';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SourceHealth {
  source: string;
  last_sync: number | null;
  event_count: number;
  error_count: number;
  status: 'healthy' | 'stale' | 'error' | 'unknown';
}

export async function GET() {
  try {
    const { userId } = currentUserOrThrow();

    // Get recent events for source health analysis
    const recentEvents = listRecentEvents(500, userId);

    // Calculate source health
    const sourceHealthMap = new Map<string, SourceHealth>();
    const now = Math.floor(Date.now() / 1000);
    const staleThreshold = 3600; // 1 hour

    for (const event of recentEvents) {
      const source = event.source;

      if (!sourceHealthMap.has(source)) {
        sourceHealthMap.set(source, {
          source,
          last_sync: event.ts,
          event_count: 0,
          error_count: 0,
          status: 'unknown',
        });
      }

      const health = sourceHealthMap.get(source)!;
      health.event_count++;

      // Update last sync if more recent
      if (event.ts > (health.last_sync || 0)) {
        health.last_sync = event.ts;
      }
    }

    // Determine health status
    const sourceHealth: SourceHealth[] = Array.from(sourceHealthMap.values()).map((health) => {
      if (!health.last_sync) {
        health.status = 'unknown';
      } else if (now - health.last_sync > staleThreshold) {
        health.status = 'stale';
      } else {
        health.status = 'healthy';
      }
      return health;
    });

    // Get recent routed items
    const routedEvents = recentEvents
      .filter((e) => e.routed_target)
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        source: e.source,
        channel: e.channel,
        subject: e.subject || e.preview?.slice(0, 50),
        routed_to: e.routed_target,
        ts: e.ts,
        confidence: e.confidence,
        classification: e.classification,
      }));

    // Get pending counts by target
    const pendingByTarget = getPendingCountByTarget();

    // Get pipeline metrics
    const pipelineMetrics = getPipelineMetrics();

    // Get recent pipeline logs
    const recentLogs = getPipelineLogs(20);

    // Calculate classification accuracy (events with high confidence)
    const classifiedEvents = recentEvents.filter((e) => e.classification);
    const highConfidenceCount = classifiedEvents.filter((e) => (e.confidence || 0) >= 0.7).length;
    const classificationAccuracy = classifiedEvents.length > 0 ? highConfidenceCount / classifiedEvents.length : 0;

    // Count items needing review
    const needsReviewCount = recentEvents.filter((e) => e.needs_review === 1).length;

    // Count junk items
    const junkCount = recentEvents.filter((e) => e.junk === 1).length;

    // Calculate source distribution
    const sourceDistribution = sourceHealth.reduce(
      (acc, s) => {
        acc[s.source] = s.event_count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Build response
    const response = {
      status: 'ok',
      timestamp: Date.now(),
      source_health: sourceHealth,
      recent_routed: routedEvents,
      pending_by_target: pendingByTarget,
      pipeline_metrics: {
        total_processed: pipelineMetrics.total_processed,
        by_category: pipelineMetrics.by_category,
        by_source: sourceDistribution,
        avg_confidence: pipelineMetrics.avg_confidence,
        classification_accuracy: classificationAccuracy,
        needs_review_count: needsReviewCount,
        junk_count: junkCount,
        routed_count: pipelineMetrics.routed_count,
        dedupe_hits: pipelineMetrics.dedupe_hits,
        last_updated: pipelineMetrics.last_updated,
      },
      recent_logs: recentLogs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        event_id: log.event_id.slice(0, 8),
        stage: log.stage,
        action: log.action,
        success: log.success,
        details: log.details,
      })),
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error('[Comms Status API] Error:', e);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'Failed to get comms status' }, { status });
  }
}
