/**
 * Task Store and Consolidator
 *
 * This module manages unified tasks and handles consolidation logic for the
 * Cognitive Synthesis Engine. It provides the TaskStore class for CRUD operations
 * on tasks and the Consolidator class for merging/splitting similar tasks.
 *
 * Architecture:
 * - TaskStore: Database operations for unified tasks
 * - Consolidator: Similarity detection and task merging/splitting logic
 * - applySynthesisResult: Applies LLM synthesis output to the database
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import type {
  UnifiedTask,
  SynthesisResult,
  TaskUpdate,
  ProactiveAction,
  TaskQuery,
  UnifiedTaskStatus,
  UrgencyLevel,
} from './types';
import type { Domain } from '../ea/preference-model';

// Prevent client-side imports
ensureServerOnly('lib/cortex/task-store');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for a task
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if unified_tasks table exists
 */
function hasUnifiedTasksTable(): boolean {
  try {
    const db = getDatabase().getRawDb() as any;
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='unified_tasks'`)
      .get();
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses simple word overlap for now - could be enhanced with embeddings
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = words1.filter((x) => set2.has(x));
  const union = Array.from(new Set([...words1, ...words2]));

  if (union.length === 0) return 0;
  return intersection.length / union.length;
}

/**
 * Calculate overlap between two arrays
 */
function calculateArrayOverlap<T>(arr1: T[], arr2: T[]): number {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  const intersection = arr1.filter((x) => set2.has(x));
  const union = Array.from(new Set([...arr1, ...arr2]));

  if (union.length === 0) return 0;
  return intersection.length / union.length;
}

// ============================================================================
// TaskStore Class
// ============================================================================

/**
 * TaskStore - CRUD operations for unified tasks
 *
 * Manages all database operations for unified tasks including creation,
 * retrieval, updates, and queries.
 */
export class TaskStore {
  /**
   * Create a new unified task
   */
  async createTask(task: Omit<UnifiedTask, 'id'>): Promise<UnifiedTask> {
    if (!hasUnifiedTasksTable()) {
      throw new Error('unified_tasks table does not exist');
    }

    const db = getDatabase().getRawDb() as any;
    const id = generateTaskId();

    const stmt = db.prepare(`
      INSERT INTO unified_tasks (
        id, title, description, confidence, urgency, domain,
        source_events_json, proposed_action_json, status,
        last_refined_at, refinement_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      task.title,
      task.description || null,
      task.confidence,
      task.urgency,
      task.domain || null,
      JSON.stringify(task.sourceEvents || []),
      task.proposedAction ? JSON.stringify(task.proposedAction) : null,
      task.status,
      task.lastRefinedAt ? Math.floor(new Date(task.lastRefinedAt).getTime() / 1000) : null,
      task.refinementCount
    );

    return this.getTask(id) as Promise<UnifiedTask>;
  }

  /**
   * Get a task by ID
   */
  async getTask(id: string): Promise<UnifiedTask | null> {
    if (!hasUnifiedTasksTable()) return null;

    const db = getDatabase().getRawDb() as any;
    const stmt = db.prepare(`SELECT * FROM unified_tasks WHERE id = ?`);
    const row = stmt.get(id);

    if (!row) return null;

    return this.mapRowToTask(row);
  }

  /**
   * Update a task
   */
  async updateTask(id: string, updates: Partial<UnifiedTask>): Promise<UnifiedTask> {
    if (!hasUnifiedTasksTable()) {
      throw new Error('unified_tasks table does not exist');
    }

    const db = getDatabase().getRawDb() as any;
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }
    if (updates.urgency !== undefined) {
      fields.push('urgency = ?');
      values.push(updates.urgency);
    }
    if (updates.domain !== undefined) {
      fields.push('domain = ?');
      values.push(updates.domain);
    }
    if (updates.sourceEvents !== undefined) {
      fields.push('source_events_json = ?');
      values.push(JSON.stringify(updates.sourceEvents));
    }
    if (updates.proposedAction !== undefined) {
      fields.push('proposed_action_json = ?');
      values.push(updates.proposedAction ? JSON.stringify(updates.proposedAction) : null);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.lastRefinedAt !== undefined) {
      fields.push('last_refined_at = ?');
      values.push(Math.floor(new Date(updates.lastRefinedAt).getTime() / 1000));
    }
    if (updates.refinementCount !== undefined) {
      fields.push('refinement_count = ?');
      values.push(updates.refinementCount);
    }

    if (fields.length === 0) {
      throw new Error('No valid update fields provided');
    }

    fields.push('updated_at = strftime("%s", "now")');
    values.push(id);

    const sql = `UPDATE unified_tasks SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);

    return this.getTask(id) as Promise<UnifiedTask>;
  }

  /**
   * Get tasks matching query filters
   */
  async getTasks(query: TaskQuery = {}): Promise<UnifiedTask[]> {
    if (!hasUnifiedTasksTable()) return [];

    const db = getDatabase().getRawDb() as any;
    const conditions: string[] = [];
    const values: any[] = [];

    // Filter by status
    if (query.status) {
      if (Array.isArray(query.status)) {
        const placeholders = query.status.map(() => '?').join(',');
        conditions.push(`status IN (${placeholders})`);
        values.push(...query.status);
      } else {
        conditions.push('status = ?');
        values.push(query.status);
      }
    }

    // Filter by domain
    if (query.domain) {
      if (Array.isArray(query.domain)) {
        const placeholders = query.domain.map(() => '?').join(',');
        conditions.push(`domain IN (${placeholders})`);
        values.push(...query.domain);
      } else {
        conditions.push('domain = ?');
        values.push(query.domain);
      }
    }

    // Filter by urgency
    if (query.urgency) {
      if (Array.isArray(query.urgency)) {
        const placeholders = query.urgency.map(() => '?').join(',');
        conditions.push(`urgency IN (${placeholders})`);
        values.push(...query.urgency);
      } else {
        conditions.push('urgency = ?');
        values.push(query.urgency);
      }
    }

    // Filter by minimum confidence
    if (query.minConfidence !== undefined) {
      conditions.push('confidence >= ?');
      values.push(query.minConfidence);
    }

    // Build query
    let sql = 'SELECT * FROM unified_tasks';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortDirection = query.sortDirection || 'desc';
    const sortColumn = sortBy === 'createdAt' ? 'created_at' : sortBy;
    sql += ` ORDER BY ${sortColumn} ${sortDirection.toUpperCase()}`;

    // Pagination
    if (query.limit) {
      sql += ` LIMIT ?`;
      values.push(query.limit);
    }
    if (query.offset) {
      sql += ` OFFSET ?`;
      values.push(query.offset);
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...values);

    return rows.map((row: any) => this.mapRowToTask(row));
  }

  /**
   * Get tasks that need refinement
   * Tasks with low confidence and status = synthesizing
   */
  async getTasksNeedingRefinement(): Promise<UnifiedTask[]> {
    return this.getTasks({
      status: ['synthesizing', 'ready'],
      minConfidence: 0,
      sortBy: 'confidence',
      sortDirection: 'asc',
    }).then((tasks) => tasks.filter((t) => t.confidence < 0.7));
  }

  /**
   * Get tasks by source event ID
   */
  async getTasksBySourceEvent(eventId: string): Promise<UnifiedTask[]> {
    if (!hasUnifiedTasksTable()) return [];

    const db = getDatabase().getRawDb() as any;
    const stmt = db.prepare(`
      SELECT * FROM unified_tasks
      WHERE source_events_json LIKE ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(`%"${eventId}"%`);
    return rows.map((row: any) => this.mapRowToTask(row));
  }

  /**
   * Archive a task (set status to dismissed)
   */
  async archiveTask(id: string): Promise<void> {
    await this.updateTask(id, { status: 'dismissed' });
  }

  /**
   * Map database row to UnifiedTask object
   */
  private mapRowToTask(row: any): UnifiedTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      confidence: row.confidence,
      urgency: row.urgency as UrgencyLevel,
      domain: row.domain as Domain,
      sourceEvents: row.source_events_json ? JSON.parse(row.source_events_json) : [],
      proposedAction: row.proposed_action_json
        ? JSON.parse(row.proposed_action_json)
        : undefined,
      status: row.status as UnifiedTaskStatus,
      createdAt: new Date(row.created_at * 1000).toISOString(),
      lastRefinedAt: row.last_refined_at
        ? new Date(row.last_refined_at * 1000).toISOString()
        : undefined,
      refinementCount: row.refinement_count,
      assignedAgent: undefined, // Not stored in DB yet
      deadline: undefined, // Not stored in DB yet
      relatedTasks: undefined, // Not stored in DB yet
      metadata: undefined, // Not stored in DB yet
    };
  }
}

