/**
 * HYRO FORGE: Meta-Learning Trajectory System
 *
 * The "Ultimate Level Up Machine" - A recursive improvement engine that:
 * 1. Records every learning trajectory through the C/E/G manifold
 * 2. Learns patterns of successful trajectories
 * 3. Recommends optimal paths for new students
 * 4. Continuously improves via HGM Optimizer safety checks
 *
 * "A system that improves the gradient of learning and compression recursively"
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { randomUUID } from 'crypto';
import { StatName } from './forge-types';
import { distanceCEG } from './forge-learner-state';
import {
  getHGMOptimizer,
  proposeParameterChange,
  ExperimentConfig,
  ExperimentResult,
} from './forge-hgm-optimizer';

ensureServerOnly('forge-meta-learner');

// ============================================================================
// Types
// ============================================================================

export interface StateVector {
  coherence: number;
  entropy: number;
  generativity: number;
}

export interface Intervention {
  type: 'content' | 'scaffolding' | 'challenge' | 'rest' | 'review' | 'exploration';
  content_id?: string;
  difficulty_adjustment?: number;
  duration_minutes: number;
  stat_target: string;
}

export interface TrajectoryRecord {
  id: string;
  student_id: string;
  stat_name: string;
  start_state: StateVector;
  end_state: StateVector;
  interventions: Intervention[];
  duration_hours: number;
  success: boolean;
  efficiency: number;
  created_at: number;
}

export interface LearnedPattern {
  id: string;
  source_state_cluster: StateVector;
  target_state_cluster: StateVector;
  optimal_intervention_sequence: Intervention[];
  confidence: number;
  sample_count: number;
  average_duration_hours: number;
  success_rate: number;
  stat_name?: string;
  created_at: number;
  updated_at: number;
}

export interface TrajectoryPlan {
  student_id: string;
  stat_name: string;
  current_state: StateVector;
  target_state: StateVector;
  recommended_interventions: Intervention[];
  estimated_duration_hours: number;
  confidence: number;
  pattern_source?: string;
}

// ============================================================================
// Database Helpers
// ============================================================================

interface TrajectoryRow {
  id: string;
  student_id: string;
  stat_name: string;
  start_coherence: number;
  start_entropy: number;
  start_generativity: number;
  end_coherence: number;
  end_entropy: number;
  end_generativity: number;
  interventions: string;
  duration_hours: number;
  success: number;
  efficiency: number;
  created_at: number;
}

interface PatternRow {
  id: string;
  source_coherence: number;
  source_entropy: number;
  source_generativity: number;
  target_coherence: number;
  target_entropy: number;
  target_generativity: number;
  optimal_interventions: string;
  confidence: number;
  sample_count: number;
  average_duration_hours: number;
  success_rate: number;
  stat_name: string | null;
  created_at: number;
  updated_at: number;
}

function rowToTrajectory(row: TrajectoryRow): TrajectoryRecord {
  return {
    id: row.id,
    student_id: row.student_id,
    stat_name: row.stat_name,
    start_state: {
      coherence: row.start_coherence,
      entropy: row.start_entropy,
      generativity: row.start_generativity,
    },
    end_state: {
      coherence: row.end_coherence,
      entropy: row.end_entropy,
      generativity: row.end_generativity,
    },
    interventions: JSON.parse(row.interventions),
    duration_hours: row.duration_hours,
    success: row.success === 1,
    efficiency: row.efficiency,
    created_at: row.created_at,
  };
}

function rowToPattern(row: PatternRow): LearnedPattern {
  return {
    id: row.id,
    source_state_cluster: {
      coherence: row.source_coherence,
      entropy: row.source_entropy,
      generativity: row.source_generativity,
    },
    target_state_cluster: {
      coherence: row.target_coherence,
      entropy: row.target_entropy,
      generativity: row.target_generativity,
    },
    optimal_intervention_sequence: JSON.parse(row.optimal_interventions),
    confidence: row.confidence,
    sample_count: row.sample_count,
    average_duration_hours: row.average_duration_hours,
    success_rate: row.success_rate,
    stat_name: row.stat_name || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate Euclidean distance in C/E/G space
 */
