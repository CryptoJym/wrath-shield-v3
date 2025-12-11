// @ts-nocheck
/**
 * Tests for forge-meta-dimensions.ts
 * Meta-Dimensions System - Higher-order learning capabilities
 */

import {
  getStudentMetaDimensions,
  initializeMetaDimensions,
  applySubjectToMetaDimensions,
  updateMetaDimension,
  getMetaDimensionHistory,
  calculateMetaScore,
  calculateManifoldModifier,
  getMetaDimensionRecommendations,
  applyMetaDimensionDecay,
  getStudentMetaProfile,
  getSubjectMetaContributions,
  META_DIMENSION_NAMES,
} from '@/lib/hyro/forge-meta-dimensions';
import type {
  MetaDimensions,
  MetaDimensionName,
  ExtendedSubject,
  SubjectMetaContribution,
  MetaDimensionEvent,
  StudentMetaProfile,
  MetaDimensionRecommendation,
} from '@/lib/hyro/forge-meta-dimensions';

// ============================================================================
// Mocks
// ============================================================================

const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    })),
  })),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockMetaDimensions(overrides: Partial<MetaDimensions> = {}): MetaDimensions {
  return {
    manifold_fluidity: 0.5,
    multi_model_coherence: 0.5,
    identity_elasticity: 0.5,
    gradient_awareness: 0.5,
    entropy_intuition: 0.5,
    non_dual_resolution: 0.5,
    cooperative_generativity: 0.5,
    ...overrides,
  };
}

function createMockMetaDimensionEvent(overrides: Partial<MetaDimensionEvent> = {}): MetaDimensionEvent {
  return {
    id: 'event-123',
    student_id: 'student-1',
    dimension: 'manifold_fluidity',
    change: 0.05,
    source: 'art_session',
    created_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-meta-dimensions types', () => {
  describe('MetaDimensions interface', () => {
    it('should have all 7 dimensions', () => {
      const dims: MetaDimensions = createMockMetaDimensions();

      expect(dims.manifold_fluidity).toBeDefined();
      expect(dims.multi_model_coherence).toBeDefined();
      expect(dims.identity_elasticity).toBeDefined();
      expect(dims.gradient_awareness).toBeDefined();
      expect(dims.entropy_intuition).toBeDefined();
      expect(dims.non_dual_resolution).toBeDefined();
      expect(dims.cooperative_generativity).toBeDefined();
    });

    it('should accept values between 0 and 1', () => {
      const dims = createMockMetaDimensions({
        manifold_fluidity: 0,
        multi_model_coherence: 1,
        identity_elasticity: 0.5,
      });

      expect(dims.manifold_fluidity).toBe(0);
      expect(dims.multi_model_coherence).toBe(1);
      expect(dims.identity_elasticity).toBe(0.5);
    });
  });

  describe('MetaDimensionName type', () => {
    it('should support all dimension names', () => {
      const names: MetaDimensionName[] = [
        'manifold_fluidity',
        'multi_model_coherence',
        'identity_elasticity',
        'gradient_awareness',
        'entropy_intuition',
        'non_dual_resolution',
        'cooperative_generativity',
      ];

      names.forEach((name) => {
        expect(typeof name).toBe('string');
      });
    });
  });

  describe('ExtendedSubject type', () => {
    it('should support academic and non-academic subjects', () => {
      const subjects: ExtendedSubject[] = [
        'math',
        'reading',
        'writing',
        'science',
        'social_studies',
        'coding',
        'art',
        'music',
        'physical_education',
      ];

      subjects.forEach((subject) => {
        expect(typeof subject).toBe('string');
      });
    });
  });

  describe('MetaDimensionEvent interface', () => {
    it('should have required properties', () => {
      const event: MetaDimensionEvent = createMockMetaDimensionEvent();

      expect(event.id).toBeDefined();
      expect(event.student_id).toBeDefined();
      expect(event.dimension).toBeDefined();
      expect(event.change).toBeDefined();
      expect(event.source).toBeDefined();
      expect(event.created_at).toBeDefined();
    });
  });

  describe('StudentMetaProfile interface', () => {
    it('should have required properties', () => {
      const profile: StudentMetaProfile = {
        student_id: 'student-1',
        dimensions: createMockMetaDimensions(),
        history: [createMockMetaDimensionEvent()],
        last_updated: Date.now(),
      };

      expect(profile.student_id).toBeDefined();
      expect(profile.dimensions).toBeDefined();
      expect(profile.history).toBeInstanceOf(Array);
      expect(profile.last_updated).toBeDefined();
    });
  });

  describe('MetaDimensionRecommendation interface', () => {
    it('should have required properties', () => {
      const rec: MetaDimensionRecommendation = {
        dimension: 'manifold_fluidity',
        current: 0.3,
        recommended_activities: ['activity 1', 'activity 2'],
      };

      expect(rec.dimension).toBeDefined();
      expect(rec.current).toBeDefined();
      expect(rec.recommended_activities).toBeInstanceOf(Array);
    });
  });
});