// ============================================================================
// Consolidator Class
// ============================================================================

/**
 * Consolidator - Task merging and splitting logic
 *
 * Handles detection of duplicate/similar tasks and provides methods for
 * consolidating them or splitting complex tasks.
 */
export class Consolidator {
  private taskStore: TaskStore;

  constructor(taskStore: TaskStore) {
    this.taskStore = taskStore;
  }

  /**
   * Find groups of duplicate/similar tasks
   * Returns arrays of tasks that should be merged
   */
  findDuplicates(tasks: UnifiedTask[]): UnifiedTask[][] {
    const groups: UnifiedTask[][] = [];
    const processed = new Set<string>();

    for (const task of tasks) {
      if (processed.has(task.id)) continue;

      const similar: UnifiedTask[] = [task];
      processed.add(task.id);

      for (const other of tasks) {
        if (processed.has(other.id)) continue;
        if (this.shouldMerge(task, other)) {
          similar.push(other);
          processed.add(other.id);
        }
      }

      if (similar.length > 1) {
        groups.push(similar);
      }
    }

    return groups;
  }

  /**
   * Check if two tasks should be merged
   * Based on title/description similarity and source event overlap
   */
  shouldMerge(a: UnifiedTask, b: UnifiedTask): boolean {
    // Calculate title similarity
    const titleSimilarity = calculateSimilarity(a.title, b.title);

    // Calculate description similarity
    const descSimilarity = a.description && b.description
      ? calculateSimilarity(a.description, b.description)
      : 0;

    // Calculate source event overlap
    const eventOverlap = calculateArrayOverlap(a.sourceEvents, b.sourceEvents);

    // Merge if:
    // - High title similarity (>0.8) OR
    // - High description similarity (>0.7) AND some event overlap (>0.3)
    return titleSimilarity > 0.8 || (descSimilarity > 0.7 && eventOverlap > 0.3);
  }

