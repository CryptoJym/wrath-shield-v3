/**
 * HYRO FORGE: Knowledge Graph Query Operations
 *
 * This module implements graph traversal and query operations for the
 * curriculum knowledge graph. It provides:
 *
 * - Prerequisite chain traversal (topological)
 * - Shortest path to target concept
 * - Misconception detection and remediation
 * - Graph-constrained geodesics (path planning in manifold space)
 *
 * The graph operations complement the C/E/G manifold:
 * - Graph tells us WHERE the learner can go (legal transitions)
 * - Manifold tells us HOW the learner is moving (trajectory quality)
 */

import { ensureServerOnly } from '../server-only-guard';
import type {
  ConceptNode,
  MisconceptionNode,
  PrerequisiteEdge,
  FollowupEdge,
  RelatedEdge,
  MisconceptionOfEdge,
  PrerequisiteQuery,
  RelatedConceptQuery,
  MisconceptionQuery,
  ValidNextConceptsQuery,
  PrerequisiteGapResult,
  LearningPathResult,
  GraphNode,
  GraphEdge
} from './forge-knowledge-graph-schema';
import {
  checkPrerequisitesSatisfied,
  computeTransferPotential,
  filterValidAt,
  MISCONCEPTION_DETECTION_THRESHOLD
} from './forge-knowledge-graph-schema';
import type { LearnerState, ObjectiveVector } from './forge-learner-state';
import { distanceCEG, ATTRACTOR_BASINS } from './forge-learner-state';

ensureServerOnly('lib/hyro/forge-graph-queries');

// =============================================================================
// IN-MEMORY GRAPH STORE (Development)
// =============================================================================

/**
 * Simple in-memory graph store for development
 * In production, this would be backed by Graphiti/Neo4j/SQLite
 */
interface GraphStore {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  // Indexes for fast lookup
  nodesByType: Map<string, Set<string>>;
  edgesBySource: Map<string, Set<string>>;
  edgesByTarget: Map<string, Set<string>>;
  edgesByType: Map<string, Set<string>>;
}

let graphStore: GraphStore | null = null;

function getGraphStore(): GraphStore {
  if (!graphStore) {
    graphStore = {
      nodes: new Map(),
      edges: new Map(),
      nodesByType: new Map(),
      edgesBySource: new Map(),
      edgesByTarget: new Map(),
      edgesByType: new Map()
    };
  }
  return graphStore;
}

/**
 * Reset graph store (for testing)
 */
export function resetGraphStore(): void {
  graphStore = null;
}

// =============================================================================
// NODE OPERATIONS
// =============================================================================

/**
 * Add a node to the graph
 */
export function addNode(node: GraphNode): void {
  const store = getGraphStore();
  store.nodes.set(node.id, node);

  // Update type index
  if (!store.nodesByType.has(node.node_type)) {
    store.nodesByType.set(node.node_type, new Set());
  }
  store.nodesByType.get(node.node_type)!.add(node.id);
}

/**
 * Get a node by ID
 */
export function getNode(nodeId: string): GraphNode | undefined {
  return getGraphStore().nodes.get(nodeId);
}

/**
 * Get nodes by type
 */
export function getNodesByType(nodeType: string): GraphNode[] {
  const store = getGraphStore();
  const ids = store.nodesByType.get(nodeType) || new Set();
  return Array.from(ids).map(id => store.nodes.get(id)!).filter(Boolean);
}

/**
 * Get concept node by ID
 */
export function getConcept(conceptId: string): ConceptNode | undefined {
  const node = getNode(conceptId);
  return node?.node_type === 'concept' ? node as ConceptNode : undefined;
}

/**
 * Get all concepts in a domain
 */
export function getConceptsByDomain(domainId: string): ConceptNode[] {
  return (getNodesByType('concept') as ConceptNode[])
    .filter(c => c.domain_id === domainId);
}

// =============================================================================
// EDGE OPERATIONS
// =============================================================================

/**
 * Add an edge to the graph
 */
