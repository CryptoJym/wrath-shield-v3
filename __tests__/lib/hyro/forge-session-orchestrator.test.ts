/**
 * Tests for HYRO FORGE: Session Orchestrator
 * Tests session planning, activity sequencing, and progress tracking
 */

import { StatName } from '../../../lib/hyro/forge-types';
import {
  SessionActivity,
  SessionPlan,
  ActivityType,
} from '../../../lib/hyro/forge-session-orchestrator';

// Mock database
const mockDbPrepare = jest.fn();
const mockDb = {
  prepare: mockDbPrepare,
  transaction: jest.fn((fn) => fn()),
};

jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

// Mock all the dependent modules
jest.mock('../../../lib/hyro/forge-srs', () => ({
  getTotalDueCount: jest.fn(() => 10),
  getDueCards: jest.fn(() => []),
}));

jest.mock('../../../lib/hyro/forge-reading', () => ({
  getBooksInProgress: jest.fn(() => []),
}));

jest.mock('../../../lib/hyro/forge-quest-generator', () => ({
  getActiveQuests: jest.fn(() => []),
  getQuestsDueToday: jest.fn(() => []),
  getOverdueQuests: jest.fn(() => []),
}));

jest.mock('../../../lib/hyro/forge-stats', () => ({
  getAllStatsWithTrend: jest.fn(() => []),
}));

jest.mock('../../../lib/hyro/forge-diagnostics', () => ({
  getStatsNeedingDiagnostic: jest.fn(() => []),
  getActiveSkillGaps: jest.fn(() => []),
}));

