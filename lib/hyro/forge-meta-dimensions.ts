/**
 * HYRO FORGE: Meta-Dimensions System
 *
 * Tracks higher-order learning dimensions beyond traditional academic subjects.
 * Subjects like Art, Music, and PE develop capabilities that don't map cleanly
 * to the 8-stat academic model, but still affect C/E/G manifold movement.
 *
 * Meta-dimensions are cross-cutting abilities that influence how learners
 * navigate the learning space, independent of content mastery.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { randomUUID } from 'crypto';
import { StatName } from './forge-types';

ensureServerOnly('lib/hyro/forge-meta-dimensions');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Meta-dimensions - higher-order learning capabilities
 * Values range from 0-1 (stored as 0-100 internally for consistency)
 */
export interface MetaDimensions {
  /** Ability to move fluidly between conceptual states (0-1) */
  manifold_fluidity: number;

  /** Cross-domain integration - coherence across multiple mental models (0-1) */
  multi_model_coherence: number;

  /** Adaptability to new contexts and self-concept flexibility (0-1) */
  identity_elasticity: number;

  /** Metacognitive monitoring - awareness of learning trajectory (0-1) */
  gradient_awareness: number;

  /** Comfort with uncertainty and productive exploration (0-1) */
  entropy_intuition: number;

  /** Ability to hold contradictions productively (0-1) */
  non_dual_resolution: number;

  /** Collaborative creation and value generation (0-1) */
  cooperative_generativity: number;
}

export type MetaDimensionName = keyof MetaDimensions;

/**
 * All meta-dimension names for iteration
 */
export const META_DIMENSION_NAMES: MetaDimensionName[] = [
  'manifold_fluidity',
  'multi_model_coherence',
  'identity_elasticity',
  'gradient_awareness',
  'entropy_intuition',
  'non_dual_resolution',
  'cooperative_generativity',
];

/**
 * Extended subject list including non-academic subjects
 */
export type ExtendedSubject =
  | StatName  // All 8 academic stats
  | 'writing'
  | 'social_studies'
  | 'art'
  | 'music'
  | 'physical_education';

/**
 * Subject-to-MetaDimension contribution mapping
 */
export interface SubjectMetaContribution {
  subject: ExtendedSubject;
  contributions: Partial<Record<MetaDimensionName, number>>;
}

/**
 * Event record for meta-dimension changes
 */
export interface MetaDimensionEvent {
  id: string;
  student_id: string;
  dimension: MetaDimensionName;
  change: number;  // Delta applied
  source: string;  // What caused the change (e.g., "art_session", "music_practice")
  created_at: number;
}

/**
 * Student's complete meta-dimension profile
 */
export interface StudentMetaProfile {
  student_id: string;
  dimensions: MetaDimensions;
  history: MetaDimensionEvent[];
  last_updated: number;
}

/**
 * Activity recommendation for improving weak dimensions
 */
