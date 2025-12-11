// @ts-nocheck
/**
 * Tests for forge-learner-state.ts
 * Learner State Vector & C/E/G Manifold
 */

import {
  distanceCEG,
  findNearestAttractor,
  computeAttractorProbabilities,
  createInitialLearnerState,
  getStateDimensionality,
  flattenCoreState,
  validateLearnerState,
  computeAttractorPull,
  blendTrajectoryEffects,
  applyTrajectoryEffect,
  ATTRACTOR_BASINS,
} from '@/lib/hyro/forge-learner-state';
import type {
  CognitiveComponents,
  MetaGenerativeDimensions,
  AffectState,
  LearnerState,
  AttractorBasin,
  AttractorType,
  ObjectiveVector,
  TrajectoryEffect,
  MasteryMap,
} from '@/lib/hyro/forge-learner-state';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockLearnerState(overrides: Partial<LearnerState> = {}): LearnerState {
  return {
    learner_id: 'student-123',
    C: 50,
    E: 50,
    G: 50,
    components: {
      perception: 50,
      model_coherence: 50,
      transfer: 50,
      output_utility: 50,
      efficiency: 50,
    },
    meta: {
      manifold_fluidity: 50,
      multi_model_coherence: 50,
      identity_elasticity: 50,
      gradient_awareness: 50,
      entropy_intuition: 50,
      non_dual_resolution: 50,
      cooperative_generativity: 50,
    },
    affect: {
      arousal: 50,
      valence: 50,
      persistence: 50,
    },
    mastery: {},
    updated_at: Math.floor(Date.now() / 1000),
    version: 1,
    ...overrides,
  };
}

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-learner-state types', () => {
  describe('CognitiveComponents interface', () => {
    it('should have all required properties', () => {
      const components: CognitiveComponents = {
        perception: 60,
        model_coherence: 70,
        transfer: 55,
        output_utility: 65,
        efficiency: 75,
      };

      expect(components.perception).toBeDefined();
      expect(components.model_coherence).toBeDefined();
      expect(components.transfer).toBeDefined();
      expect(components.output_utility).toBeDefined();
      expect(components.efficiency).toBeDefined();
    });
  });

  describe('MetaGenerativeDimensions interface', () => {
    it('should have all 7 dimensions', () => {
      const meta: MetaGenerativeDimensions = {
        manifold_fluidity: 50,
        multi_model_coherence: 50,
        identity_elasticity: 50,
        gradient_awareness: 50,
        entropy_intuition: 50,
        non_dual_resolution: 50,
        cooperative_generativity: 50,
      };

      expect(Object.keys(meta)).toHaveLength(7);
    });
  });

  describe('AffectState interface', () => {
    it('should have arousal, valence, and persistence', () => {
      const affect: AffectState = {
        arousal: 60,
        valence: 55,
        persistence: 70,
      };

      expect(affect.arousal).toBeDefined();
      expect(affect.valence).toBeDefined();
      expect(affect.persistence).toBeDefined();
    });
  });

  describe('LearnerState interface', () => {
    it('should have all required properties', () => {
      const state: LearnerState = createMockLearnerState();

      expect(state.learner_id).toBeDefined();
      expect(state.C).toBeDefined();
      expect(state.E).toBeDefined();
      expect(state.G).toBeDefined();
      expect(state.components).toBeDefined();
      expect(state.meta).toBeDefined();
      expect(state.affect).toBeDefined();
      expect(state.mastery).toBeDefined();
      expect(state.updated_at).toBeDefined();
      expect(state.version).toBeDefined();
    });

    it('should support optional session_id', () => {
      const state: LearnerState = createMockLearnerState({ session_id: 'session-456' });
      expect(state.session_id).toBe('session-456');
    });
  });

  describe('AttractorBasin interface', () => {
    it('should have type, centroid, radius, and characteristics', () => {
      const basin: AttractorBasin = {
        type: 'flow',
        centroid: { C: 75, E: 35, G: 70 },
        radius: 20,
        characteristics: 'Optimal learning state',
      };

      expect(basin.type).toBe('flow');
      expect(basin.centroid.C).toBe(75);
      expect(basin.radius).toBe(20);
    });
  });

  describe('ObjectiveVector interface', () => {
    it('should have 4D objective space', () => {
      const objectives: ObjectiveVector = {
        learning_gain: 0.8,
        engagement: 0.7,
        efficiency: 0.6,
        transfer_potential: 0.5,
      };

      expect(objectives.learning_gain).toBeDefined();
      expect(objectives.engagement).toBeDefined();
      expect(objectives.efficiency).toBeDefined();
      expect(objectives.transfer_potential).toBeDefined();
    });
  });

  describe('TrajectoryEffect interface', () => {
    it('should have delta values and confidence', () => {
      const effect: TrajectoryEffect = {
        delta_C: 5,
        delta_E: -3,
        delta_G: 2,
        confidence: 0.85,
      };

      expect(effect.delta_C).toBe(5);
      expect(effect.delta_E).toBe(-3);
      expect(effect.delta_G).toBe(2);
      expect(effect.confidence).toBe(0.85);
    });
  });
});

