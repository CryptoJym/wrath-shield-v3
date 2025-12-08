/**
 * HYRO FORGE: Update Equations for C/E/G Manifold
 *
 * This module defines HOW each interaction type affects the learner's state vector.
 * These are the concrete mathematical rules for computing ΔC, ΔE, ΔG from:
 * - Answer submissions (correct/incorrect, time, confidence)
 * - Hint requests
 * - Session events
 * - Metacognitive responses
 *
 * The update equations feed into:
 * - ZPD engine for difficulty adjustment
 * - Path planning for content selection
 * - HGM for parameter optimization
 *
 * Key Design Principles:
 * 1. Small incremental updates (avoid dramatic state swings)
 * 2. Context-sensitive (same action can have different effects)
 * 3. Bounded changes (max ±10 per interaction, typically ±2-5)
 * 4. Asymmetric learning (correct answers build slower than errors erode)
 */

import { ensureServerOnly } from '../server-only-guard';
import type {
  LearnerState,
  TrajectoryEffect,
  AttractorType,
  ObjectiveVector
} from './forge-learner-state';
import {
  findNearestAttractor,
  ATTRACTOR_BASINS,
  distanceCEG
} from './forge-learner-state';

ensureServerOnly('lib/hyro/forge-update-equations');

// =============================================================================
// UPDATE CONSTANTS (Tunable by HGM)
// =============================================================================

/**
 * Base update magnitudes - these are the HGM-tunable parameters
 * HGM can adjust these within ±5% autonomously
 */
export const UPDATE_PARAMS = {
  // Coherence updates
  CORRECT_ANSWER_C_GAIN: 2.5,        // Base C gain for correct answer
  INCORRECT_ANSWER_C_LOSS: 3.0,      // Base C loss for incorrect (slightly higher = asymmetric)
  HINT_C_ADJUSTMENT: -0.5,           // Small C penalty for needing hint
  FAST_CORRECT_C_BONUS: 1.0,         // Bonus for quick correct answers
  STREAK_C_MULTIPLIER: 0.15,         // Per-streak-item multiplier

  // Entropy updates
  INCORRECT_ANSWER_E_GAIN: 3.5,      // Errors increase uncertainty
  CORRECT_ANSWER_E_LOSS: 2.0,        // Correct answers reduce uncertainty
  HINT_E_ADJUSTMENT: 1.5,            // Hints increase productive uncertainty
  HESITATION_E_GAIN: 2.0,            // Long pauses suggest confusion
  EXPLORATION_E_BASELINE: 0.5,       // Entropy naturally increases during exploration

  // Generativity updates
  NOVEL_SOLUTION_G_GAIN: 4.0,        // Creative answers boost G
  TRANSFER_SUCCESS_G_GAIN: 3.5,      // Applying knowledge in new context
  ROTE_CORRECT_G_PENALTY: -0.5,      // Pure memorization doesn't help G
  EXPLANATION_G_BOOST: 2.5,          // Good explanations increase G
  FAILED_TRANSFER_G_LOSS: 2.0,       // Failed transfer attempts

  // Time thresholds (milliseconds)
  FAST_ANSWER_THRESHOLD_MS: 5000,    // Under 5s = "fast"
  SLOW_ANSWER_THRESHOLD_MS: 60000,   // Over 60s = "hesitation"

  // Confidence calibration
  OVERCONFIDENT_WRONG_C_PENALTY: 2.0,  // Extra C loss for confident + wrong
  UNDERCONFIDENT_RIGHT_C_BONUS: 1.5,   // Extra C gain for unsure + right

  // Bounds
  MAX_SINGLE_UPDATE: 10.0,           // Absolute max change per dimension
  MIN_SINGLE_UPDATE: -10.0           // Absolute min change per dimension
} as const;

// =============================================================================
// INTERACTION TYPES
// =============================================================================

/**
 * Answer submission context
 */
export interface AnswerContext {
  is_correct: boolean;
  time_taken_ms: number;
  confidence?: number;           // 0-100 if provided
  attempt_number: number;        // 1 = first try
  difficulty: number;            // 0-100
  concept_id: string;
  is_novel_solution?: boolean;   // Did they solve it in an unexpected way?
  is_transfer_problem?: boolean; // Is this applying knowledge to new context?
  error_pattern?: string;        // Detected misconception pattern
  current_streak: number;        // Consecutive correct answers
  mastery_estimate: number;      // Current mastery for this concept (0-1)
}

/**
 * Hint request context
 */
