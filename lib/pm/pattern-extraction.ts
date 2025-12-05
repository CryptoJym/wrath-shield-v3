/**
 * Pattern Extraction Engine
 *
 * Analyzes temporal memory to extract patterns:
 * - Completion time patterns
 * - Priority drift patterns
 * - Stale project patterns
 * - Productive time patterns
 * - Collaboration patterns
 *
 * Patterns are stored as temporal facts and used by predictive suggestions.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { recordFact, queryFacts, type EntityType } from './temporal-memory';
import { getAllTasks } from './integration';

ensureServerOnly('lib/pm/pattern-extraction');

// ============================================================================
// Types
// ============================================================================

export interface Pattern {
  id: string;
  pattern_type: PatternType;
  description: string;
  confidence: number;  // 0-1
  evidence: string[];  // Entity IDs that support this pattern
  extracted_at: string;

  // Actionable insights
  insight: string;
  suggested_action?: string;

  // Pattern-specific data
  metadata: Record<string, unknown>;
}

export type PatternType =
  | 'completion_time'
  | 'priority_drift'
  | 'stale_project'
  | 'productive_time'
  | 'collaboration'
  | 'assignment_preference';

interface CompletionTimeData {
  task_id: string;
  priority: string;
  project: string | null;
  created_at: number;
  completed_at: number;
  days_to_complete: number;
}

// ============================================================================
// Pattern Extractors
// ============================================================================

/**
 * Extract completion time patterns by priority
 */
export async function extractCompletionPatterns(): Promise<Pattern[]> {
  const db = getDatabase().getRawDb();

  // Get completed tasks with their lifecycle
  const query = `
    SELECT DISTINCT
      tf1.entity_id as task_id,
      (SELECT value FROM temporal_facts WHERE entity_id = tf1.entity_id AND attribute = 'priority' AND valid_to IS NULL LIMIT 1) as priority,
      (SELECT value FROM temporal_facts WHERE entity_id = tf1.entity_id AND attribute = 'project_name' AND valid_to IS NULL LIMIT 1) as project,
      tf1.valid_from as created_at,
      tf2.valid_from as completed_at,
      (tf2.valid_from - tf1.valid_from) / 86400.0 as days_to_complete
    FROM temporal_facts tf1
    INNER JOIN temporal_facts tf2
      ON tf1.entity_id = tf2.entity_id
      AND tf1.attribute = 'status'
      AND tf1.value = '"pending"'
      AND tf2.attribute = 'status'
      AND tf2.value = '"done"'
      AND tf2.valid_from > tf1.valid_from
    WHERE tf1.entity_type = 'task'
    ORDER BY tf2.valid_from DESC
    LIMIT 100
  `;

  const rows = db.prepare(query).all() as any[];

  if (rows.length === 0) {
    return [];
  }

  // Group by priority
  const byPriority: Record<string, CompletionTimeData[]> = {};

  for (const row of rows) {
    const priority = row.priority ? JSON.parse(row.priority) : 'none';
    if (!byPriority[priority]) {
      byPriority[priority] = [];
    }
    byPriority[priority].push({
      task_id: row.task_id,
      priority,
      project: row.project ? JSON.parse(row.project) : null,
      created_at: row.created_at,
      completed_at: row.completed_at,
      days_to_complete: row.days_to_complete
    });
  }

  const patterns: Pattern[] = [];

  // Create patterns for each priority level
  for (const [priority, tasks] of Object.entries(byPriority)) {
    if (tasks.length < 3) continue;  // Need at least 3 samples

    const times = tasks.map(t => t.days_to_complete);
    const avg = mean(times);
    const std = stdDev(times);
    const confidence = Math.min(tasks.length / 20, 1.0);  // Max confidence at 20+ samples

    const pattern: Pattern = {
      id: `completion_time_${priority}`,
      pattern_type: 'completion_time',
      description: `${priority} priority tasks complete in ${avg.toFixed(1)} ± ${std.toFixed(1)} days`,
      confidence,
      evidence: tasks.map(t => t.task_id),
      extracted_at: new Date().toISOString(),
      insight: `Average completion time for ${priority} priority: ${avg.toFixed(1)} days`,
      suggested_action: avg > 7
        ? `Consider breaking down ${priority} priority tasks into smaller chunks`
        : undefined,
      metadata: {
        sample_size: tasks.length,
        avg_days: avg,
        std_dev: std,
        min_days: Math.min(...times),
        max_days: Math.max(...times)
      }
    };

    patterns.push(pattern);

    // Store pattern as temporal fact
    await recordFact({
      entity_type: 'pattern',
      entity_id: pattern.id,
      attribute: 'avg_completion_days',
      value: avg,
      source: 'pattern_extraction',
      confidence: pattern.confidence,
      metadata: {
        pattern_type: 'completion_time',
        priority,
        sample_size: tasks.length,
        std_dev: std
      }
    });
  }

  console.log(`[PatternExtraction] Extracted ${patterns.length} completion time patterns`);
  return patterns;
}

