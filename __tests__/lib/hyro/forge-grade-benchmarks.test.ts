// @ts-nocheck
/**
 * Tests for forge-grade-benchmarks.ts
 * Multi-grade benchmark system for K-12 education
 */

// Mock database
const mockDb = {
  prepare: jest.fn().mockReturnThis(),
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn().mockReturnValue([]),
  exec: jest.fn(),
};

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-12345'),
}));

import {
  // Types
  GradeLevel,
  GRADE_LEVELS,
  GradeBenchmark,
  StudentGradeProfile,
  GradeInferenceResult,
  // Functions
  getBenchmark,
  getGradeBenchmarks,
  get50thPercentileBenchmarks,
  getStatBenchmark,
  inferGradeLevel,
  inferAllGradeLevels,
  getStudentGradeProfile,
  updateEnrolledGrade,
  updateInferredGrade,
  getEffectiveGrade,
  getEffectiveBenchmark,
  calculatePercentile,
  getPerformanceStatus,
  initializeGradeInferenceTable,
  gradeToNumeric,
  numericToGrade,
  gradeDifference,
} from '@/lib/hyro/forge-grade-benchmarks';
import type { StatName } from '@/lib/hyro/forge-types';

// ============================================================================
// Constants Tests
// ============================================================================

describe('grade level constants', () => {
  describe('GRADE_LEVELS', () => {
    it('should include K through 12', () => {
      expect(GRADE_LEVELS).toContain('K');
      expect(GRADE_LEVELS).toContain('1');
      expect(GRADE_LEVELS).toContain('6');
      expect(GRADE_LEVELS).toContain('12');
    });

    it('should have 13 grade levels', () => {
      expect(GRADE_LEVELS).toHaveLength(13);
    });

    it('should be in order', () => {
      expect(GRADE_LEVELS[0]).toBe('K');
      expect(GRADE_LEVELS[1]).toBe('1');
      expect(GRADE_LEVELS[12]).toBe('12');
    });
  });
});

// ============================================================================
// getBenchmark Tests
// ============================================================================

describe('getBenchmark', () => {
  it('should return benchmark for grade 6 math', () => {
    const benchmark = getBenchmark('6', 'math');

    expect(benchmark.grade).toBe('6');
    expect(benchmark.stat_name).toBe('math');
    expect(benchmark.benchmark_25th).toBeDefined();
    expect(benchmark.benchmark_50th).toBeDefined();
    expect(benchmark.benchmark_75th).toBeDefined();
    expect(benchmark.std_dev).toBeDefined();
    expect(benchmark.source).toBeDefined();
  });

  it('should return different benchmarks for different grades', () => {
    const grade3 = getBenchmark('3', 'math');
    const grade6 = getBenchmark('6', 'math');
    const grade9 = getBenchmark('9', 'math');

    expect(grade3.benchmark_50th).toBeLessThan(grade6.benchmark_50th);
    expect(grade6.benchmark_50th).toBeLessThan(grade9.benchmark_50th);
  });

  it('should have K grade with lowest benchmarks', () => {
    const kMath = getBenchmark('K', 'math');
    const grade1Math = getBenchmark('1', 'math');

    expect(kMath.benchmark_50th).toBeLessThan(grade1Math.benchmark_50th);
  });

  it('should have grade 12 with highest benchmarks', () => {
    const grade11 = getBenchmark('11', 'math');
    const grade12 = getBenchmark('12', 'math');

    expect(grade12.benchmark_50th).toBeGreaterThanOrEqual(grade11.benchmark_50th);
  });

  it('should have valid percentile relationships', () => {
    const benchmark = getBenchmark('6', 'math');

    expect(benchmark.benchmark_25th).toBeLessThan(benchmark.benchmark_50th);
    expect(benchmark.benchmark_50th).toBeLessThan(benchmark.benchmark_75th);
  });
});

// ============================================================================
// getGradeBenchmarks Tests
// ============================================================================

