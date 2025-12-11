/**
 * HYRO FORGE: HGM (Huxley-Gödel Machine) Optimizer
 * Self-improvement system with statistical safety guarantees
 *
 * Thresholds:
 * - p < 0.01 (99% confidence)
 * - Cohen's d > 0.8 (large effect size)
 * - ±5% maximum change per iteration
 */

import { ensureServerOnly } from '../server-only-guard';
ensureServerOnly('forge-hgm-optimizer');

// ============================================================================
// Types
// ============================================================================

export interface ExperimentConfig {
  id: string;
  parameter: string;
  baselineValue: number;
  proposedValue: number;
  hypothesis: string;
  status: 'active' | 'evaluated' | 'applied' | 'rejected';
  createdAt: Date;
}

export interface ExperimentResult {
  experimentId: string;
  sampleSize: number;
  baselineMean: number;
  baselineStd: number;
  treatmentMean: number;
  treatmentStd: number;
  pValue: number;
  cohensD: number;
  isSignificant: boolean;
  meetsEffectSize: boolean;
  recommendedAction: 'apply' | 'reject' | 'continue';
  evaluatedAt: Date;
}

export interface HGMThresholds {
  minPValue: number;
  minEffectSize: number;
  maxChangePercent: number;
  minSampleSize: number;
}

interface AppliedChange {
  experimentId: string;
  parameter: string;
  oldValue: number;
  newValue: number;
  timestamp: Date;
}

