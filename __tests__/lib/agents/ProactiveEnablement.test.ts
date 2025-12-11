// @ts-nocheck
/**
 * Wrath Shield v3 - Proactive Enablement Tests
 *
 * Tests for the Proactive Enablement system that enables autonomous agent actions:
 * - Scheduled tasks (cron-like intervals)
 * - Event-driven triggers
 * - Threshold-based monitoring
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock AgentInvoker
const mockInvokeAgent = jest.fn().mockResolvedValue({
  content: 'Task completed',
  escalationLevel: 'AUTO_EXECUTE',
  shouldExecute: true,
});

jest.mock('@/lib/agents/AgentInvoker', () => ({
  invokeAgent: mockInvokeAgent,
}));

// Mock UnifiedBus
const mockWriteAgentMemory = jest.fn().mockResolvedValue(true);

jest.mock('@/lib/agents/UnifiedBus', () => ({
  getUnifiedBus: jest.fn().mockReturnValue({
    writeAgentMemory: mockWriteAgentMemory,
  }),
}));

import {
  getProactiveEnablement,
  type ScheduledTask,
  type EventTrigger,
  type ThresholdMonitor,
  type ProactiveAction,
  type ProactiveEvent,
} from '@/lib/agents/ProactiveEnablement';

describe('Proactive Enablement System', () => {
  let system: ReturnType<typeof getProactiveEnablement>;

  beforeEach(async () => {
    jest.clearAllMocks();
    system = getProactiveEnablement();
    await system.initialize();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const system1 = getProactiveEnablement();
      const system2 = getProactiveEnablement();
      expect(system1).toBe(system2);
    });
  });

  describe('Initialization', () => {
    it('should load default scheduled tasks', async () => {
      const tasks = system.getScheduledTasks();
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should load default event triggers', async () => {
      const triggers = system.getEventTriggers();
      expect(triggers.length).toBeGreaterThan(0);
    });

    it('should load default threshold monitors', async () => {
      const monitors = system.getThresholdMonitors();
      expect(monitors.length).toBeGreaterThan(0);
    });

    it('should only initialize once', async () => {
      await system.initialize();
      await system.initialize();
      // Should not duplicate tasks
      const tasks = system.getScheduledTasks();
      const uniqueNames = new Set(tasks.map(t => t.name));
      expect(tasks.length).toBe(uniqueNames.size);
    });
  });

  describe('Scheduled Tasks', () => {
    describe('addScheduledTask', () => {
      it('should add a new scheduled task', () => {
        const task = system.addScheduledTask({
          name: 'Test Task',
          description: 'A test task',
          agentId: 'agent.orchestrator',
          frequency: 'daily',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: { message: 'Test' },
            description: 'Test action',
          },
          enabled: true,
        });

        expect(task.id).toBeDefined();
        expect(task.name).toBe('Test Task');
        expect(task.runCount).toBe(0);
        expect(task.failCount).toBe(0);
      });

      it('should calculate next run time', () => {
        const task = system.addScheduledTask({
          name: 'Hourly Task',
          description: 'Runs every hour',
          agentId: 'agent.orchestrator',
          frequency: 'hourly',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: true,
        });

        expect(task.nextRun).toBeDefined();
        const nextRunTime = new Date(task.nextRun!).getTime();
        const now = Date.now();
        expect(nextRunTime).toBeGreaterThan(now);
      });
    });

    describe('getDueTasks', () => {
      it('should return tasks that are due', () => {
        // Add a task with nextRun in the past
        const task = system.addScheduledTask({
          name: 'Past Due Task',
          description: 'Should be due',
          agentId: 'agent.orchestrator',
          frequency: { type: 'interval', ms: 1 }, // Very short interval
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: true,
        });

        // Manually set nextRun to past
        const tasks = system.getScheduledTasks();
        const foundTask = tasks.find(t => t.id === task.id);
        if (foundTask) {
          foundTask.nextRun = new Date(Date.now() - 1000).toISOString();
        }

        const dueTasks = system.getDueTasks();
        expect(dueTasks.some(t => t.id === task.id)).toBe(true);
      });

      it('should not return disabled tasks', () => {
        const task = system.addScheduledTask({
          name: 'Disabled Task',
          description: 'Should not be due',
          agentId: 'agent.orchestrator',
          frequency: 'hourly',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: false, // Disabled
        });

        const dueTasks = system.getDueTasks();
        expect(dueTasks.some(t => t.id === task.id)).toBe(false);
      });
    });

    describe('executeTask', () => {
      it('should execute a task', async () => {
        const task = system.addScheduledTask({
          name: 'Executable Task',
          description: 'Test',
          agentId: 'agent.orchestrator',
          frequency: 'daily',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: { message: 'Execute me' },
            description: 'Test action',
          },
          enabled: true,
        });

        const result = await system.executeTask(task.id);

        expect(result.success).toBe(true);
        expect(result.wasExecuted).toBe(true);
      });

      it('should update task stats after execution', async () => {
        const task = system.addScheduledTask({
          name: 'Stats Task',
          description: 'Test',
          agentId: 'agent.orchestrator',
          frequency: 'daily',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: true,
        });

        await system.executeTask(task.id);

        const tasks = system.getScheduledTasks();
        const updatedTask = tasks.find(t => t.id === task.id);
        expect(updatedTask?.runCount).toBe(1);
        expect(updatedTask?.lastRun).toBeDefined();
      });

      it('should return error for non-existent task', async () => {
        const result = await system.executeTask('non-existent-id');
        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('toggleTask', () => {
      it('should enable/disable a task', () => {
        const task = system.addScheduledTask({
          name: 'Toggleable Task',
          description: 'Test',
          agentId: 'agent.orchestrator',
          frequency: 'daily',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: true,
        });

        system.toggleTask(task.id, false);

        const tasks = system.getScheduledTasks();
        const updatedTask = tasks.find(t => t.id === task.id);
        expect(updatedTask?.enabled).toBe(false);
      });
    });

    describe('deleteTask', () => {
      it('should delete a task', () => {
        const task = system.addScheduledTask({
          name: 'Deletable Task',
          description: 'Test',
          agentId: 'agent.orchestrator',
          frequency: 'daily',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: true,
        });

        const deleted = system.deleteTask(task.id);
        expect(deleted).toBe(true);

        const tasks = system.getScheduledTasks();
        expect(tasks.some(t => t.id === task.id)).toBe(false);
      });
    });
  });

  describe('Event Triggers', () => {
    describe('addEventTrigger', () => {
      it('should add a new event trigger', () => {
        const trigger = system.addEventTrigger({
          name: 'Test Trigger',
          type: 'email_received',
          agentId: 'agent.comms',
          conditions: [{ field: 'from', operator: 'contains', value: 'test@' }],
          action: {
            type: 'invoke_agent',
            escalationLevel: 'PROPOSE',
            confidence: 0.8,
            payload: {},
            description: 'Handle email',
          },
          enabled: true,
        });

        expect(trigger.id).toBeDefined();
        expect(trigger.triggerCount).toBe(0);
      });
    });

    describe('processEvent', () => {
      it('should process matching event', async () => {
        system.addEventTrigger({
          name: 'Email Handler',
          type: 'email_received',
          agentId: 'agent.comms',
          conditions: [{ field: 'from', operator: 'contains', value: 'important@' }],
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: { message: 'Process email' },
            description: 'Handle important email',
          },
          enabled: true,
        });

        const event: ProactiveEvent = {
          id: 'event-1',
          type: 'email_received',
          timestamp: new Date().toISOString(),
          source: 'gmail',
          data: { from: 'important@company.com', subject: 'Urgent' },
        };

        const results = await system.processEvent(event);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should not trigger for non-matching event', async () => {
        system.addEventTrigger({
          name: 'Specific Handler',
          type: 'email_received',
          agentId: 'agent.comms',
          conditions: [{ field: 'from', operator: 'contains', value: 'vip@' }],
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Handle VIP email',
          },
          enabled: true,
        });

        const event: ProactiveEvent = {
          id: 'event-2',
          type: 'email_received',
          timestamp: new Date().toISOString(),
          source: 'gmail',
          data: { from: 'random@spam.com', subject: 'Hello' },
        };

        const results = await system.processEvent(event);
        // Should not match the VIP trigger
        const triggeredFromVip = results.some(r => r.success);
        expect(triggeredFromVip).toBe(false);
      });

      it('should support different operators', async () => {
        // Test 'gt' operator
        system.addEventTrigger({
          name: 'High Value Trigger',
          type: 'financial_alert',
          agentId: 'agent.finance',
          conditions: [{ field: 'amount', operator: 'gt', value: 1000 }],
          action: {
            type: 'invoke_agent',
            escalationLevel: 'PROPOSE',
            confidence: 0.85,
            payload: {},
            description: 'High value alert',
          },
          enabled: true,
        });

        const event: ProactiveEvent = {
          id: 'event-3',
          type: 'financial_alert',
          timestamp: new Date().toISOString(),
          source: 'bank',
          data: { amount: 5000 },
        };

        const results = await system.processEvent(event);
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('toggleTrigger', () => {
      it('should enable/disable a trigger', () => {
        const trigger = system.addEventTrigger({
          name: 'Toggleable Trigger',
          type: 'email_received',
          agentId: 'agent.comms',
          conditions: [],
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          enabled: true,
        });

        system.toggleTrigger(trigger.id, false);

        const triggers = system.getEventTriggers();
        const updated = triggers.find(t => t.id === trigger.id);
        expect(updated?.enabled).toBe(false);
      });
    });
  });

  describe('Threshold Monitors', () => {
    describe('addThresholdMonitor', () => {
      it('should add a new threshold monitor', () => {
        const monitor = system.addThresholdMonitor({
          name: 'Test Monitor',
          agentId: 'agent.health',
          metric: 'whoop_sleep_score',
          threshold: 50,
          comparison: 'below',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.85,
            payload: {},
            description: 'Low sleep alert',
          },
          cooldownMs: 60 * 60 * 1000,
          enabled: true,
        });

        expect(monitor.id).toBeDefined();
        expect(monitor.alertCount).toBe(0);
      });
    });

    describe('checkThresholds', () => {
      it('should trigger for below threshold', async () => {
        system.addThresholdMonitor({
          name: 'Low Sleep Monitor',
          agentId: 'agent.health',
          metric: 'test_metric',
          threshold: 50,
          comparison: 'below',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: { message: 'Low metric alert' },
            description: 'Alert',
          },
          cooldownMs: 1000, // 1 second for testing
          enabled: true,
        });

        const results = await system.checkThresholds({ test_metric: 30 });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should trigger for above threshold', async () => {
        system.addThresholdMonitor({
          name: 'High Strain Monitor',
          agentId: 'agent.health',
          metric: 'strain_metric',
          threshold: 15,
          comparison: 'above',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'High strain alert',
          },
          cooldownMs: 1000,
          enabled: true,
        });

        const results = await system.checkThresholds({ strain_metric: 18 });
        expect(results.length).toBeGreaterThan(0);
      });

      it('should respect cooldown period', async () => {
        system.addThresholdMonitor({
          name: 'Cooldown Test Monitor',
          agentId: 'agent.health',
          metric: 'cooldown_metric',
          threshold: 50,
          comparison: 'below',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Alert',
          },
          cooldownMs: 10 * 60 * 1000, // 10 minutes
          enabled: true,
        });

        // First check should trigger
        const results1 = await system.checkThresholds({ cooldown_metric: 30 });
        expect(results1.length).toBeGreaterThan(0);

        // Second check should be blocked by cooldown
        const results2 = await system.checkThresholds({ cooldown_metric: 30 });
        // The same monitor shouldn't trigger again
        expect(results2.length).toBe(0);
      });

      it('should not trigger when threshold not crossed', async () => {
        system.addThresholdMonitor({
          name: 'Normal Monitor',
          agentId: 'agent.health',
          metric: 'normal_metric',
          threshold: 50,
          comparison: 'below',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Alert',
          },
          cooldownMs: 1000,
          enabled: true,
        });

        const results = await system.checkThresholds({ normal_metric: 75 }); // Above threshold
        expect(results.filter(r => r.success).length).toBe(0);
      });
    });

    describe('toggleMonitor', () => {
      it('should enable/disable a monitor', () => {
        const monitor = system.addThresholdMonitor({
          name: 'Toggleable Monitor',
          agentId: 'agent.health',
          metric: 'test',
          threshold: 50,
          comparison: 'below',
          action: {
            type: 'invoke_agent',
            escalationLevel: 'AUTO_EXECUTE',
            confidence: 0.9,
            payload: {},
            description: 'Test',
          },
          cooldownMs: 1000,
          enabled: true,
        });

        system.toggleMonitor(monitor.id, false);

        const monitors = system.getThresholdMonitors();
        const updated = monitors.find(m => m.id === monitor.id);
        expect(updated?.enabled).toBe(false);
      });
    });
  });

  describe('Action Execution', () => {
    it('should auto-execute high confidence actions', async () => {
      const task = system.addScheduledTask({
        name: 'High Confidence Task',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'daily',
        action: {
          type: 'invoke_agent',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 0.95, // High confidence
          payload: { message: 'Auto execute' },
          description: 'Test',
        },
        enabled: true,
      });

      const result = await system.executeTask(task.id);

      expect(result.wasExecuted).toBe(true);
    });

    it('should queue low confidence actions', async () => {
      const task = system.addScheduledTask({
        name: 'Low Confidence Task',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'daily',
        action: {
          type: 'invoke_agent',
          escalationLevel: 'PROPOSE', // Not AUTO_EXECUTE
          confidence: 0.6, // Low confidence
          payload: { message: 'Queue this' },
          description: 'Test',
        },
        enabled: true,
      });

      const result = await system.executeTask(task.id);

      expect(result.wasExecuted).toBe(false);
    });

    it('should handle notification actions', async () => {
      const task = system.addScheduledTask({
        name: 'Notification Task',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'daily',
        action: {
          type: 'send_notification',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 1.0,
          payload: { channel: 'push', message: 'Test notification' },
          description: 'Send notification',
        },
        enabled: true,
      });

      const result = await system.executeTask(task.id);

      expect(result.success).toBe(true);
    });

    it('should handle memory update actions', async () => {
      const task = system.addScheduledTask({
        name: 'Memory Task',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'daily',
        action: {
          type: 'update_memory',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 0.95,
          payload: { text: 'Important note', metadata: {} },
          description: 'Update memory',
        },
        enabled: true,
      });

      const result = await system.executeTask(task.id);

      expect(result.success).toBe(true);
      expect(mockWriteAgentMemory).toHaveBeenCalled();
    });
  });

  describe('Action History', () => {
    it('should track action history', async () => {
      const task = system.addScheduledTask({
        name: 'History Task',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'daily',
        action: {
          type: 'invoke_agent',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 0.9,
          payload: {},
          description: 'Test',
        },
        enabled: true,
      });

      await system.executeTask(task.id);

      const history = system.getActionHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history size', async () => {
      const task = system.addScheduledTask({
        name: 'Repeated Task',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'hourly',
        action: {
          type: 'invoke_agent',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 0.9,
          payload: {},
          description: 'Test',
        },
        enabled: true,
      });

      // Execute many times
      for (let i = 0; i < 50; i++) {
        await system.executeTask(task.id);
      }

      const history = system.getActionHistory(100);
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('System Status', () => {
    it('should return system status', async () => {
      const status = await system.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.taskCount).toBeGreaterThan(0);
      expect(status.triggerCount).toBeGreaterThan(0);
      expect(status.monitorCount).toBeGreaterThan(0);
    });

    it('should report due tasks count', async () => {
      const status = await system.getStatus();

      expect(typeof status.dueTasks).toBe('number');
    });

    it('should report next scheduled run', async () => {
      const status = await system.getStatus();

      expect(status.nextScheduledRun).toBeDefined();
    });
  });

  describe('Frequency Calculations', () => {
    it('should calculate hourly next run', () => {
      const task = system.addScheduledTask({
        name: 'Hourly',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: 'hourly',
        action: {
          type: 'invoke_agent',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 0.9,
          payload: {},
          description: 'Test',
        },
        enabled: true,
      });

      const nextRun = new Date(task.nextRun!).getTime();
      const now = Date.now();
      const diff = nextRun - now;

      // Should be about 1 hour (with some tolerance)
      expect(diff).toBeGreaterThan(55 * 60 * 1000); // > 55 min
      expect(diff).toBeLessThanOrEqual(65 * 60 * 1000); // < 65 min
    });

    it('should calculate interval-based next run', () => {
      const task = system.addScheduledTask({
        name: 'Custom Interval',
        description: 'Test',
        agentId: 'agent.orchestrator',
        frequency: { type: 'interval', ms: 30 * 60 * 1000 }, // 30 minutes
        action: {
          type: 'invoke_agent',
          escalationLevel: 'AUTO_EXECUTE',
          confidence: 0.9,
          payload: {},
          description: 'Test',
        },
        enabled: true,
      });

      const nextRun = new Date(task.nextRun!).getTime();
      const now = Date.now();
      const diff = nextRun - now;

      // Should be about 30 minutes
      expect(diff).toBeGreaterThan(25 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(35 * 60 * 1000);
    });
  });
});
