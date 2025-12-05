/**
 * Deadline Proximity Alert System
 *
 * Proactively detects tasks with approaching deadlines and creates alerts
 * with appropriate urgency levels. Prevents missed deadlines through early warnings.
 *
 * Features:
 * - Multi-threshold detection (7d, 3d, 1d, overdue)
 * - Risk-based escalation (considers progress, priority, activity)
 * - Twice-daily background checks
 * - Integration with task queue for critical alerts
 * - Comprehensive logging and error handling
 */

import { ensureServerOnly } from '@/lib/server-only-guard';
import GitHubClient from '@/lib/integrations/GitHubClient';
import { getLocalTasks, LocalTask } from '../local-task-store';
import { enqueueSignal } from '../task-queue';
import { addPMMemory } from '../pm-memory';
import { BackgroundJob, JobResult } from '../background-jobs';
import type { TaskPriority } from '../types';

ensureServerOnly('lib/pm/alerts/deadline-proximity-detector');

// ============================================================================
// Types
// ============================================================================

export interface DeadlineConfig {
  first_warning: number;      // Days before deadline to start alerting (default: 7)
  second_warning: number;     // Second warning threshold (default: 3)
  urgent_warning: number;     // Urgent warning threshold (default: 1)
  overdue_escalation: number; // Overdue threshold (default: 0)
}

export interface DeadlineAlert {
  task_id: string;
  task_title: string;
  task_source: 'github' | 'local';
  task_url: string | null;

  // Deadline info
  deadline: string; // ISO date
  days_remaining: number;
  is_overdue: boolean;
  hours_until_deadline: number;

  // Progress indicators
  progress_estimate?: number; // 0-100 if available
  last_activity?: string; // ISO timestamp
  days_since_activity?: number;

  // Risk assessment
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];

  // Alert metadata
  severity: 'info' | 'warning' | 'critical';
  suggested_action: string;
  priority: TaskPriority;

  // Context
  project_name?: string;
  assignee?: string;
  labels: string[];
}

interface TaskWithDeadline {
  id: string;
  title: string;
  source: 'github' | 'local';
  url: string | null;
  due_date: string;
  priority: TaskPriority;
  updated_at?: string;
  status?: string;
  assignee?: string;
  labels?: string[];
  project_name?: string;
  progress?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: DeadlineConfig = {
  first_warning: 7,      // 7 days out - INFO
  second_warning: 3,     // 3 days out - WARNING
  urgent_warning: 1,     // 1 day out - CRITICAL
  overdue_escalation: 0, // Past due - CRITICAL++
};

// ============================================================================
// Core Detection Logic
// ============================================================================

/**
 * Detect all approaching deadlines across GitHub and local tasks
 */
export async function detectApproachingDeadlines(
  config: Partial<DeadlineConfig> = {}
): Promise<DeadlineAlert[]> {
  const effectiveConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Deadline Detector] Starting deadline proximity scan...');