  /**
   * Merge a group of tasks into a single task
   * Returns the merged task
   */
  async mergeTaskGroup(group: UnifiedTask[]): Promise<UnifiedTask> {
    if (group.length === 0) {
      throw new Error('Cannot merge empty task group');
    }

    if (group.length === 1) {
      return group[0];
    }

    // Find task with highest confidence
    const primary = group.reduce((best, task) =>
      task.confidence > best.confidence ? task : best
    );

    // Combine source events from all tasks
    const allSourceEvents = new Set<string>();
    for (const task of group) {
      task.sourceEvents.forEach((eventId) => allSourceEvents.add(eventId));
    }

    // Take the most complete description
    const description = group
      .map((t) => t.description)
      .filter((d) => d && d.length > 0)
      .sort((a, b) => (b?.length || 0) - (a?.length || 0))[0] || primary.description;

    // Take the highest urgency
    const urgencyOrder: UrgencyLevel[] = ['critical', 'high', 'medium', 'low', 'background'];
    const urgency = group
      .map((t) => t.urgency)
      .sort((a, b) => urgencyOrder.indexOf(a) - urgencyOrder.indexOf(b))[0];

    // Create merged task
    const merged = await this.taskStore.createTask({
      title: primary.title,
      description: description || '',
      confidence: Math.max(...group.map((t) => t.confidence)),
      urgency,
      domain: primary.domain,
      sourceEvents: Array.from(allSourceEvents),
      proposedAction: primary.proposedAction,
      status: 'synthesizing',
      refinementCount: 0,
      createdAt: new Date().toISOString(),
      lastRefinedAt: new Date().toISOString(),
    });

    // Archive the original tasks
    for (const task of group) {
      await this.taskStore.archiveTask(task.id);
    }

    return merged;
  }