/**
 * Detect priority drift (tasks that change priority over time)
 */
export async function detectPriorityDrift(): Promise<Pattern[]> {
  const db = getDatabase().getRawDb();

  // Find tasks with priority changes
  const query = `
    SELECT
      tf1.entity_id as task_id,
      tf1.value as old_priority,
      tf2.value as new_priority,
      tf1.valid_from as old_time,
      tf2.valid_from as new_time,
      (tf2.valid_from - tf1.valid_from) / 86400.0 as days_between
    FROM temporal_facts tf1
    INNER JOIN temporal_facts tf2
      ON tf1.entity_id = tf2.entity_id
      AND tf1.attribute = 'priority'
      AND tf2.attribute = 'priority'
      AND tf1.value != tf2.value
      AND tf2.valid_from > tf1.valid_from
      AND tf1.valid_to = tf2.valid_from
    WHERE tf1.entity_type = 'task'
      AND tf1.recorded_at > ?
    ORDER BY tf2.valid_from DESC
    LIMIT 50
  `;

  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
  const rows = db.prepare(query).all(thirtyDaysAgo) as any[];

  if (rows.length === 0) {
    return [];
  }

  // Analyze drift patterns
  const patterns: Pattern[] = [];

  // Pattern: High -> Medium drift
  const highToMedium = rows.filter(r =>
    JSON.parse(r.old_priority) === 'high' && JSON.parse(r.new_priority) === 'medium'
  );

  if (highToMedium.length >= 3) {
    const avgDays = mean(highToMedium.map(r => r.days_between));

    patterns.push({
      id: 'priority_drift_high_to_medium',
      pattern_type: 'priority_drift',
      description: `High priority tasks downgraded to medium after ${avgDays.toFixed(1)} days without activity`,
      confidence: Math.min(highToMedium.length / 10, 0.9),
      evidence: highToMedium.map(r => r.task_id),
      extracted_at: new Date().toISOString(),
      insight: `${highToMedium.length} high priority tasks were downgraded in the last 30 days`,
      suggested_action: 'Review high priority tasks regularly to maintain momentum',
      metadata: {
        sample_size: highToMedium.length,
        avg_days_to_downgrade: avgDays
      }
    });
  }

  // Pattern: Urgent tasks that miss deadlines
  const urgentDelayed = rows.filter(r =>
    JSON.parse(r.old_priority) === 'urgent' && r.days_between > 1
  );

  if (urgentDelayed.length >= 2) {
    patterns.push({
      id: 'priority_drift_urgent_delayed',
      pattern_type: 'priority_drift',
      description: `Urgent tasks sometimes don't get immediate attention`,
      confidence: Math.min(urgentDelayed.length / 5, 0.8),
      evidence: urgentDelayed.map(r => r.task_id),
      extracted_at: new Date().toISOString(),
      insight: `${urgentDelayed.length} urgent tasks took >1 day to action`,
      suggested_action: 'Ensure urgent tasks trigger immediate notifications',
      metadata: {
        sample_size: urgentDelayed.length
      }
    });
  }

  console.log(`[PatternExtraction] Extracted ${patterns.length} priority drift patterns`);
  return patterns;
}

/**
 * Identify stale project patterns
 */