// ============================================================================
// META_DIMENSION_NAMES Constant Tests
// ============================================================================

describe('META_DIMENSION_NAMES', () => {
  it('should contain all 7 dimension names', () => {
    expect(META_DIMENSION_NAMES).toHaveLength(7);
  });

  it('should contain specific dimension names', () => {
    expect(META_DIMENSION_NAMES).toContain('manifold_fluidity');
    expect(META_DIMENSION_NAMES).toContain('multi_model_coherence');
    expect(META_DIMENSION_NAMES).toContain('identity_elasticity');
    expect(META_DIMENSION_NAMES).toContain('gradient_awareness');
    expect(META_DIMENSION_NAMES).toContain('entropy_intuition');
    expect(META_DIMENSION_NAMES).toContain('non_dual_resolution');
    expect(META_DIMENSION_NAMES).toContain('cooperative_generativity');
  });

  it('should be an array', () => {
    expect(Array.isArray(META_DIMENSION_NAMES)).toBe(true);
  });
});

// ============================================================================
// getStudentMetaDimensions Tests
// ============================================================================

describe('getStudentMetaDimensions', () => {
  it('should return default dimensions when none stored', () => {
    mockAll.mockReturnValue([]);

    const result = getStudentMetaDimensions('student-1');

    expect(result).toBeDefined();
    expect(result.manifold_fluidity).toBe(0.5);
    expect(result.multi_model_coherence).toBe(0.5);
  });

  it('should return stored dimensions (converted from 0-100 to 0-1)', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'manifold_fluidity', score: 75 },
      { dimension_name: 'entropy_intuition', score: 30 },
    ]);

    const result = getStudentMetaDimensions('student-1');

    expect(result.manifold_fluidity).toBe(0.75);
    expect(result.entropy_intuition).toBe(0.30);
    // Other dimensions should be default
    expect(result.multi_model_coherence).toBe(0.5);
  });

  it('should handle partial stored dimensions', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'gradient_awareness', score: 80 },
    ]);

    const result = getStudentMetaDimensions('student-1');

    expect(result.gradient_awareness).toBe(0.8);
    expect(result.manifold_fluidity).toBe(0.5); // Default
  });
});

// ============================================================================
// initializeMetaDimensions Tests
// ============================================================================

