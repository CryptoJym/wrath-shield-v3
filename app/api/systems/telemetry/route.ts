/**
 * Systems Telemetry API
 *
 * Aggregates telemetry from all Life OS subsystems:
 * - Working Memory (event buffer)
 * - Synthesis Loop (LLM processing)
 * - Decision Queue (human-in-the-loop)
 * - Learning Bridge (pattern/preference learning)
 * - Cron Jobs (scheduled tasks)
 * - Event Bus (communication channels)
 */

import { NextResponse } from 'next/server';
import { getWorkingMemory } from '@/lib/cortex/working-memory';
import { getSynthesisLoop } from '@/lib/cortex/synthesis-loop';
import { getDecisionQueue } from '@/lib/cortex/decision-queue';
import { getSemanticLearningBridge } from '@/lib/learning/semantic-learning-bridge';
import {
  DEFAULT_CRON_JOBS,
  calculateNextRun,
  calculateOverallHealth,
  type TelemetryData,
  type TelemetryApiResponse,
} from '@/lib/types/systems-telemetry';

// GET /api/systems/telemetry - Get aggregated system telemetry
export async function GET() {
  try {
    const startTime = Date.now();

    // Fetch telemetry from all subsystems in parallel
    const [workingMemoryStats, synthesisStatus, decisionStats, learningStats] = await Promise.all([
      // Working Memory
      (async () => {
        try {
          const wm = getWorkingMemory();
          return await wm.getStats();
        } catch (e) {
          console.warn('[Telemetry] Working memory stats unavailable:', e);
          return null;
        }
      })(),

      // Synthesis Loop
      (async () => {
        try {
          const synthesis = getSynthesisLoop();
          return synthesis.getStatus();
        } catch (e) {
          console.warn('[Telemetry] Synthesis status unavailable:', e);
          return null;
        }
      })(),

      // Decision Queue
      (async () => {
        try {
          const queue = getDecisionQueue();
          return await queue.getStats();
        } catch (e) {
          console.warn('[Telemetry] Decision queue stats unavailable:', e);
          return null;
        }
      })(),

      // Learning Bridge
      (async () => {
        try {
          const bridge = getSemanticLearningBridge();
          return {
            stats: bridge.getStats(),
            recentInsights: bridge.getRecentInsights(5),
          };
        } catch (e) {
          console.warn('[Telemetry] Learning bridge stats unavailable:', e);
          return null;
        }
      })(),
    ]);

    // Calculate next scheduled runs for cron jobs
    const now = new Date();
    const cronJobsWithNext = DEFAULT_CRON_JOBS.map((job) => ({
      ...job,
      nextRun: calculateNextRun(job.schedule, now),
    }));

    const telemetry = {
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,

      // Memory Formation Pipeline
      memoryPipeline: {
        workingMemory: workingMemoryStats
          ? {
              totalEvents: workingMemoryStats.totalEvents,
              unprocessedEvents: workingMemoryStats.unprocessedEvents,
              processedLast24h: workingMemoryStats.processedLast24h,
              oldestEvent: workingMemoryStats.oldestEventTimestamp,
              newestEvent: workingMemoryStats.newestEventTimestamp,
              eventsBySource: workingMemoryStats.eventsBySource,
              bufferUtilization: Math.round(
                (workingMemoryStats.totalEvents / 500) * 100
              ), // 500 is default max
            }
          : null,
        synthesis: synthesisStatus
          ? {
              isRunning: synthesisStatus.isRunning,
              lastSynthesisAt: synthesisStatus.lastSynthesisAt
                ? new Date(synthesisStatus.lastSynthesisAt).toISOString()
                : null,
              eventCount: synthesisStatus.eventCount,
              taskCount: synthesisStatus.taskCount,
              nextSynthesisAt: synthesisStatus.nextSynthesisAt
                ? new Date(synthesisStatus.nextSynthesisAt).toISOString()
                : null,
            }
          : null,
      },

      // Decision Making System
      decisionSystem: decisionStats
        ? {
            pendingDecisions: decisionStats.pending,
            resolvedDecisions: decisionStats.resolved,
            expiredDecisions: decisionStats.expired,
            totalDecisions: decisionStats.total,
            byPriority: decisionStats.byPriority,
            byDomain: decisionStats.byDomain,
            avgResolutionTimeMs: decisionStats.avgResolutionTimeMs,
            pendingCritical:
              (decisionStats.byPriority as any)?.critical || 0,
          }
        : null,

      // Learning & Adaptation
      learningSystem: learningStats
        ? {
            lastLearningCycle: learningStats.stats.lastLearningCycle,
            totalInsights: learningStats.stats.totalInsights,
            appliedInsights: learningStats.stats.appliedInsights,
            insightsByType: learningStats.stats.insightsByType,
            insightsBySource: learningStats.stats.insightsBySource,
            recentInsights: learningStats.recentInsights.map((insight) => ({
              id: insight.id,
              type: insight.type,
              source: insight.source,
              target: insight.target,
              description: insight.description,
              timestamp: insight.timestamp,
              applied: insight.applied,
            })),
          }
        : null,

      // Scheduled Jobs
      cronJobs: cronJobsWithNext,

      // System Health Summary
      health: {
        workingMemoryOnline: !!workingMemoryStats,
        synthesisOnline: !!synthesisStatus,
        decisionQueueOnline: !!decisionStats,
        learningBridgeOnline: !!learningStats,
        overallStatus: calculateOverallHealth(
          !!workingMemoryStats,
          !!synthesisStatus,
          !!decisionStats,
          !!learningStats
        ),
      },
    };

    return NextResponse.json({
      success: true,
      telemetry,
    });
  } catch (error) {
    console.error('[API/Systems/Telemetry] GET failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