// ============================================================================
// ATTRACTOR_BASINS Tests
// ============================================================================

describe('ATTRACTOR_BASINS', () => {
  it('should define all 5 attractor types', () => {
    expect(ATTRACTOR_BASINS.flow).toBeDefined();
    expect(ATTRACTOR_BASINS.confusion).toBeDefined();
    expect(ATTRACTOR_BASINS.boredom).toBeDefined();
    expect(ATTRACTOR_BASINS.frustration).toBeDefined();
    expect(ATTRACTOR_BASINS.discovery).toBeDefined();
  });

  it('should have correct flow attractor centroid', () => {
    expect(ATTRACTOR_BASINS.flow.centroid).toEqual({ C: 75, E: 35, G: 70 });
  });

  it('should have correct confusion attractor centroid', () => {
    expect(ATTRACTOR_BASINS.confusion.centroid).toEqual({ C: 35, E: 75, G: 45 });
  });

  it('should have correct boredom attractor centroid', () => {
    expect(ATTRACTOR_BASINS.boredom.centroid).toEqual({ C: 80, E: 25, G: 30 });
  });

  it('should have correct frustration attractor centroid', () => {
    expect(ATTRACTOR_BASINS.frustration.centroid).toEqual({ C: 30, E: 80, G: 25 });
  });

  it('should have correct discovery attractor centroid', () => {
    expect(ATTRACTOR_BASINS.discovery.centroid).toEqual({ C: 55, E: 60, G: 75 });
  });

  it('should have different radii for each attractor', () => {
    expect(ATTRACTOR_BASINS.flow.radius).toBe(20);
    expect(ATTRACTOR_BASINS.confusion.radius).toBe(18);
    expect(ATTRACTOR_BASINS.boredom.radius).toBe(15);
    expect(ATTRACTOR_BASINS.frustration.radius).toBe(18);
    expect(ATTRACTOR_BASINS.discovery.radius).toBe(22);
  });

  it('should have characteristics for each attractor', () => {
    for (const basin of Object.values(ATTRACTOR_BASINS)) {
      expect(basin.characteristics).toBeDefined();
      expect(basin.characteristics.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// distanceCEG Tests
// ============================================================================

describe('distanceCEG', () => {
  it('should calculate zero distance for identical points', () => {
    const state = { C: 50, E: 50, G: 50 };
    const target = { C: 50, E: 50, G: 50 };

    const distance = distanceCEG(state, target);

    expect(distance).toBe(0);
  });

  it('should calculate correct Euclidean distance', () => {
    const state = { C: 0, E: 0, G: 0 };
    const target = { C: 3, E: 4, G: 0 };

    const distance = distanceCEG(state, target);

    expect(distance).toBe(5); // 3-4-5 triangle
  });

  it('should calculate distance in 3D space', () => {
    const state = { C: 10, E: 20, G: 30 };
    const target = { C: 40, E: 60, G: 30 };

    const distance = distanceCEG(state, target);

    // sqrt((30)^2 + (40)^2 + 0^2) = sqrt(900 + 1600) = sqrt(2500) = 50
    expect(distance).toBe(50);
  });

  it('should apply weights correctly', () => {
    const state = { C: 0, E: 0, G: 0 };
    const target = { C: 10, E: 10, G: 10 };
    const weights = { C: 2, E: 1, G: 1 };

    const distance = distanceCEG(state, target, weights);

    // sqrt((10*2)^2 + (10*1)^2 + (10*1)^2) = sqrt(400 + 100 + 100) = sqrt(600)
    expect(distance).toBeCloseTo(Math.sqrt(600), 5);
  });

  it('should use default weights of 1 when not provided', () => {
    const state = { C: 0, E: 0, G: 0 };
    const target = { C: 10, E: 10, G: 10 };

    const distance = distanceCEG(state, target);

    // sqrt(100 + 100 + 100) = sqrt(300)
    expect(distance).toBeCloseTo(Math.sqrt(300), 5);
  });
});

// ============================================================================
// findNearestAttractor Tests
// ============================================================================

describe('findNearestAttractor', () => {
  it('should find flow attractor when near flow centroid', () => {
    const state = { C: 75, E: 35, G: 70 }; // Exactly at flow centroid

    const result = findNearestAttractor(state);

    expect(result.attractor).toBe('flow');
    expect(result.distance).toBe(0);
    expect(result.inBasin).toBe(true);
  });

  it('should find confusion attractor when near confusion centroid', () => {
    const state = { C: 35, E: 75, G: 45 };

    const result = findNearestAttractor(state);

    expect(result.attractor).toBe('confusion');
    expect(result.distance).toBe(0);
    expect(result.inBasin).toBe(true);
  });

  it('should find boredom attractor when near boredom centroid', () => {
    const state = { C: 80, E: 25, G: 30 };

    const result = findNearestAttractor(state);

    expect(result.attractor).toBe('boredom');
    expect(result.inBasin).toBe(true);
  });

  it('should find frustration attractor when near frustration centroid', () => {
    const state = { C: 30, E: 80, G: 25 };

    const result = findNearestAttractor(state);

    expect(result.attractor).toBe('frustration');
    expect(result.inBasin).toBe(true);
  });

  it('should find discovery attractor when near discovery centroid', () => {
    const state = { C: 55, E: 60, G: 75 };

    const result = findNearestAttractor(state);

    expect(result.attractor).toBe('discovery');
    expect(result.inBasin).toBe(true);
  });

  it('should return inBasin=false when outside attractor radius', () => {
    const state = { C: 0, E: 0, G: 0 }; // Far from all attractors

    const result = findNearestAttractor(state);

    expect(result.inBasin).toBe(false);
    expect(result.distance).toBeGreaterThan(result.attractor === 'discovery' ? 22 : 15);
  });

  it('should return distance from nearest attractor', () => {
    const state = { C: 75, E: 35, G: 70 }; // At flow centroid

    const result = findNearestAttractor(state);

    expect(result.distance).toBe(0);
  });
});

// ============================================================================
// computeAttractorProbabilities Tests
// ============================================================================

describe('computeAttractorProbabilities', () => {
  it('should return probabilities for all attractors', () => {
    const state = { C: 50, E: 50, G: 50 };

    const probs = computeAttractorProbabilities(state);

    expect(probs.flow).toBeDefined();
    expect(probs.confusion).toBeDefined();
    expect(probs.boredom).toBeDefined();
    expect(probs.frustration).toBeDefined();
    expect(probs.discovery).toBeDefined();
  });

  it('should return probabilities that sum to 1', () => {
    const state = { C: 50, E: 50, G: 50 };

    const probs = computeAttractorProbabilities(state);
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);

    expect(sum).toBeCloseTo(1, 5);
  });

  it('should give highest probability to nearest attractor', () => {
    const state = { C: 75, E: 35, G: 70 }; // At flow centroid

    const probs = computeAttractorProbabilities(state);

    expect(probs.flow).toBeGreaterThan(probs.confusion);
    expect(probs.flow).toBeGreaterThan(probs.boredom);
    expect(probs.flow).toBeGreaterThan(probs.frustration);
    expect(probs.flow).toBeGreaterThan(probs.discovery);
  });

  it('should handle state at confusion centroid', () => {
    const state = { C: 35, E: 75, G: 45 };

    const probs = computeAttractorProbabilities(state);

    expect(probs.confusion).toBeGreaterThan(probs.flow);
    expect(probs.confusion).toBeGreaterThan(probs.boredom);
  });

  it('should give more balanced probabilities for neutral state', () => {
    const state = { C: 50, E: 50, G: 50 };

    const probs = computeAttractorProbabilities(state);

    // Discovery is closest to neutral (55, 60, 75)
    expect(probs.discovery).toBeGreaterThan(probs.boredom);
  });

  it('should return all positive probabilities', () => {
    const state = { C: 50, E: 50, G: 50 };

    const probs = computeAttractorProbabilities(state);

    for (const prob of Object.values(probs)) {
      expect(prob).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// createInitialLearnerState Tests
// ============================================================================

describe('createInitialLearnerState', () => {
  it('should create state with given learner ID', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.learner_id).toBe('student-123');
  });

  it('should initialize C/E/G to neutral values', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.C).toBe(50);
    expect(state.E).toBe(50);
    expect(state.G).toBe(50);
  });

  it('should initialize all cognitive components to 50', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.components.perception).toBe(50);
    expect(state.components.model_coherence).toBe(50);
    expect(state.components.transfer).toBe(50);
    expect(state.components.output_utility).toBe(50);
    expect(state.components.efficiency).toBe(50);
  });

  it('should initialize all meta-generative dimensions to 50', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.meta.manifold_fluidity).toBe(50);
    expect(state.meta.multi_model_coherence).toBe(50);
    expect(state.meta.identity_elasticity).toBe(50);
    expect(state.meta.gradient_awareness).toBe(50);
    expect(state.meta.entropy_intuition).toBe(50);
    expect(state.meta.non_dual_resolution).toBe(50);
    expect(state.meta.cooperative_generativity).toBe(50);
  });

  it('should initialize all affect values to 50', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.affect.arousal).toBe(50);
    expect(state.affect.valence).toBe(50);
    expect(state.affect.persistence).toBe(50);
  });

  it('should initialize mastery map as empty', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.mastery).toEqual({});
  });

  it('should set version to 1', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.version).toBe(1);
  });

  it('should set updated_at timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const state = createInitialLearnerState('student-123');
    const after = Math.floor(Date.now() / 1000);

    expect(state.updated_at).toBeGreaterThanOrEqual(before);
    expect(state.updated_at).toBeLessThanOrEqual(after);
  });

  it('should set session_id when provided', () => {
    const state = createInitialLearnerState('student-123', 'session-456');

    expect(state.session_id).toBe('session-456');
  });

  it('should not set session_id when not provided', () => {
    const state = createInitialLearnerState('student-123');

    expect(state.session_id).toBeUndefined();
  });
});