describe('getGradeBenchmarks', () => {
  it('should return benchmarks for all stats', () => {
    const benchmarks = getGradeBenchmarks('6');

    expect(benchmarks.math).toBeDefined();
    expect(benchmarks.reading).toBeDefined();
    expect(benchmarks.writing).toBeDefined();
    expect(benchmarks.science).toBeDefined();
    expect(benchmarks.social_studies).toBeDefined();
    expect(benchmarks.coding).toBeDefined();
    expect(benchmarks.critical_thinking).toBeDefined();
  });

  it('should have same grade for all returned benchmarks', () => {
    const benchmarks = getGradeBenchmarks('8');

    Object.values(benchmarks).forEach((b) => {
      expect(b.grade).toBe('8');
    });
  });
});

// ============================================================================
// get50thPercentileBenchmarks Tests
// ============================================================================

describe('get50thPercentileBenchmarks', () => {
  it('should return 50th percentile values for all stats', () => {
    const benchmarks = get50thPercentileBenchmarks('6');

    expect(typeof benchmarks.math).toBe('number');
    expect(typeof benchmarks.reading).toBe('number');
    expect(typeof benchmarks.science).toBe('number');
  });

  it('should default to grade 6', () => {
    const defaultBenchmarks = get50thPercentileBenchmarks();
    const grade6Benchmarks = get50thPercentileBenchmarks('6');

    expect(defaultBenchmarks).toEqual(grade6Benchmarks);
  });

  it('should return only numeric values', () => {
    const benchmarks = get50thPercentileBenchmarks('6');

    Object.values(benchmarks).forEach((value) => {
      expect(typeof value).toBe('number');
    });
  });
});

// ============================================================================
// getStatBenchmark Tests
// ============================================================================

describe('getStatBenchmark', () => {
  it('should return 50th percentile for a single stat', () => {
    const mathBenchmark = getStatBenchmark('math', '6');
    const fullBenchmark = getBenchmark('6', 'math');

    expect(mathBenchmark).toBe(fullBenchmark.benchmark_50th);
  });

  it('should default to grade 6', () => {
    const defaultMath = getStatBenchmark('math');
    const grade6Math = getStatBenchmark('math', '6');

    expect(defaultMath).toBe(grade6Math);
  });
});

// ============================================================================
// inferGradeLevel Tests
// ============================================================================

describe('inferGradeLevel', () => {
  it('should infer K for very low proficiency', () => {
    const result = inferGradeLevel('math', 10);

    expect(result.inferred_grade).toBe('K');
    expect(result.stat_name).toBe('math');
  });

  it('should infer grade 12 for very high proficiency', () => {
    const result = inferGradeLevel('math', 85);

    expect(result.inferred_grade).toBe('12');
  });

  it('should infer middle grades for middle proficiency', () => {
    const result = inferGradeLevel('math', 55);

    // Should be around grade 5-7
    const gradeNum = gradeToNumeric(result.inferred_grade);
    expect(gradeNum).toBeGreaterThanOrEqual(4);
    expect(gradeNum).toBeLessThanOrEqual(8);
  });

  it('should return confidence score', () => {
    const result = inferGradeLevel('math', 65);

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should include proficiency level in result', () => {
    const result = inferGradeLevel('math', 50);

    expect(result.proficiency_level).toBe(50);
  });

  it('should include closest benchmark', () => {
    const result = inferGradeLevel('math', 65);

    expect(result.closest_benchmark).toBeDefined();
    expect(typeof result.closest_benchmark).toBe('number');
  });

  it('should include reasoning', () => {
    const result = inferGradeLevel('math', 65);

    expect(result.reasoning).toBeDefined();
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// inferAllGradeLevels Tests
// ============================================================================

describe('inferAllGradeLevels', () => {
  it('should infer grades for all stats', () => {
    const proficiencies: Record<StatName, number> = {
      math: 60,
      reading: 55,
      writing: 50,
      science: 65,
      social_studies: 58,
      financial_literacy: 45,
      coding: 40,
      study_skills: 55,
      critical_thinking: 52,
      technology: 48,
      problem_solving: 57,
    };

    const results = inferAllGradeLevels(proficiencies);

    expect(results.math).toBeDefined();
    expect(results.reading).toBeDefined();
    expect(results.science).toBeDefined();
  });

  it('should use default 50 for missing proficiencies', () => {
    const partialProficiencies = {
      math: 60,
    } as Record<StatName, number>;

    const results = inferAllGradeLevels(partialProficiencies);

    expect(results.reading.proficiency_level).toBe(50);
  });
});

// ============================================================================
// Student Grade Profile Tests
// ============================================================================

describe('getStudentGradeProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.get.mockReturnValue({ id: 'student-123', enrolled_grade: '6' });
    mockDb.all.mockReturnValue([
      { stat_name: 'math', inferred_grade: '7', confidence: 0.8 },
      { stat_name: 'reading', inferred_grade: '5', confidence: 0.6 },
    ]);
  });

  it('should return student profile with enrolled grade', () => {
    const profile = getStudentGradeProfile('student-123');

    expect(profile.student_id).toBe('student-123');
    expect(profile.enrolled_grade).toBe('6');
  });

  it('should include inferred grades', () => {
    const profile = getStudentGradeProfile('student-123');

    expect(profile.inferred_grades.math).toBe('7');
    expect(profile.inferred_grades.reading).toBe('5');
  });

  it('should fill missing stats with enrolled grade', () => {
    const profile = getStudentGradeProfile('student-123');

    // Stats not in the mock should default to enrolled grade
    expect(profile.inferred_grades.science).toBe('6');
  });

  it('should include confidence scores', () => {
    const profile = getStudentGradeProfile('student-123');

    expect(profile.grade_confidence.math).toBe(0.8);
    expect(profile.grade_confidence.reading).toBe(0.6);
  });

  it('should use default confidence for missing stats', () => {
    const profile = getStudentGradeProfile('student-123');

    expect(profile.grade_confidence.science).toBe(0.5);
  });
});

describe('updateEnrolledGrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call database update', () => {
    updateEnrolledGrade('student-123', '7');

    expect(mockDb.prepare).toHaveBeenCalled();
    expect(mockDb.run).toHaveBeenCalledWith('7', 'student-123');
  });
});

