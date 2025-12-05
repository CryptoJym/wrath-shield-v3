/**
 * Predictive Suggestions Engine
 *
 * Generates AI-powered suggestions based on:
 * - Historical patterns
 * - Current entity state
 * - Relationship graph
 * - Temporal context
 *
 * Suggestion types:
 * - Task priority recommendations
 * - Next action suggestions
 * - Completion time predictions
 * - Assignment recommendations
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import {
  getCurrentState,
  getCurrentRelationships,
  queryFacts,
  type EntityType
} from './temporal-memory';
import {
  getPattern,
  getPatternsByType,
  type Pattern
} from './pattern-extraction';
import { getAllTasks } from './integration';
import { getCurrentContext } from './temporal-context';

ensureServerOnly('lib/pm/predictive-suggestions');

// ============================================================================
// Types
// ============================================================================

export interface Suggestion {
  id: string;
  suggestion_type: SuggestionType;
  target_entity: {
    type: EntityType;
    id: string;
  };
  suggestion: string;
  rationale: string;
  confidence: number;  // 0-1
  based_on_patterns: string[];  // Pattern IDs used
  expires_at?: string;  // ISO timestamp
  metadata?: Record<string, unknown>;
  status?: SuggestionStatus;
  created_at?: string;
}

export type SuggestionType =
  | 'priority'
  | 'assignment'
  | 'deadline'
  | 'action'
  | 'review';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

// ============================================================================
// Database Persistence
// ============================================================================

function ensureSuggestionsTable(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_suggestions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      rationale TEXT,
      confidence REAL NOT NULL,
      pattern_ids TEXT,
      metadata TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      
      CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
    );

    CREATE INDEX IF NOT EXISTS idx_pm_suggestions_status ON pm_suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_pm_suggestions_target ON pm_suggestions(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_pm_suggestions_created ON pm_suggestions(created_at);
  `);
}

function saveSuggestion(suggestion: Suggestion): void {
  try {
    ensureSuggestionsTable();
    const db = getDatabase().getRawDb();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = suggestion.expires_at ? Math.floor(new Date(suggestion.expires_at).getTime() / 1000) : null;

    db.prepare(`
      INSERT OR REPLACE INTO pm_suggestions (
        id, type, target_type, target_id, suggestion, rationale,
        confidence, pattern_ids, metadata, status, created_at, expires_at
      ) VALUES (
        @id, @type, @target_type, @target_id, @suggestion, @rationale,
        @confidence, @pattern_ids, @metadata, 'pending', @created_at, @expires_at
      )
    `).run({
      id: suggestion.id,
      type: suggestion.suggestion_type,
      target_type: suggestion.target_entity.type,
      target_id: suggestion.target_entity.id,
      suggestion: suggestion.suggestion,
      rationale: suggestion.rationale,
      confidence: suggestion.confidence,
      pattern_ids: JSON.stringify(suggestion.based_on_patterns),
      metadata: suggestion.metadata ? JSON.stringify(suggestion.metadata) : null,
      created_at: now,
      expires_at: expiresAt
    });
  } catch (error) {
    console.warn('[Suggestions] Failed to save suggestion:', error);
  }
}

function getStoredSuggestions(activeOnly: boolean = true): Suggestion[] {
  try {
    ensureSuggestionsTable();
    const db = getDatabase().getRawDb();

    let query = `SELECT * FROM pm_suggestions`;
    const params: any[] = [];

    if (activeOnly) {
      const now = Math.floor(Date.now() / 1000);
      query += ` WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > ?)`;
      params.push(now);
    }

    query += ` ORDER BY confidence DESC`;

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      suggestion_type: row.type as SuggestionType,
      target_entity: {
        type: row.target_type as EntityType,
        id: row.target_id
      },
      suggestion: row.suggestion,
      rationale: row.rationale,
      confidence: row.confidence,
      based_on_patterns: JSON.parse(row.pattern_ids || '[]'),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      status: row.status as SuggestionStatus,
      created_at: new Date(row.created_at * 1000).toISOString(),
      expires_at: row.expires_at ? new Date(row.expires_at * 1000).toISOString() : undefined
    }));
  } catch (error) {
    console.warn('[Suggestions] Failed to retrieve suggestions:', error);
    return [];
  }
}

function updateSuggestionStatus(id: string, status: SuggestionStatus): void {
  try {
    ensureSuggestionsTable();
    const db = getDatabase().getRawDb();
    db.prepare('UPDATE pm_suggestions SET status = ? WHERE id = ?').run(status, id);
  } catch (error) {
    console.warn('[Suggestions] Failed to update suggestion status:', error);
  }
}

// ============================================================================
// Suggestion Generators
// ============================================================================

/**
 * Suggest task priority based on patterns
 *
 * ENHANCED (Phase 5): Uses AI-powered suggestions with Zep memory context
 * Falls back to statistical analysis if AI fails or is disabled
 */
