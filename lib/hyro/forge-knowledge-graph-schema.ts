/**
 * HYRO FORGE: Knowledge Graph Schema (Graphiti-Compatible)
 *
 * This module defines the discrete relational topology of the curriculum/concept space.
 * The knowledge graph complements the continuous C/E/G manifold:
 *
 * | View     | Purpose                                                    |
 * |----------|-----------------------------------------------------------|
 * | Graph    | Where you can go (legal concept transitions, prerequisites)|
 * | Manifold | How you're moving (trajectory quality in C/E/G + meta)    |
 *
 * The graph encodes:
 * - Prerequisite chains: what must be understood before what
 * - Lateral links: cross-topic analogies and transfer opportunities
 * - Misconception clusters: recurring error patterns anchored to concepts
 *
 * Graphiti Features Used:
 * - Bi-temporal data (valid_from / valid_to) for historical queries
 * - Episodic memory linking sessions to concepts
 * - Auto-generated misconception links after repeated error patterns
 */

import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/hyro/forge-knowledge-graph-schema');

// =============================================================================
// NODE TYPES
// =============================================================================

/**
 * Base properties for all graph nodes
 */
export interface BaseNode {
  /** Unique identifier */
  id: string;

  /** Human-readable label */
  label: string;

  /** Node type discriminator */
  node_type: string;

  /** When this node was created (Unix timestamp) */
  created_at: number;

  /** When this node was last updated */
  updated_at: number;

  /** Bi-temporal: when this version became valid */
  valid_from: number;

  /** Bi-temporal: when this version was superseded (null if current) */
  valid_to: number | null;

  /** Arbitrary metadata */
  metadata?: Record<string, any>;
}

/**
 * Domain/subject area (e.g., "Mathematics", "Reading")
 */
export interface DomainNode extends BaseNode {
  node_type: 'domain';

  /** Domain code (e.g., "MATH", "ELA") */
  code: string;

  /** Full description */
  description: string;

  /** Grade level range */
  grade_range: {
    min: number;
    max: number;
  };

  /** Common Core or other standards alignment */
  standards_alignment?: string[];
}

/**
 * Concept/skill node (e.g., "Fractions", "Main Idea")
 */
export interface ConceptNode extends BaseNode {
  node_type: 'concept';

  /** Domain this concept belongs to */
  domain_id: string;

  /** Hierarchical path (e.g., "math.algebra.linear_equations") */
  path: string;

  /** Difficulty estimate (0-100) */
  difficulty: number;

  /** Expected time to master (minutes) */
  expected_mastery_time_minutes: number;

  /** Keywords for search/matching */
  keywords: string[];

  /** Learning objectives */
  objectives: string[];

  /** Common Core standards this covers */
  standards?: string[];
}

/**
 * Misconception node - represents a common error pattern
 */
export interface MisconceptionNode extends BaseNode {
  node_type: 'misconception';

  /** Concept this misconception is about */
  concept_id: string;

  /** Pattern description (what the error looks like) */
  pattern: string;

  /** Why students make this error */
  cause: string;

  /** How to remediate */
  remediation_strategy: string;

  /** Example of the error */
  example?: string;

  /** Severity (how much it impedes progress) */
  severity: 'low' | 'medium' | 'high';

  /** Detection patterns (for auto-detection) */
  detection_patterns?: string[];
}

/**
 * Session node - episodic memory of a learning session
 */
export interface SessionNode extends BaseNode {
  node_type: 'session';

  /** Learner ID */
  learner_id: string;

  /** Session duration (seconds) */
  duration_seconds: number;

  /** Mode of learning */
  mode: 'practice' | 'assessment' | 'exploration';

  /** Concepts touched during session */
  concepts_touched: string[];

  /** Performance summary */
  performance: {
    questions_attempted: number;
    questions_correct: number;
    average_time_per_question_ms: number;
    hints_used: number;
  };

  /** State at session start */
  initial_state: { C: number; E: number; G: number };

  /** State at session end */
  final_state: { C: number; E: number; G: number };
}

/**
 * Content node - learning material
 */
export interface ContentNode extends BaseNode {
  node_type: 'content';

  /** Content type */
  content_type: 'question' | 'explanation' | 'example' | 'activity' | 'video';

  /** Target concept */
  concept_id: string;

  /** Difficulty level */
  difficulty: number;

