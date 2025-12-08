/**
 * Cognitive Synthesis Engine - Usage Examples
 *
 * This file provides practical examples of how to use the Cognitive Synthesis Engine
 * database tables and query functions.
 */

import { createHash } from 'crypto';
import {
  insertWorkingMemoryEvent,
  insertWorkingMemoryEvents,
  getUnprocessedEvents,
  getEventsBySource,
  findEventByHash,
  markEventProcessed,
  insertUnifiedTask,
  getUnifiedTasksByStatus,
  getUnifiedTasksByDomain,
  updateUnifiedTaskStatus,
  refineUnifiedTask,
  getUnifiedTaskById,
  insertSynthesisPattern,
  getSynthesisPatternsByType,
  updatePatternMetrics,
  getAllSynthesisPatterns,
} from './queries';

import type {
  WorkingMemoryEventInput,
  UnifiedTaskInput,
  SynthesisPatternInput,
} from './types';

/**
 * Example 1: Ingest events from multiple sources
 */
export function exampleIngestEvents() {
  // Email event
  const emailContent = 'Quarterly board meeting scheduled for Dec 15 at 10am';
  const emailHash = createHash('sha256').update(emailContent).digest('hex');

  insertWorkingMemoryEvent({
    id: `gmail-${Date.now()}`,
    source: 'gmail',
    timestamp: Math.floor(Date.now() / 1000),
    content: emailContent,
    content_hash: emailHash,
    embedding_json: null,
    initial_classification: 'meeting',
    processed_by_synthesis: 0,
    synthesis_task_id: null,
  });

  // Calendar event
  const calendarContent = 'Board meeting prep - 2 hours before board meeting';
  const calendarHash = createHash('sha256').update(calendarContent).digest('hex');

  insertWorkingMemoryEvent({
    id: `calendar-${Date.now()}`,
    source: 'calendar',
    timestamp: Math.floor(Date.now() / 1000),
    content: calendarContent,
    content_hash: calendarHash,
    embedding_json: null,
    initial_classification: 'reminder',
    processed_by_synthesis: 0,
    synthesis_task_id: null,
  });
}

/**
 * Example 2: Check for duplicate events before inserting
 */
export function exampleCheckDuplicate(content: string) {
  const hash = createHash('sha256').update(content).digest('hex');
  const existing = findEventByHash(hash);

  if (existing) {
    console.log('Event already exists:', existing.id);
    return false;
  }

  insertWorkingMemoryEvent({
    id: `event-${Date.now()}`,
    source: 'gmail',
    timestamp: Math.floor(Date.now() / 1000),
    content,
    content_hash: hash,
    embedding_json: null,
    initial_classification: 'info',
    processed_by_synthesis: 0,
    synthesis_task_id: null,
  });

  return true;
}

/**
 * Example 3: Process unprocessed events into unified tasks
 */
export function exampleProcessEvents() {
  // Get unprocessed events
  const events = getUnprocessedEvents(100);

  // Group related events (simplified - real implementation would use ML/patterns)
  const boardMeetingEvents = events.filter(e =>
    e.content.toLowerCase().includes('board meeting')
  );

  if (boardMeetingEvents.length > 0) {
    // Create unified task from related events
    const taskId = `task-${Date.now()}`;

    insertUnifiedTask({
      id: taskId,
      title: 'Prepare for quarterly board meeting',
      description: 'Board meeting scheduled for Dec 15 at 10am. Prep time allocated 2 hours prior.',
      confidence: 0.9, // High confidence - multiple sources confirm
      urgency: 'high',
      domain: 'legal',
      source_events_json: JSON.stringify(boardMeetingEvents.map(e => e.id)),
      proposed_action_json: JSON.stringify({
        type: 'task',
        target: 'motion',
        payload: {
          title: 'Board meeting prep',
          due_date: '2025-12-15T08:00:00Z',
          description: 'Review financials, legal updates, strategic initiatives',
        },
      }),
      status: 'ready',
      last_refined_at: null,
      refinement_count: 0,
    });

    // Mark events as processed
    boardMeetingEvents.forEach(event => {
      markEventProcessed(event.id, taskId);
    });
  }
}

/**
 * Example 4: Refine a task based on new information
 */
export function exampleRefineTask(taskId: string) {
  const task = getUnifiedTaskById(taskId);

  if (!task) return;

  // New information increases confidence
  refineUnifiedTask(taskId, 0.95);

  // Update proposed action with more details
  const currentAction = task.proposed_action_json
    ? JSON.parse(task.proposed_action_json)
    : {};

  const updatedTask: UnifiedTaskInput = {
    ...task,
    proposed_action_json: JSON.stringify({
      ...currentAction,
      payload: {
        ...currentAction.payload,
        attendees: ['CEO', 'CFO', 'Legal Counsel'],
        agenda: ['Q4 Financials', 'Legal Compliance Review', '2026 Strategy'],
      },
    }),
  };

  insertUnifiedTask(updatedTask);
}

/**
 * Example 5: Create and use synthesis patterns
 */
