/**
 * PM Integration Layer
 *
 * Aggregates tasks and projects from multiple sources:
 * - GitHub (issues as tasks, milestones as projects)
 * - Motion (tasks and projects)
 * - Local context requests (routed PM items)
 */

import githubClient, { type GitHubIssue } from '@/lib/integrations/GitHubClient';
import motionClient, { type MotionTask, type MotionProject } from '@/lib/integrations/MotionClient';
import { getAllContextRequests, type ContextRequest } from '@/lib/context_requests';
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
  const repoFullName = issue.repo_full_name || '';
  const taskId = repoFullName
    ? `github-${repoFullName.replace('/', '-')}-${issue.number}`
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
 * Map Motion task to unified task
 */
function motionTaskToTask(task: MotionTask): UnifiedTask {
  const statusMap: Record<string, TaskStatus> = {
    COMPLETED: 'done',
    IN_PROGRESS: 'in_progress',
    TODO: 'pending',
    BACKLOG: 'backlog',
  };

  const priorityMap: Record<string, TaskPriority> = {
    URGENT: 'urgent',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    NONE: 'none',
  };

  // Handle Motion API returning status/priority as object or string
  const normalizeStatus = (status: any): TaskStatus => {
    if (!status) return 'pending';
    if (typeof status === 'object' && status.name) {
      const nameUpper = String(status.name).toUpperCase().replace(/\s+/g, '_');
      return statusMap[nameUpper] || 'pending';
    }
    return statusMap[String(status)] || 'pending';
  };

  const normalizePriority = (priority: any): TaskPriority => {
    if (!priority) return 'medium';
    if (typeof priority === 'object' && priority.name) {
      const nameUpper = String(priority.name).toUpperCase();
      return priorityMap[nameUpper] || 'medium';
    }
    return priorityMap[String(priority)] || 'medium';
  };

  return {
    id: `motion-${task.id}`,
    source: 'motion',
    source_id: task.id,
    title: task.name || 'Untitled Task',
    description: task.description || null,
    status: normalizeStatus(task.status),
    priority: normalizePriority(task.priority),
    created_at: task.createdTime,
    updated_at: task.createdTime, // Motion doesn't provide updated_at
    due_date: task.dueDate,
    url: task.url || null,
    project_id: task.projectId ? `motion-project-${task.projectId}` : null,
    project_name: null, // Would need to fetch project details
    assignee: task.assigneeId || null,
    labels: task.labels || [],
    metadata: {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
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
    id: `local-${req.id}`,
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
    },
  };
}

/**
 * Fetch all tasks from all sources
 */
export async function getAllTasks(): Promise<UnifiedTask[]> {
  const tasks: UnifiedTask[] = [];
  const errors: string[] = [];

  // Fetch GitHub tasks
  if (githubClient.isConfigured()) {
    try {
      const githubIssues = await githubClient.getIssues({ state: 'all', limit: 100 });
      tasks.push(...githubIssues.map(githubIssueToTask));
    } catch (error) {
      console.error('[PM Integration] GitHub fetch error:', error);
      errors.push(`GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch Motion tasks
  if (motionClient.isConfigured()) {
    try {
      const motionTasks = await motionClient.getTasks({ limit: 100 });
      tasks.push(...motionTasks.map(motionTaskToTask));
    } catch (error) {
      console.error('[PM Integration] Motion fetch error:', error);
      errors.push(`Motion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fetch local context requests
  try {
    const contextRequests = getAllContextRequests({ target: 'pm' });
    tasks.push(...contextRequests.map(contextRequestToTask));
  } catch (error) {
    console.error('[PM Integration] Context requests error:', error);
    errors.push(`Local: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Sort by updated_at descending
  tasks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return tasks;
}

/**
 * Fetch all projects from all sources
 */
export async function getAllProjects(): Promise<UnifiedProject[]> {
  const projects: UnifiedProject[] = [];

  // Fetch GitHub milestones as projects
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

  // Fetch Motion projects
  if (motionClient.isConfigured()) {
    try {
      const workspaces = await motionClient.getWorkspaces();
      for (const workspace of workspaces) {
        const motionProjects = await motionClient.getProjects(workspace.id);
        projects.push(...motionProjects.map(p => ({
          id: `motion-project-${p.id}`,
          source: 'motion' as TaskSource,
          source_id: p.id,
          name: p.name,
          description: p.description,
          status: p.status === 'ARCHIVED' ? 'archived' as const : 'active' as const,
          created_at: p.createdTime,
          updated_at: p.createdTime,
          url: null,
          task_count: 0, // Would need to count tasks
          metadata: {
            workspaceId: p.workspaceId,
          },
        })));
      }
    } catch (error) {
      console.error('[PM Integration] Motion projects error:', error);
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
      motion: {
        configured: motionClient.isConfigured(),
      },
    },
  };
}

/**
 * Create a task in the appropriate system
 */
export async function createTask(params: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  source?: TaskSource;
  project_id?: string;
  repo_full_name?: string; // For GitHub: owner/repo format
}): Promise<UnifiedTask | null> {
  const source = params.source || 'local';

  if (source === 'github' && githubClient.isConfigured()) {
    // Get repo to create issue in - either specified or first enabled repo
    let repoFullName = params.repo_full_name;
    if (!repoFullName) {
      const enabledRepos = githubClient.getEnabledRepos();
      if (enabledRepos.length > 0) {
        repoFullName = enabledRepos[0].repo_full_name;
      } else {
        console.error('[PM Integration] No repo specified and no enabled repos found');
        return null;
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

  if (source === 'motion' && motionClient.isConfigured()) {
    // Would need workspace ID - for now, return null
    return null;
  }

  // Default to local (context request)
  return null;
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
  }
): Promise<UnifiedTask | null> {
  // Parse task ID - format is "source-rest" or "github-owner-repo-issueNumber"
  const parts = taskId.split('-');
  const source = parts[0];

  if (source === 'github' && githubClient.isConfigured()) {
    // Task ID format: github-owner-repo-issueNumber
    // parts: ['github', 'owner', 'repo', 'issueNumber']
    if (parts.length < 4) {
      console.error('[PM Integration] Invalid GitHub task ID format:', taskId);
      return null;
    }
    const owner = parts[1];
    const repo = parts[2];
    const issueNumber = parseInt(parts[3]);

    if (isNaN(issueNumber)) {
      console.error('[PM Integration] Invalid issue number in task ID:', taskId);
      return null;
    }

    const githubUpdates: any = {};

    if (updates.status === 'done') githubUpdates.state = 'closed';
    if (updates.status === 'in_progress' || updates.status === 'pending') githubUpdates.state = 'open';
    if (updates.title) githubUpdates.title = updates.title;
    if (updates.description) githubUpdates.body = updates.description;

    const issue = await githubClient.updateIssue(owner, repo, issueNumber, githubUpdates);
    return githubIssueToTask(issue);
  }

  if (source === 'motion' && motionClient.isConfigured()) {
    // Task ID format: motion-taskId
    const motionTaskId = parts.slice(1).join('-'); // Handle task IDs that might contain dashes
    const motionUpdates: any = {};

    if (updates.status === 'done') motionUpdates.status = 'COMPLETED';
    if (updates.status === 'in_progress') motionUpdates.status = 'IN_PROGRESS';
    if (updates.status === 'pending') motionUpdates.status = 'TODO';
    if (updates.title) motionUpdates.name = updates.title;
    if (updates.description) motionUpdates.description = updates.description;

    const task = await motionClient.updateTask(motionTaskId, motionUpdates);
    return motionTaskToTask(task);
  }

  // Local updates handled through context_requests
  return null;
}