export function addEdge(edge: GraphEdge): void {
  const store = getGraphStore();
  store.edges.set(edge.id, edge);

  // Update source index
  if (!store.edgesBySource.has(edge.source_id)) {
    store.edgesBySource.set(edge.source_id, new Set());
  }
  store.edgesBySource.get(edge.source_id)!.add(edge.id);

  // Update target index
  if (!store.edgesByTarget.has(edge.target_id)) {
    store.edgesByTarget.set(edge.target_id, new Set());
  }
  store.edgesByTarget.get(edge.target_id)!.add(edge.id);

  // Update type index
  if (!store.edgesByType.has(edge.edge_type)) {
    store.edgesByType.set(edge.edge_type, new Set());
  }
  store.edgesByType.get(edge.edge_type)!.add(edge.id);
}

/**
 * Get edges by source node
 */
export function getEdgesFromSource(sourceId: string): GraphEdge[] {
  const store = getGraphStore();
  const ids = store.edgesBySource.get(sourceId) || new Set();
  return Array.from(ids).map(id => store.edges.get(id)!).filter(Boolean);
}

/**
 * Get edges by target node
 */
export function getEdgesToTarget(targetId: string): GraphEdge[] {
  const store = getGraphStore();
  const ids = store.edgesByTarget.get(targetId) || new Set();
  return Array.from(ids).map(id => store.edges.get(id)!).filter(Boolean);
}

/**
 * Get edges by type
 */
export function getEdgesByType(edgeType: string): GraphEdge[] {
  const store = getGraphStore();
  const ids = store.edgesByType.get(edgeType) || new Set();
  return Array.from(ids).map(id => store.edges.get(id)!).filter(Boolean);
}

// =============================================================================
// PREREQUISITE QUERIES
// =============================================================================

/**
 * Get direct prerequisites for a concept
 */
export function getDirectPrerequisites(conceptId: string): ConceptNode[] {
  const prereqEdges = getEdgesToTarget(conceptId)
    .filter(e => e.edge_type === 'prerequisite_of') as PrerequisiteEdge[];

  return prereqEdges
    .map(e => getConcept(e.source_id))
    .filter((c): c is ConceptNode => c !== undefined);
}

/**
 * Get transitive prerequisites (full prerequisite chain)
 */
export function getTransitivePrerequisites(
  conceptId: string,
  maxDepth: number = 10
): ConceptNode[] {
  const visited = new Set<string>();
  const result: ConceptNode[] = [];
  const queue: { id: string; depth: number }[] = [{ id: conceptId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.id) || current.depth > maxDepth) {
      continue;
    }
    visited.add(current.id);

    const prereqs = getDirectPrerequisites(current.id);
    for (const prereq of prereqs) {
      if (!visited.has(prereq.id)) {
        result.push(prereq);
        queue.push({ id: prereq.id, depth: current.depth + 1 });
      }
    }
  }

  return result;
}

/**
 * Query prerequisites with filtering
 */
export function queryPrerequisites(query: PrerequisiteQuery): ConceptNode[] {
  const prereqs = query.include_transitive
    ? getTransitivePrerequisites(query.concept_id, query.max_depth)
    : getDirectPrerequisites(query.concept_id);

  if (!query.criticality_filter) {
    return prereqs;
  }

  // Filter by criticality
  const prereqEdges = getEdgesToTarget(query.concept_id)
    .filter(e => e.edge_type === 'prerequisite_of') as PrerequisiteEdge[];

  const validSourceIds = new Set(
    prereqEdges
      .filter(e => e.criticality === query.criticality_filter)
      .map(e => e.source_id)
  );

  return prereqs.filter(p => validSourceIds.has(p.id));
}

/**
 * Find prerequisite gaps for a learner
 */
export function findPrerequisiteGaps(
  conceptId: string,
  masteryMap: Record<string, number>
): PrerequisiteGapResult {
  const prereqEdges = getEdgesToTarget(conceptId)
    .filter(e => e.edge_type === 'prerequisite_of') as PrerequisiteEdge[];

  const result = checkPrerequisitesSatisfied(conceptId, prereqEdges, masteryMap);

  // Convert to result format
  const missingPrereqs = result.gaps.map(gap => ({
    concept_id: gap.prereq_id,
    current_mastery: gap.current,
    required_mastery: gap.required,
    gap: gap.required - gap.current
  }));

  // Sort by gap size (largest first) for remediation order
  missingPrereqs.sort((a, b) => b.gap - a.gap);

  return {
    target_concept: conceptId,
    missing_prerequisites: missingPrereqs,
    suggested_remediation_order: missingPrereqs.map(p => p.concept_id)
  };
}