export async function suggestTaskPriority(task_id: string): Promise<Suggestion | null> {
  // Check if AI suggestions are enabled
  const useAI = process.env.USE_AI_SUGGESTIONS !== 'false';

  if (useAI) {
    try {
      const { suggestTaskPriorityWithAI } = await import('./ai-suggestions');
      const aiSuggestion = await suggestTaskPriorityWithAI(task_id);
      if (aiSuggestion) {
        console.log(`[Suggestions] AI priority suggestion for ${task_id}: ${aiSuggestion.confidence.toFixed(2)}`);
        return aiSuggestion;
      }
    } catch (error) {
      console.warn('[Suggestions] AI priority suggestion failed, falling back to statistical:', error);
    }
  }

  // Fallback to statistical analysis
  return suggestTaskPriorityStatistical(task_id);
}

/**
 * Statistical fallback for task priority suggestions
 */
async function suggestTaskPriorityStatistical(task_id: string): Promise<Suggestion | null> {
  // Get current task state
  const task = getCurrentState('task', task_id);
  if (!task || !task.attributes) {
    return null;
  }

  const currentPriority = task.attributes.priority;
  if (!currentPriority) {
    return null;
  }

  // Get completion time patterns
  const completionPatterns = await getPatternsByType('completion_time');
  if (completionPatterns.length === 0) {
    return null;
  }

  // Find similar completed tasks
  const similarTasks = await findSimilarTasks(task_id);
  if (similarTasks.length < 3) {
    return null;  // Not enough data
  }

  // Analyze priority distribution
  const priorityDist: Record<string, number> = {};
  for (const similarTask of similarTasks) {
    const priority = similarTask.priority || 'none';
    priorityDist[priority] = (priorityDist[priority] || 0) + 1;
  }

  // Most common priority
  const entries = Object.entries(priorityDist).sort((a, b) => b[1] - a[1]);
  const suggestedPriority = entries[0]?.[0];

  if (!suggestedPriority || suggestedPriority === currentPriority) {
    return null;  // Already at suggested priority
  }

  const confidence = entries[0][1] / similarTasks.length;

  // Only suggest if confidence is reasonable
  if (confidence < 0.5) {
    return null;
  }

  return {
    id: `suggest_priority_${task_id}_${Date.now()}`,
    suggestion_type: 'priority',
    target_entity: { type: 'task', id: task_id },
    suggestion: `Set priority to ${suggestedPriority}`,
    rationale: `${similarTasks.length} similar tasks were ${suggestedPriority} priority (${(confidence * 100).toFixed(0)}% match)`,
    confidence,
    based_on_patterns: completionPatterns.map(p => p.id),
    metadata: {
      current_priority: currentPriority,
      suggested_priority: suggestedPriority,
      similar_task_count: similarTasks.length,
      priority_distribution: priorityDist,
      ai_powered: false,
    }
  };
}

/**
 * Suggest next actions based on current context
 *
 * ENHANCED (Phase 5): Uses AI-powered suggestions with Zep memory context
 * Falls back to rule-based analysis if AI fails or is disabled
 */
export async function suggestNextAction(): Promise<Suggestion[]> {
  // Check if AI suggestions are enabled
  const useAI = process.env.USE_AI_SUGGESTIONS !== 'false';

  if (useAI) {
    try {
      const { suggestNextActionsWithAI } = await import('./ai-suggestions');
      const aiSuggestions = await suggestNextActionsWithAI();
      if (aiSuggestions.length > 0) {
        console.log(`[Suggestions] AI action suggestions: ${aiSuggestions.length} items`);
        return aiSuggestions;
      }
    } catch (error) {
      console.warn('[Suggestions] AI action suggestions failed, falling back to rule-based:', error);
    }
  }

  // Fallback to rule-based analysis
  return suggestNextActionRuleBased();
}

