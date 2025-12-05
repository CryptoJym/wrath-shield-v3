/**
 * Stale Task Detection System
 *
 * Proactively identifies tasks that haven't been updated in too long,
 * preventing work from falling through the cracks.
 *
 * Features:
 * - Priority-based staleness thresholds
 * - Project-specific overrides
 * - Severity escalation (info → warning → critical)
 * - Per-task cooldown to prevent alert fatigue
 * - Integration with background jobs system
 */

import { ensureServerOnly } from '@/lib/server-only-guard';
import { getDatabase } from '@/lib/db/Database';
import { getAllTasks } from '../integration';
import type { UnifiedTask, TaskPriority } from '../types';

ensureServerOnly('lib/pm/alerts/stale-task-detector');

// ============================================================================
// Constants and Configuration
// ============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StalenessConfig {
  // Days without update before considered stale (by priority)
  thresholds: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
    none: number;
  };

  // Project-specific overrides (project_name -> days)
  project_overrides?: Record<string, number>;

  // Severity calculation thresholds (as percentage of base threshold)
  severity_thresholds: {
    info: number;      // Early warning (default: 75% of threshold)
    warning: number;   // Past threshold (default: 100%)
    critical: number;  // Way overdue (default: 150%)
  };

  // Cooldown periods (hours between alerts of same severity)
  cooldown_hours: {
    info: number;
    warning: number;
    critical: number;
  };
}

export const DEFAULT_STALENESS_CONFIG: StalenessConfig = {
  thresholds: {
    urgent: 1,      // Urgent tasks stale after 1 day
    high: 3,        // High priority after 3 days
    medium: 7,      // Medium after 7 days
    low: 14,        // Low after 14 days
    none: 30,       // No priority after 30 days
  },

  project_overrides: {
    'research': 14,     // Research projects have longer cycles
    'backlog': 30,      // Backlog items intentionally deferred
    'ideas': 60,        // Ideas can percolate
  },

  severity_thresholds: {
    info: 0.75,      // Alert at 75% of threshold
    warning: 1.0,    // Alert at 100% of threshold
    critical: 1.5,   // Alert at 150% of threshold
  },

  cooldown_hours: {
    info: 24,        // Can re-alert info after 24 hours
    warning: 24,     // Can re-alert warning after 24 hours
    critical: 12,    // Can re-alert critical after 12 hours (more urgent)
  },
};

export interface StaleTaskAlert {
  task_id: string;
  task_title: string;
  task_source: 'github' | 'local';
  days_stale: number;
  priority: TaskPriority;
  project?: string;
  last_activity: string;
  suggested_action: string;
  severity: 'info' | 'warning' | 'critical';

  // Context for rich alerts
  context: {
    threshold_days: number;
    percentage_over: number;
    url?: string;
    assignee?: string;
    status: string;
  };
}

interface AlertCooldown {
  task_id: string;
  last_alert_time: number;
  last_alert_severity: 'info' | 'warning' | 'critical';
  alert_count: number;
}

// ============================================================================
// Database Schema
// ============================================================================

