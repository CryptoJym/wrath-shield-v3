/**
 * Motion API Client
 * Provides access to Motion task and project management
 */

import { resolve } from 'path';

export interface MotionTask {
  id: string;
  name: string;
  description?: string;
  status: 'Todo' | 'In Progress' | 'Completed' | 'Canceled';
  priority: 'ASAP' | 'High' | 'Medium' | 'Low';
  dueDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  project?: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MotionProject {
  id: string;
  name: string;
  description?: string;
  status: 'Active' | 'Completed' | 'Archived';
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MotionClientConfig {
  apiKey?: string;
  workspaceId?: string;
  baseUrl?: string;
  dryRun?: boolean;
}

export class MotionClient {
  private apiKey: string;
  private workspaceId: string;
  private baseUrl: string;
  private dryRun: boolean;

  constructor(config: MotionClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.MOTION_API_KEY || '';
    this.workspaceId = config.workspaceId || process.env.MOTION_WORKSPACE_ID || '';
    this.baseUrl = config.baseUrl || 'https://api.usemotion.com/v1';
    this.dryRun = config.dryRun ?? (!this.apiKey || this.apiKey === 'test');

    if (this.dryRun) {
      console.log('[MotionClient] Running in dry-run mode');
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (this.dryRun) {
      console.log(`[MotionClient] Dry-run: ${method} ${endpoint}`, body);
      return {} as T;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Motion API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ============================================================
  // Tasks
  // ============================================================

  async getTasks(options: {
    projectId?: string;
    status?: MotionTask['status'];
    cursor?: string;
  } = {}): Promise<{ tasks: MotionTask[]; nextCursor?: string }> {
    if (this.dryRun) {
      return {
        tasks: this.getMockTasks(),
        nextCursor: undefined,
      };
    }

    const params = new URLSearchParams();
    params.append('workspaceId', this.workspaceId);
    if (options.projectId) params.append('projectId', options.projectId);
    if (options.status) params.append('status', options.status);
    if (options.cursor) params.append('cursor', options.cursor);

    return this.request<{ tasks: MotionTask[]; nextCursor?: string }>(
      'GET',
      `/tasks?${params.toString()}`
    );
  }

  async getTask(taskId: string): Promise<MotionTask> {
    if (this.dryRun) {
      const mock = this.getMockTasks().find(t => t.id === taskId);
      return mock || this.getMockTasks()[0];
    }
    return this.request<MotionTask>('GET', `/tasks/${taskId}`);
  }

  async createTask(task: {
    name: string;
    description?: string;
    projectId?: string;
    priority?: MotionTask['priority'];
    dueDate?: string;
    labels?: string[];
  }): Promise<MotionTask> {
    if (this.dryRun) {
      console.log('[MotionClient] Would create task:', task);
      return {
        id: `mock-task-${Date.now()}`,
        name: task.name,
        description: task.description,
        status: 'Todo',
        priority: task.priority || 'Medium',
        labels: task.labels,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return this.request<MotionTask>('POST', '/tasks', {
      ...task,
      workspaceId: this.workspaceId,
    });
  }

  async updateTask(
    taskId: string,
    updates: Partial<{
      name: string;
      description: string;
      status: MotionTask['status'];
      priority: MotionTask['priority'];
      dueDate: string;
      labels: string[];
    }>
  ): Promise<MotionTask> {
    if (this.dryRun) {
      console.log('[MotionClient] Would update task:', taskId, updates);
      return {
        id: taskId,
        name: updates.name || 'Mock Task',
        status: updates.status || 'Todo',
        priority: updates.priority || 'Medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return this.request<MotionTask>('PATCH', `/tasks/${taskId}`, updates);
  }

  async deleteTask(taskId: string): Promise<void> {
    if (this.dryRun) {
      console.log('[MotionClient] Would delete task:', taskId);
      return;
    }
    await this.request('DELETE', `/tasks/${taskId}`);
  }

  // ============================================================
  // Projects
  // ============================================================

  async getProjects(): Promise<{ projects: MotionProject[] }> {
    if (this.dryRun) {
      return { projects: this.getMockProjects() };
    }

    const params = new URLSearchParams();
    params.append('workspaceId', this.workspaceId);

    return this.request<{ projects: MotionProject[] }>(
      'GET',
      `/projects?${params.toString()}`
    );
  }

  async getProject(projectId: string): Promise<MotionProject> {
    if (this.dryRun) {
      const mock = this.getMockProjects().find(p => p.id === projectId);
      return mock || this.getMockProjects()[0];
    }
    return this.request<MotionProject>('GET', `/projects/${projectId}`);
  }

  async createProject(project: {
    name: string;
    description?: string;
  }): Promise<MotionProject> {
    if (this.dryRun) {
      console.log('[MotionClient] Would create project:', project);
      return {
        id: `mock-project-${Date.now()}`,
        name: project.name,
        description: project.description,
        status: 'Active',
        workspaceId: this.workspaceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return this.request<MotionProject>('POST', '/projects', {
      ...project,
      workspaceId: this.workspaceId,
    });
  }

  // ============================================================
  // Mock Data (for dry-run mode)
  // ============================================================

  private getMockTasks(): MotionTask[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'mock-task-1',
        name: 'Review PR #123',
        description: 'Code review for new feature',
        status: 'Todo',
        priority: 'High',
        project: { id: 'pr_zttJpHQ7XqmzmjDx9A8BtX', name: 'Guardian - Amalg - Cybersecurity of One Firm' },
        labels: ['review', 'code'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mock-task-2',
        name: 'Update documentation',
        description: 'Update README with new API endpoints',
        status: 'In Progress',
        priority: 'Medium',
        project: { id: 'pr_1WwUd92HrosZqzXerGWN6f', name: 'CRO of One' },
        labels: ['docs'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mock-task-3',
        name: 'Fix bug in auth flow',
        description: 'Users getting logged out unexpectedly',
        status: 'Todo',
        priority: 'ASAP',
        project: { id: 'pr_FFDKf79NPD7n898q7pV7mA', name: 'Creator of One' },
        labels: ['bug', 'auth'],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private getMockProjects(): MotionProject[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'pr_zttJpHQ7XqmzmjDx9A8BtX',
        name: 'Guardian - Amalg - Cybersecurity of One Firm',
        description: 'FCRA compliance and cybersecurity',
        status: 'Active',
        workspaceId: this.workspaceId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pr_1WwUd92HrosZqzXerGWN6f',
        name: 'CRO of One',
        description: 'Chief Revenue Officer tools',
        status: 'Active',
        workspaceId: this.workspaceId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pr_FFDKf79NPD7n898q7pV7mA',
        name: 'Creator of One',
        description: 'Content creation and marketing',
        status: 'Active',
        workspaceId: this.workspaceId,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

export default MotionClient;