export function manifoldDistance(state1: StateVector, state2: StateVector): number {
  const dC = state1.coherence - state2.coherence;
  const dE = state1.entropy - state2.entropy;
  const dG = state1.generativity - state2.generativity;
  return Math.sqrt(dC * dC + dE * dE + dG * dG);
}

/**
 * Cluster a state to nearest representative point (k-means style)
 * Uses cluster radius of ~10 units
 */
export function clusterState(state: StateVector): StateVector {
  const CLUSTER_RADIUS = 10;

  // Round to nearest cluster center
  return {
    coherence: Math.round(state.coherence / CLUSTER_RADIUS) * CLUSTER_RADIUS,
    entropy: Math.round(state.entropy / CLUSTER_RADIUS) * CLUSTER_RADIUS,
    generativity: Math.round(state.generativity / CLUSTER_RADIUS) * CLUSTER_RADIUS,
  };
}

/**
 * Find patterns matching a state within a given radius
 */
export function findSimilarPatterns(
  state: StateVector,
  radius: number = 15
): LearnedPattern[] {
  const db = getDatabase();

  const rows = db
    .prepare(`
      SELECT * FROM hyro_learned_patterns
      WHERE confidence > 0.3
      ORDER BY confidence DESC, success_rate DESC
      LIMIT 100
    `)
    .all() as PatternRow[];

  const patterns = rows.map(rowToPattern);

  // Filter by distance
  return patterns.filter((p) => {
    const dist = manifoldDistance(state, p.source_state_cluster);
    return dist <= radius;
  });
}

/**
 * Build a trajectory plan from a learned pattern
 */
export function buildTrajectoryFromPattern(
  pattern: LearnedPattern,
  currentState: StateVector,
  targetState: StateVector
): TrajectoryPlan {
  // Adjust interventions based on current state vs pattern
  const adjustedInterventions = pattern.optimal_intervention_sequence.map((intervention) => {
    // Calculate state gap
    const currentGap = manifoldDistance(currentState, targetState);
    const patternGap = manifoldDistance(
      pattern.source_state_cluster,
      pattern.target_state_cluster
    );

    // Scale duration proportionally
    const scaleFactor = currentGap / (patternGap || 1);

    return {
      ...intervention,
      duration_minutes: Math.round(intervention.duration_minutes * scaleFactor),
    };
  });

  return {
    student_id: '', // Will be set by caller
    stat_name: pattern.stat_name || '',
    current_state: currentState,
    target_state: targetState,
    recommended_interventions: adjustedInterventions,
    estimated_duration_hours: pattern.average_duration_hours * (manifoldDistance(currentState, targetState) / manifoldDistance(pattern.source_state_cluster, pattern.target_state_cluster)),
    confidence: pattern.confidence,
    pattern_source: pattern.id,
  };
}

/**
 * Rule-based fallback when no patterns exist
 */
export function planOptimalTrajectory(
  studentId: string,
  statName: string,
  targetState: StateVector
): TrajectoryPlan {
  // Default heuristic: balanced progression
  const interventions: Intervention[] = [
    {
      type: 'content',
      stat_target: statName,
      duration_minutes: 20,
      difficulty_adjustment: 0.5,
    },
    {
      type: 'scaffolding',
      stat_target: statName,
      duration_minutes: 15,
    },
    {
      type: 'challenge',
      stat_target: statName,
      duration_minutes: 10,
      difficulty_adjustment: 0.8,
    },
    {
      type: 'review',
      stat_target: statName,
      duration_minutes: 10,
    },
  ];

  return {
    student_id: studentId,
    stat_name: statName,
    current_state: { coherence: 50, entropy: 50, generativity: 50 },
    target_state: targetState,
    recommended_interventions: interventions,
    estimated_duration_hours: 1,
    confidence: 0.3, // Low confidence for rule-based
  };
}