function ensureCooldownTable(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_alert_cooldowns (
      task_id TEXT PRIMARY KEY,
      last_alert_time INTEGER NOT NULL,
      last_alert_severity TEXT NOT NULL,
      alert_count INTEGER DEFAULT 1,

      CHECK (last_alert_severity IN ('info', 'warning', 'critical'))
    );

    CREATE INDEX IF NOT EXISTS idx_alert_cooldowns_time ON pm_alert_cooldowns(last_alert_time);
  `);
}

// ============================================================================
// Core Detection Logic
// ============================================================================

/**
 * Get the staleness threshold for a task based on priority and project
 */
function getThreshold(
  priority: TaskPriority,
  projectName: string | null,
  config: StalenessConfig
): number {
  // Check for project override first
  if (projectName && config.project_overrides?.[projectName.toLowerCase()]) {
    return config.project_overrides[projectName.toLowerCase()];
  }

  // Fall back to priority-based threshold
  return config.thresholds[priority];
}

/**
 * Calculate severity based on how far over threshold the task is
 */
function calculateSeverity(
  percentageStale: number,
  config: StalenessConfig
): 'info' | 'warning' | 'critical' | null {
  if (percentageStale < config.severity_thresholds.info) {
    return null; // Not stale enough yet
  }

  if (percentageStale < config.severity_thresholds.warning) {
    return 'info';
  }

  if (percentageStale < config.severity_thresholds.critical) {
    return 'warning';
  }

  return 'critical';
}

/**
 * Generate suggested action text based on severity and task context
 */
function getSuggestedAction(
  severity: 'info' | 'warning' | 'critical',
  task: UnifiedTask,
  daysStale: number
): string {
  const taskType = task.source === 'github' ? 'issue' : 'task';

  switch (severity) {
    case 'info':
      return `Task approaching staleness (${daysStale} days). Consider updating or closing.`;

    case 'warning':
      return `Task is stale (${daysStale} days with no activity). Needs update, progress, or should be moved to backlog.`;

    case 'critical':
      return `URGENT: Task critically stale (${daysStale} days). Immediate action required: update status, escalate, or close.`;
  }
}

/**
 * Get cooldown state for a task
 */
function getCooldown(taskId: string): AlertCooldown | null {
  ensureCooldownTable();

  const db = getDatabase().getRawDb();
  const row = db.prepare(`
    SELECT * FROM pm_alert_cooldowns WHERE task_id = ?
  `).get(taskId) as any;

  if (!row) return null;

  return {
    task_id: row.task_id,
    last_alert_time: row.last_alert_time,
    last_alert_severity: row.last_alert_severity,
    alert_count: row.alert_count,
  };
}

/**
 * Check if cooldown has expired for a given severity
 */
function isCooldownExpired(
  cooldown: AlertCooldown,
  newSeverity: 'info' | 'warning' | 'critical',
  config: StalenessConfig
): boolean {
  const now = Date.now();
  const cooldownMs = config.cooldown_hours[newSeverity] * 60 * 60 * 1000;
  const timeSinceLastAlert = now - cooldown.last_alert_time;

  // Allow escalation to higher severity even if cooldown not expired
  const severityOrder = { info: 1, warning: 2, critical: 3 };
  if (severityOrder[newSeverity] > severityOrder[cooldown.last_alert_severity]) {
    return true;
  }

  return timeSinceLastAlert >= cooldownMs;
}

/**
 * Update or create cooldown entry for a task
 */
function updateCooldown(
  taskId: string,
  severity: 'info' | 'warning' | 'critical'
): void {
  ensureCooldownTable();

  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  // Check if exists
  const existing = db.prepare(`
    SELECT alert_count FROM pm_alert_cooldowns WHERE task_id = ?
  `).get(taskId) as any;

  if (existing) {
    // Update existing
    db.prepare(`
      UPDATE pm_alert_cooldowns
      SET last_alert_time = @time, last_alert_severity = @severity, alert_count = alert_count + 1
      WHERE task_id = @task_id
    `).run({
      task_id: taskId,
      time: now,
      severity,
    });
  } else {
    // Insert new
    db.prepare(`
      INSERT INTO pm_alert_cooldowns (task_id, last_alert_time, last_alert_severity, alert_count)
      VALUES (@task_id, @time, @severity, 1)
    `).run({
      task_id: taskId,
      time: now,
      severity,
    });
  }
}

/**
 * Clear cooldown for a task (e.g., when task is updated)
 */
export function clearTaskCooldown(taskId: string): boolean {
  ensureCooldownTable();

  const db = getDatabase().getRawDb();
  const result = db.prepare(`
    DELETE FROM pm_alert_cooldowns WHERE task_id = ?
  `).run(taskId);

  return result.changes > 0;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect stale tasks across all sources
 */
export async function detectStaleTasks(
  config: Partial<StalenessConfig> = {}
): Promise<StaleTaskAlert[]> {
  ensureCooldownTable();

  // Merge with default config
  const fullConfig: StalenessConfig = {
    ...DEFAULT_STALENESS_CONFIG,
    ...config,
    thresholds: {
      ...DEFAULT_STALENESS_CONFIG.thresholds,
      ...config.thresholds,
    },
    severity_thresholds: {
      ...DEFAULT_STALENESS_CONFIG.severity_thresholds,
      ...config.severity_thresholds,
    },
    cooldown_hours: {
      ...DEFAULT_STALENESS_CONFIG.cooldown_hours,
      ...config.cooldown_hours,
    },
  };

  console.log('[Stale Task Detector] Starting detection with config:', JSON.stringify(fullConfig, null, 2));

  // Fetch all tasks
  const allTasks = await getAllTasks();
  console.log(`[Stale Task Detector] Fetched ${allTasks.length} total tasks`);

  // Filter to active tasks only
  const activeTasks = allTasks.filter(task =>
    task.status === 'in_progress' || task.status === 'pending'
  );
  console.log(`[Stale Task Detector] Filtered to ${activeTasks.length} active tasks`);

  const alerts: StaleTaskAlert[] = [];
  const now = Date.now();

  for (const task of activeTasks) {
    try {
      // Calculate days since last update
      const lastUpdate = new Date(task.updated_at).getTime();
      const daysSinceUpdate = (now - lastUpdate) / MS_PER_DAY;

      // Get threshold for this task
      const threshold = getThreshold(task.priority, task.project_name, fullConfig);

      // Calculate percentage staleness
      const percentageStale = daysSinceUpdate / threshold;

      // Determine severity
      const severity = calculateSeverity(percentageStale, fullConfig);

      if (!severity) {
        // Not stale enough yet
        continue;
      }

      // Check cooldown
      const cooldown = getCooldown(task.id);
      if (cooldown && !isCooldownExpired(cooldown, severity, fullConfig)) {
        console.log(`[Stale Task Detector] Skipping ${task.id} - cooldown not expired`);
        continue;
      }

      // Create alert
      const alert: StaleTaskAlert = {
        task_id: task.id,
        task_title: task.title,
        task_source: task.source,
        days_stale: Math.floor(daysSinceUpdate),
        priority: task.priority,
        project: task.project_name || undefined,
        last_activity: task.updated_at,
        suggested_action: getSuggestedAction(severity, task, Math.floor(daysSinceUpdate)),
        severity,
        context: {
          threshold_days: threshold,
          percentage_over: Math.round((percentageStale - 1) * 100),
          url: task.url || undefined,
          assignee: task.assignee || undefined,
          status: task.status,
        },
      };

      alerts.push(alert);

      // Update cooldown
      updateCooldown(task.id, severity);

      console.log(`[Stale Task Detector] Alert created: ${task.id} - ${severity} - ${Math.floor(daysSinceUpdate)} days`);
    } catch (error) {
      console.error(`[Stale Task Detector] Error processing task ${task.id}:`, error);
      // Continue processing other tasks
    }
  }

  console.log(`[Stale Task Detector] Detection complete: ${alerts.length} alerts created`);

  // Sort by severity (critical first) then by days stale
  alerts.sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.days_stale - a.days_stale;
  });

  return alerts;
}

/**
 * Get tasks approaching staleness (early warning)
 * Useful for daily digest "upcoming stale tasks" section
 */
export async function getTasksApproachingStaleness(
  warningThreshold: number = 0.75,
  config: Partial<StalenessConfig> = {}
): Promise<StaleTaskAlert[]> {
  ensureCooldownTable();

  // Merge with default config
  const fullConfig: StalenessConfig = {
    ...DEFAULT_STALENESS_CONFIG,
    ...config,
    thresholds: {
      ...DEFAULT_STALENESS_CONFIG.thresholds,
      ...config.thresholds,
    },
    severity_thresholds: {
      info: warningThreshold,  // Override to custom warning threshold
      warning: 1.0,
      critical: 1.5,
    },
    cooldown_hours: {
      ...DEFAULT_STALENESS_CONFIG.cooldown_hours,
      ...config.cooldown_hours,
    },
  };

  console.log(`[Stale Task Detector] Checking tasks approaching staleness (${warningThreshold * 100}% threshold)`);

  // Fetch all tasks
  const allTasks = await getAllTasks();

  // Filter to active tasks only
  const activeTasks = allTasks.filter(task =>
    task.status === 'in_progress' || task.status === 'pending'
  );

  const approachingTasks: StaleTaskAlert[] = [];
  const now = Date.now();

  for (const task of activeTasks) {
    try {
      // Calculate days since last update
      const lastUpdate = new Date(task.updated_at).getTime();
      const daysSinceUpdate = (now - lastUpdate) / MS_PER_DAY;

      // Get threshold for this task
      const threshold = getThreshold(task.priority, task.project_name, fullConfig);

      // Calculate percentage staleness
      const percentageStale = daysSinceUpdate / threshold;

      // Only include tasks between warning threshold and actual staleness
      if (percentageStale >= warningThreshold && percentageStale < 1.0) {
        approachingTasks.push({
          task_id: task.id,
          task_title: task.title,
          task_source: task.source,
          days_stale: Math.floor(daysSinceUpdate),
          priority: task.priority,
          project: task.project_name || undefined,
          last_activity: task.updated_at,
          suggested_action: `Will be stale in ${Math.ceil((threshold - daysSinceUpdate))} days. Consider updating soon.`,
          severity: 'info',
          context: {
            threshold_days: threshold,
            percentage_over: Math.round((percentageStale - 1) * 100),
            url: task.url || undefined,
            assignee: task.assignee || undefined,
            status: task.status,
          },
        });
      }
    } catch (error) {
      console.error(`[Stale Task Detector] Error processing task ${task.id}:`, error);
    }
  }

  console.log(`[Stale Task Detector] Found ${approachingTasks.length} tasks approaching staleness`);

  // Sort by how close to threshold
  approachingTasks.sort((a, b) => b.days_stale - a.days_stale);

  return approachingTasks;
}

/**
 * Get cooldown statistics (for debugging/monitoring)
 */
export function getCooldownStats(): {
  total_tasks_with_cooldowns: number;
  by_severity: Record<string, number>;
  average_alert_count: number;
} {
  ensureCooldownTable();

  const db = getDatabase().getRawDb();

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM pm_alert_cooldowns
  `).get() as { count: number };

  const bySeverity = db.prepare(`
    SELECT last_alert_severity, COUNT(*) as count
    FROM pm_alert_cooldowns
    GROUP BY last_alert_severity
  `).all() as Array<{ last_alert_severity: string; count: number }>;

  const avgAlertCount = db.prepare(`
    SELECT AVG(alert_count) as avg FROM pm_alert_cooldowns
  `).get() as { avg: number | null };

  return {
    total_tasks_with_cooldowns: total.count,
    by_severity: Object.fromEntries(
      bySeverity.map(row => [row.last_alert_severity, row.count])
    ),
    average_alert_count: avgAlertCount.avg || 0,
  };
}

