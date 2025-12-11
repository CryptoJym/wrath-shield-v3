// @ts-nocheck
/**
 * Tests for forge-knowledge-graph-schema.ts
 * Knowledge graph schema definitions and graph operations
 */

import {
  COLLECTIONS,
  INDEXES,
  generateGraphId,
  createBaseNode,
  createBaseEdge,
  checkPrerequisitesSatisfied,
  computeTransferPotential,
  MISCONCEPTION_DETECTION_THRESHOLD,
  shouldAutoLinkMisconception,
  matchErrorPatterns,
  filterValidAt,
  getTemporalHistory,
} from '@/lib/hyro/forge-knowledge-graph-schema';
import type {
  BaseNode,
  BaseEdge,
  DomainNode,
  ConceptNode,
  MisconceptionNode,
  SessionNode,
  ContentNode,
  GraphNode,
  PrerequisiteEdge,
  FollowupEdge,
  RelatedEdge,
  MisconceptionOfEdge,
  TouchedConceptEdge,
  TeachesConceptEdge,
  GraphEdge,
  PrerequisiteQuery,
  RelatedConceptQuery,
  MisconceptionQuery,
  ValidNextConceptsQuery,
  PrerequisiteGapResult,
  LearningPathResult,
  ErrorPatternMatcher,
} from '@/lib/hyro/forge-knowledge-graph-schema';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-knowledge-graph-schema types', () => {
  describe('BaseNode interface', () => {
    it('should have required properties', () => {
      const node: BaseNode = {
        id: 'node-123',
        label: 'Test Node',
        node_type: 'concept',
        created_at: Date.now(),
        updated_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(node.id).toBeDefined();
      expect(node.label).toBeDefined();
      expect(node.node_type).toBeDefined();
      expect(node.valid_to).toBeNull();
    });
  });

  describe('DomainNode interface', () => {
    it('should have domain-specific properties', () => {
      const domain: DomainNode = {
        id: 'domain-1',
        label: 'Mathematics',
        node_type: 'domain',
        code: 'MATH',
        description: 'Mathematics domain',
        grade_range: { min: 1, max: 12 },
        created_at: Date.now(),
        updated_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(domain.code).toBe('MATH');
      expect(domain.grade_range.min).toBe(1);
      expect(domain.grade_range.max).toBe(12);
    });
  });

  describe('ConceptNode interface', () => {
    it('should have concept-specific properties', () => {
      const concept: ConceptNode = {
        id: 'concept-1',
        label: 'Fractions',
        node_type: 'concept',
        domain_id: 'domain-1',
        path: 'math.arithmetic.fractions',
        difficulty: 50,
        expected_mastery_time_minutes: 30,
        keywords: ['fractions', 'numerator', 'denominator'],
        objectives: ['Understand fraction notation'],
        created_at: Date.now(),
        updated_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(concept.domain_id).toBe('domain-1');
      expect(concept.path).toContain('fractions');
      expect(concept.difficulty).toBe(50);
    });
  });

  describe('MisconceptionNode interface', () => {
    it('should have misconception-specific properties', () => {
      const misconception: MisconceptionNode = {
        id: 'misc-1',
        label: 'Sign Error',
        node_type: 'misconception',
        concept_id: 'concept-1',
        pattern: 'Adding instead of subtracting',
        cause: 'Confusion with operation signs',
        remediation_strategy: 'Practice with sign tracking',
        severity: 'medium',
        created_at: Date.now(),
        updated_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(misconception.concept_id).toBeDefined();
      expect(misconception.severity).toBe('medium');
    });
  });

  describe('SessionNode interface', () => {
    it('should have session-specific properties', () => {
      const session: SessionNode = {
        id: 'session-1',
        label: 'Learning Session',
        node_type: 'session',
        learner_id: 'learner-1',
        duration_seconds: 1800,
        mode: 'practice',
        concepts_touched: ['concept-1', 'concept-2'],
        performance: {
          questions_attempted: 10,
          questions_correct: 8,
          average_time_per_question_ms: 5000,
          hints_used: 2,
        },
        initial_state: { C: 50, E: 40, G: 55 },
        final_state: { C: 60, E: 35, G: 60 },
        created_at: Date.now(),
        updated_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(session.learner_id).toBe('learner-1');
      expect(session.mode).toBe('practice');
      expect(session.performance.questions_correct).toBe(8);
    });
  });

  describe('ContentNode interface', () => {
    it('should have content-specific properties', () => {
      const content: ContentNode = {
        id: 'content-1',
        label: 'Fraction Video',
        node_type: 'content',
        content_type: 'video',
        concept_id: 'concept-1',
        difficulty: 40,
        modality: 'video',
        estimated_time_seconds: 300,
        content_data: { url: 'https://example.com/video' },
        created_at: Date.now(),
        updated_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(content.content_type).toBe('video');
      expect(content.modality).toBe('video');
    });
  });

  describe('Edge types', () => {
    it('should support PrerequisiteEdge', () => {
      const edge: PrerequisiteEdge = {
        id: 'prereq-1',
        edge_type: 'prerequisite_of',
        source_id: 'concept-1',
        target_id: 'concept-2',
        weight: 0.8,
        criticality: 'required',
        min_mastery_threshold: 0.7,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(edge.criticality).toBe('required');
      expect(edge.min_mastery_threshold).toBe(0.7);
    });

    it('should support FollowupEdge', () => {
      const edge: FollowupEdge = {
        id: 'followup-1',
        edge_type: 'followup_to',
        source_id: 'concept-1',
        target_id: 'concept-2',
        weight: 1.0,
        naturalness: 0.9,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(edge.naturalness).toBe(0.9);
    });

    it('should support RelatedEdge', () => {
      const edge: RelatedEdge = {
        id: 'related-1',
        edge_type: 'related_to',
        source_id: 'concept-1',
        target_id: 'concept-3',
        weight: 0.6,
        relationship_type: 'analogy',
        transfer_potential: 0.7,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(edge.relationship_type).toBe('analogy');
      expect(edge.transfer_potential).toBe(0.7);
    });

    it('should support MisconceptionOfEdge', () => {
      const edge: MisconceptionOfEdge = {
        id: 'miscof-1',
        edge_type: 'misconception_of',
        source_id: 'misc-1',
        target_id: 'concept-1',
        weight: 0.5,
        prevalence: 0.3,
        observation_count: 5,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      };

      expect(edge.prevalence).toBe(0.3);
      expect(edge.observation_count).toBe(5);
    });
  });

  describe('Query types', () => {
    it('should support PrerequisiteQuery', () => {
      const query: PrerequisiteQuery = {
        concept_id: 'concept-1',
        include_transitive: true,
        max_depth: 5,
        criticality_filter: 'required',
      };

      expect(query.concept_id).toBeDefined();
    });

    it('should support RelatedConceptQuery', () => {
      const query: RelatedConceptQuery = {
        concept_id: 'concept-1',
        relationship_types: ['analogy', 'application'],
        min_transfer_potential: 0.5,
        max_results: 10,
      };

      expect(query.relationship_types).toContain('analogy');
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('constants', () => {
  describe('COLLECTIONS', () => {
    it('should have all node collections', () => {
      expect(COLLECTIONS.DOMAINS).toBe('hyro_domains');
      expect(COLLECTIONS.CONCEPTS).toBe('hyro_concepts');
      expect(COLLECTIONS.MISCONCEPTIONS).toBe('hyro_misconceptions');
      expect(COLLECTIONS.SESSIONS).toBe('hyro_sessions');
      expect(COLLECTIONS.CONTENT).toBe('hyro_content');
    });

    it('should have all edge collections', () => {
      expect(COLLECTIONS.PREREQUISITES).toBe('hyro_prerequisites');
      expect(COLLECTIONS.FOLLOWUPS).toBe('hyro_followups');
      expect(COLLECTIONS.RELATED).toBe('hyro_related');
      expect(COLLECTIONS.MISCONCEPTION_OF).toBe('hyro_misconception_of');
      expect(COLLECTIONS.TOUCHED_CONCEPT).toBe('hyro_touched_concept');
      expect(COLLECTIONS.TEACHES_CONCEPT).toBe('hyro_teaches_concept');
    });
  });

  describe('INDEXES', () => {
    it('should have concept indexes', () => {
      expect(INDEXES.concept_by_domain).toBeDefined();
      expect(INDEXES.concept_by_path).toBeDefined();
      expect(INDEXES.concept_by_difficulty).toBeDefined();
    });

    it('should have session indexes', () => {
      expect(INDEXES.session_by_learner).toBeDefined();
      expect(INDEXES.session_by_time).toBeDefined();
    });

    it('should have prerequisite indexes', () => {
      expect(INDEXES.prereq_by_source).toBeDefined();
      expect(INDEXES.prereq_by_target).toBeDefined();
    });
  });

  describe('MISCONCEPTION_DETECTION_THRESHOLD', () => {
    it('should be 3 as per spec', () => {
      expect(MISCONCEPTION_DETECTION_THRESHOLD).toBe(3);
    });
  });
});

// ============================================================================
// generateGraphId Tests
// ============================================================================

describe('generateGraphId', () => {
  it('should generate node IDs with n_ prefix', () => {
    const id = generateGraphId('node');
    expect(id.startsWith('n_')).toBe(true);
  });

  it('should generate edge IDs with e_ prefix', () => {
    const id = generateGraphId('edge');
    expect(id.startsWith('e_')).toBe(true);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateGraphId('node'));
    }
    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// createBaseNode Tests
// ============================================================================

describe('createBaseNode', () => {
  it('should create node with required properties', () => {
    const node = createBaseNode('concept', 'Test Concept');

    expect(node.id).toBeDefined();
    expect(node.label).toBe('Test Concept');
    expect(node.node_type).toBe('concept');
    expect(node.created_at).toBeDefined();
    expect(node.updated_at).toBeDefined();
    expect(node.valid_from).toBeDefined();
    expect(node.valid_to).toBeNull();
  });

  it('should include metadata when provided', () => {
    const metadata = { custom_field: 'value' };
    const node = createBaseNode('concept', 'Test', metadata);

    expect(node.metadata).toEqual(metadata);
  });

  it('should set timestamps to current time', () => {
    const before = Math.floor(Date.now() / 1000);
    const node = createBaseNode('concept', 'Test');
    const after = Math.floor(Date.now() / 1000);

    expect(node.created_at).toBeGreaterThanOrEqual(before);
    expect(node.created_at).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// createBaseEdge Tests
// ============================================================================

describe('createBaseEdge', () => {
  it('should create edge with required properties', () => {
    const edge = createBaseEdge('prerequisite_of', 'source-1', 'target-1');

    expect(edge.id).toBeDefined();
    expect(edge.edge_type).toBe('prerequisite_of');
    expect(edge.source_id).toBe('source-1');
    expect(edge.target_id).toBe('target-1');
    expect(edge.weight).toBe(1.0); // Default
    expect(edge.valid_to).toBeNull();
  });

  it('should use custom weight when provided', () => {
    const edge = createBaseEdge('related_to', 'source-1', 'target-1', 0.5);

    expect(edge.weight).toBe(0.5);
  });

  it('should include metadata when provided', () => {
    const metadata = { reason: 'test' };
    const edge = createBaseEdge('related_to', 'source-1', 'target-1', 1.0, metadata);

    expect(edge.metadata).toEqual(metadata);
  });
});

// ============================================================================
// checkPrerequisitesSatisfied Tests
// ============================================================================

describe('checkPrerequisitesSatisfied', () => {
  const createPrereq = (sourceId: string, targetId: string, threshold: number): PrerequisiteEdge => ({
    id: `prereq-${sourceId}-${targetId}`,
    edge_type: 'prerequisite_of',
    source_id: sourceId,
    target_id: targetId,
    weight: 1.0,
    criticality: 'required',
    min_mastery_threshold: threshold,
    created_at: Date.now(),
    valid_from: Date.now(),
    valid_to: null,
  });

  it('should return satisfied when no prerequisites', () => {
    const result = checkPrerequisitesSatisfied('concept-1', [], {});

    expect(result.satisfied).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('should return satisfied when all prerequisites met', () => {
    const prereqs = [createPrereq('prereq-1', 'concept-1', 0.7)];
    const mastery = { 'prereq-1': 0.8 };

    const result = checkPrerequisitesSatisfied('concept-1', prereqs, mastery);

    expect(result.satisfied).toBe(true);
    expect(result.gaps).toHaveLength(0);
  });

  it('should return unsatisfied with gaps when prerequisites not met', () => {
    const prereqs = [createPrereq('prereq-1', 'concept-1', 0.7)];
    const mastery = { 'prereq-1': 0.5 };

    const result = checkPrerequisitesSatisfied('concept-1', prereqs, mastery);

    expect(result.satisfied).toBe(false);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].prereq_id).toBe('prereq-1');
    expect(result.gaps[0].current).toBe(0.5);
    expect(result.gaps[0].required).toBe(0.7);
  });

  it('should handle missing mastery (treat as 0)', () => {
    const prereqs = [createPrereq('prereq-1', 'concept-1', 0.5)];
    const mastery = {}; // No mastery data

    const result = checkPrerequisitesSatisfied('concept-1', prereqs, mastery);

    expect(result.satisfied).toBe(false);
    expect(result.gaps[0].current).toBe(0);
  });

  it('should only check required criticality', () => {
    const prereqs: PrerequisiteEdge[] = [
      { ...createPrereq('prereq-1', 'concept-1', 0.7), criticality: 'recommended' },
    ];
    const mastery = { 'prereq-1': 0.5 }; // Below threshold

    const result = checkPrerequisitesSatisfied('concept-1', prereqs, mastery);

    // Should be satisfied because prereq is only recommended
    expect(result.satisfied).toBe(true);
  });

  it('should ignore prerequisites for different target', () => {
    const prereqs = [createPrereq('prereq-1', 'other-concept', 0.7)];
    const mastery = { 'prereq-1': 0.3 };

    const result = checkPrerequisitesSatisfied('concept-1', prereqs, mastery);

    expect(result.satisfied).toBe(true);
  });
});

// ============================================================================
// computeTransferPotential Tests
// ============================================================================

describe('computeTransferPotential', () => {
  it('should return direct relation transfer potential', () => {
    const relatedEdges: RelatedEdge[] = [
      {
        id: 'rel-1',
        edge_type: 'related_to',
        source_id: 'concept-1',
        target_id: 'concept-2',
        weight: 1.0,
        relationship_type: 'analogy',
        transfer_potential: 0.8,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      },
    ];

    const result = computeTransferPotential('concept-1', 'concept-2', relatedEdges, []);

    expect(result).toBe(0.8);
  });

  it('should work bidirectionally for related edges', () => {
    const relatedEdges: RelatedEdge[] = [
      {
        id: 'rel-1',
        edge_type: 'related_to',
        source_id: 'concept-2',
        target_id: 'concept-1',
        weight: 1.0,
        relationship_type: 'analogy',
        transfer_potential: 0.6,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      },
    ];

    const result = computeTransferPotential('concept-1', 'concept-2', relatedEdges, []);

    expect(result).toBe(0.6);
  });

  it('should compute Jaccard similarity for shared prerequisites', () => {
    const prereqEdges: PrerequisiteEdge[] = [
      {
        id: 'prereq-1',
        edge_type: 'prerequisite_of',
        source_id: 'common-prereq',
        target_id: 'concept-1',
        weight: 1.0,
        criticality: 'required',
        min_mastery_threshold: 0.7,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      },
      {
        id: 'prereq-2',
        edge_type: 'prerequisite_of',
        source_id: 'common-prereq',
        target_id: 'concept-2',
        weight: 1.0,
        criticality: 'required',
        min_mastery_threshold: 0.7,
        created_at: Date.now(),
        valid_from: Date.now(),
        valid_to: null,
      },
    ];

    const result = computeTransferPotential('concept-1', 'concept-2', [], prereqEdges);

    // Both have 1 prereq, both share it = 1/1 = 1.0
    expect(result).toBe(1);
  });

  it('should return 0 when no relation or shared prerequisites', () => {
    const result = computeTransferPotential('concept-1', 'concept-2', [], []);

    expect(result).toBe(0);
  });
});

// ============================================================================
// shouldAutoLinkMisconception Tests
// ============================================================================

describe('shouldAutoLinkMisconception', () => {
  it('should return false when below threshold', () => {
    const result = shouldAutoLinkMisconception('error-pattern', 2);

    expect(result).toBe(false);
  });

  it('should return true when at threshold', () => {
    const result = shouldAutoLinkMisconception('error-pattern', 3);

    expect(result).toBe(true);
  });

  it('should return true when above threshold', () => {
    const result = shouldAutoLinkMisconception('error-pattern', 5);

    expect(result).toBe(true);
  });

  it('should return false if edge already exists', () => {
    const existingEdge: MisconceptionOfEdge = {
      id: 'miscof-1',
      edge_type: 'misconception_of',
      source_id: 'misc-1',
      target_id: 'concept-1',
      weight: 0.5,
      prevalence: 0.3,
      observation_count: 5,
      created_at: Date.now(),
      valid_from: Date.now(),
      valid_to: null, // Still valid
    };

    const result = shouldAutoLinkMisconception('error-pattern', 5, existingEdge);

    expect(result).toBe(false);
  });

  it('should return true if existing edge was invalidated', () => {
    const existingEdge: MisconceptionOfEdge = {
      id: 'miscof-1',
      edge_type: 'misconception_of',
      source_id: 'misc-1',
      target_id: 'concept-1',
      weight: 0.5,
      prevalence: 0.3,
      observation_count: 5,
      created_at: Date.now(),
      valid_from: Date.now(),
      valid_to: Date.now() - 1000, // No longer valid
    };

    const result = shouldAutoLinkMisconception('error-pattern', 5, existingEdge);

    expect(result).toBe(true);
  });
});

// ============================================================================
// matchErrorPatterns Tests
// ============================================================================

describe('matchErrorPatterns', () => {
  const patterns: ErrorPatternMatcher[] = [
    {
      pattern_id: 'sign-error',
      concept_id: 'concept-1',
      regex: /negative/i,
    },
    {
      pattern_id: 'keyword-error',
      concept_id: 'concept-1',
      keywords: ['wrong', 'incorrect'],
    },
    {
      pattern_id: 'off-by-one',
      concept_id: 'concept-1',
      numeric_check: (answer, expected) => Math.abs(answer - expected) === 1,
    },
  ];

  it('should match regex patterns', () => {
    const result = matchErrorPatterns('The answer is negative', '10', 'concept-1', patterns);

    expect(result).toContain('sign-error');
  });

  it('should match keyword patterns', () => {
    const result = matchErrorPatterns('This is wrong', '10', 'concept-1', patterns);

    expect(result).toContain('keyword-error');
  });

  it('should match numeric patterns', () => {
    const result = matchErrorPatterns('11', '10', 'concept-1', patterns);

    expect(result).toContain('off-by-one');
  });

  it('should return empty array when no matches', () => {
    const result = matchErrorPatterns('correct answer', '10', 'concept-1', patterns);

    expect(result).toHaveLength(0);
  });

  it('should ignore patterns for different concept', () => {
    const result = matchErrorPatterns('negative', '10', 'other-concept', patterns);

    expect(result).toHaveLength(0);
  });

  it('should dedupe matched patterns', () => {
    const duplicatePatterns: ErrorPatternMatcher[] = [
      { pattern_id: 'same-error', concept_id: 'concept-1', regex: /error/i },
      { pattern_id: 'same-error', concept_id: 'concept-1', keywords: ['error'] },
    ];

    const result = matchErrorPatterns('error occurred', '', 'concept-1', duplicatePatterns);

    expect(result).toHaveLength(1);
  });
});

// ============================================================================
// filterValidAt Tests
// ============================================================================

describe('filterValidAt', () => {
  const createItem = (validFrom: number, validTo: number | null) => ({
    id: `item-${validFrom}`,
    valid_from: validFrom,
    valid_to: validTo,
  });

  it('should return items valid at timestamp', () => {
    const items = [
      createItem(100, null), // Still valid
      createItem(200, 500), // Valid from 200 to 500
      createItem(600, null), // Starts after timestamp
    ];

    const result = filterValidAt(items, 300);

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toContain('item-100');
    expect(result.map((i) => i.id)).toContain('item-200');
  });

  it('should exclude items that ended before timestamp', () => {
    const items = [createItem(100, 200)];

    const result = filterValidAt(items, 300);

    expect(result).toHaveLength(0);
  });

  it('should exclude items that start after timestamp', () => {
    const items = [createItem(500, null)];

    const result = filterValidAt(items, 300);

    expect(result).toHaveLength(0);
  });

  it('should handle empty array', () => {
    const result = filterValidAt([], 300);

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// getTemporalHistory Tests
// ============================================================================

describe('getTemporalHistory', () => {
  it('should return versions sorted by valid_from', () => {
    const versions = [
      { id: 'n_abc_1', valid_from: 300, valid_to: null },
      { id: 'n_abc_2', valid_from: 100, valid_to: 200 },
      { id: 'n_abc_3', valid_from: 200, valid_to: 300 },
    ];

    const result = getTemporalHistory(versions, 'n_abc');

    expect(result).toHaveLength(3);
    expect(result[0].valid_from).toBe(100);
    expect(result[1].valid_from).toBe(200);
    expect(result[2].valid_from).toBe(300);
  });

  it('should filter by node ID prefix', () => {
    const versions = [
      { id: 'n_abc_1', valid_from: 100, valid_to: null },
      { id: 'n_def_1', valid_from: 100, valid_to: null },
    ];

    const result = getTemporalHistory(versions, 'n_abc');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n_abc_1');
  });

  it('should return empty array when no matches', () => {
    const versions = [{ id: 'n_abc_1', valid_from: 100, valid_to: null }];

    const result = getTemporalHistory(versions, 'n_xyz');

    expect(result).toHaveLength(0);
  });
});