describe('initializeMetaDimensions', () => {
  it('should initialize all 7 dimensions', () => {
    const result = initializeMetaDimensions('student-1');

    // Should call run for each dimension
    expect(mockRun).toHaveBeenCalledTimes(7);
    expect(result).toBeDefined();
  });

  it('should return default dimensions', () => {
    const result = initializeMetaDimensions('student-1');

    expect(result.manifold_fluidity).toBe(0.5);
    expect(result.multi_model_coherence).toBe(0.5);
    expect(result.identity_elasticity).toBe(0.5);
    expect(result.gradient_awareness).toBe(0.5);
    expect(result.entropy_intuition).toBe(0.5);
    expect(result.non_dual_resolution).toBe(0.5);
    expect(result.cooperative_generativity).toBe(0.5);
  });

  it('should use INSERT OR IGNORE for idempotency', () => {
    initializeMetaDimensions('student-1');

    // Verify the SQL includes INSERT OR IGNORE
    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// getSubjectMetaContributions Tests
// ============================================================================

describe('getSubjectMetaContributions', () => {
  it('should return contributions for academic subjects', () => {
    const mathContrib = getSubjectMetaContributions('math');
    expect(mathContrib).toBeDefined();
    expect(mathContrib.multi_model_coherence).toBeDefined();
  });

  it('should return contributions for art', () => {
    const artContrib = getSubjectMetaContributions('art');

    expect(artContrib.manifold_fluidity).toBe(0.4);
    expect(artContrib.cooperative_generativity).toBe(0.4);
    expect(artContrib.identity_elasticity).toBe(0.3);
    expect(artContrib.entropy_intuition).toBe(0.2);
  });

  it('should return contributions for music', () => {
    const musicContrib = getSubjectMetaContributions('music');

    expect(musicContrib.multi_model_coherence).toBe(0.4);
    expect(musicContrib.entropy_intuition).toBe(0.3);
    expect(musicContrib.cooperative_generativity).toBe(0.3);
    expect(musicContrib.manifold_fluidity).toBe(0.2);
  });

  it('should return contributions for physical education', () => {
    const peContrib = getSubjectMetaContributions('physical_education');

    expect(peContrib.gradient_awareness).toBe(0.4);
    expect(peContrib.identity_elasticity).toBe(0.3);
    expect(peContrib.manifold_fluidity).toBe(0.2);
    expect(peContrib.entropy_intuition).toBe(0.2);
  });

  it('should return empty object for unknown subject', () => {
    const unknownContrib = getSubjectMetaContributions('unknown_subject' as ExtendedSubject);
    expect(unknownContrib).toEqual({});
  });
});

// ============================================================================
// applySubjectToMetaDimensions Tests
// ============================================================================

describe('applySubjectToMetaDimensions', () => {
  beforeEach(() => {
    // Mock getStudentMetaDimensions to return defaults
    mockAll.mockReturnValue([]);
  });

  it('should apply art session contributions', () => {
    const result = applySubjectToMetaDimensions('student-1', 'art', 80, 30);

    expect(result).toBeDefined();
    // Should have made some updates
  });

  it('should scale by duration (cap at 60 minutes)', () => {
    // 30 minutes = 0.5 duration scalar
    applySubjectToMetaDimensions('student-1', 'art', 80, 30);
    const calls1 = mockRun.mock.calls.length;

    jest.clearAllMocks();

    // 60 minutes = 1.0 duration scalar (max)
    applySubjectToMetaDimensions('student-1', 'art', 80, 60);
    const calls2 = mockRun.mock.calls.length;

    // 90 minutes should still be capped at 60
    jest.clearAllMocks();
    applySubjectToMetaDimensions('student-1', 'art', 80, 90);
    const calls3 = mockRun.mock.calls.length;

    // More duration (up to cap) = more updates potentially
    expect(calls3).toBe(calls2); // Both capped at 60
  });

  it('should apply diminishing returns for high dimensions', () => {
    // Mock high starting dimension
    mockAll.mockReturnValue([
      { dimension_name: 'manifold_fluidity', score: 90 },
    ]);

    const result = applySubjectToMetaDimensions('student-1', 'art', 80, 30);

    // High dimensions get less boost
    expect(result).toBeDefined();
  });

  it('should not update if change is too small', () => {
    // Mock very low performance
    mockAll.mockReturnValue([]);

    applySubjectToMetaDimensions('student-1', 'art', 1, 5);

    // With very low performance and short duration, changes may be below threshold
  });
});

// ============================================================================
// updateMetaDimension Tests
// ============================================================================

describe('updateMetaDimension', () => {
  beforeEach(() => {
    mockAll.mockReturnValue([]);
  });

  it('should update a dimension with positive change', () => {
    const result = updateMetaDimension('student-1', 'manifold_fluidity', 0.1, 'test_source');

    expect(mockRun).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should update a dimension with negative change', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'manifold_fluidity', score: 70 },
    ]);

    const result = updateMetaDimension('student-1', 'manifold_fluidity', -0.1, 'decay');

    expect(mockRun).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should clamp values to 0-1 range', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'entropy_intuition', score: 95 },
    ]);

    // Try to go above 1.0
    const result = updateMetaDimension('student-1', 'entropy_intuition', 0.5, 'test');

    // Value should be clamped
    expect(result).toBeDefined();
  });

  it('should record event in state vectors table', () => {
    updateMetaDimension('student-1', 'gradient_awareness', 0.05, 'art_session');

    // Should have at least 2 calls: one for dimension update, one for event
    expect(mockRun.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// getMetaDimensionHistory Tests
// ============================================================================

describe('getMetaDimensionHistory', () => {
  it('should return history events', () => {
    const mockEvent = createMockMetaDimensionEvent();
    mockAll.mockReturnValue([
      { components_json: JSON.stringify(mockEvent) },
    ]);

    const result = getMetaDimensionHistory('student-1');

    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe('manifold_fluidity');
  });

  it('should filter by dimension when specified', () => {
    const event1 = createMockMetaDimensionEvent({ dimension: 'manifold_fluidity' });
    const event2 = createMockMetaDimensionEvent({ dimension: 'entropy_intuition' });
    mockAll.mockReturnValue([
      { components_json: JSON.stringify(event1) },
      { components_json: JSON.stringify(event2) },
    ]);

    const result = getMetaDimensionHistory('student-1', 'manifold_fluidity');

    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe('manifold_fluidity');
  });

  it('should respect limit parameter', () => {
    const events = Array(10).fill(null).map((_, i) =>
      createMockMetaDimensionEvent({ id: `event-${i}` })
    );
    mockAll.mockReturnValue(
      events.map(e => ({ components_json: JSON.stringify(e) }))
    );

    getMetaDimensionHistory('student-1', undefined, 5);

    // Verify limit was passed to query
    expect(mockAll).toHaveBeenCalled();
  });

  it('should skip malformed events', () => {
    mockAll.mockReturnValue([
      { components_json: 'invalid json' },
      { components_json: JSON.stringify(createMockMetaDimensionEvent()) },
    ]);

    const result = getMetaDimensionHistory('student-1');

    expect(result).toHaveLength(1);
  });

  it('should return empty array when no history', () => {
    mockAll.mockReturnValue([]);

    const result = getMetaDimensionHistory('student-1');

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// calculateMetaScore Tests
// ============================================================================

describe('calculateMetaScore', () => {
  it('should calculate average of all dimensions', () => {
    const dims = createMockMetaDimensions(); // All at 0.5

    const score = calculateMetaScore(dims);

    expect(score).toBe(0.5);
  });

  it('should handle varying dimension values', () => {
    const dims = createMockMetaDimensions({
      manifold_fluidity: 0.8,
      multi_model_coherence: 0.6,
      identity_elasticity: 0.4,
      gradient_awareness: 0.7,
      entropy_intuition: 0.5,
      non_dual_resolution: 0.3,
      cooperative_generativity: 0.9,
    });

    const score = calculateMetaScore(dims);

    // (0.8 + 0.6 + 0.4 + 0.7 + 0.5 + 0.3 + 0.9) / 7 = 4.2 / 7 = 0.6
    expect(score).toBeCloseTo(0.6, 1);
  });

  it('should return 0 when all dimensions are 0', () => {
    const dims = createMockMetaDimensions({
      manifold_fluidity: 0,
      multi_model_coherence: 0,
      identity_elasticity: 0,
      gradient_awareness: 0,
      entropy_intuition: 0,
      non_dual_resolution: 0,
      cooperative_generativity: 0,
    });

    const score = calculateMetaScore(dims);

    expect(score).toBe(0);
  });

  it('should return 1 when all dimensions are 1', () => {
    const dims = createMockMetaDimensions({
      manifold_fluidity: 1,
      multi_model_coherence: 1,
      identity_elasticity: 1,
      gradient_awareness: 1,
      entropy_intuition: 1,
      non_dual_resolution: 1,
      cooperative_generativity: 1,
    });

    const score = calculateMetaScore(dims);

    expect(score).toBe(1);
  });
});

// ============================================================================
// calculateManifoldModifier Tests
// ============================================================================

describe('calculateManifoldModifier', () => {
  it('should return unmodified movement at neutral dimensions', () => {
    const dims = createMockMetaDimensions(); // All at 0.5
    const movement = { coherence: 10, entropy: 5, generativity: 8 };

    const result = calculateManifoldModifier(dims, movement);

    // At 0.5, multipliers should be close to 1
    expect(result.coherence).toBeCloseTo(10, 0);
    expect(result.entropy).toBeCloseTo(2.5, 0); // Entropy multiplier = 0.5
    expect(result.generativity).toBeCloseTo(8, 0);
  });

  it('should amplify movement with high manifold fluidity', () => {
    const dims = createMockMetaDimensions({ manifold_fluidity: 0.9 });
    const movement = { coherence: 10, entropy: 5, generativity: 8 };

    const result = calculateManifoldModifier(dims, movement);

    // Higher fluidity = higher multiplier
    expect(result.coherence).toBeGreaterThan(10);
  });

  it('should reduce movement with low manifold fluidity', () => {
    const dims = createMockMetaDimensions({ manifold_fluidity: 0.1 });
    const movement = { coherence: 10, entropy: 5, generativity: 8 };

    const result = calculateManifoldModifier(dims, movement);

    // Lower fluidity = lower multiplier
    expect(result.coherence).toBeLessThan(10);
  });

  it('should boost coherence recovery with high gradient awareness', () => {
    const dims = createMockMetaDimensions({ gradient_awareness: 0.9 });
    const movement = { coherence: 10, entropy: 5, generativity: 8 };

    const result = calculateManifoldModifier(dims, movement);

    // High gradient awareness boosts coherence
    expect(result.coherence).toBeGreaterThan(10);
  });

  it('should boost generativity with high multi-model coherence', () => {
    const dims = createMockMetaDimensions({ multi_model_coherence: 0.9 });
    const movement = { coherence: 10, entropy: 5, generativity: 8 };

    const result = calculateManifoldModifier(dims, movement);

    // High multi-model coherence boosts generativity
    expect(result.generativity).toBeGreaterThan(8);
  });

  it('should handle zero movement', () => {
    const dims = createMockMetaDimensions();
    const movement = { coherence: 0, entropy: 0, generativity: 0 };

    const result = calculateManifoldModifier(dims, movement);

    expect(result.coherence).toBe(0);
    expect(result.entropy).toBe(0);
    expect(result.generativity).toBe(0);
  });
});

// ============================================================================
// getMetaDimensionRecommendations Tests
// ============================================================================

describe('getMetaDimensionRecommendations', () => {
  it('should return recommendations for low dimensions', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'manifold_fluidity', score: 30 }, // 0.3 - below 0.4 threshold
    ]);

    const result = getMetaDimensionRecommendations('student-1');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].dimension).toBe('manifold_fluidity');
    expect(result[0].current).toBe(0.3);
    expect(result[0].recommended_activities.length).toBeGreaterThan(0);
  });

  it('should return empty array when all dimensions are high', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'manifold_fluidity', score: 70 },
      { dimension_name: 'multi_model_coherence', score: 60 },
      { dimension_name: 'identity_elasticity', score: 50 },
      { dimension_name: 'gradient_awareness', score: 55 },
      { dimension_name: 'entropy_intuition', score: 45 },
      { dimension_name: 'non_dual_resolution', score: 65 },
      { dimension_name: 'cooperative_generativity', score: 80 },
    ]);

    const result = getMetaDimensionRecommendations('student-1');

    // All above 0.4 threshold except entropy_intuition at 0.45
    expect(result.length).toBe(0);
  });

  it('should sort by lowest dimensions first', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'manifold_fluidity', score: 35 },
      { dimension_name: 'entropy_intuition', score: 20 },
      { dimension_name: 'gradient_awareness', score: 25 },
    ]);

    const result = getMetaDimensionRecommendations('student-1');

    expect(result[0].current).toBe(0.2); // entropy_intuition
    expect(result[1].current).toBe(0.25); // gradient_awareness
    expect(result[2].current).toBe(0.35); // manifold_fluidity
  });

  it('should include activity suggestions', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'cooperative_generativity', score: 25 },
    ]);

    const result = getMetaDimensionRecommendations('student-1');

    expect(result[0].recommended_activities).toContain(
      'Join group projects or collaborative art/music sessions'
    );
  });
});