// ============================================================================
// getStateDimensionality Tests
// ============================================================================

describe('getStateDimensionality', () => {
  it('should return core dimensionality of 18', () => {
    const state = createMockLearnerState();

    const dims = getStateDimensionality(state);

    expect(dims.core).toBe(18);
  });

  it('should return mastery dimensionality based on mastery map size', () => {
    const state = createMockLearnerState({
      mastery: {
        concept1: 0.8,
        concept2: 0.6,
        concept3: 0.9,
      },
    });

    const dims = getStateDimensionality(state);

    expect(dims.mastery).toBe(3);
  });

  it('should return zero mastery dimensions for empty mastery map', () => {
    const state = createMockLearnerState({ mastery: {} });

    const dims = getStateDimensionality(state);

    expect(dims.mastery).toBe(0);
  });

  it('should return total as sum of core and mastery', () => {
    const state = createMockLearnerState({
      mastery: {
        concept1: 0.8,
        concept2: 0.6,
      },
    });

    const dims = getStateDimensionality(state);

    expect(dims.total).toBe(18 + 2);
  });
});

// ============================================================================
// flattenCoreState Tests
// ============================================================================

describe('flattenCoreState', () => {
  it('should return array of 18 elements', () => {
    const state = createMockLearnerState();

    const flattened = flattenCoreState(state);

    expect(flattened).toHaveLength(18);
  });

  it('should include C, E, G as first three elements', () => {
    const state = createMockLearnerState({ C: 75, E: 35, G: 70 });

    const flattened = flattenCoreState(state);

    expect(flattened[0]).toBe(75);
    expect(flattened[1]).toBe(35);
    expect(flattened[2]).toBe(70);
  });

  it('should include cognitive components after C/E/G', () => {
    const state = createMockLearnerState({
      components: {
        perception: 60,
        model_coherence: 70,
        transfer: 55,
        output_utility: 65,
        efficiency: 75,
      },
    });

    const flattened = flattenCoreState(state);

    expect(flattened[3]).toBe(60); // perception
    expect(flattened[4]).toBe(70); // model_coherence
    expect(flattened[5]).toBe(55); // transfer
    expect(flattened[6]).toBe(65); // output_utility
    expect(flattened[7]).toBe(75); // efficiency
  });

  it('should include meta dimensions after components', () => {
    const state = createMockLearnerState({
      meta: {
        manifold_fluidity: 61,
        multi_model_coherence: 62,
        identity_elasticity: 63,
        gradient_awareness: 64,
        entropy_intuition: 65,
        non_dual_resolution: 66,
        cooperative_generativity: 67,
      },
    });

    const flattened = flattenCoreState(state);

    expect(flattened[8]).toBe(61);  // manifold_fluidity
    expect(flattened[9]).toBe(62);  // multi_model_coherence
    expect(flattened[10]).toBe(63); // identity_elasticity
    expect(flattened[11]).toBe(64); // gradient_awareness
    expect(flattened[12]).toBe(65); // entropy_intuition
    expect(flattened[13]).toBe(66); // non_dual_resolution
    expect(flattened[14]).toBe(67); // cooperative_generativity
  });

  it('should include affect values as last three elements', () => {
    const state = createMockLearnerState({
      affect: {
        arousal: 80,
        valence: 70,
        persistence: 90,
      },
    });

    const flattened = flattenCoreState(state);

    expect(flattened[15]).toBe(80); // arousal
    expect(flattened[16]).toBe(70); // valence
    expect(flattened[17]).toBe(90); // persistence
  });

  it('should not include mastery map in flattened output', () => {
    const state = createMockLearnerState({
      mastery: { concept1: 0.8, concept2: 0.9 },
    });

    const flattened = flattenCoreState(state);

    expect(flattened).toHaveLength(18); // No change
  });
});