export interface HintContext {
  hint_number: number;           // 1st, 2nd, 3rd hint etc.
  time_elapsed_ms: number;       // Time since problem started
  difficulty: number;
  concept_id: string;
}

/**
 * Metacognitive response context
 */
export interface MetacogContext {
  dimension: 'planning' | 'monitoring' | 'regulation' | 'evaluation';
  quality_score: number;         // 0-100
  response_time_ms: number;
  calibration_accuracy: number;  // Current calibration (0-1, 0.5 = well-calibrated)
}

/**
 * Session event context
 */
export interface SessionContext {
  event: 'start' | 'end' | 'pause' | 'resume';
  duration_seconds?: number;
  questions_attempted?: number;
  questions_correct?: number;
}

// =============================================================================
// CORE UPDATE EQUATIONS
// =============================================================================

/**
 * Compute state update from an answer submission
 * This is the primary update equation - most learning happens here
 */
export function computeAnswerUpdate(
  currentState: LearnerState,
  context: AnswerContext
): TrajectoryEffect {
  let delta_C = 0;
  let delta_E = 0;
  let delta_G = 0;
  let confidence = 0.7; // Base confidence in this update

  const P = UPDATE_PARAMS;
  const difficultyFactor = context.difficulty / 50; // Normalize around 50
  const masteryFactor = 1 - context.mastery_estimate; // More room to grow = bigger updates

  // -------------------------------------------------------------------------
  // COHERENCE (C) Updates
  // -------------------------------------------------------------------------
  if (context.is_correct) {
    // Base gain scaled by difficulty and mastery room
    delta_C = P.CORRECT_ANSWER_C_GAIN * difficultyFactor * (0.5 + masteryFactor * 0.5);

    // Fast answer bonus (indicates strong understanding)
    if (context.time_taken_ms < P.FAST_ANSWER_THRESHOLD_MS) {
      delta_C += P.FAST_CORRECT_C_BONUS;
    }

    // Streak multiplier (consecutive correct builds confidence)
    if (context.current_streak > 1) {
      delta_C *= 1 + Math.min(context.current_streak - 1, 5) * P.STREAK_C_MULTIPLIER;
    }

    // Calibration bonus: unsure but correct shows good self-awareness
    if (context.confidence !== undefined && context.confidence < 50) {
      delta_C += P.UNDERCONFIDENT_RIGHT_C_BONUS;
    }
  } else {
    // Base loss scaled by difficulty (harder problems = less harsh penalty)
    delta_C = -P.INCORRECT_ANSWER_C_LOSS * (2 - difficultyFactor) * masteryFactor;

    // Calibration penalty: confident but wrong shows poor self-model
    if (context.confidence !== undefined && context.confidence > 70) {
      delta_C -= P.OVERCONFIDENT_WRONG_C_PENALTY;
    }

    // First attempt penalty is less harsh
    if (context.attempt_number === 1) {
      delta_C *= 0.7;
    }
  }

  // -------------------------------------------------------------------------
  // ENTROPY (E) Updates
  // -------------------------------------------------------------------------
  if (context.is_correct) {
    // Correct answers reduce uncertainty
    delta_E = -P.CORRECT_ANSWER_E_LOSS * masteryFactor;

    // But fast answers on hard problems might increase productive uncertainty
    // (suggests exploration/insight rather than methodical solving)
    if (context.difficulty > 70 && context.time_taken_ms < P.FAST_ANSWER_THRESHOLD_MS) {
      delta_E += P.EXPLORATION_E_BASELINE;
    }
  } else {
    // Errors increase uncertainty
    delta_E = P.INCORRECT_ANSWER_E_GAIN * (0.5 + difficultyFactor * 0.5);

    // Known misconception pattern = slightly less entropy (at least we know what's wrong)
    if (context.error_pattern) {
      delta_E *= 0.8;
    }
  }

  // Hesitation increases entropy regardless of correctness
  if (context.time_taken_ms > P.SLOW_ANSWER_THRESHOLD_MS) {
    delta_E += P.HESITATION_E_GAIN;
  }

  // -------------------------------------------------------------------------
  // GENERATIVITY (G) Updates
  // -------------------------------------------------------------------------
  if (context.is_correct) {
    if (context.is_novel_solution) {
      // Creative solution = big G boost
      delta_G = P.NOVEL_SOLUTION_G_GAIN;
      confidence = 0.85;
    } else if (context.is_transfer_problem) {
      // Successful transfer = solid G boost
      delta_G = P.TRANSFER_SUCCESS_G_GAIN;
    } else if (context.difficulty < 30 && context.mastery_estimate > 0.8) {
      // Rote/easy answer when already mastered = slight G penalty
      delta_G = P.ROTE_CORRECT_G_PENALTY;
    } else {
      // Normal correct answer = small G maintenance
      delta_G = 0.5 * difficultyFactor;
    }
  } else {
    if (context.is_transfer_problem) {
      // Failed transfer is disappointing for G
      delta_G = -P.FAILED_TRANSFER_G_LOSS;
    } else {
      // Regular errors don't much affect G
      delta_G = -0.5 * difficultyFactor;
    }
  }

  // -------------------------------------------------------------------------
  // Apply Bounds
  // -------------------------------------------------------------------------
  delta_C = clampUpdate(delta_C);
  delta_E = clampUpdate(delta_E);
  delta_G = clampUpdate(delta_G);

  return { delta_C, delta_E, delta_G, confidence };
}