  /** Modality */
  modality: 'text' | 'image' | 'diagram' | 'video' | 'interactive' | 'audio';

  /** Estimated time to complete (seconds) */
  estimated_time_seconds: number;

  /** Content data (structure depends on content_type) */
  content_data: Record<string, any>;
}

/**
 * Union of all node types
 */
export type GraphNode =
  | DomainNode
  | ConceptNode
  | MisconceptionNode
  | SessionNode
  | ContentNode;

// =============================================================================
// EDGE TYPES
// =============================================================================

/**
 * Base properties for all graph edges
 */
export interface BaseEdge {
  /** Unique identifier */
  id: string;

  /** Edge type discriminator */
  edge_type: string;

  /** Source node ID */
  source_id: string;

  /** Target node ID */
  target_id: string;

  /** Edge weight/strength (0-1) */
  weight: number;

  /** When this edge was created */
  created_at: number;

  /** Bi-temporal: when this edge became valid */
  valid_from: number;

  /** Bi-temporal: when this edge was removed (null if current) */
  valid_to: number | null;

  /** Arbitrary metadata */
  metadata?: Record<string, any>;
}

/**
 * Prerequisite relationship: source must be mastered before target
 */
export interface PrerequisiteEdge extends BaseEdge {
  edge_type: 'prerequisite_of';

  /** How critical is this prerequisite? */
  criticality: 'required' | 'recommended' | 'helpful';

  /** Minimum mastery level needed (0-1) */
  min_mastery_threshold: number;
}

/**
 * Followup relationship: target naturally follows source
 */
export interface FollowupEdge extends BaseEdge {
  edge_type: 'followup_to';

  /** How natural is this progression? */
  naturalness: number; // 0-1
}

/**
 * Related relationship: concepts are laterally connected
 */
export interface RelatedEdge extends BaseEdge {
  edge_type: 'related_to';

  /** Type of relationship */
  relationship_type: 'analogy' | 'application' | 'contrast' | 'extension';

  /** Transfer potential (how much learning one helps the other) */
  transfer_potential: number; // 0-1
}

/**
 * Misconception relationship: misconception is associated with concept
 */
export interface MisconceptionOfEdge extends BaseEdge {
  edge_type: 'misconception_of';

  /** How common is this misconception? */
  prevalence: number; // 0-1

  /** How often this has been observed for this learner */
  observation_count: number;
}

/**
 * Session-concept relationship: session touched this concept
 */
export interface TouchedConceptEdge extends BaseEdge {
  edge_type: 'touched_concept';

  /** Performance on this concept during session */
  performance: {
    correct: number;
    incorrect: number;
    hints_used: number;
  };

  /** Mastery change during session */
  mastery_delta: number;
}

/**
 * Content-concept relationship: content teaches this concept
 */
export interface TeachesConceptEdge extends BaseEdge {
  edge_type: 'teaches_concept';

  /** How well this content teaches the concept */
  effectiveness: number; // 0-1

  /** Usage count across all learners */
  usage_count: number;

  /** Average performance when using this content */
  avg_performance: number;
}

/**
 * Union of all edge types
 */
export type GraphEdge =
  | PrerequisiteEdge
  | FollowupEdge
  | RelatedEdge
  | MisconceptionOfEdge
  | TouchedConceptEdge
  | TeachesConceptEdge;

// =============================================================================
// GRAPHITI COLLECTION SCHEMAS
// =============================================================================

/**
 * Collection name constants
 */
export const COLLECTIONS = {
  // Node collections
  DOMAINS: 'hyro_domains',
  CONCEPTS: 'hyro_concepts',
  MISCONCEPTIONS: 'hyro_misconceptions',
  SESSIONS: 'hyro_sessions',
  CONTENT: 'hyro_content',

  // Edge collections
  PREREQUISITES: 'hyro_prerequisites',
  FOLLOWUPS: 'hyro_followups',
  RELATED: 'hyro_related',
  MISCONCEPTION_OF: 'hyro_misconception_of',
  TOUCHED_CONCEPT: 'hyro_touched_concept',
  TEACHES_CONCEPT: 'hyro_teaches_concept'
} as const;

/**
 * Index definitions for efficient querying
 */