// =============================================================================
// PATH FINDING
// =============================================================================

/**
 * Find valid next concepts (respecting prerequisites)
 */
export function findValidNextConcepts(
  query: ValidNextConceptsQuery
): ConceptNode[] {
  const currentConcept = getConcept(query.current_concept_id);
  if (!currentConcept) return [];

  // Get followup concepts
  const followupEdges = getEdgesFromSource(query.current_concept_id)
    .filter(e => e.edge_type === 'followup_to') as FollowupEdge[];

  const candidates: ConceptNode[] = [];

  for (const edge of followupEdges) {
    const concept = getConcept(edge.target_id);
    if (!concept) continue;

    // Check if prerequisites are satisfied
    const gapResult = findPrerequisiteGaps(concept.id, query.mastery_map);
    if (gapResult.missing_prerequisites.length === 0) {
      candidates.push(concept);
    }
  }

  // Also check related concepts
  const relatedEdges = getEdgesFromSource(query.current_concept_id)
    .filter(e => e.edge_type === 'related_to') as RelatedEdge[];

  for (const edge of relatedEdges) {
    const concept = getConcept(edge.target_id);
    if (!concept) continue;

    const gapResult = findPrerequisiteGaps(concept.id, query.mastery_map);
    if (gapResult.missing_prerequisites.length === 0) {
      // Don't add duplicates
      if (!candidates.find(c => c.id === concept.id)) {
        candidates.push(concept);
      }
    }
  }

  // Sort by naturalness/transfer potential
  candidates.sort((a, b) => {
    const aFollowup = followupEdges.find(e => e.target_id === a.id);
    const bFollowup = followupEdges.find(e => e.target_id === b.id);

    const aNatural = aFollowup?.naturalness || 0;
    const bNatural = bFollowup?.naturalness || 0;

    return bNatural - aNatural;
  });

  return query.max_results ? candidates.slice(0, query.max_results) : candidates;
}

/**
 * Find shortest learning path between two concepts
 * Uses BFS respecting prerequisites
 */
export function findLearningPath(
  startConceptId: string,
  endConceptId: string,
  masteryMap: Record<string, number>,
  maxPathLength: number = 20
): LearningPathResult | null {
  const startConcept = getConcept(startConceptId);
  const endConcept = getConcept(endConceptId);

  if (!startConcept || !endConcept) return null;

  // BFS to find shortest path
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [startConceptId];

  visited.add(startConceptId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === endConceptId) {
      // Reconstruct path
      const pathIds: string[] = [];
      let nodeId: string | undefined = endConceptId;

      while (nodeId) {
        pathIds.unshift(nodeId);
        nodeId = parent.get(nodeId);
      }

      // Convert to result
      const path = pathIds.map(id => {
        const concept = getConcept(id)!;
        return {
          concept_id: id,
          estimated_time_minutes: concept.expected_mastery_time_minutes,
          current_mastery: masteryMap[id] || 0
        };
      });

      const totalTime = path.reduce((sum, p) => sum + p.estimated_time_minutes, 0);

      return {
        start_concept: startConceptId,
        end_concept: endConceptId,
        path,
        total_estimated_time_minutes: totalTime,
        concepts_to_learn: path.filter(p => p.current_mastery < 0.8).length
      };
    }

    if (pathIds.length >= maxPathLength) continue;

    // Get valid next concepts
    const nextConcepts = findValidNextConcepts({
      learner_id: 'path-finding',
      current_concept_id: currentId,
      mastery_map: masteryMap
    });

    for (const next of nextConcepts) {
      if (!visited.has(next.id)) {
        visited.add(next.id);
        parent.set(next.id, currentId);
        queue.push(next.id);
      }
    }
  }

  return null; // No path found
}

// =============================================================================
// MISCONCEPTION QUERIES
// =============================================================================

/**
 * Get misconceptions for a concept
 */