export async function identifyStaleProjects(): Promise<Pattern[]> {
  const db = getDatabase().getRawDb();

  // Find projects with no recent completions
  const query = `
    SELECT
      project_name,
      COUNT(*) as task_count,
      MAX(completed_at) as last_completion,
      MIN(completed_at) as first_completion
    FROM (
      SELECT
        (SELECT value FROM temporal_facts WHERE entity_id = tf.entity_id AND attribute = 'project_name' AND valid_to IS NULL LIMIT 1) as project_name,
        tf.valid_from as completed_at
      FROM temporal_facts tf
      WHERE tf.entity_type = 'task'
        AND tf.attribute = 'status'
        AND tf.value = '"done"'
        AND tf.recorded_at > ?
    )
    WHERE project_name IS NOT NULL
    GROUP BY project_name
  `;

  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - (60 * 86400);
  const rows = db.prepare(query).all(sixtyDaysAgo) as any[];

  const patterns: Pattern[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const row of rows) {
    const projectName = JSON.parse(row.project_name);
    const daysSinceCompletion = (now - row.last_completion) / 86400;

    if (daysSinceCompletion > 14 && row.task_count > 0) {
      patterns.push({
        id: `stale_project_${projectName.replace(/\s+/g, '_').toLowerCase()}`,
        pattern_type: 'stale_project',
        description: `Project "${projectName}" hasn't had a completed task in ${Math.floor(daysSinceCompletion)} days`,
        confidence: 0.9,
        evidence: [projectName],
        extracted_at: new Date().toISOString(),
        insight: `${row.task_count} tasks completed in last 60 days, but none recently`,
        suggested_action: `Review open tasks in ${projectName} project`,
        metadata: {
          project_name: projectName,
          task_count: row.task_count,
          days_since_completion: Math.floor(daysSinceCompletion)
        }
      });
    }
  }

  console.log(`[PatternExtraction] Extracted ${patterns.length} stale project patterns`);
  return patterns;
}

/**
 * Identify productive time windows
 */
