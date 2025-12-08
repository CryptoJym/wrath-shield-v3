/**
 * HYRO FORGE: Metaproductivity & Experimentation System
 * Learning efficiency metrics and A/B testing framework
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName } from './forge-types';

// ============================================================================
// TYPES
// ============================================================================

export interface MetaproductivityMetrics {
  student_id: string;
  acquisition_rate: number;
  transfer_efficiency: number;
  retention_rate: number;
  strategy_effectiveness: number;
  overall_productivity: number;
  measured_at: number;
}

export interface LearningEfficiencyData {
  id: string;
  student_id: string;
  stat_name: StatName;
  time_invested_minutes: number;
  skill_gain: number;
  context: string;
  strategy_used: string | null;
  created_at: number;
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type VariantType = 'control' | 'treatment';

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  hypothesis: string;
  metric_name: string;
  control_description: string;
  treatment_description: string;
  status: ExperimentStatus;
  start_date: string | null;
  end_date: string | null;
  min_sample_size: number;
  created_at: number;
}

export interface ExperimentAssignment {
  id: string;
  experiment_id: string;
  student_id: string;
  variant: VariantType;
  assigned_at: number;
}

export interface ExperimentOutcome {
  id: string;
  experiment_id: string;
  student_id: string;
  variant: VariantType;
  metric_value: number;
  recorded_at: number;
}

export interface ExperimentAnalysis {
  experiment_id: string;
  experiment_name: string;
  status: ExperimentStatus;
  control_count: number;
  treatment_count: number;
  control_mean: number;
  treatment_mean: number;
  control_stddev: number;
  treatment_stddev: number;
  effect_size: number;
  percent_improvement: number;
  t_statistic: number;
  p_value: number;
  is_significant: boolean;
  confidence_level: number;
  recommendation: string;
}

export interface GrowthOptimizationMetrics {
  current_productivity: number;
  optimal_strategies: StrategyRecommendation[];
  inefficient_patterns: string[];
  growth_potential: number;
}

export interface StrategyRecommendation {
  strategy: string;
  expected_improvement: number;
  confidence: number;
  evidence_count: number;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export function initializeMetaproductivityTables(): void {
  const db = getDatabase();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_learning_efficiency (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL DEFAULT 'hyro',
      stat_name TEXT NOT NULL,
      time_invested_minutes INTEGER NOT NULL,
      skill_gain REAL NOT NULL,
      context TEXT NOT NULL,
      strategy_used TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_efficiency_student ON hyro_learning_efficiency(student_id);

    CREATE TABLE IF NOT EXISTS hyro_experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      hypothesis TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      control_description TEXT NOT NULL,
      treatment_description TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      start_date TEXT,
      end_date TEXT,
      min_sample_size INTEGER DEFAULT 30,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_experiments_status ON hyro_experiments(status);

    CREATE TABLE IF NOT EXISTS hyro_experiment_assignments (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      variant TEXT NOT NULL,
      assigned_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (experiment_id) REFERENCES hyro_experiments(id),
      UNIQUE(experiment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS hyro_experiment_outcomes (
      id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      variant TEXT NOT NULL,
      metric_value REAL NOT NULL,
      recorded_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (experiment_id) REFERENCES hyro_experiments(id)
    );
  `);
}

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

export function tTest(group1: number[], group2: number[], alpha: number = 0.05): { t_statistic: number; p_value: number; is_significant: boolean } {
  const n1 = group1.length, n2 = group2.length;
  if (n1 < 2 || n2 < 2) return { t_statistic: 0, p_value: 1, is_significant: false };
  
  const mean1 = mean(group1), mean2 = mean(group2);
  const var1 = Math.pow(stdDev(group1), 2), var2 = Math.pow(stdDev(group2), 2);
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return { t_statistic: 0, p_value: 1, is_significant: false };
  
  const t = (mean1 - mean2) / se;
  const absT = Math.abs(t);
  let pValue: number;
  if (absT > 3.5) pValue = 0.001;
  else if (absT > 2.576) pValue = 0.01;
  else if (absT > 1.96) pValue = 0.05;
  else if (absT > 1.645) pValue = 0.10;
  else pValue = 0.5;
  
  return { t_statistic: t, p_value: pValue, is_significant: pValue < alpha };
}

export function cohensD(group1: number[], group2: number[]): number {
  const mean1 = mean(group1), mean2 = mean(group2);
  const sd1 = stdDev(group1), sd2 = stdDev(group2);
  const n1 = group1.length, n2 = group2.length;
  const pooledSD = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
  if (pooledSD === 0) return 0;
  return (mean2 - mean1) / pooledSD;
}

// ============================================================================
// METAPRODUCTIVITY METRICS
// ============================================================================

export function recordLearningEfficiency(params: {
  student_id?: string;
  stat_name: StatName;
  time_invested_minutes: number;
  skill_gain: number;
  context: string;
  strategy_used?: string;
}): LearningEfficiencyData {
  const db = getDatabase();
  const id = randomUUID();
  const studentId = params.student_id || 'hyro';
  const now = Math.floor(Date.now() / 1000);
  
  db.prepare(`INSERT INTO hyro_learning_efficiency (id, student_id, stat_name, time_invested_minutes, skill_gain, context, strategy_used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, studentId, params.stat_name, params.time_invested_minutes, params.skill_gain, params.context, params.strategy_used || null, now);
  
  return { id, student_id: studentId, stat_name: params.stat_name, time_invested_minutes: params.time_invested_minutes, skill_gain: params.skill_gain, context: params.context, strategy_used: params.strategy_used || null, created_at: now };
}

export function calculateMetaproductivity(studentId: string = 'hyro'): MetaproductivityMetrics {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
  
  const recentData = db.prepare(`SELECT * FROM hyro_learning_efficiency WHERE student_id = ? AND created_at >= ? ORDER BY created_at DESC`).all(studentId, thirtyDaysAgo) as any[];
  
  if (recentData.length === 0) {
    return { student_id: studentId, acquisition_rate: 0, transfer_efficiency: 50, retention_rate: 50, strategy_effectiveness: 50, overall_productivity: 50, measured_at: now };
  }
  
  const totalTimeHours = recentData.reduce((sum, d) => sum + d.time_invested_minutes, 0) / 60;
  const totalSkillGain = recentData.reduce((sum, d) => sum + d.skill_gain, 0);
  const acquisitionRate = totalTimeHours > 0 ? totalSkillGain / totalTimeHours : 0;
  
  const contextGroups = new Map<string, number[]>();
  for (const d of recentData) {
    const gains = contextGroups.get(d.context) || [];
    gains.push(d.skill_gain);
    contextGroups.set(d.context, gains);
  }
  const contextMeans = Array.from(contextGroups.values()).map(gains => mean(gains));
  const transferEfficiency = contextMeans.length > 1 ? Math.min(100, (1 - stdDev(contextMeans) / mean(contextMeans)) * 100) : 50;
  
  const strategyGroups = new Map<string, number[]>();
  for (const d of recentData) {
    if (d.strategy_used) {
      const efficiencies = strategyGroups.get(d.strategy_used) || [];
      const efficiency = d.time_invested_minutes > 0 ? d.skill_gain / d.time_invested_minutes : 0;
      efficiencies.push(efficiency);
      strategyGroups.set(d.strategy_used, efficiencies);
    }
  }
  const strategyMeans = Array.from(strategyGroups.values()).map(effs => mean(effs));
  const bestStrategy = Math.max(...strategyMeans, 0);
  const avgStrategy = mean(strategyMeans);
  const strategyEffectiveness = avgStrategy > 0 ? Math.min(100, (avgStrategy / bestStrategy) * 100) : 50;
  
  const recentGains = recentData.slice(0, Math.ceil(recentData.length / 3));
  const olderGains = recentData.slice(Math.ceil(recentData.length / 3));
  const recentMean = mean(recentGains.map(d => d.skill_gain));
  const olderMean = mean(olderGains.map(d => d.skill_gain));
  const retentionRate = olderMean > 0 ? Math.min(100, (recentMean / olderMean) * 50 + 50) : 50;
  
  const overallProductivity = (acquisitionRate * 0.3 + transferEfficiency * 0.25 + retentionRate * 0.25 + strategyEffectiveness * 0.2);
  
  return {
    student_id: studentId,
    acquisition_rate: Math.round(acquisitionRate * 100) / 100,
    transfer_efficiency: Math.round(transferEfficiency * 10) / 10,
    retention_rate: Math.round(retentionRate * 10) / 10,
    strategy_effectiveness: Math.round(strategyEffectiveness * 10) / 10,
    overall_productivity: Math.round(overallProductivity * 10) / 10,
    measured_at: now,
  };
}

// ============================================================================
// EXPERIMENTATION FRAMEWORK
// ============================================================================

export function createExperiment(params: { name: string; description?: string; hypothesis: string; metric_name: string; control_description: string; treatment_description: string; min_sample_size?: number }): Experiment {
  const db = getDatabase();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  
  db.prepare(`INSERT INTO hyro_experiments (id, name, description, hypothesis, metric_name, control_description, treatment_description, min_sample_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, params.name, params.description || null, params.hypothesis, params.metric_name, params.control_description, params.treatment_description, params.min_sample_size || 30, now);
  
  return { id, name: params.name, description: params.description || null, hypothesis: params.hypothesis, metric_name: params.metric_name, control_description: params.control_description, treatment_description: params.treatment_description, status: 'draft', start_date: null, end_date: null, min_sample_size: params.min_sample_size || 30, created_at: now };
}

export function startExperiment(experimentId: string): Experiment | null {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`UPDATE hyro_experiments SET status = 'running', start_date = ? WHERE id = ?`).run(today, experimentId);
  return getExperiment(experimentId);
}

export function getExperiment(experimentId: string): Experiment | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM hyro_experiments WHERE id = ?`).get(experimentId) as any;
  if (!row) return null;
  return { id: row.id, name: row.name, description: row.description, hypothesis: row.hypothesis, metric_name: row.metric_name, control_description: row.control_description, treatment_description: row.treatment_description, status: row.status, start_date: row.start_date, end_date: row.end_date, min_sample_size: row.min_sample_size, created_at: row.created_at };
}

export function listExperiments(status?: ExperimentStatus): Experiment[] {
  const db = getDatabase();
  let query = 'SELECT * FROM hyro_experiments';
  const params: any[] = [];
  if (status) { query += ' WHERE status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(row => ({ id: row.id, name: row.name, description: row.description, hypothesis: row.hypothesis, metric_name: row.metric_name, control_description: row.control_description, treatment_description: row.treatment_description, status: row.status, start_date: row.start_date, end_date: row.end_date, min_sample_size: row.min_sample_size, created_at: row.created_at }));
}

export function assignStudentToVariant(experimentId: string, studentId: string = 'hyro', variant?: VariantType): ExperimentAssignment {
  const db = getDatabase();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const assignedVariant = variant || (Math.random() < 0.5 ? 'control' : 'treatment');
  db.prepare(`INSERT OR REPLACE INTO hyro_experiment_assignments (id, experiment_id, student_id, variant, assigned_at) VALUES (?, ?, ?, ?, ?)`).run(id, experimentId, studentId, assignedVariant, now);
  return { id, experiment_id: experimentId, student_id: studentId, variant: assignedVariant, assigned_at: now };
}

export function recordExperimentOutcome(params: { experiment_id: string; student_id?: string; metric_value: number }): ExperimentOutcome {
  const db = getDatabase();
  const id = randomUUID();
  const studentId = params.student_id || 'hyro';
  const now = Math.floor(Date.now() / 1000);
  const assignment = db.prepare(`SELECT variant FROM hyro_experiment_assignments WHERE experiment_id = ? AND student_id = ?`).get(params.experiment_id, studentId) as { variant: VariantType } | undefined;
  if (!assignment) throw new Error(`Student ${studentId} not assigned to experiment ${params.experiment_id}`);
  db.prepare(`INSERT INTO hyro_experiment_outcomes (id, experiment_id, student_id, variant, metric_value, recorded_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, params.experiment_id, studentId, assignment.variant, params.metric_value, now);
  return { id, experiment_id: params.experiment_id, student_id: studentId, variant: assignment.variant, metric_value: params.metric_value, recorded_at: now };
}

export function analyzeExperiment(experimentId: string): ExperimentAnalysis {
  const db = getDatabase();
  const experiment = getExperiment(experimentId);
  if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);
  
  const controlOutcomes = db.prepare(`SELECT metric_value FROM hyro_experiment_outcomes WHERE experiment_id = ? AND variant = 'control'`).all(experimentId) as { metric_value: number }[];
  const treatmentOutcomes = db.prepare(`SELECT metric_value FROM hyro_experiment_outcomes WHERE experiment_id = ? AND variant = 'treatment'`).all(experimentId) as { metric_value: number }[];
  
  const controlValues = controlOutcomes.map(o => o.metric_value);
  const treatmentValues = treatmentOutcomes.map(o => o.metric_value);
  
  const controlMean = mean(controlValues), treatmentMean = mean(treatmentValues);
  const controlStdDev = stdDev(controlValues), treatmentStdDev = stdDev(treatmentValues);
  const effectSize = cohensD(controlValues, treatmentValues);
  const percentImprovement = controlMean !== 0 ? ((treatmentMean - controlMean) / controlMean) * 100 : 0;
  const { t_statistic, p_value, is_significant } = tTest(controlValues, treatmentValues);
  
  let confidenceLevel = 0;
  if (p_value < 0.001) confidenceLevel = 99.9;
  else if (p_value < 0.01) confidenceLevel = 99;
  else if (p_value < 0.05) confidenceLevel = 95;
  else if (p_value < 0.10) confidenceLevel = 90;
  else confidenceLevel = Math.round((1 - p_value) * 100);
  
  let recommendation: string;
  if (controlValues.length < experiment.min_sample_size || treatmentValues.length < experiment.min_sample_size) {
    recommendation = `Insufficient sample size. Need at least ${experiment.min_sample_size} per group.`;
  } else if (is_significant && treatmentMean > controlMean) {
    recommendation = `ADOPT: Treatment shows significant improvement (${percentImprovement.toFixed(1)}% better)`;
  } else if (is_significant && treatmentMean < controlMean) {
    recommendation = `REJECT: Treatment performs significantly worse`;
  } else {
    recommendation = `INCONCLUSIVE: No significant difference detected`;
  }
  
  return { experiment_id: experimentId, experiment_name: experiment.name, status: experiment.status, control_count: controlValues.length, treatment_count: treatmentValues.length, control_mean: Math.round(controlMean * 100) / 100, treatment_mean: Math.round(treatmentMean * 100) / 100, control_stddev: Math.round(controlStdDev * 100) / 100, treatment_stddev: Math.round(treatmentStdDev * 100) / 100, effect_size: Math.round(effectSize * 100) / 100, percent_improvement: Math.round(percentImprovement * 10) / 10, t_statistic: Math.round(t_statistic * 1000) / 1000, p_value: Math.round(p_value * 1000) / 1000, is_significant, confidence_level: confidenceLevel, recommendation };
}

export function completeExperiment(experimentId: string): ExperimentAnalysis {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`UPDATE hyro_experiments SET status = 'completed', end_date = ? WHERE id = ?`).run(today, experimentId);
  return analyzeExperiment(experimentId);
}

// ============================================================================
// GROWTH OPTIMIZATION
// ============================================================================

export function getGrowthOptimizationMetrics(studentId: string = 'hyro'): GrowthOptimizationMetrics {
  const db = getDatabase();
  const productivity = calculateMetaproductivity(studentId);
  
  const strategyData = db.prepare(`SELECT strategy_used, AVG(skill_gain / NULLIF(time_invested_minutes, 0)) as efficiency, COUNT(*) as count FROM hyro_learning_efficiency WHERE student_id = ? AND strategy_used IS NOT NULL GROUP BY strategy_used ORDER BY efficiency DESC`).all(studentId) as any[];
  
  const optimalStrategies: StrategyRecommendation[] = strategyData.filter(s => s.count >= 3).slice(0, 5).map(s => ({ strategy: s.strategy_used, expected_improvement: Math.round(s.efficiency * 60 * 100) / 100, confidence: Math.min(0.95, 0.5 + s.count * 0.05), evidence_count: s.count }));
  
  const inefficientPatterns: string[] = [];
  if (productivity.acquisition_rate < 1) inefficientPatterns.push('Low skill acquisition rate - consider more focused practice sessions');
  if (productivity.transfer_efficiency < 60) inefficientPatterns.push('Poor knowledge transfer - try applying concepts in varied contexts');
  if (productivity.retention_rate < 60) inefficientPatterns.push('Low retention - implement spaced repetition');
  if (productivity.strategy_effectiveness < 60) inefficientPatterns.push('Inconsistent strategy use - identify and stick with effective methods');
  
  const currentMax = Math.max(productivity.acquisition_rate, productivity.transfer_efficiency, productivity.retention_rate, productivity.strategy_effectiveness);
  const growthPotential = Math.round((100 - productivity.overall_productivity) * (currentMax / 100));
  
  return { current_productivity: productivity.overall_productivity, optimal_strategies: optimalStrategies, inefficient_patterns: inefficientPatterns, growth_potential: growthPotential };
}