export function getMisconceptions(query: MisconceptionQuery): MisconceptionNode[] {
  const miscEdges = getEdgesToTarget(query.concept_id)
    .filter(e => e.edge_type === 'misconception_of') as MisconceptionOfEdge[];

  let misconceptions: MisconceptionNode[] = miscEdges
    .map(e => getNode(e.source_id))
    .filter((n): n is MisconceptionNode => n?.node_type === 'misconception');

  // Filter by severity
  if (query.severity_filter) {
    misconceptions = misconceptions.filter(
      m => query.severity_filter!.includes(m.severity)
    );
  }

  // Filter by prevalence
  if (query.min_prevalence !== undefined) {
    const prevMap = new Map(miscEdges.map(e => [e.source_id, e.prevalence]));
    misconceptions = misconceptions.filter(
      m => (prevMap.get(m.id) || 0) >= query.min_prevalence!
    );
  }

  return misconceptions;
}

/**
 * Detect misconceptions from error patterns
 */
export function detectMisconceptionsFromErrors(
  conceptId: string,
  errorPatterns: string[],
  existingMisconceptions: MisconceptionNode[]
): {
  detected: MisconceptionNode[];
  new_patterns: string[];
} {
  const detected: MisconceptionNode[] = [];
  const knownPatterns = new Set<string>();

  // Check against known misconceptions
  for (const misc of existingMisconceptions) {
    if (misc.detection_patterns) {
      for (const pattern of misc.detection_patterns) {
        knownPatterns.add(pattern);
        if (errorPatterns.some(e => e.includes(pattern) || pattern.includes(e))) {
          detected.push(misc);
          break;
        }
      }
    }
  }

  // Find truly new patterns
  const newPatterns = errorPatterns.filter(e => !knownPatterns.has(e));

  return {
    detected,
    new_patterns: newPatterns
  };
}

// =============================================================================
// RELATED CONCEPTS
// =============================================================================

/**
 * Find related concepts
 */
export function findRelatedConcepts(query: RelatedConceptQuery): ConceptNode[] {
  const relatedEdges = getEdgesFromSource(query.concept_id)
    .filter(e => e.edge_type === 'related_to') as RelatedEdge[];

  let filtered = relatedEdges;

  // Filter by relationship type
  if (query.relationship_types) {
    filtered = filtered.filter(e =>
      query.relationship_types!.includes(e.relationship_type)
    );
  }

  // Filter by transfer potential
  if (query.min_transfer_potential !== undefined) {
    filtered = filtered.filter(e =>
      e.transfer_potential >= query.min_transfer_potential!
    );
  }

  // Sort by transfer potential
  filtered.sort((a, b) => b.transfer_potential - a.transfer_potential);

  // Get concepts
  let concepts = filtered
    .map(e => getConcept(e.target_id))
    .filter((c): c is ConceptNode => c !== undefined);

  // Apply limit
  if (query.max_results) {
    concepts = concepts.slice(0, query.max_results);
  }

  return concepts;
}

/**
 * Find concepts with highest transfer potential from current
 */
export function findHighTransferConcepts(
  currentConceptId: string,
  masteryMap: Record<string, number>,
  limit: number = 5
): { concept: ConceptNode; transfer_potential: number }[] {
  const allConcepts = getNodesByType('concept') as ConceptNode[];
  const relatedEdges = getEdgesByType('related_to') as RelatedEdge[];
  const prereqEdges = getEdgesByType('prerequisite_of') as PrerequisiteEdge[];

  const results: { concept: ConceptNode; transfer_potential: number }[] = [];

  for (const concept of allConcepts) {
    if (concept.id === currentConceptId) continue;

    // Check prerequisites
    const gapResult = findPrerequisiteGaps(concept.id, masteryMap);
    if (gapResult.missing_prerequisites.length > 0) continue;

    // Compute transfer potential
    const tp = computeTransferPotential(
      currentConceptId,
      concept.id,
      relatedEdges,
      prereqEdges
    );

    if (tp > 0.1) {
      results.push({ concept, transfer_potential: tp });
    }
  }

  // Sort and limit
  results.sort((a, b) => b.transfer_potential - a.transfer_potential);
  return results.slice(0, limit);
}

// =============================================================================
// GRAPH-CONSTRAINED GEODESICS
// =============================================================================

