/**
 * Feedback Collection System
 * Collects user feedback on agent responses for continuous improvement
 */

import { getEventBus, createNotificationEvent } from '@/lib/agents/life-os-event-bus';

export interface AgentFeedback {
  id: string;
  agentId: string;
  responseId: string;
  rating: 'helpful' | 'somewhat_helpful' | 'not_helpful';
  category?: 'accuracy' | 'relevance' | 'speed' | 'tone' | 'completeness';
  comment?: string;
  timestamp: Date;
  context?: {
    taskType?: string;
    domain?: string;
    userIntent?: string;
  };
}

export interface LearningMetric {
  agentId: string;
  metric: string;
  value: number;
  trend: 'improving' | 'stable' | 'declining';
  sampleSize: number;
  period: 'day' | 'week' | 'month';
}

class FeedbackCollector {
  private feedbackStore: AgentFeedback[] = [];
  private maxStoreSize = 10000;

  /**
   * Record feedback for an agent response
   */
  async recordFeedback(feedback: Omit<AgentFeedback, 'id' | 'timestamp'>): Promise<string> {
    const id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullFeedback: AgentFeedback = {
      ...feedback,
      id,
      timestamp: new Date()
    };

    this.feedbackStore.push(fullFeedback);

    // Trim store if needed
    if (this.feedbackStore.length > this.maxStoreSize) {
      this.feedbackStore = this.feedbackStore.slice(-this.maxStoreSize);
    }

    // Emit feedback event for learning systems
    const eventBus = getEventBus();
    await eventBus.publish(createNotificationEvent(
      'feedback-collector',
      fullFeedback,
      'learning' as any,  // domain
      'low'  // priority
    ));

    console.log(`[Feedback] Recorded for ${feedback.agentId}: ${feedback.rating}`);
    return id;
  }

  /**
   * Get feedback statistics for an agent
   */
  getAgentStats(agentId: string, period: 'day' | 'week' | 'month' = 'week'): {
    totalFeedback: number;
    helpfulRate: number;
    topIssues: string[];
    trend: 'improving' | 'stable' | 'declining';
  } {
    const now = new Date();
    const periodMs = period === 'day' ? 86400000 : period === 'week' ? 604800000 : 2592000000;
    const cutoff = new Date(now.getTime() - periodMs);

    const relevant = this.feedbackStore.filter(
      f => f.agentId === agentId && f.timestamp >= cutoff
    );

    if (relevant.length === 0) {
      return { totalFeedback: 0, helpfulRate: 0, topIssues: [], trend: 'stable' };
    }

    const helpful = relevant.filter(f => f.rating === 'helpful').length;
    const helpfulRate = helpful / relevant.length;

    // Analyze categories
    const categoryCounts = new Map<string, number>();
    for (const f of relevant) {
      if (f.category && f.rating !== 'helpful') {
        categoryCounts.set(f.category, (categoryCounts.get(f.category) || 0) + 1);
      }
    }

    const topIssues = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // Simple trend calculation
    const midpoint = new Date(cutoff.getTime() + periodMs / 2);
    const firstHalf = relevant.filter(f => f.timestamp < midpoint);
    const secondHalf = relevant.filter(f => f.timestamp >= midpoint);

    const firstRate = firstHalf.length > 0
      ? firstHalf.filter(f => f.rating === 'helpful').length / firstHalf.length
      : 0;
    const secondRate = secondHalf.length > 0
      ? secondHalf.filter(f => f.rating === 'helpful').length / secondHalf.length
      : 0;

    const trend = secondRate > firstRate + 0.05 ? 'improving'
      : secondRate < firstRate - 0.05 ? 'declining'
      : 'stable';

    return { totalFeedback: relevant.length, helpfulRate, topIssues, trend };
  }

  /**
   * Get learning metrics for all agents
   */
  getAllAgentMetrics(): LearningMetric[] {
    const agentIds = new Set(this.feedbackStore.map(f => f.agentId));
    const metrics: LearningMetric[] = [];

    for (const agentId of agentIds) {
      const stats = this.getAgentStats(agentId, 'week');
      metrics.push({
        agentId,
        metric: 'helpful_rate',
        value: stats.helpfulRate,
        trend: stats.trend,
        sampleSize: stats.totalFeedback,
        period: 'week'
      });
    }

    return metrics;
  }
}

// Singleton
let collectorInstance: FeedbackCollector | null = null;

export function getFeedbackCollector(): FeedbackCollector {
  if (!collectorInstance) {
    collectorInstance = new FeedbackCollector();
  }
  return collectorInstance;
}
