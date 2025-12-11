/**
 * Adaptive Router
 * Learns which agents handle which tasks best based on feedback
 */

import { getFeedbackCollector } from './feedback-collector';
import { getEventBus, createNotificationEvent } from '@/lib/agents/life-os-event-bus';

export interface TaskPattern {
  domain: string;
  taskType: string;
  keywords: string[];
  userIntent?: string;
}

export interface AgentPerformance {
  agentId: string;
  successRate: number;
  avgResponseTime?: number;
  totalHandled: number;
  recentTrend: 'improving' | 'stable' | 'declining';
  strengths: string[];
  weaknesses: string[];
}

export interface RoutingRecommendation {
  agentId: string;
  confidence: number;
  reason: string;
  alternatives?: Array<{ agentId: string; confidence: number }>;
}

class AdaptiveRouter {
  private routingHistory: Map<string, { agentId: string; success: boolean; timestamp: Date }[]> = new Map();
  private performanceCache: Map<string, AgentPerformance> = new Map();
  private cacheExpiry = 300000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Recommend the best agent for a given task pattern
   */
  async recommendAgent(pattern: TaskPattern): Promise<RoutingRecommendation> {
    await this.updatePerformanceCache();

    const candidates = this.findCandidateAgents(pattern);

    if (candidates.length === 0) {
      // No historical data, use default routing
      return {
        agentId: 'orchestrator', // Default fallback
        confidence: 0.5,
        reason: 'No historical performance data available, using default routing'
      };
    }

    // Score candidates based on performance and relevance
    const scored = candidates.map(perf => ({
      agentId: perf.agentId,
      score: this.scoreAgent(perf, pattern)
    })).sort((a, b) => b.score - a.score);

    const best = scored[0];
    const alternatives = scored.slice(1, 3).map(s => ({
      agentId: s.agentId,
      confidence: s.score
    }));

    const performance = this.performanceCache.get(best.agentId)!;
    const reason = this.generateRecommendationReason(performance, pattern);

    // Emit routing decision for learning
    const eventBus = getEventBus();
    await eventBus.publish(createNotificationEvent(
      'adaptive-router',
      {
        pattern,
        recommendation: best.agentId,
        confidence: best.score,
        alternatives
      },
      'learning' as any,  // domain
      'low'  // priority
    ));

    return {
      agentId: best.agentId,
      confidence: best.score,
      reason,
      alternatives: alternatives.length > 0 ? alternatives : undefined
    };
  }

  /**
   * Record the outcome of a routing decision
   */
  async recordRoutingOutcome(
    pattern: TaskPattern,
    agentId: string,
    success: boolean
  ): Promise<void> {
    const key = this.patternToKey(pattern);
    const history = this.routingHistory.get(key) || [];

    history.push({
      agentId,
      success,
      timestamp: new Date()
    });

    // Keep last 100 entries per pattern
    if (history.length > 100) {
      history.shift();
    }

    this.routingHistory.set(key, history);

    // Invalidate cache
    this.lastCacheUpdate = 0;

    console.log(`[Adaptive Router] Recorded ${success ? 'success' : 'failure'} for ${agentId} on ${key}`);
  }

