/**
 * Agent Health Monitoring System
 *
 * Provides real-time health status for all agents based on:
 * - Last activity timestamp (from agent activity log)
 * - Zep memory latency (can agent access its memory?)
 * - Recent error count
 * - Token usage trend
 * - Response latency average
 *
 * Health Status Levels:
 * - 'healthy' (green) - Active in last 5 min, no errors
 * - 'idle' (blue) - No activity in 5-60 min, no errors
 * - 'degraded' (amber) - Errors or high latency
 * - 'offline' (red) - No activity >1 hour or memory unavailable
 */

import { ensureServerOnly } from '../server-only-guard';
import { agentInvoker, type AgentActivity } from './AgentInvoker';
import type { AgentId } from '../memory/zep';

ensureServerOnly('lib/agents/health');

// Health status types
export type HealthStatus = 'healthy' | 'idle' | 'degraded' | 'offline';

export interface AgentHealthMetrics {
  agentId: string;
  zepAgentId: AgentId;
  status: HealthStatus;
  lastActivityTimestamp: number | null;
  lastActivityAgo: string;
  memoryStatus: 'connected' | 'latent' | 'unavailable';
  memoryLatencyMs: number | null;
  recentErrorCount: number;
  totalRecentCalls: number;
  avgTokenUsage: number;
  avgResponseLatencyMs: number;
  errorRate: number;
  tokenUsageTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  healthScore: number; // 0-100
}

export interface SquadHealthSummary {
  timestamp: string;
  agents: AgentHealthMetrics[];
  squadHealthScore: number; // 0-100
  activeAgents: number;
  idleAgents: number;
  degradedAgents: number;
  offlineAgents: number;
  totalMemoryLatencyMs: number;
  avgMemoryLatencyMs: number;
}

// Time thresholds in milliseconds
const THRESHOLDS = {
  HEALTHY_MAX_AGE: 5 * 60 * 1000,      // 5 minutes
  IDLE_MAX_AGE: 60 * 60 * 1000,        // 1 hour
  HIGH_LATENCY: 2000,                   // 2 seconds
  HIGH_ERROR_RATE: 0.1,                 // 10%
  MEMORY_TIMEOUT: 5000,                 // 5 second timeout for memory check
};

/**
 * Map Life OS agent IDs to Zep agent IDs
 */
const LIFE_OS_TO_ZEP_ID: Record<string, AgentId> = {
  'agent.orchestrator': 'orchestrator-agent',
  'agent.orchestrator.interface': 'orchestrator-agent',
  'agent.legal': 'legal-agent',
  'agent.finance': 'finance-agent',
  'agent.pm': 'pm-agent',
  'agent.comms': 'comms-agent',
  'agent.health': 'health-agent',
  'agent.coaching': 'coaching-agent',
  'agent.hyro.education': 'hyro-agent',
  'agent.james.learning': 'learning-agent',
  'agent.grok': 'orchestrator-agent',
  'agent.sherlock': 'sherlock-agent',
  'agent.ea': 'ea-agent',
  'agent.relationships': 'relationships-agent',
  'agent.eeg': 'eeg-agent',
};

/**
 * Convert Life OS agent ID to Zep agent ID
 */
function toZepAgentId(lifeOsAgentId: string): AgentId {
  return LIFE_OS_TO_ZEP_ID[lifeOsAgentId] || 'orchestrator-agent';
}

/**
 * Format time ago string
 */
