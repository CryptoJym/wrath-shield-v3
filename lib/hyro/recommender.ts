/**
 * Hyro Agent Recommender
 *
 * Generates daily learning recommendations based on user progress and preferences
 */

import type {
  LearningItem,
  DailyRecommendation,
  TopicCategory,
  LearningProgress,
} from './types';
import {
  listLearningItems,
  getLearningProgress,
  createDailyRecommendation,
  getDailyRecommendation,
  updateLearningItem,
} from './store';

// ============================================================================
// Recommendation Engine
// ============================================================================

/**
 * Calculate priority score for a learning item
 * Higher score = higher priority
 */
function calculatePriorityScore(
  item: LearningItem,
  progress: LearningProgress,
  userPreferences?: { focus_topics?: TopicCategory[] }
): number {
  let score = 50; // Base score

  // Boost score if item matches user's focus topics
  if (userPreferences?.focus_topics) {
    const matchesFocus = item.topics.some(t => userPreferences.focus_topics?.includes(t));
    if (matchesFocus) score += 20;
  }

  // Adjust for difficulty relative to user's progress
  const totalCompleted = progress.completed_items;
  if (item.difficulty === 'beginner' && totalCompleted < 5) score += 15;
  if (item.difficulty === 'intermediate' && totalCompleted >= 5 && totalCompleted < 20) score += 15;
  if (item.difficulty === 'advanced' && totalCompleted >= 20) score += 15;

  // Boost recently published content
  if (item.published_at) {
    const daysSincePublished = (Date.now() / 1000 - item.published_at) / (60 * 60 * 24);
    if (daysSincePublished < 7) score += 10;
    else if (daysSincePublished < 30) score += 5;
  }

  // Penalize very long content (might be overwhelming)
  if (item.estimated_time_minutes && item.estimated_time_minutes > 120) {
    score -= 10;
  }

  // Boost high-confidence items
  score += item.confidence * 10;

  // Penalize if user has many incomplete items in same topic
  const topicInProgress = progress.by_category[item.topics[0]]?.total || 0;
  const topicCompleted = progress.by_category[item.topics[0]]?.completed || 0;
  const incompletionRate = topicInProgress > 0 ? (topicInProgress - topicCompleted) / topicInProgress : 0;
  if (incompletionRate > 0.5) score -= 15;

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine time slot for a learning item
 */
function determineTimeSlot(
  item: LearningItem
): 'morning' | 'afternoon' | 'evening' | 'anytime' {
  // Heuristics for time slot assignment
  if (!item.estimated_time_minutes) return 'anytime';

  // Short items (< 20 min) can be done anytime
  if (item.estimated_time_minutes < 20) return 'anytime';

  // Deep learning (papers, long videos) - morning when mind is fresh
  if (item.difficulty === 'advanced' || item.difficulty === 'expert') {
    return 'morning';
  }

  // Technical programming - morning or afternoon
  if (item.topics.includes('programming') || item.topics.includes('engineering')) {
    return 'afternoon';
  }

  // Lighter content - evening
  if (item.topics.includes('business') || item.topics.includes('productivity')) {
    return 'evening';
  }

  return 'anytime';
}

/**
 * Generate rationale for why an item is recommended
 */
function generateRationale(item: LearningItem, progress: LearningProgress): string {
  const reasons: string[] = [];

  // Based on difficulty and progress
  const totalCompleted = progress.completed_items;
  if (item.difficulty === 'beginner' && totalCompleted < 5) {
    reasons.push('Good introductory content for building foundations');
  } else if (item.difficulty === 'intermediate' && totalCompleted >= 5) {
    reasons.push('Intermediate content to deepen your understanding');
  } else if (item.difficulty === 'advanced' && totalCompleted >= 20) {
    reasons.push('Advanced content to push your expertise');
  }

  // Based on recency
  if (item.published_at) {
    const daysSincePublished = (Date.now() / 1000 - item.published_at) / (60 * 60 * 24);
    if (daysSincePublished < 7) {
      reasons.push('Recently published content');
    }
  }

  // Based on time estimate
  if (item.estimated_time_minutes && item.estimated_time_minutes < 30) {
    reasons.push('Quick read/watch that fits easily into your schedule');
  }

  // Based on topic engagement
  const topicStats = progress.by_category[item.topics[0]];
  if (topicStats && topicStats.completed > 0) {
    reasons.push(`You've completed ${topicStats.completed} items in ${item.topics[0]}`);
  }

  // Default reason
  if (reasons.length === 0) {
    reasons.push('Quality content aligned with your learning goals');
  }

  return reasons.join(' • ');
}

/**
 * Generate daily recommendations for a user
 */
export async function generateDailyRecommendations(
  user_id: string,
  options?: {
    max_items?: number;
    target_time_minutes?: number;
    focus_topics?: TopicCategory[];
  }
): Promise<DailyRecommendation> {
  const today = new Date().toISOString().split('T')[0];

  // Check if we already have recommendations for today
  const existing = getDailyRecommendation(user_id, today);
  if (existing) {
    return existing;
  }

  // Get user progress
  const progress = getLearningProgress(user_id);

  // Get pending learning items
  const pendingItems = listLearningItems({
    user_id,
    status: 'pending',
    limit: 100,
  });

  // Calculate priority scores and update items
  for (const item of pendingItems) {
    const priorityScore = calculatePriorityScore(item, progress, options);
    updateLearningItem(item.id, { priority_score: priorityScore });
  }

  // Re-fetch with updated scores
  const scoredItems = listLearningItems({
    user_id,
    status: 'pending',
    limit: 50, // Get top 50
  }).sort((a, b) => b.priority_score - a.priority_score);

  // Select items for today's recommendations
  const maxItems = options?.max_items || 5;
  const targetTime = options?.target_time_minutes || 120; // 2 hours default

  const selectedItems: LearningItem[] = [];
  let totalTime = 0;

  for (const item of scoredItems) {
    if (selectedItems.length >= maxItems) break;

    const itemTime = item.estimated_time_minutes || 30;
    if (totalTime + itemTime <= targetTime || selectedItems.length === 0) {
      selectedItems.push(item);
      totalTime += itemTime;
    }
  }

  // Determine daily focus topic based on least-completed category
  let focusTopic: TopicCategory | undefined;
  let focusDescription: string | undefined;

  const categoryScores = Object.entries(progress.by_category)
    .filter(([_, stats]) => stats.total > 0)
    .map(([cat, stats]) => ({
      category: cat as TopicCategory,
      completionRate: stats.completed / stats.total,
      total: stats.total,
    }))
    .sort((a, b) => a.completionRate - b.completionRate);

  if (categoryScores.length > 0) {
    focusTopic = categoryScores[0].category;
    focusDescription = `Continue building knowledge in ${focusTopic.replace('_', ' ')}`;
  } else if (options?.focus_topics && options.focus_topics.length > 0) {
    focusTopic = options.focus_topics[0];
    focusDescription = `Start exploring ${focusTopic.replace('_', ' ')}`;
  }

  // Build recommendation items
  const recItems = selectedItems.map((item, index) => ({
    item_id: item.id,
    item_title: item.title,
    item_source: item.source,
    rationale: generateRationale(item, progress),
    priority: selectedItems.length - index, // Higher index = higher priority
    time_slot: determineTimeSlot(item),
  }));

  // Create daily recommendation
  const recommendation = createDailyRecommendation({
    user_id,
    date: today,
    items: recItems,
    focus_topic: focusTopic,
    focus_description: focusDescription,
    accepted_count: 0,
    completed_count: 0,
    total_time_minutes: totalTime,
  });

  return recommendation;
}

/**
 * Mark a recommendation item as accepted (user wants to do it)
 */
export function acceptRecommendationItem(
  rec_id: string,
  item_id: string
): DailyRecommendation | null {
  // In a real implementation, would update the recommendation
  // and potentially schedule the learning item
  return null;
}

/**
 * Mark a recommendation item as completed
 */
export function completeRecommendationItem(
  rec_id: string,
  item_id: string
): DailyRecommendation | null {
  // Update the learning item to completed
  updateLearningItem(item_id, {
    status: 'completed',
    progress_percent: 100,
    completed_at: Math.floor(Date.now() / 1000),
  });

  // Update recommendation stats
  // In a real implementation, would increment completed_count
  return null;
}

/**
 * Get recommended time budget for learning based on recent activity
 */
export function getRecommendedTimeBudget(progress: LearningProgress): number {
  // Base time budget: 60 minutes
  let budget = 60;

  // Increase if user is on a streak
  if (progress.current_streak_days > 7) {
    budget += 30;
  } else if (progress.current_streak_days > 3) {
    budget += 15;
  }

  // Adjust based on recent completion rate
  if (progress.items_completed_this_week >= 5) {
    budget += 30; // User is engaged, give more
  } else if (progress.items_completed_this_week === 0) {
    budget = 30; // Start small to rebuild habit
  }

  return Math.min(180, budget); // Cap at 3 hours
}