/**
 * Compute state update from a hint request
 */
export function computeHintUpdate(
  currentState: LearnerState,
  context: HintContext
): TrajectoryEffect {
  const P = UPDATE_PARAMS;

  // Hints have a small cost to C (needed help) but can boost E productively
  let delta_C = P.HINT_C_ADJUSTMENT * context.hint_number; // More hints = more C cost
  let delta_E = P.HINT_E_ADJUSTMENT; // Hints create productive uncertainty
  let delta_G = 0; // Hints neutral on G

  // Early hints on hard problems are less penalizing
  if (context.difficulty > 70 && context.time_elapsed_ms < 30000) {
    delta_C *= 0.5;
  }

  // Many hints suggest stuck state - entropy should be higher
  if (context.hint_number >= 3) {
    delta_E += 1.0;
    delta_C -= 1.0;
  }

  return {
    delta_C: clampUpdate(delta_C),
    delta_E: clampUpdate(delta_E),
    delta_G: clampUpdate(delta_G),
    confidence: 0.6
  };
}

/**
 * Compute state update from metacognitive engagement
 */
export function computeMetacogUpdate(
  currentState: LearnerState,
  context: MetacogContext
): TrajectoryEffect {
  // Good metacognitive engagement generally improves all dimensions
  const qualityFactor = context.quality_score / 100;

  let delta_C = 0;
  let delta_E = 0;
  let delta_G = 0;

  switch (context.dimension) {
    case 'planning':
      // Good planning increases C (organized approach) and G (creative thinking)
      delta_C = 1.5 * qualityFactor;
      delta_G = 1.0 * qualityFactor;
      break;

    case 'monitoring':
      // Good monitoring improves calibration → slight C boost, E reduction
      delta_C = 1.0 * qualityFactor;
      delta_E = -1.0 * qualityFactor;
      break;

    case 'regulation':
      // Good regulation reduces entropy (taking control)
      delta_E = -2.0 * qualityFactor;
      delta_C = 0.5 * qualityFactor;
      break;

    case 'evaluation':
      // Good evaluation boosts C (accurate self-model) and G (reflection)
      delta_C = 1.5 * qualityFactor;
      delta_G = 1.5 * qualityFactor;
      break;
  }

  // Calibration bonus: well-calibrated learners benefit more from metacog
  if (context.calibration_accuracy > 0.7) {
    delta_C *= 1.2;
    delta_G *= 1.2;
  }

  return {
    delta_C: clampUpdate(delta_C),
    delta_E: clampUpdate(delta_E),
    delta_G: clampUpdate(delta_G),
    confidence: 0.65
  };
}

/**
 * Compute state update from session events
 */
export function computeSessionUpdate(
  currentState: LearnerState,
  context: SessionContext
): TrajectoryEffect {
  let delta_C = 0;
  let delta_E = 0;
  let delta_G = 0;

  switch (context.event) {
    case 'start':
      // Fresh session = slight entropy increase (new context)
      delta_E = 1.0;
      break;

    case 'end':
      // Session end: consolidation effects
      if (context.questions_attempted && context.questions_correct) {
        const accuracy = context.questions_correct / context.questions_attempted;
        // Good session slightly boosts C
        delta_C = (accuracy - 0.5) * 2.0;
        // Productive sessions reduce E
        delta_E = -accuracy * 1.5;
        // Active engagement boosts G
        delta_G = Math.min(context.questions_attempted / 10, 2.0);
      }
      break;

    case 'pause':
      // Taking a break - entropy drift
      delta_E = 0.5;
      break;

    case 'resume':
      // Coming back - slight entropy from context switch
      delta_E = 0.5;
      break;
  }

  return {
    delta_C: clampUpdate(delta_C),
    delta_E: clampUpdate(delta_E),
    delta_G: clampUpdate(delta_G),
    confidence: 0.5
  };
}

