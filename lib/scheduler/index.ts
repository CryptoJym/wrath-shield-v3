/**
 * Life OS Internal Scheduler
 * Runs scheduled agent tasks within the Next.js application
 *
 * This scheduler runs within the Next.js process, making it compatible with
 * environments that don't support PM2 (e.g., Vercel, Railway, Docker).
 *
 * Architecture:
 * - Singleton scheduler instance
 * - Cron-like scheduling (simplified)
 * - Task registration and management
 * - Integration with Life OS Event Bus
 *
 * Usage:
 * ```typescript
 * import { getScheduler } from '@/lib/scheduler';
 *
 * const scheduler = getScheduler();
 * scheduler.registerTask({
 *   id: 'my-task',
 *   name: 'My Task',
 *   description: 'Does something periodically',
 *   cronExpression: '0 7 * * *',  // 7 AM daily
 *   handler: async () => {
 *     console.log('Task running!');
 *   },
 *   enabled: true
 * });
 *
 * scheduler.start();
 * ```
 */

import { getEventBus, createTaskEvent, createNotificationEvent } from '@/lib/agents/life-os-event-bus';

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;  // e.g., '0 7 * * *' = 7 AM daily, '*/30 * * * *' = every 30 minutes
  handler: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

/**
 * Life OS Scheduler
 * Manages scheduled tasks within the Next.js application
 */
export class LifeOSScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  /**
   * Register a scheduled task
   * Task will be started automatically if scheduler is running
   */
  registerTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
    console.log(`[Scheduler] Registered task: ${task.name}`);

    if (this.isRunning && task.enabled) {
      this.scheduleTask(task);
    }
  }

  /**
   * Unregister a task
   */
  unregisterTask(taskId: string): void {
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    this.tasks.delete(taskId);
    console.log(`[Scheduler] Unregistered task: ${taskId}`);
  }

  /**
   * Enable a task
   */
  enableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`[Scheduler] Task not found: ${taskId}`);
      return;
    }

    task.enabled = true;

    if (this.isRunning) {
      this.scheduleTask(task);
    }

    console.log(`[Scheduler] Enabled task: ${task.name}`);
  }

  /**
   * Disable a task
   */
  disableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`[Scheduler] Task not found: ${taskId}`);
      return;
    }

    task.enabled = false;

    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    console.log(`[Scheduler] Disabled task: ${task.name}`);
  }

  /**
   * Start the scheduler
   * Begins running all enabled tasks
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Scheduler] Starting Life OS Scheduler...');

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task);
      }
    }

    console.log(`[Scheduler] Started with ${this.tasks.size} tasks (${this.intervals.size} active)`);
  }

  /**
   * Stop the scheduler
   * Stops all running tasks
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[Scheduler] Already stopped');
      return;
    }

    this.isRunning = false;

    for (const [id, interval] of this.intervals) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    console.log('[Scheduler] Stopped');
  }

  /**
   * Schedule a task for periodic execution
   */
  private scheduleTask(task: ScheduledTask): void {
    // Clear existing interval if any
    const existingInterval = this.intervals.get(task.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Parse cron and calculate interval
    const intervalMs = this.cronToInterval(task.cronExpression);

    // Calculate next run time
    task.nextRun = new Date(Date.now() + intervalMs);

    console.log(`[Scheduler] Scheduling task: ${task.name} (runs every ${intervalMs / 1000}s, next: ${task.nextRun.toISOString()})`);

    // Set up interval
    const interval = setInterval(async () => {
      try {
        console.log(`[Scheduler] Running task: ${task.name}`);
        task.lastRun = new Date();
        task.nextRun = new Date(Date.now() + intervalMs);

        await task.handler();

        console.log(`[Scheduler] Task completed: ${task.name}`);
      } catch (error) {
        console.error(`[Scheduler] Task failed: ${task.name}`, error);

        // Publish error event to event bus
        try {
          const eventBus = getEventBus();
          await eventBus.publish(createNotificationEvent({
            source: 'scheduler',
            payload: {
              type: 'task-error',
              taskId: task.id,
              taskName: task.name,
              error: error instanceof Error ? error.message : String(error)
            },
            priority: 'high'
          }));
        } catch (busError) {
          console.error('[Scheduler] Failed to publish error event', busError);
        }
      }
    }, intervalMs);

    this.intervals.set(task.id, interval);
  }

  /**
   * Convert cron expression to interval in milliseconds
   * Simplified cron parser - supports common patterns
   *
   * Patterns:
   * - '* /30 * * * *' = every 30 minutes (note: remove space between * and /)
   * - '0 7 * * *' = daily at 7 AM
   * - '0 * /2 * * *' = every 2 hours (note: remove space between * and /)
   * - '0 18 * * 0' = weekly Sunday 6 PM
   *
   * For complex scheduling, use a proper cron library in production
   */
  private cronToInterval(cron: string): number {
    const parts = cron.trim().split(/\s+/);

    // Handle minute-based intervals (e.g., '*/30 * * * *')
    if (parts.length >= 1 && parts[0].startsWith('*/')) {
      const minutes = parseInt(parts[0].replace('*/', ''));
      if (!isNaN(minutes)) {
        return minutes * 60 * 1000;
      }
    }

    // Handle hourly intervals (e.g., '0 */2 * * *')
    if (parts.length >= 2 && parts[1].startsWith('*/')) {
      const hours = parseInt(parts[1].replace('*/', ''));
      if (!isNaN(hours)) {
        return hours * 60 * 60 * 1000;
      }
    }

    // Handle daily at specific time (e.g., '0 7 * * *')
    if (parts.length >= 2 && parts[0] === '0' && !parts[1].includes('*')) {
      const hour = parseInt(parts[1]);
      if (!isNaN(hour)) {
        // Run daily - 24 hour interval
        return 24 * 60 * 60 * 1000;
      }
    }

    // Handle weekly (e.g., '0 18 * * 0')
    if (parts.length >= 5 && !parts[4].includes('*')) {
      // Weekly - 7 day interval
      return 7 * 24 * 60 * 60 * 1000;
    }

    // Default to hourly for unrecognized patterns
    console.warn(`[Scheduler] Unrecognized cron pattern: ${cron}, defaulting to hourly`);
    return 60 * 60 * 1000;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    tasks: number;
    running: boolean;
    activeTasks: number;
    taskDetails: Array<{
      id: string;
      name: string;
      description: string;
      enabled: boolean;
      lastRun?: string;
      nextRun?: string;
    }>;
  } {
    const taskDetails = Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      enabled: task.enabled,
      lastRun: task.lastRun?.toISOString(),
      nextRun: task.nextRun?.toISOString()
    }));

    return {
      tasks: this.tasks.size,
      running: this.isRunning,
      activeTasks: this.intervals.size,
      taskDetails
    };
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let schedulerInstance: LifeOSScheduler | null = null;

/**
 * Get the singleton scheduler instance
 */
export function getScheduler(): LifeOSScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new LifeOSScheduler();
    console.log('[Scheduler] Scheduler instance created');
  }
  return schedulerInstance;
}

/**
 * Reset scheduler (for testing)
 */
export function resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
    console.log('[Scheduler] Scheduler reset');
  }
}