  /**
   * Consolidate a task by merging with similar tasks
   * Finds overlapping tasks and merges them
   */
  async consolidateTask(task: UnifiedTask): Promise<UnifiedTask> {
    // Find tasks with overlapping source events
    const overlapping: UnifiedTask[] = [];

    for (const eventId of task.sourceEvents) {
      const tasks = await this.taskStore.getTasksBySourceEvent(eventId);
      for (const t of tasks) {
        if (t.id !== task.id && !overlapping.find((o) => o.id === t.id)) {
          overlapping.push(t);
        }
      }
    }

    if (overlapping.length === 0) {
      return task;
    }

    // Filter to highly similar tasks
    const similar = overlapping.filter((t) => this.shouldMerge(task, t));

    if (similar.length === 0) {
      return task;
    }

    // Merge the group
    return this.mergeTaskGroup([task, ...similar]);
  }

  /**
   * Split a complex task into multiple simpler tasks
   * This is a placeholder - actual implementation would use LLM analysis
   */
  async splitTask(task: UnifiedTask): Promise<UnifiedTask[]> {
    // For now, just return the original task
    // In a full implementation, this would:
    // 1. Analyze the task description for distinct action types
    // 2. Identify natural boundaries in source events
    // 3. Create separate tasks for each component
    // 4. Link them via relatedTasks

    return [task];
  }
}

// ============================================================================
// Apply Synthesis Result
// ============================================================================

/**
 * Apply synthesis result from LLM to the database
 *
 * Takes the structured output from a synthesis pass and:
 * - Creates new tasks from unified_tasks array
 * - Applies updates to existing tasks
 * - Attaches proposed actions to tasks
 *
 * Returns a summary of changes made
 */
export async function applySynthesisResult(
  result: SynthesisResult,
  taskStore: TaskStore
): Promise<{
  tasksCreated: number;
  tasksUpdated: number;
  actionsProposed: number;
  summary: string;
}> {
  let tasksCreated = 0;
  let tasksUpdated = 0;
  let actionsProposed = 0;

  // 1. Create new tasks
  for (const taskData of result.unified_tasks) {
    await taskStore.createTask({
      ...taskData,
      status: 'synthesizing',
      refinementCount: 0,
      createdAt: new Date().toISOString(),
    });
    tasksCreated++;
  }

  // 2. Apply task updates
  for (const update of result.task_updates) {
    const existing = await taskStore.getTask(update.taskId);
    if (!existing) continue;

    // Merge new source events
    const allEvents = [...existing.sourceEvents, ...update.newSourceEvents];
    const sourceEvents = Array.from(new Set(allEvents));

    await taskStore.updateTask(update.taskId, {
      ...update.updates,
      sourceEvents,
      refinementCount: existing.refinementCount + 1,
      lastRefinedAt: new Date().toISOString(),
    });
    tasksUpdated++;
  }

  // 3. Handle proposed actions
  // For now, we'll attach them to the first relevant task or create a new task
  for (const action of result.proposed_actions) {
    // Find a task that could use this action
    const tasks = await taskStore.getTasks({
      status: 'synthesizing',
      limit: 10,
    });

    if (tasks.length > 0 && !tasks[0].proposedAction) {
      await taskStore.updateTask(tasks[0].id, {
        proposedAction: action,
      });
      actionsProposed++;
    }
  }

  const summary = `Applied synthesis result: ${tasksCreated} tasks created, ${tasksUpdated} tasks updated, ${actionsProposed} actions proposed`;

  return {
    tasksCreated,
    tasksUpdated,
    actionsProposed,
    summary,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton TaskStore instance
 */
export const taskStore = new TaskStore();

/**
 * Singleton Consolidator instance
 */
export const consolidator = new Consolidator(taskStore);
