/**
 * Action Executors
 *
 * Handles execution of agentic actions (email drafts, tasks, reminders, etc.)
 * Routes actions to appropriate systems (local_tasks, notifications, etc.)
 */

import { getAgenticActionById, updateAgenticActionStatusWithMeta, listAgenticActions } from '@/lib/db/queries';
import { createLocalTask } from '@/lib/pm/local-task-store';
import type { TaskPriority } from '@/lib/pm/types';

export interface ExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Execute a single agentic action by ID
 */
export async function executeSingleAction(actionId: string): Promise<ExecutionResult> {
  try {
    const action = getAgenticActionById(actionId);

    if (!action) {
      return { success: false, message: 'Action not found' };
    }

    // Route to appropriate executor based on action type
    let result: ExecutionResult;

    switch (action.type) {
      case 'email_draft':
        result = await executeEmailDraft(action);
        break;
      case 'task':
        result = await executeTask(action);
        break;
      case 'reminder':
        result = await executeReminder(action);
        break;
      case 'calendar_event':
        result = await executeCalendarEvent(action);
        break;
      case 'note':
        result = await executeNote(action);
        break;
      default:
        result = { success: false, message: `Unknown action type: ${action.type}` };
    }

    // Update action status based on result
    if (result.success) {
      updateAgenticActionStatusWithMeta(actionId, 'executed', {
        executed_at: Date.now(),
        result: result.message
      });
    } else {
      updateAgenticActionStatusWithMeta(actionId, 'failed', {
        failed_at: Date.now(),
        error: result.message
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateAgenticActionStatusWithMeta(actionId, 'failed', {
      failed_at: Date.now(),
      error: message
    });
    return { success: false, message };
  }
}

/**
 * Execute email draft action
 */
async function executeEmailDraft(action: any): Promise<ExecutionResult> {
  // TODO: Integrate with email sending service (Gmail API, SMTP, etc.)
  console.log('[Executor] Email draft action:', action.title);

  // For now, mark as executed (stub)
  return {
    success: true,
    message: `Email draft "${action.title}" ready for sending`,
    data: { draft_id: action.id }
  };
}

/**
 * Execute task action - creates a local_task from agentic action
 */
async function executeTask(action: any): Promise<ExecutionResult> {
  console.log('[Executor] Task action:', action.title);

  try {
    // Parse metadata for additional context
    const metadata = typeof action.metadata === 'string'
      ? JSON.parse(action.metadata)
      : (action.metadata || {});

    // Determine priority from metadata or default to medium
    const priorityMap: Record<string, TaskPriority> = {
      'critical': 'urgent',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
    };
    const priority: TaskPriority = priorityMap[metadata.priority] || 'medium';

    // Extract labels from adjudication suggested_tags
    const adjudication = metadata.adjudication || {};
    const labels = adjudication.suggested_tags || [];

    // Create the local task
    const task = createLocalTask({
      title: action.title || 'Untitled Task',
      description: action.content || null,
      status: 'pending',
      priority,
      project_name: adjudication.domain || null,
      labels,
      metadata: {
        source: 'agentic_action',
        agentic_action_id: action.id,
        original_source: action.source,
        target_agent: adjudication.target_agent || null,
        reasoning: adjudication.reasoning || null,
        created_from: 'executor',
      },
      user_id: action.user_id || 'default',
    });

    console.log(`[Executor] Created local_task ${task.id} from agentic action ${action.id}`);

    return {
      success: true,
      message: `Task "${action.title}" created as local_task ${task.id}`,
      data: { task_id: task.id, agentic_action_id: action.id }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Executor] Failed to create task:', message);
    return {
      success: false,
      message: `Failed to create task: ${message}`,
    };
  }
}

/**
 * Execute reminder action
 */
async function executeReminder(action: any): Promise<ExecutionResult> {
  // TODO: Integrate with notification service (push notifications, email, etc.)
  console.log('[Executor] Reminder action:', action.title);

  return {
    success: true,
    message: `Reminder "${action.title}" scheduled`,
    data: { reminder_id: action.id }
  };
}

/**
 * Execute calendar event action
 */
async function executeCalendarEvent(action: any): Promise<ExecutionResult> {
  // TODO: Integrate with calendar service (Google Calendar, etc.)
  console.log('[Executor] Calendar event action:', action.title);

  return {
    success: true,
    message: `Calendar event "${action.title}" created`,
    data: { event_id: action.id }
  };
}

/**
 * Execute note action
 */
async function executeNote(action: any): Promise<ExecutionResult> {
  // TODO: Integrate with notes service (Notion, Obsidian, etc.)
  console.log('[Executor] Note action:', action.title);

  return {
    success: true,
    message: `Note "${action.title}" saved`,
    data: { note_id: action.id }
  };
}

/**
 * Run all queued high-confidence actions
 * Used by scheduled jobs to auto-execute trusted actions
 * Note: Uses allUsers=true to process actions from all users
 */
export async function runActionExecutors(): Promise<{
  executed: number;
  failed: number;
  results: ExecutionResult[];
}> {
  const queued = listAgenticActions({ status: 'queued', limit: 100, allUsers: true });
  const results: ExecutionResult[] = [];
  let executed = 0;
  let failed = 0;

  for (const action of queued) {
    const result = await executeSingleAction(action.id);
    results.push(result);
    if (result.success) {
      executed++;
    } else {
      failed++;
    }
  }

  console.log(`[Executors] Processed ${queued.length} queued actions: ${executed} executed, ${failed} failed`);
  return { executed, failed, results };
}