export interface MetaDimensionRecommendation {
  dimension: MetaDimensionName;
  current: number;
  recommended_activities: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default meta-dimension values for new students
 * Start at neutral 0.5 for all dimensions
 */
const DEFAULT_META_DIMENSIONS: MetaDimensions = {
  manifold_fluidity: 0.5,
  multi_model_coherence: 0.5,
  identity_elasticity: 0.5,
  gradient_awareness: 0.5,
  entropy_intuition: 0.5,
  non_dual_resolution: 0.5,
  cooperative_generativity: 0.5,
};

/**
 * Subject-to-MetaDimension contribution mappings
 *
 * Each subject contributes different amounts to different meta-dimensions.
 * Values represent the maximum boost per session (scaled by performance).
 *
 * Academic subjects have moderate contributions.
 * Non-academic subjects (Art, Music, PE) have stronger contributions.
 */
const SUBJECT_META_CONTRIBUTIONS: Record<ExtendedSubject, Partial<Record<MetaDimensionName, number>>> = {
  // Academic subjects - moderate contributions
  math: {
    multi_model_coherence: 0.3,
    gradient_awareness: 0.2,
  },
  reading: {
    multi_model_coherence: 0.2,
    non_dual_resolution: 0.2,
  },
  writing: {
    cooperative_generativity: 0.3,
    identity_elasticity: 0.2,
  },
  science: {
    entropy_intuition: 0.3,
    gradient_awareness: 0.2,
  },
  social_studies: {
    non_dual_resolution: 0.3,
    multi_model_coherence: 0.2,
  },
  coding: {
    manifold_fluidity: 0.3,
    gradient_awareness: 0.2,
  },
  study_skills: {
    gradient_awareness: 0.3,
    manifold_fluidity: 0.2,
  },
  critical_thinking: {
    non_dual_resolution: 0.3,
    entropy_intuition: 0.2,
  },
  technology: {
    manifold_fluidity: 0.2,
    multi_model_coherence: 0.2,
  },
  problem_solving: {
    manifold_fluidity: 0.3,
    entropy_intuition: 0.2,
  },

  // Non-academic subjects - stronger, multi-dimensional contributions
  art: {
    manifold_fluidity: 0.4,
    cooperative_generativity: 0.4,
    identity_elasticity: 0.3,
    entropy_intuition: 0.2,
  },
  music: {
    multi_model_coherence: 0.4,
    entropy_intuition: 0.3,
    cooperative_generativity: 0.3,
    manifold_fluidity: 0.2,
  },
  physical_education: {
    gradient_awareness: 0.4,
    identity_elasticity: 0.3,
    manifold_fluidity: 0.2,
    entropy_intuition: 0.2,
  },
};

/**
 * Decay rate for unused meta-dimensions
 * Half-life of 90 days (slower than skill decay)
 */
const META_DECAY_HALF_LIFE_DAYS = 90;

/**
 * Minimum threshold for recommendations (dimensions below this get flagged)
 */
const RECOMMENDATION_THRESHOLD = 0.4;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get student's meta-dimensions with defaults
 * Returns normalized 0-1 values
 */
export function getStudentMetaDimensions(studentId: string): MetaDimensions {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT dimension_name, score
    FROM hyro_meta_dimension_estimates
    WHERE student_id = ?
  `).all(studentId) as Array<{ dimension_name: string; score: number }>;

  // Start with defaults
  const dimensions = { ...DEFAULT_META_DIMENSIONS };

  // Override with stored values (convert from 0-100 to 0-1)
  for (const row of rows) {
    if (row.dimension_name in dimensions) {
      dimensions[row.dimension_name as MetaDimensionName] = row.score / 100;
    }
  }

  return dimensions;
}

/**
 * Initialize default meta-dimensions for a new student
 */
export function initializeMetaDimensions(studentId: string): MetaDimensions {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Insert default values for all dimensions
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hyro_meta_dimension_estimates (
      id, student_id, dimension_name, score, ci_low, ci_high,
      confidence_level, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const dimension of META_DIMENSION_NAMES) {
    const id = randomUUID();
    stmt.run(
      id,
      studentId,
      dimension,
      50,  // 0.5 * 100
      0,
      100,
      'low',
      now,
      now
    );
  }

  return DEFAULT_META_DIMENSIONS;
}

/**
 * Boost function - applies performance-based increase to a dimension
 *
 * @param currentValue - Current dimension value (0-1)
 * @param performance - Performance score (0-100)
 * @param maxBoost - Maximum possible boost for this dimension
 * @returns New dimension value (clamped to 0-1)
 */
function boost(
  currentValue: number,
  performance: number,
  maxBoost: number
): number {
  // Scale boost by performance (0-100 -> 0-1)
  const performanceScalar = performance / 100;

  // Apply diminishing returns - harder to improve when already high
  const diminishingFactor = 1 - currentValue;

  // Calculate boost
  const actualBoost = maxBoost * performanceScalar * diminishingFactor * 0.3;

  // Apply and clamp
  return Math.max(0, Math.min(1, currentValue + actualBoost));
}

/**
 * Get subject-specific meta-dimension contributions
 */
export function getSubjectMetaContributions(
  subject: ExtendedSubject
): Partial<Record<MetaDimensionName, number>> {
  return SUBJECT_META_CONTRIBUTIONS[subject] || {};
}

/**
 * Apply subject performance to meta-dimensions
 *
 * @param studentId - Student identifier
 * @param subject - Subject being practiced
 * @param performance - Performance score (0-100)
 * @param duration_minutes - Session duration for time-based scaling
 * @returns Updated meta-dimensions
 */
export function applySubjectToMetaDimensions(
  studentId: string,
  subject: ExtendedSubject,
  performance: number,
  duration_minutes: number
): MetaDimensions {
  const currentDimensions = getStudentMetaDimensions(studentId);
  const contributions = getSubjectMetaContributions(subject);

  // Scale contributions by session duration (cap at 60 minutes)
  const durationScalar = Math.min(duration_minutes / 60, 1);

  // Apply boosts to each affected dimension
  for (const [dimension, maxBoost] of Object.entries(contributions)) {
    const dimName = dimension as MetaDimensionName;
    const scaledMaxBoost = maxBoost * durationScalar;
    const currentValue = currentDimensions[dimName];
    const newValue = boost(currentValue, performance, scaledMaxBoost);
    const change = newValue - currentValue;

    if (change > 0.001) {  // Only update if meaningful change
      updateMetaDimension(
        studentId,
        dimName,
        change,
        `${subject}_session`
      );
      currentDimensions[dimName] = newValue;
    }
  }

  return currentDimensions;
}

/**
 * Update a specific meta-dimension and record event
 *
 * @param studentId - Student identifier
 * @param dimension - Dimension to update
 * @param change - Delta to apply (can be negative)
 * @param source - What caused this change
 * @returns Updated meta-dimensions
 */
export function updateMetaDimension(
  studentId: string,
  dimension: MetaDimensionName,
  change: number,
  source: string
): MetaDimensions {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Get current value
  const current = getStudentMetaDimensions(studentId)[dimension];
  const newValue = Math.max(0, Math.min(1, current + change));
  const newValueScaled = Math.round(newValue * 100);

  // Update dimension estimate
  db.prepare(`
    INSERT INTO hyro_meta_dimension_estimates (
      id, student_id, dimension_name, score, ci_low, ci_high,
      confidence_level, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, dimension_name) DO UPDATE SET
      score = excluded.score,
      updated_at = excluded.updated_at
  `).run(
    randomUUID(),
    studentId,
    dimension,
    newValueScaled,
    0,  // TODO: Calculate proper confidence intervals
    100,
    'medium',
    now,
    now
  );

  // Record event in state vectors table (reusing existing table)
  // We'll use the evidence_json field to track meta-dimension changes
  const eventId = randomUUID();
  const eventData = {
    id: eventId,
    student_id: studentId,
    dimension,
    change,
    source,
    created_at: now,
  };

  // Store in components_json field of a meta state vector
  db.prepare(`
    INSERT INTO hyro_state_vectors (
      id, student_id, stat_name, coherence, entropy, generativity,
      components_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    studentId,
    'meta_event',  // Special stat_name for meta events
    0, 0, 0,  // Not used for meta events
    JSON.stringify(eventData),
    now,
    now
  );

  return getStudentMetaDimensions(studentId);
}

/**
 * Get meta-dimension change history
 *
 * @param studentId - Student identifier
 * @param dimension - Optional specific dimension to filter
 * @param limit - Maximum number of events to return
 * @returns Array of meta-dimension events
 */
export function getMetaDimensionHistory(
  studentId: string,
  dimension?: MetaDimensionName,
  limit: number = 50
): MetaDimensionEvent[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT components_json
    FROM hyro_state_vectors
    WHERE student_id = ? AND stat_name = 'meta_event'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(studentId, limit) as Array<{ components_json: string }>;

  const events: MetaDimensionEvent[] = [];

  for (const row of rows) {
    try {
      const event = JSON.parse(row.components_json) as MetaDimensionEvent;
      if (!dimension || event.dimension === dimension) {
        events.push(event);
      }
    } catch (e) {
      // Skip malformed events
      continue;
    }
  }

  return events;
}

/**
 * Calculate overall meta-dimension score (0-1)
 * Simple average across all dimensions
 */
export function calculateMetaScore(dimensions: MetaDimensions): number {
  const values = META_DIMENSION_NAMES.map(name => dimensions[name]);
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate manifold movement modifier based on meta-dimensions
 *
 * Meta-dimensions affect how easily a learner can move through the C/E/G space:
 * - High manifold_fluidity = faster state transitions
 * - High entropy_intuition = better handling of confusion state
 * - High gradient_awareness = better metacognitive recovery
 *
 * @param dimensions - Current meta-dimensions
 * @param movement - Intended C/E/G movement
 * @returns Modified movement vector
 */
export function calculateManifoldModifier(
  dimensions: MetaDimensions,
  movement: { coherence: number; entropy: number; generativity: number }
): { coherence: number; entropy: number; generativity: number } {
  // Manifold fluidity amplifies all movement (up to 50% boost)
  const fluidityMultiplier = 1 + (dimensions.manifold_fluidity - 0.5);

  // Gradient awareness helps coherence recovery
  const coherenceBoost = 1 + (dimensions.gradient_awareness - 0.5) * 0.3;

  // Entropy intuition helps manage entropy (stabilizes or amplifies as needed)
  const entropyMultiplier = dimensions.entropy_intuition;

  // Multi-model coherence boosts generativity
  const generativityBoost = 1 + (dimensions.multi_model_coherence - 0.5) * 0.3;

  return {
    coherence: movement.coherence * fluidityMultiplier * coherenceBoost,
    entropy: movement.entropy * fluidityMultiplier * entropyMultiplier,
    generativity: movement.generativity * fluidityMultiplier * generativityBoost,
  };
}

/**
 * Get recommendations for improving weak meta-dimensions
 *
 * Identifies dimensions below threshold and suggests activities
 */
export function getMetaDimensionRecommendations(
  studentId: string
): MetaDimensionRecommendation[] {
  const dimensions = getStudentMetaDimensions(studentId);
  const recommendations: MetaDimensionRecommendation[] = [];

  const activitySuggestions: Record<MetaDimensionName, string[]> = {
    manifold_fluidity: [
      'Try art projects that combine different mediums',
      'Practice coding challenges with multiple solution approaches',
      'Explore cross-domain analogies (e.g., music theory and math)',
    ],
    multi_model_coherence: [
      'Read about the same topic from different perspectives',
      'Practice explaining concepts using different analogies',
      'Work on interdisciplinary projects (e.g., music composition with math)',
    ],
    identity_elasticity: [
      'Try activities outside your comfort zone',
      'Reflect on how your interests have changed over time',
      'Practice improvisation in art, music, or drama',
    ],
    gradient_awareness: [
      'Keep a learning journal tracking progress',
      'Practice metacognitive reflection after study sessions',
      'Set specific learning goals and review them weekly',
    ],
    entropy_intuition: [
      'Work on open-ended creative projects',
      'Practice brainstorming without judging ideas',
      'Experiment with different problem-solving approaches',
    ],
    non_dual_resolution: [
      'Explore philosophical paradoxes and thought experiments',
      'Practice holding opposing viewpoints in debates',
      'Study quantum physics or other non-intuitive topics',
    ],
    cooperative_generativity: [
      'Join group projects or collaborative art/music sessions',
      'Practice pair programming or peer teaching',
      'Participate in team sports or group fitness activities',
    ],
  };

  for (const dimension of META_DIMENSION_NAMES) {
    const value = dimensions[dimension];
    if (value < RECOMMENDATION_THRESHOLD) {
      recommendations.push({
        dimension,
        current: value,
        recommended_activities: activitySuggestions[dimension],
      });
    }
  }

  // Sort by lowest dimensions first
  recommendations.sort((a, b) => a.current - b.current);

  return recommendations;
}

/**
 * Apply decay to unused meta-dimensions (optional maintenance function)
 *
 * Meta-dimensions decay more slowly than skills (90-day half-life).
 * This should be run periodically to model the "use it or lose it" principle.
 *
 * @param studentId - Student identifier
 * @returns Updated meta-dimensions after decay
 */
export function applyMetaDimensionDecay(studentId: string): MetaDimensions {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const dimensions = getStudentMetaDimensions(studentId);
  const history = getMetaDimensionHistory(studentId, undefined, 100);

  // Calculate decay for each dimension based on time since last update
  for (const dimension of META_DIMENSION_NAMES) {
    const lastEvent = history.find(e => e.dimension === dimension);

    if (!lastEvent) continue;

    const daysSinceUpdate = (now - lastEvent.created_at) / 86400;

    if (daysSinceUpdate > META_DECAY_HALF_LIFE_DAYS) {
      // Calculate decay factor using exponential decay
      const decayFactor = Math.exp(
        -Math.LN2 * daysSinceUpdate / META_DECAY_HALF_LIFE_DAYS
      );

      const currentValue = dimensions[dimension];
      const decayedValue = DEFAULT_META_DIMENSIONS[dimension] +
        (currentValue - DEFAULT_META_DIMENSIONS[dimension]) * decayFactor;

      const change = decayedValue - currentValue;

      if (Math.abs(change) > 0.01) {
        updateMetaDimension(studentId, dimension, change, 'decay');
        dimensions[dimension] = decayedValue;
      }
    }
  }

  return dimensions;
}

/**
 * Get student's complete meta-profile
 */
export function getStudentMetaProfile(studentId: string): StudentMetaProfile {
  const dimensions = getStudentMetaDimensions(studentId);
  const history = getMetaDimensionHistory(studentId);
  const lastEvent = history[0];

  return {
    student_id: studentId,
    dimensions,
    history,
    last_updated: lastEvent ? lastEvent.created_at : 0,
  };
}
