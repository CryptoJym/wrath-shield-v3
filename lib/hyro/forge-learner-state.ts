/**
 * HYRO FORGE: Learner State Vector & C/E/G Manifold
 *
 * This module defines the canonical learner state representation as specified
 * in HYRO_LEARNING_MANIFOLD_GEOMETRY.md. The state vector captures:
 *
 * - Core 3D control manifold (C/E/G)
 * - Cognitive component subvector
 * - Meta-generative dimensions (7D)
 * - Affective/engagement scalars
 * - Knowledge mastery snapshot
 *
 * The 3D (C, E, G) projection is the control manifold for path decisions.
 * The full latent state informs C/E/G and advanced decisions.
 */

import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/hyro/forge-learner-state');

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Cognitive component subvector - measures specific learning capabilities
 */
export interface CognitiveComponents {
  /** Signal extraction - ability to identify relevant information */
  perception: number; // 0-100

  /** Internal model accuracy - how well their mental model fits observed data */
  model_coherence: number; // 0-100

  /** Zero/few-shot application - ability to apply knowledge in new contexts */
  transfer: number; // 0-100

  /** Usefulness of produced artifacts - quality of student output */
  output_utility: number; // 0-100

  /** Time/effort vs gain - learning efficiency ratio */
  efficiency: number; // 0-100
}

/**
 * Meta-generative dimensions (7D) - higher-order learning capabilities
 * These represent the learner's ability to operate on their own learning process
 */
export interface MetaGenerativeDimensions {
  /** Ability to fluidly navigate and reshape one's own state space */
  manifold_fluidity: number; // 0-100

  /** Coherence across multiple internal models (domain integration) */
  multi_model_coherence: number; // 0-100

  /** Flexibility in self-concept as a learner */
  identity_elasticity: number; // 0-100

  /** Awareness of one's own learning gradients (what's improving/declining) */
  gradient_awareness: number; // 0-100

  /** Intuition for productive vs destructive uncertainty */
  entropy_intuition: number; // 0-100

  /** Ability to hold seemingly contradictory ideas productively */
  non_dual_resolution: number; // 0-100

  /** Capacity to generate value in collaborative contexts */
  cooperative_generativity: number; // 0-100
}

/**
 * Affective/engagement state - emotional and motivational dimensions
 */
export interface AffectState {
  /** Energy/activation level */
  arousal: number; // 0-100, 50 = neutral

  /** Pleasantness/unpleasantness of current state */
  valence: number; // 0-100, 50 = neutral

  /** Stick-with-it-ness - persistence in face of difficulty */
  persistence: number; // 0-100
}

/**
 * Knowledge mastery snapshot - concept ID to mastery estimate mapping
 */
export type MasteryMap = Record<string, number>; // conceptId -> 0-1

/**
 * The complete learner state vector
 * This is the high-dimensional representation of a learner at time t
 */
export interface LearnerState {
  /** Unique learner identifier */
  learner_id: string;

  // -------------------------------------------------------------------------
  // Core 3D Control Manifold (C/E/G)
  // -------------------------------------------------------------------------

  /**
   * Coherence [0-100]
   * Internal consistency of knowledge and predictions.
   * How well the learner's current mental model fits observed data.
   */
  C: number;

  /**
   * Entropy/Stability [0-100]
   * Uncertainty, volatility, and tolerance for novelty.
   * High E can mean productive exploration OR chaotic confusion.
   * E must be interpreted in context with C and G.
   */
  E: number;

  /**
   * Generativity [0-100]
   * Ability to produce novel, useful connections.
   * Explanations, analogies, solutions, creative variations.
   */
  G: number;

  // -------------------------------------------------------------------------
  // Extended State Dimensions
  // -------------------------------------------------------------------------

  /** Cognitive component subvector (5D) */
  components: CognitiveComponents;

  /** Meta-generative dimensions (7D) */
  meta: MetaGenerativeDimensions;

  /** Affective/engagement scalars (3D) */
  affect: AffectState;

  /** Knowledge mastery snapshot - links to knowledge graph */
  mastery: MasteryMap;

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  /** Last update timestamp (Unix seconds) */
  updated_at: number;

  /** Session ID this state belongs to */
  session_id?: string;

  /** Version for optimistic concurrency */
  version: number;
}

// =============================================================================
// ATTRACTOR FIELDS
// =============================================================================

/**
 * Attractor types in the C/E/G manifold
 * These define stable behavioral regimes learners can enter
 */
export type AttractorType =
  | 'flow'        // Optimal learning state, deep engagement
  | 'confusion'   // Fragmented understanding, high uncertainty
  | 'boredom'     // Strong understanding but low challenge
  | 'frustration' // Weak understanding, high challenge
  | 'discovery';  // Active exploration, creative learning

/**
 * Attractor basin definition - centroid in C/E/G space
 */
export interface AttractorBasin {
  type: AttractorType;
  centroid: {
    C: number;
    E: number;
    G: number;
  };
  /** Radius of influence (for soft basin boundaries) */
  radius: number;
  /** Characteristics of this attractor state */
  characteristics: string;
}

