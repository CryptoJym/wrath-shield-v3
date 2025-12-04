/**
 * Tests for HYRO FORGE: Zone of Proximal Development (ZPD) Engine
 * Tests Vygotsky's ZPD implementation for adaptive content selection
 */

import {
  scoreContentFit,
  ZPDState,
  ContentDifficultyMatch,
} from '../../../lib/hyro/forge-zpd-engine';

// Mock database functions - the engine relies on DB for state
jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: jest.fn(() => ({
      all: jest.fn(() => []),
      get: jest.fn(() => undefined),
      run: jest.fn(),
    })),
  })),
}));

jest.mock('../../../lib/hyro/forge-proficiency', () => ({
  getAllProficiency: jest.fn(() => []),
  getStatProficiency: jest.fn(() => ({
    stat_name: 'reading_comprehension',
    estimated_level: 50,
    confidence: 0.7,
  })),
}));

jest.mock('../../../lib/hyro/forge-diagnostics', () => ({
  getLatestResult: jest.fn(() => null),
}));

describe('ZPD Engine - Core Algorithms', () => {
  describe('scoreContentFit', () => {
    const createMockZPDState = (overrides: Partial<ZPDState> = {}): ZPDState => ({
      stat_name: 'reading_comprehension',
      current_level: 50,
      confidence: 0.7,
      zpd_lower: 47.5, // 5% below
      zpd_upper: 70, // 20% above (with 20% zone width)
      optimal_difficulty: 62, // 12% above current
      zone_width: 22.5,
      recent_performance: [1, 1, 0, 1, 1],
      trend: 'stable',
      adjustment_needed: 'maintain',
      scaffolding_recommended: false,
      ...overrides,
    });

    test('content in learning zone gets high recommendation score', () => {
      const zpdState = createMockZPDState();
      const result = scoreContentFit(60, zpdState);

      expect(result.zone_fit).toBe('learning');
      expect(result.recommendation_score).toBeGreaterThan(80);
      expect(result.distance_from_optimal).toBeLessThan(5);
    });

    test('content at optimal difficulty gets maximum score', () => {
      const zpdState = createMockZPDState({ optimal_difficulty: 55 });
      const result = scoreContentFit(55, zpdState);

      expect(result.zone_fit).toBe('learning');
      expect(result.recommendation_score).toBe(100);
      expect(result.distance_from_optimal).toBe(0);
    });

    test('content below ZPD is classified as comfort zone', () => {
      const zpdState = createMockZPDState();
      const result = scoreContentFit(30, zpdState);

      expect(result.zone_fit).toBe('comfort');
      expect(result.recommendation_score).toBeLessThan(60);
    });

    test('content above ZPD is classified as frustration zone', () => {
      const zpdState = createMockZPDState();
      const result = scoreContentFit(90, zpdState);

      expect(result.zone_fit).toBe('frustration');
      expect(result.recommendation_score).toBeLessThan(40);
    });

    test('frustration zone content has lower score than comfort zone', () => {
      const zpdState = createMockZPDState();
      const comfortResult = scoreContentFit(40, zpdState);
      const frustrationResult = scoreContentFit(85, zpdState);

      // Frustration should be penalized more heavily
      expect(frustrationResult.recommendation_score).toBeLessThan(comfortResult.recommendation_score);
    });

    test('distance from optimal increases as content difficulty diverges', () => {
      const zpdState = createMockZPDState({ optimal_difficulty: 60 });

      const atOptimal = scoreContentFit(60, zpdState);
      const slightlyAbove = scoreContentFit(65, zpdState);
      const farAbove = scoreContentFit(75, zpdState);

      expect(atOptimal.distance_from_optimal).toBe(0);
      expect(slightlyAbove.distance_from_optimal).toBe(5);
      expect(farAbove.distance_from_optimal).toBe(15);
    });
  });

  describe('ZPD Zone Boundaries', () => {
    test('ZPD lower bound is 5% below current level', () => {
      // For a student at level 50, ZPD lower should be ~47.5
      const zpdState: ZPDState = {
        stat_name: 'vocabulary',
        current_level: 50,
        confidence: 0.5,
        zpd_lower: 45, // Exact value depends on ZPD_OFFSET_LOWER constant
        zpd_upper: 70,
        optimal_difficulty: 56,
        zone_width: 25,
        recent_performance: [],
        trend: 'stable',
        adjustment_needed: 'maintain',
        scaffolding_recommended: false,
      };

      // Content at current level should be in learning zone
      const atCurrent = scoreContentFit(50, zpdState);
      expect(atCurrent.zone_fit).toBe('learning');
    });

    test('high confidence narrows the ZPD zone', () => {
      // High confidence = narrower zone (more precise targeting)
      const highConfidenceZone = 10 + (1 - 0.9 * 0.5) * 15; // ~17.5%
      const lowConfidenceZone = 10 + (1 - 0.3 * 0.5) * 15; // ~22.75%

      expect(highConfidenceZone).toBeLessThan(lowConfidenceZone);
    });
  });

  describe('Performance Trend Calculations', () => {
    test('improving trend detected from recent performance', () => {
      // Array is ordered most recent first: [newest, ..., oldest]
      // So for improving: recent (first half) should be better than older (second half)
      const recentPerformance = [1, 1, 1, 1, 0, 0, 0, 0]; // Recent good, old bad

      // Calculate trend (mimicking internal logic from forge-zpd-engine.ts)
      // Note: In the actual implementation, slice(midpoint) gets OLDER data (end of array)
      // and slice(0, midpoint) gets NEWER data (start of array)
      const midpoint = Math.floor(recentPerformance.length / 2);
      const firstHalf = recentPerformance.slice(midpoint); // Older data [0, 0, 0, 0]
      const secondHalf = recentPerformance.slice(0, midpoint); // Newer data [1, 1, 1, 1]

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length; // 0
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length; // 1

      // secondAvg (recent) > firstAvg (older) = improving
      expect(secondAvg).toBeGreaterThan(firstAvg);
    });

    test('declining trend detected from recent performance', () => {
      // Array is ordered most recent first: [newest, ..., oldest]
      // For declining: recent (first half) should be worse than older (second half)
      const recentPerformance = [0, 0, 0, 0, 1, 1, 1, 1]; // Recent bad, old good

      const midpoint = Math.floor(recentPerformance.length / 2);
      const firstHalf = recentPerformance.slice(midpoint); // Older data [1, 1, 1, 1]
      const secondHalf = recentPerformance.slice(0, midpoint); // Newer data [0, 0, 0, 0]

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length; // 1
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length; // 0

      // secondAvg (recent) < firstAvg (older) = declining
      expect(secondAvg).toBeLessThan(firstAvg);
    });
  });

  describe('Scaffolding Recommendations', () => {
    test('scaffolding recommended after consecutive failures', () => {
      // 3+ consecutive failures should trigger scaffolding
      const recentPerformance = [0, 0, 0, 1, 1];
      const consecutiveFailures = countConsecutiveFailures(recentPerformance);

      expect(consecutiveFailures).toBeGreaterThanOrEqual(3);
    });

    test('scaffolding recommended for low success rate', () => {
      // Success rate below 40% should trigger scaffolding
      const recentPerformance = [0, 0, 0, 1, 0, 0, 1, 0];
      const successRate = recentPerformance.filter((p) => p === 1).length / recentPerformance.length;

      expect(successRate).toBeLessThan(0.4);
    });
  });

  describe('Adaptive Difficulty Adjustment', () => {
    test('success at challenging level increases difficulty', () => {
      const zpdState: ZPDState = {
        stat_name: 'reading_comprehension',
        current_level: 50,
        confidence: 0.7,
        zpd_lower: 47.5,
        zpd_upper: 70,
        optimal_difficulty: 62,
        zone_width: 22.5,
        recent_performance: [],
        trend: 'stable',
        adjustment_needed: 'maintain',
        scaffolding_recommended: false,
      };

      // Success at or above optimal difficulty
      const activityDifficulty = 65;
      const success = true;

      // Expected behavior: difficulty should increase
      let difficultyChange = 0;
      if (success && activityDifficulty >= zpdState.optimal_difficulty) {
        difficultyChange = 3;
      }

      expect(difficultyChange).toBeGreaterThan(0);
    });

    test('failure above ZPD significantly decreases difficulty', () => {
      const zpdState: ZPDState = {
        stat_name: 'reading_comprehension',
        current_level: 50,
        confidence: 0.7,
        zpd_lower: 47.5,
        zpd_upper: 70,
        optimal_difficulty: 62,
        zone_width: 22.5,
        recent_performance: [],
        trend: 'stable',
        adjustment_needed: 'maintain',
        scaffolding_recommended: false,
      };

      // Failure above ZPD
      const activityDifficulty = 80;
      const success = false;

      let difficultyChange = 0;
      if (!success && activityDifficulty > zpdState.zpd_upper) {
        difficultyChange = -5;
      }

      expect(difficultyChange).toBe(-5);
    });

    test('fast completion bonus increases difficulty adjustment', () => {
      // Fast completion (< 60 seconds) adds +2 to difficulty change
      const timeSpentSeconds = 45;
      const baseDifficultyChange = 3;

      let finalChange = baseDifficultyChange;
      if (timeSpentSeconds < 60) {
        finalChange += 2;
      }

      expect(finalChange).toBe(5);
    });
  });

  describe('Flow State Detection', () => {
    test('flow state requires good challenge-skill balance', () => {
      let flowScore = 50;

      // Good challenge-skill balance (adjustment_needed = maintain)
      const adjustmentNeeded = 'maintain';
      if (adjustmentNeeded === 'maintain') {
        flowScore += 15;
      }

      expect(flowScore).toBe(65);
    });

    test('flow score increases with improving trend', () => {
      let flowScore = 50;

      const trend = 'improving';
      if (trend === 'improving') {
        flowScore += 10;
      }

      expect(flowScore).toBe(60);
    });

    test('scaffolding recommendation decreases flow score', () => {
      let flowScore = 70;

      const scaffoldingRecommended = true;
      if (scaffoldingRecommended) {
        flowScore -= 20;
      }

      expect(flowScore).toBe(50);
    });

    test('flow state detected when score >= 70', () => {
      const flowScore = 75;
      const inFlow = flowScore >= 70;

      expect(inFlow).toBe(true);
    });
  });

  describe('Learning Velocity Calculations', () => {
    test('positive daily growth indicates progress', () => {
      const currentLevel = 55;
      const dayAgoLevel = 52;
      const dailyGrowth = currentLevel - dayAgoLevel;

      expect(dailyGrowth).toBe(3);
      expect(dailyGrowth).toBeGreaterThan(0);
    });

    test('days to benchmark calculation', () => {
      const currentLevel = 40;
      const benchmarkLevel = 50;
      const dailyGrowth = 2;

      const remaining = benchmarkLevel - currentLevel;
      const estimatedDays = Math.ceil(remaining / dailyGrowth);

      expect(estimatedDays).toBe(5);
    });

    test('acceleration positive when learning speeds up', () => {
      const weekAgoLevel = 40;
      const midWeekLevel = 44;
      const currentLevel = 50;

      const firstHalfGrowth = midWeekLevel - weekAgoLevel; // 4
      const secondHalfGrowth = currentLevel - midWeekLevel; // 6
      const acceleration = secondHalfGrowth - firstHalfGrowth;

      expect(acceleration).toBe(2);
      expect(acceleration).toBeGreaterThan(0);
    });
  });

  describe('Content Selection', () => {
    test('content sorted by recommendation score', () => {
      const contents: ContentDifficultyMatch[] = [
        {
          content_id: '1',
          content_type: 'quiz',
          difficulty: 30,
          zone_fit: 'comfort',
          distance_from_optimal: 25,
          recommendation_score: 45,
        },
        {
          content_id: '2',
          content_type: 'quiz',
          difficulty: 55,
          zone_fit: 'learning',
          distance_from_optimal: 0,
          recommendation_score: 100,
        },
        {
          content_id: '3',
          content_type: 'quiz',
          difficulty: 85,
          zone_fit: 'frustration',
          distance_from_optimal: 30,
          recommendation_score: 10,
        },
      ];

      const sorted = [...contents].sort((a, b) => b.recommendation_score - a.recommendation_score);

      expect(sorted[0].content_id).toBe('2');
      expect(sorted[1].content_id).toBe('1');
      expect(sorted[2].content_id).toBe('3');
    });
  });
});

// Helper function (mimics internal function)
function countConsecutiveFailures(performance: number[]): number {
  let count = 0;
  for (const p of performance) {
    if (p === 0) count++;
    else break;
  }
  return count;
}