export function exampleSynthesisPatterns() {
  // Create a consolidation pattern
  const consolidationPattern: SynthesisPatternInput = {
    id: 'pattern-meeting-consolidation',
    pattern_type: 'consolidation',
    description: 'Consolidate calendar events and email mentions of the same meeting',
    trigger_conditions: 'Same date/time mentioned in multiple sources',
    suggested_behavior: 'Create single unified task with all context',
    success_rate: 0.5,
    usage_count: 0,
  };

  insertSynthesisPattern(consolidationPattern);

  // Create an urgency pattern
  const urgencyPattern: SynthesisPatternInput = {
    id: 'pattern-board-meeting-urgency',
    pattern_type: 'urgency',
    description: 'Board meetings are always high urgency',
    trigger_conditions: 'Event contains "board meeting" or "board of directors"',
    suggested_behavior: 'Set urgency to "high"',
    success_rate: 0.5,
    usage_count: 0,
  };

  insertSynthesisPattern(urgencyPattern);

  // Simulate pattern usage and update metrics
  // If pattern successfully identified a board meeting as urgent:
  updatePatternMetrics('pattern-board-meeting-urgency', true);

  // If pattern incorrectly flagged something as urgent:
  updatePatternMetrics('pattern-board-meeting-urgency', false);
}

/**
 * Example 6: Query tasks by status and domain
 */
export function exampleQueryTasks() {
  // Get all tasks ready for approval
  const readyTasks = getUnifiedTasksByStatus('ready', 50);
  console.log(`${readyTasks.length} tasks ready for approval`);

  // Get all legal domain tasks
  const legalTasks = getUnifiedTasksByDomain('legal', 50);
  console.log(`${legalTasks.length} legal tasks`);

  // Get all finance tasks that are in progress
  const financeTasks = getUnifiedTasksByDomain('finance', 50);
  const financeInProgress = financeTasks.filter(t => t.status === 'executing');
  console.log(`${financeInProgress.length} finance tasks in progress`);
}

/**
 * Example 7: Task status workflow
 */
export function exampleTaskWorkflow(taskId: string) {
  // Task starts in 'synthesizing' status
  insertUnifiedTask({
    id: taskId,
    title: 'Review contract with vendor',
    description: null,
    confidence: 0.6,
    urgency: 'medium',
    domain: 'legal',
    source_events_json: null,
    proposed_action_json: null,
    status: 'synthesizing',
    last_refined_at: null,
    refinement_count: 0,
  });

  // After synthesis completes, mark as ready
  updateUnifiedTaskStatus(taskId, 'ready');

  // User approves the task
  updateUnifiedTaskStatus(taskId, 'approved');

  // System starts executing the task
  updateUnifiedTaskStatus(taskId, 'executing');

  // Task completes successfully
  updateUnifiedTaskStatus(taskId, 'completed');

  // Alternative: User dismisses the task
  // updateUnifiedTaskStatus(taskId, 'dismissed');
}

/**
 * Example 8: Batch event ingestion from external API
 */
export function exampleBatchIngest(apiResponse: any[]) {
  const events: WorkingMemoryEventInput[] = apiResponse.map(item => {
    const content = JSON.stringify(item);
    const hash = createHash('sha256').update(content).digest('hex');

    return {
      id: `${item.source}-${item.id}`,
      source: item.source,
      timestamp: item.timestamp,
      content,
      content_hash: hash,
      embedding_json: item.embedding ? JSON.stringify(item.embedding) : null,
      initial_classification: item.type || 'info',
      processed_by_synthesis: 0,
      synthesis_task_id: null,
    };
  });

  // Filter out duplicates
  const uniqueEvents = events.filter(event => !findEventByHash(event.content_hash));

  // Batch insert
  insertWorkingMemoryEvents(uniqueEvents);

  console.log(`Ingested ${uniqueEvents.length} new events (${events.length - uniqueEvents.length} duplicates skipped)`);
}

/**
 * Example 9: Get events from specific source for debugging
 */
export function exampleDebugSource(source: string) {
  const recentEvents = getEventsBySource(source, 20);

  console.log(`Recent events from ${source}:`);
  recentEvents.forEach(event => {
    console.log(`- [${new Date(event.timestamp * 1000).toISOString()}] ${event.content.substring(0, 100)}`);
  });

  return recentEvents;
}

/**
 * Example 10: Pattern effectiveness analysis
 */
export function examplePatternAnalysis() {
  const allPatterns = getAllSynthesisPatterns();

  console.log('Pattern Effectiveness Analysis:');
  console.log('================================');

  allPatterns.forEach(pattern => {
    const effectiveness = (pattern.success_rate * 100).toFixed(1);
    console.log(`${pattern.description}`);
    console.log(`  Type: ${pattern.pattern_type}`);
    console.log(`  Success Rate: ${effectiveness}%`);
    console.log(`  Usage Count: ${pattern.usage_count}`);
    console.log('');
  });

  // Identify underperforming patterns
  const lowPerformance = allPatterns.filter(p => p.success_rate < 0.3 && p.usage_count > 10);
  if (lowPerformance.length > 0) {
    console.log('Patterns needing review:');
    lowPerformance.forEach(p => console.log(`- ${p.description}`));
  }
}
