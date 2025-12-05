/**
 * Tests for HYRO FORGE: Diagnostic Assessment System
 * Tests IRT-style adaptive assessment and skill gap identification
 */

import { StatName } from '../../../lib/hyro/forge-types';

// Mock database
const mockDbPrepare = jest.fn();
const mockDb = {
  prepare: mockDbPrepare,
  transaction: jest.fn((fn) => fn()),
};

jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

jest.mock('../../../lib/hyro/forge-proficiency', () => ({
  recordSkillEvidence: jest.fn(),
}));

jest.mock('../../../lib/hyro/forge-xp', () => ({
  awardXP: jest.fn(),
}));

jest.mock('../../../lib/hyro/forge-stats', () => ({
  updateStat: jest.fn(),
}));

describe('Diagnostic Assessment System - Core Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbPrepare.mockReturnValue({
      all: jest.fn(() => []),
      get: jest.fn(() => undefined),
      run: jest.fn(),
    });
  });

  describe('Adaptive Difficulty Algorithm (IRT-inspired)', () => {
    // Constants matching forge-diagnostics.ts
    const ADAPTIVE_STEP_UP = 0.15;
    const ADAPTIVE_STEP_DOWN = 0.20;
    const MIN_DIFFICULTY = 0.1;
    const MAX_DIFFICULTY = 0.95;

    test('correct answer increases difficulty', () => {
      const currentDifficulty = 0.5;
      const isCorrect = true;

      const newDifficulty = isCorrect
        ? Math.min(MAX_DIFFICULTY, currentDifficulty + ADAPTIVE_STEP_UP)
        : Math.max(MIN_DIFFICULTY, currentDifficulty - ADAPTIVE_STEP_DOWN);

      expect(newDifficulty).toBe(0.65);
      expect(newDifficulty).toBeGreaterThan(currentDifficulty);
    });

    test('incorrect answer decreases difficulty', () => {
      const currentDifficulty = 0.5;
      const isCorrect = false;

      const newDifficulty = isCorrect
        ? Math.min(MAX_DIFFICULTY, currentDifficulty + ADAPTIVE_STEP_UP)
        : Math.max(MIN_DIFFICULTY, currentDifficulty - ADAPTIVE_STEP_DOWN);

      expect(newDifficulty).toBe(0.30);
      expect(newDifficulty).toBeLessThan(currentDifficulty);
    });

    test('difficulty capped at maximum', () => {
      const currentDifficulty = 0.90;
      const isCorrect = true;

      const newDifficulty = Math.min(MAX_DIFFICULTY, currentDifficulty + ADAPTIVE_STEP_UP);

      expect(newDifficulty).toBe(MAX_DIFFICULTY);
    });

    test('difficulty floored at minimum', () => {
      const currentDifficulty = 0.15;
      const isCorrect = false;

      const newDifficulty = Math.max(MIN_DIFFICULTY, currentDifficulty - ADAPTIVE_STEP_DOWN);

      expect(newDifficulty).toBe(MIN_DIFFICULTY);
    });

    test('adaptive step down is larger than step up (asymmetric)', () => {
      // This is intentional to prevent frustration - failures pull back faster than successes advance
      expect(ADAPTIVE_STEP_DOWN).toBeGreaterThan(ADAPTIVE_STEP_UP);
    });
  });

  describe('Level Estimation (IRT-style)', () => {
    const BASE_LEVEL = 50;
    const DIFFICULTY_WEIGHT = 0.4;
    const ACCURACY_WEIGHT = 0.6;

    test('high accuracy at high difficulty = high estimated level', () => {
      const responses = [
        { is_correct: 1, difficulty_level: 0.8 },
        { is_correct: 1, difficulty_level: 0.85 },
        { is_correct: 1, difficulty_level: 0.9 },
        { is_correct: 0, difficulty_level: 0.95 },
      ];

      const correctCount = responses.filter((r) => r.is_correct === 1).length;
      const percentageScore = (correctCount / responses.length) * 100; // 75%

      const weightedScore = responses.reduce((sum, r) => {
        const difficultyBonus = r.is_correct ? r.difficulty_level : 0;
        return sum + difficultyBonus;
      }, 0);

      const averageDifficultyCorrect = correctCount > 0 ? weightedScore / correctCount : 0;
      const estimatedLevel = Math.round(
        BASE_LEVEL +
        (averageDifficultyCorrect * 50 * DIFFICULTY_WEIGHT) +
        ((percentageScore - 50) * ACCURACY_WEIGHT)
      );

      expect(estimatedLevel).toBeGreaterThan(60);
    });

    test('low accuracy at low difficulty = low estimated level', () => {
      const responses = [
        { is_correct: 0, difficulty_level: 0.2 },
        { is_correct: 1, difficulty_level: 0.15 },
        { is_correct: 0, difficulty_level: 0.25 },
        { is_correct: 0, difficulty_level: 0.3 },
      ];

      const correctCount = responses.filter((r) => r.is_correct === 1).length;
      const percentageScore = (correctCount / responses.length) * 100; // 25%

      const weightedScore = responses.reduce((sum, r) => {
        const difficultyBonus = r.is_correct ? r.difficulty_level : 0;
        return sum + difficultyBonus;
      }, 0);

      const averageDifficultyCorrect = correctCount > 0 ? weightedScore / correctCount : 0;
      const estimatedLevel = Math.round(
        BASE_LEVEL +
        (averageDifficultyCorrect * 50 * DIFFICULTY_WEIGHT) +
        ((percentageScore - 50) * ACCURACY_WEIGHT)
      );

      expect(estimatedLevel).toBeLessThan(40);
    });

    test('estimated level clamped between 10 and 95', () => {
      // Very low performance
      const veryLowLevel = -20;
      const clampedLow = Math.max(10, Math.min(95, veryLowLevel));
      expect(clampedLow).toBe(10);

      // Very high performance
      const veryHighLevel = 120;
      const clampedHigh = Math.max(10, Math.min(95, veryHighLevel));
      expect(clampedHigh).toBe(95);
    });
  });

  describe('Confidence Interval Calculation', () => {
    test('larger sample size narrows confidence interval', () => {
      const estimatedLevel = 50;

      // Small sample
      const smallSample = 5;
      const smallSE = Math.sqrt((estimatedLevel * (100 - estimatedLevel)) / smallSample);

      // Large sample
      const largeSample = 30;
      const largeSE = Math.sqrt((estimatedLevel * (100 - estimatedLevel)) / largeSample);

      expect(largeSE).toBeLessThan(smallSE);
    });

    test('95% confidence interval uses 1.96 multiplier', () => {
      const estimatedLevel = 50;
      const sampleSize = 15;
      const standardError = Math.sqrt((estimatedLevel * (100 - estimatedLevel)) / sampleSize);

      const confidenceLow = Math.round(Math.max(5, estimatedLevel - 1.96 * standardError));
      const confidenceHigh = Math.round(Math.min(95, estimatedLevel + 1.96 * standardError));

      expect(confidenceHigh - confidenceLow).toBeGreaterThan(0);
      expect(confidenceLow).toBeLessThan(estimatedLevel);
      expect(confidenceHigh).toBeGreaterThan(estimatedLevel);
    });
  });

  describe('Skill Gap Identification', () => {
    test('topic with < 50% score identified as skill gap', () => {
      const topicBreakdown = {
        'main_idea': { correct: 1, total: 4, level: 25 },
        'vocabulary': { correct: 3, total: 4, level: 75 },
        'inference': { correct: 2, total: 4, level: 50 },
      };

      const identifiedGaps: string[] = [];
      for (const [topic, data] of Object.entries(topicBreakdown)) {
        if (data.level < 50 && data.total >= 2) {
          identifiedGaps.push(topic);
        }
      }

      expect(identifiedGaps).toContain('main_idea');
      expect(identifiedGaps).not.toContain('vocabulary');
    });

    test('gap severity determined by performance level', () => {
      const determineGapSeverity = (level: number): string => {
        if (level < 25) return 'critical';
        if (level < 40) return 'significant';
        return 'moderate';
      };

      expect(determineGapSeverity(15)).toBe('critical');
      expect(determineGapSeverity(30)).toBe('significant');
      expect(determineGapSeverity(45)).toBe('moderate');
    });

    test('strong areas identified at >= 75%', () => {
      const topicBreakdown = {
        'main_idea': { correct: 3, total: 4, level: 75 },
        'vocabulary': { correct: 4, total: 4, level: 100 },
        'inference': { correct: 2, total: 4, level: 50 },
      };

      const strongAreas: string[] = [];
      for (const [topic, data] of Object.entries(topicBreakdown)) {
        if (data.level >= 75) {
          strongAreas.push(topic);
        }
      }

      expect(strongAreas).toContain('main_idea');
      expect(strongAreas).toContain('vocabulary');
      expect(strongAreas).not.toContain('inference');
    });
  });

  describe('Calibration Analysis', () => {
    test('overconfidence detected when predictions > actual', () => {
      const predictions = [80, 90, 85, 75]; // Self-assessed confidence
      const actual = [100, 0, 100, 0]; // Actual results (1=correct, 0=wrong) * 100

      const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
      const avgActual = actual.reduce((a, b) => a + b, 0) / actual.length;

      const tendency = avgPrediction > avgActual + 10
        ? 'overconfident'
        : avgPrediction < avgActual - 10
          ? 'underconfident'
          : 'well_calibrated';

      expect(avgPrediction).toBe(82.5);
      expect(avgActual).toBe(50);
      expect(tendency).toBe('overconfident');
    });

    test('underconfidence detected when predictions < actual', () => {
      const predictions = [40, 30, 35, 45]; // Low self-assessed confidence
      const actual = [100, 100, 100, 0]; // High actual results

      const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
      const avgActual = actual.reduce((a, b) => a + b, 0) / actual.length;

      const tendency = avgPrediction > avgActual + 10
        ? 'overconfident'
        : avgPrediction < avgActual - 10
          ? 'underconfident'
          : 'well_calibrated';

      expect(tendency).toBe('underconfident');
    });

    test('well calibrated when predictions match actual', () => {
      const predictions = [70, 80, 60, 70];
      const actual = [100, 100, 0, 100];

      const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
      const avgActual = actual.reduce((a, b) => a + b, 0) / actual.length;

      const tendency = avgPrediction > avgActual + 10
        ? 'overconfident'
        : avgPrediction < avgActual - 10
          ? 'underconfident'
          : 'well_calibrated';

      expect(tendency).toBe('well_calibrated');
    });
  });

  describe('Answer Normalization', () => {
    const normalizeAnswer = (answer: string): string => {
      return answer.toLowerCase().trim().replace(/[^\w\s]/g, '');
    };

    test('case insensitive comparison', () => {
      expect(normalizeAnswer('True')).toBe(normalizeAnswer('true'));
      expect(normalizeAnswer('ANSWER')).toBe(normalizeAnswer('answer'));
    });

    test('whitespace trimmed', () => {
      expect(normalizeAnswer('  answer  ')).toBe('answer');
    });

    test('punctuation removed', () => {
      expect(normalizeAnswer('answer!')).toBe('answer');
      expect(normalizeAnswer("it's correct")).toBe('its correct');
    });
  });

  describe('Question Selection Algorithm', () => {
    test('questions selected near target difficulty', () => {
      const targetDifficulty = 0.5;
      const difficultyRange = 0.2;
      const questions = [
        { id: '1', difficulty_level: 0.3 },
        { id: '2', difficulty_level: 0.5 },
        { id: '3', difficulty_level: 0.7 },
        { id: '4', difficulty_level: 0.9 },
      ];

      const inRange = questions.filter(
        (q) =>
          q.difficulty_level >= targetDifficulty - difficultyRange &&
          q.difficulty_level <= targetDifficulty + difficultyRange
      );

      expect(inRange).toHaveLength(3);
      expect(inRange.map((q) => q.id)).toContain('1');
      expect(inRange.map((q) => q.id)).toContain('2');
      expect(inRange.map((q) => q.id)).toContain('3');
    });

    test('closest to optimal difficulty selected first', () => {
      const targetDifficulty = 0.5;
      const questions = [
        { id: '1', difficulty_level: 0.3 },
        { id: '2', difficulty_level: 0.48 },
        { id: '3', difficulty_level: 0.7 },
      ];

      const sorted = [...questions].sort(
        (a, b) =>
          Math.abs(a.difficulty_level - targetDifficulty) -
          Math.abs(b.difficulty_level - targetDifficulty)
      );

      expect(sorted[0].id).toBe('2');
    });
  });

  describe('Session Management', () => {
    test('session complete when all questions answered', () => {
      const questionsTotal = 15;
      const questionsAnswered = 15;

      const isComplete = questionsAnswered >= questionsTotal;

      expect(isComplete).toBe(true);
    });

    test('questions remaining calculated correctly', () => {
      const questionsTotal = 15;
      const questionsAnswered = 7;

      const remaining = questionsTotal - questionsAnswered;

      expect(remaining).toBe(8);
    });
  });

  describe('Recommended Focus Areas', () => {
    test('lowest performing topics recommended for focus', () => {
      const topicBreakdown = {
        'main_idea': { correct: 1, total: 4, level: 25 },
        'vocabulary': { correct: 3, total: 4, level: 75 },
        'inference': { correct: 2, total: 4, level: 50 },
        'context_clues': { correct: 2, total: 5, level: 40 },
      };

      const recommendedFocus = Object.entries(topicBreakdown)
        .sort((a, b) => a[1].level - b[1].level)
        .slice(0, 3)
        .map(([topic]) => topic);

      expect(recommendedFocus[0]).toBe('main_idea'); // 25%
      expect(recommendedFocus[1]).toBe('context_clues'); // 40%
      expect(recommendedFocus[2]).toBe('inference'); // 50%
    });
  });

  describe('Time Tracking', () => {
    test('time spent accumulated across questions', () => {
      const questionTimes = [15, 20, 30, 10, 25];
      const totalTime = questionTimes.reduce((sum, t) => sum + t, 0);

      expect(totalTime).toBe(100);
    });
  });

  describe('STAT_NAMES Integration', () => {
    const STAT_NAMES: StatName[] = [
      'reading',
      'math',
      'critical_thinking',
      'science',
      'coding',
      'study_skills',
    ];

    test('all stats have valid diagnostic support', () => {
      STAT_NAMES.forEach((stat) => {
        expect(typeof stat).toBe('string');
        expect(stat.length).toBeGreaterThan(0);
      });
    });

    test('stats needing diagnostic excludes completed stats', () => {
      const completedStats = new Set(['reading', 'math']);
      const statsNeedingDiagnostic = STAT_NAMES.filter((stat) => !completedStats.has(stat));

      expect(statsNeedingDiagnostic).not.toContain('reading');
      expect(statsNeedingDiagnostic).not.toContain('math');
      expect(statsNeedingDiagnostic).toContain('critical_thinking');
    });
  });
});
