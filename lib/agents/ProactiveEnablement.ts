/**
 * Proactive Enablement System
 *
 * Allows agents to take autonomous action based on:
 * 1. Scheduled tasks (cron-like intervals)
 * 2. Event-driven triggers (webhooks, state changes)
 * 3. Threshold-based monitoring (metrics, deadlines)
 *
 * KEY PRINCIPLE: Maximum enablement for confident actions
 * - AUTO_EXECUTE for high-confidence, reversible actions
 * - PROPOSE for significant or irreversible actions
 * - CRITICAL escalation only for true emergencies
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    PROACTIVE ENABLEMENT SYSTEM                           │
 * │                                                                          │
 * │  ┌─────────────────────────────────────────────────────────────────────┐│
 * │  │                        SCHEDULER                                     ││
 * │  │   Manages scheduled tasks, intervals, and deadlines                  ││
 * │  └─────────────────────────────────────────────────────────────────────┘│
 * │                                │                                         │
 * │         ┌──────────────────────┼──────────────────────┐                 │
 * │         │                      │                      │                 │
 * │         ▼                      ▼                      ▼                 │
 * │  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐           │
 * │  │  SCHEDULED  │       │   EVENT     │       │  THRESHOLD  │           │
 * │  │   TASKS     │       │  TRIGGERS   │       │  MONITORS   │           │
 * │  │             │       │             │       │             │           │
 * │  │ Daily brief │       │ New email   │       │ Deadline    │           │
 * │  │ Health check│       │ State change│       │ Low balance │           │
 * │  │ Memory sync │       │ Webhook     │       │ Health alert│           │
 * │  └─────────────┘       └─────────────┘       └─────────────┘           │
 * │                                │                                         │
 * │                                ▼                                         │
 * │                      ┌─────────────────┐                                │
 * │                      │  ACTION ENGINE  │                                │
 * │                      │  (Executes or   │                                │
 * │                      │   Proposes)     │                                │
 * │                      └─────────────────┘                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { ensureServerOnly } from '../server-only-guard';
import type { LifeOSAgentId } from './UnifiedBus';
import type { EscalationLevel } from './types';

ensureServerOnly('lib/agents/ProactiveEnablement');

// =============================================================================
// Types
// =============================================================================

export type TaskFrequency =
  | 'hourly'
  | 'every_4_hours'
  | 'every_12_hours'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | { type: 'cron'; expression: string }
  | { type: 'interval'; ms: number };

export type TriggerType =
  | 'email_received'
  | 'message_received'
  | 'calendar_event'
  | 'deadline_approaching'
  | 'agent_state_change'
  | 'memory_threshold'
  | 'health_alert'
  | 'financial_alert'
  | 'custom_webhook';

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  agentId: LifeOSAgentId;
  frequency: TaskFrequency;
  action: ProactiveAction;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  failCount: number;
  createdAt: string;
}

export interface EventTrigger {
  id: string;
  name: string;
  type: TriggerType;
  agentId: LifeOSAgentId;
  conditions: TriggerCondition[];
  action: ProactiveAction;
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: string;
  createdAt: string;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'matches';
  value: any;
}

export interface ThresholdMonitor {
  id: string;
  name: string;
  agentId: LifeOSAgentId;
  metric: string;
  threshold: number;
  comparison: 'above' | 'below' | 'equals';
  action: ProactiveAction;
  cooldownMs: number;
  enabled: boolean;
  currentValue?: number;
  lastAlert?: string;
  alertCount: number;
  createdAt: string;
}

export interface ProactiveAction {
  type: 'invoke_agent' | 'send_notification' | 'update_memory' | 'execute_workflow';
  escalationLevel: EscalationLevel;
  confidence: number;
  payload: Record<string, any>;
  description: string;
}

export interface ActionResult {
  success: boolean;
  executionTime: number;
  escalationLevel: EscalationLevel;
  wasExecuted: boolean;
  result?: any;
  error?: string;
}

export interface ProactiveEvent {
  id: string;
  type: TriggerType;
  timestamp: string;
  source: string;
  data: Record<string, any>;
}

// =============================================================================
// Default Tasks & Triggers
// =============================================================================

const DEFAULT_SCHEDULED_TASKS: Omit<ScheduledTask, 'id' | 'runCount' | 'failCount' | 'createdAt'>[] = [
  {
    name: 'Morning Briefing',
    description: 'Generate daily strategic briefing for James',
    agentId: 'agent.orchestrator',
    frequency: 'daily',
    action: {
      type: 'invoke_agent',
      escalationLevel: 'AUTO_EXECUTE',
      confidence: 0.95,
      payload: {
        message: 'Generate the morning briefing with priorities for today',
        includeSections: ['calendar', 'tasks', 'health', 'legal'],
      },
      description: 'Generate daily morning briefing',
    },
    enabled: true,
  },
  {
    name: 'Legal Case Monitor',
    description: 'Check for legal updates and deadline reminders',
    agentId: 'agent.legal',
    frequency: 'daily',
    action: {
      type: 'invoke_agent',
      escalationLevel: 'PROPOSE',
      confidence: 0.8,
      payload: {
        message: 'Check for any case updates, upcoming deadlines, or new communications that need attention',
      },
      description: 'Daily legal case monitoring',
    },
    enabled: true,
  },
  {
    name: 'Health Data Sync',
    description: 'Sync and analyze WHOOP/health data',
    agentId: 'agent.health',
    frequency: 'every_12_hours',
    action: {
      type: 'invoke_agent',
      escalationLevel: 'AUTO_EXECUTE',
      confidence: 0.9,
      payload: {
        message: 'Sync latest health data and identify any concerning trends',
      },
      description: 'Health data sync and analysis',
    },
    enabled: true,
  },
  {
    name: 'Finance Weekly Review',
    description: 'Weekly financial summary and categorization',
    agentId: 'agent.finance',
    frequency: 'weekly',
    action: {
      type: 'invoke_agent',
      escalationLevel: 'PROPOSE',
      confidence: 0.85,
      payload: {
        message: 'Generate weekly financial summary with transaction categorization',
      },
      description: 'Weekly finance review',
    },
    enabled: true,
  },
  {
    name: 'Memory Compaction',
    description: 'Compact and summarize agent memories',
    agentId: 'agent.orchestrator',
    frequency: 'weekly',
    action: {
      type: 'execute_workflow',
      escalationLevel: 'AUTO_EXECUTE',
      confidence: 0.95,
      payload: {
        workflow: 'memory_compaction',
        targetAgents: 'all',
      },
      description: 'Weekly memory compaction',
    },
    enabled: true,
  },
];

const DEFAULT_EVENT_TRIGGERS: Omit<EventTrigger, 'id' | 'triggerCount' | 'createdAt'>[] = [
  {
    name: 'Legal Email Alert',
    type: 'email_received',
    agentId: 'agent.legal',
    conditions: [
      { field: 'from', operator: 'contains', value: '@moodylaw' },
    ],
    action: {
      type: 'invoke_agent',
      escalationLevel: 'PROPOSE',
      confidence: 0.9,
      payload: {
        message: 'New email from attorney - analyze and summarize',
      },
      description: 'Analyze incoming legal emails',
    },
    enabled: true,
  },
  {
    name: 'Calendar Reminder',
    type: 'calendar_event',
    agentId: 'agent.ea',
    conditions: [
      { field: 'minutesUntil', operator: 'lt', value: 30 },
    ],
    action: {
      type: 'send_notification',
      escalationLevel: 'AUTO_EXECUTE',
      confidence: 1.0,
      payload: {
        channel: 'push',
        priority: 'high',
      },
      description: 'Send calendar reminder',
    },
    enabled: true,
  },
  {
    name: 'Deadline Warning',
    type: 'deadline_approaching',
    agentId: 'agent.pm',
    conditions: [
      { field: 'daysUntil', operator: 'lt', value: 3 },
    ],
    action: {
      type: 'invoke_agent',
      escalationLevel: 'CRITICAL',
      confidence: 0.95,
      payload: {
        message: 'Deadline approaching - prioritize and plan',
      },
      description: 'Deadline warning system',
    },
    enabled: true,
  },
];

const DEFAULT_THRESHOLD_MONITORS: Omit<ThresholdMonitor, 'id' | 'alertCount' | 'createdAt'>[] = [
  {
    name: 'Low Sleep Score',
    agentId: 'agent.health',
    metric: 'whoop_sleep_score',
    threshold: 60,
    comparison: 'below',
    action: {
      type: 'invoke_agent',
      escalationLevel: 'AUTO_EXECUTE',
      confidence: 0.85,
      payload: {
        message: 'Sleep score is below threshold - analyze and provide recommendations',
      },
      description: 'Low sleep score intervention',
    },
    cooldownMs: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true,
  },
  {
    name: 'High Recovery Alert',
    agentId: 'agent.coaching',
    metric: 'whoop_recovery',
    threshold: 85,
    comparison: 'above',
    action: {
      type: 'invoke_agent',
      escalationLevel: 'AUTO_EXECUTE',
      confidence: 0.9,
      payload: {
        message: 'High recovery day - suggest challenging workout or productive tasks',
      },
      description: 'High recovery opportunity',
    },
    cooldownMs: 12 * 60 * 60 * 1000, // 12 hours
    enabled: true,
  },
  {
    name: 'Pending Escalations Alert',
    agentId: 'agent.orchestrator',
    metric: 'pending_escalation_count',
    threshold: 5,
    comparison: 'above',
    action: {
      type: 'send_notification',
      escalationLevel: 'CRITICAL',
      confidence: 1.0,
      payload: {
        channel: 'push',
        message: 'Multiple pending escalations require attention',
      },
      description: 'Escalation backlog alert',
    },
    cooldownMs: 2 * 60 * 60 * 1000, // 2 hours
    enabled: true,
  },
];

// =============================================================================
// Proactive Enablement System
// =============================================================================

class ProactiveEnablementSystem {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private eventTriggers: Map<string, EventTrigger> = new Map();
  private thresholdMonitors: Map<string, ThresholdMonitor> = new Map();
  private actionHistory: ActionResult[] = [];
  private maxHistorySize = 1000;
  private initialized = false;

  /**
   * Initialize with default tasks and triggers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load default scheduled tasks
    for (const taskDef of DEFAULT_SCHEDULED_TASKS) {
      const id = this.generateId('task');
      const task: ScheduledTask = {
        id,
        ...taskDef,
        runCount: 0,
        failCount: 0,
        createdAt: new Date().toISOString(),
        nextRun: this.calculateNextRun(taskDef.frequency),
      };
      this.scheduledTasks.set(id, task);
    }

    // Load default event triggers
    for (const triggerDef of DEFAULT_EVENT_TRIGGERS) {
      const id = this.generateId('trigger');
      const trigger: EventTrigger = {
        id,
        ...triggerDef,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
      };
      this.eventTriggers.set(id, trigger);
    }

    // Load default threshold monitors
    for (const monitorDef of DEFAULT_THRESHOLD_MONITORS) {
      const id = this.generateId('monitor');
      const monitor: ThresholdMonitor = {
        id,
        ...monitorDef,
        alertCount: 0,
        createdAt: new Date().toISOString(),
      };
      this.thresholdMonitors.set(id, monitor);
    }

    this.initialized = true;
    console.log('[ProactiveEnablement] Initialized with defaults');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  // ===========================================================================
  // Scheduled Task Management
  // ===========================================================================

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: TaskFrequency): string {
    const now = new Date();

    if (typeof frequency === 'object') {
      if (frequency.type === 'interval') {
        return new Date(now.getTime() + frequency.ms).toISOString();
      }
      // Cron expression handling would go here
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    switch (frequency) {
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      case 'every_4_hours':
        return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      case 'every_12_hours':
        return new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(7, 0, 0, 0); // 7 AM
        return tomorrow.toISOString();
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString();
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth.toISOString();
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
  }

  /**
   * Get due scheduled tasks
   */
  getDueTasks(): ScheduledTask[] {
    const now = new Date();
    return Array.from(this.scheduledTasks.values()).filter(
      (task) => task.enabled && task.nextRun && new Date(task.nextRun) <= now
    );
  }

  /**
   * Execute a scheduled task
   */
  async executeTask(taskId: string): Promise<ActionResult> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      return {
        success: false,
        executionTime: 0,
        escalationLevel: 'CRITICAL',
        wasExecuted: false,
        error: `Task not found: ${taskId}`,
      };
    }

    const startTime = Date.now();
    let result: ActionResult;

    try {
      result = await this.executeAction(task.action, task.agentId);

      // Update task stats
      task.lastRun = new Date().toISOString();
      task.nextRun = this.calculateNextRun(task.frequency);
      task.runCount++;
      if (!result.success) task.failCount++;

    } catch (error) {
      result = {
        success: false,
        executionTime: Date.now() - startTime,
        escalationLevel: task.action.escalationLevel,
        wasExecuted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      task.failCount++;
    }

    this.logAction(result);
    return result;
  }

  /**
   * Run all due tasks
   */
  async runDueTasks(): Promise<ActionResult[]> {
    await this.initialize();
    const dueTasks = this.getDueTasks();
    const results: ActionResult[] = [];

    for (const task of dueTasks) {
      const result = await this.executeTask(task.id);
      results.push(result);
    }

    return results;
  }

  // ===========================================================================
  // Event Trigger Management
  // ===========================================================================

  /**
   * Process an incoming event
   */
  async processEvent(event: ProactiveEvent): Promise<ActionResult[]> {
    await this.initialize();
    const results: ActionResult[] = [];

    // Find matching triggers
    const matchingTriggers = Array.from(this.eventTriggers.values()).filter(
      (trigger) => trigger.enabled && trigger.type === event.type && this.evaluateConditions(trigger.conditions, event.data)
    );

    for (const trigger of matchingTriggers) {
      const result = await this.executeAction(trigger.action, trigger.agentId);
      trigger.triggerCount++;
      trigger.lastTriggered = new Date().toISOString();
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate trigger conditions against event data
   */
  private evaluateConditions(conditions: TriggerCondition[], data: Record<string, any>): boolean {
    return conditions.every((condition) => {
      const value = this.getNestedValue(data, condition.field);
      if (value === undefined) return false;

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'gt':
          return Number(value) > Number(condition.value);
        case 'lt':
          return Number(value) < Number(condition.value);
        case 'matches':
          return new RegExp(condition.value).test(String(value));
        default:
          return false;
      }
    });
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // ===========================================================================
  // Threshold Monitor Management
  // ===========================================================================

  /**
   * Check all thresholds against current metrics
   */
  async checkThresholds(metrics: Record<string, number>): Promise<ActionResult[]> {
    await this.initialize();
    const results: ActionResult[] = [];
    const now = Date.now();

    for (const monitor of this.thresholdMonitors.values()) {
      if (!monitor.enabled) continue;

      const value = metrics[monitor.metric];
      if (value === undefined) continue;

      monitor.currentValue = value;

      // Check if threshold is crossed
      let triggered = false;
      switch (monitor.comparison) {
        case 'above':
          triggered = value > monitor.threshold;
          break;
        case 'below':
          triggered = value < monitor.threshold;
          break;
        case 'equals':
          triggered = value === monitor.threshold;
          break;
      }

      if (!triggered) continue;

      // Check cooldown
      if (monitor.lastAlert) {
        const timeSinceLastAlert = now - new Date(monitor.lastAlert).getTime();
        if (timeSinceLastAlert < monitor.cooldownMs) continue;
      }

      // Execute action
      const result = await this.executeAction(monitor.action, monitor.agentId);
      monitor.alertCount++;
      monitor.lastAlert = new Date().toISOString();
      results.push(result);
    }

    return results;
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  /**
   * Execute a proactive action
   */
  private async executeAction(action: ProactiveAction, agentId: LifeOSAgentId): Promise<ActionResult> {
    const startTime = Date.now();

    // Determine if we should auto-execute based on confidence and escalation
    const shouldExecute = action.escalationLevel === 'AUTO_EXECUTE' && action.confidence >= 0.8;

    try {
      let result: any;

      switch (action.type) {
        case 'invoke_agent':
          if (shouldExecute) {
            const { invokeAgent } = await import('./AgentInvoker');
            const response = await invokeAgent({
              agentId,
              userMessage: action.payload.message || action.description,
              forceExecute: true,
            });
            result = response;
          } else {
            // Queue for approval
            result = { queued: true, action: action.description };
          }
          break;

        case 'send_notification':
          if (shouldExecute) {
            // Would integrate with notification service
            console.log(`[ProactiveEnablement] Notification: ${action.payload.message || action.description}`);
            result = { sent: true };
          } else {
            result = { queued: true };
          }
          break;

        case 'update_memory':
          if (shouldExecute) {
            const { getUnifiedBus } = await import('./UnifiedBus');
            const bus = getUnifiedBus();
            await bus.writeAgentMemory(agentId, action.payload.text, action.payload.metadata);
            result = { written: true };
          } else {
            result = { queued: true };
          }
          break;

        case 'execute_workflow':
          // Workflow execution would integrate with a workflow engine
          console.log(`[ProactiveEnablement] Workflow: ${action.payload.workflow}`);
          result = { started: true };
          break;

        default:
          result = { error: `Unknown action type: ${action.type}` };
      }

      return {
        success: true,
        executionTime: Date.now() - startTime,
        escalationLevel: action.escalationLevel,
        wasExecuted: shouldExecute,
        result,
      };

    } catch (error) {
      return {
        success: false,
        executionTime: Date.now() - startTime,
        escalationLevel: action.escalationLevel,
        wasExecuted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log action to history
   */
  private logAction(result: ActionResult): void {
    this.actionHistory.unshift(result);
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.pop();
    }
  }

  // ===========================================================================
  // Management API
  // ===========================================================================

  /**
   * Add a new scheduled task
   */
  addScheduledTask(task: Omit<ScheduledTask, 'id' | 'runCount' | 'failCount' | 'createdAt'>): ScheduledTask {
    const id = this.generateId('task');
    const newTask: ScheduledTask = {
      id,
      ...task,
      runCount: 0,
      failCount: 0,
      createdAt: new Date().toISOString(),
      nextRun: this.calculateNextRun(task.frequency),
    };
    this.scheduledTasks.set(id, newTask);
    return newTask;
  }

  /**
   * Add a new event trigger
   */
  addEventTrigger(trigger: Omit<EventTrigger, 'id' | 'triggerCount' | 'createdAt'>): EventTrigger {
    const id = this.generateId('trigger');
    const newTrigger: EventTrigger = {
      id,
      ...trigger,
      triggerCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.eventTriggers.set(id, newTrigger);
    return newTrigger;
  }

  /**
   * Add a new threshold monitor
   */
  addThresholdMonitor(monitor: Omit<ThresholdMonitor, 'id' | 'alertCount' | 'createdAt'>): ThresholdMonitor {
    const id = this.generateId('monitor');
    const newMonitor: ThresholdMonitor = {
      id,
      ...monitor,
      alertCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.thresholdMonitors.set(id, newMonitor);
    return newMonitor;
  }

  /**
   * Get all tasks/triggers/monitors
   */
  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }

  getEventTriggers(): EventTrigger[] {
    return Array.from(this.eventTriggers.values());
  }

  getThresholdMonitors(): ThresholdMonitor[] {
    return Array.from(this.thresholdMonitors.values());
  }

  /**
   * Get action history
   */
  getActionHistory(limit = 50): ActionResult[] {
    return this.actionHistory.slice(0, limit);
  }

  /**
   * Toggle enabled state
   */
  toggleTask(taskId: string, enabled: boolean): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = enabled;
      return true;
    }
    return false;
  }

  toggleTrigger(triggerId: string, enabled: boolean): boolean {
    const trigger = this.eventTriggers.get(triggerId);
    if (trigger) {
      trigger.enabled = enabled;
      return true;
    }
    return false;
  }

  toggleMonitor(monitorId: string, enabled: boolean): boolean {
    const monitor = this.thresholdMonitors.get(monitorId);
    if (monitor) {
      monitor.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Delete task/trigger/monitor
   */
  deleteTask(taskId: string): boolean {
    return this.scheduledTasks.delete(taskId);
  }

  deleteTrigger(triggerId: string): boolean {
    return this.eventTriggers.delete(triggerId);
  }

  deleteMonitor(monitorId: string): boolean {
    return this.thresholdMonitors.delete(monitorId);
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    taskCount: number;
    triggerCount: number;
    monitorCount: number;
    dueTasks: number;
    recentActions: number;
    nextScheduledRun?: string;
  }> {
    await this.initialize();

    const dueTasks = this.getDueTasks();
    const allTasks = this.getScheduledTasks();
    const nextRuns = allTasks
      .filter((t) => t.enabled && t.nextRun)
      .map((t) => t.nextRun!)
      .sort();

    return {
      initialized: this.initialized,
      taskCount: this.scheduledTasks.size,
      triggerCount: this.eventTriggers.size,
      monitorCount: this.thresholdMonitors.size,
      dueTasks: dueTasks.length,
      recentActions: this.actionHistory.length,
      nextScheduledRun: nextRuns[0],
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let instance: ProactiveEnablementSystem | null = null;

export function getProactiveEnablement(): ProactiveEnablementSystem {
  if (!instance) {
    instance = new ProactiveEnablementSystem();
  }
  return instance;
}

export { ProactiveEnablementSystem };