// ============================================================================
// Background Job Integration
// ============================================================================

/**
 * Register stale task detection as a background job
 * Called from lib/pm/background-jobs.ts
 */
export async function staleTaskJobHandler(): Promise<{
  success: boolean;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  errors?: string[];
  duration_ms: number;
}> {
  const startTime = Date.now();

  try {
    const alerts = await detectStaleTasks();

    // Enqueue alerts as signals to task queue
    // This allows them to be triaged and routed appropriately
    const { enqueueSignal } = await import('../task-queue');

    for (const alert of alerts) {
      try {
        await enqueueSignal({
          id: `stale-${alert.task_id}-${Date.now()}`,
          source: 'github', // Use appropriate source
          signal_type: 'follow_up',
          payload: alert,
          timestamp: Date.now(),
          confidence: 1.0, // We're confident these are stale
        });
      } catch (error) {
        console.error(`[Stale Task Detector] Failed to enqueue alert for ${alert.task_id}:`, error);
      }
    }

    return {
      success: true,
      items_processed: alerts.length,
      items_succeeded: alerts.length,
      items_failed: 0,
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Stale Task Detector] Job failed:', error);

    return {
      success: false,
      items_processed: 0,
      items_succeeded: 0,
      items_failed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      duration_ms: Date.now() - startTime,
    };
  }
}

console.log('[Stale Task Detector] Module loaded');
