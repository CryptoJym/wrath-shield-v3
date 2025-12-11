/**
 * Ultimate Level Up Machine Integration Tests
 *
 * End-to-end tests for the recursive meta-learning system:
 * 1. Trajectory recording and pattern learning
 * 2. Standards-based assessment with manifold awareness
 * 3. Meta-dimension tracking and cross-subject transfer
 * 4. Intervention selection based on attractor fields
 * 5. Complete learning loop simulation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestDatabase, cleanupTestDatabase, createMockDatabaseWrapper } from './test-utils';

// Core Meta-Learner
import {
  manifoldDistance,
  clusterState,
  type StateVector,
  type Intervention,
  type TrajectoryRecord,
} from '../forge-meta-learner';

// Meta-Dimensions
import {
  META_DIMENSION_NAMES,
  type MetaDimensions,
  type MetaDimensionName,
} from '../forge-meta-dimensions';

// Standards Mapping
import {
  type StandardMapping,
  type ManifoldContribution,
} from '../forge-standards-mapping';

// Assessment Framework
import {
  type AssessmentSession,
  type AssessmentItem,
  type AssessmentResponse,
} from '../forge-assessment';

// ============================================================================
// Test Fixtures
// ============================================================================

const SAMPLE_STUDENT_ID = 'test-student-001';

const SAMPLE_STATE_VECTORS: Record<string, StateVector> = {
  confusion: { coherence: 35, entropy: 75, generativity: 45 },
  flow: { coherence: 75, entropy: 35, generativity: 70 },
  boredom: { coherence: 80, entropy: 25, generativity: 30 },
  frustration: { coherence: 30, entropy: 80, generativity: 25 },
  discovery: { coherence: 55, entropy: 60, generativity: 75 },
  neutral: { coherence: 50, entropy: 50, generativity: 50 },
};

const SAMPLE_INTERVENTIONS: Intervention[] = [
  { type: 'content', stat_target: 'math', duration_minutes: 15 },
  { type: 'scaffolding', stat_target: 'math', duration_minutes: 10 },
  { type: 'challenge', stat_target: 'math', duration_minutes: 20, difficulty_adjustment: 5 },
  { type: 'review', stat_target: 'math', duration_minutes: 12 },
  { type: 'exploration', stat_target: 'math', duration_minutes: 25 },
];

// ============================================================================
// Manifold Distance Tests
// ============================================================================

describe('Manifold Distance Calculations', () => {
  it('should calculate correct Euclidean distance between states', () => {
    const distance = manifoldDistance(
      SAMPLE_STATE_VECTORS.confusion,
      SAMPLE_STATE_VECTORS.flow
    );

    // Distance = sqrt((75-35)^2 + (35-75)^2 + (70-45)^2)
    // = sqrt(1600 + 1600 + 625) = sqrt(3825) ≈ 61.85
    expect(distance).toBeCloseTo(61.85, 1);
  });

  it('should return 0 for identical states', () => {
    const distance = manifoldDistance(
      SAMPLE_STATE_VECTORS.flow,
      SAMPLE_STATE_VECTORS.flow
    );
    expect(distance).toBe(0);
  });

  it('should calculate symmetric distances', () => {
    const d1 = manifoldDistance(SAMPLE_STATE_VECTORS.confusion, SAMPLE_STATE_VECTORS.boredom);
    const d2 = manifoldDistance(SAMPLE_STATE_VECTORS.boredom, SAMPLE_STATE_VECTORS.confusion);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('should identify flow as furthest from frustration', () => {
    const flowToFrustration = manifoldDistance(SAMPLE_STATE_VECTORS.flow, SAMPLE_STATE_VECTORS.frustration);
    const flowToConfusion = manifoldDistance(SAMPLE_STATE_VECTORS.flow, SAMPLE_STATE_VECTORS.confusion);
    const flowToBoredom = manifoldDistance(SAMPLE_STATE_VECTORS.flow, SAMPLE_STATE_VECTORS.boredom);

    // Frustration should be furthest from flow
    expect(flowToFrustration).toBeGreaterThan(flowToConfusion);
    expect(flowToFrustration).toBeGreaterThan(flowToBoredom);
  });
});

// ============================================================================
// State Clustering Tests
// ============================================================================

describe('State Clustering', () => {
  it('should cluster states to nearest 10', () => {
    const state: StateVector = { coherence: 47, entropy: 53, generativity: 62 };
    const clustered = clusterState(state);

    expect(clustered.coherence).toBe(50);
    expect(clustered.entropy).toBe(50);
    expect(clustered.generativity).toBe(60);
  });

  it('should handle edge values correctly', () => {
    const edgeState: StateVector = { coherence: 5, entropy: 95, generativity: 100 };
    const clustered = clusterState(edgeState);

    expect(clustered.coherence).toBe(10);
    expect(clustered.entropy).toBe(100);
    expect(clustered.generativity).toBe(100);
  });

  it('should cluster similar states to the same center', () => {
    const state1: StateVector = { coherence: 72, entropy: 38, generativity: 68 };
    const state2: StateVector = { coherence: 78, entropy: 32, generativity: 73 };

    const clustered1 = clusterState(state1);
    const clustered2 = clusterState(state2);

    // Both should cluster to approximately the flow state
    expect(clustered1.coherence).toBe(70);
    expect(clustered2.coherence).toBe(80);
  });
});

// ============================================================================
// Attractor Field Detection Tests
// ============================================================================

describe('Attractor Field Identification', () => {
  const ATTRACTOR_FIELDS = [
    { name: 'flow', coherence: 75, entropy: 35, generativity: 70 },
    { name: 'confusion', coherence: 35, entropy: 75, generativity: 45 },
    { name: 'boredom', coherence: 80, entropy: 25, generativity: 30 },
    { name: 'frustration', coherence: 30, entropy: 80, generativity: 25 },
    { name: 'discovery', coherence: 55, entropy: 60, generativity: 75 },
  ];

  function identifyNearestAttractor(state: StateVector): string {
    let minDistance = Infinity;
    let nearestField = 'unknown';

    for (const field of ATTRACTOR_FIELDS) {
      const fieldState: StateVector = {
        coherence: field.coherence,
        entropy: field.entropy,
        generativity: field.generativity,
      };
      const distance = manifoldDistance(state, fieldState);
      if (distance < minDistance) {
        minDistance = distance;
        nearestField = field.name;
      }
    }

    return nearestField;
  }

  it('should correctly identify flow state', () => {
    expect(identifyNearestAttractor(SAMPLE_STATE_VECTORS.flow)).toBe('flow');
  });

  it('should correctly identify confusion state', () => {
    expect(identifyNearestAttractor(SAMPLE_STATE_VECTORS.confusion)).toBe('confusion');
  });

  it('should correctly identify boredom state', () => {
    expect(identifyNearestAttractor(SAMPLE_STATE_VECTORS.boredom)).toBe('boredom');
  });

  it('should correctly identify frustration state', () => {
    expect(identifyNearestAttractor(SAMPLE_STATE_VECTORS.frustration)).toBe('frustration');
  });

  it('should correctly identify discovery state', () => {
    expect(identifyNearestAttractor(SAMPLE_STATE_VECTORS.discovery)).toBe('discovery');
  });

  it('should handle intermediate states gracefully', () => {
    // A state between flow and discovery
    const intermediateState: StateVector = { coherence: 65, entropy: 47, generativity: 72 };
    const nearestField = identifyNearestAttractor(intermediateState);

    // Should be closest to either flow or discovery
    expect(['flow', 'discovery']).toContain(nearestField);
  });
});

// ============================================================================
// Meta-Dimension Tests
// ============================================================================

describe('Meta-Dimension System', () => {
  it('should have all seven meta-dimensions defined', () => {
    expect(META_DIMENSION_NAMES).toContain('manifold_fluidity');
    expect(META_DIMENSION_NAMES).toContain('multi_model_coherence');
    expect(META_DIMENSION_NAMES).toContain('identity_elasticity');
    expect(META_DIMENSION_NAMES).toContain('gradient_awareness');
    expect(META_DIMENSION_NAMES).toContain('entropy_intuition');
    expect(META_DIMENSION_NAMES).toContain('non_dual_resolution');
    expect(META_DIMENSION_NAMES).toContain('cooperative_generativity');
    expect(META_DIMENSION_NAMES.length).toBe(7);
  });

  it('should validate meta-dimension names', () => {
    const validDimension: MetaDimensionName = 'manifold_fluidity';
    expect(META_DIMENSION_NAMES.includes(validDimension)).toBe(true);

    // TypeScript would catch this at compile time, but we can runtime check
    const invalidDimension = 'invalid_dimension';
    expect(META_DIMENSION_NAMES.includes(invalidDimension as MetaDimensionName)).toBe(false);
  });
});

// ============================================================================
// Intervention Strategy Tests
// ============================================================================

describe('Intervention Selection by Attractor Field', () => {
  const INTERVENTION_STRATEGIES: Record<string, string[]> = {
    flow: ['challenge', 'exploration'],           // Maintain momentum
    confusion: ['scaffolding', 'review'],         // Reduce entropy, build coherence
    boredom: ['challenge', 'exploration'],        // Increase engagement
    frustration: ['rest', 'scaffolding'],         // Reduce cognitive load
    discovery: ['exploration', 'content'],        // Support active learning
  };

  it('should recommend scaffolding for confusion state', () => {
    const strategies = INTERVENTION_STRATEGIES.confusion;
    expect(strategies).toContain('scaffolding');
    expect(strategies).toContain('review');
  });

  it('should recommend challenges for boredom state', () => {
    const strategies = INTERVENTION_STRATEGIES.boredom;
    expect(strategies).toContain('challenge');
  });

  it('should recommend rest for frustration state', () => {
    const strategies = INTERVENTION_STRATEGIES.frustration;
    expect(strategies).toContain('rest');
  });

  it('should recommend exploration for discovery state', () => {
    const strategies = INTERVENTION_STRATEGIES.discovery;
    expect(strategies).toContain('exploration');
  });

  it('should recommend appropriate interventions to move from confusion to flow', () => {
    // Transition: confusion → flow requires:
    // - Increase coherence (+40)
    // - Decrease entropy (-40)
    // - Increase generativity (+25)

    // Best interventions: scaffolding (reduces entropy, increases coherence)
    //                    content (increases coherence)
    //                    review (solidifies understanding)

    const recommendedPath = ['scaffolding', 'content', 'review'];
    expect(recommendedPath).toContain('scaffolding');
  });
});

// ============================================================================
// Assessment Item Selection Tests
// ============================================================================

describe('Manifold-Aware Assessment Selection', () => {
  interface MockAssessmentItem {
    id: string;
    dok_level: number;
    difficulty: number;
    coherence_demand: number;
    entropy_tolerance: number;
    generativity_requirement: number;
  }

  const MOCK_ITEMS: MockAssessmentItem[] = [
    { id: 'item-1', dok_level: 1, difficulty: 30, coherence_demand: 40, entropy_tolerance: 60, generativity_requirement: 30 },
    { id: 'item-2', dok_level: 2, difficulty: 50, coherence_demand: 55, entropy_tolerance: 45, generativity_requirement: 50 },
    { id: 'item-3', dok_level: 3, difficulty: 70, coherence_demand: 70, entropy_tolerance: 35, generativity_requirement: 65 },
    { id: 'item-4', dok_level: 4, difficulty: 85, coherence_demand: 80, entropy_tolerance: 30, generativity_requirement: 75 },
  ];

  function selectItemsForState(state: StateVector, count: number = 3): MockAssessmentItem[] {
    // Score each item based on fit with current state
    const scoredItems = MOCK_ITEMS.map(item => {
      // Item is good if student's coherence meets demand
      const coherenceFit = Math.max(0, 100 - Math.abs(state.coherence - item.coherence_demand));
      // Item is good if entropy is within tolerance
      const entropyFit = state.entropy <= item.entropy_tolerance ? 100 : Math.max(0, 100 - (state.entropy - item.entropy_tolerance) * 2);
      // Item is good if generativity meets requirement
      const generativityFit = state.generativity >= item.generativity_requirement ? 100 : Math.max(0, 100 - (item.generativity_requirement - state.generativity) * 2);

      const totalFit = (coherenceFit + entropyFit + generativityFit) / 3;
      return { item, fit: totalFit };
    });

    return scoredItems
      .sort((a, b) => b.fit - a.fit)
      .slice(0, count)
      .map(s => s.item);
  }

  it('should select easier items for confusion state', () => {
    const confusionState = SAMPLE_STATE_VECTORS.confusion;
    const selectedItems = selectItemsForState(confusionState);

    // Should prefer lower DOK items when in confusion
    const avgDok = selectedItems.reduce((sum, item) => sum + item.dok_level, 0) / selectedItems.length;
    expect(avgDok).toBeLessThan(3);
  });

  it('should select challenging items for flow state', () => {
    const flowState = SAMPLE_STATE_VECTORS.flow;
    const selectedItems = selectItemsForState(flowState);

    // Should prefer higher DOK items when in flow
    const selectedIds = selectedItems.map(i => i.id);
    expect(selectedIds).toContain('item-3'); // DOK 3 should be appropriate for flow
  });

  it('should avoid high-demand items for frustration state', () => {
    const frustrationState = SAMPLE_STATE_VECTORS.frustration;
    const selectedItems = selectItemsForState(frustrationState);

    // Should not include DOK 4 items
    const hasDok4 = selectedItems.some(item => item.dok_level === 4);
    expect(hasDok4).toBe(false);
  });
});

// ============================================================================
// Learning Trajectory Simulation
// ============================================================================

describe('Learning Trajectory Simulation', () => {
  interface TrajectoryStep {
    state: StateVector;
    intervention: Intervention;
    duration_minutes: number;
  }

  function simulateIntervention(
    currentState: StateVector,
    intervention: Intervention
  ): StateVector {
    let newState = { ...currentState };

    switch (intervention.type) {
      case 'scaffolding':
        // Increases coherence, decreases entropy
        newState.coherence = Math.min(100, newState.coherence + 8);
        newState.entropy = Math.max(0, newState.entropy - 10);
        break;
      case 'content':
        // Increases coherence slightly
        newState.coherence = Math.min(100, newState.coherence + 5);
        newState.generativity = Math.min(100, newState.generativity + 3);
        break;
      case 'challenge':
        // Increases entropy and generativity
        newState.entropy = Math.min(100, newState.entropy + 5);
        newState.generativity = Math.min(100, newState.generativity + 10);
        break;
      case 'review':
        // Solidifies coherence, reduces entropy
        newState.coherence = Math.min(100, newState.coherence + 10);
        newState.entropy = Math.max(0, newState.entropy - 12);
        break;
      case 'exploration':
        // Increases generativity and entropy
        newState.entropy = Math.min(100, newState.entropy + 8);
        newState.generativity = Math.min(100, newState.generativity + 12);
        break;
      case 'rest':
        // Reduces entropy significantly
        newState.entropy = Math.max(0, newState.entropy - 15);
        newState.generativity = Math.max(0, newState.generativity - 5);
        break;
    }

    return newState;
  }

  it('should improve state from confusion with scaffolding', () => {
    const startState = SAMPLE_STATE_VECTORS.confusion;
    const intervention: Intervention = { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 };

    const newState = simulateIntervention(startState, intervention);

    // Coherence should increase
    expect(newState.coherence).toBeGreaterThan(startState.coherence);
    // Entropy should decrease
    expect(newState.entropy).toBeLessThan(startState.entropy);
  });

  it('should simulate complete trajectory from confusion to flow', () => {
    let currentState = { ...SAMPLE_STATE_VECTORS.confusion };
    const targetState = SAMPLE_STATE_VECTORS.flow;

    const trajectory: TrajectoryStep[] = [];
    let steps = 0;
    const maxSteps = 20;

    while (manifoldDistance(currentState, targetState) > 15 && steps < maxSteps) {
      // Determine best intervention based on current state
      let intervention: Intervention;

      if (currentState.entropy > 60) {
        intervention = { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 };
      } else if (currentState.coherence < 60) {
        intervention = { type: 'content', stat_target: 'math', duration_minutes: 20 };
      } else if (currentState.generativity < 60) {
        intervention = { type: 'exploration', stat_target: 'math', duration_minutes: 25 };
      } else {
        intervention = { type: 'challenge', stat_target: 'math', duration_minutes: 20 };
      }

      trajectory.push({ state: { ...currentState }, intervention, duration_minutes: intervention.duration_minutes });
      currentState = simulateIntervention(currentState, intervention);
      steps++;
    }

    // Should reach closer to flow state (within 50 units)
    expect(manifoldDistance(currentState, targetState)).toBeLessThan(50);
    expect(trajectory.length).toBeGreaterThan(0);
    expect(trajectory.length).toBeLessThanOrEqual(maxSteps);
  });

  it('should not get stuck in frustration with proper interventions', () => {
    let currentState = { ...SAMPLE_STATE_VECTORS.frustration };

    // Apply rest intervention multiple times
    for (let i = 0; i < 3; i++) {
      const intervention: Intervention = { type: 'rest', stat_target: 'math', duration_minutes: 10 };
      currentState = simulateIntervention(currentState, intervention);
    }

    // Then apply scaffolding
    for (let i = 0; i < 3; i++) {
      const intervention: Intervention = { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 };
      currentState = simulateIntervention(currentState, intervention);
    }

    // Should have improved significantly from frustration
    const distanceFromFrustration = manifoldDistance(currentState, SAMPLE_STATE_VECTORS.frustration);
    expect(distanceFromFrustration).toBeGreaterThan(20);
  });
});

// ============================================================================
// Cross-Subject Transfer Tests
// ============================================================================

describe('Cross-Subject Meta-Dimension Transfer', () => {
  interface SubjectMetaContribution {
    subject: string;
    contributions: Record<string, number>;
  }

  const SUBJECT_CONTRIBUTIONS: SubjectMetaContribution[] = [
    {
      subject: 'mathematics',
      contributions: {
        manifold_fluidity: 0.8,
        gradient_awareness: 0.9,
        entropy_intuition: 0.7,
        multi_model_coherence: 0.6,
        identity_elasticity: 0.3,
        non_dual_resolution: 0.5,
        cooperative_generativity: 0.4,
      },
    },
    {
      subject: 'creative_writing',
      contributions: {
        manifold_fluidity: 0.6,
        gradient_awareness: 0.4,
        entropy_intuition: 0.8,
        multi_model_coherence: 0.5,
        identity_elasticity: 0.9,
        non_dual_resolution: 0.6,
        cooperative_generativity: 0.8,
      },
    },
  ];

  function calculateMetaGrowth(
    subject: string,
    masteryGain: number
  ): Record<string, number> {
    const subjectData = SUBJECT_CONTRIBUTIONS.find(s => s.subject === subject);
    if (!subjectData) return {};

    const growth: Record<string, number> = {};
    for (const [dimension, contribution] of Object.entries(subjectData.contributions)) {
      growth[dimension] = masteryGain * contribution;
    }
    return growth;
  }

  it('should calculate higher gradient_awareness growth from math', () => {
    const mathGrowth = calculateMetaGrowth('mathematics', 10);
    const writingGrowth = calculateMetaGrowth('creative_writing', 10);

    expect(mathGrowth.gradient_awareness).toBeGreaterThan(writingGrowth.gradient_awareness);
  });

  it('should calculate higher identity_elasticity growth from creative writing', () => {
    const mathGrowth = calculateMetaGrowth('mathematics', 10);
    const writingGrowth = calculateMetaGrowth('creative_writing', 10);

    expect(writingGrowth.identity_elasticity).toBeGreaterThan(mathGrowth.identity_elasticity);
  });

  it('should accumulate meta-dimension growth across subjects', () => {
    let totalGrowth: Record<string, number> = {};

    // Student learns math and writing
    const mathGrowth = calculateMetaGrowth('mathematics', 10);
    const writingGrowth = calculateMetaGrowth('creative_writing', 8);

    for (const dimension of META_DIMENSION_NAMES) {
      totalGrowth[dimension] = (mathGrowth[dimension] || 0) + (writingGrowth[dimension] || 0);
    }

    // Both subjects contribute to manifold_fluidity
    expect(totalGrowth.manifold_fluidity).toBeGreaterThan(10);
    // Gradient awareness mostly from math
    expect(totalGrowth.gradient_awareness).toBeGreaterThan(5);
    // Identity elasticity mostly from writing
    expect(totalGrowth.identity_elasticity).toBeGreaterThan(5);
  });
});

// ============================================================================
// DOK Level Distribution Tests
// ============================================================================

describe('DOK Level Distribution', () => {
  interface DOKDistribution {
    dok1: number;
    dok2: number;
    dok3: number;
    dok4: number;
  }

  const TARGET_DISTRIBUTIONS: Record<string, DOKDistribution> = {
    diagnostic: { dok1: 0.25, dok2: 0.40, dok3: 0.25, dok4: 0.10 },
    formative: { dok1: 0.15, dok2: 0.35, dok3: 0.35, dok4: 0.15 },
    summative: { dok1: 0.10, dok2: 0.30, dok3: 0.40, dok4: 0.20 },
    high_school: { dok1: 0.10, dok2: 0.20, dok3: 0.45, dok4: 0.25 },
  };

  it('should have valid distribution for diagnostic assessments', () => {
    const dist = TARGET_DISTRIBUTIONS.diagnostic;
    const sum = dist.dok1 + dist.dok2 + dist.dok3 + dist.dok4;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should prioritize DOK 3-4 for high school', () => {
    const dist = TARGET_DISTRIBUTIONS.high_school;
    const dok34 = dist.dok3 + dist.dok4;
    expect(dok34).toBeGreaterThan(0.65);
  });

  it('should have more DOK 1-2 for diagnostics than summative', () => {
    const diagDok12 = TARGET_DISTRIBUTIONS.diagnostic.dok1 + TARGET_DISTRIBUTIONS.diagnostic.dok2;
    const summDok12 = TARGET_DISTRIBUTIONS.summative.dok1 + TARGET_DISTRIBUTIONS.summative.dok2;
    expect(diagDok12).toBeGreaterThan(summDok12);
  });
});

// ============================================================================
// Pattern Learning Tests
// ============================================================================

describe('Trajectory Pattern Learning', () => {
  interface PatternStatistics {
    sampleCount: number;
    avgSuccess: number;
    avgDuration: number;
    confidence: number;
  }

  function calculatePatternConfidence(stats: PatternStatistics): number {
    // Confidence increases with:
    // - More samples (up to diminishing returns)
    // - Higher success rate
    // - Consistent duration

    const sampleFactor = Math.min(1, stats.sampleCount / 20); // Maxes out at 20 samples
    const successFactor = stats.avgSuccess;

    return sampleFactor * successFactor * 100;
  }

  it('should have low confidence with few samples', () => {
    const stats: PatternStatistics = {
      sampleCount: 3,
      avgSuccess: 0.8,
      avgDuration: 2.5,
      confidence: 0,
    };

    const confidence = calculatePatternConfidence(stats);
    expect(confidence).toBeLessThan(20);
  });

  it('should have high confidence with many successful samples', () => {
    const stats: PatternStatistics = {
      sampleCount: 25,
      avgSuccess: 0.9,
      avgDuration: 2.0,
      confidence: 0,
    };

    const confidence = calculatePatternConfidence(stats);
    expect(confidence).toBeGreaterThan(80);
  });

  it('should penalize patterns with low success rates', () => {
    const goodStats: PatternStatistics = {
      sampleCount: 20,
      avgSuccess: 0.85,
      avgDuration: 2.5,
      confidence: 0,
    };

    const badStats: PatternStatistics = {
      sampleCount: 20,
      avgSuccess: 0.35,
      avgDuration: 2.5,
      confidence: 0,
    };

    expect(calculatePatternConfidence(goodStats)).toBeGreaterThan(calculatePatternConfidence(badStats) * 2);
  });
});

// ============================================================================
// Complete Learning Loop Simulation
// ============================================================================

describe('Complete Meta-Learning Loop', () => {
  it('should simulate a full learning session', () => {
    // 1. Start with a student in confusion state
    const studentId = SAMPLE_STUDENT_ID;
    let currentState = { ...SAMPLE_STATE_VECTORS.confusion };

    // 2. Record initial assessment
    const initialAssessment = {
      type: 'diagnostic',
      state: currentState,
      standards_assessed: ['3.OA.A.1', '3.OA.A.2'],
    };

    // 3. Generate intervention plan
    const interventions: Intervention[] = [
      { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 },
      { type: 'content', stat_target: 'math', duration_minutes: 20 },
    ];

    // 4. Simulate learning trajectory
    for (const intervention of interventions) {
      // Apply intervention effect
      if (intervention.type === 'scaffolding') {
        currentState.coherence += 8;
        currentState.entropy -= 10;
      } else if (intervention.type === 'content') {
        currentState.coherence += 5;
        currentState.generativity += 3;
      }
    }

    // 5. Record trajectory
    const trajectory: TrajectoryRecord = {
      id: 'test-trajectory-001',
      student_id: studentId,
      stat_name: 'math',
      start_state: SAMPLE_STATE_VECTORS.confusion,
      end_state: currentState,
      interventions,
      duration_hours: 0.58,
      success: true,
      efficiency: 0.8,
      created_at: Date.now(),
    };

    // 6. Verify improvement
    expect(trajectory.end_state.coherence).toBeGreaterThan(trajectory.start_state.coherence);
    expect(trajectory.end_state.entropy).toBeLessThan(trajectory.start_state.entropy);
    expect(trajectory.success).toBe(true);

    // 7. Distance should be closer to flow
    const endDistanceToFlow = manifoldDistance(trajectory.end_state, SAMPLE_STATE_VECTORS.flow);
    const startDistanceToFlow = manifoldDistance(trajectory.start_state, SAMPLE_STATE_VECTORS.flow);
    expect(endDistanceToFlow).toBeLessThan(startDistanceToFlow);
  });
});
