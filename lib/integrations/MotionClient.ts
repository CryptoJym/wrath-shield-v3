/**
 * Motion Integration Client
 *
 * Provides integration with Motion (usemotion.com) for:
 * - Fetching tasks
 * - Fetching projects/workspaces
 * - Creating/updating tasks
 * - Syncing task state
 */

import { safeConfig } from '@/lib/safe-config';

export interface MotionTask {
  id: string;
  name: string;
  description: string | null;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'TODO' | 'BACKLOG';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  dueDate: string | null;
  createdTime: string;
  workspaceId: string;
  projectId?: string;
  assigneeId?: string;
  labels?: string[];
  url?: string;
}

export interface MotionProject {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdTime: string;
}

export interface MotionWorkspace {
  id: string;
  name: string;
  teamId: string;
}

export interface MotionTaskSummary {
  total: number;
  completed: number;
  in_progress: number;
  todo: number;
  backlog: number;
  by_priority: Record<string, number>;
  by_project: Record<string, number>;
}

class MotionClient {
  private apiKey: string | null;
  private baseUrl = 'https://api.usemotion.com/v1';

  constructor() {
    this.apiKey = safeConfig('MOTION_API_KEY', '');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Motion not configured. Set MOTION_API_KEY in environment.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey!,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Motion API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch all workspaces
   */
  async getWorkspaces(): Promise<MotionWorkspace[]> {
    const response = await this.fetch<{ workspaces: MotionWorkspace[] }>('/workspaces');
    return response.workspaces || [];
  }

  /**
   * Fetch all tasks
   */
  async getTasks(options?: {
    workspaceId?: string;
    status?: MotionTask['status'];
    assigneeId?: string;
    limit?: number;
  }): Promise<MotionTask[]> {
    const params = new URLSearchParams();
    if (options?.workspaceId) params.set('workspaceId', options.workspaceId);
    if (options?.status) params.set('status', options.status);
    if (options?.assigneeId) params.set('assigneeId', options.assigneeId);

    const endpoint = `/tasks${params.toString() ? `?${params}` : ''}`;
    const response = await this.fetch<{ tasks: MotionTask[] }>(endpoint);
    const tasks = response.tasks || [];

    // Apply client-side limit if needed
    return options?.limit ? tasks.slice(0, options.limit) : tasks;
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<MotionTask> {
    return this.fetch<MotionTask>(`/tasks/${taskId}`);
  }

  /**
   * Create a new task
   */
  async createTask(params: {
    workspaceId: string;
    name: string;
    description?: string;
    priority?: MotionTask['priority'];
    dueDate?: string;
    projectId?: string;
    assigneeId?: string;
    labels?: string[];
  }): Promise<MotionTask> {
    return this.fetch<MotionTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, params: {
    name?: string;
    description?: string;
    status?: MotionTask['status'];
    priority?: MotionTask['priority'];
    dueDate?: string;
    assigneeId?: string;
    labels?: string[];
  }): Promise<MotionTask> {
    return this.fetch<MotionTask>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string): Promise<MotionTask> {
    return this.updateTask(taskId, { status: 'COMPLETED' });
  }

  /**
   * Move task to in-progress
   */
  async startTask(taskId: string): Promise<MotionTask> {
    return this.updateTask(taskId, { status: 'IN_PROGRESS' });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.fetch(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get task summary statistics
   */
  async getTaskSummary(workspaceId?: string): Promise<MotionTaskSummary> {
    const tasks = await this.getTasks({ workspaceId });

    const summary: MotionTaskSummary = {
      total: tasks.length,
      completed: 0,
      in_progress: 0,
      todo: 0,
      backlog: 0,
      by_priority: {},
      by_project: {},
    };

    for (const task of tasks) {
      // Count by status
      if (task.status === 'COMPLETED') summary.completed++;
      if (task.status === 'IN_PROGRESS') summary.in_progress++;
      if (task.status === 'TODO') summary.todo++;
      if (task.status === 'BACKLOG') summary.backlog++;

      // Count by priority
      const priority = task.priority || 'NONE';
      summary.by_priority[priority] = (summary.by_priority[priority] || 0) + 1;

      // Count by project
      if (task.projectId) {
        summary.by_project[task.projectId] = (summary.by_project[task.projectId] || 0) + 1;
      }
    }

    return summary;
  }

  /**
   * Get projects in a workspace
   */
  async getProjects(workspaceId: string): Promise<MotionProject[]> {
    const response = await this.fetch<{ projects: MotionProject[] }>(
      `/workspaces/${workspaceId}/projects`
    );
    return response.projects || [];
  }
}

// Singleton instance
const motionClient = new MotionClient();
export default motionClient;
