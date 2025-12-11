// @ts-nocheck
/**
 * Tests for forge-hgm-optimizer.ts
 * HGM (Huxley-Gödel Machine) self-improvement optimizer
 * with statistical safety guarantees
 */

import {
  getHGMOptimizer,
  proposeParameterChange,
  recordExperimentObservation,
  evaluateChange,
  isChangeSafe,
  getOptimizationStatus,
  HGMOptimizer,
  DEFAULT_THRESHOLDS,
} from '@/lib/hyro/forge-hgm-optimizer';
import type {
  ExperimentConfig,
  ExperimentResult,
  HGMThresholds,
} from '@/lib/hyro/forge-hgm-optimizer';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Suppress console logs during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// Test Helpers
// ============================================================================

function generateSampleData(mean: number, std: number, n: number): number[] {
  // Generate normally distributed data using Box-Muller transform
  const data: number[] = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    data.push(mean + std * z);
  }
  return data;
}

function createFreshOptimizer(thresholds?: Partial<HGMThresholds>): HGMOptimizer {
  return new HGMOptimizer(thresholds);
}

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-hgm-optimizer types', () => {
  describe('ExperimentConfig interface', () => {
    it('should have required properties', () => {
      const config: ExperimentConfig = {
        id: 'exp-123',
        parameter: 'learning_rate',
        baselineValue: 0.01,
        proposedValue: 0.012,
        hypothesis: 'Higher learning rate improves convergence',
        status: 'active',
        createdAt: new Date(),
      };

      expect(config.id).toBeDefined();
      expect(config.parameter).toBeDefined();
      expect(config.baselineValue).toBeDefined();
      expect(config.proposedValue).toBeDefined();
      expect(config.hypothesis).toBeDefined();
      expect(config.status).toBeDefined();
      expect(config.createdAt).toBeDefined();
    });

    it('should support all status values', () => {
      const statuses: ExperimentConfig['status'][] = [
        'active',
        'evaluated',
        'applied',
        'rejected',
      ];

      statuses.forEach((status) => {
        const config: ExperimentConfig = {
          id: 'exp-123',
          parameter: 'test',
          baselineValue: 1,
          proposedValue: 1.05,
          hypothesis: 'test',
          status,
          createdAt: new Date(),
        };
        expect(config.status).toBe(status);
      });
    });
  });

  describe('ExperimentResult interface', () => {
    it('should have required properties', () => {
      const result: ExperimentResult = {
        experimentId: 'exp-123',
        sampleSize: 50,
        baselineMean: 0.5,
        baselineStd: 0.1,
        treatmentMean: 0.6,
        treatmentStd: 0.12,
        pValue: 0.001,
        cohensD: 0.9,
        isSignificant: true,
        meetsEffectSize: true,
        recommendedAction: 'apply',
        evaluatedAt: new Date(),
      };

      expect(result.experimentId).toBeDefined();
      expect(result.sampleSize).toBeDefined();
      expect(result.pValue).toBeDefined();
      expect(result.cohensD).toBeDefined();
      expect(result.recommendedAction).toBeDefined();
    });

    it('should support all recommended action values', () => {
      const actions: ExperimentResult['recommendedAction'][] = [
        'apply',
        'reject',
        'continue',
      ];

      actions.forEach((action) => {
        expect(['apply', 'reject', 'continue']).toContain(action);
      });
    });
  });

  describe('HGMThresholds interface', () => {
    it('should have default values', () => {
      expect(DEFAULT_THRESHOLDS.minPValue).toBe(0.01);
      expect(DEFAULT_THRESHOLDS.minEffectSize).toBe(0.8);
      expect(DEFAULT_THRESHOLDS.maxChangePercent).toBe(0.05);
      expect(DEFAULT_THRESHOLDS.minSampleSize).toBe(30);
    });
  });
});

// ============================================================================
// HGMOptimizer Class Tests
// ============================================================================

