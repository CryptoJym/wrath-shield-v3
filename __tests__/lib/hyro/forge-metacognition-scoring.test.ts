// @ts-nocheck
/**
 * Tests for forge-metacognition-scoring.ts
 * Metacognition Scoring System - Tracks and scores metacognitive skills
 */

import {
  initializeMetacognitionTables,
  scoreMetacognitiveSkills,
  getMetacognitiveProfile,
  recordCalibrationData,
  resolveCalibration,
  getCalibrationAccuracy,
  getMetacognitiveGrowth,
  getDimensionHistory,
  getImprovementRecommendations,
  METACOGNITIVE_INDICATORS,
} from '@/lib/hyro/forge-metacognition-scoring';
import type {
  MetacognitiveDimension,
  MetacognitiveScore,
  MetacognitiveProfile,
  CalibrationData,
  CalibrationAccuracy,
  MetacognitiveGrowth,
  DimensionIndicators,
} from '@/lib/hyro/forge-metacognition-scoring';

// ============================================================================
// Mocks
// ============================================================================

const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);
const mockExec = jest.fn();

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    })),
    exec: mockExec,
  })),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockMetacognitiveScore(overrides: Partial<MetacognitiveScore> = {}): MetacognitiveScore {
  return {
    id: 'score-123',
    student_id: 'student-1',
    dimension: 'planning',
    score: 75,
    evidence_count: 5,
    assessment_date: '2024-01-15',
    notes: 'Test notes',
    created_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function createMockCalibrationData(overrides: Partial<CalibrationData> = {}): CalibrationData {
  return {
    id: 'cal-123',
    student_id: 'student-1',
    task_id: 'task-456',
    task_type: 'quiz',
    stat_name: 'math',
    predicted_score: 80,
    actual_score: null,
    confidence_level: 4,
    calibration_error: null,
    created_at: Math.floor(Date.now() / 1000),
    resolved_at: null,
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-metacognition-scoring types', () => {
  describe('MetacognitiveDimension type', () => {
    it('should support all 4 dimensions', () => {
      const dimensions: MetacognitiveDimension[] = ['planning', 'monitoring', 'evaluation', 'regulation'];

      dimensions.forEach((dim) => {
        expect(typeof dim).toBe('string');
      });
    });
  });

  describe('MetacognitiveScore interface', () => {
    it('should have required properties', () => {
      const score: MetacognitiveScore = createMockMetacognitiveScore();

      expect(score.id).toBeDefined();
      expect(score.student_id).toBeDefined();
      expect(score.dimension).toBeDefined();
      expect(score.score).toBeDefined();
      expect(score.evidence_count).toBeDefined();
      expect(score.assessment_date).toBeDefined();
      expect(score.created_at).toBeDefined();
    });

    it('should have optional notes', () => {
      const scoreWithNotes = createMockMetacognitiveScore({ notes: 'Test notes' });
      const scoreWithoutNotes = createMockMetacognitiveScore({ notes: null });

      expect(scoreWithNotes.notes).toBe('Test notes');
      expect(scoreWithoutNotes.notes).toBeNull();
    });
  });

  describe('MetacognitiveProfile interface', () => {
    it('should have required properties', () => {
      const profile: MetacognitiveProfile = {
        student_id: 'student-1',
        planning_score: 75,
        monitoring_score: 80,
        evaluation_score: 70,
        regulation_score: 65,
        overall_score: 72.5,
        strongest_dimension: 'monitoring',
        weakest_dimension: 'regulation',
        last_assessed: Date.now(),
      };

      expect(profile.student_id).toBeDefined();
      expect(profile.planning_score).toBeDefined();
      expect(profile.monitoring_score).toBeDefined();
      expect(profile.evaluation_score).toBeDefined();
      expect(profile.regulation_score).toBeDefined();
      expect(profile.overall_score).toBeDefined();
      expect(profile.strongest_dimension).toBeDefined();
      expect(profile.weakest_dimension).toBeDefined();
      expect(profile.last_assessed).toBeDefined();
    });
  });

  describe('CalibrationData interface', () => {
    it('should have required properties', () => {
      const calibration: CalibrationData = createMockCalibrationData();

      expect(calibration.id).toBeDefined();
      expect(calibration.student_id).toBeDefined();
      expect(calibration.task_id).toBeDefined();
      expect(calibration.task_type).toBeDefined();
      expect(calibration.predicted_score).toBeDefined();
      expect(calibration.confidence_level).toBeDefined();
      expect(calibration.created_at).toBeDefined();
    });

    it('should have nullable actual_score and calibration_error', () => {
      const unresolved = createMockCalibrationData();
      expect(unresolved.actual_score).toBeNull();
      expect(unresolved.calibration_error).toBeNull();

      const resolved = createMockCalibrationData({
        actual_score: 75,
        calibration_error: -5,
      });
      expect(resolved.actual_score).toBe(75);
      expect(resolved.calibration_error).toBe(-5);
    });
  });

  describe('CalibrationAccuracy interface', () => {
    it('should have required properties', () => {
      const accuracy: CalibrationAccuracy = {
        student_id: 'student-1',
        total_predictions: 20,
        resolved_predictions: 15,
        mean_absolute_error: 8.5,
        overconfidence_rate: 0.2,
        underconfidence_rate: 0.1,
        well_calibrated_rate: 0.7,
        trend: 'improving',
      };

      expect(accuracy.student_id).toBeDefined();
      expect(accuracy.total_predictions).toBeDefined();
      expect(accuracy.resolved_predictions).toBeDefined();
      expect(accuracy.mean_absolute_error).toBeDefined();
      expect(accuracy.overconfidence_rate).toBeDefined();
      expect(accuracy.underconfidence_rate).toBeDefined();
      expect(accuracy.well_calibrated_rate).toBeDefined();
      expect(accuracy.trend).toBeDefined();
    });

    it('should support all trend values', () => {
      const trends: CalibrationAccuracy['trend'][] = ['improving', 'declining', 'stable'];

      trends.forEach((trend) => {
        expect(typeof trend).toBe('string');
      });
    });
  });

  describe('MetacognitiveGrowth interface', () => {
    it('should have required properties', () => {
      const growth: MetacognitiveGrowth = {
        dimension: 'planning',
        start_score: 60,
        current_score: 75,
        change: 15,
        percent_change: 25,
        period_days: 30,
      };

      expect(growth.dimension).toBeDefined();
      expect(growth.start_score).toBeDefined();
      expect(growth.current_score).toBeDefined();
      expect(growth.change).toBeDefined();
      expect(growth.percent_change).toBeDefined();
      expect(growth.period_days).toBeDefined();
    });
  });
});

// ============================================================================
// METACOGNITIVE_INDICATORS Constant Tests
// ============================================================================

describe('METACOGNITIVE_INDICATORS', () => {
  it('should have indicators for all dimensions', () => {
    expect(METACOGNITIVE_INDICATORS.planning).toBeDefined();
    expect(METACOGNITIVE_INDICATORS.monitoring).toBeDefined();
    expect(METACOGNITIVE_INDICATORS.evaluation).toBeDefined();
    expect(METACOGNITIVE_INDICATORS.regulation).toBeDefined();
  });

  it('should have multiple indicators per dimension', () => {
    expect(METACOGNITIVE_INDICATORS.planning.length).toBeGreaterThanOrEqual(3);
    expect(METACOGNITIVE_INDICATORS.monitoring.length).toBeGreaterThanOrEqual(3);
    expect(METACOGNITIVE_INDICATORS.evaluation.length).toBeGreaterThanOrEqual(3);
    expect(METACOGNITIVE_INDICATORS.regulation.length).toBeGreaterThanOrEqual(3);
  });

  it('should have string indicators', () => {
    METACOGNITIVE_INDICATORS.planning.forEach((indicator) => {
      expect(typeof indicator).toBe('string');
      expect(indicator.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// initializeMetacognitionTables Tests
// ============================================================================

describe('initializeMetacognitionTables', () => {
  it('should create tables', () => {
    initializeMetacognitionTables();

    expect(mockExec).toHaveBeenCalled();
  });

  it('should create hyro_metacognitive_scores table', () => {
    initializeMetacognitionTables();

    const execCall = mockExec.mock.calls[0][0];
    expect(execCall).toContain('hyro_metacognitive_scores');
    expect(execCall).toContain('CREATE TABLE IF NOT EXISTS');
  });

  it('should create hyro_calibration_data table', () => {
    initializeMetacognitionTables();

    const execCall = mockExec.mock.calls[0][0];
    expect(execCall).toContain('hyro_calibration_data');
  });

  it('should create indexes', () => {
    initializeMetacognitionTables();

    const execCall = mockExec.mock.calls[0][0];
    expect(execCall).toContain('CREATE INDEX IF NOT EXISTS');
  });
});

// ============================================================================
// scoreMetacognitiveSkills Tests
// ============================================================================

describe('scoreMetacognitiveSkills', () => {
  it('should score skills and return profile', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [80, 75, 85],
      monitoring_evidence: [70, 65, 75],
      evaluation_evidence: [90, 85, 80],
      regulation_evidence: [60, 55, 65],
    });

    expect(result.student_id).toBe('hyro');
    expect(result.planning_score).toBe(80);
    expect(result.monitoring_score).toBe(70);
    expect(result.evaluation_score).toBe(85);
    expect(result.regulation_score).toBe(60);
  });

  it('should calculate average for each dimension', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [60, 80, 100],
      monitoring_evidence: [50, 50, 50],
      evaluation_evidence: [100, 100],
      regulation_evidence: [0, 100],
    });

    expect(result.planning_score).toBe(80); // (60+80+100)/3
    expect(result.monitoring_score).toBe(50); // (50+50+50)/3
    expect(result.evaluation_score).toBe(100); // (100+100)/2
    expect(result.regulation_score).toBe(50); // (0+100)/2
  });

  it('should calculate overall score', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [80],
      monitoring_evidence: [60],
      evaluation_evidence: [40],
      regulation_evidence: [20],
    });

    expect(result.overall_score).toBe(50); // (80+60+40+20)/4
  });

  it('should identify strongest dimension', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [50],
      monitoring_evidence: [90],
      evaluation_evidence: [70],
      regulation_evidence: [60],
    });

    expect(result.strongest_dimension).toBe('monitoring');
  });

  it('should identify weakest dimension', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [50],
      monitoring_evidence: [90],
      evaluation_evidence: [70],
      regulation_evidence: [30],
    });

    expect(result.weakest_dimension).toBe('regulation');
  });

  it('should use custom student_id when provided', () => {
    const result = scoreMetacognitiveSkills({
      student_id: 'custom-student',
      planning_evidence: [75],
      monitoring_evidence: [75],
      evaluation_evidence: [75],
      regulation_evidence: [75],
    });

    expect(result.student_id).toBe('custom-student');
  });

  it('should handle empty evidence arrays', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [],
      monitoring_evidence: [],
      evaluation_evidence: [],
      regulation_evidence: [],
    });

    expect(result.planning_score).toBe(0);
    expect(result.monitoring_score).toBe(0);
    expect(result.evaluation_score).toBe(0);
    expect(result.regulation_score).toBe(0);
  });

  it('should clamp scores to 0-100', () => {
    const result = scoreMetacognitiveSkills({
      planning_evidence: [150, 200], // Would average to 175
      monitoring_evidence: [-10, -20], // Would average to -15
      evaluation_evidence: [50],
      regulation_evidence: [50],
    });

    expect(result.planning_score).toBe(100); // Clamped to max
    expect(result.monitoring_score).toBe(0); // Clamped to min
  });

  it('should insert scores for all dimensions', () => {
    scoreMetacognitiveSkills({
      planning_evidence: [75],
      monitoring_evidence: [75],
      evaluation_evidence: [75],
      regulation_evidence: [75],
    });

    // Should call run 4 times (once per dimension)
    expect(mockRun).toHaveBeenCalledTimes(4);
  });
});