interface ObservationData {
  baseline: number[];
  treatment: number[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_THRESHOLDS: HGMThresholds = {
  minPValue: 0.01,
  minEffectSize: 0.8,
  maxChangePercent: 0.05,
  minSampleSize: 30,
};

// ============================================================================
// Statistical Functions
// ============================================================================

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function calculateCohensD(
  mean1: number,
  std1: number,
  n1: number,
  mean2: number,
  std2: number,
  n2: number
): number {
  const pooledStd = Math.sqrt(
    ((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / (n1 + n2 - 2)
  );
  if (pooledStd === 0) return 0;
  return Math.abs(mean2 - mean1) / pooledStd;
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  return 0.5 * (1.0 + sign * y);
}

function calculateTTest(sample1: number[], sample2: number[]): number {
  const n1 = sample1.length;
  const n2 = sample2.length;

  if (n1 < 2 || n2 < 2) return 1;

  const mean1 = calculateMean(sample1);
  const mean2 = calculateMean(sample2);
  const std1 = calculateStdDev(sample1, mean1);
  const std2 = calculateStdDev(sample2, mean2);

  const se1 = (std1 * std1) / n1;
  const se2 = (std2 * std2) / n2;
  const se = Math.sqrt(se1 + se2);

  if (se === 0) return 1;

  const t = (mean2 - mean1) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));

  return pValue;
}

// ============================================================================
// HGM Optimizer Class
// ============================================================================

class HGMOptimizer {
  private experiments: Map<string, ExperimentConfig> = new Map();
  private results: Map<string, ExperimentResult> = new Map();
  private observations: Map<string, ObservationData> = new Map();
  private appliedChanges: AppliedChange[] = [];
  private thresholds: HGMThresholds;

  constructor(thresholds?: Partial<HGMThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    console.log('[HGM] Optimizer initialized with thresholds:', this.thresholds);
  }

  proposeExperiment(
    parameter: string,
    baselineValue: number,
    proposedValue: number,
    hypothesis: string
  ): ExperimentConfig {
    if (!this.isWithinBounds(baselineValue, proposedValue)) {
      throw new Error(
        `[HGM] Proposed change exceeds ±${this.thresholds.maxChangePercent * 100}% bounds`
      );
    }

    const id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const experiment: ExperimentConfig = {
      id,
      parameter,
      baselineValue,
      proposedValue,
      hypothesis,
      status: 'active',
      createdAt: new Date(),
    };

    this.experiments.set(id, experiment);
    this.observations.set(id, { baseline: [], treatment: [] });

    console.log(`[HGM] Experiment proposed: ${id}`, {
      parameter,
      baseline: baselineValue,
      proposed: proposedValue,
      changePercent:
        (((proposedValue - baselineValue) / baselineValue) * 100).toFixed(2) +
        '%',
    });

    return experiment;
  }

  recordObservation(
    experimentId: string,
    isBaseline: boolean,
    value: number
  ): void {
    const obs = this.observations.get(experimentId);
    if (!obs) {
      throw new Error(`[HGM] Unknown experiment: ${experimentId}`);
    }

    if (isBaseline) {
      obs.baseline.push(value);
    } else {
      obs.treatment.push(value);
    }

    const totalObs = obs.baseline.length + obs.treatment.length;
    if (totalObs % 10 === 0) {
      console.log(
        `[HGM] Experiment ${experimentId}: ${obs.baseline.length} baseline, ${obs.treatment.length} treatment observations`
      );
    }
  }

  evaluateExperiment(experimentId: string): ExperimentResult {
    const experiment = this.experiments.get(experimentId);
    const obs = this.observations.get(experimentId);

    if (!experiment || !obs) {
      throw new Error(`[HGM] Unknown experiment: ${experimentId}`);
    }

    const { baseline, treatment } = obs;
    const sampleSize = Math.min(baseline.length, treatment.length);

    if (sampleSize < this.thresholds.minSampleSize) {
      const result: ExperimentResult = {
        experimentId,
        sampleSize,
        baselineMean: calculateMean(baseline),
        baselineStd: calculateStdDev(baseline, calculateMean(baseline)),
        treatmentMean: calculateMean(treatment),
        treatmentStd: calculateStdDev(treatment, calculateMean(treatment)),
        pValue: 1,
        cohensD: 0,
        isSignificant: false,
        meetsEffectSize: false,
        recommendedAction: 'continue',
        evaluatedAt: new Date(),
      };
      this.results.set(experimentId, result);
      console.log(
        `[HGM] Experiment ${experimentId}: Need more data (${sampleSize}/${this.thresholds.minSampleSize})`
      );
      return result;
    }

    const baselineMean = calculateMean(baseline);
    const baselineStd = calculateStdDev(baseline, baselineMean);
    const treatmentMean = calculateMean(treatment);
    const treatmentStd = calculateStdDev(treatment, treatmentMean);

    const pValue = calculateTTest(baseline, treatment);
    const cohensD = calculateCohensD(
      baselineMean,
      baselineStd,
      baseline.length,
      treatmentMean,
      treatmentStd,
      treatment.length
    );

    const isSignificant = pValue < this.thresholds.minPValue;
    const meetsEffectSize = cohensD >= this.thresholds.minEffectSize;

    let recommendedAction: 'apply' | 'reject' | 'continue';
    if (isSignificant && meetsEffectSize && treatmentMean > baselineMean) {
      recommendedAction = 'apply';
    } else if (sampleSize >= this.thresholds.minSampleSize * 3) {
      recommendedAction = 'reject';
    } else if (!isSignificant || !meetsEffectSize) {
      recommendedAction = 'continue';
    } else {
      recommendedAction = 'reject';
    }

    const result: ExperimentResult = {
      experimentId,
      sampleSize,
      baselineMean,
      baselineStd,
      treatmentMean,
      treatmentStd,
      pValue,
      cohensD,
      isSignificant,
      meetsEffectSize,
      recommendedAction,
      evaluatedAt: new Date(),
    };

    this.results.set(experimentId, result);
    experiment.status = 'evaluated';

    console.log(`[HGM] Experiment ${experimentId} evaluated:`, {
      pValue: pValue.toFixed(4),
      cohensD: cohensD.toFixed(3),
      isSignificant,
      meetsEffectSize,
      recommendation: recommendedAction,
    });

    return result;
  }

  private isWithinBounds(
    baselineValue: number,
    proposedValue: number
  ): boolean {
    const changePercent = Math.abs(
      (proposedValue - baselineValue) / baselineValue
    );
    return changePercent <= this.thresholds.maxChangePercent;
  }

  applyChange(experimentId: string): { success: boolean; reason?: string } {
    const experiment = this.experiments.get(experimentId);
    const result = this.results.get(experimentId);

    if (!experiment || !result) {
      return { success: false, reason: 'Experiment not found or not evaluated' };
    }

    if (result.recommendedAction !== 'apply') {
      return {
        success: false,
        reason: `Recommended action is ${result.recommendedAction}`,
      };
    }

    if (!result.isSignificant) {
      return {
        success: false,
        reason: `p-value ${result.pValue.toFixed(4)} >= ${this.thresholds.minPValue}`,
      };
    }

    if (!result.meetsEffectSize) {
      return {
        success: false,
        reason: `Cohen's d ${result.cohensD.toFixed(3)} < ${this.thresholds.minEffectSize}`,
      };
    }

    this.appliedChanges.push({
      experimentId,
      parameter: experiment.parameter,
      oldValue: experiment.baselineValue,
      newValue: experiment.proposedValue,
      timestamp: new Date(),
    });

    experiment.status = 'applied';

    console.log(`[HGM] Change APPLIED for ${experimentId}:`, {
      parameter: experiment.parameter,
      oldValue: experiment.baselineValue,
      newValue: experiment.proposedValue,
    });

    return { success: true };
  }

  rollbackLastChange(): {
    success: boolean;
    parameter?: string;
    restoredValue?: number;
  } {
    if (this.appliedChanges.length === 0) {
      return { success: false };
    }

    const lastChange = this.appliedChanges.pop()!;
    const experiment = this.experiments.get(lastChange.experimentId);

    if (experiment) {
      experiment.status = 'rejected';
    }

    console.log(`[HGM] Change ROLLED BACK:`, {
      parameter: lastChange.parameter,
      restoredValue: lastChange.oldValue,
    });

    return {
      success: true,
      parameter: lastChange.parameter,
      restoredValue: lastChange.oldValue,
    };
  }

  getExperimentHistory(): ExperimentResult[] {
    return Array.from(this.results.values());
  }

  getActiveExperiments(): ExperimentConfig[] {
    return Array.from(this.experiments.values()).filter(
      (e) => e.status === 'active'
    );
  }

  getOptimizationRecommendations(): Array<{
    parameter: string;
    currentValue: number;
    recommendedValue: number;
    confidence: number;
    experimentId: string;
  }> {
    const recommendations: Array<{
      parameter: string;
      currentValue: number;
      recommendedValue: number;
      confidence: number;
      experimentId: string;
    }> = [];

    for (const [expId, result] of this.results) {
      if (result.recommendedAction === 'apply') {
        const experiment = this.experiments.get(expId);
        if (experiment && experiment.status === 'evaluated') {
          recommendations.push({
            parameter: experiment.parameter,
            currentValue: experiment.baselineValue,
            recommendedValue: experiment.proposedValue,
            confidence: 1 - result.pValue,
            experimentId: expId,
          });
        }
      }
    }

    return recommendations;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let optimizerInstance: HGMOptimizer | null = null;

export function getHGMOptimizer(
  thresholds?: Partial<HGMThresholds>
): HGMOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new HGMOptimizer(thresholds);
  }
  return optimizerInstance;
}

// ============================================================================
// Convenience Exports
// ============================================================================

export function proposeParameterChange(
  parameter: string,
  baseline: number,
  proposed: number,
  hypothesis: string
): ExperimentConfig {
  return getHGMOptimizer().proposeExperiment(
    parameter,
    baseline,
    proposed,
    hypothesis
  );
}

export function recordExperimentObservation(
  experimentId: string,
  isBaseline: boolean,
  value: number
): void {
  getHGMOptimizer().recordObservation(experimentId, isBaseline, value);
}

export function evaluateChange(
  experimentId: string,
  baselineData: number[],
  treatmentData: number[]
): ExperimentResult {
  const optimizer = getHGMOptimizer();

  for (const value of baselineData) {
    optimizer.recordObservation(experimentId, true, value);
  }
  for (const value of treatmentData) {
    optimizer.recordObservation(experimentId, false, value);
  }

  return optimizer.evaluateExperiment(experimentId);
}

export function isChangeSafe(result: ExperimentResult): boolean {
  return (
    result.isSignificant &&
    result.meetsEffectSize &&
    result.recommendedAction === 'apply'
  );
}

export function getOptimizationStatus(): {
  activeExperiments: number;
  appliedChanges: number;
  pendingRecommendations: number;
} {
  const optimizer = getHGMOptimizer();
  return {
    activeExperiments: optimizer.getActiveExperiments().length,
    appliedChanges: optimizer.getExperimentHistory().filter((r) => {
      const exp = (optimizer as any).experiments.get(r.experimentId);
      return exp?.status === 'applied';
    }).length,
    pendingRecommendations: optimizer.getOptimizationRecommendations().length,
  };
}

export { HGMOptimizer, DEFAULT_THRESHOLDS };
