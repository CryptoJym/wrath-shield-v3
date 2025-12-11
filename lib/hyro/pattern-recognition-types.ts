/**
 * Pattern Recognition & Medici Effect Types - Hyro Education System
 *
 * @hyro-domain pattern_recognition
 * @hyro-standards PR-1.*, PR-2.*, PR-3.*, PR-4.*
 * @hyro-manifold Extends C/E/G with Pattern Recognition (PR) and Cross-Domain Transfer (CDT)
 * @hyro-metacognition Focus on analogical reasoning and interdisciplinary thinking
 *
 * Reference: Frans Johansson "The Medici Effect" - Intersection Innovation
 * Reference: Dedre Gentner - Structure Mapping Theory
 * Reference: Keith Holyoak & Paul Thagard - Analogical Reasoning
 * Reference: Barbara Oakley "A Mind for Numbers" - Chunking and Patterns
 *
 * PURPOSE:
 * This module trains students to recognize deep structural patterns across domains,
 * draw productive analogies, and generate novel insights at the intersection of
 * different fields. This is a core skill for creative problem-solving and innovation.
 */

// =============================================================================
// CORE PATTERN TYPES
// =============================================================================

/**
 * Domains of knowledge for cross-domain pattern recognition
 */
export type KnowledgeDomain =
  // STEM
  | 'mathematics'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'computer_science'
  | 'engineering'
  // Humanities
  | 'history'
  | 'literature'
  | 'philosophy'
  | 'art'
  | 'music'
  // Social Sciences
  | 'psychology'
  | 'economics'
  | 'sociology'
  | 'political_science'
  // Applied
  | 'business'
  | 'medicine'
  | 'law'
  | 'education'
  // Interdisciplinary
  | 'systems_thinking'
  | 'design_thinking'
  | 'ecology'
  | 'cognitive_science';

/**
 * Pattern abstraction levels (Bloom's taxonomy for patterns)
 */
export type PatternAbstractionLevel =
  | 'surface'       // Superficial similarities (color, shape, appearance)
  | 'structural'    // Deep structural relationships
  | 'procedural'    // Process/algorithm similarities
  | 'functional'    // Purpose/goal similarities
  | 'causal'        // Cause-effect relationship patterns
  | 'systemic';     // System dynamics patterns

/**
 * Types of structural patterns (from Structure Mapping Theory)
 */
export type StructuralPatternType =
  // Mathematical/Logical
  | 'proportional_relationship'    // A:B :: C:D
  | 'exponential_growth'           // Compound effects
  | 'feedback_loop'                // Reinforcing/balancing loops
  | 'network_effect'               // Value increases with connections
  | 'threshold_effect'             // Critical mass/tipping points
  // Systems
  | 'emergence'                    // Whole > sum of parts
  | 'hierarchy'                    // Nested levels of organization
  | 'modularity'                   // Independent components
  | 'redundancy'                   // Backup systems
  | 'homeostasis'                  // Self-regulation to equilibrium
  // Process
  | 'iteration'                    // Repeated refinement
  | 'branching'                    // Decision trees/divergence
  | 'convergence'                  // Multiple paths to one outcome
  | 'oscillation'                  // Periodic fluctuation
  | 'cascade'                      // Chain reactions
  // Strategic
  | 'trade_off'                    // Optimization under constraints
  | 'leverage_point'               // Small input, large effect
  | 'path_dependency'              // History constrains future
  | 'first_mover'                  // Timing advantages
  | 'prisoners_dilemma';           // Cooperation vs. defection

/**
 * A formal pattern definition
 */
export interface Pattern {
  id: string;
  name: string;
  type: StructuralPatternType;

  // Description
  abstractDescription: string;       // Domain-agnostic description
  visualRepresentation?: string;     // ASCII or SVG diagram
  mathematicalForm?: string;         // Formal representation if applicable

  // Key features that define this pattern
  definingFeatures: string[];
  optionalFeatures: string[];
  counterIndicators: string[];       // Features that rule out this pattern