/**
 * Rule-based fallback for next action suggestions
 */
async function suggestNextActionRuleBased(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const now = Math.floor(Date.now() / 1000);
  const context = getCurrentContext();

  // Get all open tasks
  const tasks = await getAllTasks();
  const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  // 1. Tasks approaching deadlines
  for (const task of openTasks) {
    if (!task.due_date) continue;

    const dueTimestamp = new Date(task.due_date).getTime() / 1000;
    const daysUntil = (dueTimestamp - now) / 86400;

    if (daysUntil > 0 && daysUntil <= 7) {
      suggestions.push({
        id: `action_deadline_${task.id}`,
        suggestion_type: 'action',
        target_entity: { type: 'task', id: task.id },
        suggestion: `Work on "${task.title}" (due in ${Math.ceil(daysUntil)} days)`,
        rationale: `Deadline approaching`,
        confidence: daysUntil < 3 ? 0.9 : 0.7,
        based_on_patterns: [],
        metadata: {
          days_until_due: daysUntil,
          due_date: task.due_date,
          priority: task.priority
        }
      });
    }
  }

  // 2. High-priority tasks without recent activity
  const staleHighPriority = openTasks.filter(t => {
    if (t.priority !== 'high' && t.priority !== 'urgent') return false;

    const updatedTimestamp = new Date(t.updated_at).getTime() / 1000;
    const daysSinceUpdate = (now - updatedTimestamp) / 86400;

    return daysSinceUpdate > 2;  // No activity for 2+ days
  });

  for (const task of staleHighPriority.slice(0, 3)) {
    const daysSinceUpdate = (now - new Date(task.updated_at).getTime() / 1000) / 86400;

    suggestions.push({
      id: `action_stale_${task.id}`,
      suggestion_type: 'action',
      target_entity: { type: 'task', id: task.id },
      suggestion: `Resume work on "${task.title}"`,
      rationale: `${task.priority} priority task hasn't been touched in ${Math.floor(daysSinceUpdate)} days`,
      confidence: 0.8,
      based_on_patterns: [],
      metadata: {
        days_since_update: daysSinceUpdate,
        priority: task.priority
      }
    });
  }

  // 3. Productive time window suggestion
  const productivePattern = await getPattern('productive_window_peak');
  if (productivePattern && productivePattern.confidence > 0.7 && context.business_hours) {
    const currentDay = new Date().getDay();
    const currentHour = new Date().getHours();

    const patternDay = (productivePattern.metadata.day_of_week as number) || 0;
    const patternHour = (productivePattern.metadata.hour_of_day as number) || 0;

    // Check if we're in the productive window
    if (currentDay === patternDay && Math.abs(currentHour - patternHour) <= 1) {
      suggestions.push({
        id: 'action_productive_window',
        suggestion_type: 'action',
        target_entity: { type: 'task', id: 'system' },
        suggestion: `Focus on deep work tasks now (productive window)`,
        rationale: productivePattern.description,
        confidence: productivePattern.confidence,
        based_on_patterns: [productivePattern.id],
        metadata: {
          pattern: productivePattern.metadata
        }
      });
    }
  }

  // 4. Review stale projects
  const staleProjects = await getPatternsByType('stale_project');
  for (const project of staleProjects.slice(0, 2)) {
    suggestions.push({
      id: `action_review_project_${project.id}`,
      suggestion_type: 'review',
      target_entity: { type: 'project', id: project.metadata.project_name as string },
      suggestion: project.suggested_action || `Review project ${project.metadata.project_name}`,
      rationale: project.description,
      confidence: project.confidence,
      based_on_patterns: [project.id],
      metadata: project.metadata
    });
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Predict completion time for a task
 */
export async function predictCompletionTime(task_id: string): Promise<Suggestion | null> {
  const task = getCurrentState('task', task_id);
  if (!task || !task.attributes) {
    return null;
  }

  const priority = task.attributes.priority;
  if (!priority) {
    return null;
  }

  // Get completion time pattern for this priority
  const pattern = await getPattern(`completion_time_${priority}`);
  if (!pattern || pattern.confidence < 0.5) {
    return null;
  }

  const avgDays = (pattern.metadata.avg_days as number) || 0;
  const stdDev = (pattern.metadata.std_dev as number) || 0;

  // Get task creation time
  const createdFact = queryFacts({
    entity_type: 'task',
    entity_id: task_id,
    attribute: 'status'
  }).find(f => JSON.parse(f.value) === 'pending');

  if (!createdFact) {
    return null;
  }

  const createdAt = createdFact.valid_from;
  const predictedCompletionTimestamp = createdAt + (avgDays * 86400);
  const predictedDate = new Date(predictedCompletionTimestamp * 1000);

  // Adjust based on assignee if available
  const assigneeRel = getCurrentRelationships('task', task_id, 'assigned_to')[0];
  let adjustmentReason = '';

  if (assigneeRel) {
    const assigneeId = assigneeRel.to_entity_id;
    const assigneePattern = await getPattern(`collaboration_assignee_${assigneeId}`);

    if (assigneePattern) {
      const assigneeAvg = (assigneePattern.metadata.avg_completion_days as number) || avgDays;
      const predictedWithAssignee = createdAt + (assigneeAvg * 86400);
      const adjustedDate = new Date(predictedWithAssignee * 1000);

      adjustmentReason = ` (adjusted for ${assigneeId}'s average completion time)`;

      return {
        id: `predict_completion_${task_id}`,
        suggestion_type: 'deadline',
        target_entity: { type: 'task', id: task_id },
        suggestion: `Likely to complete by ${adjustedDate.toLocaleDateString()}`,
        rationale: `Based on ${assigneePattern.metadata.tasks_assigned} tasks completed by ${assigneeId}${adjustmentReason}`,
        confidence: assigneePattern.confidence,
        based_on_patterns: [assigneePattern.id],
        metadata: {
          predicted_date: adjustedDate.toISOString(),
          avg_days: assigneeAvg,
          assignee: assigneeId
        }
      };
    }
  }

  return {
    id: `predict_completion_${task_id}`,
    suggestion_type: 'deadline',
    target_entity: { type: 'task', id: task_id },
    suggestion: `Likely to complete by ${predictedDate.toLocaleDateString()}`,
    rationale: `Based on ${pattern.metadata.sample_size} similar ${priority} priority tasks`,
    confidence: pattern.confidence,
    based_on_patterns: [pattern.id],
    metadata: {
      predicted_date: predictedDate.toISOString(),
      avg_days: avgDays,
      std_dev: stdDev,
      priority
    }
  };
}

/**
 * Generate daily suggestions (for digest)
 *
 * ENHANCED (Phase 5): Uses AI-powered suggestions with Zep memory context
 * Falls back to statistical analysis if AI fails or is disabled
 * 
 * PERSISTENCE UPGRADE: Now saves to DB to prevent "flickering"
 */
export async function generateDailySuggestions(): Promise<Suggestion[]> {
  // 1. Try to get active suggestions from DB first
  const storedSuggestions = getStoredSuggestions(true);

  // If we have valid recent suggestions, return them to ensure stability
  if (storedSuggestions.length > 0) {
    // Only regenerate if they are too old (e.g., > 12 hours) or we have very few
    const newest = storedSuggestions.reduce((latest, s) => {
      const date = s.created_at ? new Date(s.created_at).getTime() : 0;
      return date > latest ? date : latest;
    }, 0);

    // If newest suggestion is less than 1 hour old, just return them
    if (Date.now() - newest < 60 * 60 * 1000) {
      return storedSuggestions;
    }
  }

  // 2. Generate new suggestions
  let newSuggestions: Suggestion[] = [];

  // Check if AI suggestions are enabled
  const useAI = process.env.USE_AI_SUGGESTIONS !== 'false';

  if (useAI) {
    try {
      const { generateDailySuggestionsWithAI } = await import('./ai-suggestions');
      const aiSuggestions = await generateDailySuggestionsWithAI();
      if (aiSuggestions.length > 0) {
        console.log(`[Suggestions] AI daily suggestions: ${aiSuggestions.length} items`);
        newSuggestions = aiSuggestions;
      }
    } catch (error) {
      console.warn('[Suggestions] AI daily suggestions failed, falling back to statistical:', error);
    }
  }

  if (newSuggestions.length === 0) {
    // Fallback to statistical analysis
    newSuggestions = await generateDailySuggestionsStatistical();
  }

  // 3. Save new suggestions to DB
  for (const s of newSuggestions) {
    if (!s.expires_at) {
      // Default expiry: 24 hours
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      s.expires_at = expiry.toISOString();
    }
    saveSuggestion(s);
  }

  // Return combined (stored + new) or just new
  // We prefer returning what's in DB to ensure consistency
  return getStoredSuggestions(true);
}

/**
 * Statistical fallback for daily suggestions
 */
async function generateDailySuggestionsStatistical(): Promise<Suggestion[]> {
  const [
    nextActions,
    taskPriorities
  ] = await Promise.all([
    suggestNextActionRuleBased(),
    generateTaskPrioritySuggestionsStatistical()
  ]);

  const allSuggestions = [
    ...nextActions,
    ...taskPriorities
  ];

  // Deduplicate by target entity
  const seen = new Set<string>();
  const unique = allSuggestions.filter(s => {
    const key = `${s.target_entity.type}:${s.target_entity.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by confidence
  return unique.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find tasks similar to a given task
 */
async function findSimilarTasks(task_id: string): Promise<Array<{
  id: string;
  priority: string;
  project: string | null;
  labels: string[];
}>> {
  const task = getCurrentState('task', task_id);
  if (!task || !task.attributes) {
    return [];
  }

  const taskProject = task.attributes.project_name;
  const taskLabels = task.attributes.labels || [];

  // Get all tasks
  const allTasks = await getAllTasks();

  // Score similarity
  const scored = allTasks
    .filter(t => t.id !== task_id && t.status === 'done')
    .map(t => {
      let score = 0;

      // Same project = +2
      if (t.project_name === taskProject) {
        score += 2;
      }

      // Overlapping labels = +1 per match
      const otherLabels = t.labels || [];
      const overlap = taskLabels.filter((l: string) => otherLabels.includes(l)).length;
      score += overlap;

      return {
        id: t.id,
        priority: t.priority,
        project: t.project_name,
        labels: t.labels,
        score
      };
    })
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return scored;
}

/**
 * Generate priority suggestions for all open tasks
 */
async function generateTaskPrioritySuggestions(): Promise<Suggestion[]> {
  const tasks = await getAllTasks();
  const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  const suggestions: Suggestion[] = [];

  for (const task of openTasks.slice(0, 5)) {  // Limit to 5 to avoid spam
    const suggestion = await suggestTaskPriority(task.id);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

/**
 * Statistical fallback for generating priority suggestions
 */
async function generateTaskPrioritySuggestionsStatistical(): Promise<Suggestion[]> {
  const tasks = await getAllTasks();
  const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

  const suggestions: Suggestion[] = [];

  for (const task of openTasks.slice(0, 5)) {  // Limit to 5 to avoid spam
    const suggestion = await suggestTaskPriorityStatistical(task.id);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

/**
 * Get suggestion by ID
 */
export async function getSuggestion(suggestion_id: string): Promise<Suggestion | null> {
  const stored = getStoredSuggestions(false); // Get all, including expired/acted
  return stored.find(s => s.id === suggestion_id) || null;
}

/**
 * Accept a suggestion (apply it)
 */
export async function acceptSuggestion(suggestion: Suggestion): Promise<void> {
  // This would trigger the actual action (e.g., update task priority)
  // For now, just log it
  console.log(`[Suggestions] Accepted suggestion: ${suggestion.id}`);

  // Update persistence
  updateSuggestionStatus(suggestion.id, 'accepted');

  // Record as temporal fact for learning
  // (This would be implemented based on suggestion type)
}

/**
 * Reject a suggestion (feedback for learning)
 */
export async function rejectSuggestion(
  suggestion: Suggestion,
  reason?: string
): Promise<void> {
  console.log(`[Suggestions] Rejected suggestion: ${suggestion.id}, reason: ${reason}`);

  // Update persistence
  updateSuggestionStatus(suggestion.id, 'rejected');

  // Record rejection for learning
  // This feeds into the correction feedback system
}