export const INDEXES = {
  // Concept indexes
  concept_by_domain: {
    collection: COLLECTIONS.CONCEPTS,
    fields: ['domain_id']
  },
  concept_by_path: {
    collection: COLLECTIONS.CONCEPTS,
    fields: ['path'],
    unique: true
  },
  concept_by_difficulty: {
    collection: COLLECTIONS.CONCEPTS,
    fields: ['difficulty']
  },

  // Misconception indexes
  misconception_by_concept: {
    collection: COLLECTIONS.MISCONCEPTIONS,
    fields: ['concept_id']
  },

  // Session indexes
  session_by_learner: {
    collection: COLLECTIONS.SESSIONS,
    fields: ['learner_id']
  },
  session_by_time: {
    collection: COLLECTIONS.SESSIONS,
    fields: ['created_at']
  },

  // Edge indexes (for traversal)
  prereq_by_source: {
    collection: COLLECTIONS.PREREQUISITES,
    fields: ['source_id']
  },
  prereq_by_target: {
    collection: COLLECTIONS.PREREQUISITES,
    fields: ['target_id']
  },

  // Temporal indexes
  valid_at: {
    collection: '*', // All collections
    fields: ['valid_from', 'valid_to']
  }
} as const;

// =============================================================================
// GRAPH QUERY TYPES
// =============================================================================

/**
 * Query to find prerequisites for a concept
 */
export interface PrerequisiteQuery {
  concept_id: string;
  include_transitive?: boolean; // Get full chain
  max_depth?: number;
  criticality_filter?: 'required' | 'recommended' | 'helpful';
}

/**
 * Query to find related concepts
 */
export interface RelatedConceptQuery {
  concept_id: string;
  relationship_types?: ('analogy' | 'application' | 'contrast' | 'extension')[];
  min_transfer_potential?: number;
  max_results?: number;
}

/**
 * Query to find misconceptions for a concept
 */
export interface MisconceptionQuery {
  concept_id: string;
  learner_id?: string; // Filter by learner's observed misconceptions
  severity_filter?: ('low' | 'medium' | 'high')[];
  min_prevalence?: number;
}

/**
 * Query to find valid next concepts (respecting prerequisites)
 */
export interface ValidNextConceptsQuery {
  learner_id: string;
  current_concept_id: string;
  mastery_map: Record<string, number>;
  max_results?: number;
}

/**
 * Query result for prerequisite gaps
 */
export interface PrerequisiteGapResult {
  target_concept: string;
  missing_prerequisites: Array<{
    concept_id: string;
    current_mastery: number;
    required_mastery: number;
    gap: number;
  }>;
  suggested_remediation_order: string[];
}

/**
 * Query result for learning path
 */
export interface LearningPathResult {
  start_concept: string;
  end_concept: string;
  path: Array<{
    concept_id: string;
    estimated_time_minutes: number;
    current_mastery: number;
  }>;
  total_estimated_time_minutes: number;
  concepts_to_learn: number;
}

// =============================================================================
// GRAPH OPERATIONS
// =============================================================================

/**
 * Generate a unique node/edge ID
 */
export function generateGraphId(type: 'node' | 'edge'): string {
  const prefix = type === 'node' ? 'n' : 'e';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Create base node properties
 */
export function createBaseNode(
  nodeType: string,
  label: string,
  metadata?: Record<string, any>
): Omit<BaseNode, 'id'> & { id: string } {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: generateGraphId('node'),
    label,
    node_type: nodeType,
    created_at: now,
    updated_at: now,
    valid_from: now,
    valid_to: null,
    metadata
  };
}

/**
 * Create base edge properties
 */
export function createBaseEdge(
  edgeType: string,
  sourceId: string,
  targetId: string,
  weight: number = 1.0,
  metadata?: Record<string, any>
): Omit<BaseEdge, 'id'> & { id: string } {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: generateGraphId('edge'),
    edge_type: edgeType,
    source_id: sourceId,
    target_id: targetId,
    weight,
    created_at: now,
    valid_from: now,
    valid_to: null,
    metadata
  };
}

/**
 * Check if a concept's prerequisites are satisfied
 */
export function checkPrerequisitesSatisfied(
  conceptId: string,
  prerequisites: PrerequisiteEdge[],
  masteryMap: Record<string, number>
): {
  satisfied: boolean;
  gaps: Array<{ prereq_id: string; current: number; required: number }>;
} {
  const gaps: Array<{ prereq_id: string; current: number; required: number }> = [];

  for (const prereq of prerequisites) {
    if (prereq.target_id !== conceptId) continue;
    if (prereq.criticality !== 'required') continue;

    const currentMastery = masteryMap[prereq.source_id] ?? 0;
    if (currentMastery < prereq.min_mastery_threshold) {
      gaps.push({
        prereq_id: prereq.source_id,
        current: currentMastery,
        required: prereq.min_mastery_threshold
      });
    }
  }

  return {
    satisfied: gaps.length === 0,
    gaps
  };
}