/**
 * Compute the optimal next concept considering both graph topology
 * and C/E/G manifold trajectory.
 *
 * This is the core "graph-constrained geodesic" operation:
 * 1. Get valid next concepts from graph
 * 2. Score each by expected trajectory effect
 * 3. Return Pareto-optimal options
 */
export function computeGraphConstrainedGeodesic(
  currentState: LearnerState,
  masteryMap: Record<string, number>,
  targetAttractor: 'flow' | 'discovery' = 'flow',
  maxOptions: number = 5
): {
  concept: ConceptNode;
  objectives: ObjectiveVector;
  distance_to_target: number;
}[] {
  const currentConceptId = Object.entries(masteryMap)
    .sort((a, b) => b[1] - a[1])[0]?.[0]; // Highest mastery = current focus

  if (!currentConceptId) return [];

  // Get valid next concepts
  const validNext = findValidNextConcepts({
    learner_id: currentState.learner_id,
    current_concept_id: currentConceptId,
    mastery_map: masteryMap
  });

  const targetCentroid = ATTRACTOR_BASINS[targetAttractor].centroid;
  const results: {
    concept: ConceptNode;
    objectives: ObjectiveVector;
    distance_to_target: number;
  }[] = [];

  for (const concept of validNext) {
    // Estimate expected state change
    const difficultyMatch = Math.abs(
      concept.difficulty - (currentState.C * 100 / 100)
    );
    const expectedMastery = masteryMap[concept.id] || 0.3;

    // Simplified objective computation
    const learning_gain = Math.max(0, 1 - expectedMastery) * (1 - difficultyMatch / 100);
    const engagement = 1 - Math.abs(currentState.E - 50) / 100;
    const efficiency = 1 / Math.max(1, concept.expected_mastery_time_minutes / 10);

    // Get transfer potential
    const relatedEdges = getEdgesByType('related_to') as RelatedEdge[];
    const prereqEdges = getEdgesByType('prerequisite_of') as PrerequisiteEdge[];
    const transfer_potential = computeTransferPotential(
      currentConceptId,
      concept.id,
      relatedEdges,
      prereqEdges
    );

    // Estimate new state position
    const estimatedNewState = {
      C: currentState.C + (learning_gain * 5),
      E: currentState.E + (engagement - 0.5) * 3,
      G: currentState.G + (transfer_potential * 4)
    };

    const distToTarget = distanceCEG(estimatedNewState, targetCentroid);

    results.push({
      concept,
      objectives: {
        learning_gain: Math.min(1, learning_gain),
        engagement: Math.min(1, engagement),
        efficiency: Math.min(1, efficiency),
        transfer_potential: Math.min(1, transfer_potential)
      },
      distance_to_target: distToTarget
    });
  }

  // Sort by distance to target (ascending)
  results.sort((a, b) => a.distance_to_target - b.distance_to_target);

  return results.slice(0, maxOptions);
}

// =============================================================================
// GRAPH STATISTICS
// =============================================================================

/**
 * Get graph statistics
 */
export function getGraphStats(): {
  total_nodes: number;
  total_edges: number;
  nodes_by_type: Record<string, number>;
  edges_by_type: Record<string, number>;
  avg_prerequisites_per_concept: number;
  avg_followups_per_concept: number;
} {
  const store = getGraphStore();

  const nodesByType: Record<string, number> = {};
  for (const [type, ids] of store.nodesByType) {
    nodesByType[type] = ids.size;
  }

  const edgesByType: Record<string, number> = {};
  for (const [type, ids] of store.edgesByType) {
    edgesByType[type] = ids.size;
  }

  const concepts = getNodesByType('concept') as ConceptNode[];
  const prereqCount = concepts.reduce(
    (sum, c) => sum + getDirectPrerequisites(c.id).length,
    0
  );
  const followupCount = concepts.reduce(
    (sum, c) => sum + getEdgesFromSource(c.id).filter(e => e.edge_type === 'followup_to').length,
    0
  );

  return {
    total_nodes: store.nodes.size,
    total_edges: store.edges.size,
    nodes_by_type: nodesByType,
    edges_by_type: edgesByType,
    avg_prerequisites_per_concept: concepts.length > 0 ? prereqCount / concepts.length : 0,
    avg_followups_per_concept: concepts.length > 0 ? followupCount / concepts.length : 0
  };
}
