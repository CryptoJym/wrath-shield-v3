// @ts-nocheck
/**
 * Tests for HYRO FORGE Type Definitions
 *
 * Tests for RPG-style education system types including stats,
 * character system, XP, quests, SRS, and achievements.
 */

import { describe, it, expect } from '@jest/globals';

import {
  STAT_NAMES,
  LEVEL_TITLES,
  type StatName,
  type Stat,
  type StatWithTrend,
  type Character,
  type CharacterSheet,
  type XPSource,
  type XPTransaction,
  type XPSummary,
  type QuestType,
  type QuestDifficulty,
  type QuestStatus,
  type Quest,
  type QuestWithProgress,
  type SubmissionType,
  type AIReviewStatus,
  type Submission,
  type SRSTopic,
  type SRSReview,
  type SRSDueTopics,
  type IntelItem,
  type DailyIntel,
  type Reflection,
  type CalibrationMetrics,
  type Achievement,
  type SpiderGraphData,
  type ForgeAPIResponse,
  type XPAwardResult,
  type StatUpdateResult,
} from '../../../lib/hyro/forge-types';

describe('HYRO FORGE Types', () => {
  // ==========================================================================
  // STAT_NAMES Constant Tests
  // ==========================================================================

  describe('STAT_NAMES', () => {
    it('should contain all stat names', () => {
      expect(STAT_NAMES).toHaveLength(11);
    });

    it('should include core academic stats', () => {
      expect(STAT_NAMES).toContain('math');
      expect(STAT_NAMES).toContain('reading');
      expect(STAT_NAMES).toContain('writing');
      expect(STAT_NAMES).toContain('science');
      expect(STAT_NAMES).toContain('social_studies');
    });

    it('should include skill-based stats', () => {
      expect(STAT_NAMES).toContain('financial_literacy');
      expect(STAT_NAMES).toContain('coding');
      expect(STAT_NAMES).toContain('study_skills');
      expect(STAT_NAMES).toContain('critical_thinking');
      expect(STAT_NAMES).toContain('technology');
      expect(STAT_NAMES).toContain('problem_solving');
    });

    it('should be an array for iteration', () => {
      expect(Array.isArray(STAT_NAMES)).toBe(true);
      STAT_NAMES.forEach((stat) => {
        expect(typeof stat).toBe('string');
      });
    });
  });

  // ==========================================================================
  // LEVEL_TITLES Constant Tests
  // ==========================================================================

  describe('LEVEL_TITLES', () => {
    it('should have titles for key levels', () => {
      expect(LEVEL_TITLES[1]).toBe('Apprentice Forger');
      expect(LEVEL_TITLES[5]).toBe('Journeyman Scholar');
      expect(LEVEL_TITLES[10]).toBe('Adept Thinker');
      expect(LEVEL_TITLES[15]).toBe('Master Learner');
      expect(LEVEL_TITLES[20]).toBe('Sage of Knowledge');
      expect(LEVEL_TITLES[25]).toBe('Grandmaster');
      expect(LEVEL_TITLES[30]).toBe('Legendary Forger');
    });

    it('should have 7 defined title levels', () => {
      expect(Object.keys(LEVEL_TITLES)).toHaveLength(7);
    });

    it('should progress in title prestige', () => {
      const levels = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => a - b);
      expect(levels).toEqual([1, 5, 10, 15, 20, 25, 30]);
    });
  });

  // ==========================================================================
  // StatName Type Tests
  // ==========================================================================

  describe('StatName', () => {
    it('should allow valid stat names', () => {
      const stats: StatName[] = [
        'math',
        'reading',
        'writing',
        'science',
        'social_studies',
        'financial_literacy',
        'coding',
        'study_skills',
        'critical_thinking',
        'technology',
        'problem_solving',
      ];

      expect(stats).toHaveLength(11);
    });
  });

  // ==========================================================================
  // Stat Interface Tests
  // ==========================================================================

  describe('Stat', () => {
    it('should accept valid stat', () => {
      const stat: Stat = {
        id: 'stat-123',
        stat_name: 'math',
        display_name: 'Mathematics',
        description: 'Mathematical reasoning and computation',
        base_value: 50,
        current_value: 65,
        modifier: 15,
        last_assessed: Date.now(),
        assessment_confidence: 0.85,
      };

      expect(stat.stat_name).toBe('math');
      expect(stat.current_value).toBe(65);
    });

    it('should accept stat with null last_assessed', () => {
      const stat: Stat = {
        id: 'stat-new',
        stat_name: 'coding',
        display_name: 'Coding',
        description: 'Programming skills',
        base_value: 0,
        current_value: 0,
        modifier: 0,
        last_assessed: null,
        assessment_confidence: 0,
      };

      expect(stat.last_assessed).toBeNull();
    });
  });

  // ==========================================================================
  // StatWithTrend Interface Tests
  // ==========================================================================

  describe('StatWithTrend', () => {
    it('should accept stat with upward trend', () => {
      const stat: StatWithTrend = {
        id: 'stat-trending',
        stat_name: 'reading',
        display_name: 'Reading',
        description: 'Reading comprehension',
        base_value: 60,
        current_value: 75,
        modifier: 15,
        last_assessed: Date.now(),
        assessment_confidence: 0.9,
        trend: 'up',
        change_7d: 10,
        benchmark: 65,
      };

      expect(stat.trend).toBe('up');
      expect(stat.change_7d).toBe(10);
    });

    it('should accept stat with downward trend', () => {
      const stat: StatWithTrend = {
        id: 'stat-down',
        stat_name: 'writing',
        display_name: 'Writing',
        description: 'Writing skills',
        base_value: 70,
        current_value: 65,
        modifier: -5,
        last_assessed: Date.now(),
        assessment_confidence: 0.8,
        trend: 'down',
        change_7d: -5,
        benchmark: 68,
      };

      expect(stat.trend).toBe('down');
      expect(stat.change_7d).toBe(-5);
    });

    it('should accept stat with stable trend', () => {
      const stat: StatWithTrend = {
        id: 'stat-stable',
        stat_name: 'science',
        display_name: 'Science',
        description: 'Scientific knowledge',
        base_value: 55,
        current_value: 55,
        modifier: 0,
        last_assessed: Date.now(),
        assessment_confidence: 0.75,
        trend: 'stable',
        change_7d: 0,
        benchmark: 55,
      };

      expect(stat.trend).toBe('stable');
      expect(stat.change_7d).toBe(0);
    });
  });

  // ==========================================================================
  // Character Interface Tests
  // ==========================================================================

  describe('Character', () => {
    it('should accept valid character', () => {
      const character: Character = {
        id: 'char-123',
        display_name: 'Test Student',
        title: 'Apprentice Forger',
        level: 5,
        total_xp: 1500,
        current_streak: 7,
        longest_streak: 14,
        last_session_at: Date.now(),
        avatar_url: 'https://example.com/avatar.png',
        created_at: Date.now() - 86400000 * 30,
        updated_at: Date.now(),
      };

      expect(character.display_name).toBe('Test Student');
      expect(character.level).toBe(5);
      expect(character.current_streak).toBe(7);
    });

    it('should accept character with null optional fields', () => {
      const character: Character = {
        id: 'char-new',
        display_name: 'New Student',
        title: 'Apprentice Forger',
        level: 1,
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        last_session_at: null,
        avatar_url: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      expect(character.last_session_at).toBeNull();
      expect(character.avatar_url).toBeNull();
    });
  });

  // ==========================================================================
  // CharacterSheet Interface Tests
  // ==========================================================================

  describe('CharacterSheet', () => {
    it('should accept valid character sheet', () => {
      const sheet: CharacterSheet = {
        id: 'char-sheet',
        display_name: 'Advanced Student',
        title: 'Master Learner',
        level: 15,
        total_xp: 25000,
        current_streak: 21,
        longest_streak: 45,
        last_session_at: Date.now(),
        avatar_url: null,
        created_at: Date.now() - 86400000 * 365,
        updated_at: Date.now(),
        stats: [],
        xp_to_next_level: 2500,
        xp_progress_percent: 75,
        recent_achievements: [],
        active_quests: [],
      };

      expect(sheet.xp_to_next_level).toBe(2500);
      expect(sheet.xp_progress_percent).toBe(75);
    });
  });

  // ==========================================================================
  // XPSource Type Tests
  // ==========================================================================

  describe('XPSource', () => {
    it('should allow all valid XP sources', () => {
      const sources: XPSource[] = [
        'quest',
        'daily',
        'streak',
        'achievement',
        'srs',
        'srs_review',
        'intel',
        'intel_completed',
        'reflection',
        'reflection_completed',
        'bonus',
        'reading_session',
        'chapter_completed',
        'book_completed',
        'comprehension_response',
        'discussion_exchange',
        'discussion_completed',
        'diagnostic',
        'engagement',
        'study_pattern',
      ];

      expect(sources).toHaveLength(20);
    });

    it('should include reading system sources', () => {
      const readingSources: XPSource[] = [
        'reading_session',
        'chapter_completed',
        'book_completed',
      ];

      expect(readingSources).toContain('reading_session');
    });

    it('should include comprehension system sources', () => {
      const comprehensionSources: XPSource[] = [
        'comprehension_response',
        'discussion_exchange',
        'discussion_completed',
      ];

      expect(comprehensionSources).toContain('discussion_completed');
    });
  });

  // ==========================================================================
  // XPTransaction Interface Tests
  // ==========================================================================

  describe('XPTransaction', () => {
    it('should accept valid XP transaction', () => {
      const transaction: XPTransaction = {
        id: 'xp-123',
        amount: 100,
        source: 'quest',
        source_id: 'quest-456',
        multiplier: 1.5,
        notes: 'Completed daily quest',
        created_at: Date.now(),
      };

      expect(transaction.amount).toBe(100);
      expect(transaction.multiplier).toBe(1.5);
    });

    it('should accept transaction with null optional fields', () => {
      const transaction: XPTransaction = {
        id: 'xp-simple',
        amount: 50,
        source: 'bonus',
        source_id: null,
        multiplier: 1.0,
        notes: null,
        created_at: Date.now(),
      };

      expect(transaction.source_id).toBeNull();
      expect(transaction.notes).toBeNull();
    });
  });

  // ==========================================================================
  // XPSummary Interface Tests
  // ==========================================================================

  describe('XPSummary', () => {
    it('should accept valid XP summary', () => {
      const summary: XPSummary = {
        today: 250,
        this_week: 1200,
        this_month: 4500,
        total: 15000,
        by_source: {
          quest: 3000,
          daily: 2000,
          streak: 1500,
          achievement: 1000,
          srs: 800,
          srs_review: 600,
          intel: 400,
          intel_completed: 300,
          reflection: 200,
          reflection_completed: 150,
          bonus: 100,
          reading_session: 500,
          chapter_completed: 800,
          book_completed: 1000,
          comprehension_response: 300,
          discussion_exchange: 200,
          discussion_completed: 400,
          diagnostic: 250,
          engagement: 300,
          study_pattern: 200,
        },
      };

      expect(summary.today).toBe(250);
      expect(summary.total).toBe(15000);
      expect(summary.by_source.quest).toBe(3000);
    });
  });

  // ==========================================================================
  // Quest Type Tests
  // ==========================================================================

  describe('Quest Types', () => {
    it('should allow valid quest types', () => {
      const types: QuestType[] = ['daily', 'weekly', 'epic', 'side', 'challenge'];
      expect(types).toHaveLength(5);
    });

    it('should allow valid quest difficulties', () => {
      const difficulties: QuestDifficulty[] = [
        'trivial',
        'easy',
        'medium',
        'hard',
        'legendary',
      ];
      expect(difficulties).toHaveLength(5);
    });

    it('should allow valid quest statuses', () => {
      const statuses: QuestStatus[] = [
        'available',
        'active',
        'completed',
        'failed',
        'expired',
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  // ==========================================================================
  // Quest Interface Tests
  // ==========================================================================

  describe('Quest', () => {
    it('should accept valid quest', () => {
      const quest: Quest = {
        id: 'quest-123',
        quest_type: 'daily',
        title: 'Complete Math Practice',
        description: 'Solve 10 math problems',
        required_stat: 'math',
        difficulty: 'medium',
        xp_reward: 100,
        stat_boost: { math: 5 },
        achievement_unlock: null,
        status: 'active',
        started_at: Date.now(),
        completed_at: null,
        due_at: Date.now() + 86400000,
        platform: 'forge',
        external_id: null,
        external_url: null,
        is_recurring: true,
        recurrence_pattern: 'daily',
        standard_id: 'CCSS.MATH.6.NS.1',
        created_at: Date.now(),
      };

      expect(quest.title).toBe('Complete Math Practice');
      expect(quest.xp_reward).toBe(100);
    });

    it('should accept epic quest', () => {
      const quest: Quest = {
        id: 'quest-epic',
        quest_type: 'epic',
        title: 'Master Algebra',
        description: 'Complete all algebra modules',
        required_stat: 'math',
        difficulty: 'legendary',
        xp_reward: 1000,
        stat_boost: { math: 25, problem_solving: 10 },
        achievement_unlock: 'algebra-master',
        status: 'available',
        started_at: null,
        completed_at: null,
        due_at: null,
        platform: null,
        external_id: null,
        external_url: null,
        is_recurring: false,
        recurrence_pattern: null,
        created_at: Date.now(),
      };

      expect(quest.quest_type).toBe('epic');
      expect(quest.difficulty).toBe('legendary');
    });
  });

  // ==========================================================================
  // Submission Interface Tests
  // ==========================================================================

  describe('Submission', () => {
    it('should allow valid submission types', () => {
      const types: SubmissionType[] = ['text', 'voice', 'image', 'url', 'code'];
      expect(types).toHaveLength(5);
    });

    it('should allow valid AI review statuses', () => {
      const statuses: AIReviewStatus[] = ['pending', 'reviewed', 'needs_revision'];
      expect(statuses).toHaveLength(3);
    });

    it('should accept valid submission', () => {
      const submission: Submission = {
        id: 'sub-123',
        quest_id: 'quest-456',
        submission_type: 'text',
        content: 'My essay response...',
        file_path: null,
        url: null,
        ai_review_status: 'reviewed',
        ai_feedback: 'Great work! Consider adding more examples.',
        ai_score: 85,
        ai_reviewed_at: Date.now(),
        stats_awarded: { writing: 10 },
        xp_awarded: 50,
        created_at: Date.now(),
      };

      expect(submission.ai_score).toBe(85);
      expect(submission.xp_awarded).toBe(50);
    });
  });

  // ==========================================================================
  // SRS Interface Tests
  // ==========================================================================

  describe('SRS (Spaced Repetition System)', () => {
    it('should accept valid SRS topic', () => {
      const topic: SRSTopic = {
        id: 'srs-123',
        topic: 'Quadratic Formula',
        domain: 'math',
        difficulty: 3,
        ease_factor: 2.5,
        interval_days: 7,
        repetitions: 5,
        last_reviewed: Date.now() - 86400000 * 7,
        next_review: Date.now(),
        last_quality: 4,
        source: 'forge-curriculum',
        external_id: null,
        notes: 'Remember: b² - 4ac',
        is_active: true,
        created_at: Date.now() - 86400000 * 30,
      };

      expect(topic.ease_factor).toBe(2.5);
      expect(topic.interval_days).toBe(7);
    });

    it('should accept valid SRS review', () => {
      const review: SRSReview = {
        id: 'review-123',
        topic_id: 'srs-123',
        quality: 4,
        response_time_ms: 5000,
        confidence_before: 3,
        confidence_after: 4,
        notes: 'Got it right this time',
        created_at: Date.now(),
      };

      expect(review.quality).toBe(4);
      expect(review.response_time_ms).toBe(5000);
    });

    it('should accept SRS due topics', () => {
      const dueTopics: SRSDueTopics = {
        due_now: [],
        due_today: [],
        upcoming: [],
        overdue_count: 0,
      };

      expect(dueTopics.overdue_count).toBe(0);
    });
  });

  // ==========================================================================
  // Daily Intel Interface Tests
  // ==========================================================================

  describe('DailyIntel', () => {
    it('should accept valid intel item', () => {
      const item: IntelItem = {
        id: 'intel-item-1',
        title: 'New AI Breakthrough',
        summary: 'Researchers develop new AI model...',
        source_url: 'https://example.com/article',
        source_name: 'Tech News',
        discussion_prompt: 'What are the implications of this?',
        future_implications: 'This could change how we...',
        read: false,
      };

      expect(item.title).toBe('New AI Breakthrough');
      expect(item.read).toBe(false);
    });

    it('should accept valid daily intel', () => {
      const intel: DailyIntel = {
        id: 'intel-daily-1',
        date: '2025-01-15',
        tech_items: [],
        science_items: [],
        ai_update: null,
        items_read: 0,
        discussion_completed: false,
        deep_dive_topic: null,
        deep_dive_url: null,
        xp_earned: 0,
      };

      expect(intel.date).toBe('2025-01-15');
      expect(intel.discussion_completed).toBe(false);
    });
  });

  // ==========================================================================
  // Reflection Interface Tests
  // ==========================================================================

  describe('Reflection', () => {
    it('should accept valid reflection', () => {
      const reflection: Reflection = {
        id: 'ref-123',
        session_id: 'session-456',
        session_date: '2025-01-15',
        what_learned: 'I learned about quadratic equations',
        what_surprised: 'The connection to real-world problems',
        what_was_hard: 'Remembering the formula',
        what_connects: 'This relates to physics problems',
        confidence_rating: 4,
        actual_performance: 4,
        calibration_score: 0.9,
        energy_level: 3,
        engagement_level: 4,
        focus_level: 4,
        session_duration_minutes: 45,
        created_at: Date.now(),
      };

      expect(reflection.confidence_rating).toBe(4);
      expect(reflection.calibration_score).toBe(0.9);
    });

    it('should accept calibration metrics', () => {
      const metrics: CalibrationMetrics = {
        average_calibration: 0.85,
        overconfidence_rate: 0.1,
        underconfidence_rate: 0.05,
        trend: 'improving',
      };

      expect(metrics.trend).toBe('improving');
    });
  });

  // ==========================================================================
  // Achievement Interface Tests
  // ==========================================================================

  describe('Achievement', () => {
    it('should accept valid achievement', () => {
      const achievement: Achievement = {
        id: 'ach-123',
        name: 'Math Master',
        description: 'Reach level 10 in math',
        icon: '🧮',
        category: 'mastery',
        xp_bonus: 500,
        requirement_type: 'stat_level',
        requirement_value: 10,
        requirement_stat: 'math',
        is_secret: false,
        earned_at: Date.now(),
      };

      expect(achievement.name).toBe('Math Master');
      expect(achievement.xp_bonus).toBe(500);
    });

    it('should allow all achievement categories', () => {
      const categories: Array<'streak' | 'mastery' | 'exploration' | 'epic'> = [
        'streak',
        'mastery',
        'exploration',
        'epic',
      ];

      expect(categories).toHaveLength(4);
    });
  });

  // ==========================================================================
  // SpiderGraphData Interface Tests
  // ==========================================================================

  describe('SpiderGraphData', () => {
    it('should accept valid spider graph data', () => {
      const data: SpiderGraphData = {
        stats: [
          {
            name: 'math',
            displayName: 'Mathematics',
            value: 75,
            benchmark: 65,
            fullMark: 100,
          },
          {
            name: 'reading',
            displayName: 'Reading',
            value: 80,
            benchmark: 70,
            fullMark: 100,
          },
        ],
        meta: {
          level: 10,
          total_xp: 5000,
          assessment_date: '2025-01-15',
        },
      };

      expect(data.stats).toHaveLength(2);
      expect(data.meta.level).toBe(10);
    });
  });

  // ==========================================================================
  // API Response Types Tests
  // ==========================================================================

  describe('ForgeAPIResponse', () => {
    it('should accept successful response', () => {
      const response: ForgeAPIResponse<{ id: string }> = {
        success: true,
        data: { id: 'test-123' },
        message: 'Operation successful',
      };

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe('test-123');
    });

    it('should accept error response', () => {
      const response: ForgeAPIResponse<null> = {
        success: false,
        error: 'Something went wrong',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });
  });

  describe('XPAwardResult', () => {
    it('should accept XP award with level up', () => {
      const result: XPAwardResult = {
        previous_xp: 950,
        awarded_xp: 100,
        new_total: 1050,
        level_up: true,
        previous_level: 4,
        new_level: 5,
        new_title: 'Journeyman Scholar',
        achievements_unlocked: [],
      };

      expect(result.level_up).toBe(true);
      expect(result.new_level).toBe(5);
    });

    it('should accept XP award without level up', () => {
      const result: XPAwardResult = {
        previous_xp: 500,
        awarded_xp: 50,
        new_total: 550,
        level_up: false,
        previous_level: 3,
        new_level: 3,
        new_title: null,
        achievements_unlocked: [],
      };

      expect(result.level_up).toBe(false);
      expect(result.new_title).toBeNull();
    });
  });

  describe('StatUpdateResult', () => {
    it('should accept stat update result', () => {
      const result: StatUpdateResult = {
        stat_name: 'math',
        previous_value: 50,
        new_value: 55,
        change: 5,
        achievements_unlocked: [],
      };

      expect(result.stat_name).toBe('math');
      expect(result.change).toBe(5);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty stats array in character sheet', () => {
      const sheet: CharacterSheet = {
        id: 'char-empty',
        display_name: 'Empty Character',
        title: 'Apprentice Forger',
        level: 1,
        total_xp: 0,
        current_streak: 0,
        longest_streak: 0,
        last_session_at: null,
        avatar_url: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        stats: [],
        xp_to_next_level: 100,
        xp_progress_percent: 0,
        recent_achievements: [],
        active_quests: [],
      };

      expect(sheet.stats).toHaveLength(0);
    });

    it('should handle zero XP summary', () => {
      const summary: XPSummary = {
        today: 0,
        this_week: 0,
        this_month: 0,
        total: 0,
        by_source: {
          quest: 0,
          daily: 0,
          streak: 0,
          achievement: 0,
          srs: 0,
          srs_review: 0,
          intel: 0,
          intel_completed: 0,
          reflection: 0,
          reflection_completed: 0,
          bonus: 0,
          reading_session: 0,
          chapter_completed: 0,
          book_completed: 0,
          comprehension_response: 0,
          discussion_exchange: 0,
          discussion_completed: 0,
          diagnostic: 0,
          engagement: 0,
          study_pattern: 0,
        },
      };

      expect(summary.total).toBe(0);
      Object.values(summary.by_source).forEach((value) => {
        expect(value).toBe(0);
      });
    });

    it('should handle negative stat modifier', () => {
      const stat: StatWithTrend = {
        id: 'stat-negative',
        stat_name: 'writing',
        display_name: 'Writing',
        description: 'Writing skills',
        base_value: 60,
        current_value: 50,
        modifier: -10,
        last_assessed: Date.now(),
        assessment_confidence: 0.7,
        trend: 'down',
        change_7d: -10,
        benchmark: 55,
      };

      expect(stat.modifier).toBe(-10);
      expect(stat.change_7d).toBe(-10);
    });

    it('should handle maximum level', () => {
      const character: Character = {
        id: 'char-max',
        display_name: 'Max Level',
        title: 'Legendary Forger',
        level: 100,
        total_xp: 1000000,
        current_streak: 365,
        longest_streak: 365,
        last_session_at: Date.now(),
        avatar_url: null,
        created_at: Date.now() - 86400000 * 365,
        updated_at: Date.now(),
      };

      expect(character.level).toBe(100);
      expect(character.current_streak).toBe(365);
    });
  });
});
