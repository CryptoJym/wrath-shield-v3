/**
 * Motion Integration Client
 *
 * Provides integration with Motion (usemotion.com) for:
 * - Fetching tasks
 * - Fetching projects/workspaces
 * - Creating/updating tasks
 * - Syncing task state
 * - Auto-detection of default workspace
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
  private cachedWorkspaces: MotionWorkspace[] | null = null;
  private defaultWorkspaceId: string | null = null;

  constructor() {
    this.apiKey = safeConfig('MOTION_API_KEY', '');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get the default workspace ID (auto-detected or from env)
   */
  async getDefaultWorkspaceId(): Promise<string | null> {
    // Return cached if available
    if (this.defaultWorkspaceId) {
      return this.defaultWorkspaceId;
    }

    // Check environment variable first
    const envWorkspaceId = safeConfig('MOTION_DEFAULT_WORKSPACE_ID', '');
    if (envWorkspaceId) {
      this.defaultWorkspaceId = envWorkspaceId;
      return this.defaultWorkspaceId;
    }

    // Auto-detect from workspaces
    try {
      const workspaces = await this.getWorkspaces();
      if (workspaces.length === 1) {
        // Single workspace - use it as default
        this.defaultWorkspaceId = workspaces[0].id;
        console.log(`[Motion] Auto-detected default workspace: ${workspaces[0].name} (${this.defaultWorkspaceId})`);
      } else if (workspaces.length > 1) {
        // Multiple workspaces - use the first one but log a warning
        this.defaultWorkspaceId = workspaces[0].id;
        console.warn(`[Motion] Multiple workspaces found (${workspaces.length}). Using first: ${workspaces[0].name}. Set MOTION_DEFAULT_WORKSPACE_ID to override.`);
      }
      return this.defaultWorkspaceId;
    } catch (error) {
      console.error('[Motion] Failed to auto-detect workspace:', error);
      return null;
    }
  }

  /**
   * Reset cached workspace data (useful after configuration changes)
   */
  resetCache(): void {
    this.cachedWorkspaces = null;
    this.defaultWorkspaceId = null;
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
   * Fetch all workspaces (with caching)
   */
  async getWorkspaces(): Promise<MotionWorkspace[]> {
    if (this.cachedWorkspaces) {
      return this.cachedWorkspaces;
    }
    const response = await this.fetch<{ workspaces: MotionWorkspace[] }>('/workspaces');
    this.cachedWorkspaces = response.workspaces || [];
    return this.cachedWorkspaces;
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
   * Create a task with auto-detected workspace
   * Uses default workspace if workspaceId is not provided
   */
  async createTaskAuto(params: {
    name: string;
    description?: string;
    priority?: MotionTask['priority'];
    dueDate?: string;
    projectId?: string;
    assigneeId?: string;
    labels?: string[];
    workspaceId?: string;
  }): Promise<MotionTask | null> {
    let workspaceId = params.workspaceId;

    if (!workspaceId) {
      workspaceId = await this.getDefaultWorkspaceId() || undefined;
    }

    if (!workspaceId) {
      console.error('[Motion] Cannot create task: No workspace ID available');
      return null;
    }

    return this.createTask({
      ...params,
      workspaceId,
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
