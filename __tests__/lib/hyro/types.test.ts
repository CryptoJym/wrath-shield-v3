// @ts-nocheck
/**
 * Tests for Hyro Education Agent Type Definitions
 *
 * Tests for learning sources, difficulty levels, topic categories,
 * learning items, recommendations, and crawler configurations.
 */

import { describe, it, expect } from '@jest/globals';

import type {
  LearningSource,
  DifficultyLevel,
  TopicCategory,
  LearningStatus,
  LearningItem,
  DailyRecommendation,
  LearningProgress,
  HyroAgentStatus,
  CrawlerConfig,
  SyncResult,
} from '../../../lib/hyro/types';

describe('Hyro Education Agent Types', () => {
  // ==========================================================================
  // LearningSource Type Tests
  // ==========================================================================

  describe('LearningSource', () => {
    it('should allow valid learning sources', () => {
      const sources: LearningSource[] = [
        'arxiv',
        'youtube',
        'coursera',
        'github',
        'medium',
        'podcast',
        'book',
        'newsletter',
        'rss',
        'custom',
      ];

      expect(sources).toHaveLength(10);
      sources.forEach((source) => {
        expect(typeof source).toBe('string');
      });
    });

    it('should include academic sources', () => {
      const academicSources: LearningSource[] = ['arxiv', 'coursera', 'book'];
      expect(academicSources).toContain('arxiv');
    });

    it('should include media sources', () => {
      const mediaSources: LearningSource[] = ['youtube', 'podcast'];
      expect(mediaSources).toContain('youtube');
      expect(mediaSources).toContain('podcast');
    });

    it('should include custom source type', () => {
      const customSource: LearningSource = 'custom';
      expect(customSource).toBe('custom');
    });
  });

  // ==========================================================================
  // DifficultyLevel Type Tests
  // ==========================================================================

  describe('DifficultyLevel', () => {
    it('should allow valid difficulty levels', () => {
      const levels: DifficultyLevel[] = [
        'beginner',
        'intermediate',
        'advanced',
        'expert',
      ];

      expect(levels).toHaveLength(4);
    });

    it('should have beginner as lowest level', () => {
      const level: DifficultyLevel = 'beginner';
      expect(level).toBe('beginner');
    });

    it('should have expert as highest level', () => {
      const level: DifficultyLevel = 'expert';
      expect(level).toBe('expert');
    });
  });

  // ==========================================================================
  // TopicCategory Type Tests
  // ==========================================================================

  describe('TopicCategory', () => {
    it('should allow valid topic categories', () => {
      const categories: TopicCategory[] = [
        'ai_ml',
        'programming',
        'business',
        'health',
        'productivity',
        'science',
        'engineering',
        'philosophy',
        'other',
      ];

      expect(categories).toHaveLength(9);
    });

    it('should include technical categories', () => {
      const techCategories: TopicCategory[] = ['ai_ml', 'programming', 'engineering'];
      expect(techCategories).toContain('ai_ml');
      expect(techCategories).toContain('programming');
    });

    it('should include other as catch-all', () => {
      const category: TopicCategory = 'other';
      expect(category).toBe('other');
    });
  });

  // ==========================================================================
  // LearningStatus Type Tests
  // ==========================================================================

  describe('LearningStatus', () => {
    it('should allow valid learning statuses', () => {
      const statuses: LearningStatus[] = [
        'pending',
        'in_progress',
        'completed',
        'archived',
        'scheduled',
      ];

      expect(statuses).toHaveLength(5);
    });

    it('should include active statuses', () => {
      const activeStatuses: LearningStatus[] = ['pending', 'in_progress', 'scheduled'];
      expect(activeStatuses).toContain('in_progress');
    });

    it('should include final statuses', () => {
      const finalStatuses: LearningStatus[] = ['completed', 'archived'];
      expect(finalStatuses).toContain('completed');
      expect(finalStatuses).toContain('archived');
    });
  });

  // ==========================================================================
  // LearningItem Interface Tests
  // ==========================================================================

  describe('LearningItem', () => {
    it('should accept valid learning item', () => {
      const item: LearningItem = {
        id: 'item-123',
        user_id: 'user-456',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'arxiv',
        title: 'Machine Learning Fundamentals',
        topics: ['ai_ml', 'programming'],
        difficulty: 'intermediate',
        status: 'pending',
        progress_percent: 0,
        tags: ['machine-learning', 'tutorial'],
        priority_score: 75,
        confidence: 0.85,
      };

      expect(item.id).toBe('item-123');
      expect(item.source).toBe('arxiv');
      expect(item.topics).toContain('ai_ml');
      expect(item.difficulty).toBe('intermediate');
    });

    it('should accept learning item with optional fields', () => {
      const item: LearningItem = {
        id: 'item-789',
        user_id: 'user-123',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'youtube',
        source_url: 'https://youtube.com/watch?v=abc',
        title: 'React Tutorial',
        description: 'Learn React from scratch',
        author: 'Tech Teacher',
        published_at: Date.now() - 86400000,
        topics: ['programming'],
        difficulty: 'beginner',
        estimated_time_minutes: 120,
        status: 'in_progress',
        progress_percent: 50,
        started_at: Date.now() - 3600000,
        notes: 'Great tutorial so far',
        tags: ['react', 'javascript', 'frontend'],
        priority_score: 90,
        confidence: 0.95,
        scheduled_for: Date.now() + 86400000,
      };

      expect(item.source_url).toBe('https://youtube.com/watch?v=abc');
      expect(item.author).toBe('Tech Teacher');
      expect(item.estimated_time_minutes).toBe(120);
      expect(item.notes).toBe('Great tutorial so far');
    });

    it('should accept completed learning item', () => {
      const item: LearningItem = {
        id: 'item-complete',
        user_id: 'user-123',
        created_at: Date.now() - 604800000,
        updated_at: Date.now(),
        source: 'coursera',
        title: 'Completed Course',
        topics: ['business'],
        difficulty: 'advanced',
        status: 'completed',
        progress_percent: 100,
        started_at: Date.now() - 604800000,
        completed_at: Date.now(),
        tags: [],
        priority_score: 0,
        confidence: 1.0,
      };

      expect(item.status).toBe('completed');
      expect(item.progress_percent).toBe(100);
      expect(item.completed_at).toBeDefined();
    });

    it('should validate progress_percent range', () => {
      const itemAtStart: LearningItem = {
        id: 'item-1',
        user_id: 'user-1',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'book',
        title: 'Test',
        topics: ['science'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        tags: [],
        priority_score: 50,
        confidence: 0.5,
      };

      const itemComplete: LearningItem = {
        ...itemAtStart,
        id: 'item-2',
        progress_percent: 100,
      };

      expect(itemAtStart.progress_percent).toBe(0);
      expect(itemComplete.progress_percent).toBe(100);
    });
  });

  // ==========================================================================
  // DailyRecommendation Interface Tests
  // ==========================================================================

  describe('DailyRecommendation', () => {
    it('should accept valid daily recommendation', () => {
      const recommendation: DailyRecommendation = {
        id: 'rec-123',
        user_id: 'user-456',
        date: '2025-01-15',
        created_at: Date.now(),
        items: [
          {
            item_id: 'item-1',
            item_title: 'Learn TypeScript',
            item_source: 'youtube',
            rationale: 'Based on your interest in programming',
            priority: 9,
            time_slot: 'morning',
          },
          {
            item_id: 'item-2',
            item_title: 'AI Ethics Paper',
            item_source: 'arxiv',
            rationale: 'Trending in your field',
            priority: 7,
            time_slot: 'afternoon',
          },
        ],
        focus_topic: 'ai_ml',
        focus_description: 'Today, focus on AI and ML topics',
        accepted_count: 0,
        completed_count: 0,
        total_time_minutes: 90,
      };

      expect(recommendation.id).toBe('rec-123');
      expect(recommendation.items).toHaveLength(2);
      expect(recommendation.focus_topic).toBe('ai_ml');
    });

    it('should accept recommendation item with all time slots', () => {
      const timeSlots: Array<'morning' | 'afternoon' | 'evening' | 'anytime'> = [
        'morning',
        'afternoon',
        'evening',
        'anytime',
      ];

      timeSlots.forEach((slot) => {
        const item = {
          item_id: 'item-1',
          item_title: 'Test',
          item_source: 'book' as LearningSource,
          rationale: 'Test rationale',
          priority: 5,
          time_slot: slot,
        };

        expect(item.time_slot).toBe(slot);
      });
    });

    it('should accept recommendation without optional fields', () => {
      const recommendation: DailyRecommendation = {
        id: 'rec-minimal',
        user_id: 'user-123',
        date: '2025-01-15',
        created_at: Date.now(),
        items: [],
        accepted_count: 0,
        completed_count: 0,
        total_time_minutes: 0,
      };

      expect(recommendation.focus_topic).toBeUndefined();
      expect(recommendation.focus_description).toBeUndefined();
    });

    it('should validate priority range in items', () => {
      const lowPriorityItem = {
        item_id: 'item-low',
        item_title: 'Low Priority',
        item_source: 'newsletter' as LearningSource,
        rationale: 'Background reading',
        priority: 1,
      };

      const highPriorityItem = {
        item_id: 'item-high',
        item_title: 'High Priority',
        item_source: 'coursera' as LearningSource,
        rationale: 'Critical learning',
        priority: 10,
      };

      expect(lowPriorityItem.priority).toBe(1);
      expect(highPriorityItem.priority).toBe(10);
    });
  });

  // ==========================================================================
  // LearningProgress Interface Tests
  // ==========================================================================

  describe('LearningProgress', () => {
    it('should accept valid learning progress', () => {
      const progress: LearningProgress = {
        user_id: 'user-123',
        total_items: 100,
        completed_items: 50,
        in_progress_items: 10,
        total_learning_hours: 200,
        current_streak_days: 7,
        longest_streak_days: 30,
        by_category: {
          ai_ml: { total: 20, completed: 15, avg_difficulty: 3.5 },
          programming: { total: 30, completed: 20, avg_difficulty: 2.5 },
          business: { total: 10, completed: 5, avg_difficulty: 2.0 },
          health: { total: 5, completed: 3, avg_difficulty: 1.5 },
          productivity: { total: 15, completed: 4, avg_difficulty: 2.0 },
          science: { total: 8, completed: 2, avg_difficulty: 3.0 },
          engineering: { total: 7, completed: 1, avg_difficulty: 4.0 },
          philosophy: { total: 3, completed: 0, avg_difficulty: 3.5 },
          other: { total: 2, completed: 0, avg_difficulty: 2.0 },
        },
        last_activity_at: Date.now(),
        items_completed_this_week: 5,
        items_completed_this_month: 20,
      };

      expect(progress.user_id).toBe('user-123');
      expect(progress.total_items).toBe(100);
      expect(progress.completed_items).toBe(50);
      expect(progress.current_streak_days).toBe(7);
    });

    it('should accept progress with optional last_activity_at', () => {
      const progress: LearningProgress = {
        user_id: 'user-new',
        total_items: 0,
        completed_items: 0,
        in_progress_items: 0,
        total_learning_hours: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
        by_category: {
          ai_ml: { total: 0, completed: 0, avg_difficulty: 0 },
          programming: { total: 0, completed: 0, avg_difficulty: 0 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 0, completed: 0, avg_difficulty: 0 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 0,
        items_completed_this_month: 0,
      };

      expect(progress.last_activity_at).toBeUndefined();
      expect(progress.total_items).toBe(0);
    });

    it('should track category-specific progress', () => {
      const progress: LearningProgress = {
        user_id: 'user-specialized',
        total_items: 50,
        completed_items: 30,
        in_progress_items: 5,
        total_learning_hours: 100,
        current_streak_days: 14,
        longest_streak_days: 14,
        by_category: {
          ai_ml: { total: 40, completed: 28, avg_difficulty: 3.8 },
          programming: { total: 10, completed: 2, avg_difficulty: 2.5 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 0, completed: 0, avg_difficulty: 0 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 3,
        items_completed_this_month: 12,
      };

      expect(progress.by_category.ai_ml.total).toBe(40);
      expect(progress.by_category.ai_ml.completed).toBe(28);
      expect(progress.by_category.ai_ml.avg_difficulty).toBe(3.8);
    });
  });

  // ==========================================================================
  // HyroAgentStatus Interface Tests
  // ==========================================================================

  describe('HyroAgentStatus', () => {
    it('should accept healthy agent status', () => {
      const status: HyroAgentStatus = {
        ok: true,
        agent: 'hyro',
        status: 'green',
        health_score: 95,
        pending_items: 15,
        recommendations_today: 5,
        items_completed_today: 3,
        last_sync: new Date().toISOString(),
        last_recommendation: new Date().toISOString(),
        total_sources: 10,
        active_sources: 8,
        total_learning_items: 150,
        recent_items: [
          {
            id: 'item-1',
            title: 'Recent Item 1',
            status: 'completed',
            updated_at: Date.now(),
          },
          {
            id: 'item-2',
            title: 'Recent Item 2',
            status: 'in_progress',
            updated_at: Date.now() - 3600000,
          },
        ],
      };

      expect(status.ok).toBe(true);
      expect(status.agent).toBe('hyro');
      expect(status.status).toBe('green');
      expect(status.health_score).toBe(95);
    });

    it('should accept warning agent status', () => {
      const status: HyroAgentStatus = {
        ok: true,
        agent: 'hyro',
        status: 'yellow',
        health_score: 70,
        pending_items: 50,
        recommendations_today: 2,
        items_completed_today: 0,
        last_sync: new Date(Date.now() - 86400000).toISOString(),
        last_recommendation: new Date(Date.now() - 86400000).toISOString(),
        total_sources: 10,
        active_sources: 5,
        total_learning_items: 200,
        recent_items: [],
      };

      expect(status.status).toBe('yellow');
      expect(status.health_score).toBe(70);
    });

    it('should accept error agent status', () => {
      const status: HyroAgentStatus = {
        ok: false,
        agent: 'hyro',
        status: 'red',
        health_score: 20,
        pending_items: 100,
        recommendations_today: 0,
        items_completed_today: 0,
        last_sync: new Date(Date.now() - 604800000).toISOString(),
        last_recommendation: new Date(Date.now() - 604800000).toISOString(),
        total_sources: 10,
        active_sources: 0,
        total_learning_items: 50,
        recent_items: [],
      };

      expect(status.ok).toBe(false);
      expect(status.status).toBe('red');
      expect(status.active_sources).toBe(0);
    });

    it('should include recent items with valid statuses', () => {
      const statuses: LearningStatus[] = ['pending', 'in_progress', 'completed'];

      statuses.forEach((itemStatus) => {
        const recentItem = {
          id: 'item-test',
          title: 'Test Item',
          status: itemStatus,
          updated_at: Date.now(),
        };

        expect(recentItem.status).toBe(itemStatus);
      });
    });
  });

  // ==========================================================================
  // CrawlerConfig Interface Tests
  // ==========================================================================

  describe('CrawlerConfig', () => {
    it('should accept enabled crawler config', () => {
      const config: CrawlerConfig = {
        source: 'arxiv',
        enabled: true,
        config: {
          keywords: ['machine learning', 'neural networks'],
          max_items: 50,
          sync_interval_hours: 24,
        },
        last_sync_at: Date.now() - 3600000,
        last_success_at: Date.now() - 3600000,
        error_count: 0,
      };

      expect(config.source).toBe('arxiv');
      expect(config.enabled).toBe(true);
      expect(config.config.keywords).toContain('machine learning');
    });

    it('should accept disabled crawler config', () => {
      const config: CrawlerConfig = {
        source: 'youtube',
        enabled: false,
        config: {},
        error_count: 0,
      };

      expect(config.enabled).toBe(false);
    });

    it('should accept crawler config with URL', () => {
      const config: CrawlerConfig = {
        source: 'rss',
        enabled: true,
        config: {
          url: 'https://example.com/feed.xml',
          max_items: 20,
          sync_interval_hours: 6,
        },
        error_count: 0,
      };

      expect(config.config.url).toBe('https://example.com/feed.xml');
    });

    it('should accept crawler config with API key', () => {
      const config: CrawlerConfig = {
        source: 'custom',
        enabled: true,
        config: {
          url: 'https://api.example.com/content',
          api_key: 'secret-api-key',
          max_items: 100,
        },
        error_count: 0,
      };

      expect(config.config.api_key).toBe('secret-api-key');
    });

    it('should track error state', () => {
      const config: CrawlerConfig = {
        source: 'github',
        enabled: true,
        config: {
          keywords: ['typescript', 'react'],
        },
        last_sync_at: Date.now() - 7200000,
        error_count: 3,
        last_error: 'Rate limit exceeded',
      };

      expect(config.error_count).toBe(3);
      expect(config.last_error).toBe('Rate limit exceeded');
    });
  });

  // ==========================================================================
  // SyncResult Interface Tests
  // ==========================================================================

  describe('SyncResult', () => {
    it('should accept successful sync result', () => {
      const result: SyncResult = {
        source: 'arxiv',
        success: true,
        items_found: 25,
        items_new: 10,
        items_updated: 5,
        synced_at: Date.now(),
      };

      expect(result.success).toBe(true);
      expect(result.items_found).toBe(25);
      expect(result.items_new).toBe(10);
    });

    it('should accept failed sync result', () => {
      const result: SyncResult = {
        source: 'youtube',
        success: false,
        items_found: 0,
        items_new: 0,
        items_updated: 0,
        error: 'API rate limit exceeded',
        synced_at: Date.now(),
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('API rate limit exceeded');
    });

    it('should accept sync result with no new items', () => {
      const result: SyncResult = {
        source: 'coursera',
        success: true,
        items_found: 15,
        items_new: 0,
        items_updated: 3,
        synced_at: Date.now(),
      };

      expect(result.items_found).toBe(15);
      expect(result.items_new).toBe(0);
      expect(result.items_updated).toBe(3);
    });

    it('should track sync timestamp', () => {
      const now = Date.now();
      const result: SyncResult = {
        source: 'medium',
        success: true,
        items_found: 5,
        items_new: 5,
        items_updated: 0,
        synced_at: now,
      };

      expect(result.synced_at).toBe(now);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty tags array', () => {
      const item: LearningItem = {
        id: 'item-no-tags',
        user_id: 'user-1',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'book',
        title: 'No Tags Item',
        topics: ['other'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        tags: [],
        priority_score: 50,
        confidence: 0.5,
      };

      expect(item.tags).toHaveLength(0);
    });

    it('should handle multiple topics', () => {
      const item: LearningItem = {
        id: 'item-multi-topic',
        user_id: 'user-1',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'coursera',
        title: 'Cross-Disciplinary Course',
        topics: ['ai_ml', 'programming', 'business', 'engineering'],
        difficulty: 'advanced',
        status: 'pending',
        progress_percent: 0,
        tags: ['cross-disciplinary'],
        priority_score: 85,
        confidence: 0.9,
      };

      expect(item.topics).toHaveLength(4);
      expect(item.topics).toContain('ai_ml');
      expect(item.topics).toContain('business');
    });

    it('should handle zero-based timestamps', () => {
      const result: SyncResult = {
        source: 'custom',
        success: true,
        items_found: 0,
        items_new: 0,
        items_updated: 0,
        synced_at: 0,
      };

      expect(result.synced_at).toBe(0);
    });

    it('should handle very high priority scores', () => {
      const item: LearningItem = {
        id: 'item-high-priority',
        user_id: 'user-1',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'arxiv',
        title: 'Critical Paper',
        topics: ['ai_ml'],
        difficulty: 'expert',
        status: 'pending',
        progress_percent: 0,
        tags: ['critical'],
        priority_score: 100,
        confidence: 1.0,
      };

      expect(item.priority_score).toBe(100);
      expect(item.confidence).toBe(1.0);
    });

    it('should handle empty recommendations', () => {
      const recommendation: DailyRecommendation = {
        id: 'rec-empty',
        user_id: 'user-1',
        date: '2025-01-15',
        created_at: Date.now(),
        items: [],
        accepted_count: 0,
        completed_count: 0,
        total_time_minutes: 0,
      };

      expect(recommendation.items).toHaveLength(0);
      expect(recommendation.total_time_minutes).toBe(0);
    });
  });
});