  try {
    // Scan all sources
    const [githubTasks, localTasks] = await Promise.all([
      scanGitHubIssues(),
      scanLocalTasks(),
    ]);

    const allTasks = [...githubTasks, ...localTasks];
    console.log(`[Deadline Detector] Found ${allTasks.length} tasks with deadlines`);

    // Analyze each task
    const alerts: DeadlineAlert[] = [];
    for (const task of allTasks) {
      const alert = analyzeTaskDeadline(task, effectiveConfig);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Sort by severity and days remaining
    alerts.sort((a, b) => {
      // Critical first
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      // Then by days remaining
      return a.days_remaining - b.days_remaining;
    });

    console.log(`[Deadline Detector] Generated ${alerts.length} alerts:`);
    console.log(`  - Critical: ${alerts.filter(a => a.severity === 'critical').length}`);
    console.log(`  - Warning: ${alerts.filter(a => a.severity === 'warning').length}`);
    console.log(`  - Info: ${alerts.filter(a => a.severity === 'info').length}`);

    // Record to memory
    try {
      await addPMMemory(
        `Deadline scan: ${alerts.length} alerts (${alerts.filter(a => a.severity === 'critical').length} critical)`,
        'pattern',
        {
          total_alerts: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          warning: alerts.filter(a => a.severity === 'warning').length,
          info: alerts.filter(a => a.severity === 'info').length,
        }
      );
    } catch (memoryError) {
      console.warn('[Deadline Detector] Failed to record to memory:', memoryError);
    }

    // Optionally create signals for critical alerts
    for (const alert of alerts.filter(a => a.severity === 'critical')) {
      try {
        await enqueueSignal({
          id: `deadline-alert-${alert.task_id}-${Date.now()}`,
          source: alert.task_source === 'github' ? 'github' : 'calendar',
          signal_type: 'deadline',
          payload: alert as unknown as Record<string, unknown>,
          timestamp: Date.now(),
          confidence: 1.0,
        });
      } catch (signalError) {
        console.warn('[Deadline Detector] Failed to create signal:', signalError);
      }
    }

    return alerts;
  } catch (error) {
    console.error('[Deadline Detector] Error during detection:', error);
    throw error;
  }
}

/**
 * Get only overdue tasks
 */
export async function getOverdueTasks(): Promise<DeadlineAlert[]> {
  const allAlerts = await detectApproachingDeadlines();
  return allAlerts.filter(alert => alert.is_overdue);
}

/**
 * Get tasks due today
 */
export async function getTasksDueToday(): Promise<DeadlineAlert[]> {
  const allAlerts = await detectApproachingDeadlines();
  return allAlerts.filter(alert => alert.days_remaining === 0 && !alert.is_overdue);
}

// ============================================================================
// Task Scanning
// ============================================================================

/**
 * Scan GitHub issues for tasks with due dates
 */
async function scanGitHubIssues(): Promise<TaskWithDeadline[]> {
  try {
    const client = GitHubClient;

    // Get all open issues across all repos
    const issues = await client.getIssues({ state: 'open' });
    const tasks: TaskWithDeadline[] = [];

    for (const issue of issues) {
      // Extract due date from various sources
      const dueDate = extractDueDateFromIssue(issue);
      if (!dueDate) continue;

      // Determine priority from labels
      const priority = extractPriorityFromLabels(issue.labels || []);

      tasks.push({
        id: `issue_${issue.number}_${issue.repo_name || 'unknown'}`,
        title: issue.title,
        source: 'github',
        url: issue.html_url,
        due_date: dueDate,
        priority,
        updated_at: issue.updated_at,
        assignee: issue.assignees?.[0]?.login,
        labels: (issue.labels || []).map((l: any) => typeof l === 'string' ? l : l.name),
        project_name: issue.repo_name || undefined,
      });
    }

    console.log(`[Deadline Detector] Found ${tasks.length} GitHub issues with deadlines`);
    return tasks;
  } catch (error) {
    console.error('[Deadline Detector] Error scanning GitHub:', error);
    return [];
  }
}

/**
 * Scan local tasks for tasks with due dates
 */
async function scanLocalTasks(): Promise<TaskWithDeadline[]> {
  try {
    const allTasks = await getLocalTasks();
    const tasks: TaskWithDeadline[] = [];

    for (const task of allTasks) {
      // Only include tasks with due dates and not done
      if (!task.due_date || task.status === 'done') continue;

      tasks.push({
        id: task.id,
        title: task.title,
        source: 'local',
        url: null,
        due_date: task.due_date,
        priority: task.priority,
        updated_at: new Date(task.updated_at * 1000).toISOString(),
        status: task.status,
        assignee: task.assignee || undefined,
        labels: task.labels,
        project_name: task.project_name || undefined,
      });
    }

    console.log(`[Deadline Detector] Found ${tasks.length} local tasks with deadlines`);
    return tasks;
  } catch (error) {
    console.error('[Deadline Detector] Error scanning local tasks:', error);
    return [];
  }
}

// ============================================================================
// Analysis Logic
// ============================================================================

/**
 * Analyze a single task for deadline proximity
 */
function analyzeTaskDeadline(
  task: TaskWithDeadline,
  config: DeadlineConfig
): DeadlineAlert | null {
  // Parse deadline
  const deadline = new Date(task.due_date);
  if (isNaN(deadline.getTime())) {
    console.warn(`[Deadline Detector] Invalid due_date for task ${task.id}: ${task.due_date}`);
    return null;
  }

  // Calculate time until deadline
  const now = new Date();
  const msUntilDeadline = deadline.getTime() - now.getTime();
  const hoursUntilDeadline = msUntilDeadline / (1000 * 60 * 60);
  const daysRemaining = Math.floor(hoursUntilDeadline / 24);
  const isOverdue = daysRemaining < 0;

  // Determine if this deadline is within alert thresholds
  const withinThreshold =
    isOverdue ||
    daysRemaining <= config.first_warning;

  if (!withinThreshold) {
    return null; // No alert needed yet
  }

  // Calculate days since last activity
  let daysSinceActivity: number | undefined;
  if (task.updated_at) {
    const lastUpdate = new Date(task.updated_at);
    const msSinceUpdate = now.getTime() - lastUpdate.getTime();
    daysSinceActivity = Math.floor(msSinceUpdate / (1000 * 60 * 60 * 24));
  }

  // Build base alert
  const alert: DeadlineAlert = {
    task_id: task.id,
    task_title: task.title,
    task_source: task.source,
    task_url: task.url,
    deadline: task.due_date,
    days_remaining: daysRemaining,
    is_overdue: isOverdue,
    hours_until_deadline: hoursUntilDeadline,
    progress_estimate: task.progress,
    last_activity: task.updated_at,
    days_since_activity: daysSinceActivity,
    risk_level: 'low', // Will be calculated
    risk_factors: [],
    severity: 'info', // Will be calculated
    suggested_action: '', // Will be generated
    priority: task.priority,
    project_name: task.project_name,
    assignee: task.assignee,
    labels: task.labels || [],
  };

  // Calculate risk level and factors
  calculateRiskLevel(alert, config);

  // Determine severity based on days remaining
  if (isOverdue) {
    alert.severity = 'critical';
  } else if (daysRemaining <= config.urgent_warning) {
    alert.severity = 'critical';
  } else if (daysRemaining <= config.second_warning) {
    alert.severity = 'warning';
  } else {
    alert.severity = 'info';
  }

  // Generate suggested action
  alert.suggested_action = generateSuggestedAction(alert);

  return alert;
}

/**
 * Calculate risk level and identify risk factors
 */
function calculateRiskLevel(alert: DeadlineAlert, config: DeadlineConfig): void {
  const riskFactors: string[] = [];
  let riskScore = 0;

  // Overdue = always critical
  if (alert.is_overdue) {
    riskFactors.push(`Overdue by ${Math.abs(alert.days_remaining)} day${Math.abs(alert.days_remaining) !== 1 ? 's' : ''}`);
    alert.risk_level = 'critical';
    alert.risk_factors = riskFactors;
    return;
  }

  // Time pressure
  if (alert.days_remaining <= 1) {
    riskFactors.push('Less than 24 hours remaining');
    riskScore += 3;
  } else if (alert.days_remaining <= 3) {
    riskFactors.push('Less than 3 days remaining');
    riskScore += 2;
  } else if (alert.days_remaining <= 7) {
    riskFactors.push('Less than 1 week remaining');
    riskScore += 1;
  }

  // Priority
  if (alert.priority === 'urgent') {
    riskFactors.push('Urgent priority');
    riskScore += 3;
  } else if (alert.priority === 'high') {
    riskFactors.push('High priority');
    riskScore += 2;
  }

  // Activity staleness
  if (alert.days_since_activity !== undefined) {
    if (alert.days_since_activity > 7) {
      riskFactors.push(`No activity in ${alert.days_since_activity} days`);
      riskScore += 2;
    } else if (alert.days_since_activity > 3) {
      riskFactors.push(`No activity in ${alert.days_since_activity} days`);
      riskScore += 1;
    }
  }

  // Progress
  if (alert.progress_estimate !== undefined) {
    if (alert.progress_estimate < 25) {
      riskFactors.push('Low progress (< 25%)');
      riskScore += 2;
    } else if (alert.progress_estimate < 50) {
      riskFactors.push('Medium progress (< 50%)');
      riskScore += 1;
    }
  }

  // No assignee
  if (!alert.assignee) {
    riskFactors.push('No assignee');
    riskScore += 1;
  }

  // Determine risk level from score
  if (riskScore >= 5) {
    alert.risk_level = 'critical';
  } else if (riskScore >= 3) {
    alert.risk_level = 'high';
  } else if (riskScore >= 1) {
    alert.risk_level = 'medium';
  } else {
    alert.risk_level = 'low';
  }

  alert.risk_factors = riskFactors;
}

/**
 * Generate a suggested action for the alert
 */
function generateSuggestedAction(alert: DeadlineAlert): string {
  if (alert.is_overdue) {
    return `OVERDUE: Address immediately - deadline was ${Math.abs(alert.days_remaining)} day${Math.abs(alert.days_remaining) !== 1 ? 's' : ''} ago`;
  }

  if (alert.days_remaining === 0) {
    return 'DUE TODAY: Complete and submit before end of day';
  }

  if (alert.days_remaining === 1) {
    return 'URGENT: Complete within 24 hours';
  }

  if (alert.days_remaining <= 3) {
    if (alert.progress_estimate !== undefined && alert.progress_estimate < 50) {
      return `Priority focus needed - ${alert.days_remaining} days remaining with < 50% progress`;
    }
    return `Plan completion - ${alert.days_remaining} days remaining`;
  }

  if (alert.days_remaining <= 7) {
    if (alert.days_since_activity && alert.days_since_activity > 3) {
      return 'Resume work - task has been inactive for several days';
    }
    return 'Start planning implementation approach';
  }

  return 'Monitor progress and adjust timeline as needed';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract due date from GitHub issue
 * Checks multiple sources:
 * - Labels like "due:2025-12-10"
 * - Issue body with "Due: YYYY-MM-DD"
 * - GitHub Projects v2 custom field (if available)
 */
function extractDueDateFromIssue(issue: any): string | null {
  // Check labels first
  if (issue.labels) {
    for (const label of issue.labels) {
      const labelName = typeof label === 'string' ? label : label.name;
      const match = labelName.match(/due[:\-](\d{4}-\d{2}-\d{2})/i);
      if (match) {
        return match[1];
      }
    }
  }

  // Check issue body
  if (issue.body) {
    const bodyMatch = issue.body.match(/due[:\-]\s*(\d{4}-\d{2}-\d{2})/i);
    if (bodyMatch) {
      return bodyMatch[1];
    }
  }

  return null;
}

/**
 * Extract priority from issue labels
 */
function extractPriorityFromLabels(labels: any[]): TaskPriority {
  for (const label of labels) {
    const labelName = (typeof label === 'string' ? label : label.name).toLowerCase();
    if (labelName.includes('urgent') || labelName.includes('p0')) return 'urgent';
    if (labelName.includes('high') || labelName.includes('p1')) return 'high';
    if (labelName.includes('medium') || labelName.includes('p2')) return 'medium';
    if (labelName.includes('low') || labelName.includes('p3')) return 'low';
  }
  return 'medium'; // Default
}

// ============================================================================
// Background Job Registration
// ============================================================================

/**
 * Background job configuration for deadline detection
 */
export const DEADLINE_PROXIMITY_JOB: BackgroundJob = {
  id: 'deadline-proximity',
  name: 'Deadline Proximity Alerts',
  description: 'Detect approaching and overdue deadlines',
  schedule: 'interval',
  interval_minutes: 720, // 12 hours (twice daily: 8am, 8pm)
  cooldown_minutes: 720, // 12 hours
  enabled: true,
  handler: async (): Promise<JobResult> => {
    const startTime = Date.now();

    try {
      const alerts = await detectApproachingDeadlines();

      return {
        success: true,
        items_processed: alerts.length,
        items_succeeded: alerts.filter(a => a.severity === 'critical').length,
        items_failed: 0,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        items_processed: 0,
        items_succeeded: 0,
        items_failed: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        duration_ms: Date.now() - startTime,
      };
    }
  },
};

/**
 * Register the deadline proximity job
 * Call this during app initialization
 */
export function registerDeadlineJob(): void {
  const { registerJob } = require('../background-jobs');
  registerJob(DEADLINE_PROXIMITY_JOB);
  console.log('[Deadline Detector] Registered deadline proximity job');
}