  // Instantiations across domains
  domainExamples: Array<{
    domain: KnowledgeDomain;
    example: string;
    explanation: string;
  }>;

  // Related patterns
  relatedPatterns: string[];         // Pattern IDs
  oppositePatterns: string[];        // Contrasting patterns
  composedFrom?: string[];           // Simpler patterns this combines

  // Learning metadata
  abstractionLevel: PatternAbstractionLevel;
  difficulty: number;                // -3 to +3
  prerequisites: string[];           // Pattern IDs
}

// =============================================================================
// ANALOGY TYPES (Structure Mapping Theory)
// =============================================================================

/**
 * Analogy quality levels
 */
export type AnalogyQuality =
  | 'surface_only'        // Merely superficial similarities
  | 'mixed'               // Some structural, some surface
  | 'structural'          // Good structural mapping
  | 'systematic'          // Maps entire relational structure
  | 'generative';         // Produces novel inferences

/**
 * A formal analogy mapping between two domains
 */
export interface AnalogyMapping {
  id: string;

  // Source and target domains
  sourceDomain: KnowledgeDomain;
  targetDomain: KnowledgeDomain;

  // The actual analogy
  sourceScenario: {
    description: string;
    entities: string[];
    relations: Array<{ from: string; to: string; relation: string }>;
    higherOrderRelations?: string[];
  };

  targetScenario: {
    description: string;
    entities: string[];
    relations: Array<{ from: string; to: string; relation: string }>;
    higherOrderRelations?: string[];
  };

  // The mapping (correspondence)
  entityMappings: Array<{
    sourceEntity: string;
    targetEntity: string;
    confidence: number;
  }>;

  relationMappings: Array<{
    sourceRelation: string;
    targetRelation: string;
    confidence: number;
  }>;

  // Quality assessment
  quality: AnalogyQuality;
  structuralConsistency: number;     // 0-100
  systematicity: number;             // 0-100 (how many higher-order relations)

  // Candidate inferences (novel predictions)
  candidateInferences: Array<{
    inference: string;
    confidence: number;
    validated?: boolean;
  }>;

  // Learning
  underlyingPattern: string;         // Pattern ID
  difficulty: number;
}

/**
 * Analogy generation exercise
 */
export interface AnalogyExercise {
  id: string;
  exerciseType: 'complete_analogy' | 'find_source' | 'find_target' | 'evaluate' | 'generate';

  // For completion exercises: A is to B as C is to ?
  source?: {
    a: string;
    b: string;
    relation: string;
  };
  target?: {
    c: string;
    d?: string;            // Hidden for completion
    relation?: string;
  };

  // For evaluation exercises
  analogyToEvaluate?: AnalogyMapping;
  evaluationCriteria?: string[];

  // For generation exercises
  generateFromDomain?: KnowledgeDomain;
  generateToDomain?: KnowledgeDomain;
  patternConstraint?: StructuralPatternType;

  // Answer and scoring
  correctAnswer?: string;
  scoringRubric?: {
    criteria: Array<{
      name: string;
      description: string;
      maxPoints: number;
    }>;
    totalPoints: number;
  };

  // Metadata
  difficulty: number;
  patternId: string;
  standardsAddressed: string[];
}

// =============================================================================
// MEDICI EFFECT TYPES (Intersection Innovation)
// =============================================================================

/**
 * Types of intersections between fields
 */
export type IntersectionType =
  | 'concept_transfer'          // Moving a concept from one field to another
  | 'method_transfer'           // Using methods from one field in another
  | 'metaphor_bridge'           // Using metaphors to connect fields
  | 'problem_reframing'         // Reframing a problem through another lens
  | 'combinatorial_innovation'  // Combining elements from multiple fields
  | 'constraint_relaxation';    // Using another field's assumptions

/**
 * A documented intersection innovation
 */
export interface IntersectionCase {
  id: string;
  name: string;
  intersectionType: IntersectionType;