// ============================================================================
// getMetacognitiveProfile Tests
// ============================================================================

describe('getMetacognitiveProfile', () => {
  it('should return profile from stored scores', () => {
    mockGet
      .mockReturnValueOnce({ score: 80, created_at: 1000 }) // planning
      .mockReturnValueOnce({ score: 70, created_at: 2000 }) // monitoring
      .mockReturnValueOnce({ score: 75, created_at: 3000 }) // evaluation
      .mockReturnValueOnce({ score: 65, created_at: 4000 }); // regulation

    const result = getMetacognitiveProfile('student-1');

    expect(result).not.toBeNull();
    expect(result?.planning_score).toBe(80);
    expect(result?.monitoring_score).toBe(70);
    expect(result?.evaluation_score).toBe(75);
    expect(result?.regulation_score).toBe(65);
  });

  it('should return null when no scores exist', () => {
    mockGet.mockReturnValue(undefined);

    const result = getMetacognitiveProfile('new-student');

    expect(result).toBeNull();
  });

  it('should use default student_id when not provided', () => {
    mockGet.mockReturnValue(undefined);

    getMetacognitiveProfile();

    // Should have queried with 'hyro' as default
    expect(mockGet).toHaveBeenCalled();
  });

  it('should identify strongest and weakest dimensions', () => {
    mockGet
      .mockReturnValueOnce({ score: 50, created_at: 1000 })
      .mockReturnValueOnce({ score: 90, created_at: 1000 })
      .mockReturnValueOnce({ score: 70, created_at: 1000 })
      .mockReturnValueOnce({ score: 30, created_at: 1000 });

    const result = getMetacognitiveProfile('student-1');

    expect(result?.strongest_dimension).toBe('monitoring');
    expect(result?.weakest_dimension).toBe('regulation');
  });

  it('should use latest created_at as last_assessed', () => {
    mockGet
      .mockReturnValueOnce({ score: 80, created_at: 100 })
      .mockReturnValueOnce({ score: 70, created_at: 200 })
      .mockReturnValueOnce({ score: 75, created_at: 500 }) // Latest
      .mockReturnValueOnce({ score: 65, created_at: 300 });

    const result = getMetacognitiveProfile('student-1');

    expect(result?.last_assessed).toBe(500);
  });
});