  /**
   * Get performance analysis for all agents
   */
  async getAgentPerformanceReport(): Promise<AgentPerformance[]> {
    await this.updatePerformanceCache();
    return Array.from(this.performanceCache.values())
      .sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Find candidate agents based on historical performance
   */
  private findCandidateAgents(pattern: TaskPattern): AgentPerformance[] {
    const candidates: AgentPerformance[] = [];

    // Check exact pattern match
    const key = this.patternToKey(pattern);
    const exactHistory = this.routingHistory.get(key);
    if (exactHistory && exactHistory.length > 0) {
      const agentIds = new Set(exactHistory.map(h => h.agentId));
      for (const agentId of agentIds) {
        const perf = this.performanceCache.get(agentId);
        if (perf) {
          candidates.push(perf);
        }
      }
    }

    // If no exact matches, look for similar patterns (same domain)
    if (candidates.length === 0) {
      for (const [histKey, history] of this.routingHistory.entries()) {
        if (histKey.includes(pattern.domain) && history.length > 0) {
          const agentIds = new Set(history.map(h => h.agentId));
          for (const agentId of agentIds) {
            const perf = this.performanceCache.get(agentId);
            if (perf && !candidates.find(c => c.agentId === agentId)) {
              candidates.push(perf);
            }
          }
        }
      }
    }

    // Fallback to all agents with performance data
    if (candidates.length === 0) {
      return Array.from(this.performanceCache.values());
    }

    return candidates;
  }

  /**
   * Score an agent for a given pattern
   */
  private scoreAgent(performance: AgentPerformance, pattern: TaskPattern): number {
    let score = performance.successRate;

    // Boost for recent improvement
    if (performance.recentTrend === 'improving') {
      score += 0.1;
    } else if (performance.recentTrend === 'declining') {
      score -= 0.1;
    }

    // Boost for domain strength match
    const domainStrength = performance.strengths.includes(pattern.domain);
    if (domainStrength) {
      score += 0.15;
    }

    // Penalize for domain weakness
    const domainWeakness = performance.weaknesses.includes(pattern.domain);
    if (domainWeakness) {
      score -= 0.15;
    }

    // Boost for sufficient sample size
    if (performance.totalHandled > 10) {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
  }

  /**
   * Generate human-readable recommendation reason
   */
  private generateRecommendationReason(
    performance: AgentPerformance,
    pattern: TaskPattern
  ): string {
    const parts: string[] = [];

    parts.push(`${(performance.successRate * 100).toFixed(0)}% success rate`);

    if (performance.strengths.includes(pattern.domain)) {
      parts.push(`strong in ${pattern.domain}`);
    }

    if (performance.recentTrend === 'improving') {
      parts.push('improving trend');
    }

    parts.push(`${performance.totalHandled} tasks handled`);

    return parts.join(', ');
  }

  /**
   * Update performance cache from feedback data
   */
  private async updatePerformanceCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate < this.cacheExpiry) {
      return; // Cache still valid
    }

    const collector = getFeedbackCollector();
    const metrics = collector.getAllAgentMetrics();

    // Build performance profiles
    this.performanceCache.clear();

    for (const metric of metrics) {
      const agentStats = collector.getAgentStats(metric.agentId, 'week');

      const strengths: string[] = [];
      const weaknesses = agentStats.topIssues;

      // Analyze routing history for strengths
      for (const [key, history] of this.routingHistory.entries()) {
        const agentHistory = history.filter(h => h.agentId === metric.agentId);
        if (agentHistory.length > 5) {
          const successRate = agentHistory.filter(h => h.success).length / agentHistory.length;
          if (successRate > 0.75) {
            const domain = key.split(':')[0];
            if (!strengths.includes(domain)) {
              strengths.push(domain);
            }
          }
        }
      }

      const performance: AgentPerformance = {
        agentId: metric.agentId,
        successRate: metric.value,
        totalHandled: metric.sampleSize,
        recentTrend: metric.trend,
        strengths,
        weaknesses
      };

      this.performanceCache.set(metric.agentId, performance);
    }

    this.lastCacheUpdate = now;
    console.log(`[Adaptive Router] Updated performance cache for ${this.performanceCache.size} agents`);
  }

  /**
   * Convert task pattern to a routing key
   */
  private patternToKey(pattern: TaskPattern): string {
    return `${pattern.domain}:${pattern.taskType}`;
  }
}

// Singleton
let routerInstance: AdaptiveRouter | null = null;

export function getAdaptiveRouter(): AdaptiveRouter {
  if (!routerInstance) {
    routerInstance = new AdaptiveRouter();
  }
  return routerInstance;
}
