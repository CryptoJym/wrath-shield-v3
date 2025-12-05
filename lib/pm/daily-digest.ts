/**
 * PM Daily Digest Generator
 *
 * Generates daily summaries of PM council autonomous actions:
 * - Auto actions (things the system did without asking)
 * - Proposals (things needing review)
 * - Escalations (things requiring immediate attention)
 * - Statistics (aggregate metrics)
 * - Insights (patterns detected)
 * - Warnings (anomalies or concerns)
 *
 * This provides "what happened while you weren't looking" visibility.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import {
  type QueuedItem,
  type QueueStatus,
  getQueueStatus,
  getQueuedItemsByStatus,
} from './task-queue';
import {
  type JobExecution,
  getAllJobExecutions,
} from './background-jobs';
import { searchPMMemory } from './pm-memory';

ensureServerOnly('lib/pm/daily-digest');

// ============================================================================
// Types
// ============================================================================

export interface DailyDigest {
  generated_at: string;
  period: { start: string; end: string };

  auto_actions: AutoAction[];
  proposals: Proposal[];
  escalations: Escalation[];

  stats: DigestStats;
  insights: string[];
  warnings: string[];
}

export interface AutoAction {
  id: string;
  timestamp: string;
  action_type: string;
  description: string;
  result: 'success' | 'failed';
  details?: Record<string, unknown>;
}

export interface Proposal {
  id: string;
  timestamp: string;
  proposal_type: string;
  description: string;
  rationale: string;
  options?: string[];
  recommended_action: string;
  deadline?: string;
}

export interface Escalation {
  id: string;
  timestamp: string;
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  context: string;
  required_action: string;
  deadline?: string;
}

export interface DigestStats {
  tasks_completed: number;
  tasks_created: number;
  signals_processed: number;
  decisions_auto: number;
  decisions_proposed: number;
  decisions_escalated: number;
  queue_health: {
    pending: number;
    failed: number;
    avg_processing_time_ms: number;
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Generate daily digest for a time period
 */
export async function generateDailyDigest(since?: Date): Promise<DailyDigest> {
  const endTime = new Date();
  const startTime = since || new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const startTimestamp = Math.floor(startTime.getTime() / 1000);
  const endTimestamp = Math.floor(endTime.getTime() / 1000);

  console.log(`[Daily Digest] Generating digest for ${startTime.toISOString()} to ${endTime.toISOString()}`);

  // Gather all data in parallel
  const [
    autoActions,
    proposals,
    escalations,
    stats,
  ] = await Promise.all([
    getAutoActions(startTimestamp, endTimestamp),
    getProposals(startTimestamp, endTimestamp),
    getEscalations(startTimestamp, endTimestamp),
    getDigestStats(startTime),
  ]);

  // Generate insights and warnings
  const insights = await generateInsights({ start: startTime, end: endTime });
  const warnings = await generateWarnings(stats, { start: startTime, end: endTime });

  return {
    generated_at: endTime.toISOString(),
    period: {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    },
    auto_actions: autoActions,
    proposals,
    escalations,
    stats,
    insights,
    warnings,
  };
}

/**
 * Get just the statistics
 */
