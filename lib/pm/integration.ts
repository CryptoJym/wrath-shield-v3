/**
 * PM Integration Layer
 *
 * GitHub-native project management system.
 * Aggregates tasks and projects from:
 * - GitHub (issues as tasks, milestones as projects) - PRIMARY SOURCE
 * - Local tasks (SQLite-persisted PM items)
 * - Local context requests (routed PM items)
 *
 * Motion has been deprecated in favor of a unified GitHub-centric workflow.
 */

import githubClient, { type GitHubIssue } from '@/lib/integrations/GitHubClient';
import { getAllContextRequests, type ContextRequest } from '@/lib/context_requests';
import {
  getLocalTasks,
  createLocalTask,
  updateLocalTask,
  deleteLocalTask,
  getLocalTask,
  type LocalTask,
} from './local-task-store';
import type {
  UnifiedTask,
  UnifiedProject,
  PMDashboardData,
  TaskStatus,
  TaskPriority,
  TaskSource,
} from './types';

/**
 * Map GitHub issue to unified task
 */
function githubIssueToTask(issue: GitHubIssue): UnifiedTask {
  const status: TaskStatus = issue.state === 'closed' ? 'done' : 'in_progress';

  // Determine priority from labels (safely handle missing labels array)
  let priority: TaskPriority = 'medium';
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  const priorityLabels = labels.map(l => (l?.name || '').toLowerCase());
  if (priorityLabels.some(l => l.includes('urgent') || l.includes('critical'))) {
    priority = 'urgent';
  } else if (priorityLabels.some(l => l.includes('high'))) {
    priority = 'high';
  } else if (priorityLabels.some(l => l.includes('low'))) {
    priority = 'low';
  }

  // Include repo info in the task ID for multi-repo support
  // Use __ as separator between owner and repo to handle hyphens in names
  const repoFullName = issue.repo_full_name || '';
  const taskId = repoFullName
    ? `github-${repoFullName.replace('/', '__')}-${issue.number}`
    : `github-${issue.id}`;

  return {
    id: taskId,
    source: 'github',
    source_id: String(issue.number),
    title: issue.title,
    description: issue.body,
    status,
    priority,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    due_date: issue.milestone?.due_on || null,
    url: issue.html_url,
    project_id: issue.milestone ? `github-milestone-${issue.milestone.id}` : null,
    project_name: issue.milestone?.title || null,
    assignee: issue.assignees?.[0]?.login || null,
    labels: labels.map(l => l?.name || '').filter(Boolean),
    metadata: {
      number: issue.number,
      milestone: issue.milestone,
      assignees: issue.assignees,
    },
  };
}

/**
 * Map context request to unified task
 */
function contextRequestToTask(req: ContextRequest): UnifiedTask {
  const statusMap: Record<ContextRequest['status'], TaskStatus> = {
    pending: 'pending',
    processing: 'in_progress',
    dispatched: 'in_progress',
    done: 'done',
    failed: 'failed',
  };

  return {
    id: `context-${req.id}`,
    source: 'local',
    source_id: req.id,
    title: req.event_payload.subject || req.event_payload.preview?.slice(0, 60) || 'Untitled',
    description: req.event_payload.preview || null,
    status: statusMap[req.status],
    priority: 'medium',
    created_at: new Date(req.created_at * 1000).toISOString(),
    updated_at: new Date(req.updated_at * 1000).toISOString(),
    due_date: null,
    url: null,
    project_id: null,
    project_name: null,
    assignee: null,
    labels: [req.event_payload.channel],
    metadata: {
      event_id: req.event_id,
      channel: req.event_payload.channel,
      contact: req.event_payload.contact,
      resolution_summary: req.resolution_summary,
      follow_up_questions: req.follow_up_questions,
      is_context_request: true,
    },
  };
}

/**
 * Map local task to unified task
 */
function localTaskToUnifiedTask(task: LocalTask): UnifiedTask {
  return {
    id: `local-${task.id}`,
    source: 'local',
    source_id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    created_at: new Date(task.created_at * 1000).toISOString(),
    updated_at: new Date(task.updated_at * 1000).toISOString(),
    due_date: task.due_date,
    url: null,
    project_id: task.project_id,
    project_name: task.project_name,
    assignee: task.assignee,
    labels: task.labels,
    metadata: {
      ...task.metadata,
      is_local_task: true,
    },
  };
}

/**
 * Fetch all tasks from all sources
 */