describe('updateInferredGrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should insert or update inferred grade', () => {
    updateInferredGrade('student-123', 'math', '7', 0.85, 5);

    expect(mockDb.prepare).toHaveBeenCalled();
    expect(mockDb.run).toHaveBeenCalled();
  });
});

describe('getEffectiveGrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.get.mockReturnValue({ id: 'student-123', enrolled_grade: '6' });
  });

  it('should return inferred grade when confidence is high', () => {
    mockDb.all.mockReturnValue([
      { stat_name: 'math', inferred_grade: '8', confidence: 0.85 },
    ]);

    const grade = getEffectiveGrade('student-123', 'math');
    expect(grade).toBe('8');
  });

  it('should return enrolled grade when confidence is low', () => {
    mockDb.all.mockReturnValue([
      { stat_name: 'math', inferred_grade: '8', confidence: 0.5 },
    ]);

    const grade = getEffectiveGrade('student-123', 'math');
    expect(grade).toBe('6');
  });
});

describe('getEffectiveBenchmark', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.get.mockReturnValue({ id: 'student-123', enrolled_grade: '6' });
    mockDb.all.mockReturnValue([
      { stat_name: 'math', inferred_grade: '7', confidence: 0.8 },
    ]);
  });

  it('should return benchmark based on effective grade', () => {
    const benchmark = getEffectiveBenchmark('student-123', 'math');
    const grade7Benchmark = getStatBenchmark('math', '7');

    expect(benchmark).toBe(grade7Benchmark);
  });
});

// ============================================================================
// Percentile Calculation Tests
// ============================================================================

describe('calculatePercentile', () => {
  it('should return ~50 for 50th percentile proficiency', () => {
    const benchmark = getBenchmark('6', 'math');
    const percentile = calculatePercentile(benchmark.benchmark_50th, 'math', '6');

    expect(percentile).toBeGreaterThan(45);
    expect(percentile).toBeLessThan(55);
  });

  it('should return low percentile for low proficiency', () => {
    const benchmark = getBenchmark('6', 'math');
    const percentile = calculatePercentile(benchmark.benchmark_25th - 10, 'math', '6');

    expect(percentile).toBeLessThan(25);
  });

  it('should return high percentile for high proficiency', () => {
    const benchmark = getBenchmark('6', 'math');
    const percentile = calculatePercentile(benchmark.benchmark_75th + 10, 'math', '6');

    expect(percentile).toBeGreaterThan(75);
  });

  it('should bound percentiles between 1 and 99', () => {
    const veryLow = calculatePercentile(-100, 'math', '6');
    const veryHigh = calculatePercentile(200, 'math', '6');

    expect(veryLow).toBeGreaterThanOrEqual(1);
    expect(veryHigh).toBeLessThanOrEqual(99);
  });
});