/**
 * Canonical attractor basins as defined in the spec
 */
export const ATTRACTOR_BASINS: Record<AttractorType, AttractorBasin> = {
  flow: {
    type: 'flow',
    centroid: { C: 75, E: 35, G: 70 },
    radius: 20,
    characteristics: 'Optimal learning state, deep engagement, challenge matches skill'
  },
  confusion: {
    type: 'confusion',
    centroid: { C: 35, E: 75, G: 45 },
    radius: 18,
    characteristics: 'Fragmented understanding, high uncertainty, needs structure'
  },
  boredom: {
    type: 'boredom',
    centroid: { C: 80, E: 25, G: 30 },
    radius: 15,
    characteristics: 'Strong understanding but low challenge, needs novelty'
  },
  frustration: {
    type: 'frustration',
    centroid: { C: 30, E: 80, G: 25 },
    radius: 18,
    characteristics: 'Weak understanding with high challenge, needs scaffolding'
  },
  discovery: {
    type: 'discovery',
    centroid: { C: 55, E: 60, G: 75 },
    radius: 22,
    characteristics: 'Active exploration, creative learning, high generativity'
  }
};

// =============================================================================
// OBJECTIVE SPACE
// =============================================================================

/**
 * 4D Objective vector for Pareto optimization
 * Content selection optimizes over this space
 */
export interface ObjectiveVector {
  /** Expected knowledge gain from this action */
  learning_gain: number; // 0-1

  /** Expected engagement/motivation effect */
  engagement: number; // 0-1

  /** Time/effort efficiency of this path */
  efficiency: number; // 0-1

  /** Potential for transfer to other domains */
  transfer_potential: number; // 0-1
}

/**
 * Trajectory effect - expected change in C/E/G from an action
 */
export interface TrajectoryEffect {
  delta_C: number; // Expected change in Coherence
  delta_E: number; // Expected change in Entropy
  delta_G: number; // Expected change in Generativity
  confidence: number; // 0-1, how confident we are in this prediction
}

// =============================================================================
// STATE OPERATIONS
// =============================================================================

/**
 * Compute Euclidean distance in C/E/G space
 */
export function distanceCEG(
  state: Pick<LearnerState, 'C' | 'E' | 'G'>,
  target: { C: number; E: number; G: number },
  weights: { C: number; E: number; G: number } = { C: 1, E: 1, G: 1 }
): number {
  const dC = (state.C - target.C) * weights.C;
  const dE = (state.E - target.E) * weights.E;
  const dG = (state.G - target.G) * weights.G;
  return Math.sqrt(dC * dC + dE * dE + dG * dG);
}

/**
 * Find the nearest attractor basin for a given state
 */
export function findNearestAttractor(
  state: Pick<LearnerState, 'C' | 'E' | 'G'>
): { attractor: AttractorType; distance: number; inBasin: boolean } {
  let nearest: AttractorType = 'flow';
  let minDistance = Infinity;

  for (const [type, basin] of Object.entries(ATTRACTOR_BASINS)) {
    const dist = distanceCEG(state, basin.centroid);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = type as AttractorType;
    }
  }

  const basin = ATTRACTOR_BASINS[nearest];
  return {
    attractor: nearest,
    distance: minDistance,
    inBasin: minDistance <= basin.radius
  };
}

/**
 * Compute attractor membership probabilities (soft classification)
 * Uses inverse distance weighting
 */
export function computeAttractorProbabilities(
  state: Pick<LearnerState, 'C' | 'E' | 'G'>
): Record<AttractorType, number> {
  const distances: Record<AttractorType, number> = {} as any;
  let totalInverseDistance = 0;

  for (const [type, basin] of Object.entries(ATTRACTOR_BASINS)) {
    const dist = distanceCEG(state, basin.centroid);
    // Add small epsilon to avoid division by zero
    const invDist = 1 / (dist + 0.001);
    distances[type as AttractorType] = invDist;
    totalInverseDistance += invDist;
  }

  const probabilities: Record<AttractorType, number> = {} as any;
  for (const type of Object.keys(ATTRACTOR_BASINS) as AttractorType[]) {
    probabilities[type] = distances[type] / totalInverseDistance;
  }

  return probabilities;
}

/**
 * Create a default/initial learner state
 */
export function createInitialLearnerState(learnerId: string, sessionId?: string): LearnerState {
  const now = Math.floor(Date.now() / 1000);

  return {
    learner_id: learnerId,

    // Start at a neutral position in C/E/G space
    C: 50,
    E: 50,
    G: 50,

    components: {
      perception: 50,
      model_coherence: 50,
      transfer: 50,
      output_utility: 50,
      efficiency: 50
    },

    meta: {
      manifold_fluidity: 50,
      multi_model_coherence: 50,
      identity_elasticity: 50,
      gradient_awareness: 50,
      entropy_intuition: 50,
      non_dual_resolution: 50,
      cooperative_generativity: 50
    },

    affect: {
      arousal: 50,
      valence: 50,
      persistence: 50
    },

    mastery: {},

    updated_at: now,
    session_id: sessionId,
    version: 1
  };
}