  // The fields involved
  fields: KnowledgeDomain[];

  // The innovation story
  background: string;
  insight: string;
  outcome: string;

  // Analysis
  whatWasTransferred: string;
  whyItWorked: string;
  barriers: string[];
  enablers: string[];

  // Underlying pattern
  patternId: string;

  // Learning exercises
  explorationQuestions: string[];
  analogousOpportunities: Array<{
    fields: KnowledgeDomain[];
    description: string;
    difficulty: number;
  }>;
}

/**
 * Intersection exploration session
 */
export interface IntersectionExploration {
  id: string;
  learnerId: string;
  startedAt: Date;

  // Fields being intersected
  field1: KnowledgeDomain;
  field2: KnowledgeDomain;

  // Brainstorming results
  concepts: Array<{
    field: KnowledgeDomain;
    concept: string;
    description: string;
  }>;

  methods: Array<{
    field: KnowledgeDomain;
    method: string;
    description: string;
  }>;

  problems: Array<{
    field: KnowledgeDomain;
    problem: string;
    description: string;
  }>;

  // Intersection ideas generated
  intersectionIdeas: Array<{
    idea: string;
    intersectionType: IntersectionType;
    conceptsUsed: string[];
    noveltyScore: number;      // Self-rated 0-100
    feasibilityScore: number;  // Self-rated 0-100
    timestamp: Date;
  }>;

  // Quality metrics
  metrics: {
    totalIdeas: number;
    uniqueIntersectionTypes: number;
    averageNovelty: number;
    averageFeasibility: number;
    crossFieldConnections: number;
  };
}

// =============================================================================
// CHUNKING & PATTERN RECOGNITION (Oakley)
// =============================================================================

/**
 * A cognitive chunk - a pattern encoded in long-term memory
 */
export interface CognitiveChunk {
  id: string;
  learnerId: string;

  // What the chunk represents
  patternId: string;
  domain: KnowledgeDomain;
  description: string;

  // Trigger cues (when to activate this chunk)
  triggerCues: string[];

  // Chunk strength
  strength: number;            // 0-100, from spaced repetition
  lastActivated: Date;
  activationCount: number;

  // Connections to other chunks
  linkedChunks: Array<{
    chunkId: string;
    connectionStrength: number;
    connectionType: 'supports' | 'contrasts' | 'specializes' | 'generalizes';
  }>;

  // Transfer history
  transferHistory: Array<{
    toDomain: KnowledgeDomain;
    successful: boolean;
    timestamp: Date;
    notes?: string;
  }>;
}

/**
 * Chunking exercise - building pattern recognition through practice
 */
export interface ChunkingExercise {
  id: string;
  patternId: string;
  exerciseType: 'recognition' | 'recall' | 'application' | 'transfer';

  // The problem
  scenario: string;
  context: string;
  domain: KnowledgeDomain;

  // For recognition: is this pattern present?
  // For recall: what pattern applies here?
  // For application: apply the pattern
  // For transfer: apply pattern from different domain

  // Scaffolding
  hints?: string[];
  workedExample?: string;

  // Correct response
  correctPattern?: string;
  correctApplication?: string;
  explanation: string;

  // Timing
  targetTimeSeconds: number;
  expertTimeSeconds: number;

  // Metadata
  difficulty: number;
  prerequisiteChunks: string[];
}

// =============================================================================
// PATTERN RECOGNITION MANIFOLD DIMENSION
// =============================================================================

/**
 * Pattern Recognition dimension for the learning manifold
 */
export interface PatternRecognitionDimension {
  // Overall score
  overallScore: number;        // 0-100

  // Sub-dimensions
  patternLibrary: {
    score: number;
    chunksAcquired: number;
    chunksActive: number;      // Activated in last 30 days
    averageChunkStrength: number;
    domainCoverage: Record<KnowledgeDomain, number>;
  };

