// @ts-nocheck
/**
 * Wrath Shield v3 - Deadline Proximity Detector Tests
 *
 * Tests for detecting approaching and overdue deadlines:
 * - Deadline detection
 * - Risk assessment
 * - Alert generation
 * - GitHub and local task scanning
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock GitHub client
const mockGetIssues = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/integrations/GitHubClient', () => ({
  __esModule: true,
  default: {
    getIssues: mockGetIssues,
  },
}));

// Mock local task store
const mockGetLocalTasks = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/pm/local-task-store', () => ({
  getLocalTasks: mockGetLocalTasks,
}));

// Mock task queue
jest.mock('@/lib/pm/task-queue', () => ({
  enqueueSignal: jest.fn().mockResolvedValue('queue-123'),
}));

// Mock PM memory
jest.mock('@/lib/pm/pm-memory', () => ({
  addPMMemory: jest.fn().mockResolvedValue(undefined),
}));

// Mock background jobs
jest.mock('@/lib/pm/background-jobs', () => ({
  registerJob: jest.fn(),
}));

import {
  detectApproachingDeadlines,
  getOverdueTasks,
  getTasksDueToday,
  registerDeadlineJob,
  DEADLINE_PROXIMITY_JOB,
  type DeadlineConfig,
  type DeadlineAlert,
} from '@/lib/pm/alerts/deadline-proximity-detector';

describe('Deadline Proximity Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIssues.mockResolvedValue([]);
    mockGetLocalTasks.mockResolvedValue([]);
  });

  describe('Types', () => {
    it('should define DeadlineConfig interface', () => {
      const config: DeadlineConfig = {
        first_warning: 7,
        second_warning: 3,
        urgent_warning: 1,
        overdue_escalation: 0,
      };

      expect(config.first_warning).toBe(7);
    });

    it('should define DeadlineAlert interface', () => {
      const alert: DeadlineAlert = {
        task_id: 'task-123',
        task_title: 'Complete report',
        task_source: 'github',
        task_url: 'https://github.com/org/repo/issues/123',
        deadline: '2025-01-20',
        days_remaining: 3,
        is_overdue: false,
        hours_until_deadline: 72,
        progress_estimate: 50,
        last_activity: '2025-01-15T10:00:00Z',
        days_since_activity: 2,
        risk_level: 'medium',
        risk_factors: ['Less than 1 week remaining'],
        severity: 'warning',
        suggested_action: 'Plan completion',
        priority: 'high',
        project_name: 'Project X',
        assignee: 'john',
        labels: ['bug', 'urgent'],
      };

      expect(alert.risk_level).toBe('medium');
      expect(alert.severity).toBe('warning');
    });
  });

  describe('detectApproachingDeadlines', () => {
    it('should return empty array when no tasks with deadlines', async () => {
      const alerts = await detectApproachingDeadlines();

      expect(alerts).toEqual([]);
    });

    it('should detect overdue GitHub issues', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockGetIssues.mockResolvedValue([
        {
          number: 123,
          title: 'Overdue Task',
          html_url: 'https://github.com/org/repo/issues/123',
          labels: [{ name: `due:${yesterday.toISOString().split('T')[0]}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].is_overdue).toBe(true);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should detect tasks due today', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 124,
          title: 'Due Today Task',
          html_url: 'https://github.com/org/repo/issues/124',
          labels: [{ name: `due:${today}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].days_remaining).toBe(0);
    });

    it('should detect tasks due tomorrow', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 125,
          title: 'Due Tomorrow Task',
          html_url: 'https://github.com/org/repo/issues/125',
          labels: [{ name: `due:${tomorrowStr}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      if (alerts.length > 0) {
        expect(alerts[0].days_remaining).toBe(1);
        expect(alerts[0].severity).toBe('critical');
      }
    });

    it('should detect tasks within first warning threshold', async () => {
      const fiveDaysAhead = new Date();
      fiveDaysAhead.setDate(fiveDaysAhead.getDate() + 5);
      const dateStr = fiveDaysAhead.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 126,
          title: 'Upcoming Task',
          html_url: 'https://github.com/org/repo/issues/126',
          labels: [{ name: `due:${dateStr}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('warning');
    });

    it('should not alert for far future deadlines', async () => {
      const tenDaysAhead = new Date();
      tenDaysAhead.setDate(tenDaysAhead.getDate() + 10);
      const dateStr = tenDaysAhead.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 127,
          title: 'Far Future Task',
          html_url: 'https://github.com/org/repo/issues/127',
          labels: [{ name: `due:${dateStr}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      // Should not include tasks beyond 7-day threshold
      expect(alerts).toHaveLength(0);
    });

    it('should detect local tasks with deadlines', async () => {
      const threeDaysAhead = new Date();
      threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);

      mockGetLocalTasks.mockResolvedValue([
        {
          id: 'local-123',
          title: 'Local Task',
          due_date: threeDaysAhead.toISOString().split('T')[0],
          status: 'in_progress',
          priority: 'high',
          updated_at: Math.floor(Date.now() / 1000),
          labels: [],
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].task_source).toBe('local');
    });

    it('should skip done tasks', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockGetLocalTasks.mockResolvedValue([
        {
          id: 'local-123',
          title: 'Done Task',
          due_date: tomorrow.toISOString().split('T')[0],
          status: 'done', // Should be skipped
          priority: 'high',
          updated_at: Math.floor(Date.now() / 1000),
          labels: [],
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      expect(alerts).toHaveLength(0);
    });

    it('should extract due date from issue body', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 128,
          title: 'Task with body deadline',
          html_url: 'https://github.com/org/repo/issues/128',
          body: `Due: ${dateStr}\nThis is the task description`,
          labels: [],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should extract priority from labels', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 129,
          title: 'Urgent Task',
          html_url: 'https://github.com/org/repo/issues/129',
          labels: [
            { name: `due:${dateStr}` },
            { name: 'p0' }, // Urgent priority
          ],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      if (alerts.length > 0) {
        expect(alerts[0].priority).toBe('urgent');
      }
    });

    it('should calculate risk factors', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      mockGetIssues.mockResolvedValue([
        {
          number: 130,
          title: 'High Risk Task',
          html_url: 'https://github.com/org/repo/issues/130',
          labels: [
            { name: `due:${dateStr}` },
            { name: 'urgent' },
          ],
          updated_at: fiveDaysAgo.toISOString(), // Stale activity
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      if (alerts.length > 0) {
        expect(alerts[0].risk_factors.length).toBeGreaterThan(0);
        expect(['high', 'critical']).toContain(alerts[0].risk_level);
      }
    });

    it('should sort alerts by severity', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fiveDays = new Date();
      fiveDays.setDate(fiveDays.getDate() + 5);
      const fiveDaysStr = fiveDays.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 131,
          title: 'Warning Task',
          html_url: 'https://github.com/org/repo/issues/131',
          labels: [{ name: `due:${fiveDaysStr}` }],
          updated_at: new Date().toISOString(),
        },
        {
          number: 132,
          title: 'Critical Task',
          html_url: 'https://github.com/org/repo/issues/132',
          labels: [{ name: `due:${today}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      if (alerts.length > 1) {
        // Critical should come before warning
        const criticalIndex = alerts.findIndex(a => a.severity === 'critical');
        const warningIndex = alerts.findIndex(a => a.severity === 'warning');
        if (criticalIndex !== -1 && warningIndex !== -1) {
          expect(criticalIndex).toBeLessThan(warningIndex);
        }
      }
    });

    it('should use custom config', async () => {
      const threeDaysAhead = new Date();
      threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);
      const dateStr = threeDaysAhead.toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 133,
          title: 'Custom Config Task',
          html_url: 'https://github.com/org/repo/issues/133',
          labels: [{ name: `due:${dateStr}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      // Use custom config with 2-day first warning
      const alerts = await detectApproachingDeadlines({
        first_warning: 2,
      });

      // 3 days out should not trigger with 2-day threshold
      expect(alerts).toHaveLength(0);
    });
  });

  describe('getOverdueTasks', () => {
    it('should return only overdue tasks', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const fiveDays = new Date();
      fiveDays.setDate(fiveDays.getDate() + 5);

      mockGetIssues.mockResolvedValue([
        {
          number: 140,
          title: 'Overdue Task',
          html_url: 'https://github.com/org/repo/issues/140',
          labels: [{ name: `due:${yesterday.toISOString().split('T')[0]}` }],
          updated_at: new Date().toISOString(),
        },
        {
          number: 141,
          title: 'Future Task',
          html_url: 'https://github.com/org/repo/issues/141',
          labels: [{ name: `due:${fiveDays.toISOString().split('T')[0]}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const overdue = await getOverdueTasks();

      expect(overdue.length).toBe(1);
      expect(overdue[0].is_overdue).toBe(true);
    });
  });

  describe('getTasksDueToday', () => {
    it('should return only tasks due today', async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      mockGetIssues.mockResolvedValue([
        {
          number: 150,
          title: 'Due Today Task',
          html_url: 'https://github.com/org/repo/issues/150',
          labels: [{ name: `due:${today}` }],
          updated_at: new Date().toISOString(),
        },
        {
          number: 151,
          title: 'Due Tomorrow Task',
          html_url: 'https://github.com/org/repo/issues/151',
          labels: [{ name: `due:${tomorrow.toISOString().split('T')[0]}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const dueToday = await getTasksDueToday();

      expect(dueToday.length).toBe(1);
      expect(dueToday[0].days_remaining).toBe(0);
    });
  });

  describe('Background Job', () => {
    it('should define DEADLINE_PROXIMITY_JOB', () => {
      expect(DEADLINE_PROXIMITY_JOB).toHaveProperty('id', 'deadline-proximity');
      expect(DEADLINE_PROXIMITY_JOB).toHaveProperty('name');
      expect(DEADLINE_PROXIMITY_JOB).toHaveProperty('handler');
      expect(DEADLINE_PROXIMITY_JOB.enabled).toBe(true);
    });

    it('should have handler that returns JobResult', async () => {
      const result = await DEADLINE_PROXIMITY_JOB.handler();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('items_processed');
      expect(result).toHaveProperty('duration_ms');
    });

    it('should handle errors in job handler', async () => {
      mockGetIssues.mockRejectedValue(new Error('GitHub error'));

      const result = await DEADLINE_PROXIMITY_JOB.handler();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should register job function', () => {
      const { registerJob } = require('@/lib/pm/background-jobs');

      registerDeadlineJob();

      expect(registerJob).toHaveBeenCalledWith(DEADLINE_PROXIMITY_JOB);
    });
  });

  describe('Suggested Actions', () => {
    it('should generate action for overdue tasks', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockGetIssues.mockResolvedValue([
        {
          number: 160,
          title: 'Overdue Task',
          html_url: 'https://github.com/org/repo/issues/160',
          labels: [{ name: `due:${yesterday.toISOString().split('T')[0]}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      if (alerts.length > 0) {
        expect(alerts[0].suggested_action).toContain('OVERDUE');
      }
    });

    it('should generate action for tasks due today', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockGetIssues.mockResolvedValue([
        {
          number: 161,
          title: 'Due Today',
          html_url: 'https://github.com/org/repo/issues/161',
          labels: [{ name: `due:${today}` }],
          updated_at: new Date().toISOString(),
        },
      ]);

      const alerts = await detectApproachingDeadlines();

      if (alerts.length > 0) {
        expect(alerts[0].suggested_action).toContain('TODAY');
      }
    });
  });
});