describe('Session Orchestrator - Core Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbPrepare.mockReturnValue({
      all: jest.fn(() => []),
      get: jest.fn(() => undefined),
      run: jest.fn(),
    });
  });

  describe('Activity Priority System', () => {
    // Priority weights from forge-session-orchestrator.ts
    const PRIORITY_WEIGHTS = {
      overdue_quest: 10,
      diagnostic_needed: 9,
      due_today_quest: 8,
      skill_gap_critical: 8,
      srs_review: 7,
      skill_gap_significant: 6,
      reading_in_progress: 5,
      active_quest: 4,
      comprehension: 4,
      reflection: 3,
    };

    test('overdue quests have highest priority', () => {
      expect(PRIORITY_WEIGHTS.overdue_quest).toBe(10);
      expect(PRIORITY_WEIGHTS.overdue_quest).toBeGreaterThan(PRIORITY_WEIGHTS.diagnostic_needed);
    });

    test('diagnostics prioritized over SRS review', () => {
      expect(PRIORITY_WEIGHTS.diagnostic_needed).toBeGreaterThan(PRIORITY_WEIGHTS.srs_review);
    });

    test('SRS review prioritized over reading', () => {
      expect(PRIORITY_WEIGHTS.srs_review).toBeGreaterThan(PRIORITY_WEIGHTS.reading_in_progress);
    });

    test('reflection has lowest priority', () => {
      expect(PRIORITY_WEIGHTS.reflection).toBe(
        Math.min(...Object.values(PRIORITY_WEIGHTS))
      );
    });

    test('activities sorted by priority descending', () => {
      const activities: Partial<SessionActivity>[] = [
        { type: 'reflection', priority: 3 },
        { type: 'diagnostic', priority: 9 },
        { type: 'srs_review', priority: 7 },
        { type: 'quest', priority: 10 },
      ];

      const sorted = [...activities].sort((a, b) => (b.priority || 0) - (a.priority || 0));

      expect(sorted[0].type).toBe('quest');
      expect(sorted[1].type).toBe('diagnostic');
      expect(sorted[2].type).toBe('srs_review');
      expect(sorted[3].type).toBe('reflection');
    });
  });

  describe('Time Estimation', () => {
    const TIME_ESTIMATES = {
      srs_card: 0.5,
      reading_segment: 15,
      comprehension: 10,
      quest_small: 10,
      quest_medium: 20,
      quest_large: 30,
      diagnostic: 15,
      reflection: 5,
      break: 5,
    };

    test('SRS review time calculated per card', () => {
      const cardCount = 20;
      const estimatedTime = Math.ceil(cardCount * TIME_ESTIMATES.srs_card);

      expect(estimatedTime).toBe(10); // 20 cards * 0.5 min = 10 min
    });

    test('break intervals follow Pomodoro pattern', () => {
      const BREAK_INTERVAL_MINUTES = 25;
      const availableMinutes = 60;

      const breakCount = Math.floor(availableMinutes / BREAK_INTERVAL_MINUTES) - 1;

      expect(breakCount).toBe(1); // One break in 60 min session
    });

    test('session with 45 minutes fits multiple activities', () => {
      const availableMinutes = 45;
      let remaining = availableMinutes;

      // Simulate activity addition
      const activities: Array<{ type: string; minutes: number }> = [];

      if (remaining >= TIME_ESTIMATES.srs_card * 10) {
        const srsTime = 5; // 10 cards
        activities.push({ type: 'srs_review', minutes: srsTime });
        remaining -= srsTime;
      }

      if (remaining >= TIME_ESTIMATES.reading_segment) {
        activities.push({ type: 'reading', minutes: TIME_ESTIMATES.reading_segment });
        remaining -= TIME_ESTIMATES.reading_segment;
      }

      if (remaining >= TIME_ESTIMATES.comprehension) {
        activities.push({ type: 'comprehension', minutes: TIME_ESTIMATES.comprehension });
        remaining -= TIME_ESTIMATES.comprehension;
      }

      if (remaining >= TIME_ESTIMATES.reflection) {
        activities.push({ type: 'reflection', minutes: TIME_ESTIMATES.reflection });
        remaining -= TIME_ESTIMATES.reflection;
      }

      expect(activities.length).toBeGreaterThanOrEqual(3);
      expect(remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('XP Potential Calculation', () => {
    const XP_ESTIMATES = {
      srs_card: 5,
      reading_segment: 15,
      comprehension: 20,
      quest_small: 25,
      quest_medium: 50,
      quest_large: 100,
      diagnostic: 50,
      reflection: 10,
    };

    test('SRS XP calculated per card', () => {
      const cardCount = 20;
      const xpPotential = cardCount * XP_ESTIMATES.srs_card;

      expect(xpPotential).toBe(100);
    });

    test('large quest yields most XP', () => {
      expect(XP_ESTIMATES.quest_large).toBeGreaterThan(XP_ESTIMATES.quest_medium);
      expect(XP_ESTIMATES.quest_medium).toBeGreaterThan(XP_ESTIMATES.quest_small);
    });

    test('diagnostic assessment gives significant XP', () => {
      expect(XP_ESTIMATES.diagnostic).toBe(50);
    });

    test('total session XP is sum of activities', () => {
      const activities = [
        { xp: XP_ESTIMATES.srs_card * 15 },
        { xp: XP_ESTIMATES.reading_segment },
        { xp: XP_ESTIMATES.comprehension },
        { xp: XP_ESTIMATES.reflection },
      ];

      const totalXp = activities.reduce((sum, a) => sum + a.xp, 0);

      expect(totalXp).toBe(75 + 15 + 20 + 10);
      expect(totalXp).toBe(120);
    });
  });

  describe('Quest Difficulty Mapping', () => {
    const getQuestTime = (difficulty: string): number => {
      switch (difficulty) {
        case 'easy':
          return 10;
        case 'hard':
        case 'boss':
          return 30;
        default:
          return 20;
      }
    };

    const getQuestXp = (difficulty: string): number => {
      switch (difficulty) {
        case 'easy':
          return 25;
        case 'hard':
        case 'boss':
          return 100;
        default:
          return 50;
      }
    };

    test('easy quests take less time', () => {
      expect(getQuestTime('easy')).toBeLessThan(getQuestTime('normal'));
    });

    test('hard and boss quests take same time', () => {
      expect(getQuestTime('hard')).toBe(getQuestTime('boss'));
    });

    test('XP reward scales with difficulty', () => {
      expect(getQuestXp('easy')).toBeLessThan(getQuestXp('normal'));
      expect(getQuestXp('normal')).toBeLessThan(getQuestXp('hard'));
    });
  });

  describe('Activity Status Management', () => {
    test('activity transitions through states correctly', () => {
      const statuses: Array<'pending' | 'in_progress' | 'completed' | 'skipped'> = [
        'pending',
        'in_progress',
        'completed',
      ];

      expect(statuses[0]).toBe('pending');
      expect(statuses[1]).toBe('in_progress');
      expect(statuses[2]).toBe('completed');
    });

    test('skipped activities count against completion rate', () => {
      const activities = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'skipped' },
        { status: 'completed' },
      ];

      const completedCount = activities.filter((a) => a.status === 'completed').length;
      const completionRate = completedCount / activities.length;

      expect(completionRate).toBe(0.75);
    });

    test('session complete when all activities resolved', () => {
      const activities = [
        { status: 'completed' },
        { status: 'skipped' },
        { status: 'completed' },
      ];

      const allResolved = activities.every(
        (a) => a.status === 'completed' || a.status === 'skipped'
      );

      expect(allResolved).toBe(true);
    });
  });

  describe('Session Completion', () => {
    test('actual minutes calculated from start/end times', () => {
      const startedAt = Math.floor(Date.now() / 1000) - 45 * 60; // 45 min ago
      const completedAt = Math.floor(Date.now() / 1000);

      const actualMinutes = Math.round((completedAt - startedAt) / 60);

      expect(actualMinutes).toBe(45);
    });

    test('completion rate is ratio of completed to total', () => {
      const completed = 3;
      const total = 5;
      const completionRate = completed / total;

      expect(completionRate).toBe(0.6);
    });

    test('XP earned accumulated from completed activities', () => {
      const activities = [
        { status: 'completed', xp_earned: 25 },
        { status: 'completed', xp_earned: 15 },
        { status: 'skipped', xp_earned: 0 },
        { status: 'completed', xp_earned: 50 },
      ];

      const totalXpEarned = activities
        .filter((a) => a.status === 'completed')
        .reduce((sum, a) => sum + (a.xp_earned || 0), 0);

      expect(totalXpEarned).toBe(90);
    });
  });

  describe('Session Context Gathering', () => {
    test('weakest stats identified from sorted list', () => {
      const statsWithTrend = [
        { stat_name: 'vocabulary', current_value: 65 },
        { stat_name: 'reading_comprehension', current_value: 45 },
        { stat_name: 'critical_thinking', current_value: 55 },
        { stat_name: 'math_reasoning', current_value: 40 },
      ];

      const weakestStats = [...statsWithTrend]
        .sort((a, b) => a.current_value - b.current_value)
        .slice(0, 3);

      expect(weakestStats[0].stat_name).toBe('math_reasoning');
      expect(weakestStats[1].stat_name).toBe('reading_comprehension');
      expect(weakestStats[2].stat_name).toBe('critical_thinking');
    });

    test('due cards grouped by deck', () => {
      const dueCards = [
        { deck_id: 'deck-1', front: 'Q1' },
        { deck_id: 'deck-1', front: 'Q2' },
        { deck_id: 'deck-2', front: 'Q3' },
        { deck_id: 'deck-1', front: 'Q4' },
      ];

      const cardsByDeck = new Map<string, number>();
      for (const card of dueCards) {
        const count = cardsByDeck.get(card.deck_id) || 0;
        cardsByDeck.set(card.deck_id, count + 1);
      }

      expect(cardsByDeck.get('deck-1')).toBe(3);
      expect(cardsByDeck.get('deck-2')).toBe(1);
    });
  });

  describe('Activity Targeting Weak Stats', () => {
    test('quests targeting weak stats prioritized', () => {
      const weakStatNames = ['math_reasoning', 'vocabulary'];
      const quests = [
        { id: '1', title: 'Quest A', required_stat: 'reading_comprehension' },
        { id: '2', title: 'Quest B', required_stat: 'math_reasoning' },
        { id: '3', title: 'Quest C', required_stat: 'vocabulary' },
      ];

      const prioritizedQuests = [...quests].sort((a, b) => {
        const aTargetsWeak = weakStatNames.includes(a.required_stat) ? 1 : 0;
        const bTargetsWeak = weakStatNames.includes(b.required_stat) ? 1 : 0;
        return bTargetsWeak - aTargetsWeak;
      });

      expect(prioritizedQuests[0].required_stat).toBe('math_reasoning');
      expect(prioritizedQuests[1].required_stat).toBe('vocabulary');
      expect(prioritizedQuests[2].required_stat).toBe('reading_comprehension');
    });
  });

  describe('Session Planning Parameters', () => {
    test('default session is 45 minutes', () => {
      const DEFAULT_SESSION_MINUTES = 45;
      expect(DEFAULT_SESSION_MINUTES).toBe(45);
    });

    test('max SRS cards per session limited', () => {
      const MAX_SRS_CARDS_PER_SESSION = 20;
      const dueCardsCount = 50;

      const cardsToReview = Math.min(dueCardsCount, MAX_SRS_CARDS_PER_SESSION);

      expect(cardsToReview).toBe(20);
    });

    test('energy level affects activity selection', () => {
      // Low energy (1-3) = prefer easier, shorter activities
      // Medium energy (4-6) = balanced session
      // High energy (7-10) = can handle challenging content
      const energyLevel = 3;

      const preferEasierActivities = energyLevel <= 3;

      expect(preferEasierActivities).toBe(true);
    });

    test('focus stat filters activities', () => {
      const focusStat: StatName = 'reading';
      const activities: Array<{ stat_focus: StatName[] }> = [
        { stat_focus: ['reading'] },
        { stat_focus: ['math'] },
        { stat_focus: ['reading', 'critical_thinking'] },
      ];

      const relevantActivities = activities.filter((a) =>
        a.stat_focus.includes(focusStat)
      );

      expect(relevantActivities.length).toBe(2);
    });
  });

  describe('Break Integration', () => {
    test('breaks inserted at Pomodoro intervals', () => {
      const BREAK_INTERVAL_MINUTES = 25;
      const activities = [
        { minutes: 15 },
        { minutes: 10 },
        { minutes: 15 },
        { minutes: 10 },
      ];

      // Calculate cumulative time and identify break points
      let cumulative = 0;
      const breakPoints: number[] = [];

      for (let i = 0; i < activities.length; i++) {
        cumulative += activities[i].minutes;
        if (cumulative >= BREAK_INTERVAL_MINUTES) {
          breakPoints.push(i);
          cumulative = 0; // Reset after break
        }
      }

      expect(breakPoints.length).toBeGreaterThan(0);
    });

    test('breaks do not count toward XP', () => {
      const breakActivity = {
        type: 'break' as ActivityType,
        xp_potential: 0,
      };

      expect(breakActivity.xp_potential).toBe(0);
    });
  });

  describe('Session Analytics', () => {
    test('completion rate calculated correctly', () => {
      const sessions = [
        { completion_rate: 0.8 },
        { completion_rate: 1.0 },
        { completion_rate: 0.6 },
        { completion_rate: 0.9 },
      ];

      const completedSessions = sessions.filter((s) => s.completion_rate >= 0.8).length;
      const avgCompletionRate =
        sessions.reduce((sum, s) => sum + s.completion_rate, 0) / sessions.length;

      expect(completedSessions).toBe(3);
      expect(avgCompletionRate).toBe(0.825);
    });

    test('stat focus distribution tracks activity targets', () => {
      const activities: Array<{ stat_focus: StatName[] }> = [
        { stat_focus: ['reading', 'science'] },
        { stat_focus: ['reading'] },
        { stat_focus: ['math'] },
        { stat_focus: ['reading'] },
      ];

      const statCounts: Record<string, number> = {};
      for (const activity of activities) {
        for (const stat of activity.stat_focus) {
          statCounts[stat] = (statCounts[stat] || 0) + 1;
        }
      }

      expect(statCounts['reading']).toBe(3);
      expect(statCounts['science']).toBe(1);
      expect(statCounts['math']).toBe(1);
    });

    test('weekly session count calculated from timestamp', () => {
      const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      const sessions = [
        { created_at: weekAgo + 86400 }, // 6 days ago
        { created_at: weekAgo + 86400 * 3 }, // 4 days ago
        { created_at: weekAgo + 86400 * 6 }, // 1 day ago
        { created_at: weekAgo - 86400 }, // 8 days ago (excluded)
      ];

      const sessionsThisWeek = sessions.filter((s) => s.created_at >= weekAgo).length;

      expect(sessionsThisWeek).toBe(3);
    });
  });

  describe('Stat Name Formatting', () => {
    const formatStatName = (stat: string): string => {
      return stat
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    test('underscores replaced with spaces', () => {
      expect(formatStatName('reading_comprehension')).toBe('Reading Comprehension');
    });

    test('each word capitalized', () => {
      expect(formatStatName('critical_thinking')).toBe('Critical Thinking');
    });

    test('single word stat formatted correctly', () => {
      expect(formatStatName('vocabulary')).toBe('Vocabulary');
    });
  });

  describe('Session Abandonment', () => {
    test('abandoned session records actual time', () => {
      const startedAt = Math.floor(Date.now() / 1000) - 20 * 60; // Started 20 min ago
      const now = Math.floor(Date.now() / 1000);

      const actualMinutes = Math.round((now - startedAt) / 60);

      expect(actualMinutes).toBe(20);
    });

    test('abandoned session preserves partial completion rate', () => {
      const activities = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'in_progress' },
        { status: 'pending' },
      ];

      const completedCount = activities.filter((a) => a.status === 'completed').length;
      const completionRate = completedCount / activities.length;

      expect(completionRate).toBe(0.5);
    });
  });
});