// =============================================================================
// TIME-BASED DRIFT
// =============================================================================

/**
 * Compute passive drift when no interaction occurs
 * State naturally evolves toward equilibrium over time
 */
export function computeTimeDrift(
  currentState: LearnerState,
  elapsedSeconds: number
): TrajectoryEffect {
  // Drift toward neutral (50,50,50) very slowly
  const driftRate = 0.001; // Per second
  const driftAmount = driftRate * elapsedSeconds;

  return {
    delta_C: (50 - currentState.C) * driftAmount,
    delta_E: (50 - currentState.E) * driftAmount,
    delta_G: (50 - currentState.G) * driftAmount,
    confidence: 0.3
  };
}

/**
 * Compute attractor pull effect
 * When near an attractor basin, the state is "pulled" toward the centroid
 */
export function computeAttractorDrift(
  currentState: LearnerState,
  elapsedSeconds: number
): TrajectoryEffect {
  const { attractor, distance, inBasin } = findNearestAttractor(currentState);

  if (!inBasin) {
    // Not in any basin - no attractor pull
    return { delta_C: 0, delta_E: 0, delta_G: 0, confidence: 0.2 };
  }

  // Attractor pull strength increases as you get closer to centroid
  const basin = ATTRACTOR_BASINS[attractor];
  const pullStrength = (1 - distance / basin.radius) * 0.005 * elapsedSeconds;

  return {
    delta_C: (basin.centroid.C - currentState.C) * pullStrength,
    delta_E: (basin.centroid.E - currentState.E) * pullStrength,
    delta_G: (basin.centroid.G - currentState.G) * pullStrength,
    confidence: 0.4
  };
}

// =============================================================================
// COMPOUND UPDATES
// =============================================================================

/**
 * Aggregate multiple trajectory effects
 * Uses confidence-weighted averaging for compound updates
 */
export function aggregateEffects(
  effects: TrajectoryEffect[]
): TrajectoryEffect {
  if (effects.length === 0) {
    return { delta_C: 0, delta_E: 0, delta_G: 0, confidence: 0 };
  }

  let totalWeight = 0;
  let delta_C = 0;
  let delta_E = 0;
  let delta_G = 0;

  for (const effect of effects) {
    const weight = effect.confidence;
    delta_C += effect.delta_C * weight;
    delta_E += effect.delta_E * weight;
    delta_G += effect.delta_G * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { delta_C: 0, delta_E: 0, delta_G: 0, confidence: 0 };
  }

  // Average the confidence
  const avgConfidence = totalWeight / effects.length;

  return {
    delta_C: clampUpdate(delta_C / totalWeight),
    delta_E: clampUpdate(delta_E / totalWeight),
    delta_G: clampUpdate(delta_G / totalWeight),
    confidence: avgConfidence
  };
}

// =============================================================================
// ZPD INTEGRATION
// =============================================================================

/**
 * Compute recommended difficulty adjustment based on current state
 * Returns a multiplier for difficulty (< 1 = easier, > 1 = harder)
 */
export function computeDifficultyAdjustment(
  currentState: LearnerState,
  recentPerformance: { correct: number; total: number }
): number {
  const { attractor, inBasin } = findNearestAttractor(currentState);
  const accuracy = recentPerformance.total > 0
    ? recentPerformance.correct / recentPerformance.total
    : 0.5;

  // Base adjustment from accuracy
  let adjustment = 1.0;
  if (accuracy > 0.85) adjustment = 1.15; // Too easy
  else if (accuracy > 0.75) adjustment = 1.05;
  else if (accuracy < 0.5) adjustment = 0.85; // Too hard
  else if (accuracy < 0.6) adjustment = 0.95;

  // Attractor-based modifications
  if (inBasin) {
    switch (attractor) {
      case 'flow':
        // In flow - maintain current difficulty or slight increase
        adjustment *= 1.05;
        break;
      case 'boredom':
        // Bored - increase difficulty significantly
        adjustment *= 1.2;
        break;
      case 'frustration':
        // Frustrated - decrease difficulty
        adjustment *= 0.8;
        break;
      case 'confusion':
        // Confused - decrease difficulty and add scaffolding
        adjustment *= 0.75;
        break;
      case 'discovery':
        // Discovery mode - maintain challenge
        adjustment *= 1.0;
        break;
    }
  }

  // C/E/G direct influence
  if (currentState.C > 75) adjustment *= 1.05;  // High coherence can handle more
  if (currentState.E > 75) adjustment *= 0.9;   // High entropy needs stability
  if (currentState.G > 75) adjustment *= 1.1;   // High G seeks challenge

  // Bound the adjustment
  return Math.max(0.5, Math.min(1.5, adjustment));
}