  analogicalReasoning: {
    score: number;
    analogiesCompleted: number;
    averageQuality: AnalogyQuality;
    structuralMappingAccuracy: number;
    inferenceGenerationRate: number;
  };

  crossDomainTransfer: {
    score: number;
    successfulTransfers: number;
    attemptedTransfers: number;
    transferRate: number;
    preferredSourceDomains: KnowledgeDomain[];
    difficultTargetDomains: KnowledgeDomain[];
  };

  intersectionThinking: {
    score: number;
    explorationsSessions: number;
    uniqueIntersectionsFound: number;
    noveltyScoreAverage: number;
    feasibilityScoreAverage: number;
  };

  // History
  history: Array<{
    timestamp: Date;
    scores: {
      patternLibrary: number;
      analogicalReasoning: number;
      crossDomainTransfer: number;
      intersectionThinking: number;
    };
    activity: string;
  }>;
}

// =============================================================================
// PATTERN RECOGNITION STANDARDS
// =============================================================================

/**
 * Pattern Recognition standard identifiers
 */
export type PRStandardId =
  // PR-1: Pattern Recognition Basics
  | 'PR-1.1'  // Identify surface vs. structural similarities
  | 'PR-1.2'  // Recognize common structural patterns
  | 'PR-1.3'  // Describe patterns in domain-agnostic terms
  | 'PR-1.4'  // Build personal pattern library
  // PR-2: Analogical Reasoning
  | 'PR-2.1'  // Complete structural analogies
  | 'PR-2.2'  // Evaluate analogy quality
  | 'PR-2.3'  // Generate analogies from patterns
  | 'PR-2.4'  // Use analogies to make predictions
  // PR-3: Cross-Domain Transfer
  | 'PR-3.1'  // Transfer patterns to novel domains
  | 'PR-3.2'  // Identify transfer opportunities
  | 'PR-3.3'  // Adapt patterns to new contexts
  | 'PR-3.4'  // Combine patterns from multiple domains
  // PR-4: Intersection Innovation
  | 'PR-4.1'  // Explore field intersections systematically
  | 'PR-4.2'  // Generate intersection innovations
  | 'PR-4.3'  // Evaluate intersection ideas
  | 'PR-4.4'; // Design intersection exploration strategies

/**
 * Pattern Recognition standard definition
 */
export interface PRStandard {
  id: PRStandardId;
  category: 'basics' | 'analogical' | 'transfer' | 'intersection';
  title: string;
  description: string;

  performanceIndicators: string[];
  prerequisites: PRStandardId[];
  assessmentTypes: Array<'recognition' | 'completion' | 'generation' | 'transfer' | 'design'>;

  difficultyLevels: {
    recognition: string;
    understanding: string;
    application: string;
    transfer: string;
    creation: string;
  };

  // Integration with Manifold
  manifoldDimensions: {
    coherence: number;
    entropy: number;
    generativity: number;
    patternRecognition: number;
  };
}

// =============================================================================
// ASSESSMENT TYPES
// =============================================================================

/**
 * Pattern Recognition assessment item
 */
export interface PRAssessmentItem {
  id: string;
  itemType:
    | 'pattern_recognition'     // Is this pattern present?
    | 'pattern_naming'          // What pattern is this?
    | 'analogy_completion'      // A:B :: C:?
    | 'analogy_generation'      // Generate analogy for pattern
    | 'transfer_application'    // Apply pattern in new domain
    | 'intersection_design'     // Design intersection exploration
    | 'quality_evaluation';     // Rate analogy quality

  // Content
  stimulus: string;
  question: string;
  domain: KnowledgeDomain;
  targetPattern?: string;

  // Response format
  responseFormat: 'multiple_choice' | 'short_answer' | 'structured' | 'open_ended';
  options?: string[];

  // Scoring
  correctAnswer?: string;
  scoringRubric?: {
    criteria: Array<{
      name: string;
      description: string;
      maxPoints: number;
    }>;
  };

