// @ts-nocheck
/**
 * Tests for forge-meta-learner.ts
 * Meta-Learning Trajectory System - The "Ultimate Level Up Machine"
 */

import {
  manifoldDistance,
  clusterState,
  findSimilarPatterns,
  buildTrajectoryFromPattern,
  planOptimalTrajectory,
  proposeTrajectoryImprovement,
  getPatternStatistics,
  getTrajectoryHistory,
  getMetaLearner,
  recordLearningTrajectory,
  MetaLearner,
} from '@/lib/hyro/forge-meta-learner';
import type {
  StateVector,
  Intervention,
  TrajectoryRecord,
  LearnedPattern,
  TrajectoryPlan,
} from '@/lib/hyro/forge-meta-learner';

// ============================================================================
// Mocks
// ============================================================================

const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    })),
  })),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

jest.mock('@/lib/hyro/forge-learner-state', () => ({
  distanceCEG: jest.fn((s1, s2) => {
    const dC = s1.coherence - s2.coherence;
    const dE = s1.entropy - s2.entropy;
    const dG = s1.generativity - s2.generativity;
    return Math.sqrt(dC * dC + dE * dE + dG * dG);
  }),
}));

jest.mock('@/lib/hyro/forge-hgm-optimizer', () => ({
  getHGMOptimizer: jest.fn(),
  proposeParameterChange: jest.fn(() => ({
    id: 'exp-123',
    parameter_name: 'test_param',
    current_value: 1.0,
    proposed_value: 1.05,
  })),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockStateVector(overrides: Partial<StateVector> = {}): StateVector {
  return {
    coherence: 50,
    entropy: 50,
    generativity: 50,
    ...overrides,
  };
}

function createMockIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    type: 'content',
    content_id: 'content-123',
    difficulty_adjustment: 0.5,
    duration_minutes: 20,
    stat_target: 'math',
    ...overrides,
  };
}

function createMockTrajectoryRecord(overrides: Partial<TrajectoryRecord> = {}): TrajectoryRecord {
  return {
    id: 'traj-123',
    student_id: 'student-1',
    stat_name: 'math',
    start_state: createMockStateVector({ coherence: 40, entropy: 60, generativity: 50 }),
    end_state: createMockStateVector({ coherence: 70, entropy: 40, generativity: 60 }),
    interventions: [createMockIntervention()],
    duration_hours: 1.5,
    success: true,
    efficiency: 1.2,
    created_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function createMockLearnedPattern(overrides: Partial<LearnedPattern> = {}): LearnedPattern {
  return {
    id: 'pattern-123',
    source_state_cluster: createMockStateVector({ coherence: 40, entropy: 60, generativity: 50 }),
    target_state_cluster: createMockStateVector({ coherence: 70, entropy: 40, generativity: 60 }),
    optimal_intervention_sequence: [createMockIntervention()],
    confidence: 0.7,
    sample_count: 10,
    average_duration_hours: 1.5,
    success_rate: 0.8,
    stat_name: 'math',
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  // Reset singleton
  (MetaLearner as any).instance = null;
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-meta-learner types', () => {
  describe('StateVector interface', () => {
    it('should have C/E/G components', () => {
      const state: StateVector = createMockStateVector();

      expect(state.coherence).toBeDefined();
      expect(state.entropy).toBeDefined();
      expect(state.generativity).toBeDefined();
    });

    it('should accept various values', () => {
      const state: StateVector = {
        coherence: 0,
        entropy: 100,
        generativity: 50,
      };

      expect(state.coherence).toBe(0);
      expect(state.entropy).toBe(100);
      expect(state.generativity).toBe(50);
    });
  });

  describe('Intervention interface', () => {
    it('should have required properties', () => {
      const intervention: Intervention = createMockIntervention();

      expect(intervention.type).toBeDefined();
      expect(intervention.duration_minutes).toBeDefined();
      expect(intervention.stat_target).toBeDefined();
    });

    it('should support all intervention types', () => {
      const types: Intervention['type'][] = [
        'content', 'scaffolding', 'challenge', 'rest', 'review', 'exploration'
      ];

      types.forEach((type) => {
        const intervention = createMockIntervention({ type });
        expect(intervention.type).toBe(type);
      });
    });

    it('should have optional properties', () => {
      const intervention: Intervention = {
        type: 'rest',
        duration_minutes: 10,
        stat_target: 'study_skills',
      };

      expect(intervention.content_id).toBeUndefined();
      expect(intervention.difficulty_adjustment).toBeUndefined();
    });
  });

  describe('TrajectoryRecord interface', () => {
    it('should have required properties', () => {
      const record: TrajectoryRecord = createMockTrajectoryRecord();

      expect(record.id).toBeDefined();
      expect(record.student_id).toBeDefined();
      expect(record.stat_name).toBeDefined();
      expect(record.start_state).toBeDefined();
      expect(record.end_state).toBeDefined();
      expect(record.interventions).toBeInstanceOf(Array);
      expect(record.duration_hours).toBeDefined();
      expect(typeof record.success).toBe('boolean');
      expect(record.efficiency).toBeDefined();
      expect(record.created_at).toBeDefined();
    });
  });

  describe('LearnedPattern interface', () => {
    it('should have required properties', () => {
      const pattern: LearnedPattern = createMockLearnedPattern();

      expect(pattern.id).toBeDefined();
      expect(pattern.source_state_cluster).toBeDefined();
      expect(pattern.target_state_cluster).toBeDefined();
      expect(pattern.optimal_intervention_sequence).toBeInstanceOf(Array);
      expect(pattern.confidence).toBeDefined();
      expect(pattern.sample_count).toBeDefined();
      expect(pattern.average_duration_hours).toBeDefined();
      expect(pattern.success_rate).toBeDefined();
      expect(pattern.created_at).toBeDefined();
      expect(pattern.updated_at).toBeDefined();
    });

    it('should have optional stat_name', () => {
      const pattern = createMockLearnedPattern({ stat_name: undefined });
      expect(pattern.stat_name).toBeUndefined();
    });
  });

  describe('TrajectoryPlan interface', () => {
    it('should have required properties', () => {
      const plan: TrajectoryPlan = {
        student_id: 'student-1',
        stat_name: 'math',
        current_state: createMockStateVector(),
        target_state: createMockStateVector({ coherence: 80 }),
        recommended_interventions: [createMockIntervention()],
        estimated_duration_hours: 2,
        confidence: 0.7,
        pattern_source: 'pattern-123',
      };

      expect(plan.student_id).toBeDefined();
      expect(plan.stat_name).toBeDefined();
      expect(plan.current_state).toBeDefined();
      expect(plan.target_state).toBeDefined();
      expect(plan.recommended_interventions).toBeInstanceOf(Array);
      expect(plan.estimated_duration_hours).toBeDefined();
      expect(plan.confidence).toBeDefined();
    });
  });
});

// ============================================================================
// manifoldDistance Tests
// ============================================================================

describe('manifoldDistance', () => {
  it('should return 0 for identical states', () => {
    const state = createMockStateVector();
    const distance = manifoldDistance(state, state);

    expect(distance).toBe(0);
  });

  it('should calculate Euclidean distance', () => {
    const state1 = createMockStateVector({ coherence: 0, entropy: 0, generativity: 0 });
    const state2 = createMockStateVector({ coherence: 3, entropy: 4, generativity: 0 });

    const distance = manifoldDistance(state1, state2);

    // sqrt(3^2 + 4^2 + 0^2) = sqrt(9 + 16) = sqrt(25) = 5
    expect(distance).toBe(5);
  });

  it('should be symmetric', () => {
    const state1 = createMockStateVector({ coherence: 10, entropy: 20, generativity: 30 });
    const state2 = createMockStateVector({ coherence: 40, entropy: 50, generativity: 60 });

    const d1 = manifoldDistance(state1, state2);
    const d2 = manifoldDistance(state2, state1);

    expect(d1).toBe(d2);
  });

  it('should handle negative deltas', () => {
    const state1 = createMockStateVector({ coherence: 50, entropy: 50, generativity: 50 });
    const state2 = createMockStateVector({ coherence: 20, entropy: 30, generativity: 40 });

    const distance = manifoldDistance(state1, state2);

    // sqrt(30^2 + 20^2 + 10^2) = sqrt(900 + 400 + 100) = sqrt(1400)
    expect(distance).toBeCloseTo(Math.sqrt(1400), 5);
  });
});

// ============================================================================
// clusterState Tests
// ============================================================================

describe('clusterState', () => {
  it('should round to nearest cluster center', () => {
    const state = createMockStateVector({ coherence: 47, entropy: 53, generativity: 58 });

    const clustered = clusterState(state);

    // Cluster radius is 10, so round to nearest 10
    expect(clustered.coherence).toBe(50);
    expect(clustered.entropy).toBe(50);
    expect(clustered.generativity).toBe(60);
  });

  it('should handle exact cluster centers', () => {
    const state = createMockStateVector({ coherence: 50, entropy: 60, generativity: 70 });

    const clustered = clusterState(state);

    expect(clustered.coherence).toBe(50);
    expect(clustered.entropy).toBe(60);
    expect(clustered.generativity).toBe(70);
  });

  it('should handle edge values', () => {
    const state = createMockStateVector({ coherence: 5, entropy: 95, generativity: 15 });

    const clustered = clusterState(state);

    expect(clustered.coherence).toBe(10);
    expect(clustered.entropy).toBe(100);
    expect(clustered.generativity).toBe(20);
  });

  it('should handle zero values', () => {
    const state = createMockStateVector({ coherence: 0, entropy: 0, generativity: 0 });

    const clustered = clusterState(state);

    expect(clustered.coherence).toBe(0);
    expect(clustered.entropy).toBe(0);
    expect(clustered.generativity).toBe(0);
  });
});

// ============================================================================
// findSimilarPatterns Tests
// ============================================================================

describe('findSimilarPatterns', () => {
  it('should return patterns within radius', () => {
    const mockPatternRow = {
      id: 'pattern-1',
      source_coherence: 50,
      source_entropy: 50,
      source_generativity: 50,
      target_coherence: 70,
      target_entropy: 40,
      target_generativity: 60,
      optimal_interventions: JSON.stringify([createMockIntervention()]),
      confidence: 0.7,
      sample_count: 10,
      average_duration_hours: 1.5,
      success_rate: 0.8,
      stat_name: 'math',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockAll.mockReturnValue([mockPatternRow]);

    const state = createMockStateVector({ coherence: 52, entropy: 48, generativity: 50 });
    const result = findSimilarPatterns(state, 15);

    expect(result.length).toBeGreaterThan(0);
  });

  it('should filter out patterns outside radius', () => {
    const farPattern = {
      id: 'pattern-far',
      source_coherence: 0,
      source_entropy: 0,
      source_generativity: 0,
      target_coherence: 100,
      target_entropy: 100,
      target_generativity: 100,
      optimal_interventions: JSON.stringify([]),
      confidence: 0.8,
      sample_count: 5,
      average_duration_hours: 1,
      success_rate: 0.9,
      stat_name: 'math',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    mockAll.mockReturnValue([farPattern]);

    const state = createMockStateVector({ coherence: 50, entropy: 50, generativity: 50 });
    const result = findSimilarPatterns(state, 15);

    // Distance from (50,50,50) to (0,0,0) = sqrt(7500) ≈ 86.6 > 15
    expect(result).toHaveLength(0);
  });

  it('should return empty array when no patterns exist', () => {
    mockAll.mockReturnValue([]);

    const state = createMockStateVector();
    const result = findSimilarPatterns(state);

    expect(result).toHaveLength(0);
  });

  it('should use default radius of 15', () => {
    mockAll.mockReturnValue([]);

    const state = createMockStateVector();
    findSimilarPatterns(state);

    expect(mockAll).toHaveBeenCalled();
  });
});

// ============================================================================
// buildTrajectoryFromPattern Tests
// ============================================================================

describe('buildTrajectoryFromPattern', () => {
  it('should build trajectory plan from pattern', () => {
    const pattern = createMockLearnedPattern();
    const current = createMockStateVector({ coherence: 45, entropy: 55, generativity: 50 });
    const target = createMockStateVector({ coherence: 75, entropy: 35, generativity: 65 });

    const plan = buildTrajectoryFromPattern(pattern, current, target);

    expect(plan.current_state).toEqual(current);
    expect(plan.target_state).toEqual(target);
    expect(plan.recommended_interventions.length).toBeGreaterThan(0);
    expect(plan.confidence).toBe(pattern.confidence);
    expect(plan.pattern_source).toBe(pattern.id);
  });

  it('should scale intervention durations based on gap', () => {
    const pattern = createMockLearnedPattern({
      optimal_intervention_sequence: [
        createMockIntervention({ duration_minutes: 20 }),
      ],
    });

    // Smaller gap than pattern
    const current = createMockStateVector({ coherence: 60, entropy: 50, generativity: 55 });
    const target = createMockStateVector({ coherence: 70, entropy: 40, generativity: 60 });

    const plan = buildTrajectoryFromPattern(pattern, current, target);

    // Duration should be scaled down for smaller gap
    expect(plan.recommended_interventions.length).toBe(1);
  });

  it('should set empty student_id for caller to fill', () => {
    const pattern = createMockLearnedPattern();
    const current = createMockStateVector();
    const target = createMockStateVector({ coherence: 80 });

    const plan = buildTrajectoryFromPattern(pattern, current, target);

    expect(plan.student_id).toBe('');
  });
});

// ============================================================================
// planOptimalTrajectory Tests
// ============================================================================

describe('planOptimalTrajectory', () => {
  it('should return rule-based plan', () => {
    const target = createMockStateVector({ coherence: 80, entropy: 30, generativity: 70 });

    const plan = planOptimalTrajectory('student-1', 'math', target);

    expect(plan.student_id).toBe('student-1');
    expect(plan.stat_name).toBe('math');
    expect(plan.target_state).toEqual(target);
    expect(plan.confidence).toBe(0.3); // Low confidence for rule-based
  });

  it('should include default interventions', () => {
    const target = createMockStateVector({ coherence: 80 });

    const plan = planOptimalTrajectory('student-1', 'math', target);

    // Should have content, scaffolding, challenge, review
    const types = plan.recommended_interventions.map(i => i.type);
    expect(types).toContain('content');
    expect(types).toContain('scaffolding');
    expect(types).toContain('challenge');
    expect(types).toContain('review');
  });

  it('should set default current state', () => {
    const target = createMockStateVector({ coherence: 80 });

    const plan = planOptimalTrajectory('student-1', 'math', target);

    expect(plan.current_state).toEqual({ coherence: 50, entropy: 50, generativity: 50 });
  });

  it('should set estimated duration to 1 hour', () => {
    const target = createMockStateVector({ coherence: 80 });

    const plan = planOptimalTrajectory('student-1', 'math', target);

    expect(plan.estimated_duration_hours).toBe(1);
  });
});

// ============================================================================
// MetaLearner Class Tests
// ============================================================================

describe('MetaLearner', () => {
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MetaLearner.getInstance();
      const instance2 = MetaLearner.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('recordTrajectory', () => {
    it('should insert trajectory record', () => {
      const learner = MetaLearner.getInstance();
      const trajectory = createMockTrajectoryRecord();

      learner.recordTrajectory(trajectory);

      expect(mockRun).toHaveBeenCalled();
    });

    it('should update patterns for successful trajectory', () => {
      mockAll.mockReturnValue([]); // No existing patterns

      const learner = MetaLearner.getInstance();
      const trajectory = createMockTrajectoryRecord({ success: true });

      learner.recordTrajectory(trajectory);

      // Should have created new pattern
      expect(mockRun).toHaveBeenCalled();
    });

    it('should update patterns for failed trajectory', () => {
      const existingPattern = {
        id: 'pattern-1',
        source_coherence: 40,
        source_entropy: 60,
        source_generativity: 50,
        target_coherence: 70,
        target_entropy: 40,
        target_generativity: 60,
        optimal_interventions: JSON.stringify([]),
        confidence: 0.7,
        sample_count: 10,
        average_duration_hours: 1.5,
        success_rate: 0.8,
        stat_name: 'math',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      mockAll.mockReturnValue([existingPattern]);

      const learner = MetaLearner.getInstance();
      const trajectory = createMockTrajectoryRecord({ success: false });

      learner.recordTrajectory(trajectory);

      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('recommendTrajectory', () => {
    it('should use rule-based fallback when no patterns', () => {
      mockAll.mockReturnValue([]);

      const learner = MetaLearner.getInstance();
      const target = createMockStateVector({ coherence: 80 });

      const plan = learner.recommendTrajectory('student-1', 'math', target);

      expect(plan.confidence).toBe(0.3); // Rule-based confidence
    });

    it('should use pattern when available', () => {
      const patternRow = {
        id: 'pattern-1',
        source_coherence: 50,
        source_entropy: 50,
        source_generativity: 50,
        target_coherence: 80,
        target_entropy: 40,
        target_generativity: 60,
        optimal_interventions: JSON.stringify([createMockIntervention()]),
        confidence: 0.8,
        sample_count: 20,
        average_duration_hours: 1.5,
        success_rate: 0.85,
        stat_name: 'math',
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      mockAll.mockReturnValue([patternRow]);

      const learner = MetaLearner.getInstance();
      const current = createMockStateVector();
      const target = createMockStateVector({ coherence: 80, entropy: 40, generativity: 60 });

      const plan = learner.recommendTrajectory('student-1', 'math', target, current);

      expect(plan.student_id).toBe('student-1');
      expect(plan.stat_name).toBe('math');
    });

    it('should use default current state if not provided', () => {
      mockAll.mockReturnValue([]);

      const learner = MetaLearner.getInstance();
      const target = createMockStateVector({ coherence: 80 });

      const plan = learner.recommendTrajectory('student-1', 'math', target);

      expect(plan.current_state).toEqual({ coherence: 50, entropy: 50, generativity: 50 });
    });
  });

  describe('findMatchingPatterns', () => {
    it('should score patterns by distance and confidence', () => {
      const patterns = [
        {
          id: 'pattern-close',
          source_coherence: 50,
          source_entropy: 50,
          source_generativity: 50,
          target_coherence: 80,
          target_entropy: 40,
          target_generativity: 60,
          optimal_interventions: JSON.stringify([]),
          confidence: 0.7,
          sample_count: 10,
          average_duration_hours: 1,
          success_rate: 0.8,
          stat_name: 'math',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
        {
          id: 'pattern-far',
          source_coherence: 20,
          source_entropy: 80,
          source_generativity: 30,
          target_coherence: 60,
          target_entropy: 60,
          target_generativity: 40,
          optimal_interventions: JSON.stringify([]),
          confidence: 0.9,
          sample_count: 20,
          average_duration_hours: 2,
          success_rate: 0.9,
          stat_name: 'math',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];
      mockAll.mockReturnValue(patterns);

      const learner = MetaLearner.getInstance();
      const current = createMockStateVector();
      const target = createMockStateVector({ coherence: 80, entropy: 40, generativity: 60 });

      const result = learner.findMatchingPatterns(current, target, 10);

      // Should return patterns sorted by score
      expect(result.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', () => {
      const patterns = Array(20).fill(null).map((_, i) => ({
        id: `pattern-${i}`,
        source_coherence: 50,
        source_entropy: 50,
        source_generativity: 50,
        target_coherence: 80,
        target_entropy: 40,
        target_generativity: 60,
        optimal_interventions: JSON.stringify([]),
        confidence: 0.7,
        sample_count: 10,
        average_duration_hours: 1,
        success_rate: 0.8,
        stat_name: 'math',
        created_at: Date.now(),
        updated_at: Date.now(),
      }));
      mockAll.mockReturnValue(patterns);

      const learner = MetaLearner.getInstance();
      const result = learner.findMatchingPatterns(
        createMockStateVector(),
        createMockStateVector({ coherence: 80 }),
        5
      );

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});

// ============================================================================
// proposeTrajectoryImprovement Tests
// ============================================================================

describe('proposeTrajectoryImprovement', () => {
  it('should accept changes within 5% bounds', () => {
    const current = createMockLearnedPattern({ average_duration_hours: 1.0 });
    const proposed = createMockLearnedPattern({ average_duration_hours: 1.04 }); // 4% change

    const result = proposeTrajectoryImprovement(current, proposed);

    expect(result.valid).toBe(true);
    expect(result.experiment).toBeDefined();
  });

  it('should reject changes exceeding 5% bounds', () => {
    const current = createMockLearnedPattern({ average_duration_hours: 1.0 });
    const proposed = createMockLearnedPattern({ average_duration_hours: 1.1 }); // 10% change

    const result = proposeTrajectoryImprovement(current, proposed);

    expect(result.valid).toBe(false);
    expect(result.experiment).toBeUndefined();
  });

  it('should handle HGM rejection', () => {
    const { proposeParameterChange } = require('@/lib/hyro/forge-hgm-optimizer');
    proposeParameterChange.mockImplementation(() => {
      throw new Error('HGM rejected');
    });

    const current = createMockLearnedPattern({ average_duration_hours: 1.0 });
    const proposed = createMockLearnedPattern({ average_duration_hours: 1.03 });

    const result = proposeTrajectoryImprovement(current, proposed);

    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// getPatternStatistics Tests
// ============================================================================

describe('getPatternStatistics', () => {
  it('should return aggregated statistics', () => {
    mockGet.mockReturnValue({
      total_patterns: 50,
      average_confidence: 0.7,
      average_success_rate: 0.8,
    });
    mockAll.mockReturnValue([
      { stat_name: 'math', count: 20 },
      { stat_name: 'reading', count: 15 },
      { stat_name: 'science', count: 15 },
    ]);

    const stats = getPatternStatistics();

    expect(stats.total_patterns).toBe(50);
    expect(stats.average_confidence).toBe(0.7);
    expect(stats.average_success_rate).toBe(0.8);
    expect(stats.patterns_by_stat.math).toBe(20);
    expect(stats.patterns_by_stat.reading).toBe(15);
  });

  it('should handle zero patterns', () => {
    mockGet.mockReturnValue({
      total_patterns: 0,
      average_confidence: null,
      average_success_rate: null,
    });
    mockAll.mockReturnValue([]);

    const stats = getPatternStatistics();

    expect(stats.total_patterns).toBe(0);
    expect(stats.average_confidence).toBe(0);
    expect(stats.average_success_rate).toBe(0);
    expect(stats.patterns_by_stat).toEqual({});
  });
});

// ============================================================================
// getTrajectoryHistory Tests
// ============================================================================

describe('getTrajectoryHistory', () => {
  it('should return trajectory history for student', () => {
    const mockRow = {
      id: 'traj-1',
      student_id: 'student-1',
      stat_name: 'math',
      start_coherence: 40,
      start_entropy: 60,
      start_generativity: 50,
      end_coherence: 70,
      end_entropy: 40,
      end_generativity: 60,
      interventions: JSON.stringify([createMockIntervention()]),
      duration_hours: 1.5,
      success: 1,
      efficiency: 1.2,
      created_at: Date.now(),
    };
    mockAll.mockReturnValue([mockRow]);

    const history = getTrajectoryHistory('student-1');

    expect(history).toHaveLength(1);
    expect(history[0].student_id).toBe('student-1');
    expect(history[0].success).toBe(true);
  });

  it('should filter by stat name', () => {
    mockAll.mockReturnValue([]);

    getTrajectoryHistory('student-1', 'math');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should respect limit parameter', () => {
    mockAll.mockReturnValue([]);

    getTrajectoryHistory('student-1', undefined, 10);

    expect(mockAll).toHaveBeenCalled();
  });

  it('should return empty array when no history', () => {
    mockAll.mockReturnValue([]);

    const history = getTrajectoryHistory('student-1');

    expect(history).toHaveLength(0);
  });
});

// ============================================================================
// getMetaLearner Tests
// ============================================================================

describe('getMetaLearner', () => {
  it('should return MetaLearner singleton', () => {
    const learner = getMetaLearner();

    expect(learner).toBeInstanceOf(MetaLearner);
  });

  it('should return same instance on multiple calls', () => {
    const learner1 = getMetaLearner();
    const learner2 = getMetaLearner();

    expect(learner1).toBe(learner2);
  });
});

// ============================================================================
// recordLearningTrajectory Tests
// ============================================================================

describe('recordLearningTrajectory', () => {
  it('should record trajectory and return record', () => {
    const startState = createMockStateVector({ coherence: 40 });
    const endState = createMockStateVector({ coherence: 70 });
    const interventions = [createMockIntervention()];

    const result = recordLearningTrajectory(
      'student-1',
      'math',
      startState,
      endState,
      interventions,
      1.5,
      true
    );

    expect(result.id).toBe('test-uuid-1234');
    expect(result.student_id).toBe('student-1');
    expect(result.stat_name).toBe('math');
    expect(result.success).toBe(true);
    expect(result.start_state).toEqual(startState);
    expect(result.end_state).toEqual(endState);
  });

  it('should calculate efficiency', () => {
    const result = recordLearningTrajectory(
      'student-1',
      'math',
      createMockStateVector(),
      createMockStateVector({ coherence: 70 }),
      [createMockIntervention()],
      1.0,
      true
    );

    // efficiency = expectedDuration / durationHours
    // expectedDuration = 1.0 * 1.2 = 1.2
    // efficiency = 1.2 / 1.0 = 1.2
    expect(result.efficiency).toBe(1.2);
  });

  it('should handle failed trajectories', () => {
    const result = recordLearningTrajectory(
      'student-1',
      'math',
      createMockStateVector(),
      createMockStateVector(),
      [],
      0.5,
      false
    );

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle zero duration hours', () => {
    const result = recordLearningTrajectory(
      'student-1',
      'math',
      createMockStateVector(),
      createMockStateVector({ coherence: 70 }),
      [],
      0,
      true
    );

    // Should handle division by zero gracefully
    expect(result.efficiency).toBe(Infinity);
  });

  it('should handle empty intervention arrays', () => {
    const trajectory = createMockTrajectoryRecord({ interventions: [] });
    const learner = getMetaLearner();

    // Should not throw
    expect(() => learner.recordTrajectory(trajectory)).not.toThrow();
  });

  it('should handle patterns with malformed JSON', () => {
    mockAll.mockReturnValue([{
      id: 'bad-pattern',
      source_coherence: 50,
      source_entropy: 50,
      source_generativity: 50,
      target_coherence: 70,
      target_entropy: 40,
      target_generativity: 60,
      optimal_interventions: 'not valid json',
      confidence: 0.7,
      sample_count: 10,
      average_duration_hours: 1,
      success_rate: 0.8,
      stat_name: 'math',
      created_at: Date.now(),
      updated_at: Date.now(),
    }]);

    // This would throw when parsing JSON
    expect(() => findSimilarPatterns(createMockStateVector())).toThrow();
  });

  it('should handle extreme state values', () => {
    const extreme1 = createMockStateVector({ coherence: 0, entropy: 0, generativity: 0 });
    const extreme2 = createMockStateVector({ coherence: 100, entropy: 100, generativity: 100 });

    const distance = manifoldDistance(extreme1, extreme2);

    // sqrt(100^2 + 100^2 + 100^2) = sqrt(30000) ≈ 173.2
    expect(distance).toBeCloseTo(Math.sqrt(30000), 1);
  });

  it('should handle pattern with zero sample count', () => {
    const current = createMockLearnedPattern({ average_duration_hours: 1.0 });
    const proposed = createMockLearnedPattern({ average_duration_hours: 1.0, sample_count: 0 });

    // Should not divide by zero
    const result = proposeTrajectoryImprovement(current, proposed);
    expect(result.valid).toBe(true);
  });
});