// ============================================================================
// recordCalibrationData Tests
// ============================================================================

describe('recordCalibrationData', () => {
  it('should record calibration and return data', () => {
    const result = recordCalibrationData({
      task_id: 'task-123',
      task_type: 'quiz',
      predicted_score: 80,
      confidence_level: 4,
    });

    expect(result.id).toBe('test-uuid-1234');
    expect(result.student_id).toBe('hyro');
    expect(result.task_id).toBe('task-123');
    expect(result.task_type).toBe('quiz');
    expect(result.predicted_score).toBe(80);
    expect(result.confidence_level).toBe(4);
    expect(result.actual_score).toBeNull();
    expect(result.calibration_error).toBeNull();
  });

  it('should use custom student_id when provided', () => {
    const result = recordCalibrationData({
      student_id: 'custom-student',
      task_id: 'task-123',
      task_type: 'quiz',
      predicted_score: 80,
      confidence_level: 4,
    });

    expect(result.student_id).toBe('custom-student');
  });

  it('should include stat_name when provided', () => {
    const result = recordCalibrationData({
      task_id: 'task-123',
      task_type: 'quiz',
      stat_name: 'math',
      predicted_score: 80,
      confidence_level: 4,
    });

    expect(result.stat_name).toBe('math');
  });

  it('should set stat_name to null when not provided', () => {
    const result = recordCalibrationData({
      task_id: 'task-123',
      task_type: 'assessment',
      predicted_score: 75,
      confidence_level: 3,
    });

    expect(result.stat_name).toBeNull();
  });
});