// ============================================================================
// MetaLearner Class
// ============================================================================

export class MetaLearner {
  private static instance: MetaLearner | null = null;

  private constructor() {
    console.log('[MetaLearner] Initialized - Ready to learn from trajectories');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MetaLearner {
    if (!MetaLearner.instance) {
      MetaLearner.instance = new MetaLearner();
    }
    return MetaLearner.instance;
  }

  /**
   * Record a completed trajectory
   */
  recordTrajectory(trajectory: TrajectoryRecord): void {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    // Insert trajectory record
    db.prepare(`
      INSERT INTO hyro_trajectory_records (
        id, student_id, stat_name,
        start_coherence, start_entropy, start_generativity,
        end_coherence, end_entropy, end_generativity,
        interventions, duration_hours, success, efficiency, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trajectory.id,
      trajectory.student_id,
      trajectory.stat_name,
      trajectory.start_state.coherence,
      trajectory.start_state.entropy,
      trajectory.start_state.generativity,
      trajectory.end_state.coherence,
      trajectory.end_state.entropy,
      trajectory.end_state.generativity,
      JSON.stringify(trajectory.interventions),
      trajectory.duration_hours,
      trajectory.success ? 1 : 0,
      trajectory.efficiency,
      now
    );

    console.log(`[MetaLearner] Recorded trajectory ${trajectory.id} (success=${trajectory.success})`);

    // Update patterns based on this trajectory
    this.updatePatterns(trajectory);
  }

  /**
   * Update patterns based on new trajectory
   */
  private updatePatterns(trajectory: TrajectoryRecord): void {
    // Cluster the start and end states
    const startCluster = clusterState(trajectory.start_state);
    const endCluster = clusterState(trajectory.end_state);

    // Find similar patterns
    const similarPatterns = this.findMatchingPatterns(startCluster, endCluster, 100);

    if (trajectory.success) {
      this.reinforcePattern(trajectory, similarPatterns);
    } else {
      this.weakenPattern(trajectory, similarPatterns);
    }
  }

  /**
   * Reinforce successful pattern
   */
  private reinforcePattern(
    trajectory: TrajectoryRecord,
    similarPatterns: LearnedPattern[]
  ): void {
    const db = getDatabase();
    const startCluster = clusterState(trajectory.start_state);
    const endCluster = clusterState(trajectory.end_state);

    // Find exact match
    const exactMatch = similarPatterns.find((p) =>
      manifoldDistance(p.source_state_cluster, startCluster) < 5 &&
      manifoldDistance(p.target_state_cluster, endCluster) < 5 &&
      p.stat_name === trajectory.stat_name
    );

    if (exactMatch) {
      // Update existing pattern
      const newSampleCount = exactMatch.sample_count + 1;
      const newSuccessRate = (exactMatch.success_rate * exactMatch.sample_count + 1) / newSampleCount;
      const newAvgDuration = (exactMatch.average_duration_hours * exactMatch.sample_count + trajectory.duration_hours) / newSampleCount;
      const newConfidence = Math.min(0.95, exactMatch.confidence + 0.05);

      db.prepare(`
        UPDATE hyro_learned_patterns
        SET sample_count = ?,
            success_rate = ?,
            average_duration_hours = ?,
            confidence = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        newSampleCount,
        newSuccessRate,
        newAvgDuration,
        newConfidence,
        Math.floor(Date.now() / 1000),
        exactMatch.id
      );

      console.log(`[MetaLearner] Reinforced pattern ${exactMatch.id} (confidence: ${newConfidence.toFixed(2)})`);
    } else {
      // Create new pattern
      const id = randomUUID();
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO hyro_learned_patterns (
          id, source_coherence, source_entropy, source_generativity,
          target_coherence, target_entropy, target_generativity,
          optimal_interventions, confidence, sample_count,
          average_duration_hours, success_rate, stat_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        startCluster.coherence,
        startCluster.entropy,
        startCluster.generativity,
        endCluster.coherence,
        endCluster.entropy,
        endCluster.generativity,
        JSON.stringify(trajectory.interventions),
        0.5, // Initial confidence
        1,
        trajectory.duration_hours,
        1.0, // 100% success (first sample)
        trajectory.stat_name,
        now,
        now
      );

      console.log(`[MetaLearner] Created new pattern ${id}`);
    }
  }