export async function getDigestStats(since?: Date): Promise<DigestStats> {
  const startTime = since || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startTimestamp = Math.floor(startTime.getTime() / 1000);

  const db = getDatabase().getRawDb();

  // Get signal counts by escalation level
  const escalationCounts = db.prepare(`
    SELECT triage_escalation_level, COUNT(*) as count
    FROM pm_queue
    WHERE created_at >= ?
    GROUP BY triage_escalation_level
  `).all(startTimestamp) as Array<{ triage_escalation_level: string; count: number }>;

  const stats: DigestStats = {
    tasks_completed: 0,
    tasks_created: 0,
    signals_processed: 0,
    decisions_auto: 0,
    decisions_proposed: 0,
    decisions_escalated: 0,
    queue_health: {
      pending: 0,
      failed: 0,
      avg_processing_time_ms: 0,
    },
  };

  // Count signals by escalation level
  for (const row of escalationCounts) {
    stats.signals_processed += row.count;
    if (row.triage_escalation_level === 'auto') {
      stats.decisions_auto = row.count;
    } else if (row.triage_escalation_level === 'propose') {
      stats.decisions_proposed = row.count;
    } else if (row.triage_escalation_level === 'critical') {
      stats.decisions_escalated = row.count;
    }
  }

  // Get task counts (if local task store exists)
  try {
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ?) as completed,
        COUNT(*) FILTER (WHERE created_at >= ?) as created
      FROM pm_tasks
    `).get(startTimestamp, startTimestamp) as { completed: number; created: number };

    stats.tasks_completed = taskStats.completed || 0;
    stats.tasks_created = taskStats.created || 0;
  } catch (error) {
    // Table might not exist yet
    console.warn('[Daily Digest] pm_tasks table not found, skipping task counts');
  }

  // Get queue health
  const queueStatus = await getQueueStatus();
  stats.queue_health = {
    pending: queueStatus.pending,
    failed: queueStatus.failed,
    avg_processing_time_ms: queueStatus.avg_processing_time_ms,
  };

  return stats;
}

/**
 * Get actionable items (proposals + escalations)
 */
export async function getActionableItems(): Promise<{
  proposals: Proposal[];
  escalations: Escalation[];
}> {
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 60 * 60;

  const [proposals, escalations] = await Promise.all([
    getProposals(weekAgo, now),
    getEscalations(weekAgo, now),
  ]);

  return { proposals, escalations };
}

// ============================================================================
// Data Aggregation
// ============================================================================

async function getAutoActions(startTimestamp: number, endTimestamp: number): Promise<AutoAction[]> {
  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM pm_queue
    WHERE triage_escalation_level = 'auto'
      AND status IN ('completed', 'failed')
      AND created_at >= ?
      AND created_at <= ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(startTimestamp, endTimestamp) as any[];

  return rows.map(row => {
    const signal = {
      source: row.signal_source,
      signal_type: row.signal_type,
      payload: JSON.parse(row.signal_payload),
    };

    const description = generateActionDescription(signal, row.triage_action);

    return {
      id: row.id,
      timestamp: new Date(row.created_at * 1000).toISOString(),
      action_type: row.triage_action,
      description,
      result: row.status === 'completed' ? 'success' : 'failed',
      details: {
        signal_id: row.signal_id,
        source: row.signal_source,
        signal_type: row.signal_type,
        confidence: row.signal_confidence,
        error: row.error,
      },
    };
  });
}

async function getProposals(startTimestamp: number, endTimestamp: number): Promise<Proposal[]> {
  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM pm_queue
    WHERE triage_escalation_level = 'propose'
      AND status IN ('pending', 'deferred')
      AND created_at >= ?
      AND created_at <= ?
    ORDER BY
      CASE triage_priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at ASC
    LIMIT 20
  `).all(startTimestamp, endTimestamp) as any[];

  return rows.map(row => {
    const signal = {
      source: row.signal_source,
      signal_type: row.signal_type,
      payload: JSON.parse(row.signal_payload),
    };

    const proposalType = determineProposalType(signal, row.triage_action);
    const description = generateProposalDescription(signal, row.triage_action);

    return {
      id: row.id,
      timestamp: new Date(row.created_at * 1000).toISOString(),
      proposal_type: proposalType,
      description,
      rationale: row.triage_rationale || 'No rationale provided',
      recommended_action: row.triage_suggested_title || row.triage_action,
      deadline: row.triage_due_date,
      options: generateProposalOptions(signal, row.triage_action),
    };
  });
}

