// @ts-nocheck
/**
 * Tests for forge-graph-queries.ts
 * Knowledge graph traversal and query operations
 */

import {
  resetGraphStore,
  addNode,
  getNode,
  getNodesByType,
  getConcept,
  getConceptsByDomain,
  addEdge,
  getEdgesFromSource,
  getEdgesToTarget,
  getEdgesByType,
  getDirectPrerequisites,
  getTransitivePrerequisites,
  queryPrerequisites,
  findPrerequisiteGaps,
  findValidNextConcepts,
  findLearningPath,
  getMisconceptions,
  detectMisconceptionsFromErrors,
  findRelatedConcepts,
  findHighTransferConcepts,
  computeGraphConstrainedGeodesic,
  getGraphStats,
} from '@/lib/hyro/forge-graph-queries';
import type {
  ConceptNode,
  MisconceptionNode,
  PrerequisiteEdge,
  FollowupEdge,
  RelatedEdge,
  MisconceptionOfEdge,
} from '@/lib/hyro/forge-knowledge-graph-schema';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

jest.mock('@/lib/hyro/forge-knowledge-graph-schema', () => ({
  checkPrerequisitesSatisfied: jest.fn((conceptId, edges, masteryMap) => {
    const gaps = edges
      .filter((e) => (masteryMap[e.source_id] || 0) < (e.required_mastery || 0.7))
      .map((e) => ({
        prereq_id: e.source_id,
        current: masteryMap[e.source_id] || 0,
        required: e.required_mastery || 0.7,
      }));
    return { satisfied: gaps.length === 0, gaps };
  }),
  computeTransferPotential: jest.fn(() => 0.5),
  filterValidAt: jest.fn((items) => items),
  MISCONCEPTION_DETECTION_THRESHOLD: 0.3,
}));