  /**
   * Weaken unsuccessful pattern
   */
  private weakenPattern(
    trajectory: TrajectoryRecord,
    similarPatterns: LearnedPattern[]
  ): void {
    const db = getDatabase();
    const startCluster = clusterState(trajectory.start_state);
    const endCluster = clusterState(trajectory.end_state);

    // Find exact match
    const exactMatch = similarPatterns.find((p) =>
      manifoldDistance(p.source_state_cluster, startCluster) < 5 &&
      manifoldDistance(p.target_state_cluster, endCluster) < 5 &&
      p.stat_name === trajectory.stat_name
    );

    if (exactMatch) {
      // Update with failure
      const newSampleCount = exactMatch.sample_count + 1;
      const newSuccessRate = (exactMatch.success_rate * exactMatch.sample_count) / newSampleCount;
      const newConfidence = Math.max(0.1, exactMatch.confidence - 0.1);

      db.prepare(`
        UPDATE hyro_learned_patterns
        SET sample_count = ?,
            success_rate = ?,
            confidence = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        newSampleCount,
        newSuccessRate,
        newConfidence,
        Math.floor(Date.now() / 1000),
        exactMatch.id
      );

      console.log(`[MetaLearner] Weakened pattern ${exactMatch.id} (confidence: ${newConfidence.toFixed(2)})`);
    }
  }

  /**
   * Get recommended trajectory for a student
   */
  recommendTrajectory(
    studentId: string,
    statName: string,
    targetState: StateVector,
    currentState?: StateVector
  ): TrajectoryPlan {
    const state = currentState || { coherence: 50, entropy: 50, generativity: 50 };

    // Find matching patterns
    const patterns = this.findMatchingPatterns(state, targetState, 20);

    if (patterns.length === 0) {
      console.log('[MetaLearner] No patterns found, using rule-based fallback');
      return planOptimalTrajectory(studentId, statName, targetState);
    }

    // Use highest confidence pattern
    const bestPattern = patterns[0];
    const plan = buildTrajectoryFromPattern(bestPattern, state, targetState);

    plan.student_id = studentId;
    plan.stat_name = statName;

    console.log(`[MetaLearner] Recommended trajectory based on pattern ${bestPattern.id} (confidence: ${bestPattern.confidence.toFixed(2)})`);

    return plan;
  }

  /**
   * Find patterns matching current and target states
   */
  findMatchingPatterns(
    currentState: StateVector,
    targetState: StateVector,
    limit: number = 10
  ): LearnedPattern[] {
    const db = getDatabase();

    // Get all patterns with decent confidence
    const rows = db
      .prepare(`
        SELECT * FROM hyro_learned_patterns
        WHERE confidence > 0.3 AND success_rate > 0.5
        ORDER BY confidence DESC, success_rate DESC
        LIMIT 100
      `)
      .all() as PatternRow[];

    const patterns = rows.map(rowToPattern);

    // Score each pattern by distance to current/target states
    const scored = patterns.map((p) => {
      const sourceDist = manifoldDistance(currentState, p.source_state_cluster);
      const targetDist = manifoldDistance(targetState, p.target_state_cluster);
      const score = p.confidence * p.success_rate / (1 + sourceDist + targetDist);
      return { pattern: p, score };
    });

    // Sort by score and return top patterns
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.pattern);
  }
}

// ============================================================================
// Integration with HGM Optimizer
// ============================================================================

/**
 * Propose a trajectory improvement for HGM testing
 */
export function proposeTrajectoryImprovement(
  currentPattern: LearnedPattern,
  proposedPattern: LearnedPattern
): { valid: boolean; experiment?: ExperimentConfig } {
  // Check if change is within ±5% bounds
  const durationChange = Math.abs(
    (proposedPattern.average_duration_hours - currentPattern.average_duration_hours) /
    currentPattern.average_duration_hours
  );

  if (durationChange > 0.05) {
    console.log('[MetaLearner] Proposed change exceeds ±5% safety bound');
    return { valid: false };
  }

  // Propose experiment to HGM
  try {
    const experiment = proposeParameterChange(
      `trajectory_duration_${currentPattern.id}`,
      currentPattern.average_duration_hours,
      proposedPattern.average_duration_hours,
      `Testing trajectory optimization: ${currentPattern.source_state_cluster.coherence}→${currentPattern.target_state_cluster.coherence}`
    );

    return { valid: true, experiment };
  } catch (error) {
    console.error('[MetaLearner] HGM rejected proposal:', error);
    return { valid: false };
  }
}

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get pattern statistics
 */
export function getPatternStatistics(): {
  total_patterns: number;
  average_confidence: number;
  average_success_rate: number;
  patterns_by_stat: Record<string, number>;
} {
  const db = getDatabase();

  const stats = db
    .prepare(`
      SELECT
        COUNT(*) as total_patterns,
        AVG(confidence) as average_confidence,
        AVG(success_rate) as average_success_rate
      FROM hyro_learned_patterns
    `)
    .get() as { total_patterns: number; average_confidence: number; average_success_rate: number };

  const byStat = db
    .prepare(`
      SELECT stat_name, COUNT(*) as count
      FROM hyro_learned_patterns
      WHERE stat_name IS NOT NULL
      GROUP BY stat_name
    `)
    .all() as Array<{ stat_name: string; count: number }>;

  const patterns_by_stat: Record<string, number> = {};
  for (const row of byStat) {
    patterns_by_stat[row.stat_name] = row.count;
  }

  return {
    total_patterns: stats.total_patterns,
    average_confidence: stats.average_confidence || 0,
    average_success_rate: stats.average_success_rate || 0,
    patterns_by_stat,
  };
}

/**
 * Get trajectory history for a student
 */
export function getTrajectoryHistory(
  studentId: string,
  statName?: string,
  limit: number = 50
): TrajectoryRecord[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM hyro_trajectory_records
    WHERE student_id = ?
  `;
  const params: any[] = [studentId];

  if (statName) {
    query += ` AND stat_name = ?`;
    params.push(statName);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(query).all(...params) as TrajectoryRow[];
  return rows.map(rowToTrajectory);
}

// ============================================================================
// Convenience Exports
// ============================================================================

export function getMetaLearner(): MetaLearner {
  return MetaLearner.getInstance();
}

export function recordLearningTrajectory(
  studentId: string,
  statName: StatName,
  startState: StateVector,
  endState: StateVector,
  interventions: Intervention[],
  durationHours: number,
  success: boolean
): TrajectoryRecord {
  const id = randomUUID();

  // Calculate efficiency (actual vs expected time)
  const expectedDuration = durationHours * 1.2; // Baseline expectation
  const efficiency = expectedDuration / durationHours;

  const trajectory: TrajectoryRecord = {
    id,
    student_id: studentId,
    stat_name: statName,
    start_state: startState,
    end_state: endState,
    interventions,
    duration_hours: durationHours,
    success,
    efficiency,
    created_at: Math.floor(Date.now() / 1000),
  };

  const learner = getMetaLearner();
  learner.recordTrajectory(trajectory);

  return trajectory;
}