/**
 * Compute the total dimensionality of the state vector
 * 3 (C/E/G) + 5 (components) + 7 (meta) + 3 (affect) = 18 core dimensions
 * Plus mastery map which is variable
 */
export function getStateDimensionality(state: LearnerState): {
  core: number;
  mastery: number;
  total: number;
} {
  const masteryDims = Object.keys(state.mastery).length;
  return {
    core: 18,
    mastery: masteryDims,
    total: 18 + masteryDims
  };
}

/**
 * Flatten state to a numeric vector (for ML/optimization)
 * Does NOT include mastery (variable length)
 */
export function flattenCoreState(state: LearnerState): number[] {
  return [
    state.C,
    state.E,
    state.G,
    state.components.perception,
    state.components.model_coherence,
    state.components.transfer,
    state.components.output_utility,
    state.components.efficiency,
    state.meta.manifold_fluidity,
    state.meta.multi_model_coherence,
    state.meta.identity_elasticity,
    state.meta.gradient_awareness,
    state.meta.entropy_intuition,
    state.meta.non_dual_resolution,
    state.meta.cooperative_generativity,
    state.affect.arousal,
    state.affect.valence,
    state.affect.persistence
  ];
}

/**
 * Validate that a state has valid values (all in 0-100 range for scores)
 */
export function validateLearnerState(state: LearnerState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const checkRange = (value: number, name: string, min = 0, max = 100) => {
    if (value < min || value > max) {
      errors.push(`${name} must be between ${min} and ${max}, got ${value}`);
    }
  };

  checkRange(state.C, 'C');
  checkRange(state.E, 'E');
  checkRange(state.G, 'G');

  checkRange(state.components.perception, 'components.perception');
  checkRange(state.components.model_coherence, 'components.model_coherence');
  checkRange(state.components.transfer, 'components.transfer');
  checkRange(state.components.output_utility, 'components.output_utility');
  checkRange(state.components.efficiency, 'components.efficiency');

  checkRange(state.meta.manifold_fluidity, 'meta.manifold_fluidity');
  checkRange(state.meta.multi_model_coherence, 'meta.multi_model_coherence');
  checkRange(state.meta.identity_elasticity, 'meta.identity_elasticity');
  checkRange(state.meta.gradient_awareness, 'meta.gradient_awareness');
  checkRange(state.meta.entropy_intuition, 'meta.entropy_intuition');
  checkRange(state.meta.non_dual_resolution, 'meta.non_dual_resolution');
  checkRange(state.meta.cooperative_generativity, 'meta.cooperative_generativity');

  checkRange(state.affect.arousal, 'affect.arousal');
  checkRange(state.affect.valence, 'affect.valence');
  checkRange(state.affect.persistence, 'affect.persistence');

  for (const [conceptId, mastery] of Object.entries(state.mastery)) {
    checkRange(mastery, `mastery[${conceptId}]`, 0, 1);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// =============================================================================
// TRAJECTORY HELPERS
// =============================================================================

/**
 * Compute desired state change to move toward an attractor
 */
export function computeAttractorPull(
  state: Pick<LearnerState, 'C' | 'E' | 'G'>,
  targetAttractor: AttractorType,
  strength: number = 0.1
): TrajectoryEffect {
  const basin = ATTRACTOR_BASINS[targetAttractor];

  return {
    delta_C: (basin.centroid.C - state.C) * strength,
    delta_E: (basin.centroid.E - state.E) * strength,
    delta_G: (basin.centroid.G - state.G) * strength,
    confidence: 0.8 // Attractor pulls are relatively predictable
  };
}

/**
 * Blend multiple trajectory effects (e.g., short-term + long-term goals)
 */
export function blendTrajectoryEffects(
  effects: { effect: TrajectoryEffect; weight: number }[]
): TrajectoryEffect {
  let totalWeight = 0;
  let delta_C = 0;
  let delta_E = 0;
  let delta_G = 0;
  let confidence = 0;

  for (const { effect, weight } of effects) {
    delta_C += effect.delta_C * weight;
    delta_E += effect.delta_E * weight;
    delta_G += effect.delta_G * weight;
    confidence += effect.confidence * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { delta_C: 0, delta_E: 0, delta_G: 0, confidence: 0 };
  }

  return {
    delta_C: delta_C / totalWeight,
    delta_E: delta_E / totalWeight,
    delta_G: delta_G / totalWeight,
    confidence: confidence / totalWeight
  };
}

/**
 * Apply a trajectory effect to a state (returns new state, doesn't mutate)
 */
export function applyTrajectoryEffect(
  state: LearnerState,
  effect: TrajectoryEffect
): LearnerState {
  const clamp = (value: number, min = 0, max = 100) =>
    Math.max(min, Math.min(max, value));

  return {
    ...state,
    C: clamp(state.C + effect.delta_C),
    E: clamp(state.E + effect.delta_E),
    G: clamp(state.G + effect.delta_G),
    updated_at: Math.floor(Date.now() / 1000),
    version: state.version + 1
  };
}