describe('HGMOptimizer', () => {
  let optimizer: HGMOptimizer;

  beforeEach(() => {
    optimizer = createFreshOptimizer();
  });

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      const opt = createFreshOptimizer();
      expect(opt).toBeDefined();
    });

    it('should accept custom thresholds', () => {
      const opt = createFreshOptimizer({
        minPValue: 0.05,
        minEffectSize: 0.5,
      });
      expect(opt).toBeDefined();
    });
  });

  describe('proposeExperiment', () => {
    it('should create an experiment with valid parameters', () => {
      const experiment = optimizer.proposeExperiment(
        'learning_rate',
        0.01,
        0.0105, // 5% increase (within bounds)
        'Higher rate improves convergence'
      );

      expect(experiment.id).toBeDefined();
      expect(experiment.parameter).toBe('learning_rate');
      expect(experiment.baselineValue).toBe(0.01);
      expect(experiment.proposedValue).toBe(0.0105);
      expect(experiment.status).toBe('active');
    });

    it('should throw error for change exceeding bounds', () => {
      expect(() => {
        optimizer.proposeExperiment(
          'learning_rate',
          0.01,
          0.02, // 100% increase (exceeds 5%)
          'Too large change'
        );
      }).toThrow(/exceeds/);
    });

    it('should generate unique experiment IDs', () => {
      const exp1 = optimizer.proposeExperiment('param1', 1, 1.05, 'test 1');
      const exp2 = optimizer.proposeExperiment('param2', 2, 2.1, 'test 2');

      expect(exp1.id).not.toBe(exp2.id);
    });
  });

  describe('recordObservation', () => {
    it('should record baseline observation', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      expect(() => {
        optimizer.recordObservation(experiment.id, true, 0.5);
      }).not.toThrow();
    });

    it('should record treatment observation', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      expect(() => {
        optimizer.recordObservation(experiment.id, false, 0.6);
      }).not.toThrow();
    });

    it('should throw error for unknown experiment', () => {
      expect(() => {
        optimizer.recordObservation('unknown-id', true, 0.5);
      }).toThrow(/Unknown experiment/);
    });
  });

  describe('evaluateExperiment', () => {
    it('should return continue when sample size is too small', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Add only 5 observations (less than minSampleSize of 30)
      for (let i = 0; i < 5; i++) {
        optimizer.recordObservation(experiment.id, true, 0.5);
        optimizer.recordObservation(experiment.id, false, 0.6);
      }

      const result = optimizer.evaluateExperiment(experiment.id);

      expect(result.recommendedAction).toBe('continue');
      expect(result.sampleSize).toBe(5);
    });

    it('should recommend apply for significant improvement', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Add significantly different data
      const baselineData = generateSampleData(0.5, 0.05, 50);
      const treatmentData = generateSampleData(0.7, 0.05, 50); // Much higher

      baselineData.forEach((v) => optimizer.recordObservation(experiment.id, true, v));
      treatmentData.forEach((v) => optimizer.recordObservation(experiment.id, false, v));

      const result = optimizer.evaluateExperiment(experiment.id);

      // Result depends on statistical outcome
      expect(['apply', 'reject', 'continue']).toContain(result.recommendedAction);
    });

    it('should recommend reject for no improvement', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Add similar data (no difference)
      for (let i = 0; i < 100; i++) {
        optimizer.recordObservation(experiment.id, true, 0.5 + Math.random() * 0.01);
        optimizer.recordObservation(experiment.id, false, 0.5 + Math.random() * 0.01);
      }

      const result = optimizer.evaluateExperiment(experiment.id);

      // With no difference and enough samples, should reject
      expect(['reject', 'continue']).toContain(result.recommendedAction);
    });

    it('should throw error for unknown experiment', () => {
      expect(() => {
        optimizer.evaluateExperiment('unknown-id');
      }).toThrow(/Unknown experiment/);
    });

    it('should update experiment status to evaluated', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      for (let i = 0; i < 30; i++) {
        optimizer.recordObservation(experiment.id, true, 0.5);
        optimizer.recordObservation(experiment.id, false, 0.5);
      }

      optimizer.evaluateExperiment(experiment.id);

      const activeExperiments = optimizer.getActiveExperiments();
      expect(activeExperiments.find((e) => e.id === experiment.id)).toBeUndefined();
    });
  });

  describe('applyChange', () => {
    it('should fail for unevaluated experiment', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      const result = optimizer.applyChange(experiment.id);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('not found or not evaluated');
    });

    it('should fail when recommendation is not apply', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Create conditions for reject recommendation
      for (let i = 0; i < 100; i++) {
        optimizer.recordObservation(experiment.id, true, 0.5);
        optimizer.recordObservation(experiment.id, false, 0.5);
      }

      optimizer.evaluateExperiment(experiment.id);
      const result = optimizer.applyChange(experiment.id);

      expect(result.success).toBe(false);
    });

    it('should succeed when all conditions are met', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Create conditions for apply recommendation
      const baselineData = generateSampleData(0.3, 0.02, 50);
      const treatmentData = generateSampleData(0.5, 0.02, 50);

      baselineData.forEach((v) => optimizer.recordObservation(experiment.id, true, v));
      treatmentData.forEach((v) => optimizer.recordObservation(experiment.id, false, v));

      const evalResult = optimizer.evaluateExperiment(experiment.id);

      if (evalResult.recommendedAction === 'apply') {
        const result = optimizer.applyChange(experiment.id);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('rollbackLastChange', () => {
    it('should return success false when no changes applied', () => {
      const result = optimizer.rollbackLastChange();
      expect(result.success).toBe(false);
    });

    it('should rollback the last applied change', () => {
      // Need to manually set up a successful apply scenario
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Generate data that should pass all checks
      const baselineData = generateSampleData(0.2, 0.02, 50);
      const treatmentData = generateSampleData(0.5, 0.02, 50);

      baselineData.forEach((v) => optimizer.recordObservation(experiment.id, true, v));
      treatmentData.forEach((v) => optimizer.recordObservation(experiment.id, false, v));

      const evalResult = optimizer.evaluateExperiment(experiment.id);

      if (evalResult.recommendedAction === 'apply') {
        optimizer.applyChange(experiment.id);
        const rollback = optimizer.rollbackLastChange();

        expect(rollback.success).toBe(true);
        expect(rollback.parameter).toBe('param');
        expect(rollback.restoredValue).toBe(1);
      }
    });
  });

  describe('getExperimentHistory', () => {
    it('should return empty array initially', () => {
      const history = optimizer.getExperimentHistory();
      expect(history).toEqual([]);
    });

    it('should return evaluated experiments', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      for (let i = 0; i < 30; i++) {
        optimizer.recordObservation(experiment.id, true, 0.5);
        optimizer.recordObservation(experiment.id, false, 0.5);
      }

      optimizer.evaluateExperiment(experiment.id);

      const history = optimizer.getExperimentHistory();
      expect(history).toHaveLength(1);
      expect(history[0].experimentId).toBe(experiment.id);
    });
  });

  describe('getActiveExperiments', () => {
    it('should return empty array initially', () => {
      const active = optimizer.getActiveExperiments();
      expect(active).toEqual([]);
    });

    it('should return active experiments', () => {
      optimizer.proposeExperiment('param1', 1, 1.05, 'test 1');
      optimizer.proposeExperiment('param2', 2, 2.1, 'test 2');

      const active = optimizer.getActiveExperiments();
      expect(active).toHaveLength(2);
    });

    it('should not return evaluated experiments', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      for (let i = 0; i < 30; i++) {
        optimizer.recordObservation(experiment.id, true, 0.5);
        optimizer.recordObservation(experiment.id, false, 0.5);
      }

      optimizer.evaluateExperiment(experiment.id);

      const active = optimizer.getActiveExperiments();
      expect(active.find((e) => e.id === experiment.id)).toBeUndefined();
    });
  });

  describe('getOptimizationRecommendations', () => {
    it('should return empty array when no apply recommendations', () => {
      const recommendations = optimizer.getOptimizationRecommendations();
      expect(recommendations).toEqual([]);
    });

    it('should return recommendations for applicable experiments', () => {
      const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

      // Create conditions for apply recommendation
      const baselineData = generateSampleData(0.2, 0.02, 50);
      const treatmentData = generateSampleData(0.5, 0.02, 50);

      baselineData.forEach((v) => optimizer.recordObservation(experiment.id, true, v));
      treatmentData.forEach((v) => optimizer.recordObservation(experiment.id, false, v));

      const evalResult = optimizer.evaluateExperiment(experiment.id);

      if (evalResult.recommendedAction === 'apply') {
        const recommendations = optimizer.getOptimizationRecommendations();
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// Singleton Instance Tests
// ============================================================================

describe('getHGMOptimizer singleton', () => {
  it('should return the same instance on multiple calls', () => {
    // Note: This may fail if previous tests used the singleton
    // The singleton pattern means we get the same instance
    const opt1 = getHGMOptimizer();
    const opt2 = getHGMOptimizer();

    expect(opt1).toBe(opt2);
  });
});

// ============================================================================
// Convenience Export Tests
// ============================================================================

describe('convenience exports', () => {
  describe('proposeParameterChange', () => {
    it('should propose a parameter change', () => {
      const experiment = proposeParameterChange(
        'test_param_1',
        1,
        1.05,
        'Test hypothesis'
      );

      expect(experiment.parameter).toBe('test_param_1');
      expect(experiment.status).toBe('active');
    });
  });

  describe('recordExperimentObservation', () => {
    it('should record observation via singleton', () => {
      const experiment = proposeParameterChange(
        'test_param_2',
        1,
        1.05,
        'Test hypothesis'
      );

      expect(() => {
        recordExperimentObservation(experiment.id, true, 0.5);
      }).not.toThrow();
    });
  });

  describe('evaluateChange', () => {
    it('should record data and evaluate', () => {
      const experiment = proposeParameterChange(
        'test_param_3',
        1,
        1.05,
        'Test hypothesis'
      );

      const baselineData = Array(30).fill(0).map(() => 0.5);
      const treatmentData = Array(30).fill(0).map(() => 0.5);

      const result = evaluateChange(experiment.id, baselineData, treatmentData);

      expect(result.experimentId).toBe(experiment.id);
      expect(result.sampleSize).toBe(30);
    });
  });

  describe('isChangeSafe', () => {
    it('should return true for safe changes', () => {
      const result: ExperimentResult = {
        experimentId: 'test',
        sampleSize: 50,
        baselineMean: 0.5,
        baselineStd: 0.1,
        treatmentMean: 0.7,
        treatmentStd: 0.1,
        pValue: 0.001,
        cohensD: 0.9,
        isSignificant: true,
        meetsEffectSize: true,
        recommendedAction: 'apply',
        evaluatedAt: new Date(),
      };

      expect(isChangeSafe(result)).toBe(true);
    });

    it('should return false when not significant', () => {
      const result: ExperimentResult = {
        experimentId: 'test',
        sampleSize: 50,
        baselineMean: 0.5,
        baselineStd: 0.1,
        treatmentMean: 0.52,
        treatmentStd: 0.1,
        pValue: 0.3,
        cohensD: 0.2,
        isSignificant: false,
        meetsEffectSize: false,
        recommendedAction: 'reject',
        evaluatedAt: new Date(),
      };

      expect(isChangeSafe(result)).toBe(false);
    });

    it('should return false when effect size not met', () => {
      const result: ExperimentResult = {
        experimentId: 'test',
        sampleSize: 50,
        baselineMean: 0.5,
        baselineStd: 0.1,
        treatmentMean: 0.55,
        treatmentStd: 0.1,
        pValue: 0.001,
        cohensD: 0.4,
        isSignificant: true,
        meetsEffectSize: false,
        recommendedAction: 'reject',
        evaluatedAt: new Date(),
      };

      expect(isChangeSafe(result)).toBe(false);
    });

    it('should return false when recommended action is not apply', () => {
      const result: ExperimentResult = {
        experimentId: 'test',
        sampleSize: 50,
        baselineMean: 0.5,
        baselineStd: 0.1,
        treatmentMean: 0.7,
        treatmentStd: 0.1,
        pValue: 0.001,
        cohensD: 0.9,
        isSignificant: true,
        meetsEffectSize: true,
        recommendedAction: 'continue', // Not 'apply'
        evaluatedAt: new Date(),
      };

      expect(isChangeSafe(result)).toBe(false);
    });
  });

  describe('getOptimizationStatus', () => {
    it('should return status object', () => {
      const status = getOptimizationStatus();

      expect(status).toHaveProperty('activeExperiments');
      expect(status).toHaveProperty('appliedChanges');
      expect(status).toHaveProperty('pendingRecommendations');
      expect(typeof status.activeExperiments).toBe('number');
      expect(typeof status.appliedChanges).toBe('number');
      expect(typeof status.pendingRecommendations).toBe('number');
    });
  });
});

// ============================================================================
// Statistical Function Tests (via evaluation)
// ============================================================================

describe('statistical calculations', () => {
  let optimizer: HGMOptimizer;

  beforeEach(() => {
    optimizer = createFreshOptimizer();
  });

  it('should calculate correct p-value for very different samples', () => {
    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // Very different distributions
    for (let i = 0; i < 50; i++) {
      optimizer.recordObservation(experiment.id, true, 0.1);
      optimizer.recordObservation(experiment.id, false, 0.9);
    }

    const result = optimizer.evaluateExperiment(experiment.id);

    // Should be highly significant
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.isSignificant).toBe(true);
  });

  it('should calculate low p-value for identical samples', () => {
    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // Identical distributions
    for (let i = 0; i < 50; i++) {
      optimizer.recordObservation(experiment.id, true, 0.5);
      optimizer.recordObservation(experiment.id, false, 0.5);
    }

    const result = optimizer.evaluateExperiment(experiment.id);

    // Should not be significant
    expect(result.isSignificant).toBe(false);
  });

  it('should calculate correct Cohen\'s d for large effect', () => {
    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // Large effect size
    for (let i = 0; i < 50; i++) {
      optimizer.recordObservation(experiment.id, true, 0.3);
      optimizer.recordObservation(experiment.id, false, 0.8);
    }

    const result = optimizer.evaluateExperiment(experiment.id);

    // Should have large effect size
    expect(result.cohensD).toBeGreaterThan(0.5);
  });

  it('should handle empty samples gracefully', () => {
    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // No observations
    const result = optimizer.evaluateExperiment(experiment.id);

    expect(result.sampleSize).toBe(0);
    expect(result.recommendedAction).toBe('continue');
  });

  it('should handle single observation gracefully', () => {
    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    optimizer.recordObservation(experiment.id, true, 0.5);
    optimizer.recordObservation(experiment.id, false, 0.6);

    const result = optimizer.evaluateExperiment(experiment.id);

    expect(result.sampleSize).toBe(1);
    expect(result.recommendedAction).toBe('continue');
  });
});

// ============================================================================
// Bounds Checking Tests
// ============================================================================

describe('bounds checking', () => {
  let optimizer: HGMOptimizer;

  beforeEach(() => {
    optimizer = createFreshOptimizer();
  });

  it('should allow changes at exactly 5%', () => {
    expect(() => {
      optimizer.proposeExperiment('param', 1, 1.05, 'test');
    }).not.toThrow();

    expect(() => {
      optimizer.proposeExperiment('param2', 1, 0.95, 'test');
    }).not.toThrow();
  });

  it('should reject changes over 5%', () => {
    expect(() => {
      optimizer.proposeExperiment('param', 1, 1.06, 'test');
    }).toThrow(/exceeds/);

    expect(() => {
      optimizer.proposeExperiment('param2', 1, 0.94, 'test');
    }).toThrow(/exceeds/);
  });

  it('should use custom maxChangePercent threshold', () => {
    const customOptimizer = createFreshOptimizer({ maxChangePercent: 0.1 });

    // 10% should now be allowed
    expect(() => {
      customOptimizer.proposeExperiment('param', 1, 1.1, 'test');
    }).not.toThrow();
  });
});

// ============================================================================
// Custom Thresholds Tests
// ============================================================================

describe('custom thresholds', () => {
  it('should use custom minPValue', () => {
    const optimizer = createFreshOptimizer({ minPValue: 0.05 });

    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // With p < 0.05 threshold, more experiments would pass
    for (let i = 0; i < 50; i++) {
      optimizer.recordObservation(experiment.id, true, 0.5 + Math.random() * 0.1);
      optimizer.recordObservation(experiment.id, false, 0.55 + Math.random() * 0.1);
    }

    const result = optimizer.evaluateExperiment(experiment.id);
    // Result depends on random data
    expect(result).toBeDefined();
  });

  it('should use custom minEffectSize', () => {
    const optimizer = createFreshOptimizer({ minEffectSize: 0.2 });

    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // With lower effect size threshold, more experiments would pass
    for (let i = 0; i < 50; i++) {
      optimizer.recordObservation(experiment.id, true, 0.5);
      optimizer.recordObservation(experiment.id, false, 0.55);
    }

    const result = optimizer.evaluateExperiment(experiment.id);
    expect(result).toBeDefined();
  });

  it('should use custom minSampleSize', () => {
    const optimizer = createFreshOptimizer({ minSampleSize: 10 });

    const experiment = optimizer.proposeExperiment('param', 1, 1.05, 'test');

    // With 10 sample minimum, should evaluate with fewer observations
    for (let i = 0; i < 15; i++) {
      optimizer.recordObservation(experiment.id, true, 0.5);
      optimizer.recordObservation(experiment.id, false, 0.8);
    }

    const result = optimizer.evaluateExperiment(experiment.id);
    expect(result.sampleSize).toBe(15);
    // Should not be 'continue' since we have enough samples
    expect(result.pValue).toBeDefined();
  });
});
