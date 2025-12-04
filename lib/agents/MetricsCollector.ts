/**
 * Metrics Collector
 *
 * Collects metrics from various sources for threshold monitoring.
 * Used by the ProactiveEnablement system to check thresholds.
 *
 * Metric Sources:
 * - WHOOP API (sleep, recovery, strain)
 * - System state (escalations, emails, tasks)
 * - Agent state (errors, activity)
 * - Memory system (proposals)
 */

import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/agents/MetricsCollector');

// =============================================================================
// Types
// =============================================================================

export interface MetricDefinition {
  name: string;
  description: string;
  source: 'whoop' | 'system' | 'agent' | 'memory' | 'custom';
  unit?: string;
  defaultValue: number;
}

export interface CollectedMetrics {
  // WHOOP Health Metrics
  whoop_sleep_score: number;
  whoop_recovery: number;
  whoop_strain: number;
  whoop_hrv: number;
  whoop_rhr: number;

  // System Metrics
  pending_escalation_count: number;
  unread_email_count: number;
  overdue_task_count: number;
  upcoming_deadline_count: number;

  // Agent Metrics
  agent_error_count: number;
  agent_busy_count: number;
  total_agent_invocations_24h: number;

  // Memory Metrics
  pending_proposal_count: number;
  total_memory_count: number;

  // Timestamp
  collected_at: string;
}

// =============================================================================
// Metric Definitions
// =============================================================================

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  whoop_sleep_score: {
    name: 'WHOOP Sleep Score',
    description: 'Sleep performance score from WHOOP (0-100)',
    source: 'whoop',
    unit: '%',
    defaultValue: 75,
  },
  whoop_recovery: {
    name: 'WHOOP Recovery',
    description: 'Recovery score from WHOOP (0-100)',
    source: 'whoop',
    unit: '%',
    defaultValue: 60,
  },
  whoop_strain: {
    name: 'WHOOP Strain',
    description: 'Daily strain from WHOOP (0-21)',
    source: 'whoop',
    unit: 'strain',
    defaultValue: 10,
  },
  whoop_hrv: {
    name: 'WHOOP HRV',
    description: 'Heart rate variability in ms',
    source: 'whoop',
    unit: 'ms',
    defaultValue: 50,
  },
  whoop_rhr: {
    name: 'WHOOP RHR',
    description: 'Resting heart rate in bpm',
    source: 'whoop',
    unit: 'bpm',
    defaultValue: 55,
  },
  pending_escalation_count: {
    name: 'Pending Escalations',
    description: 'Number of unresolved CRITICAL/PROPOSE escalations',
    source: 'system',
    defaultValue: 0,
  },
  unread_email_count: {
    name: 'Unread Emails',
    description: 'Number of unread important emails',
    source: 'system',
    defaultValue: 0,
  },
  overdue_task_count: {
    name: 'Overdue Tasks',
    description: 'Number of tasks past their due date',
    source: 'system',
    defaultValue: 0,
  },
  upcoming_deadline_count: {
    name: 'Upcoming Deadlines',
    description: 'Number of deadlines in next 7 days',
    source: 'system',
    defaultValue: 0,
  },
  agent_error_count: {
    name: 'Agent Errors',
    description: 'Number of agents in error state',
    source: 'agent',
    defaultValue: 0,
  },
  agent_busy_count: {
    name: 'Busy Agents',
    description: 'Number of agents currently busy',
    source: 'agent',
    defaultValue: 0,
  },
  total_agent_invocations_24h: {
    name: 'Agent Invocations (24h)',
    description: 'Total agent invocations in last 24 hours',
    source: 'agent',
    defaultValue: 0,
  },
  pending_proposal_count: {
    name: 'Pending Proposals',
    description: 'Number of org-council proposals awaiting review',
    source: 'memory',
    defaultValue: 0,
  },
  total_memory_count: {
    name: 'Total Memories',
    description: 'Approximate total memories across all agents',
    source: 'memory',
    defaultValue: 0,
  },
};

// =============================================================================
// Metrics Collector Class
// =============================================================================

class MetricsCollectorImpl {
  private cache: Partial<CollectedMetrics> = {};
  private cacheExpiry: number = 0;
  private cacheTTL = 60000; // 1 minute cache

