/**
 * Shared types for Systems Telemetry
 *
 * These types are used by both the API route and the frontend page
 * to ensure type safety across the stack.
 */

/**
 * Working memory statistics
 */
export interface WorkingMemoryStats {
  totalEvents: number;
  unprocessedEvents: number;
  processedLast24h: number;
  oldestEvent: string | null;
  newestEvent: string | null;
  eventsBySource: Record<string, number>;
  bufferUtilization: number;
}

/**
 * Synthesis engine status
 */
export interface SynthesisStatus {
  isRunning: boolean;
  lastSynthesisAt: string | null;
  eventCount: number;
  taskCount: number;
  nextSynthesisAt: string | null;
}

/**
 * Decision system statistics
 */
export interface DecisionSystemStats {
  pendingDecisions: number;
  resolvedDecisions: number;
  expiredDecisions: number;
  totalDecisions: number;
  byPriority: Record<string, number>;
  byDomain: Record<string, number>;
  avgResolutionTimeMs: number;
  pendingCritical: number;
}

/**
 * Learning insight
 */
export interface LearningInsightSummary {
  id: string;
  type: string;
  source: string;
  target: string;
  description: string;
  timestamp: string;
  applied: boolean;
}

/**
 * Learning system statistics
 */
export interface LearningSystemStats {
  lastLearningCycle: number | null;
  totalInsights: number;
  appliedInsights: number;
  insightsByType: Record<string, number>;
  insightsBySource: Record<string, number>;
  recentInsights: LearningInsightSummary[];
}

/**
 * Cron job definition
 */
export interface CronJobInfo {
  name: string;
  schedule: string;
  description: string;
  nextRun: string | null;
}

/**
 * System health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'critical';

/**
 * System health summary
 */
export interface SystemHealth {
  workingMemoryOnline: boolean;
  synthesisOnline: boolean;
  decisionQueueOnline: boolean;
  learningBridgeOnline: boolean;
  overallStatus: HealthStatus;
}

/**
 * Complete telemetry data structure
 */
export interface TelemetryData {
  timestamp: string;
  latencyMs: number;
  memoryPipeline: {
    workingMemory: WorkingMemoryStats | null;
    synthesis: SynthesisStatus | null;
  };
  decisionSystem: DecisionSystemStats | null;
  learningSystem: LearningSystemStats | null;
  cronJobs: CronJobInfo[];
  health: SystemHealth;
}

/**
 * API response for telemetry endpoint
 */
export interface TelemetryApiResponse {
  success: boolean;
  telemetry?: TelemetryData;
  error?: string;
}

/**
 * Calculate overall system health based on subsystem availability
 */
export function calculateOverallHealth(
  workingMemory: boolean,
  synthesis: boolean,
  decisions: boolean,
  learning: boolean
): HealthStatus {
  const onlineCount = [workingMemory, synthesis, decisions, learning].filter(Boolean).length;

  if (onlineCount === 4) return 'healthy';
  if (onlineCount >= 2) return 'degraded';
  return 'critical';
}

/**
 * Calculate next run time from cron expression
 * @param schedule - Cron expression (5 parts: minute hour day month weekday)
 * @param now - Current date/time
 * @returns ISO string of next run time, or null if unable to calculate
 */
export function calculateNextRun(schedule: string, now: Date): string | null {
  try {
    const parts = schedule.split(' ');
    if (parts.length !== 5) return null;

    const [minute] = parts;
    const next = new Date(now);

    // Handle common patterns
    if (schedule === '* * * * *') {
      // Every minute
      next.setSeconds(0);
      next.setMilliseconds(0);
      next.setMinutes(next.getMinutes() + 1);
      return next.toISOString();
    }

    if (minute.startsWith('*/')) {
      // Every N minutes
      const interval = parseInt(minute.substring(2), 10);
      if (isNaN(interval) || interval <= 0) return null;

      const currentMinute = next.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
      next.setSeconds(0);
      next.setMilliseconds(0);
      if (nextMinute >= 60) {
        next.setHours(next.getHours() + 1);
        next.setMinutes(nextMinute - 60);
      } else {
        next.setMinutes(nextMinute);
      }
      return next.toISOString();
    }

    // For specific minute schedules like "20 * * * *" (minute 20 of every hour)
    const specificMinute = parseInt(minute, 10);
    if (!isNaN(specificMinute) && specificMinute >= 0 && specificMinute < 60) {
      next.setSeconds(0);
      next.setMilliseconds(0);
      if (next.getMinutes() >= specificMinute) {
        // Move to next hour
        next.setHours(next.getHours() + 1);
      }
      next.setMinutes(specificMinute);
      return next.toISOString();
    }

    // For complex patterns, return approximate next hour
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next.toISOString();
  } catch {
    return null;
  }
}

/**
 * Format time until next occurrence
 */
export function formatTimeUntil(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

/**
 * Default cron job definitions
 */
export const DEFAULT_CRON_JOBS: Omit<CronJobInfo, 'nextRun'>[] = [
  { name: 'proactive-tick', schedule: '* * * * *', description: 'Proactive agent tick' },
  { name: 'legal-hourly', schedule: '20 * * * *', description: 'Legal pipeline check' },
  { name: 'lifelog-hourly', schedule: '0 4-23 * * *', description: 'Limitless lifelog sync' },
  { name: 'digest-morning', schedule: '5 7 * * *', description: 'Daily morning digest' },
  { name: 'finance-daily', schedule: '30 6 * * *', description: 'Finance ingestion' },
  { name: 'cortex-synthesis', schedule: '*/5 * * * *', description: 'Cortex synthesis loop' },
  { name: 'decision-queue-maintenance', schedule: '0 3 * * *', description: 'Decision queue cleanup' },
  { name: 'imessage-sync', schedule: '*/15 * * * *', description: 'iMessage ingestion' },
  { name: 'semantic-learning', schedule: '30 */2 * * *', description: 'Semantic learning cycle' },
];