  // IRT parameters
  difficulty: number;
  discrimination: number;

  // Standards
  standardsAddressed: PRStandardId[];
}

/**
 * Pattern Recognition assessment result
 */
export interface PRAssessmentResult {
  id: string;
  learnerId: string;
  assessmentId: string;
  completedAt: Date;

  // Item-level results
  itemResults: Array<{
    itemId: string;
    response: string;
    score: number;
    maxScore: number;
    timeSpentSeconds: number;
    patternRecognized?: boolean;
    analogyQuality?: AnalogyQuality;
  }>;

  // Aggregate scores
  totalScore: number;
  maxScore: number;
  percentScore: number;

  // By standard
  standardScores: Record<PRStandardId, {
    score: number;
    maxScore: number;
    itemsAttempted: number;
  }>;

  // By pattern type
  patternTypeScores: Record<StructuralPatternType, {
    recognized: number;
    missed: number;
    accuracy: number;
  }>;

  // Insights
  strengthPatterns: StructuralPatternType[];
  weaknessPatterns: StructuralPatternType[];
  transferSuccessRate: number;
  recommendedFocus: string[];
}

// =============================================================================
// LEARNING PATH TYPES
// =============================================================================

/**
 * Pattern Recognition learning path
 */
export interface PRLearningPath {
  id: string;
  learnerId: string;

  // Current state
  currentPhase: 'basics' | 'analogical' | 'transfer' | 'intersection';
  currentStandard: PRStandardId;

  // Pattern library building
  patternsIntroduced: string[];
  patternsAcquired: string[];        // Demonstrated mastery
  patternsInProgress: string[];

  // Domain exposure
  domainsExplored: KnowledgeDomain[];
  domainMastery: Record<KnowledgeDomain, number>;

  // Phase progress
  phaseProgress: {
    basics: { completed: number; total: number };
    analogical: { completed: number; total: number };
    transfer: { completed: number; total: number };
    intersection: { completed: number; total: number };
  };

  // Recommended activities
  recommendedPatterns: string[];
  recommendedExercises: string[];
  recommendedIntersections: Array<[KnowledgeDomain, KnowledgeDomain]>;

  // History
  activityHistory: Array<{
    date: Date;
    activityType: 'pattern_lesson' | 'analogy_exercise' | 'transfer_practice' | 'intersection_exploration';
    activityId: string;
    score?: number;
    patternsLearned?: string[];
  }>;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Pattern library entry for curriculum
 */
export interface PatternLibraryEntry {
  pattern: Pattern;
  lessons: Array<{
    id: string;
    title: string;
    duration: number;        // minutes
    content: string;
  }>;
  exercises: ChunkingExercise[];
  analogyExercises: AnalogyExercise[];
  assessmentItems: PRAssessmentItem[];
}

/**
 * Session configuration for pattern recognition training
 */
export interface PRSessionConfig {
  // Focus
  targetPatterns: string[];
  targetDomains: KnowledgeDomain[];

  // Mode
  mode: 'learn' | 'practice' | 'assess' | 'explore';

  // Difficulty
  difficultyRange: [number, number];
  adaptiveDifficulty: boolean;

  // Time
  sessionDuration: number;    // minutes
  itemTimeLimit?: number;     // seconds per item

  // Features
  showHints: boolean;
  showWorkedExamples: boolean;
  enableIntersectionMode: boolean;
}

/**
 * Event tracking for pattern recognition activities
 */
export interface PREvent<T = unknown> {
  timestamp: Date;
  eventType:
    | 'pattern_introduced'
    | 'pattern_practiced'
    | 'pattern_assessed'
    | 'analogy_attempted'
    | 'transfer_attempted'
    | 'intersection_explored'
    | 'chunk_strengthened'
    | 'chunk_decayed';
  learnerId: string;
  data: T;
  manifoldSnapshot: {
    c: number;
    e: number;
    g: number;
    pr: number;
  };
}

export default {
  // Export for easy importing
};