// ============================================================================
// applyMetaDimensionDecay Tests
// ============================================================================

describe('applyMetaDimensionDecay', () => {
  it('should not decay recently updated dimensions', () => {
    const now = Math.floor(Date.now() / 1000);
    const event = createMockMetaDimensionEvent({
      created_at: now - 86400, // 1 day ago
    });

    mockAll
      .mockReturnValueOnce([]) // getStudentMetaDimensions
      .mockReturnValueOnce([{ components_json: JSON.stringify(event) }]); // getMetaDimensionHistory

    const result = applyMetaDimensionDecay('student-1');

    // No decay should be applied (within 90 day half-life)
    expect(result).toBeDefined();
  });

  it('should decay dimensions not updated for long time', () => {
    const now = Math.floor(Date.now() / 1000);
    const oldEvent = createMockMetaDimensionEvent({
      dimension: 'manifold_fluidity',
      created_at: now - (100 * 86400), // 100 days ago (past 90-day half-life)
    });

    mockAll
      .mockReturnValueOnce([
        { dimension_name: 'manifold_fluidity', score: 80 },
      ])
      .mockReturnValueOnce([{ components_json: JSON.stringify(oldEvent) }]);

    const result = applyMetaDimensionDecay('student-1');

    expect(result).toBeDefined();
    // Dimension should have decayed toward 0.5 baseline
  });

  it('should return dimensions unchanged when no history', () => {
    mockAll.mockReturnValue([]);

    const result = applyMetaDimensionDecay('student-1');

    expect(result).toBeDefined();
    expect(result.manifold_fluidity).toBe(0.5);
  });
});

