/**
 * Wrath Shield v3 - Todoist API Client
 *
 * Handles project and task creation for the "Action Engine" component.
 * Uses the REST API v2.
 *
 * SECURITY: Server-side only.
 */

import { ensureServerOnly } from './server-only-guard';
import { httpsRequest } from './https-proxy-request';

// Prevent client-side imports
ensureServerOnly('lib/TodoistClient');

const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';

export interface TodoistProject {
  id: string;
  name: string;
  url: string;
}

export interface TodoistTask {
  id: string;
  projectId: string;
  content: string;
  description?: string;
  due?: {
    string: string;
    date: string;
  };
  url: string;
}

export class TodoistClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TODOIST_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[TodoistClient] TODOIST_API_KEY is not set. Operations will fail.');
    }
  }

  private async request(endpoint: string, method: string, body?: any): Promise<any> {
    if (!this.apiKey) throw new Error('Todoist API key missing');

    const url = `${TODOIST_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Generate a unique request ID for idempotency if it's a POST/POST
    if (method === 'POST') {
      const { randomUUID } = await import('crypto');
      headers['X-Request-Id'] = randomUUID();
    }

    try {
      const response = await httpsRequest(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status >= 400) {
        throw new Error(`Todoist API error ${response.status}: ${response.data}`);
      }

      return JSON.parse(response.data);
    } catch (error) {
      console.error(`[TodoistClient] Request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Get or create a project by name
   */
  async ensureProject(name: string): Promise<TodoistProject> {
    // 1. List projects to check existence
    const projects = await this.request('/projects', 'GET');
    const existing = projects.find((p: any) => p.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        url: existing.url,
      };
    }

    // 2. Create if missing
    const created = await this.request('/projects', 'POST', { name });
    return {
      id: created.id,
      name: created.name,
      url: created.url,
    };
  }

  /**
   * Create a task in a specific project
   */
  async createTask(
    projectId: string,
    content: string,
    description?: string,
    dueString?: string,
    priority?: number
  ): Promise<TodoistTask> {
    const body: any = {
      project_id: projectId,
      content,
      description,
      priority, // 1=Normal, 4=Urgent
    };

    if (dueString) {
      body.due_string = dueString;
    }

    const task = await this.request('/tasks', 'POST', body);
    return {
      id: task.id,
      projectId: task.project_id,
      content: task.content,
      description: task.description,
      due: task.due,
      url: task.url,
    };
  }
}

let instance: TodoistClient | null = null;

export function getTodoistClient(): TodoistClient {
  if (!instance) instance = new TodoistClient();
  return instance;
}