async function getEscalations(startTimestamp: number, endTimestamp: number): Promise<Escalation[]> {
  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM pm_queue
    WHERE triage_escalation_level = 'critical'
      AND status IN ('pending', 'failed', 'processing')
      AND created_at >= ?
      AND created_at <= ?
    ORDER BY
      CASE triage_priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at ASC
    LIMIT 10
  `).all(startTimestamp, endTimestamp) as any[];

  return rows.map(row => {
    const signal = {
      source: row.signal_source,
      signal_type: row.signal_type,
      payload: JSON.parse(row.signal_payload),
    };

    const title = row.triage_suggested_title || generateEscalationTitle(signal);
    const description = generateEscalationDescription(signal);
    const context = generateEscalationContext(signal, row.triage_rationale);
    const requiredAction = generateRequiredAction(signal);

    return {
      id: row.id,
      timestamp: new Date(row.created_at * 1000).toISOString(),
      severity: row.triage_priority === 'critical' ? 'critical' : 'warning',
      title,
      description,
      context,
      required_action: requiredAction,
      deadline: row.triage_due_date,
    };
  });
}

// ============================================================================
// Insight Generation
// ============================================================================

export async function generateInsights(period: { start: Date; end: Date }): Promise<string[]> {
  const insights: string[] = [];
  const db = getDatabase().getRawDb();

  const startTimestamp = Math.floor(period.start.getTime() / 1000);
  const endTimestamp = Math.floor(period.end.getTime() / 1000);

  // Source distribution
  try {
    const sourceCounts = db.prepare(`
      SELECT signal_source, COUNT(*) as count
      FROM pm_queue
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY signal_source
      ORDER BY count DESC
    `).all(startTimestamp, endTimestamp) as Array<{ signal_source: string; count: number }>;

    if (sourceCounts.length > 0) {
      const total = sourceCounts.reduce((sum, row) => sum + row.count, 0);
      const topSource = sourceCounts[0];
      const percentage = Math.round((topSource.count / total) * 100);
      insights.push(`${percentage}% of signals came from ${topSource.signal_source} agent (${topSource.count}/${total})`);
    }
  } catch (error) {
    console.warn('[Daily Digest] Error generating source insights:', error);
  }

  // Confidence trends
  try {
    const avgConfidence = db.prepare(`
      SELECT AVG(signal_confidence) as avg_confidence
      FROM pm_queue
      WHERE created_at >= ? AND created_at <= ?
    `).get(startTimestamp, endTimestamp) as { avg_confidence: number | null };

    if (avgConfidence.avg_confidence) {
      const percentage = Math.round(avgConfidence.avg_confidence * 100);
      insights.push(`Average signal confidence: ${percentage}%`);
    }
  } catch (error) {
    console.warn('[Daily Digest] Error generating confidence insights:', error);
  }

  // Temporal patterns (hour of day)
  try {
    const hourlyActivity = db.prepare(`
      SELECT
        CAST(strftime('%H', datetime(created_at, 'unixepoch')) AS INTEGER) as hour,
        COUNT(*) as count
      FROM pm_queue
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `).get(startTimestamp, endTimestamp) as { hour: number; count: number } | undefined;

    if (hourlyActivity && hourlyActivity.count > 0) {
      const hour = hourlyActivity.hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      insights.push(`Most active hour: ${displayHour}:00 ${ampm} (${hourlyActivity.count} signals)`);
    }
  } catch (error) {
    console.warn('[Daily Digest] Error generating temporal insights:', error);
  }

  // Success rate
  try {
    const successRate = db.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM pm_queue
      WHERE created_at >= ? AND created_at <= ?
        AND status IN ('completed', 'failed')
    `).get(startTimestamp, endTimestamp) as { completed: number; failed: number; total: number };

    if (successRate.total > 0) {
      const percentage = Math.round((successRate.completed / successRate.total) * 100);
      insights.push(`Processing success rate: ${percentage}% (${successRate.completed}/${successRate.total})`);
    }
  } catch (error) {
    console.warn('[Daily Digest] Error generating success rate insights:', error);
  }

  return insights;
}

// ============================================================================
// Warning Generation
// ============================================================================

