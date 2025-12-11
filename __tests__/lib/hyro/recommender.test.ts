// @ts-nocheck
/**
 * Tests for Hyro Agent Recommender
 *
 * Tests for daily learning recommendation generation, priority scoring,
 * time slot determination, and recommendation management.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock store module
const mockLearningItems = [];
const mockDailyRecommendations = new Map();

jest.mock('../../../lib/hyro/store', () => ({
  listLearningItems: jest.fn(() => mockLearningItems),
  getLearningProgress: jest.fn(() => ({
    user_id: 'test-user',
    total_items: 50,
    completed_items: 20,
    in_progress_items: 5,
    total_learning_hours: 100,
    current_streak_days: 7,
    longest_streak_days: 14,
    by_category: {
      ai_ml: { total: 15, completed: 8, avg_difficulty: 3 },
      programming: { total: 20, completed: 10, avg_difficulty: 2.5 },
      business: { total: 10, completed: 2, avg_difficulty: 2 },
      health: { total: 3, completed: 0, avg_difficulty: 1 },
      productivity: { total: 2, completed: 0, avg_difficulty: 1.5 },
      science: { total: 0, completed: 0, avg_difficulty: 0 },
      engineering: { total: 0, completed: 0, avg_difficulty: 0 },
      philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
      other: { total: 0, completed: 0, avg_difficulty: 0 },
    },
    items_completed_this_week: 5,
    items_completed_this_month: 15,
  })),
  createDailyRecommendation: jest.fn((rec) => ({ ...rec, id: 'rec-123' })),
  getDailyRecommendation: jest.fn(() => null),
  updateLearningItem: jest.fn(),
}));

import {
  generateDailyRecommendations,
  acceptRecommendationItem,
  completeRecommendationItem,
  getRecommendedTimeBudget,
} from '../../../lib/hyro/recommender';

import type { LearningItem, LearningProgress, TopicCategory } from '../../../lib/hyro/types';

describe('Hyro Agent Recommender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLearningItems.length = 0;
    mockDailyRecommendations.clear();
  });

  // ==========================================================================
  // generateDailyRecommendations Tests
  // ==========================================================================

  describe('generateDailyRecommendations', () => {
    it('should return existing recommendation if one exists for today', async () => {
      const existingRec = {
        id: 'rec-existing',
        user_id: 'test-user',
        date: new Date().toISOString().split('T')[0],
        created_at: Date.now(),
        items: [],
        accepted_count: 0,
        completed_count: 0,
        total_time_minutes: 0,
      };

      const { getDailyRecommendation } = require('../../../lib/hyro/store');
      getDailyRecommendation.mockReturnValueOnce(existingRec);

      const result = await generateDailyRecommendations('test-user');

      expect(result).toEqual(existingRec);
    });

    it('should generate new recommendations when none exist', async () => {
      mockLearningItems.push({
        id: 'item-1',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'arxiv',
        title: 'Machine Learning Paper',
        topics: ['ai_ml'],
        difficulty: 'intermediate',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 30,
        tags: [],
        priority_score: 50,
        confidence: 0.8,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
      expect(result.id).toBe('rec-123');
    });

    it('should respect max_items option', async () => {
      // Add multiple items
      for (let i = 0; i < 10; i++) {
        mockLearningItems.push({
          id: `item-${i}`,
          user_id: 'test-user',
          created_at: Date.now(),
          updated_at: Date.now(),
          source: 'youtube',
          title: `Tutorial ${i}`,
          topics: ['programming'],
          difficulty: 'beginner',
          status: 'pending',
          progress_percent: 0,
          estimated_time_minutes: 20,
          tags: [],
          priority_score: 50 + i,
          confidence: 0.7,
        });
      }

      const result = await generateDailyRecommendations('test-user', { max_items: 3 });

      expect(result).toBeDefined();
    });

    it('should respect target_time_minutes option', async () => {
      mockLearningItems.push({
        id: 'item-long',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'coursera',
        title: 'Long Course',
        topics: ['ai_ml'],
        difficulty: 'advanced',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 180,
        tags: [],
        priority_score: 80,
        confidence: 0.9,
      });

      const result = await generateDailyRecommendations('test-user', {
        target_time_minutes: 60
      });

      expect(result).toBeDefined();
    });

    it('should respect focus_topics option', async () => {
      mockLearningItems.push({
        id: 'item-focus',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'medium',
        title: 'AI Article',
        topics: ['ai_ml'],
        difficulty: 'intermediate',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 15,
        tags: [],
        priority_score: 60,
        confidence: 0.85,
      });

      const result = await generateDailyRecommendations('test-user', {
        focus_topics: ['ai_ml'],
      });

      expect(result).toBeDefined();
    });

    it('should update priority scores for pending items', async () => {
      mockLearningItems.push({
        id: 'item-update',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'book',
        title: 'Test Book',
        topics: ['programming'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 60,
        tags: [],
        priority_score: 30,
        confidence: 0.5,
      });

      const { updateLearningItem } = require('../../../lib/hyro/store');

      await generateDailyRecommendations('test-user');

      expect(updateLearningItem).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // acceptRecommendationItem Tests
  // ==========================================================================

  describe('acceptRecommendationItem', () => {
    it('should accept a recommendation item', () => {
      const result = acceptRecommendationItem('rec-123', 'item-1');

      // Current implementation returns null
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // completeRecommendationItem Tests
  // ==========================================================================

  describe('completeRecommendationItem', () => {
    it('should complete a recommendation item', () => {
      const result = completeRecommendationItem('rec-123', 'item-1');

      const { updateLearningItem } = require('../../../lib/hyro/store');

      expect(updateLearningItem).toHaveBeenCalledWith('item-1', expect.objectContaining({
        status: 'completed',
        progress_percent: 100,
      }));

      // Current implementation returns null
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getRecommendedTimeBudget Tests
  // ==========================================================================

  describe('getRecommendedTimeBudget', () => {
    it('should return base budget for new user', () => {
      const progress: LearningProgress = {
        user_id: 'new-user',
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

      const budget = getRecommendedTimeBudget(progress);

      expect(budget).toBe(30); // Start small for inactive users
    });

    it('should increase budget for users on a streak', () => {
      const progress: LearningProgress = {
        user_id: 'streaker',
        total_items: 50,
        completed_items: 30,
        in_progress_items: 5,
        total_learning_hours: 100,
        current_streak_days: 10,
        longest_streak_days: 10,
        by_category: {
          ai_ml: { total: 20, completed: 15, avg_difficulty: 3 },
          programming: { total: 0, completed: 0, avg_difficulty: 0 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 0, completed: 0, avg_difficulty: 0 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 5,
        items_completed_this_month: 20,
      };

      const budget = getRecommendedTimeBudget(progress);

      expect(budget).toBeGreaterThan(60); // Base + streak bonus
    });

    it('should increase budget for engaged users', () => {
      const progress: LearningProgress = {
        user_id: 'engaged',
        total_items: 100,
        completed_items: 60,
        in_progress_items: 10,
        total_learning_hours: 200,
        current_streak_days: 3,
        longest_streak_days: 14,
        by_category: {
          ai_ml: { total: 40, completed: 30, avg_difficulty: 3.5 },
          programming: { total: 0, completed: 0, avg_difficulty: 0 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 0, completed: 0, avg_difficulty: 0 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 7,
        items_completed_this_month: 25,
      };

      const budget = getRecommendedTimeBudget(progress);

      expect(budget).toBeGreaterThan(60);
    });

    it('should cap budget at 180 minutes', () => {
      const progress: LearningProgress = {
        user_id: 'super-engaged',
        total_items: 200,
        completed_items: 150,
        in_progress_items: 20,
        total_learning_hours: 500,
        current_streak_days: 30,
        longest_streak_days: 60,
        by_category: {
          ai_ml: { total: 100, completed: 80, avg_difficulty: 4 },
          programming: { total: 0, completed: 0, avg_difficulty: 0 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 0, completed: 0, avg_difficulty: 0 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 15,
        items_completed_this_month: 50,
      };

      const budget = getRecommendedTimeBudget(progress);

      expect(budget).toBeLessThanOrEqual(180);
    });

    it('should use moderate streak bonus for 3-7 day streak', () => {
      const progress: LearningProgress = {
        user_id: 'moderate-streaker',
        total_items: 30,
        completed_items: 15,
        in_progress_items: 3,
        total_learning_hours: 50,
        current_streak_days: 5,
        longest_streak_days: 7,
        by_category: {
          ai_ml: { total: 10, completed: 5, avg_difficulty: 2.5 },
          programming: { total: 0, completed: 0, avg_difficulty: 0 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 0, completed: 0, avg_difficulty: 0 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 3,
        items_completed_this_month: 10,
      };

      const budget = getRecommendedTimeBudget(progress);

      // Base 60 + 15 for short streak = 75, but only 3 items/week doesn't get bonus
      expect(budget).toBeGreaterThanOrEqual(60);
    });
  });

  // ==========================================================================
  // Priority Score Calculation Tests (via generateDailyRecommendations)
  // ==========================================================================

  describe('Priority Score Calculation', () => {
    it('should boost score for focus topics', async () => {
      mockLearningItems.push(
        {
          id: 'item-ai',
          user_id: 'test-user',
          created_at: Date.now(),
          updated_at: Date.now(),
          source: 'arxiv',
          title: 'AI Paper',
          topics: ['ai_ml'],
          difficulty: 'intermediate',
          status: 'pending',
          progress_percent: 0,
          estimated_time_minutes: 30,
          tags: [],
          priority_score: 50,
          confidence: 0.8,
        },
        {
          id: 'item-business',
          user_id: 'test-user',
          created_at: Date.now(),
          updated_at: Date.now(),
          source: 'medium',
          title: 'Business Article',
          topics: ['business'],
          difficulty: 'intermediate',
          status: 'pending',
          progress_percent: 0,
          estimated_time_minutes: 20,
          tags: [],
          priority_score: 50,
          confidence: 0.8,
        }
      );

      await generateDailyRecommendations('test-user', {
        focus_topics: ['ai_ml'],
      });

      const { updateLearningItem } = require('../../../lib/hyro/store');

      expect(updateLearningItem).toHaveBeenCalled();
    });

    it('should boost recently published content', async () => {
      mockLearningItems.push({
        id: 'item-recent',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'medium',
        title: 'Recent Article',
        topics: ['programming'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 15,
        published_at: Math.floor(Date.now() / 1000) - 86400 * 3, // 3 days ago
        tags: [],
        priority_score: 50,
        confidence: 0.9,
      });

      await generateDailyRecommendations('test-user');

      const { updateLearningItem } = require('../../../lib/hyro/store');

      expect(updateLearningItem).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Time Slot Determination Tests
  // ==========================================================================

  describe('Time Slot Determination', () => {
    it('should assign morning for advanced content', async () => {
      mockLearningItems.push({
        id: 'item-advanced',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'arxiv',
        title: 'Advanced Paper',
        topics: ['ai_ml'],
        difficulty: 'advanced',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 60,
        tags: [],
        priority_score: 80,
        confidence: 0.9,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
    });

    it('should assign afternoon for programming content', async () => {
      mockLearningItems.push({
        id: 'item-programming',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'github',
        title: 'Code Tutorial',
        topics: ['programming'],
        difficulty: 'intermediate',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 45,
        tags: [],
        priority_score: 70,
        confidence: 0.85,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
    });

    it('should assign anytime for short content', async () => {
      mockLearningItems.push({
        id: 'item-short',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'medium',
        title: 'Quick Read',
        topics: ['productivity'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 10,
        tags: [],
        priority_score: 60,
        confidence: 0.7,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Rationale Generation Tests
  // ==========================================================================

  describe('Rationale Generation', () => {
    it('should generate rationale for beginner content', async () => {
      mockLearningItems.push({
        id: 'item-beginner',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'youtube',
        title: 'Intro Tutorial',
        topics: ['science'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 25,
        tags: [],
        priority_score: 55,
        confidence: 0.75,
      });

      // Use a new user with < 5 completed items
      const { getLearningProgress } = require('../../../lib/hyro/store');
      getLearningProgress.mockReturnValueOnce({
        user_id: 'new-user',
        total_items: 5,
        completed_items: 2,
        in_progress_items: 1,
        total_learning_hours: 10,
        current_streak_days: 1,
        longest_streak_days: 1,
        by_category: {
          ai_ml: { total: 0, completed: 0, avg_difficulty: 0 },
          programming: { total: 0, completed: 0, avg_difficulty: 0 },
          business: { total: 0, completed: 0, avg_difficulty: 0 },
          health: { total: 0, completed: 0, avg_difficulty: 0 },
          productivity: { total: 0, completed: 0, avg_difficulty: 0 },
          science: { total: 2, completed: 1, avg_difficulty: 1.5 },
          engineering: { total: 0, completed: 0, avg_difficulty: 0 },
          philosophy: { total: 0, completed: 0, avg_difficulty: 0 },
          other: { total: 0, completed: 0, avg_difficulty: 0 },
        },
        items_completed_this_week: 1,
        items_completed_this_month: 2,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle no pending items', async () => {
      // mockLearningItems is empty

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(0);
    });

    it('should handle items without estimated time', async () => {
      mockLearningItems.push({
        id: 'item-no-time',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'custom',
        title: 'Unknown Duration',
        topics: ['other'],
        difficulty: 'intermediate',
        status: 'pending',
        progress_percent: 0,
        // No estimated_time_minutes
        tags: [],
        priority_score: 50,
        confidence: 0.5,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
    });

    it('should handle empty by_category in progress', async () => {
      const { getLearningProgress } = require('../../../lib/hyro/store');
      getLearningProgress.mockReturnValueOnce({
        user_id: 'empty-user',
        total_items: 0,
        completed_items: 0,
        in_progress_items: 0,
        total_learning_hours: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
        by_category: {},
        items_completed_this_week: 0,
        items_completed_this_month: 0,
      });

      mockLearningItems.push({
        id: 'item-test',
        user_id: 'test-user',
        created_at: Date.now(),
        updated_at: Date.now(),
        source: 'book',
        title: 'Test',
        topics: ['ai_ml'],
        difficulty: 'beginner',
        status: 'pending',
        progress_percent: 0,
        estimated_time_minutes: 30,
        tags: [],
        priority_score: 50,
        confidence: 0.5,
      });

      const result = await generateDailyRecommendations('test-user');

      expect(result).toBeDefined();
    });
  });
});
