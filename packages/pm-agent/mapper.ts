/**
 * PM Agent Mapper
 * Handles mapping rules between GitHub and Motion entities
 */

import type { MotionTask, MotionProject } from './motion-client';

export interface GitHubIssue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  milestone?: { title: string } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  full_name: string;
}

export interface MappingResult<T> {
  data: T;
  warnings: string[];
}

/**
 * Map GitHub issue state to Motion task status
 */
export function githubStateToMotionStatus(
  state: 'open' | 'closed',
  labels: string[] = []
): MotionTask['status'] {
  if (state === 'closed') {
    return 'Completed';
  }

  // Check for in-progress indicators
  const inProgressLabels = ['in-progress', 'in progress', 'wip', 'doing'];
  if (labels.some(l => inProgressLabels.includes(l.toLowerCase()))) {
    return 'In Progress';
  }

  return 'Todo';
}

/**
 * Map Motion task status to GitHub issue state
 */
export function motionStatusToGithubState(status: MotionTask['status']): 'open' | 'closed' {
  switch (status) {
    case 'Completed':
    case 'Canceled':
      return 'closed';
    case 'Todo':
    case 'In Progress':
    default:
      return 'open';
  }
}

/**
 * Map Motion priority to GitHub labels
 */
export function motionPriorityToLabels(priority: MotionTask['priority']): string[] {
  const labels: string[] = [];

  switch (priority) {
    case 'ASAP':
      labels.push('priority: critical');
      break;
    case 'High':
      labels.push('priority: high');
      break;
    case 'Medium':
      labels.push('priority: medium');
      break;
    case 'Low':
      labels.push('priority: low');
      break;
  }

  return labels;
}

/**
 * Map GitHub labels to Motion priority
 */
export function githubLabelsToMotionPriority(labels: string[]): MotionTask['priority'] {
  const normalizedLabels = labels.map(l => l.toLowerCase());

  if (normalizedLabels.some(l => l.includes('critical') || l.includes('urgent') || l.includes('asap'))) {
    return 'ASAP';
  }
  if (normalizedLabels.some(l => l.includes('high'))) {
    return 'High';
  }
  if (normalizedLabels.some(l => l.includes('low'))) {
    return 'Low';
  }

  return 'Medium';
}

/**
 * Convert GitHub issue to Motion task creation params
 */
export function githubIssueToMotionTask(
  issue: GitHubIssue,
  projectId?: string
): MappingResult<{
  name: string;
  description: string;
  priority: MotionTask['priority'];
  projectId?: string;
  labels?: string[];
}> {
  const warnings: string[] = [];
  const labels = issue.labels.map(l => l.name);

  // Truncate description if too long (Motion limit)
  let description = issue.body || '';
  if (description.length > 2000) {
    description = description.substring(0, 1997) + '...';
    warnings.push(`Description truncated from ${issue.body?.length} to 2000 chars`);
  }

  // Append GitHub link
  description += `\n\n---\nGitHub: ${issue.html_url}`;

  return {
    data: {
      name: issue.title,
      description,
      priority: githubLabelsToMotionPriority(labels),
      projectId,
      labels: labels.filter(l => !l.toLowerCase().startsWith('priority')),
    },
    warnings,
  };
}

/**
 * Convert Motion task to GitHub issue creation params
 */
export function motionTaskToGithubIssue(
  task: MotionTask,
  repo: GitHubRepo
): MappingResult<{
  title: string;
  body: string;
  labels: string[];
}> {
  const warnings: string[] = [];

  // Build body with Motion link
  let body = task.description || '';
  body += `\n\n---\n**Motion Task:** ${task.name} (${task.id})`;
  if (task.project) {
    body += `\n**Project:** ${task.project.name}`;
  }

  // Combine task labels with priority label
  const labels = [
    ...(task.labels || []),
    ...motionPriorityToLabels(task.priority),
  ];

  // Add status label if in progress
  if (task.status === 'In Progress') {
    labels.push('in-progress');
  }

  return {
    data: {
      title: task.name,
      body,
      labels,
    },
    warnings,
  };
}

/**
 * Determine sync direction based on timestamps
 */
export function determineSyncDirection(
  motionUpdatedAt: string | null,
  githubUpdatedAt: string | null,
  lastSyncMotion: string | null,
  lastSyncGithub: string | null
): 'motion_wins' | 'github_wins' | 'no_change' | 'conflict' {
  // If either is missing, sync from the one that exists
  if (!motionUpdatedAt && !githubUpdatedAt) return 'no_change';
  if (!motionUpdatedAt) return 'github_wins';
  if (!githubUpdatedAt) return 'motion_wins';

  const motionTime = new Date(motionUpdatedAt).getTime();
  const githubTime = new Date(githubUpdatedAt).getTime();
  const lastMotionSync = lastSyncMotion ? new Date(lastSyncMotion).getTime() : 0;
  const lastGithubSync = lastSyncGithub ? new Date(lastSyncGithub).getTime() : 0;

  // Check if either has changed since last sync
  const motionChanged = motionTime > lastMotionSync;
  const githubChanged = githubTime > lastGithubSync;

  if (!motionChanged && !githubChanged) return 'no_change';
  if (motionChanged && !githubChanged) return 'motion_wins';
  if (!motionChanged && githubChanged) return 'github_wins';

  // Both changed - this is a conflict
  // Default: Motion wins (source of truth for task management)
  return 'conflict';
}

/**
 * Generate update for Motion task from GitHub issue changes
 */
export function generateMotionUpdate(
  currentTask: MotionTask,
  issue: GitHubIssue
): Partial<MotionTask> | null {
  const updates: Partial<MotionTask> = {};
  const labels = issue.labels.map(l => l.name);

  // Check for status change
  const newStatus = githubStateToMotionStatus(issue.state, labels);
  if (newStatus !== currentTask.status) {
    updates.status = newStatus;
  }

  // Check for priority change
  const newPriority = githubLabelsToMotionPriority(labels);
  if (newPriority !== currentTask.priority) {
    updates.priority = newPriority;
  }

  // Check for title change
  if (issue.title !== currentTask.name) {
    updates.name = issue.title;
  }

  // Return null if no updates needed
  return Object.keys(updates).length > 0 ? updates : null;
}

/**
 * Generate update for GitHub issue from Motion task changes
 */
export function generateGithubUpdate(
  currentIssue: GitHubIssue,
  task: MotionTask
): { state?: 'open' | 'closed'; title?: string; labels?: string[] } | null {
  const updates: { state?: 'open' | 'closed'; title?: string; labels?: string[] } = {};

  // Check for state change
  const newState = motionStatusToGithubState(task.status);
  if (newState !== currentIssue.state) {
    updates.state = newState;
  }

  // Check for title change
  if (task.name !== currentIssue.title) {
    updates.title = task.name;
  }

  // Build expected labels
  const currentLabels = currentIssue.labels.map(l => l.name);
  const expectedLabels = [
    ...(task.labels || []),
    ...motionPriorityToLabels(task.priority),
  ];
  if (task.status === 'In Progress') {
    expectedLabels.push('in-progress');
  }

  // Only update labels if they've changed significantly
  const missingLabels = expectedLabels.filter(l => !currentLabels.includes(l));
  if (missingLabels.length > 0) {
    updates.labels = [...new Set([...currentLabels, ...missingLabels])];
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

export default {
  githubStateToMotionStatus,
  motionStatusToGithubState,
  motionPriorityToLabels,
  githubLabelsToMotionPriority,
  githubIssueToMotionTask,
  motionTaskToGithubIssue,
  determineSyncDirection,
  generateMotionUpdate,
  generateGithubUpdate,
};