export async function identifyProductiveWindows(): Promise<Pattern[]> {
  const db = getDatabase().getRawDb();

  // Find when tasks are most often completed
  const query = `
    SELECT
      CAST(strftime('%w', datetime(valid_from, 'unixepoch')) AS INTEGER) as day_of_week,
      CAST(strftime('%H', datetime(valid_from, 'unixepoch')) AS INTEGER) as hour_of_day,
      COUNT(*) as completion_count
    FROM temporal_facts
    WHERE entity_type = 'task'
      AND attribute = 'status'
      AND value = '"done"'
      AND recorded_at > ?
    GROUP BY day_of_week, hour_of_day
    HAVING completion_count >= 2
    ORDER BY completion_count DESC
    LIMIT 10
  `;

  const ninetyDaysAgo = Math.floor(Date.now() / 1000) - (90 * 86400);
  const rows = db.prepare(query).all(ninetyDaysAgo) as any[];

  if (rows.length === 0) {
    return [];
  }

  const patterns: Pattern[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Top productive window
  const top = rows[0];
  const dayName = dayNames[top.day_of_week];
  const hourFormatted = top.hour_of_day % 12 === 0 ? 12 : top.hour_of_day % 12;
  const ampm = top.hour_of_day < 12 ? 'AM' : 'PM';

  patterns.push({
    id: 'productive_window_peak',
    pattern_type: 'productive_time',
    description: `Peak productivity: ${dayName}s around ${hourFormatted}${ampm}`,
    confidence: Math.min(top.completion_count / 10, 0.9),
    evidence: [`${top.day_of_week}_${top.hour_of_day}`],
    extracted_at: new Date().toISOString(),
    insight: `${top.completion_count} tasks completed during this window`,
    suggested_action: 'Schedule important tasks during peak productivity times',
    metadata: {
      day_of_week: top.day_of_week,
      hour_of_day: top.hour_of_day,
      completion_count: top.completion_count
    }
  });

  console.log(`[PatternExtraction] Extracted ${patterns.length} productive time patterns`);
  return patterns;
}

/**
 * Find collaboration patterns
 */
export async function findCollaborationPatterns(): Promise<Pattern[]> {
  const db = getDatabase().getRawDb();

  // Find tasks with assignee relationships and their completion times
  const query = `
    SELECT
      r.to_entity_id as assignee,
      COUNT(*) as tasks_assigned,
      AVG((tf2.valid_from - tf1.valid_from) / 86400.0) as avg_completion_days
    FROM entity_relationships r
    INNER JOIN temporal_facts tf1
      ON r.from_entity_id = tf1.entity_id
      AND tf1.attribute = 'status'
      AND tf1.value = '"pending"'
    INNER JOIN temporal_facts tf2
      ON tf1.entity_id = tf2.entity_id
      AND tf2.attribute = 'status'
      AND tf2.value = '"done"'
      AND tf2.valid_from > tf1.valid_from
    WHERE r.relationship_type = 'assigned_to'
      AND r.from_entity_type = 'task'
      AND r.recorded_at > ?
    GROUP BY r.to_entity_id
    HAVING tasks_assigned >= 3
    ORDER BY avg_completion_days ASC
  `;

  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - (60 * 86400);
  const rows = db.prepare(query).all(sixtyDaysAgo) as any[];

  const patterns: Pattern[] = [];

  for (const row of rows) {
    patterns.push({
      id: `collaboration_assignee_${row.assignee}`,
      pattern_type: 'collaboration',
      description: `${row.assignee} completes tasks in ${row.avg_completion_days.toFixed(1)} days on average`,
      confidence: Math.min(row.tasks_assigned / 10, 0.9),
      evidence: [row.assignee],
      extracted_at: new Date().toISOString(),
      insight: `Based on ${row.tasks_assigned} completed tasks`,
      suggested_action: undefined,
      metadata: {
        assignee: row.assignee,
        tasks_assigned: row.tasks_assigned,
        avg_completion_days: row.avg_completion_days
      }
    });
  }

  console.log(`[PatternExtraction] Extracted ${patterns.length} collaboration patterns`);
  return patterns;
}

/**
 * Run all pattern extractors
 */
export async function runPatternExtraction(): Promise<Pattern[]> {
  console.log('[PatternExtraction] Running all pattern extractors...');

  const [
    completionPatterns,
    driftPatterns,
    staleProjects,
    productiveWindows,
    collaborationPatterns
  ] = await Promise.all([
    extractCompletionPatterns(),
    detectPriorityDrift(),
    identifyStaleProjects(),
    identifyProductiveWindows(),
    findCollaborationPatterns()
  ]);

  const allPatterns = [
    ...completionPatterns,
    ...driftPatterns,
    ...staleProjects,
    ...productiveWindows,
    ...collaborationPatterns
  ];

  console.log(`[PatternExtraction] Extracted ${allPatterns.length} total patterns`);

  return allPatterns;
}

/**
 * Get a specific pattern by ID
 */
export async function getPattern(pattern_id: string): Promise<Pattern | null> {
  const facts = queryFacts({
    entity_type: 'pattern',
    entity_id: pattern_id,
    limit: 1
  });

  if (facts.length === 0) {
    return null;
  }

  const fact = facts[0];
  const metadata = fact.metadata as any;

  return {
    id: pattern_id,
    pattern_type: metadata.pattern_type,
    description: metadata.description || '',
    confidence: fact.confidence,
    evidence: metadata.evidence || [],
    extracted_at: new Date(fact.recorded_at * 1000).toISOString(),
    insight: metadata.insight || '',
    suggested_action: metadata.suggested_action,
    metadata
  };
}

/**
 * Get all patterns of a specific type
 */
export async function getPatternsByType(pattern_type: PatternType): Promise<Pattern[]> {
  const facts = queryFacts({
    entity_type: 'pattern'
  });

  return facts
    .filter(f => (f.metadata as any).pattern_type === pattern_type)
    .map(f => ({
      id: f.entity_id,
      pattern_type,
      description: (f.metadata as any).description || '',
      confidence: f.confidence,
      evidence: (f.metadata as any).evidence || [],
      extracted_at: new Date(f.recorded_at * 1000).toISOString(),
      insight: (f.metadata as any).insight || '',
      suggested_action: (f.metadata as any).suggested_action,
      metadata: f.metadata
    }));
}

// ============================================================================
// Utility Functions
// ============================================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}