  /**
   * Collect all metrics
   */
  async collectAll(): Promise<CollectedMetrics> {
    const now = Date.now();

    // Return cached if still valid
    if (now < this.cacheExpiry && Object.keys(this.cache).length > 0) {
      return {
        ...this.getDefaultMetrics(),
        ...this.cache,
        collected_at: new Date(this.cacheExpiry - this.cacheTTL).toISOString(),
      };
    }

    // Collect fresh metrics
    const [whoopMetrics, systemMetrics, agentMetrics, memoryMetrics] = await Promise.all([
      this.collectWhoopMetrics(),
      this.collectSystemMetrics(),
      this.collectAgentMetrics(),
      this.collectMemoryMetrics(),
    ]);

    const metrics: CollectedMetrics = {
      ...this.getDefaultMetrics(),
      ...whoopMetrics,
      ...systemMetrics,
      ...agentMetrics,
      ...memoryMetrics,
      collected_at: new Date().toISOString(),
    };

    // Update cache
    this.cache = metrics;
    this.cacheExpiry = now + this.cacheTTL;

    return metrics;
  }

  /**
   * Get default metric values
   */
  private getDefaultMetrics(): CollectedMetrics {
    const defaults: any = { collected_at: new Date().toISOString() };
    for (const [key, def] of Object.entries(METRIC_DEFINITIONS)) {
      defaults[key] = def.defaultValue;
    }
    return defaults as CollectedMetrics;
  }

  /**
   * Collect WHOOP health metrics
   */
  private async collectWhoopMetrics(): Promise<Partial<CollectedMetrics>> {
    try {
      // Try to fetch from WHOOP API via existing integration
      const response = await fetch('http://localhost:4242/api/whoop/latest', {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          whoop_sleep_score: data.sleep?.score || data.sleepScore || 75,
          whoop_recovery: data.recovery?.score || data.recoveryScore || 60,
          whoop_strain: data.strain?.score || data.strainScore || 10,
          whoop_hrv: data.recovery?.hrv || data.hrv || 50,
          whoop_rhr: data.recovery?.rhr || data.rhr || 55,
        };
      }
    } catch (error) {
      // WHOOP API not available, use defaults
      console.debug('[MetricsCollector] WHOOP metrics unavailable');
    }

    return {};
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<Partial<CollectedMetrics>> {
    const metrics: Partial<CollectedMetrics> = {};

    try {
      // Get pending escalations from AgentInvoker
      const { agentInvoker } = await import('./AgentInvoker');
      const pending = agentInvoker.getPendingEscalations();
      metrics.pending_escalation_count = pending.length;
    } catch {
      metrics.pending_escalation_count = 0;
    }

    try {
      // Get upcoming deadlines (would integrate with task system)
      // For now, return 0
      metrics.overdue_task_count = 0;
      metrics.upcoming_deadline_count = 0;
    } catch {
      // Defaults
    }

    try {
      // Get unread email count (would integrate with Gmail)
      // For now, return 0
      metrics.unread_email_count = 0;
    } catch {
      // Defaults
    }

    return metrics;
  }

  /**
   * Collect agent metrics
   */
  private async collectAgentMetrics(): Promise<Partial<CollectedMetrics>> {
    const metrics: Partial<CollectedMetrics> = {};

    try {
      const { getUnifiedBus } = await import('./UnifiedBus');
      const bus = getUnifiedBus();
      const states = bus.getAllAgentStates();

      metrics.agent_error_count = states.filter(s => s.status === 'error').length;
      metrics.agent_busy_count = states.filter(s => s.status === 'busy').length;

      // Get recent activity count
      const recentActivity = bus.getRecentActivity(1000);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      metrics.total_agent_invocations_24h = recentActivity.filter(
        a => a.timestamp > oneDayAgo
      ).length;
    } catch {
      metrics.agent_error_count = 0;
      metrics.agent_busy_count = 0;
      metrics.total_agent_invocations_24h = 0;
    }

    return metrics;
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<Partial<CollectedMetrics>> {
    const metrics: Partial<CollectedMetrics> = {};

    try {
      const { getProposalCounts } = await import('../memory/zep');
      const counts = getProposalCounts();
      metrics.pending_proposal_count = counts.pending || 0;
      metrics.total_memory_count = counts.approved || 0;
    } catch {
      metrics.pending_proposal_count = 0;
      metrics.total_memory_count = 0;
    }

    return metrics;
  }

  /**
   * Get a single metric
   */
  async getMetric(name: keyof CollectedMetrics): Promise<number> {
    const all = await this.collectAll();
    return all[name] as number || METRIC_DEFINITIONS[name]?.defaultValue || 0;
  }

  /**
   * Get metric definitions
   */
  getDefinitions(): Record<string, MetricDefinition> {
    return METRIC_DEFINITIONS;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = {};
    this.cacheExpiry = 0;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let instance: MetricsCollectorImpl | null = null;

export function getMetricsCollector(): MetricsCollectorImpl {
  if (!instance) {
    instance = new MetricsCollectorImpl();
  }
  return instance;
}

export { MetricsCollectorImpl as MetricsCollector, METRIC_DEFINITIONS };