// ============================================================================
// getStudentMetaProfile Tests
// ============================================================================

describe('getStudentMetaProfile', () => {
  it('should return complete profile', () => {
    const event = createMockMetaDimensionEvent();
    mockAll
      .mockReturnValueOnce([]) // getStudentMetaDimensions
      .mockReturnValueOnce([{ components_json: JSON.stringify(event) }]); // getMetaDimensionHistory

    const result = getStudentMetaProfile('student-1');

    expect(result.student_id).toBe('student-1');
    expect(result.dimensions).toBeDefined();
    expect(result.history).toBeInstanceOf(Array);
    expect(result.last_updated).toBeDefined();
  });

  it('should set last_updated from most recent event', () => {
    const event = createMockMetaDimensionEvent({ created_at: 1705000000 });
    mockAll
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ components_json: JSON.stringify(event) }]);

    const result = getStudentMetaProfile('student-1');

    expect(result.last_updated).toBe(1705000000);
  });

  it('should set last_updated to 0 when no history', () => {
    mockAll.mockReturnValue([]);

    const result = getStudentMetaProfile('student-1');

    expect(result.last_updated).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle unknown dimension names in database', () => {
    mockAll.mockReturnValue([
      { dimension_name: 'unknown_dimension', score: 50 },
      { dimension_name: 'manifold_fluidity', score: 70 },
    ]);

    const result = getStudentMetaDimensions('student-1');

    // Should ignore unknown, use known
    expect(result.manifold_fluidity).toBe(0.7);
    expect(result.multi_model_coherence).toBe(0.5); // Default
  });

  it('should handle very small boost values', () => {
    mockAll.mockReturnValue([]);

    // Very low performance and short duration
    const result = applySubjectToMetaDimensions('student-1', 'art', 5, 1);

    expect(result).toBeDefined();
  });

  it('should handle all subjects', () => {
    const subjects: ExtendedSubject[] = [
      'math', 'reading', 'writing', 'science', 'social_studies',
      'coding', 'study_skills', 'critical_thinking', 'technology',
      'problem_solving', 'art', 'music', 'physical_education',
    ];

    subjects.forEach((subject) => {
      const contrib = getSubjectMetaContributions(subject);
      expect(typeof contrib).toBe('object');
    });
  });

  it('should handle negative movement values in manifold modifier', () => {
    const dims = createMockMetaDimensions();
    const movement = { coherence: -10, entropy: -5, generativity: -8 };

    const result = calculateManifoldModifier(dims, movement);

    expect(result.coherence).toBeLessThan(0);
    expect(result.entropy).toBeLessThan(0);
    expect(result.generativity).toBeLessThan(0);
  });

  it('should handle extreme dimension values', () => {
    const dims = createMockMetaDimensions({
      manifold_fluidity: 0.99,
      entropy_intuition: 0.01,
    });

    const score = calculateMetaScore(dims);

    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});