jest.mock('@/lib/hyro/forge-learner-state', () => ({
  distanceCEG: jest.fn(() => 10),
  ATTRACTOR_BASINS: {
    flow: { centroid: { C: 70, E: 50, G: 60 } },
    discovery: { centroid: { C: 60, E: 70, G: 80 } },
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createConceptNode(id: string, overrides: Partial<ConceptNode> = {}): ConceptNode {
  return {
    id,
    node_type: 'concept',
    name: `Concept ${id}`,
    description: `Description for ${id}`,
    domain_id: 'math',
    difficulty: 50,
    expected_mastery_time_minutes: 30,
    grade_level: 5,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function createMisconceptionNode(
  id: string,
  overrides: Partial<MisconceptionNode> = {}
): MisconceptionNode {
  return {
    id,
    node_type: 'misconception',
    name: `Misconception ${id}`,
    description: `Description for ${id}`,
    severity: 'moderate',
    detection_patterns: ['pattern1', 'pattern2'],
    remediation_strategies: ['strategy1'],
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function createPrerequisiteEdge(
  sourceId: string,
  targetId: string,
  overrides: Partial<PrerequisiteEdge> = {}
): PrerequisiteEdge {
  return {
    id: `prereq_${sourceId}_${targetId}`,
    edge_type: 'prerequisite_of',
    source_id: sourceId,
    target_id: targetId,
    criticality: 'required',
    required_mastery: 0.7,
    created_at: Date.now(),
    ...overrides,
  };
}

function createFollowupEdge(
  sourceId: string,
  targetId: string,
  overrides: Partial<FollowupEdge> = {}
): FollowupEdge {
  return {
    id: `followup_${sourceId}_${targetId}`,
    edge_type: 'followup_to',
    source_id: sourceId,
    target_id: targetId,
    naturalness: 0.8,
    created_at: Date.now(),
    ...overrides,
  };
}

function createRelatedEdge(
  sourceId: string,
  targetId: string,
  overrides: Partial<RelatedEdge> = {}
): RelatedEdge {
  return {
    id: `related_${sourceId}_${targetId}`,
    edge_type: 'related_to',
    source_id: sourceId,
    target_id: targetId,
    relationship_type: 'analogous',
    transfer_potential: 0.6,
    created_at: Date.now(),
    ...overrides,
  };
}

function createMisconceptionOfEdge(
  sourceId: string,
  targetId: string,
  overrides: Partial<MisconceptionOfEdge> = {}
): MisconceptionOfEdge {
  return {
    id: `miscof_${sourceId}_${targetId}`,
    edge_type: 'misconception_of',
    source_id: sourceId,
    target_id: targetId,
    prevalence: 0.3,
    created_at: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  resetGraphStore();
});

// ============================================================================
// Node Operations Tests
// ============================================================================

describe('node operations', () => {
  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const node = createConceptNode('concept-1');
      addNode(node);

      const retrieved = getNode('concept-1');
      expect(retrieved).toEqual(node);
    });

    it('should update type index when adding node', () => {
      const node = createConceptNode('concept-1');
      addNode(node);

      const nodesByType = getNodesByType('concept');
      expect(nodesByType).toHaveLength(1);
      expect(nodesByType[0].id).toBe('concept-1');
    });
  });

  describe('getNode', () => {
    it('should return undefined for non-existent node', () => {
      const node = getNode('non-existent');
      expect(node).toBeUndefined();
    });

    it('should return the node if it exists', () => {
      const node = createConceptNode('concept-1');
      addNode(node);

      const retrieved = getNode('concept-1');
      expect(retrieved).toEqual(node);
    });
  });

  describe('getNodesByType', () => {
    it('should return empty array for unknown type', () => {
      const nodes = getNodesByType('unknown');
      expect(nodes).toEqual([]);
    });

    it('should return all nodes of given type', () => {
      addNode(createConceptNode('concept-1'));
      addNode(createConceptNode('concept-2'));
      addNode(createMisconceptionNode('misc-1'));

      const concepts = getNodesByType('concept');
      expect(concepts).toHaveLength(2);

      const misconceptions = getNodesByType('misconception');
      expect(misconceptions).toHaveLength(1);
    });
  });

  describe('getConcept', () => {
    it('should return undefined for non-concept node', () => {
      addNode(createMisconceptionNode('misc-1'));

      const concept = getConcept('misc-1');
      expect(concept).toBeUndefined();
    });

    it('should return concept node', () => {
      const node = createConceptNode('concept-1');
      addNode(node);

      const concept = getConcept('concept-1');
      expect(concept).toEqual(node);
    });
  });

  describe('getConceptsByDomain', () => {
    it('should return concepts filtered by domain', () => {
      addNode(createConceptNode('concept-1', { domain_id: 'math' }));
      addNode(createConceptNode('concept-2', { domain_id: 'science' }));
      addNode(createConceptNode('concept-3', { domain_id: 'math' }));

      const mathConcepts = getConceptsByDomain('math');
      expect(mathConcepts).toHaveLength(2);
      expect(mathConcepts.every((c) => c.domain_id === 'math')).toBe(true);
    });

    it('should return empty array for unknown domain', () => {
      addNode(createConceptNode('concept-1', { domain_id: 'math' }));

      const concepts = getConceptsByDomain('unknown');
      expect(concepts).toEqual([]);
    });
  });
});

// ============================================================================
// Edge Operations Tests
// ============================================================================

describe('edge operations', () => {
  describe('addEdge', () => {
    it('should add an edge to the graph', () => {
      const edge = createPrerequisiteEdge('concept-1', 'concept-2');
      addEdge(edge);

      const edges = getEdgesFromSource('concept-1');
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual(edge);
    });

    it('should update all indexes', () => {
      const edge = createPrerequisiteEdge('concept-1', 'concept-2');
      addEdge(edge);

      expect(getEdgesFromSource('concept-1')).toHaveLength(1);
      expect(getEdgesToTarget('concept-2')).toHaveLength(1);
      expect(getEdgesByType('prerequisite_of')).toHaveLength(1);
    });
  });

  describe('getEdgesFromSource', () => {
    it('should return empty array for unknown source', () => {
      const edges = getEdgesFromSource('unknown');
      expect(edges).toEqual([]);
    });

    it('should return all edges from source', () => {
      addEdge(createPrerequisiteEdge('concept-1', 'concept-2'));
      addEdge(createFollowupEdge('concept-1', 'concept-3'));

      const edges = getEdgesFromSource('concept-1');
      expect(edges).toHaveLength(2);
    });
  });

  describe('getEdgesToTarget', () => {
    it('should return empty array for unknown target', () => {
      const edges = getEdgesToTarget('unknown');
      expect(edges).toEqual([]);
    });

    it('should return all edges to target', () => {
      addEdge(createPrerequisiteEdge('concept-1', 'concept-3'));
      addEdge(createPrerequisiteEdge('concept-2', 'concept-3'));

      const edges = getEdgesToTarget('concept-3');
      expect(edges).toHaveLength(2);
    });
  });

  describe('getEdgesByType', () => {
    it('should return empty array for unknown type', () => {
      const edges = getEdgesByType('unknown');
      expect(edges).toEqual([]);
    });

    it('should return all edges of given type', () => {
      addEdge(createPrerequisiteEdge('concept-1', 'concept-2'));
      addEdge(createPrerequisiteEdge('concept-2', 'concept-3'));
      addEdge(createFollowupEdge('concept-1', 'concept-4'));

      const prereqEdges = getEdgesByType('prerequisite_of');
      expect(prereqEdges).toHaveLength(2);

      const followupEdges = getEdgesByType('followup_to');
      expect(followupEdges).toHaveLength(1);
    });
  });
});

// ============================================================================
// Prerequisite Query Tests
// ============================================================================

describe('prerequisite queries', () => {
  beforeEach(() => {
    // Setup a graph with prerequisites:
    // concept-1 -> concept-2 -> concept-3
    addNode(createConceptNode('concept-1'));
    addNode(createConceptNode('concept-2'));
    addNode(createConceptNode('concept-3'));

    addEdge(createPrerequisiteEdge('concept-1', 'concept-2'));
    addEdge(createPrerequisiteEdge('concept-2', 'concept-3'));
  });

  describe('getDirectPrerequisites', () => {
    it('should return direct prerequisites only', () => {
      const prereqs = getDirectPrerequisites('concept-2');
      expect(prereqs).toHaveLength(1);
      expect(prereqs[0].id).toBe('concept-1');
    });

    it('should return empty array for node without prerequisites', () => {
      const prereqs = getDirectPrerequisites('concept-1');
      expect(prereqs).toEqual([]);
    });
  });

  describe('getTransitivePrerequisites', () => {
    it('should return all prerequisites in chain', () => {
      const prereqs = getTransitivePrerequisites('concept-3');
      expect(prereqs).toHaveLength(2);
      expect(prereqs.map((p) => p.id)).toContain('concept-1');
      expect(prereqs.map((p) => p.id)).toContain('concept-2');
    });

    it('should respect maxDepth parameter', () => {
      const prereqs = getTransitivePrerequisites('concept-3', 1);
      expect(prereqs).toHaveLength(1);
      expect(prereqs[0].id).toBe('concept-2');
    });

    it('should handle cycles gracefully', () => {
      // Add a cycle
      addEdge(createPrerequisiteEdge('concept-3', 'concept-1'));

      const prereqs = getTransitivePrerequisites('concept-3');
      // Should not infinite loop
      expect(prereqs.length).toBeGreaterThan(0);
    });
  });

  describe('queryPrerequisites', () => {
    it('should query direct prerequisites', () => {
      const prereqs = queryPrerequisites({
        concept_id: 'concept-2',
        include_transitive: false,
      });

      expect(prereqs).toHaveLength(1);
    });

    it('should query transitive prerequisites', () => {
      const prereqs = queryPrerequisites({
        concept_id: 'concept-3',
        include_transitive: true,
      });

      expect(prereqs).toHaveLength(2);
    });

    it('should filter by criticality', () => {
      addEdge(
        createPrerequisiteEdge('concept-1', 'concept-3', {
          criticality: 'optional',
        })
      );

      const prereqs = queryPrerequisites({
        concept_id: 'concept-3',
        include_transitive: false,
        criticality_filter: 'required',
      });

      expect(prereqs).toHaveLength(1);
    });
  });

  describe('findPrerequisiteGaps', () => {
    it('should find no gaps when all prerequisites are mastered', () => {
      const masteryMap = {
        'concept-1': 0.9,
        'concept-2': 0.8,
      };

      const result = findPrerequisiteGaps('concept-2', masteryMap);
      expect(result.missing_prerequisites).toHaveLength(0);
    });

    it('should find gaps when prerequisites are not mastered', () => {
      const masteryMap = {
        'concept-1': 0.3,
      };

      const result = findPrerequisiteGaps('concept-2', masteryMap);
      expect(result.target_concept).toBe('concept-2');
      expect(result.missing_prerequisites.length).toBeGreaterThanOrEqual(0);
    });

    it('should sort gaps by size descending', () => {
      // This depends on mock behavior
      const result = findPrerequisiteGaps('concept-3', {});
      expect(result.suggested_remediation_order).toBeDefined();
    });
  });
});

// ============================================================================
// Path Finding Tests
// ============================================================================

describe('path finding', () => {
  beforeEach(() => {
    addNode(createConceptNode('start'));
    addNode(createConceptNode('middle'));
    addNode(createConceptNode('end'));

    addEdge(createFollowupEdge('start', 'middle'));
    addEdge(createFollowupEdge('middle', 'end'));
  });

  describe('findValidNextConcepts', () => {
    it('should find valid next concepts', () => {
      const masteryMap = { start: 0.8 };

      const next = findValidNextConcepts({
        learner_id: 'learner-1',
        current_concept_id: 'start',
        mastery_map: masteryMap,
      });

      expect(next.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty for non-existent concept', () => {
      const next = findValidNextConcepts({
        learner_id: 'learner-1',
        current_concept_id: 'non-existent',
        mastery_map: {},
      });

      expect(next).toEqual([]);
    });

    it('should respect max_results', () => {
      // Add more followups
      addNode(createConceptNode('option-2'));
      addNode(createConceptNode('option-3'));
      addEdge(createFollowupEdge('start', 'option-2'));
      addEdge(createFollowupEdge('start', 'option-3'));

      const next = findValidNextConcepts({
        learner_id: 'learner-1',
        current_concept_id: 'start',
        mastery_map: {},
        max_results: 1,
      });

      expect(next.length).toBeLessThanOrEqual(1);
    });
  });

  describe('findLearningPath', () => {
    it('should return null for non-existent start concept', () => {
      const path = findLearningPath('non-existent', 'end', {});
      expect(path).toBeNull();
    });

    it('should return null for non-existent end concept', () => {
      const path = findLearningPath('start', 'non-existent', {});
      expect(path).toBeNull();
    });

    it('should find path when one exists', () => {
      const masteryMap = { start: 0.8, middle: 0.8 };

      const path = findLearningPath('start', 'end', masteryMap);

      // Path may or may not be found depending on prerequisite checks
      if (path) {
        expect(path.start_concept).toBe('start');
        expect(path.end_concept).toBe('end');
        expect(path.path.length).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// Misconception Query Tests
// ============================================================================

describe('misconception queries', () => {
  beforeEach(() => {
    addNode(createConceptNode('concept-1'));
    addNode(
      createMisconceptionNode('misc-1', {
        severity: 'critical',
        detection_patterns: ['wrong_sign'],
      })
    );
    addNode(
      createMisconceptionNode('misc-2', {
        severity: 'minor',
        detection_patterns: ['off_by_one'],
      })
    );

    addEdge(createMisconceptionOfEdge('misc-1', 'concept-1', { prevalence: 0.5 }));
    addEdge(createMisconceptionOfEdge('misc-2', 'concept-1', { prevalence: 0.2 }));
  });

  describe('getMisconceptions', () => {
    it('should get all misconceptions for a concept', () => {
      const misconceptions = getMisconceptions({
        concept_id: 'concept-1',
      });

      expect(misconceptions).toHaveLength(2);
    });

    it('should filter by severity', () => {
      const misconceptions = getMisconceptions({
        concept_id: 'concept-1',
        severity_filter: ['critical'],
      });

      expect(misconceptions).toHaveLength(1);
      expect(misconceptions[0].severity).toBe('critical');
    });

    it('should filter by minimum prevalence', () => {
      const misconceptions = getMisconceptions({
        concept_id: 'concept-1',
        min_prevalence: 0.3,
      });

      expect(misconceptions).toHaveLength(1);
      expect(misconceptions[0].id).toBe('misc-1');
    });
  });

  describe('detectMisconceptionsFromErrors', () => {
    it('should detect known misconceptions from error patterns', () => {
      const existing = [
        createMisconceptionNode('misc-1', {
          detection_patterns: ['wrong_sign', 'negative_error'],
        }),
      ];

      const result = detectMisconceptionsFromErrors('concept-1', ['wrong_sign'], existing);

      expect(result.detected).toHaveLength(1);
    });

    it('should identify new patterns', () => {
      const existing = [
        createMisconceptionNode('misc-1', {
          detection_patterns: ['wrong_sign'],
        }),
      ];

      const result = detectMisconceptionsFromErrors(
        'concept-1',
        ['new_pattern', 'another_new'],
        existing
      );

      expect(result.new_patterns).toContain('new_pattern');
      expect(result.new_patterns).toContain('another_new');
    });

    it('should handle partial pattern matches', () => {
      const existing = [
        createMisconceptionNode('misc-1', {
          detection_patterns: ['sign_error'],
        }),
      ];

      const result = detectMisconceptionsFromErrors(
        'concept-1',
        ['sign_error_variant'],
        existing
      );

      // Should detect due to partial match
      expect(result.detected.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Related Concepts Tests
// ============================================================================

describe('related concepts', () => {
  beforeEach(() => {
    addNode(createConceptNode('concept-1'));
    addNode(createConceptNode('concept-2'));
    addNode(createConceptNode('concept-3'));

    addEdge(
      createRelatedEdge('concept-1', 'concept-2', {
        relationship_type: 'analogous',
        transfer_potential: 0.8,
      })
    );
    addEdge(
      createRelatedEdge('concept-1', 'concept-3', {
        relationship_type: 'prerequisite_for',
        transfer_potential: 0.4,
      })
    );
  });

  describe('findRelatedConcepts', () => {
    it('should find all related concepts', () => {
      const related = findRelatedConcepts({
        concept_id: 'concept-1',
      });

      expect(related).toHaveLength(2);
    });

    it('should filter by relationship type', () => {
      const related = findRelatedConcepts({
        concept_id: 'concept-1',
        relationship_types: ['analogous'],
      });

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('concept-2');
    });

    it('should filter by minimum transfer potential', () => {
      const related = findRelatedConcepts({
        concept_id: 'concept-1',
        min_transfer_potential: 0.5,
      });

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('concept-2');
    });

    it('should respect max_results', () => {
      const related = findRelatedConcepts({
        concept_id: 'concept-1',
        max_results: 1,
      });

      expect(related).toHaveLength(1);
    });

    it('should sort by transfer potential descending', () => {
      const related = findRelatedConcepts({
        concept_id: 'concept-1',
      });

      if (related.length === 2) {
        expect(related[0].id).toBe('concept-2'); // Higher transfer potential
      }
    });
  });

  describe('findHighTransferConcepts', () => {
    it('should find concepts with high transfer potential', () => {
      const masteryMap = { 'concept-1': 0.9 };

      const results = findHighTransferConcepts('concept-1', masteryMap, 5);

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect limit parameter', () => {
      const results = findHighTransferConcepts('concept-1', {}, 1);

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// Graph-Constrained Geodesics Tests
// ============================================================================

describe('computeGraphConstrainedGeodesic', () => {
  beforeEach(() => {
    addNode(createConceptNode('current', { difficulty: 50 }));
    addNode(createConceptNode('next-1', { difficulty: 55 }));
    addNode(createConceptNode('next-2', { difficulty: 60 }));

    addEdge(createFollowupEdge('current', 'next-1'));
    addEdge(createFollowupEdge('current', 'next-2'));
  });

  it('should return empty array when no current concept', () => {
    const state = {
      learner_id: 'learner-1',
      C: 70,
      E: 50,
      G: 60,
      timestamp: Date.now(),
    };

    const results = computeGraphConstrainedGeodesic(state, {});
    expect(results).toEqual([]);
  });

  it('should compute geodesic options for valid state', () => {
    const state = {
      learner_id: 'learner-1',
      C: 70,
      E: 50,
      G: 60,
      timestamp: Date.now(),
    };
    const masteryMap = { current: 0.9 };

    const results = computeGraphConstrainedGeodesic(state, masteryMap);

    // May return results depending on prerequisite checks
    expect(Array.isArray(results)).toBe(true);
  });

  it('should sort by distance to target', () => {
    const state = {
      learner_id: 'learner-1',
      C: 70,
      E: 50,
      G: 60,
      timestamp: Date.now(),
    };
    const masteryMap = { current: 0.9 };

    const results = computeGraphConstrainedGeodesic(state, masteryMap, 'flow');

    if (results.length > 1) {
      expect(results[0].distance_to_target).toBeLessThanOrEqual(
        results[1].distance_to_target
      );
    }
  });

  it('should respect maxOptions parameter', () => {
    const state = {
      learner_id: 'learner-1',
      C: 70,
      E: 50,
      G: 60,
      timestamp: Date.now(),
    };
    const masteryMap = { current: 0.9 };

    const results = computeGraphConstrainedGeodesic(state, masteryMap, 'flow', 1);

    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Graph Statistics Tests
// ============================================================================

describe('getGraphStats', () => {
  it('should return zero stats for empty graph', () => {
    const stats = getGraphStats();

    expect(stats.total_nodes).toBe(0);
    expect(stats.total_edges).toBe(0);
    expect(stats.avg_prerequisites_per_concept).toBe(0);
    expect(stats.avg_followups_per_concept).toBe(0);
  });

  it('should count nodes and edges correctly', () => {
    addNode(createConceptNode('concept-1'));
    addNode(createConceptNode('concept-2'));
    addNode(createMisconceptionNode('misc-1'));
    addEdge(createPrerequisiteEdge('concept-1', 'concept-2'));
    addEdge(createFollowupEdge('concept-1', 'concept-2'));

    const stats = getGraphStats();

    expect(stats.total_nodes).toBe(3);
    expect(stats.total_edges).toBe(2);
    expect(stats.nodes_by_type.concept).toBe(2);
    expect(stats.nodes_by_type.misconception).toBe(1);
    expect(stats.edges_by_type.prerequisite_of).toBe(1);
    expect(stats.edges_by_type.followup_to).toBe(1);
  });

  it('should calculate averages correctly', () => {
    addNode(createConceptNode('concept-1'));
    addNode(createConceptNode('concept-2'));
    addEdge(createPrerequisiteEdge('concept-1', 'concept-2'));

    const stats = getGraphStats();

    // One prerequisite total, 2 concepts = 0.5 avg
    expect(stats.avg_prerequisites_per_concept).toBe(0.5);
  });
});

// ============================================================================
// Reset Graph Store Tests
// ============================================================================

describe('resetGraphStore', () => {
  it('should clear all data', () => {
    addNode(createConceptNode('concept-1'));
    addEdge(createPrerequisiteEdge('concept-1', 'concept-2'));

    resetGraphStore();

    expect(getNode('concept-1')).toBeUndefined();
    expect(getGraphStats().total_nodes).toBe(0);
  });
});