// ============================================================================
// validateLearnerState Tests
// ============================================================================

describe('validateLearnerState', () => {
  it('should return valid for correct state', () => {
    const state = createMockLearnerState();

    const result = validateLearnerState(state);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid C value (above 100)', () => {
    const state = createMockLearnerState({ C: 150 });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('C must be between 0 and 100, got 150');
  });

  it('should detect invalid E value (below 0)', () => {
    const state = createMockLearnerState({ E: -10 });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('E must be between 0 and 100, got -10');
  });

  it('should detect invalid G value', () => {
    const state = createMockLearnerState({ G: 101 });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('G must be between'))).toBe(true);
  });

  it('should detect invalid component values', () => {
    const state = createMockLearnerState({
      components: {
        perception: 150,
        model_coherence: 50,
        transfer: 50,
        output_utility: 50,
        efficiency: 50,
      },
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('components.perception'))).toBe(true);
  });

  it('should detect invalid meta dimension values', () => {
    const state = createMockLearnerState({
      meta: {
        manifold_fluidity: -5,
        multi_model_coherence: 50,
        identity_elasticity: 50,
        gradient_awareness: 50,
        entropy_intuition: 50,
        non_dual_resolution: 50,
        cooperative_generativity: 50,
      },
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('meta.manifold_fluidity'))).toBe(true);
  });

  it('should detect invalid affect values', () => {
    const state = createMockLearnerState({
      affect: {
        arousal: 200,
        valence: 50,
        persistence: 50,
      },
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('affect.arousal'))).toBe(true);
  });

  it('should detect invalid mastery values (above 1)', () => {
    const state = createMockLearnerState({
      mastery: { concept1: 1.5 },
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('mastery[concept1]'))).toBe(true);
  });

  it('should detect invalid mastery values (below 0)', () => {
    const state = createMockLearnerState({
      mastery: { concept1: -0.5 },
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
  });

  it('should allow valid mastery values between 0 and 1', () => {
    const state = createMockLearnerState({
      mastery: { concept1: 0, concept2: 0.5, concept3: 1 },
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(true);
  });

  it('should collect multiple errors', () => {
    const state = createMockLearnerState({
      C: 150,
      E: -10,
      G: 200,
    });

    const result = validateLearnerState(state);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// computeAttractorPull Tests
// ============================================================================

describe('computeAttractorPull', () => {
  it('should return zero deltas when at target attractor', () => {
    const state = { C: 75, E: 35, G: 70 }; // At flow centroid

    const effect = computeAttractorPull(state, 'flow');

    expect(effect.delta_C).toBe(0);
    expect(effect.delta_E).toBe(0);
    expect(effect.delta_G).toBe(0);
  });

  it('should return positive delta_C when below flow C centroid', () => {
    const state = { C: 50, E: 35, G: 70 };

    const effect = computeAttractorPull(state, 'flow');

    expect(effect.delta_C).toBeGreaterThan(0);
  });

  it('should return negative delta_E when above flow E centroid', () => {
    const state = { C: 75, E: 50, G: 70 };

    const effect = computeAttractorPull(state, 'flow');

    expect(effect.delta_E).toBeLessThan(0);
  });

  it('should apply strength factor to deltas', () => {
    const state = { C: 50, E: 50, G: 50 };
    const strength = 0.2;

    const effect = computeAttractorPull(state, 'flow', strength);

    // Flow centroid: C: 75, E: 35, G: 70
    // Delta without strength: C: 25, E: -15, G: 20
    expect(effect.delta_C).toBeCloseTo(25 * 0.2, 5);
    expect(effect.delta_E).toBeCloseTo(-15 * 0.2, 5);
    expect(effect.delta_G).toBeCloseTo(20 * 0.2, 5);
  });

  it('should use default strength of 0.1', () => {
    const state = { C: 50, E: 50, G: 50 };

    const effect = computeAttractorPull(state, 'flow');

    // Delta without strength: C: 25, E: -15, G: 20
    expect(effect.delta_C).toBeCloseTo(25 * 0.1, 5);
  });

  it('should have confidence of 0.8', () => {
    const state = { C: 50, E: 50, G: 50 };

    const effect = computeAttractorPull(state, 'flow');

    expect(effect.confidence).toBe(0.8);
  });

  it('should pull toward confusion attractor', () => {
    const state = { C: 50, E: 50, G: 50 };

    const effect = computeAttractorPull(state, 'confusion');

    // Confusion centroid: C: 35, E: 75, G: 45
    expect(effect.delta_C).toBeLessThan(0); // Pull C down toward 35
    expect(effect.delta_E).toBeGreaterThan(0); // Pull E up toward 75
  });
});

// ============================================================================
// blendTrajectoryEffects Tests
// ============================================================================

describe('blendTrajectoryEffects', () => {
  it('should return zero effect for empty array', () => {
    const result = blendTrajectoryEffects([]);

    expect(result.delta_C).toBe(0);
    expect(result.delta_E).toBe(0);
    expect(result.delta_G).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('should return same effect for single item with weight 1', () => {
    const effect: TrajectoryEffect = {
      delta_C: 10,
      delta_E: -5,
      delta_G: 15,
      confidence: 0.9,
    };

    const result = blendTrajectoryEffects([{ effect, weight: 1 }]);

    expect(result.delta_C).toBe(10);
    expect(result.delta_E).toBe(-5);
    expect(result.delta_G).toBe(15);
    expect(result.confidence).toBe(0.9);
  });

  it('should blend two effects with equal weights', () => {
    const effect1: TrajectoryEffect = {
      delta_C: 10,
      delta_E: 0,
      delta_G: 20,
      confidence: 0.8,
    };
    const effect2: TrajectoryEffect = {
      delta_C: 0,
      delta_E: 10,
      delta_G: 0,
      confidence: 0.6,
    };

    const result = blendTrajectoryEffects([
      { effect: effect1, weight: 1 },
      { effect: effect2, weight: 1 },
    ]);

    expect(result.delta_C).toBe(5);
    expect(result.delta_E).toBe(5);
    expect(result.delta_G).toBe(10);
    expect(result.confidence).toBe(0.7);
  });

  it('should apply weights to blending', () => {
    const effect1: TrajectoryEffect = {
      delta_C: 10,
      delta_E: 10,
      delta_G: 10,
      confidence: 1.0,
    };
    const effect2: TrajectoryEffect = {
      delta_C: 0,
      delta_E: 0,
      delta_G: 0,
      confidence: 0.0,
    };

    // Effect1 has weight 3, effect2 has weight 1
    const result = blendTrajectoryEffects([
      { effect: effect1, weight: 3 },
      { effect: effect2, weight: 1 },
    ]);

    // (10*3 + 0*1) / 4 = 7.5
    expect(result.delta_C).toBe(7.5);
    expect(result.confidence).toBe(0.75);
  });

  it('should handle zero total weight', () => {
    const effect: TrajectoryEffect = {
      delta_C: 10,
      delta_E: 10,
      delta_G: 10,
      confidence: 0.9,
    };

    const result = blendTrajectoryEffects([{ effect, weight: 0 }]);

    expect(result.delta_C).toBe(0);
    expect(result.delta_E).toBe(0);
    expect(result.delta_G).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('should blend multiple effects', () => {
    const effects = [
      { effect: { delta_C: 10, delta_E: 0, delta_G: 0, confidence: 1.0 }, weight: 1 },
      { effect: { delta_C: 0, delta_E: 10, delta_G: 0, confidence: 1.0 }, weight: 1 },
      { effect: { delta_C: 0, delta_E: 0, delta_G: 10, confidence: 1.0 }, weight: 1 },
    ];

    const result = blendTrajectoryEffects(effects);

    expect(result.delta_C).toBeCloseTo(10 / 3, 5);
    expect(result.delta_E).toBeCloseTo(10 / 3, 5);
    expect(result.delta_G).toBeCloseTo(10 / 3, 5);
    expect(result.confidence).toBe(1.0);
  });
});

// ============================================================================
// applyTrajectoryEffect Tests
// ============================================================================

describe('applyTrajectoryEffect', () => {
  it('should apply positive deltas', () => {
    const state = createMockLearnerState({ C: 50, E: 50, G: 50 });
    const effect: TrajectoryEffect = {
      delta_C: 10,
      delta_E: 5,
      delta_G: 15,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.C).toBe(60);
    expect(newState.E).toBe(55);
    expect(newState.G).toBe(65);
  });

  it('should apply negative deltas', () => {
    const state = createMockLearnerState({ C: 50, E: 50, G: 50 });
    const effect: TrajectoryEffect = {
      delta_C: -10,
      delta_E: -5,
      delta_G: -15,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.C).toBe(40);
    expect(newState.E).toBe(45);
    expect(newState.G).toBe(35);
  });

  it('should clamp values at 100', () => {
    const state = createMockLearnerState({ C: 95, E: 95, G: 95 });
    const effect: TrajectoryEffect = {
      delta_C: 20,
      delta_E: 20,
      delta_G: 20,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.C).toBe(100);
    expect(newState.E).toBe(100);
    expect(newState.G).toBe(100);
  });

  it('should clamp values at 0', () => {
    const state = createMockLearnerState({ C: 5, E: 5, G: 5 });
    const effect: TrajectoryEffect = {
      delta_C: -20,
      delta_E: -20,
      delta_G: -20,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.C).toBe(0);
    expect(newState.E).toBe(0);
    expect(newState.G).toBe(0);
  });

  it('should not mutate original state', () => {
    const state = createMockLearnerState({ C: 50, E: 50, G: 50 });
    const effect: TrajectoryEffect = {
      delta_C: 10,
      delta_E: 10,
      delta_G: 10,
      confidence: 0.8,
    };

    applyTrajectoryEffect(state, effect);

    expect(state.C).toBe(50);
    expect(state.E).toBe(50);
    expect(state.G).toBe(50);
  });

  it('should increment version', () => {
    const state = createMockLearnerState({ version: 5 });
    const effect: TrajectoryEffect = {
      delta_C: 0,
      delta_E: 0,
      delta_G: 0,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.version).toBe(6);
  });

  it('should update updated_at timestamp', () => {
    const state = createMockLearnerState({ updated_at: 1000 });
    const effect: TrajectoryEffect = {
      delta_C: 0,
      delta_E: 0,
      delta_G: 0,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.updated_at).toBeGreaterThan(1000);
  });

  it('should preserve other state properties', () => {
    const state = createMockLearnerState({
      learner_id: 'student-999',
      session_id: 'session-123',
      components: {
        perception: 80,
        model_coherence: 70,
        transfer: 60,
        output_utility: 50,
        efficiency: 40,
      },
    });
    const effect: TrajectoryEffect = {
      delta_C: 10,
      delta_E: 5,
      delta_G: -5,
      confidence: 0.8,
    };

    const newState = applyTrajectoryEffect(state, effect);

    expect(newState.learner_id).toBe('student-999');
    expect(newState.session_id).toBe('session-123');
    expect(newState.components.perception).toBe(80);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle boundary values in C/E/G space', () => {
    const state = createMockLearnerState({ C: 0, E: 0, G: 0 });

    const dims = getStateDimensionality(state);
    expect(dims.core).toBe(18);

    const flattened = flattenCoreState(state);
    expect(flattened[0]).toBe(0);
  });

  it('should handle maximum values in C/E/G space', () => {
    const state = createMockLearnerState({ C: 100, E: 100, G: 100 });

    const result = validateLearnerState(state);
    expect(result.valid).toBe(true);
  });

  it('should calculate distance for extreme positions', () => {
    const state = { C: 0, E: 0, G: 0 };
    const target = { C: 100, E: 100, G: 100 };

    const distance = distanceCEG(state, target);

    expect(distance).toBeCloseTo(Math.sqrt(30000), 5);
  });

  it('should handle large mastery maps', () => {
    const mastery: MasteryMap = {};
    for (let i = 0; i < 100; i++) {
      mastery[`concept-${i}`] = Math.random();
    }
    const state = createMockLearnerState({ mastery });

    const dims = getStateDimensionality(state);
    expect(dims.mastery).toBe(100);
    expect(dims.total).toBe(118);
  });

  it('should handle mastery values at boundaries', () => {
    const state = createMockLearnerState({
      mastery: { low: 0, mid: 0.5, high: 1 },
    });

    const result = validateLearnerState(state);
    expect(result.valid).toBe(true);
  });
});
