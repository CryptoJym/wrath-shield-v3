/**
 * HYRO FORGE: Metacognition Scoring System
 * Tracks and scores metacognitive skills across 4 dimensions
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName } from './forge-types';

// ============================================================================
// TYPES
// ============================================================================

export type MetacognitiveDimension = 'planning' | 'monitoring' | 'evaluation' | 'regulation';

export interface MetacognitiveScore {
  id: string;
  student_id: string;
  dimension: MetacognitiveDimension;
  score: number;
  evidence_count: number;
  assessment_date: string;
  notes: string | null;
  created_at: number;
}

export interface MetacognitiveProfile {
  student_id: string;
  planning_score: number;
  monitoring_score: number;
  evaluation_score: number;
  regulation_score: number;
  overall_score: number;
  strongest_dimension: MetacognitiveDimension;
  weakest_dimension: MetacognitiveDimension;
  last_assessed: number;
}

export interface CalibrationData {
  id: string;
  student_id: string;
  task_id: string;
  task_type: string;
  stat_name: StatName | null;
  predicted_score: number;
  actual_score: number | null;
  confidence_level: number;
  calibration_error: number | null;
  created_at: number;
  resolved_at: number | null;
}

export interface CalibrationAccuracy {
  student_id: string;
  total_predictions: number;
  resolved_predictions: number;
  mean_absolute_error: number;
  overconfidence_rate: number;
  underconfidence_rate: number;
  well_calibrated_rate: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface MetacognitiveGrowth {
  dimension: MetacognitiveDimension;
  start_score: number;
  current_score: number;
  change: number;
  percent_change: number;
  period_days: number;
}

export interface DimensionIndicators {
  planning: string[];
  monitoring: string[];
  evaluation: string[];
  regulation: string[];
}

export const METACOGNITIVE_INDICATORS: DimensionIndicators = {
  planning: [
    'Sets clear learning goals',
    'Estimates time needed for tasks',
    'Identifies resources needed',
    'Creates study schedules',
    'Prioritizes tasks effectively',
  ],
  monitoring: [
    'Tracks progress during learning',
    'Recognizes confusion or gaps',
    'Adjusts pace based on difficulty',
    'Uses self-testing strategies',
    'Maintains focus awareness',
  ],
  evaluation: [
    'Assesses understanding accurately',
    'Identifies successful strategies',
    'Recognizes areas for improvement',
    'Reflects on learning process',
    'Compares outcomes to goals',
  ],
  regulation: [
    'Adapts strategies when stuck',
    'Seeks help appropriately',
    'Manages time effectively',
    'Controls learning environment',
    'Maintains motivation',
  ],
};

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export function initializeMetacognitionTables(): void {
  const db = getDatabase();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_metacognitive_scores (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL DEFAULT 'hyro',
      dimension TEXT NOT NULL,
      score REAL NOT NULL,
      evidence_count INTEGER DEFAULT 0,
      assessment_date TEXT NOT NULL,
      notes TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE INDEX IF NOT EXISTS idx_metacog_scores_student ON hyro_metacognitive_scores(student_id);
    CREATE INDEX IF NOT EXISTS idx_metacog_scores_dimension ON hyro_metacognitive_scores(dimension);

    CREATE TABLE IF NOT EXISTS hyro_calibration_data (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL DEFAULT 'hyro',
      task_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      stat_name TEXT,
      predicted_score REAL NOT NULL,
      actual_score REAL,
      confidence_level INTEGER NOT NULL,
      calibration_error REAL,
      created_at INTEGER DEFAULT (unixepoch()),
      resolved_at INTEGER
    );
    
    CREATE INDEX IF NOT EXISTS idx_calibration_student ON hyro_calibration_data(student_id);
    CREATE INDEX IF NOT EXISTS idx_calibration_task ON hyro_calibration_data(task_id);
  `);
}

// ============================================================================
// METACOGNITIVE SCORING
// ============================================================================

export function scoreMetacognitiveSkills(params: {
  student_id?: string;
  planning_evidence: number[];
  monitoring_evidence: number[];
  evaluation_evidence: number[];
  regulation_evidence: number[];
  notes?: string;
}): MetacognitiveProfile {
  const db = getDatabase();
  const studentId = params.student_id || 'hyro';
  const now = Math.floor(Date.now() / 1000);
  const today = new Date().toISOString().split('T')[0];
  
  const calculateScore = (evidence: number[]): number => {
    if (evidence.length === 0) return 0;
    const sum = evidence.reduce((a, b) => a + b, 0);
    return Math.min(100, Math.max(0, sum / evidence.length));
  };
  
  const scores: Record<MetacognitiveDimension, number> = {
    planning: calculateScore(params.planning_evidence),
    monitoring: calculateScore(params.monitoring_evidence),
    evaluation: calculateScore(params.evaluation_evidence),
    regulation: calculateScore(params.regulation_evidence),
  };
  
  const insertScore = db.prepare(`
    INSERT INTO hyro_metacognitive_scores
    (id, student_id, dimension, score, evidence_count, assessment_date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const dimensions: MetacognitiveDimension[] = ['planning', 'monitoring', 'evaluation', 'regulation'];
  const evidenceCounts: Record<MetacognitiveDimension, number> = {
    planning: params.planning_evidence.length,
    monitoring: params.monitoring_evidence.length,
    evaluation: params.evaluation_evidence.length,
    regulation: params.regulation_evidence.length,
  };
  
  for (const dim of dimensions) {
    insertScore.run(randomUUID(), studentId, dim, scores[dim], evidenceCounts[dim], today, params.notes || null, now);
  }
  
  const overallScore = (scores.planning + scores.monitoring + scores.evaluation + scores.regulation) / 4;
  
  let strongest: MetacognitiveDimension = 'planning';
  let weakest: MetacognitiveDimension = 'planning';
  let maxScore = scores.planning;
  let minScore = scores.planning;
  
  for (const dim of dimensions) {
    if (scores[dim] > maxScore) { maxScore = scores[dim]; strongest = dim; }
    if (scores[dim] < minScore) { minScore = scores[dim]; weakest = dim; }
  }
  
  return {
    student_id: studentId,
    planning_score: scores.planning,
    monitoring_score: scores.monitoring,
    evaluation_score: scores.evaluation,
    regulation_score: scores.regulation,
    overall_score: overallScore,
    strongest_dimension: strongest,
    weakest_dimension: weakest,
    last_assessed: now,
  };
}

export function getMetacognitiveProfile(studentId: string = 'hyro'): MetacognitiveProfile | null {
  const db = getDatabase();
  const dimensions: MetacognitiveDimension[] = ['planning', 'monitoring', 'evaluation', 'regulation'];
  const scores: Record<string, number> = {};
  let lastAssessed = 0;
  
  for (const dim of dimensions) {
    const row = db.prepare(`SELECT score, created_at FROM hyro_metacognitive_scores WHERE student_id = ? AND dimension = ? ORDER BY created_at DESC LIMIT 1`).get(studentId, dim) as { score: number; created_at: number } | undefined;
    scores[dim] = row?.score || 0;
    if (row && row.created_at > lastAssessed) lastAssessed = row.created_at;
  }
  
  if (lastAssessed === 0) return null;
  
  const overallScore = (scores.planning + scores.monitoring + scores.evaluation + scores.regulation) / 4;
  let strongest: MetacognitiveDimension = 'planning';
  let weakest: MetacognitiveDimension = 'planning';
  let maxScore = scores.planning;
  let minScore = scores.planning;
  
  for (const dim of dimensions) {
    if (scores[dim] > maxScore) { maxScore = scores[dim]; strongest = dim; }
    if (scores[dim] < minScore) { minScore = scores[dim]; weakest = dim; }
  }
  
  return {
    student_id: studentId,
    planning_score: scores.planning,
    monitoring_score: scores.monitoring,
    evaluation_score: scores.evaluation,
    regulation_score: scores.regulation,
    overall_score: overallScore,
    strongest_dimension: strongest,
    weakest_dimension: weakest,
    last_assessed: lastAssessed,
  };
}

// ============================================================================
// CALIBRATION TRACKING
// ============================================================================

export function recordCalibrationData(params: {
  student_id?: string;
  task_id: string;
  task_type: string;
  stat_name?: StatName;
  predicted_score: number;
  confidence_level: number;
}): CalibrationData {
  const db = getDatabase();
  const id = randomUUID();
  const studentId = params.student_id || 'hyro';
  const now = Math.floor(Date.now() / 1000);
  
  db.prepare(`INSERT INTO hyro_calibration_data (id, student_id, task_id, task_type, stat_name, predicted_score, confidence_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, studentId, params.task_id, params.task_type, params.stat_name || null, params.predicted_score, params.confidence_level, now);
  
  return {
    id,
    student_id: studentId,
    task_id: params.task_id,
    task_type: params.task_type,
    stat_name: params.stat_name || null,
    predicted_score: params.predicted_score,
    actual_score: null,
    confidence_level: params.confidence_level,
    calibration_error: null,
    created_at: now,
    resolved_at: null,
  };
}

export function resolveCalibration(calibrationId: string, actualScore: number): CalibrationData | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(`SELECT * FROM hyro_calibration_data WHERE id = ?`).get(calibrationId) as any;
  if (!row) return null;
  
  const calibrationError = actualScore - row.predicted_score;
  db.prepare(`UPDATE hyro_calibration_data SET actual_score = ?, calibration_error = ?, resolved_at = ? WHERE id = ?`).run(actualScore, calibrationError, now, calibrationId);
  
  return {
    id: row.id,
    student_id: row.student_id,
    task_id: row.task_id,
    task_type: row.task_type,
    stat_name: row.stat_name,
    predicted_score: row.predicted_score,
    actual_score: actualScore,
    confidence_level: row.confidence_level,
    calibration_error: calibrationError,
    created_at: row.created_at,
    resolved_at: now,
  };
}

export function getCalibrationAccuracy(studentId: string = 'hyro'): CalibrationAccuracy {
  const db = getDatabase();
  const totalCount = db.prepare(`SELECT COUNT(*) as count FROM hyro_calibration_data WHERE student_id = ?`).get(studentId) as { count: number };
  const resolved = db.prepare(`SELECT predicted_score, actual_score, calibration_error, confidence_level, created_at FROM hyro_calibration_data WHERE student_id = ? AND actual_score IS NOT NULL ORDER BY created_at`).all(studentId) as any[];
  
  if (resolved.length === 0) {
    return { student_id: studentId, total_predictions: totalCount.count, resolved_predictions: 0, mean_absolute_error: 0, overconfidence_rate: 0, underconfidence_rate: 0, well_calibrated_rate: 0, trend: 'stable' };
  }
  
  let sumAbsError = 0, overconfident = 0, underconfident = 0, wellCalibrated = 0;
  
  for (const r of resolved) {
    const absError = Math.abs(r.calibration_error);
    sumAbsError += absError;
    const threshold = 10 + (5 - r.confidence_level) * 5;
    if (r.calibration_error < -threshold) overconfident++;
    else if (r.calibration_error > threshold) underconfident++;
    else wellCalibrated++;
  }
  
  const mae = sumAbsError / resolved.length;
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  
  if (resolved.length >= 6) {
    const midpoint = Math.floor(resolved.length / 2);
    const firstHalfMAE = resolved.slice(0, midpoint).reduce((sum, r) => sum + Math.abs(r.calibration_error), 0) / midpoint;
    const secondHalfMAE = resolved.slice(midpoint).reduce((sum, r) => sum + Math.abs(r.calibration_error), 0) / (resolved.length - midpoint);
    if (secondHalfMAE < firstHalfMAE * 0.9) trend = 'improving';
    else if (secondHalfMAE > firstHalfMAE * 1.1) trend = 'declining';
  }
  
  return {
    student_id: studentId,
    total_predictions: totalCount.count,
    resolved_predictions: resolved.length,
    mean_absolute_error: mae,
    overconfidence_rate: overconfident / resolved.length,
    underconfidence_rate: underconfident / resolved.length,
    well_calibrated_rate: wellCalibrated / resolved.length,
    trend,
  };
}

// ============================================================================
// GROWTH TRACKING
// ============================================================================

export function getMetacognitiveGrowth(studentId: string = 'hyro', periodDays: number = 30): MetacognitiveGrowth[] {
  const db = getDatabase();
  const cutoffTime = Math.floor(Date.now() / 1000) - (periodDays * 24 * 60 * 60);
  const dimensions: MetacognitiveDimension[] = ['planning', 'monitoring', 'evaluation', 'regulation'];
  const growth: MetacognitiveGrowth[] = [];
  
  for (const dim of dimensions) {
    const earliest = db.prepare(`SELECT score FROM hyro_metacognitive_scores WHERE student_id = ? AND dimension = ? AND created_at >= ? ORDER BY created_at ASC LIMIT 1`).get(studentId, dim, cutoffTime) as { score: number } | undefined;
    const latest = db.prepare(`SELECT score FROM hyro_metacognitive_scores WHERE student_id = ? AND dimension = ? ORDER BY created_at DESC LIMIT 1`).get(studentId, dim) as { score: number } | undefined;
    
    const startScore = earliest?.score || 0;
    const currentScore = latest?.score || 0;
    const change = currentScore - startScore;
    const percentChange = startScore > 0 ? (change / startScore) * 100 : 0;
    
    growth.push({ dimension: dim, start_score: startScore, current_score: currentScore, change, percent_change: percentChange, period_days: periodDays });
  }
  
  return growth;
}

export function getDimensionHistory(dimension: MetacognitiveDimension, studentId: string = 'hyro', limit: number = 30): MetacognitiveScore[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM hyro_metacognitive_scores WHERE student_id = ? AND dimension = ? ORDER BY created_at DESC LIMIT ?`).all(studentId, dimension, limit) as any[];
  
  return rows.map(row => ({
    id: row.id,
    student_id: row.student_id,
    dimension: row.dimension,
    score: row.score,
    evidence_count: row.evidence_count,
    assessment_date: row.assessment_date,
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export function getImprovementRecommendations(studentId: string = 'hyro'): { dimension: MetacognitiveDimension; recommendations: string[]; indicators_to_develop: string[] } | null {
  const profile = getMetacognitiveProfile(studentId);
  if (!profile) return null;
  
  const weakest = profile.weakest_dimension;
  const recommendations: Record<MetacognitiveDimension, string[]> = {
    planning: ['Before starting tasks, write down your goals and expected outcomes', 'Estimate how long tasks will take, then track actual time', 'Create a study schedule with specific time blocks', 'Break large tasks into smaller, manageable steps'],
    monitoring: ['Pause every 15 minutes to check your understanding', 'Use the "teach-back" method - explain concepts aloud', 'Keep a confusion log - write down what you don\'t understand', 'Rate your focus level periodically while studying'],
    evaluation: ['After each study session, rate your understanding 1-10', 'Compare your predicted scores to actual scores', 'Identify which study strategies worked best', 'Review mistakes to find patterns'],
    regulation: ['When stuck, try a different approach before giving up', 'Set up a distraction-free study environment', 'Use the Pomodoro technique for time management', 'Identify your peak focus hours and schedule difficult tasks then'],
  };
  
  return { dimension: weakest, recommendations: recommendations[weakest], indicators_to_develop: METACOGNITIVE_INDICATORS[weakest] };
}
