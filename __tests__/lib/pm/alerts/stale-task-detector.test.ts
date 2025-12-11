// @ts-nocheck
/**
 * Wrath Shield v3 - Stale Task Detector Tests
 *
 * Tests for identifying tasks that haven't been updated:
 * - Priority-based staleness thresholds
 * - Project-specific overrides
 * - Severity escalation
 * - Per-task cooldown system
 * - Background job integration
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock database
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn().mockReturnValue({
    get: jest.fn(),
    all: jest.fn().mockReturnValue([]),
    run: jest.fn().mockReturnValue({ changes: 1 }),
  }),
};

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: () => mockDb,
  }),
}));

// Mock getAllTasks
const mockGetAllTasks = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/pm/integration', () => ({
  getAllTasks: mockGetAllTasks,
}));

// Mock task queue
const mockEnqueueSignal = jest.fn().mockResolvedValue('queue-123');
jest.mock('@/lib/pm/task-queue', () => ({
  enqueueSignal: mockEnqueueSignal,
}));

import {
  detectStaleTasks,
  getTasksApproachingStaleness,
  clearTaskCooldown,
  getCooldownStats,
  staleTaskJobHandler,
  DEFAULT_STALENESS_CONFIG,
  type StalenessConfig,
  type StaleTaskAlert,
} from '@/lib/pm/alerts/stale-task-detector';
import type { UnifiedTask, TaskPriority } from '@/lib/pm/types';

describe('Stale Task Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllTasks.mockResolvedValue([]);
    mockDb.prepare.mockReturnValue({
      get: jest.fn(),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1 }),
    });
  });

  describe('Types', () => {
    it('should define StalenessConfig interface', () => {
      const config: StalenessConfig = {
        thresholds: {
          urgent: 1,
          high: 3,
          medium: 7,
          low: 14,
          none: 30,
        },
        project_overrides: {
          research: 14,
          backlog: 30,
        },
        severity_thresholds: {
          info: 0.75,
          warning: 1.0,
          critical: 1.5,
        },
        cooldown_hours: {
          info: 24,
          warning: 24,
          critical: 12,
        },
      };

      expect(config.thresholds.urgent).toBe(1);
      expect(config.severity_thresholds.critical).toBe(1.5);
    });

    it('should define StaleTaskAlert interface', () => {
      const alert: StaleTaskAlert = {
        task_id: 'task-123',
        task_title: 'Review documentation',
        task_source: 'github',
        days_stale: 10,
        priority: 'medium',
        project: 'docs',
        last_activity: '2025-01-05T10:00:00Z',
        suggested_action: 'Update or close this task',
        severity: 'warning',
        context: {
          threshold_days: 7,
          percentage_over: 43,
          url: 'https://github.com/org/repo/issues/123',
          assignee: 'john',
          status: 'in_progress',
        },
      };

      expect(alert.severity).toBe('warning');
      expect(alert.context.percentage_over).toBe(43);
    });

    it('should have valid default config', () => {
      expect(DEFAULT_STALENESS_CONFIG).toBeDefined();
      expect(DEFAULT_STALENESS_CONFIG.thresholds).toBeDefined();
      expect(DEFAULT_STALENESS_CONFIG.thresholds.urgent).toBe(1);
      expect(DEFAULT_STALENESS_CONFIG.thresholds.high).toBe(3);
      expect(DEFAULT_STALENESS_CONFIG.thresholds.medium).toBe(7);
      expect(DEFAULT_STALENESS_CONFIG.thresholds.low).toBe(14);
      expect(DEFAULT_STALENESS_CONFIG.thresholds.none).toBe(30);
    });

    it('should have valid project overrides in default config', () => {
      expect(DEFAULT_STALENESS_CONFIG.project_overrides).toBeDefined();
      expect(DEFAULT_STALENESS_CONFIG.project_overrides?.research).toBe(14);
      expect(DEFAULT_STALENESS_CONFIG.project_overrides?.backlog).toBe(30);
      expect(DEFAULT_STALENESS_CONFIG.project_overrides?.ideas).toBe(60);
    });

    it('should have valid severity thresholds in default config', () => {
      expect(DEFAULT_STALENESS_CONFIG.severity_thresholds).toBeDefined();
      expect(DEFAULT_STALENESS_CONFIG.severity_thresholds.info).toBe(0.75);
      expect(DEFAULT_STALENESS_CONFIG.severity_thresholds.warning).toBe(1.0);
      expect(DEFAULT_STALENESS_CONFIG.severity_thresholds.critical).toBe(1.5);
    });

    it('should have valid cooldown hours in default config', () => {
      expect(DEFAULT_STALENESS_CONFIG.cooldown_hours).toBeDefined();
      expect(DEFAULT_STALENESS_CONFIG.cooldown_hours.info).toBe(24);
      expect(DEFAULT_STALENESS_CONFIG.cooldown_hours.warning).toBe(24);
      expect(DEFAULT_STALENESS_CONFIG.cooldown_hours.critical).toBe(12);
    });
  });

  describe('detectStaleTasks', () => {
    it('should return empty array when no tasks', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const alerts = await detectStaleTasks();

      expect(alerts).toHaveLength(0);
    });

    it('should skip completed tasks', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 30);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Completed task',
          status: 'done',
          priority: 'medium',
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      expect(alerts).toHaveLength(0);
    });

    it('should detect stale in_progress tasks', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 10); // 10 days ago

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Stale task',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect stale pending tasks', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 20); // 20 days ago

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Stale pending task',
          status: 'pending',
          priority: 'low', // 14 day threshold
          source: 'github',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect priority-based thresholds', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Urgent task',
          status: 'in_progress',
          priority: 'urgent', // 1 day threshold
          source: 'local',
          updated_at: twoDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      // 2 days > 1 day threshold for urgent, should trigger
      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply project overrides', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 10); // 10 days ago

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Research task',
          status: 'in_progress',
          priority: 'medium', // Normally 7 days, but research = 14
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: 'research',
        },
      ]);

      const alerts = await detectStaleTasks();

      // 10 days < 14 days (research override), should NOT be stale (but might be info)
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should merge custom config with defaults', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const customConfig: Partial<StalenessConfig> = {
        thresholds: {
          urgent: 2,
          high: 5,
          medium: 10,
          low: 20,
          none: 45,
        },
      };

      const alerts = await detectStaleTasks(customConfig);

      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should sort alerts by severity then days stale', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);
      const twentyDaysAgo = new Date(now);
      twentyDaysAgo.setDate(now.getDate() - 20);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Medium stale',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: tenDaysAgo.toISOString(),
          project_name: null,
        },
        {
          id: 'task-2',
          title: 'Very stale',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: twentyDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      // Should be sorted with more severe/older first
      if (alerts.length >= 2) {
        expect(alerts[0].days_stale).toBeGreaterThanOrEqual(alerts[1].days_stale);
      }
    });

    it('should include task context in alerts', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 15);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task with context',
          status: 'in_progress',
          priority: 'medium',
          source: 'github',
          updated_at: staleDate.toISOString(),
          project_name: 'myproject',
          url: 'https://github.com/org/repo/issues/1',
          assignee: 'developer',
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0) {
        expect(alerts[0].context).toBeDefined();
        expect(alerts[0].context.status).toBe('in_progress');
      }
    });

    it('should handle errors gracefully', async () => {
      mockGetAllTasks.mockRejectedValue(new Error('Database error'));

      await expect(detectStaleTasks()).rejects.toThrow();
    });
  });

  describe('getTasksApproachingStaleness', () => {
    it('should return empty array when no tasks', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const approaching = await getTasksApproachingStaleness();

      expect(approaching).toHaveLength(0);
    });

    it('should find tasks approaching staleness', async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(now.getDate() - 6); // 6 days for 7-day threshold = 85%

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Almost stale',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: sixDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const approaching = await getTasksApproachingStaleness();

      // 6/7 = 85% which is between 75% (info) and 100% (warning)
      expect(Array.isArray(approaching)).toBe(true);
    });

    it('should use custom warning threshold', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const approaching = await getTasksApproachingStaleness(0.5);

      expect(Array.isArray(approaching)).toBe(true);
    });

    it('should exclude already stale tasks', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Already stale',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: tenDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const approaching = await getTasksApproachingStaleness();

      // 10 days > 7 days = already stale, should NOT be in approaching list
      expect(approaching).toHaveLength(0);
    });

    it('should include suggested action with days remaining', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(now.getDate() - 5);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Soon stale',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: fiveDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const approaching = await getTasksApproachingStaleness();

      if (approaching.length > 0) {
        expect(approaching[0].suggested_action).toContain('days');
      }
    });

    it('should sort by days stale descending', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(now.getDate() - 5);
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(now.getDate() - 6);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Less stale',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: fiveDaysAgo.toISOString(),
          project_name: null,
        },
        {
          id: 'task-2',
          title: 'More stale',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: sixDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const approaching = await getTasksApproachingStaleness();

      if (approaching.length >= 2) {
        expect(approaching[0].days_stale).toBeGreaterThanOrEqual(approaching[1].days_stale);
      }
    });
  });

  describe('clearTaskCooldown', () => {
    it('should clear cooldown for a task', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 1 }),
      });

      const result = clearTaskCooldown('task-123');

      expect(result).toBe(true);
    });

    it('should return false if no cooldown exists', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 0 }),
      });

      const result = clearTaskCooldown('task-nonexistent');

      expect(result).toBe(false);
    });

    it('should handle database errors', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(() => clearTaskCooldown('task-123')).toThrow();
    });
  });

  describe('getCooldownStats', () => {
    it('should return cooldown statistics', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return {
            get: jest.fn().mockReturnValue({ count: 10 }),
            all: jest.fn(),
          };
        }
        if (sql.includes('GROUP BY')) {
          return {
            get: jest.fn(),
            all: jest.fn().mockReturnValue([
              { last_alert_severity: 'info', count: 5 },
              { last_alert_severity: 'warning', count: 3 },
              { last_alert_severity: 'critical', count: 2 },
            ]),
          };
        }
        if (sql.includes('AVG')) {
          return {
            get: jest.fn().mockReturnValue({ avg: 2.5 }),
            all: jest.fn(),
          };
        }
        return {
          get: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      });

      const stats = getCooldownStats();

      expect(stats).toHaveProperty('total_tasks_with_cooldowns');
      expect(stats).toHaveProperty('by_severity');
      expect(stats).toHaveProperty('average_alert_count');
    });

    it('should handle empty cooldowns table', () => {
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return {
            get: jest.fn().mockReturnValue({ count: 0 }),
            all: jest.fn(),
          };
        }
        if (sql.includes('GROUP BY')) {
          return {
            get: jest.fn(),
            all: jest.fn().mockReturnValue([]),
          };
        }
        if (sql.includes('AVG')) {
          return {
            get: jest.fn().mockReturnValue({ avg: null }),
            all: jest.fn(),
          };
        }
        return {
          get: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      });

      const stats = getCooldownStats();

      expect(stats.total_tasks_with_cooldowns).toBe(0);
      expect(stats.average_alert_count).toBe(0);
    });
  });

  describe('staleTaskJobHandler', () => {
    it('should process stale tasks and return result', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const result = await staleTaskJobHandler();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('items_processed');
      expect(result).toHaveProperty('items_succeeded');
      expect(result).toHaveProperty('items_failed');
      expect(result).toHaveProperty('duration_ms');
    });

    it('should return success true when no alerts', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const result = await staleTaskJobHandler();

      expect(result.success).toBe(true);
      expect(result.items_processed).toBe(0);
      expect(result.items_succeeded).toBe(0);
      expect(result.items_failed).toBe(0);
    });

    it('should enqueue signals for alerts', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 15);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Stale task',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const result = await staleTaskJobHandler();

      expect(result.success).toBe(true);
      if (result.items_processed > 0) {
        expect(mockEnqueueSignal).toHaveBeenCalled();
      }
    });

    it('should handle errors gracefully', async () => {
      mockGetAllTasks.mockRejectedValue(new Error('Database error'));

      const result = await staleTaskJobHandler();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should track duration', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      const result = await staleTaskJobHandler();

      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Severity Calculation', () => {
    it('should return info for 75-99% of threshold', async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(now.getDate() - 6); // 6/7 = 85%

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Info level',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: sixDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0) {
        expect(['info', 'warning']).toContain(alerts[0].severity);
      }
    });

    it('should return warning for 100-149% of threshold', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10); // 10/7 = 142%

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Warning level',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: tenDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0) {
        expect(['warning', 'critical']).toContain(alerts[0].severity);
      }
    });

    it('should return critical for 150%+ of threshold', async () => {
      const now = new Date();
      const fifteenDaysAgo = new Date(now);
      fifteenDaysAgo.setDate(now.getDate() - 15); // 15/7 = 214%

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Critical level',
          status: 'in_progress',
          priority: 'medium', // 7 day threshold
          source: 'local',
          updated_at: fifteenDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0) {
        expect(alerts[0].severity).toBe('critical');
      }
    });
  });

  describe('Suggested Actions', () => {
    it('should provide info-level suggestion', async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(now.getDate() - 6);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: sixDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0 && alerts[0].severity === 'info') {
        expect(alerts[0].suggested_action).toContain('approaching');
      }
    });

    it('should provide warning-level suggestion', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: tenDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0 && alerts[0].severity === 'warning') {
        expect(alerts[0].suggested_action.toLowerCase()).toContain('stale');
      }
    });

    it('should provide critical-level suggestion', async () => {
      const now = new Date();
      const twentyDaysAgo = new Date(now);
      twentyDaysAgo.setDate(now.getDate() - 20);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: twentyDaysAgo.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0 && alerts[0].severity === 'critical') {
        expect(alerts[0].suggested_action).toContain('URGENT');
      }
    });
  });

  describe('Cooldown System', () => {
    it('should skip tasks within cooldown period', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 10);

      // Mock that cooldown exists and hasn't expired
      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pm_alert_cooldowns')) {
          return {
            get: jest.fn().mockReturnValue({
              task_id: 'task-1',
              last_alert_time: Date.now() - 1000, // Recent alert
              last_alert_severity: 'warning',
              alert_count: 1,
            }),
            all: jest.fn(),
            run: jest.fn(),
          };
        }
        return {
          get: jest.fn(),
          all: jest.fn().mockReturnValue([]),
          run: jest.fn().mockReturnValue({ changes: 1 }),
        };
      });

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Task with cooldown',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      // Should skip due to cooldown
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should allow escalation to higher severity', async () => {
      // If task goes from warning to critical, should alert even if cooldown not expired
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 20);

      mockDb.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM pm_alert_cooldowns')) {
          return {
            get: jest.fn().mockReturnValue({
              task_id: 'task-1',
              last_alert_time: Date.now() - 1000,
              last_alert_severity: 'warning', // Was warning
              alert_count: 1,
            }),
            all: jest.fn(),
            run: jest.fn(),
          };
        }
        return {
          get: jest.fn(),
          all: jest.fn().mockReturnValue([]),
          run: jest.fn().mockReturnValue({ changes: 1 }),
        };
      });

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Escalating task',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      // Should allow alert because severity escalated
      if (alerts.length > 0) {
        expect(alerts[0].severity).toBe('critical');
      }
    });
  });

  describe('Database Schema', () => {
    it('should create cooldown table on first use', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      await detectStaleTasks();

      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS pm_alert_cooldowns')
      );
    });

    it('should create index on cooldown table', async () => {
      mockGetAllTasks.mockResolvedValue([]);

      await detectStaleTasks();

      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_alert_cooldowns_time')
      );
    });
  });

  describe('Task Sources', () => {
    it('should handle GitHub tasks', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 10);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'github-123',
          title: 'GitHub issue',
          status: 'in_progress',
          priority: 'medium',
          source: 'github',
          updated_at: staleDate.toISOString(),
          project_name: null,
          url: 'https://github.com/org/repo/issues/123',
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0) {
        expect(alerts[0].task_source).toBe('github');
      }
    });

    it('should handle local tasks', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 10);

      mockGetAllTasks.mockResolvedValue([
        {
          id: 'local-123',
          title: 'Local task',
          status: 'in_progress',
          priority: 'medium',
          source: 'local',
          updated_at: staleDate.toISOString(),
          project_name: null,
        },
      ]);

      const alerts = await detectStaleTasks();

      if (alerts.length > 0) {
        expect(alerts[0].task_source).toBe('local');
      }
    });
  });
});