// ============================================================================
// Performance Status Tests
// ============================================================================

describe('getPerformanceStatus', () => {
  it('should return "at" for proficiency at 50th percentile', () => {
    const benchmark = getBenchmark('6', 'math');
    const status = getPerformanceStatus(benchmark.benchmark_50th, 'math', '6');

    expect(status).toBe('at');
  });

  it('should return "far_below" for very low proficiency', () => {
    const benchmark = getBenchmark('6', 'math');
    const status = getPerformanceStatus(benchmark.benchmark_25th - 15, 'math', '6');

    expect(status).toBe('far_below');
  });

  it('should return "below" for proficiency below 25th', () => {
    const benchmark = getBenchmark('6', 'math');
    const status = getPerformanceStatus(benchmark.benchmark_25th - 5, 'math', '6');

    expect(status).toBe('below');
  });

  it('should return "approaching" for proficiency between 25th and 50th', () => {
    const benchmark = getBenchmark('6', 'math');
    const midpoint = (benchmark.benchmark_25th + benchmark.benchmark_50th) / 2;
    const status = getPerformanceStatus(midpoint - 3, 'math', '6');

    expect(status).toBe('approaching');
  });

  it('should return "above" for proficiency above 50th', () => {
    const benchmark = getBenchmark('6', 'math');
    const status = getPerformanceStatus(benchmark.benchmark_75th - 5, 'math', '6');

    expect(status).toBe('above');
  });

  it('should return "far_above" for proficiency above 75th', () => {
    const benchmark = getBenchmark('6', 'math');
    const status = getPerformanceStatus(benchmark.benchmark_75th + 5, 'math', '6');

    expect(status).toBe('far_above');
  });
});

// ============================================================================
// Grade Conversion Tests
// ============================================================================

describe('gradeToNumeric', () => {
  it('should convert K to 0', () => {
    expect(gradeToNumeric('K')).toBe(0);
  });

  it('should convert grade strings to numbers', () => {
    expect(gradeToNumeric('1')).toBe(1);
    expect(gradeToNumeric('6')).toBe(6);
    expect(gradeToNumeric('12')).toBe(12);
  });
});

describe('numericToGrade', () => {
  it('should convert 0 to K', () => {
    expect(numericToGrade(0)).toBe('K');
  });

  it('should convert negative to K', () => {
    expect(numericToGrade(-1)).toBe('K');
  });

  it('should convert numbers to grade strings', () => {
    expect(numericToGrade(1)).toBe('1');
    expect(numericToGrade(6)).toBe('6');
    expect(numericToGrade(12)).toBe('12');
  });

  it('should cap at 12', () => {
    expect(numericToGrade(15)).toBe('12');
  });
});

describe('gradeDifference', () => {
  it('should return positive for ahead', () => {
    expect(gradeDifference('8', '6')).toBe(2);
  });

  it('should return negative for behind', () => {
    expect(gradeDifference('4', '6')).toBe(-2);
  });

  it('should return 0 for same grade', () => {
    expect(gradeDifference('6', '6')).toBe(0);
  });

  it('should handle K grade', () => {
    expect(gradeDifference('2', 'K')).toBe(2);
    expect(gradeDifference('K', '2')).toBe(-2);
  });
});

// ============================================================================
// Database Schema Tests
// ============================================================================

describe('initializeGradeInferenceTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create tables and indexes', () => {
    initializeGradeInferenceTable();

    expect(mockDb.exec).toHaveBeenCalled();
  });

  it('should handle existing column gracefully', () => {
    mockDb.exec.mockImplementationOnce(() => {
      throw new Error('Column already exists');
    });

    // Should not throw
    expect(() => initializeGradeInferenceTable()).not.toThrow();
  });
});