// ============================================================================
// resolveCalibration Tests
// ============================================================================

describe('resolveCalibration', () => {
  it('should resolve calibration with actual score', () => {
    mockGet.mockReturnValue({
      id: 'cal-123',
      student_id: 'student-1',
      task_id: 'task-456',
      task_type: 'quiz',
      stat_name: 'math',
      predicted_score: 80,
      confidence_level: 4,
      created_at: 1000,
    });

    const result = resolveCalibration('cal-123', 75);

    expect(result).not.toBeNull();
    expect(result?.actual_score).toBe(75);
    expect(result?.calibration_error).toBe(-5); // 75 - 80 = -5
    expect(result?.resolved_at).toBeDefined();
  });

  it('should return null for non-existent calibration', () => {
    mockGet.mockReturnValue(null);

    const result = resolveCalibration('non-existent', 80);

    expect(result).toBeNull();
  });

  it('should calculate positive calibration error when actual > predicted', () => {
    mockGet.mockReturnValue({
      id: 'cal-123',
      student_id: 'student-1',
      task_id: 'task-456',
      task_type: 'quiz',
      stat_name: null,
      predicted_score: 70,
      confidence_level: 3,
      created_at: 1000,
    });

    const result = resolveCalibration('cal-123', 85);

    expect(result?.calibration_error).toBe(15); // 85 - 70 = 15
  });

  it('should update database with resolution', () => {
    mockGet.mockReturnValue({
      id: 'cal-123',
      student_id: 'student-1',
      task_id: 'task-456',
      task_type: 'quiz',
      stat_name: null,
      predicted_score: 80,
      confidence_level: 4,
      created_at: 1000,
    });

    resolveCalibration('cal-123', 75);

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// getCalibrationAccuracy Tests
// ============================================================================

describe('getCalibrationAccuracy', () => {
  it('should return accuracy stats for resolved predictions', () => {
    mockGet.mockReturnValue({ count: 20 }); // Total predictions
    mockAll.mockReturnValue([
      { predicted_score: 80, actual_score: 75, calibration_error: -5, confidence_level: 4, created_at: 100 },
      { predicted_score: 70, actual_score: 72, calibration_error: 2, confidence_level: 3, created_at: 200 },
      { predicted_score: 90, actual_score: 85, calibration_error: -5, confidence_level: 5, created_at: 300 },
    ]);

    const result = getCalibrationAccuracy('student-1');

    expect(result.student_id).toBe('student-1');
    expect(result.total_predictions).toBe(20);
    expect(result.resolved_predictions).toBe(3);
    expect(result.mean_absolute_error).toBeCloseTo(4, 1); // (5+2+5)/3
  });

  it('should return zeroes when no resolved predictions', () => {
    mockGet.mockReturnValue({ count: 5 });
    mockAll.mockReturnValue([]);

    const result = getCalibrationAccuracy('student-1');

    expect(result.total_predictions).toBe(5);
    expect(result.resolved_predictions).toBe(0);
    expect(result.mean_absolute_error).toBe(0);
    expect(result.overconfidence_rate).toBe(0);
    expect(result.underconfidence_rate).toBe(0);
    expect(result.well_calibrated_rate).toBe(0);
    expect(result.trend).toBe('stable');
  });

  it('should calculate trend as improving when MAE decreases', () => {
    mockGet.mockReturnValue({ count: 10 });
    // First half: higher errors, Second half: lower errors
    mockAll.mockReturnValue([
      { predicted_score: 80, actual_score: 50, calibration_error: -30, confidence_level: 4, created_at: 100 },
      { predicted_score: 80, actual_score: 55, calibration_error: -25, confidence_level: 4, created_at: 200 },
      { predicted_score: 80, actual_score: 60, calibration_error: -20, confidence_level: 4, created_at: 300 },
      { predicted_score: 80, actual_score: 78, calibration_error: -2, confidence_level: 4, created_at: 400 },
      { predicted_score: 80, actual_score: 79, calibration_error: -1, confidence_level: 4, created_at: 500 },
      { predicted_score: 80, actual_score: 80, calibration_error: 0, confidence_level: 4, created_at: 600 },
    ]);

    const result = getCalibrationAccuracy('student-1');

    expect(result.trend).toBe('improving');
  });

  it('should use default student_id', () => {
    mockGet.mockReturnValue({ count: 0 });
    mockAll.mockReturnValue([]);

    const result = getCalibrationAccuracy();

    expect(result.student_id).toBe('hyro');
  });
});

// ============================================================================
// getMetacognitiveGrowth Tests
// ============================================================================

describe('getMetacognitiveGrowth', () => {
  it('should return growth for all dimensions', () => {
    mockGet
      .mockReturnValueOnce({ score: 60 }) // earliest planning
      .mockReturnValueOnce({ score: 80 }) // latest planning
      .mockReturnValueOnce({ score: 50 }) // earliest monitoring
      .mockReturnValueOnce({ score: 70 }) // latest monitoring
      .mockReturnValueOnce({ score: 55 }) // earliest evaluation
      .mockReturnValueOnce({ score: 65 }) // latest evaluation
      .mockReturnValueOnce({ score: 40 }) // earliest regulation
      .mockReturnValueOnce({ score: 60 }); // latest regulation

    const result = getMetacognitiveGrowth('student-1', 30);

    expect(result).toHaveLength(4);
    expect(result[0].dimension).toBe('planning');
    expect(result[0].start_score).toBe(60);
    expect(result[0].current_score).toBe(80);
    expect(result[0].change).toBe(20);
  });

  it('should calculate percent change', () => {
    mockGet
      .mockReturnValueOnce({ score: 50 }) // earliest
      .mockReturnValueOnce({ score: 75 }); // latest (50% increase)

    const result = getMetacognitiveGrowth('student-1', 30);

    expect(result[0].percent_change).toBe(50);
  });

  it('should handle zero start score', () => {
    mockGet
      .mockReturnValueOnce({ score: 0 }) // earliest
      .mockReturnValueOnce({ score: 50 }); // latest

    const result = getMetacognitiveGrowth('student-1', 30);

    expect(result[0].percent_change).toBe(0); // Avoid division by zero
  });

  it('should use period_days in return value', () => {
    mockGet.mockReturnValue(undefined);

    const result = getMetacognitiveGrowth('student-1', 60);

    expect(result[0].period_days).toBe(60);
  });
});

// ============================================================================
// getDimensionHistory Tests
// ============================================================================

describe('getDimensionHistory', () => {
  it('should return history for dimension', () => {
    mockAll.mockReturnValue([
      { id: '1', student_id: 'student-1', dimension: 'planning', score: 80, evidence_count: 5, assessment_date: '2024-01-15', notes: null, created_at: 1000 },
      { id: '2', student_id: 'student-1', dimension: 'planning', score: 75, evidence_count: 4, assessment_date: '2024-01-10', notes: 'Test', created_at: 900 },
    ]);

    const result = getDimensionHistory('planning', 'student-1');

    expect(result).toHaveLength(2);
    expect(result[0].dimension).toBe('planning');
    expect(result[0].score).toBe(80);
  });

  it('should respect limit parameter', () => {
    mockAll.mockReturnValue([]);

    getDimensionHistory('monitoring', 'student-1', 10);

    expect(mockAll).toHaveBeenCalled();
  });

  it('should use default limit of 30', () => {
    mockAll.mockReturnValue([]);

    getDimensionHistory('evaluation');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should return empty array when no history', () => {
    mockAll.mockReturnValue([]);

    const result = getDimensionHistory('regulation', 'student-1');

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// getImprovementRecommendations Tests
// ============================================================================

describe('getImprovementRecommendations', () => {
  it('should return recommendations for weakest dimension', () => {
    // Mock getMetacognitiveProfile to return a profile
    mockGet
      .mockReturnValueOnce({ score: 80, created_at: 1000 }) // planning
      .mockReturnValueOnce({ score: 70, created_at: 1000 }) // monitoring
      .mockReturnValueOnce({ score: 60, created_at: 1000 }) // evaluation
      .mockReturnValueOnce({ score: 40, created_at: 1000 }); // regulation (weakest)

    const result = getImprovementRecommendations('student-1');

    expect(result).not.toBeNull();
    expect(result?.dimension).toBe('regulation');
    expect(result?.recommendations.length).toBeGreaterThan(0);
    expect(result?.indicators_to_develop.length).toBeGreaterThan(0);
  });

  it('should return null when no profile exists', () => {
    mockGet.mockReturnValue(undefined);

    const result = getImprovementRecommendations('new-student');

    expect(result).toBeNull();
  });

  it('should include indicators_to_develop from METACOGNITIVE_INDICATORS', () => {
    mockGet
      .mockReturnValueOnce({ score: 30, created_at: 1000 }) // planning (weakest)
      .mockReturnValueOnce({ score: 70, created_at: 1000 })
      .mockReturnValueOnce({ score: 60, created_at: 1000 })
      .mockReturnValueOnce({ score: 50, created_at: 1000 });

    const result = getImprovementRecommendations('student-1');

    expect(result?.indicators_to_develop).toEqual(METACOGNITIVE_INDICATORS.planning);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle all dimensions having same score', () => {
    mockGet
      .mockReturnValueOnce({ score: 75, created_at: 1000 })
      .mockReturnValueOnce({ score: 75, created_at: 1000 })
      .mockReturnValueOnce({ score: 75, created_at: 1000 })
      .mockReturnValueOnce({ score: 75, created_at: 1000 });

    const result = getMetacognitiveProfile('student-1');

    // Both should be 'planning' (first dimension checked)
    expect(result?.strongest_dimension).toBe('planning');
    expect(result?.weakest_dimension).toBe('planning');
  });

  it('should handle very large evidence arrays', () => {
    const largeEvidence = Array(1000).fill(75);

    const result = scoreMetacognitiveSkills({
      planning_evidence: largeEvidence,
      monitoring_evidence: largeEvidence,
      evaluation_evidence: largeEvidence,
      regulation_evidence: largeEvidence,
    });

    expect(result.planning_score).toBe(75);
    expect(result.overall_score).toBe(75);
  });

  it('should handle negative calibration errors', () => {
    mockGet.mockReturnValue({
      id: 'cal-123',
      student_id: 'student-1',
      task_id: 'task-456',
      task_type: 'quiz',
      stat_name: null,
      predicted_score: 90,
      confidence_level: 5,
      created_at: 1000,
    });

    const result = resolveCalibration('cal-123', 50);

    expect(result?.calibration_error).toBe(-40); // Overconfident
  });

  it('should handle boundary confidence levels', () => {
    // Confidence level 1 (minimum)
    const result1 = recordCalibrationData({
      task_id: 'task-1',
      task_type: 'quiz',
      predicted_score: 50,
      confidence_level: 1,
    });
    expect(result1.confidence_level).toBe(1);

    // Confidence level 5 (maximum)
    const result2 = recordCalibrationData({
      task_id: 'task-2',
      task_type: 'quiz',
      predicted_score: 90,
      confidence_level: 5,
    });
    expect(result2.confidence_level).toBe(5);
  });

  it('should handle growth with missing earlier scores', () => {
    mockGet
      .mockReturnValueOnce(undefined) // earliest planning (missing)
      .mockReturnValueOnce({ score: 75 }); // latest planning

    const result = getMetacognitiveGrowth('student-1', 30);

    expect(result[0].start_score).toBe(0);
    expect(result[0].current_score).toBe(75);
    expect(result[0].change).toBe(75);
  });
});
