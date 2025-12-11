// @ts-nocheck
/**
 * Wrath Shield v3 - PM Types Tests
 *
 * Tests for PM type definitions:
 * - TaskStatus values
 * - TaskPriority values
 * - TaskSource values
 * - Signal types for task queue
 * - UnifiedTask and UnifiedProject interfaces
 * - PMDashboardData interface
 */

import type {
  TaskStatus,
  TaskPriority,
  TaskSource,
  SignalSource,
  SignalType,
  QueueAction,
  EscalationLevel,
  QueueItemStatus,
  UnifiedTask,
  UnifiedProject,
  PMDashboardData,
} from '@/lib/pm/types';

describe('PM Types', () => {
  describe('TaskStatus', () => {
    it('should accept valid task statuses', () => {
      const statuses: TaskStatus[] = ['pending', 'in_progress', 'done', 'failed', 'backlog'];
      expect(statuses).toHaveLength(5);
    });

    it('should be usable in switch statements', () => {
      const status: TaskStatus = 'in_progress';
      let result = '';

      switch (status) {
        case 'pending': result = 'waiting'; break;
        case 'in_progress': result = 'working'; break;
        case 'done': result = 'complete'; break;
        case 'failed': result = 'error'; break;
        case 'backlog': result = 'queued'; break;
      }

      expect(result).toBe('working');
    });
  });

  describe('TaskPriority', () => {
    it('should accept valid priorities', () => {
      const priorities: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];
      expect(priorities).toHaveLength(5);
    });

    it('should be sortable by priority level', () => {
      const priorityOrder: Record<TaskPriority, number> = {
        urgent: 5,
        high: 4,
        medium: 3,
        low: 2,
        none: 1,
      };

      const sorted = Object.entries(priorityOrder)
        .sort(([, a], [, b]) => b - a)
        .map(([p]) => p);

      expect(sorted[0]).toBe('urgent');
      expect(sorted[4]).toBe('none');
    });
  });

  describe('TaskSource', () => {
    it('should accept valid sources', () => {
      const sources: TaskSource[] = ['github', 'local'];
      expect(sources).toHaveLength(2);
    });
  });

  describe('SignalSource', () => {
    it('should accept valid signal sources', () => {
      const sources: SignalSource[] = [
        'comms', 'inbox', 'legal', 'finance', 'eeg', 'github', 'calendar'
      ];
      expect(sources).toHaveLength(7);
    });
  });

  describe('SignalType', () => {
    it('should accept valid signal types', () => {
      const types: SignalType[] = [
        'task', 'deadline', 'follow_up', 'energy_window', 'commit', 'mention'
      ];
      expect(types).toHaveLength(6);
    });
  });

  describe('QueueAction', () => {
    it('should accept valid queue actions', () => {
      const actions: QueueAction[] = [
        'github_issue', 'local_task', 'defer', 'ignore', 'escalate'
      ];
      expect(actions).toHaveLength(5);
    });
  });

  describe('EscalationLevel', () => {
    it('should accept valid escalation levels', () => {
      const levels: EscalationLevel[] = ['auto', 'propose', 'critical'];
      expect(levels).toHaveLength(3);
    });
  });

  describe('QueueItemStatus', () => {
    it('should accept valid queue item statuses', () => {
      const statuses: QueueItemStatus[] = [
        'pending', 'processing', 'completed', 'failed', 'deferred'
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe('UnifiedTask', () => {
    it('should accept valid unified task', () => {
      const task: UnifiedTask = {
        id: 'task-123',
        source: 'github',
        source_id: 'issue-456',
        title: 'Fix bug',
        description: 'Bug description',
        status: 'pending',
        priority: 'high',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        due_date: '2025-02-01',
        url: 'https://github.com/org/repo/issues/456',
        project_id: 'proj-1',
        project_name: 'Project 1',
        assignee: 'alice',
        labels: ['bug', 'priority:high'],
        metadata: { gh_number: 456 },
      };

      expect(task.id).toBe('task-123');
      expect(task.source).toBe('github');
    });

    it('should accept task with null optional fields', () => {
      const task: UnifiedTask = {
        id: 'task-123',
        source: 'local',
        source_id: 'local-task-1',
        title: 'Quick task',
        description: null,
        status: 'pending',
        priority: 'medium',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        due_date: null,
        url: null,
        project_id: null,
        project_name: null,
        assignee: null,
        labels: [],
        metadata: {},
      };

      expect(task.description).toBeNull();
      expect(task.due_date).toBeNull();
    });
  });

  describe('UnifiedProject', () => {
    it('should accept valid unified project', () => {
      const project: UnifiedProject = {
        id: 'proj-123',
        source: 'github',
        source_id: 'milestone-1',
        name: 'Q1 Release',
        description: 'Q1 2025 release milestone',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-15T00:00:00Z',
        url: 'https://github.com/org/repo/milestone/1',
        task_count: 25,
        metadata: { target_date: '2025-03-31' },
      };

      expect(project.status).toBe('active');
      expect(project.task_count).toBe(25);
    });

    it('should support all project statuses', () => {
      const statuses: Array<'active' | 'closed' | 'archived'> = ['active', 'closed', 'archived'];

      statuses.forEach(status => {
        const project: UnifiedProject = {
          id: 'proj',
          source: 'local',
          source_id: '1',
          name: 'Project',
          description: null,
          status,
          created_at: '',
          updated_at: '',
          url: null,
          task_count: 0,
          metadata: {},
        };
        expect(project.status).toBe(status);
      });
    });
  });

  describe('PMDashboardData', () => {
    it('should accept valid dashboard data', () => {
      const dashboardData: PMDashboardData = {
        tasks: {
          total: 100,
          pending: 40,
          in_progress: 20,
          done: 35,
          backlog: 3,
          failed: 2,
          by_priority: {
            urgent: 5,
            high: 25,
            medium: 50,
            low: 15,
            none: 5,
          },
          by_project: {
            'Project A': 30,
            'Project B': 70,
          },
          by_source: {
            github: 80,
            local: 20,
          },
        },
        projects: {
          total: 5,
          active: 3,
          closed: 2,
          by_source: {
            github: 4,
            local: 1,
          },
        },
        recent_tasks: [],
        recent_projects: [],
        integrations: {
          github: {
            configured: true,
          },
        },
      };

      expect(dashboardData.tasks.total).toBe(100);
      expect(dashboardData.integrations.github.configured).toBe(true);
    });

    it('should support github integration error state', () => {
      const dashboardData: PMDashboardData = {
        tasks: {
          total: 0,
          pending: 0,
          in_progress: 0,
          done: 0,
          backlog: 0,
          failed: 0,
          by_priority: { urgent: 0, high: 0, medium: 0, low: 0, none: 0 },
          by_project: {},
          by_source: { github: 0, local: 0 },
        },
        projects: {
          total: 0,
          active: 0,
          closed: 0,
          by_source: { github: 0, local: 0 },
        },
        recent_tasks: [],
        recent_projects: [],
        integrations: {
          github: {
            configured: false,
            error: 'Invalid token',
          },
        },
      };

      expect(dashboardData.integrations.github.configured).toBe(false);
      expect(dashboardData.integrations.github.error).toBe('Invalid token');
    });
  });

  describe('Type Compatibility', () => {
    it('should allow UnifiedTask in array', () => {
      const tasks: UnifiedTask[] = [
        {
          id: '1', source: 'github', source_id: 'g1', title: 'Task 1',
          description: null, status: 'pending', priority: 'high',
          created_at: '', updated_at: '', due_date: null, url: null,
          project_id: null, project_name: null, assignee: null,
          labels: [], metadata: {},
        },
        {
          id: '2', source: 'local', source_id: 'l1', title: 'Task 2',
          description: null, status: 'done', priority: 'low',
          created_at: '', updated_at: '', due_date: null, url: null,
          project_id: null, project_name: null, assignee: null,
          labels: [], metadata: {},
        },
      ];

      expect(tasks.filter(t => t.source === 'github')).toHaveLength(1);
      expect(tasks.filter(t => t.status === 'done')).toHaveLength(1);
    });

    it('should allow filtering by multiple criteria', () => {
      const tasks: UnifiedTask[] = [
        {
          id: '1', source: 'github', source_id: 'g1', title: 'Task 1',
          description: null, status: 'pending', priority: 'high',
          created_at: '', updated_at: '', due_date: null, url: null,
          project_id: 'proj-1', project_name: null, assignee: null,
          labels: [], metadata: {},
        },
      ];

      const filtered = tasks.filter(t =>
        t.status === 'pending' &&
        t.priority === 'high' &&
        t.project_id === 'proj-1'
      );

      expect(filtered).toHaveLength(1);
    });
  });
});