/**
 * Compute transfer potential between two concepts
 * Based on shared prerequisites and related edges
 */
export function computeTransferPotential(
  concept1: string,
  concept2: string,
  relatedEdges: RelatedEdge[],
  prereqEdges: PrerequisiteEdge[]
): number {
  // Direct related edge?
  const directRelation = relatedEdges.find(
    e =>
      (e.source_id === concept1 && e.target_id === concept2) ||
      (e.source_id === concept2 && e.target_id === concept1)
  );

  if (directRelation) {
    return directRelation.transfer_potential;
  }

  // Shared prerequisites?
  const prereqs1 = new Set(
    prereqEdges.filter(e => e.target_id === concept1).map(e => e.source_id)
  );
  const prereqs2 = new Set(
    prereqEdges.filter(e => e.target_id === concept2).map(e => e.source_id)
  );

  const intersection = [...prereqs1].filter(p => prereqs2.has(p));
  const union = new Set([...prereqs1, ...prereqs2]);

  if (union.size === 0) return 0;

  // Jaccard similarity of prerequisites
  return intersection.length / union.size;
}

// =============================================================================
// MISCONCEPTION AUTO-DETECTION
// =============================================================================

/**
 * Threshold for auto-creating misconception links
 * Per spec: "Auto-create MISCONCEPTION_OF links after 3+ repeated error patterns"
 */
export const MISCONCEPTION_DETECTION_THRESHOLD = 3;

/**
 * Check if a misconception should be auto-linked
 */
export function shouldAutoLinkMisconception(
  errorPattern: string,
  observationCount: number,
  existingEdge?: MisconceptionOfEdge
): boolean {
  // If already linked, don't re-create
  if (existingEdge && existingEdge.valid_to === null) {
    return false;
  }

  return observationCount >= MISCONCEPTION_DETECTION_THRESHOLD;
}

/**
 * Error pattern matcher for common misconceptions
 */
export interface ErrorPatternMatcher {
  pattern_id: string;
  concept_id: string;
  regex?: RegExp;
  keywords?: string[];
  numeric_check?: (answer: number, expected: number) => boolean;
}

/**
 * Match an answer against known error patterns
 */
export function matchErrorPatterns(
  answer: string,
  expectedAnswer: string,
  conceptId: string,
  patterns: ErrorPatternMatcher[]
): string[] {
  const matched: string[] = [];

  for (const pattern of patterns) {
    if (pattern.concept_id !== conceptId) continue;

    if (pattern.regex && pattern.regex.test(answer)) {
      matched.push(pattern.pattern_id);
    }

    if (pattern.keywords) {
      const answerLower = answer.toLowerCase();
      if (pattern.keywords.some(kw => answerLower.includes(kw.toLowerCase()))) {
        matched.push(pattern.pattern_id);
      }
    }

    if (pattern.numeric_check) {
      const numAnswer = parseFloat(answer);
      const numExpected = parseFloat(expectedAnswer);
      if (!isNaN(numAnswer) && !isNaN(numExpected)) {
        if (pattern.numeric_check(numAnswer, numExpected)) {
          matched.push(pattern.pattern_id);
        }
      }
    }
  }

  return [...new Set(matched)]; // Dedupe
}

// =============================================================================
// TEMPORAL QUERIES
// =============================================================================

/**
 * Filter nodes/edges that were valid at a specific time
 */
export function filterValidAt<T extends { valid_from: number; valid_to: number | null }>(
  items: T[],
  timestamp: number
): T[] {
  return items.filter(
    item =>
      item.valid_from <= timestamp && (item.valid_to === null || item.valid_to > timestamp)
  );
}

/**
 * Get the history of a node/edge over time
 */
export function getTemporalHistory<T extends { id: string; valid_from: number; valid_to: number | null }>(
  allVersions: T[],
  nodeId: string
): T[] {
  return allVersions
    .filter(v => v.id.startsWith(nodeId.split('_')[0])) // Same base ID
    .sort((a, b) => a.valid_from - b.valid_from);
}
