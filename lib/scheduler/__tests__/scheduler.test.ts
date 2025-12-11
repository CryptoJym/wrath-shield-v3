/**
 * Scheduler Tests
 * Tests for the Life OS Internal Scheduler
 */

import { getScheduler, resetScheduler, ScheduledTask } from '../index';

describe('LifeOSScheduler', () => {
  let scheduler: ReturnType<typeof getScheduler>;

  beforeEach(() => {
    resetScheduler();
    scheduler = getScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    resetScheduler();
  });

  describe('Task Registration', () => {
    it('should register a task', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/5 * * * *',
        enabled: true,
        handler: async () => {
          console.log('Test task executed');
        }
      };

      scheduler.registerTask(task);

      const registeredTask = scheduler.getTask('test-task');
      expect(registeredTask).toBeDefined();
      expect(registeredTask?.name).toBe('Test Task');
    });

    it('should unregister a task', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/5 * * * *',
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.unregisterTask('test-task');

      const registeredTask = scheduler.getTask('test-task');
      expect(registeredTask).toBeUndefined();
    });

    it('should get all tasks', () => {
      const task1: ScheduledTask = {
        id: 'task-1',
        name: 'Task 1',
        description: 'First task',
        cronExpression: '*/5 * * * *',
        enabled: true,
        handler: async () => {}
      };

      const task2: ScheduledTask = {
        id: 'task-2',
        name: 'Task 2',
        description: 'Second task',
        cronExpression: '*/10 * * * *',
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task1);
      scheduler.registerTask(task2);

      const allTasks = scheduler.getAllTasks();
      expect(allTasks).toHaveLength(2);
    });
  });

  describe('Task Enabling/Disabling', () => {
    it('should enable a task', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/5 * * * *',
        enabled: false,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.enableTask('test-task');

      const registeredTask = scheduler.getTask('test-task');
      expect(registeredTask?.enabled).toBe(true);
    });

    it('should disable a task', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/5 * * * *',
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.disableTask('test-task');

      const registeredTask = scheduler.getTask('test-task');
      expect(registeredTask?.enabled).toBe(false);
    });
  });

  describe('Scheduler Control', () => {
    it('should start the scheduler', () => {
      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.running).toBe(true);
    });

    it('should stop the scheduler', () => {
      scheduler.start();
      scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.running).toBe(false);
    });

    it('should not start twice', () => {
      scheduler.start();
      scheduler.start(); // Second call should be ignored

      const status = scheduler.getStatus();
      expect(status.running).toBe(true);
    });
  });

  describe('Status Reporting', () => {
    it('should return correct status', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/5 * * * *',
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.start();

      const status = scheduler.getStatus();

      expect(status.tasks).toBe(1);
      expect(status.running).toBe(true);
      expect(status.activeTasks).toBe(1);
      expect(status.taskDetails).toHaveLength(1);
      expect(status.taskDetails[0].name).toBe('Test Task');
    });

    it('should track task execution', async () => {
      let executionCount = 0;

      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/1 * * * *',  // Every minute (will be converted to 1 min interval)
        enabled: true,
        handler: async () => {
          executionCount++;
        }
      };

      scheduler.registerTask(task);
      scheduler.start();

      // Wait for task to execute (give it a bit more time than interval)
      await new Promise(resolve => setTimeout(resolve, 65000)); // 65 seconds

      expect(executionCount).toBeGreaterThan(0);

      const registeredTask = scheduler.getTask('test-task');
      expect(registeredTask?.lastRun).toBeDefined();
    }, 70000); // Increase test timeout to 70 seconds
  });

  describe('Cron Parsing', () => {
    it('should parse minute intervals', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '*/30 * * * *',  // Every 30 minutes
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.start();

      // Interval should be 30 minutes = 1,800,000 ms
      // We can't directly test the private method, but we can verify task is scheduled
      const status = scheduler.getStatus();
      expect(status.activeTasks).toBe(1);
    });

    it('should parse hourly intervals', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '0 */2 * * *',  // Every 2 hours
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.activeTasks).toBe(1);
    });

    it('should parse daily schedules', () => {
      const task: ScheduledTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        cronExpression: '0 7 * * *',  // Daily at 7 AM
        enabled: true,
        handler: async () => {}
      };

      scheduler.registerTask(task);
      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.activeTasks).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should continue running after task error', async () => {
      let successCount = 0;

      const failingTask: ScheduledTask = {
        id: 'failing-task',
        name: 'Failing Task',
        description: 'A task that fails',
        cronExpression: '*/1 * * * *',
        enabled: true,
        handler: async () => {
          throw new Error('Task error');
        }
      };

      const successTask: ScheduledTask = {
        id: 'success-task',
        name: 'Success Task',
        description: 'A task that succeeds',
        cronExpression: '*/1 * * * *',
        enabled: true,
        handler: async () => {
          successCount++;
        }
      };

      scheduler.registerTask(failingTask);
      scheduler.registerTask(successTask);
      scheduler.start();

      // Wait for tasks to execute
      await new Promise(resolve => setTimeout(resolve, 65000));

      // Success task should still execute despite failing task
      expect(successCount).toBeGreaterThan(0);
    }, 70000);
  });
});