function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60 * 1000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`;
}

/**
 * Calculate token usage trend from recent activity
 */
function calculateTokenTrend(activities: AgentActivity[]): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
  if (activities.length < 4) return 'unknown';

  const halfPoint = Math.floor(activities.length / 2);
  const recentHalf = activities.slice(0, halfPoint);
  const olderHalf = activities.slice(halfPoint);

  const recentAvg = recentHalf.reduce((sum, a) => sum + a.tokensUsed, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((sum, a) => sum + a.tokensUsed, 0) / olderHalf.length;

  const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (percentChange > 15) return 'increasing';
  if (percentChange < -15) return 'decreasing';
  return 'stable';
}

/**
 * Check Zep memory availability for an agent
 * Returns latency in ms, or null if unavailable
 */
async function checkMemoryLatency(agentId: AgentId): Promise<{ available: boolean; latencyMs: number | null }> {
  try {
    const startTime = performance.now();

    // Dynamic import to avoid circular deps and allow graceful fallback
    const { searchAgentMemory } = await import('../memory/zep');

    // Simple search to test connectivity - with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Memory check timeout')), THRESHOLDS.MEMORY_TIMEOUT);
    });

    await Promise.race([
      searchAgentMemory(agentId, 'health-check', 1),
      timeoutPromise
    ]);

    const latencyMs = Math.round(performance.now() - startTime);
    return { available: true, latencyMs };
  } catch (error) {
    console.warn(`[AgentHealth] Memory check failed for ${agentId}:`, error instanceof Error ? error.message : 'Unknown error');
    return { available: false, latencyMs: null };
  }
}

/**
 * Determine health status based on metrics
 */
function determineHealthStatus(
  lastActivityTimestamp: number | null,
  errorRate: number,
  avgLatency: number,
  memoryAvailable: boolean
): HealthStatus {
  const now = Date.now();
  const activityAge = lastActivityTimestamp ? now - lastActivityTimestamp : Infinity;

  // Offline: No activity >1 hour OR memory unavailable
  if (activityAge > THRESHOLDS.IDLE_MAX_AGE || !memoryAvailable) {
    return 'offline';
  }

  // Degraded: High error rate or high latency
  if (errorRate > THRESHOLDS.HIGH_ERROR_RATE || avgLatency > THRESHOLDS.HIGH_LATENCY) {
    return 'degraded';
  }

  // Idle: No activity in 5-60 min
  if (activityAge > THRESHOLDS.HEALTHY_MAX_AGE) {
    return 'idle';
  }

  // Healthy: Active in last 5 min, low errors
  return 'healthy';
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(
  status: HealthStatus,
  errorRate: number,
  avgLatency: number,
  memoryLatency: number | null
): number {
  let score = 100;

  // Base deductions by status
  switch (status) {
    case 'offline': score -= 60; break;
    case 'degraded': score -= 30; break;
    case 'idle': score -= 10; break;
    case 'healthy': break;
  }

  // Error rate deduction (max 20 points)
  score -= Math.min(20, errorRate * 100);

  // Latency deduction (max 10 points)
  if (avgLatency > 1000) {
    score -= Math.min(10, ((avgLatency - 1000) / 1000) * 5);
  }

  // Memory latency deduction (max 10 points)
  if (memoryLatency && memoryLatency > 500) {
    score -= Math.min(10, ((memoryLatency - 500) / 500) * 5);
  }

  return Math.max(0, Math.round(score));
}

/**
 * Get health metrics for a specific agent
 */
export async function getAgentHealth(agentId: string): Promise<AgentHealthMetrics> {
  const zepAgentId = toZepAgentId(agentId);

  // Get recent activity from the invoker
  const recentActivity = agentInvoker.getAgentActivity(agentId, 50);

  // Calculate metrics from activity
  const lastActivityTimestamp = recentActivity.length > 0 ? recentActivity[0].timestamp : null;
  const recentErrorCount = recentActivity.filter(a => !a.wasExecuted && a.escalationLevel !== 'AUTO_EXECUTE').length;
  const totalRecentCalls = recentActivity.length;
  const errorRate = totalRecentCalls > 0 ? recentErrorCount / totalRecentCalls : 0;

  const avgTokenUsage = totalRecentCalls > 0
    ? Math.round(recentActivity.reduce((sum, a) => sum + a.tokensUsed, 0) / totalRecentCalls)
    : 0;

  const avgResponseLatencyMs = totalRecentCalls > 0
    ? Math.round(recentActivity.reduce((sum, a) => sum + a.latencyMs, 0) / totalRecentCalls)
    : 0;

  const tokenUsageTrend = calculateTokenTrend(recentActivity);

  // Check memory connectivity
  const memoryCheck = await checkMemoryLatency(zepAgentId);
  const memoryStatus: 'connected' | 'latent' | 'unavailable' =
    memoryCheck.available
      ? (memoryCheck.latencyMs && memoryCheck.latencyMs > 1000 ? 'latent' : 'connected')
      : 'unavailable';

  // Determine overall status
  const status = determineHealthStatus(
    lastActivityTimestamp,
    errorRate,
    avgResponseLatencyMs,
    memoryCheck.available
  );

  // Calculate health score
  const healthScore = calculateHealthScore(
    status,
    errorRate,
    avgResponseLatencyMs,
    memoryCheck.latencyMs
  );

  return {
    agentId,
    zepAgentId,
    status,
    lastActivityTimestamp,
    lastActivityAgo: formatTimeAgo(lastActivityTimestamp),
    memoryStatus,
    memoryLatencyMs: memoryCheck.latencyMs,
    recentErrorCount,
    totalRecentCalls,
    avgTokenUsage,
    avgResponseLatencyMs,
    errorRate,
    tokenUsageTrend,
    healthScore,
  };
}

/**
 * Get health metrics for all registered agents
 */
export async function getSquadHealth(): Promise<SquadHealthSummary> {
  const agentIds = Object.keys(LIFE_OS_TO_ZEP_ID);

  // Fetch health for all agents in parallel
  const healthPromises = agentIds.map(id => getAgentHealth(id).catch(err => {
    console.error(`[AgentHealth] Failed to get health for ${id}:`, err);
    // Return offline status on error
    return {
      agentId: id,
      zepAgentId: toZepAgentId(id),
      status: 'offline' as HealthStatus,
      lastActivityTimestamp: null,
      lastActivityAgo: 'Error',
      memoryStatus: 'unavailable' as const,
      memoryLatencyMs: null,
      recentErrorCount: 0,
      totalRecentCalls: 0,
      avgTokenUsage: 0,
      avgResponseLatencyMs: 0,
      errorRate: 0,
      tokenUsageTrend: 'unknown' as const,
      healthScore: 0,
    };
  }));

  const agents = await Promise.all(healthPromises);

  // Calculate summary stats
  const activeAgents = agents.filter(a => a.status === 'healthy').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;
  const degradedAgents = agents.filter(a => a.status === 'degraded').length;
  const offlineAgents = agents.filter(a => a.status === 'offline').length;

  const memoryLatencies = agents
    .filter(a => a.memoryLatencyMs !== null)
    .map(a => a.memoryLatencyMs as number);

  const totalMemoryLatencyMs = memoryLatencies.reduce((sum, l) => sum + l, 0);
  const avgMemoryLatencyMs = memoryLatencies.length > 0
    ? Math.round(totalMemoryLatencyMs / memoryLatencies.length)
    : 0;

  // Calculate squad health score (weighted average)
  const squadHealthScore = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.healthScore, 0) / agents.length)
    : 0;

  return {
    timestamp: new Date().toISOString(),
    agents,
    squadHealthScore,
    activeAgents,
    idleAgents,
    degradedAgents,
    offlineAgents,
    totalMemoryLatencyMs,
    avgMemoryLatencyMs,
  };
}

/**
 * Get health for a specific set of agents
 */
export async function getAgentsHealth(agentIds: string[]): Promise<AgentHealthMetrics[]> {
  const healthPromises = agentIds.map(id => getAgentHealth(id));
  return Promise.all(healthPromises);
}

/**
 * Quick health check - returns basic status without memory latency check
 * Useful for frequent polling
 */
export function getQuickAgentHealth(agentId: string): Omit<AgentHealthMetrics, 'memoryLatencyMs' | 'memoryStatus'> & { memoryStatus: 'unknown' } {
  const zepAgentId = toZepAgentId(agentId);
  const recentActivity = agentInvoker.getAgentActivity(agentId, 50);

  const lastActivityTimestamp = recentActivity.length > 0 ? recentActivity[0].timestamp : null;
  const recentErrorCount = recentActivity.filter(a => !a.wasExecuted && a.escalationLevel !== 'AUTO_EXECUTE').length;
  const totalRecentCalls = recentActivity.length;
  const errorRate = totalRecentCalls > 0 ? recentErrorCount / totalRecentCalls : 0;

  const avgTokenUsage = totalRecentCalls > 0
    ? Math.round(recentActivity.reduce((sum, a) => sum + a.tokensUsed, 0) / totalRecentCalls)
    : 0;

  const avgResponseLatencyMs = totalRecentCalls > 0
    ? Math.round(recentActivity.reduce((sum, a) => sum + a.latencyMs, 0) / totalRecentCalls)
    : 0;

  const tokenUsageTrend = calculateTokenTrend(recentActivity);

  // Determine status without memory check (assume available for quick check)
  const status = determineHealthStatus(lastActivityTimestamp, errorRate, avgResponseLatencyMs, true);
  const healthScore = calculateHealthScore(status, errorRate, avgResponseLatencyMs, null);

  return {
    agentId,
    zepAgentId,
    status,
    lastActivityTimestamp,
    lastActivityAgo: formatTimeAgo(lastActivityTimestamp),
    memoryStatus: 'unknown' as const,
    recentErrorCount,
    totalRecentCalls,
    avgTokenUsage,
    avgResponseLatencyMs,
    errorRate,
    tokenUsageTrend,
    healthScore,
  };
}
