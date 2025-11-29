/**
 * PM Types and Models
 *
 * Unified data model for project management that aggregates
 * data from GitHub, Motion, and local context requests.
 */

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'backlog';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type TaskSource = 'github' | 'motion' | 'local';

export interface UnifiedTask {
  id: string;
  source: TaskSource;
  source_id: string; // Original ID from source system
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  url: string | null;
  project_id: string | null;
  project_name: string | null;
  assignee: string | null;
  labels: string[];
  metadata: Record<string, any>;
}

export interface UnifiedProject {
  id: string;
  source: TaskSource;
  source_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'closed' | 'archived';
  created_at: string;
  updated_at: string;
  url: string | null;
  task_count: number;
  metadata: Record<string, any>;
}

export interface PMDashboardData {
  tasks: {
    total: number;
    pending: number;
    in_progress: number;
    done: number;
    backlog: number;
    failed: number;
    by_priority: Record<TaskPriority, number>;
    by_project: Record<string, number>;
    by_source: Record<TaskSource, number>;
  };
  projects: {
    total: number;
    active: number;
    closed: number;
    by_source: Record<TaskSource, number>;
  };
  recent_tasks: UnifiedTask[];
  recent_projects: UnifiedProject[];
  integrations: {
    github: {
      configured: boolean;
      error?: string;
    };
    motion: {
      configured: boolean;
      error?: string;
    };
  };
}