export async function generateWarnings(
  stats: DigestStats,
  period: { start: Date; end: Date }
): Promise<string[]> {
  const warnings: string[] = [];

  // Queue backlog
  if (stats.queue_health.pending > 20) {
    warnings.push(`Queue backlog growing: ${stats.queue_health.pending} pending items`);
  }

  // Failed items
  if (stats.queue_health.failed > 5) {
    warnings.push(`Multiple processing failures: ${stats.queue_health.failed} failed items need attention`);
  }

  // Processing slowdown
  if (stats.queue_health.avg_processing_time_ms > 10000) {
    const seconds = (stats.queue_health.avg_processing_time_ms / 1000).toFixed(1);
    warnings.push(`Processing slowdown detected: Average ${seconds}s per item`);
  }

  // High critical escalation rate
  if (stats.decisions_escalated > 3) {
    warnings.push(`High critical escalation rate: ${stats.decisions_escalated} urgent items in period`);
  }

  // Low confidence signals
  if (stats.signals_processed > 0) {
    const db = getDatabase().getRawDb();
    const startTimestamp = Math.floor(period.start.getTime() / 1000);
    const endTimestamp = Math.floor(period.end.getTime() / 1000);

    try {
      const lowConfidenceCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM pm_queue
        WHERE created_at >= ? AND created_at <= ?
          AND signal_confidence < 0.5
      `).get(startTimestamp, endTimestamp) as { count: number };

      const lowConfidenceRate = (lowConfidenceCount.count / stats.signals_processed) * 100;
      if (lowConfidenceRate > 30) {
        warnings.push(`Many uncertain signals: ${Math.round(lowConfidenceRate)}% below 50% confidence`);
      }
    } catch (error) {
      console.warn('[Daily Digest] Error checking low confidence rate:', error);
    }
  }

  // Stale proposals
  const db = getDatabase().getRawDb();
  const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;

  try {
    const staleProposals = db.prepare(`
      SELECT COUNT(*) as count
      FROM pm_queue
      WHERE triage_escalation_level = 'propose'
        AND status = 'pending'
        AND created_at < ?
    `).get(twoDaysAgo) as { count: number };

    if (staleProposals.count > 0) {
      warnings.push(`${staleProposals.count} proposals pending for >48 hours (need review)`);
    }
  } catch (error) {
    console.warn('[Daily Digest] Error checking stale proposals:', error);
  }

  return warnings;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format digest as Markdown
 */
export function formatDigestAsMarkdown(digest: DailyDigest): string {
  const lines: string[] = [];

  // Header
  lines.push('# PM Council Daily Digest');
  lines.push(`Generated: ${new Date(digest.generated_at).toLocaleString()}`);
  lines.push(`Period: ${new Date(digest.period.start).toLocaleString()} - ${new Date(digest.period.end).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Auto Actions
  lines.push(`## 🤖 Auto Actions (${digest.auto_actions.length} completed)`);
  lines.push('');
  if (digest.auto_actions.length === 0) {
    lines.push('*No auto actions in this period*');
  } else {
    digest.auto_actions.slice(0, 10).forEach((action, i) => {
      const time = new Date(action.timestamp).toLocaleTimeString();
      const status = action.result === 'success' ? '✓' : '✗';
      lines.push(`${i + 1}. **${action.description}** (${time})`);
      lines.push(`   - Action: ${action.action_type}`);
      lines.push(`   - Result: ${status} ${action.result}`);
      if (action.details?.error) {
        lines.push(`   - Error: ${action.details.error}`);
      }
      lines.push('');
    });
    if (digest.auto_actions.length > 10) {
      lines.push(`*... and ${digest.auto_actions.length - 10} more*`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  // Proposals
  lines.push(`## 📋 Proposals Needing Review (${digest.proposals.length} pending)`);
  lines.push('');
  if (digest.proposals.length === 0) {
    lines.push('*No proposals pending*');
  } else {
    digest.proposals.forEach((proposal, i) => {
      lines.push(`${i + 1}. **${proposal.description}** (${proposal.proposal_type.toUpperCase()})`);
      lines.push(`   - Recommendation: ${proposal.recommended_action}`);
      lines.push(`   - Rationale: ${proposal.rationale}`);
      if (proposal.deadline) {
        lines.push(`   - Deadline: ${proposal.deadline}`);
      }
      if (proposal.options && proposal.options.length > 0) {
        lines.push(`   - Options: ${proposal.options.join(', ')}`);
      }
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');

  // Escalations
  lines.push(`## 🚨 Escalations Requiring Immediate Attention (${digest.escalations.length})`);
  lines.push('');
  if (digest.escalations.length === 0) {
    lines.push('*No escalations*');
  } else {
    digest.escalations.forEach((escalation, i) => {
      const severityIcon = escalation.severity === 'critical' ? '🔴' : '⚠️';
      lines.push(`${i + 1}. ${severityIcon} **${escalation.severity.toUpperCase()}: ${escalation.title}**`);
      lines.push(`   - ${escalation.description}`);
      lines.push(`   - Context: ${escalation.context}`);
      lines.push(`   - Required Action: ${escalation.required_action}`);
      if (escalation.deadline) {
        lines.push(`   - Deadline: ${escalation.deadline}`);
      }
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('');

  // Statistics
  lines.push('## 📊 Statistics');
  lines.push('');
  lines.push('**Tasks:**');
  lines.push(`- Created: ${digest.stats.tasks_created}`);
  lines.push(`- Completed: ${digest.stats.tasks_completed}`);
  lines.push(`- Net change: ${digest.stats.tasks_created - digest.stats.tasks_completed >= 0 ? '+' : ''}${digest.stats.tasks_created - digest.stats.tasks_completed}`);
  lines.push('');
  lines.push('**Signals:**');
  lines.push(`- Total processed: ${digest.stats.signals_processed}`);
  lines.push(`- AUTO decisions: ${digest.stats.decisions_auto} (${Math.round((digest.stats.decisions_auto / Math.max(digest.stats.signals_processed, 1)) * 100)}%)`);
  lines.push(`- PROPOSE decisions: ${digest.stats.decisions_proposed} (${Math.round((digest.stats.decisions_proposed / Math.max(digest.stats.signals_processed, 1)) * 100)}%)`);
  lines.push(`- CRITICAL decisions: ${digest.stats.decisions_escalated} (${Math.round((digest.stats.decisions_escalated / Math.max(digest.stats.signals_processed, 1)) * 100)}%)`);
  lines.push('');
  lines.push('**Queue Health:**');
  lines.push(`- Pending: ${digest.stats.queue_health.pending}`);
  lines.push(`- Failed: ${digest.stats.queue_health.failed}`);
  lines.push(`- Avg processing time: ${(digest.stats.queue_health.avg_processing_time_ms / 1000).toFixed(1)}s`);
  lines.push('');

  lines.push('---');
  lines.push('');

  // Insights
  lines.push('## 💡 Insights');
  lines.push('');
  if (digest.insights.length === 0) {
    lines.push('*No insights available*');
  } else {
    digest.insights.forEach(insight => {
      lines.push(`- ${insight}`);
    });
  }
  lines.push('');

  lines.push('---');
  lines.push('');

  // Warnings
  if (digest.warnings.length > 0) {
    lines.push('## ⚠️ Warnings');
    lines.push('');
    digest.warnings.forEach(warning => {
      lines.push(`- ${warning}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format digest as HTML
 */
export function formatDigestAsHTML(digest: DailyDigest): string {
  const html: string[] = [];

  html.push('<!DOCTYPE html>');
  html.push('<html lang="en">');
  html.push('<head>');
  html.push('<meta charset="UTF-8">');
  html.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  html.push('<title>PM Council Daily Digest</title>');
  html.push('<style>');
  html.push('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #333; }');
  html.push('h1 { color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }');
  html.push('h2 { color: #1a1a1a; margin-top: 40px; border-left: 4px solid #3b82f6; padding-left: 15px; }');
  html.push('.meta { color: #666; font-size: 14px; margin-bottom: 30px; }');
  html.push('.item { background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 15px; border-radius: 4px; }');
  html.push('.item.success { border-left-color: #10b981; }');
  html.push('.item.failed { border-left-color: #ef4444; }');
  html.push('.item.critical { border-left-color: #dc2626; background: #fef2f2; }');
  html.push('.item.warning { border-left-color: #f59e0b; background: #fffbeb; }');
  html.push('.label { font-weight: 600; color: #1a1a1a; }');
  html.push('.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }');
  html.push('.stat-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }');
  html.push('.stat-value { font-size: 32px; font-weight: bold; color: #3b82f6; }');
  html.push('.stat-label { font-size: 14px; color: #666; margin-top: 5px; }');
  html.push('ul { margin: 15px 0; padding-left: 20px; }');
  html.push('li { margin: 8px 0; }');
  html.push('.empty { color: #999; font-style: italic; }');
  html.push('</style>');
  html.push('</head>');
  html.push('<body>');

  // Header
  html.push('<h1>🤖 PM Council Daily Digest</h1>');
  html.push(`<div class="meta">`);
  html.push(`Generated: ${new Date(digest.generated_at).toLocaleString()}<br>`);
  html.push(`Period: ${new Date(digest.period.start).toLocaleString()} - ${new Date(digest.period.end).toLocaleString()}`);
  html.push('</div>');

  // Statistics (top)
  html.push('<div class="stat-grid">');
  html.push(`<div class="stat-box"><div class="stat-value">${digest.stats.signals_processed}</div><div class="stat-label">Signals Processed</div></div>`);
  html.push(`<div class="stat-box"><div class="stat-value">${digest.auto_actions.length}</div><div class="stat-label">Auto Actions</div></div>`);
  html.push(`<div class="stat-box"><div class="stat-value">${digest.proposals.length}</div><div class="stat-label">Proposals</div></div>`);
  html.push(`<div class="stat-box"><div class="stat-value">${digest.escalations.length}</div><div class="stat-label">Escalations</div></div>`);
  html.push('</div>');

  // Auto Actions
  html.push(`<h2>🤖 Auto Actions (${digest.auto_actions.length})</h2>`);
  if (digest.auto_actions.length === 0) {
    html.push('<p class="empty">No auto actions in this period</p>');
  } else {
    digest.auto_actions.slice(0, 10).forEach(action => {
      const itemClass = action.result === 'success' ? 'success' : 'failed';
      const status = action.result === 'success' ? '✓ Success' : '✗ Failed';
      html.push(`<div class="item ${itemClass}">`);
      html.push(`<div class="label">${action.description}</div>`);
      html.push(`<div style="margin-top: 8px; font-size: 14px; color: #666;">`);
      html.push(`Time: ${new Date(action.timestamp).toLocaleTimeString()} | `);
      html.push(`Action: ${action.action_type} | `);
      html.push(`Result: ${status}`);
      html.push('</div>');
      html.push('</div>');
    });
  }

  // Proposals
  html.push(`<h2>📋 Proposals Needing Review (${digest.proposals.length})</h2>`);
  if (digest.proposals.length === 0) {
    html.push('<p class="empty">No proposals pending</p>');
  } else {
    digest.proposals.forEach(proposal => {
      html.push('<div class="item">');
      html.push(`<div class="label">${proposal.description}</div>`);
      html.push(`<div style="margin-top: 8px; font-size: 14px;">`);
      html.push(`<strong>Recommendation:</strong> ${proposal.recommended_action}<br>`);
      html.push(`<strong>Rationale:</strong> ${proposal.rationale}`);
      if (proposal.deadline) {
        html.push(`<br><strong>Deadline:</strong> ${proposal.deadline}`);
      }
      html.push('</div>');
      html.push('</div>');
    });
  }

  // Escalations
  html.push(`<h2>🚨 Escalations (${digest.escalations.length})</h2>`);
  if (digest.escalations.length === 0) {
    html.push('<p class="empty">No escalations</p>');
  } else {
    digest.escalations.forEach(escalation => {
      const itemClass = escalation.severity;
      const severityIcon = escalation.severity === 'critical' ? '🔴' : '⚠️';
      html.push(`<div class="item ${itemClass}">`);
      html.push(`<div class="label">${severityIcon} ${escalation.severity.toUpperCase()}: ${escalation.title}</div>`);
      html.push(`<div style="margin-top: 8px; font-size: 14px;">`);
      html.push(`<strong>Description:</strong> ${escalation.description}<br>`);
      html.push(`<strong>Context:</strong> ${escalation.context}<br>`);
      html.push(`<strong>Required Action:</strong> ${escalation.required_action}`);
      if (escalation.deadline) {
        html.push(`<br><strong>Deadline:</strong> ${escalation.deadline}`);
      }
      html.push('</div>');
      html.push('</div>');
    });
  }

  // Insights
  html.push('<h2>💡 Insights</h2>');
  if (digest.insights.length === 0) {
    html.push('<p class="empty">No insights available</p>');
  } else {
    html.push('<ul>');
    digest.insights.forEach(insight => {
      html.push(`<li>${insight}</li>`);
    });
    html.push('</ul>');
  }

  // Warnings
  if (digest.warnings.length > 0) {
    html.push('<h2>⚠️ Warnings</h2>');
    html.push('<ul>');
    digest.warnings.forEach(warning => {
      html.push(`<li style="color: #f59e0b;">${warning}</li>`);
    });
    html.push('</ul>');
  }

  html.push('</body>');
  html.push('</html>');

  return html.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateActionDescription(signal: any, action: string): string {
  const { source, signal_type, payload } = signal;

  if (source === 'github' && signal_type === 'commit' && payload.action === 'closes_issue') {
    return `Auto-closed GitHub issue #${payload.issue_number} from commit`;
  }

  if (source === 'github' && signal_type === 'task' && payload.action === 'opened') {
    return `Synced GitHub issue "${payload.issue?.title || 'Unknown'}" to local tracker`;
  }

  if (source === 'inbox' && signal_type === 'task') {
    return `Created task from email: "${payload.action_item || payload.subject}"`;
  }

  if (source === 'comms' && signal_type === 'follow_up') {
    return `Created follow-up task for ${payload.contact_name || 'contact'}`;
  }

  if (action === 'defer') {
    return `Deferred ${source} signal (low confidence)`;
  }

  return `Processed ${source}/${signal_type} signal`;
}

function determineProposalType(signal: any, action: string): string {
  const { source, signal_type } = signal;

  if (action === 'github_issue') return 'create_issue';
  if (source === 'github') return 'github_action';
  if (signal_type === 'follow_up') return 'follow_up';
  if (signal_type === 'deadline') return 'deadline';

  return 'classification';
}

function generateProposalDescription(signal: any, action: string): string {
  const { source, signal_type, payload } = signal;

  if (signal_type === 'follow_up' && payload.contact_name) {
    return `Follow up with ${payload.contact_name}: ${payload.reason || 'No reason provided'}`;
  }

  if (action === 'github_issue') {
    return `Create GitHub issue from ${source} signal`;
  }

  return `Process ${source}/${signal_type} signal`;
}

function generateProposalOptions(signal: any, action: string): string[] {
  return ['Approve', 'Modify', 'Reject', 'Defer'];
}

function generateEscalationTitle(signal: any): string {
  const { signal_type, payload } = signal;

  if (signal_type === 'deadline') {
    return `Deadline: ${payload.deadline_type || 'Important deadline'}`;
  }

  return `Urgent: ${signal_type}`;
}

function generateEscalationDescription(signal: any): string {
  const { payload } = signal;

  if (payload.description) return payload.description;
  if (payload.case_name) return `Case: ${payload.case_name}`;
  if (payload.subject) return payload.subject;

  return 'Requires immediate attention';
}

function generateEscalationContext(signal: any, rationale?: string): string {
  if (rationale) return rationale;

  const { source } = signal;
  return `Critical signal from ${source} agent`;
}

function generateRequiredAction(signal: any): string {
  const { signal_type, payload } = signal;

  if (signal_type === 'deadline') {
    return `Review deadline and take appropriate action by ${payload.deadline_date || 'ASAP'}`;
  }

  return 'Review and respond to this escalation';
}