/**
 * Compute expected state trajectory for a given content selection
 * Used by path planning to evaluate content options
 */
export function predictTrajectory(
  currentState: LearnerState,
  contentDifficulty: number,
  estimatedMastery: number,
  isTransfer: boolean
): {
  optimistic: TrajectoryEffect;
  pessimistic: TrajectoryEffect;
  expected: TrajectoryEffect;
} {
  // Optimistic: correct answer
  const optimistic = computeAnswerUpdate(currentState, {
    is_correct: true,
    time_taken_ms: 15000,
    difficulty: contentDifficulty,
    concept_id: 'predicted',
    attempt_number: 1,
    current_streak: 1,
    mastery_estimate: estimatedMastery,
    is_transfer_problem: isTransfer
  });

  // Pessimistic: incorrect answer
  const pessimistic = computeAnswerUpdate(currentState, {
    is_correct: false,
    time_taken_ms: 45000,
    difficulty: contentDifficulty,
    concept_id: 'predicted',
    attempt_number: 1,
    current_streak: 0,
    mastery_estimate: estimatedMastery,
    is_transfer_problem: isTransfer
  });

  // Expected: weighted by estimated probability of success
  // P(correct) estimated from mastery and difficulty alignment
  const difficultyGap = Math.abs(estimatedMastery * 100 - contentDifficulty);
  const pCorrect = estimatedMastery * (1 - difficultyGap / 200);

  const expected: TrajectoryEffect = {
    delta_C: optimistic.delta_C * pCorrect + pessimistic.delta_C * (1 - pCorrect),
    delta_E: optimistic.delta_E * pCorrect + pessimistic.delta_E * (1 - pCorrect),
    delta_G: optimistic.delta_G * pCorrect + pessimistic.delta_G * (1 - pCorrect),
    confidence: 0.5 + Math.abs(pCorrect - 0.5)
  };

  return { optimistic, pessimistic, expected };
}

// =============================================================================
// OBJECTIVE SCORING
// =============================================================================

/**
 * Compute objective vector for a content selection
 * Used for Pareto optimization in path planning
 */
export function computeObjectives(
  currentState: LearnerState,
  trajectory: TrajectoryEffect,
  contentMetadata: {
    estimated_time_seconds: number;
    transfer_domains: string[];
    concept_id: string;
  }
): ObjectiveVector {
  // Learning gain: expected C improvement normalized
  const learning_gain = Math.max(0, trajectory.delta_C / 10);

  // Engagement: based on expected E changes and attractor proximity
  const { attractor, distance } = findNearestAttractor(currentState);
  const flowDistance = distanceCEG(currentState, ATTRACTOR_BASINS.flow.centroid);
  const engagement = Math.max(0, 1 - flowDistance / 100);

  // Efficiency: learning per time
  const timeMinutes = contentMetadata.estimated_time_seconds / 60;
  const efficiency = timeMinutes > 0 ? learning_gain / timeMinutes : 0;

  // Transfer potential: based on number of connected domains
  const transfer_potential = Math.min(1, contentMetadata.transfer_domains.length / 3);

  return {
    learning_gain: Math.min(1, learning_gain),
    engagement: Math.min(1, engagement),
    efficiency: Math.min(1, efficiency),
    transfer_potential
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Clamp update to bounds
 */
function clampUpdate(value: number): number {
  return Math.max(
    UPDATE_PARAMS.MIN_SINGLE_UPDATE,
    Math.min(UPDATE_PARAMS.MAX_SINGLE_UPDATE, value)
  );
}

/**
 * Validate update parameters (for HGM safety checks)
 */
export function validateUpdateParams(
  params: Partial<typeof UPDATE_PARAMS>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const baseline = UPDATE_PARAMS;

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'number') {
      errors.push(`${key} must be a number`);
      continue;
    }

    const baselineValue = baseline[key as keyof typeof baseline];
    if (typeof baselineValue !== 'number') continue;

    // Check ±5% bounds (HGM constraint)
    const minAllowed = baselineValue * 0.95;
    const maxAllowed = baselineValue * 1.05;

    if (value < minAllowed || value > maxAllowed) {
      errors.push(
        `${key} value ${value} outside ±5% bounds [${minAllowed.toFixed(3)}, ${maxAllowed.toFixed(3)}]`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