export async function getAllTasks(): Promise<UnifiedTask[]> {
  const tasks: UnifiedTask[] = [];
  const errors: string[] = [];

  // Fetch GitHub tasks (PRIMARY SOURCE)
  if (githubClient.isConfigured()) {
    try {
      const githubIssues = await githubClient.getIssues({ state: 'all', limit: 100 });
      tasks.push(...githubIssues.map(githubIssueToTask));
    } catch (error) {
      console.error('[PM Integration] GitHub fetch error:', error);
      errors.push(`GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch local SQLite tasks
  try {
    const localTasks = getLocalTasks({ limit: 100 });
    tasks.push(...localTasks.map(localTaskToUnifiedTask));
  } catch (error) {
    console.error('[PM Integration] Local tasks error:', error);
    errors.push(`Local Tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Fetch local context requests (routed items)
  try {
    const contextRequests = getAllContextRequests({ target: 'pm' });
    tasks.push(...contextRequests.map(contextRequestToTask));
  } catch (error) {
    console.error('[PM Integration] Context requests error:', error);
    errors.push(`Context Requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Sort by updated_at descending
  tasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return tasks;
}

/**
 * Fetch all projects from all sources
 * Projects are derived from GitHub milestones and repository organization
 */
export async function getAllProjects(): Promise<UnifiedProject[]> {
  const projects: UnifiedProject[] = [];

  // Fetch GitHub milestones as projects (PRIMARY SOURCE)
  if (githubClient.isConfigured()) {
    try {
      const milestones = await githubClient.getMilestones({ state: 'all' });
      projects.push(...milestones.map(m => ({
        id: `github-milestone-${m.id}`,
        source: 'github' as TaskSource,
        source_id: String(m.id),
        name: m.name,
        description: m.body,
        status: m.state === 'closed' ? 'closed' as const : 'active' as const,
        created_at: m.created_at,
        updated_at: m.updated_at,
        url: m.html_url,
        task_count: 0, // Would need to count issues
        metadata: {},
      })));
    } catch (error) {
      console.error('[PM Integration] GitHub milestones error:', error);
    }
  }

  return projects;
}

/**
 * Get full PM dashboard data
 */
export async function getPMDashboardData(): Promise<PMDashboardData> {
  const [tasks, projects] = await Promise.all([
    getAllTasks(),
    getAllProjects(),
  ]);

  // Calculate task statistics
  const taskStats = {
    total: tasks.length,
    pending: 0,
    in_progress: 0,
    done: 0,
    backlog: 0,
    failed: 0,
    by_priority: {} as Record<TaskPriority, number>,
    by_project: {} as Record<string, number>,
    by_source: {} as Record<TaskSource, number>,
  };

  for (const task of tasks) {
    if (task.status === 'pending') taskStats.pending++;
    if (task.status === 'in_progress') taskStats.in_progress++;
    if (task.status === 'done') taskStats.done++;
    if (task.status === 'backlog') taskStats.backlog++;
    if (task.status === 'failed') taskStats.failed++;

    taskStats.by_priority[task.priority] = (taskStats.by_priority[task.priority] || 0) + 1;
    taskStats.by_source[task.source] = (taskStats.by_source[task.source] || 0) + 1;

    if (task.project_name) {
      taskStats.by_project[task.project_name] = (taskStats.by_project[task.project_name] || 0) + 1;
    }
  }

  // Calculate project statistics
  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    closed: projects.filter(p => p.status === 'closed' || p.status === 'archived').length,
    by_source: {} as Record<TaskSource, number>,
  };

  for (const project of projects) {
    projectStats.by_source[project.source] = (projectStats.by_source[project.source] || 0) + 1;
  }

  return {
    tasks: taskStats,
    projects: projectStats,
    recent_tasks: tasks.slice(0, 50),
    recent_projects: projects.slice(0, 20),
    integrations: {
      github: {
        configured: githubClient.isConfigured(),
      },
    },
  };
}

/**
 * Create a task in the appropriate system
 * Primary target is GitHub issues, with local SQLite as fallback
 */
export async function createTask(params: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  source?: TaskSource;
  project_id?: string;
  project_name?: string;
  repo_full_name?: string; // For GitHub: owner/repo format
  due_date?: string;
  assignee?: string;
  labels?: string[];
}): Promise<UnifiedTask | null> {
  const source = params.source || 'github'; // Default to GitHub

  if (source === 'github' && githubClient.isConfigured()) {
    // Get repo to create issue in - either specified or first enabled repo
    let repoFullName = params.repo_full_name;
    if (!repoFullName) {
      const enabledRepos = githubClient.getEnabledRepos();
      if (enabledRepos.length > 0) {
        repoFullName = enabledRepos[0].repo_full_name;
      } else {
        console.error('[PM Integration] No repo specified and no enabled repos found');
        // Fall back to local task
        return createLocalTaskFallback(params);
      }
    }

    const [owner, repo] = repoFullName.split('/');
    const issue = await githubClient.createIssue(owner, repo, {
      title: params.title,
      body: params.description,
      labels: params.priority ? [params.priority] : [],
    });
    return githubIssueToTask(issue);
  }

  // Local SQLite task for 'local' source or when GitHub isn't configured
  return createLocalTaskFallback(params);
}

/**
 * Helper to create local task with params
 */
function createLocalTaskFallback(params: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  project_id?: string;
  project_name?: string;
  due_date?: string;
  assignee?: string;
  labels?: string[];
}): UnifiedTask {
  const localTask = createLocalTask({
    title: params.title,
    description: params.description,
    priority: params.priority || 'medium',
    project_id: params.project_id,
    project_name: params.project_name,
    due_date: params.due_date,
    assignee: params.assignee,
    labels: params.labels,
  });

  return localTaskToUnifiedTask(localTask);
}

/**
 * Update a task in its source system
 */
export async function updateTask(
  taskId: string,
  updates: {
    status?: TaskStatus;
    title?: string;
    description?: string;
    priority?: TaskPriority;
    due_date?: string | null;
    assignee?: string | null;
    labels?: string[];
  }
): Promise<UnifiedTask | null> {
  // Parse task ID - format is "github-owner__repo-issueNumber" or "local-..."
  const source = taskId.split('-')[0];

  if (source === 'github' && githubClient.isConfigured()) {
    // Task ID format: github-owner__repo-issueNumber (__ separates owner from repo)
    // Remove 'github-' prefix and extract issue number from end
    const withoutPrefix = taskId.slice(7); // Remove 'github-'
    const lastDash = withoutPrefix.lastIndexOf('-');

    if (lastDash === -1) {
      console.error('[PM Integration] Invalid GitHub task ID format:', taskId);
      return null;
    }

    const issueNumber = parseInt(withoutPrefix.slice(lastDash + 1));
    if (isNaN(issueNumber)) {
      console.error('[PM Integration] Invalid issue number in task ID:', taskId);
      return null;
    }

    const ownerRepo = withoutPrefix.slice(0, lastDash);

    // Split by __ to separate owner and repo (fallback for old format without __)
    const [owner, repo] = ownerRepo.includes('__')
      ? ownerRepo.split('__')
      : [ownerRepo.split('-')[0], ownerRepo.split('-').slice(1).join('-')];

    const githubUpdates: any = {};

    if (updates.status === 'done') githubUpdates.state = 'closed';
    if (updates.status === 'in_progress' || updates.status === 'pending') githubUpdates.state = 'open';
    if (updates.title) githubUpdates.title = updates.title;
    if (updates.description) githubUpdates.body = updates.description;

    const issue = await githubClient.updateIssue(owner, repo, issueNumber, githubUpdates);
    return githubIssueToTask(issue);
  }

  if (source === 'local') {
    // Local SQLite task - ID format: local-local_TIMESTAMP_RANDOM
    const localTaskId = taskId.slice(6); // Remove 'local-' prefix

    const localTask = updateLocalTask(localTaskId, {
      status: updates.status,
      title: updates.title,
      description: updates.description,
      priority: updates.priority,
      due_date: updates.due_date,
      assignee: updates.assignee,
      labels: updates.labels,
    });

    if (localTask) {
      return localTaskToUnifiedTask(localTask);
    }
    console.error('[PM Integration] Failed to update local task:', localTaskId);
    return null;
  }

  // Context requests are read-only for now
  if (source === 'context') {
    console.warn('[PM Integration] Context requests are read-only');
    return null;
  }

  console.error('[PM Integration] Unknown task source:', source);
  return null;
}

/**
 * Delete a task from its source system
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  const parts = taskId.split('-');
  const source = parts[0];

  if (source === 'local') {
    const localTaskId = parts.slice(1).join('-');
    return deleteLocalTask(localTaskId);
  }

  // GitHub and Motion don't support delete through our interface
  console.warn('[PM Integration] Delete not supported for source:', source);
  return false;
}

/**
 * Create task from queued signal (used by queue processor)
 * This is imported dynamically by task-queue.ts to avoid circular dependencies
 */
export async function createTaskFromSignal(
  signal: {
    id: string;
    source: string;
    signal_type: string;
    payload: Record<string, unknown>;
    confidence: number;
  },
  triage: {
    action: string;
    suggested_title?: string;
    suggested_labels?: string[];
    assigned_project?: string;
    due_date?: string;
    priority: string;
  }
): Promise<UnifiedTask | null> {
  const taskParams = {
    title: triage.suggested_title || `Signal from ${signal.source}`,
    description: JSON.stringify(signal.payload, null, 2),
    priority: (triage.priority === 'critical' ? 'urgent' : triage.priority) as TaskPriority,
    source: (triage.action === 'github_issue' ? 'github' : 'local') as TaskSource,
    project_name: triage.assigned_project,
    due_date: triage.due_date,
    labels: triage.suggested_labels || [signal.source, signal.signal_type],
  };

  console.log(`[PM Integration] Creating task from signal ${signal.id}:`, taskParams.title);

  return createTask(taskParams);
}
