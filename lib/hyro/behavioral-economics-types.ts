/**
 * Behavioral Economics Types - Hyro Education System
 *
 * @hyro-domain behavioral_economics
 * @hyro-standards BE-1.*, BE-2.*, BE-3.*, BE-4.*
 * @hyro-manifold Extends C/E/G with Epistemic Calibration (EC) and Bias Awareness (BA)
 * @hyro-metacognition Core focus - teaching WHY not just WHAT
 * @hyro-rationale These types support teaching decision-making frameworks and cognitive bias awareness
 *
 * Reference: Heath Brothers "Decisive" - WRAP Framework
 * Reference: Kahneman "Thinking, Fast and Slow" - System 1/System 2
 */

// =============================================================================
// COGNITIVE BIASES
// =============================================================================

/**
 * Enumeration of cognitive biases taught in the curriculum.
 * Each bias includes metadata for transparent teaching (WHY it exists).
 */
export type BiasType =
  | 'confirmation_bias'
  | 'availability_heuristic'
  | 'anchoring_effect'
  | 'loss_aversion'
  | 'sunk_cost_fallacy'
  | 'fundamental_attribution_error'
  | 'hindsight_bias'
  | 'overconfidence_bias'
  | 'status_quo_bias'
  | 'dunning_kruger_effect'
  | 'bandwagon_effect'
  | 'framing_effect'
  | 'halo_effect'
  | 'self_serving_bias'
  | 'negativity_bias';

/**
 * Complete definition of a cognitive bias for educational purposes.
 * Designed for transparent teaching - students understand WHY this exists.
 */
export interface BiasCurriculumEntry {
  id: BiasType;
  name: string;

  // What the bias IS
  definition: string;
  shortDescription: string;

  // WHY it exists (evolutionary/psychological)
  evolutionaryReason: string;
  psychologicalMechanism: string;

  // WHEN it helps vs. hurts
  adaptiveContexts: string[];     // When this bias is actually useful
  maladaptiveContexts: string[];  // When this bias leads us astray

  // HOW to recognize it
  selfRecognitionCues: string[];  // Internal signals
  externalIndicators: string[];   // Observable in others

  // WHAT to do about it
  debiasingStrategies: string[];
  practiceScenarios: string[];

  // Related concepts
  relatedBiases: BiasType[];
  system1vs2: 'system1' | 'system2' | 'both';

  // Educational metadata
  prerequisiteKnowledge: string[];
  difficultyLevel: 'foundational' | 'intermediate' | 'advanced';
  commonMisunderstandings: string[];
}

// =============================================================================
// WRAP DECISION FRAMEWORK (Heath Brothers)
// =============================================================================

/**
 * The WRAP process stages for structured decision-making.
 */
export type WRAPStage = 'widen' | 'reality_test' | 'attain_distance' | 'prepare_wrong';

/**
 * A single WRAP technique within a stage.
 */
export interface WRAPTechnique {
  id: string;
  stage: WRAPStage;
  name: string;
  description: string;
  howToApply: string[];
  examplePrompts: string[];
  commonMistakes: string[];
}

/**
 * Complete WRAP framework definition.
 */
export interface WRAPFramework {
  stages: {
    widen: {
      description: string;
      keyQuestion: string;
      techniques: WRAPTechnique[];
    };
    reality_test: {
      description: string;
      keyQuestion: string;
      techniques: WRAPTechnique[];
    };
    attain_distance: {
      description: string;
      keyQuestion: string;
      techniques: WRAPTechnique[];
    };
    prepare_wrong: {
      description: string;
      keyQuestion: string;
      techniques: WRAPTechnique[];
    };
  };
}

// =============================================================================
// MANIFOLD EXTENSIONS
// =============================================================================

/**
 * Epistemic Calibration dimension - tracks alignment between confidence and accuracy.
 * Extends the base C/E/G Manifold.
 */
export interface EpistemicCalibration {
  // Overall calibration score (0-100)
  // 50 = perfectly calibrated
  // >50 = systematically underconfident
  // <50 = systematically overconfident
  calibrationScore: number;

  // Brier score for probability estimates (lower is better)
  brierScore: number;

  // Per-domain calibration
  domainCalibration: Record<string, {
    score: number;
    sampleSize: number;
    lastUpdated: Date;
  }>;

  // Historical calibration trajectory
  calibrationHistory: Array<{
    timestamp: Date;
    predictedConfidence: number;  // 0-100
    actualAccuracy: number;       // 0-100
    domain: string;
    questionId?: string;
  }>;

  // Calibration by confidence bucket
  calibrationCurve: Array<{
    confidenceBucket: number;  // e.g., 10, 20, 30... 90
    predictedAccuracy: number; // Should equal bucket
    actualAccuracy: number;    // What they actually got
    sampleSize: number;
  }>;
}

/**
 * Bias Awareness dimension - tracks recognition and mitigation of cognitive biases.
 */
export interface BiasAwareness {
  // Overall bias awareness score (0-100)
  overallScore: number;

  // Per-bias recognition ability (0-100)
  // Can they identify when this bias is occurring?
  biasRecognition: Record<BiasType, {
    score: number;
    assessmentCount: number;
    lastAssessed: Date;
    trend: 'improving' | 'stable' | 'declining';
  }>;

  // Per-bias mitigation success (0-100)
  // Can they successfully apply debiasing strategies?
  biasMitigation: Record<BiasType, {
    score: number;
    attemptCount: number;
    successRate: number;
    lastAttempt: Date;
  }>;

  // Meta-awareness: knowing when you're likely to be biased
  situationalAwareness: {
    score: number;
    highRiskSituations: string[];
    personalTriggers: string[];
  };

  // Transfer: applying bias awareness in novel contexts
  transferAbility: {
    score: number;
    successfulTransfers: number;
    totalTransferAttempts: number;
  };
}

/**
 * Decision Quality dimension - tracks quality of decision-making PROCESS.
 * Important: We track process quality, not just outcomes (avoiding outcome bias).
 */
export interface DecisionQuality {
  // Process quality metrics (averaged across decisions)
  processMetrics: {
    optionsGenerated: number;      // Did they widen options? (0-100)
    evidenceSought: number;        // Did they reality-test? (0-100)
    distanceAttained: number;      // Did they avoid emotional decisions? (0-100)
    preparationLevel: number;      // Did they prepare to be wrong? (0-100)
    overallProcessScore: number;   // Weighted average (0-100)
  };

  // Individual decision tracking
  decisionHistory: Array<{
    decisionId: string;
    timestamp: Date;
    context: string;
    stakes: 'low' | 'medium' | 'high';

    // Process quality for this decision
    processScores: {
      widen: number;
      realityTest: number;
      distance: number;
      prepare: number;
    };

    // Outcome (captured later)
    outcome?: {
      assessedAt: Date;
      outcomeQuality: number;  // 0-100
      wasLuckFactor: boolean;
      reflection: string;
    };
  }>;

  // Process-outcome correlation analysis
  correlation: {
    processOutcomeCorrelation: number;  // -1 to 1
    sampleSize: number;
    confidenceInterval: [number, number];
  };
}

// =============================================================================
// METACOGNITION LAYER
// =============================================================================

/**
 * The four phases of metacognitive regulation.
 */
export type MetacognitionPhase = 'prediction' | 'monitoring' | 'evaluation' | 'regulation';

/**
 * Enhanced metacognition tracking that emphasizes UNDERSTANDING over memorization.
 */
export interface EnhancedMetacognition {
  // Per-phase scores
  phaseScores: Record<MetacognitionPhase, {
    score: number;
    assessmentCount: number;
    lastAssessed: Date;
  }>;

  // WHY understanding tracking
  whyUnderstanding: {
    // Can they explain WHY something is taught?
    curriculumAwareness: number;  // 0-100

    // Can they connect new learning to existing knowledge?
    schemaIntegration: number;    // 0-100

    // Can they identify when to apply learning?
    transferRecognition: number;  // 0-100

    // Can they generate novel applications?
    applicationGeneration: number;  // 0-100
  };

  // Understanding vs. Memorization detection
  understandingIndicators: {
    // Can explain in own words
    paraphrasingAbility: number;

    // Can generate examples
    exampleGeneration: number;

    // Can identify non-examples
    boundaryRecognition: number;

    // Can apply to novel situations
    farTransfer: number;

    // Resists surface changes (same concept, different framing)
    conceptualStability: number;
  };

  // Calibration between felt understanding and actual understanding
  illusionOfKnowledgeIndex: number;  // 0-100, higher = more illusion
}

// =============================================================================
// LEARNING TECHNIQUES (Manifold-Level)
// =============================================================================

/**
 * Learning techniques tracked at the Manifold level.
 */
export type LearningTechnique =
  | 'retrieval_practice'
  | 'spaced_repetition'
  | 'interleaving'
  | 'elaborative_interrogation'
  | 'concrete_examples'
  | 'dual_coding'
  | 'self_explanation'
  | 'deliberate_practice';

/**
 * Per-learner technique effectiveness profile.
 */
export interface TechniqueProfile {
  techniqueId: LearningTechnique;

  // Empirical effectiveness from their history
  measuredEffectSize: number;  // Cohen's d equivalent

  // Model prediction based on similar learners
  predictedEffectSize: number;

  // Confidence in our estimate
  confidenceInterval: [number, number];

  // Sample size for this estimate
  sampleSize: number;

  // When was this last updated?
  lastUpdated: Date;

  // Trend over time
  effectTrend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Complete learner technique profile.
 */
export interface LearnerTechniqueProfile {
  learnerId: string;

  // Per-technique effectiveness
  techniqueEffectiveness: Record<LearningTechnique, TechniqueProfile>;

  // Optimal technique combinations
  techniqueSynergies: Array<{
    techniques: LearningTechnique[];
    combinedEffect: number;
    sampleSize: number;
  }>;

  // Anti-patterns for this learner
  techniqueInterference: Array<{
    techniques: LearningTechnique[];
    negativeEffect: number;
    sampleSize: number;
  }>;

  // Domain-specific technique preferences
  domainPreferences: Record<string, {
    preferredTechniques: LearningTechnique[];
    avoidTechniques: LearningTechnique[];
  }>;
}

// =============================================================================
// BEHAVIORAL ECONOMICS CURRICULUM STANDARDS
// =============================================================================

/**
 * Behavioral Economics standard identifiers.
 */
export type BEStandardId =
  // BE-1: Cognitive Biases
  | 'BE-1.1'  // Identify confirmation bias
  | 'BE-1.2'  // Apply availability heuristic awareness
  | 'BE-1.3'  // Recognize anchoring
  | 'BE-1.4'  // Understand loss aversion
  | 'BE-1.5'  // Identify sunk cost fallacy
  // BE-2: Decision Frameworks
  | 'BE-2.1'  // Apply WRAP process
  | 'BE-2.2'  // Use 10/10/10 technique
  | 'BE-2.3'  // Implement pre-commitment
  | 'BE-2.4'  // Create effective tripwires
  // BE-3: Calibration
  | 'BE-3.1'  // Make calibrated probability estimates
  | 'BE-3.2'  // Track prediction accuracy
  | 'BE-3.3'  // Distinguish skill from luck
  | 'BE-3.4'  // Maintain decision journals
  // BE-4: Metacognition
  | 'BE-4.1'  // Predict own learning
  | 'BE-4.2'  // Monitor comprehension
  | 'BE-4.3'  // Evaluate strategy effectiveness
  | 'BE-4.4';  // Regulate learning based on feedback

/**
 * A single behavioral economics standard.
 */
export interface BEStandard {
  id: BEStandardId;
  category: 'biases' | 'frameworks' | 'calibration' | 'metacognition';
  title: string;
  description: string;

  // What the student should be able to DO
  performanceIndicators: string[];

  // Prerequisites
  prerequisites: BEStandardId[];

  // Assessment approaches
  assessmentTypes: Array<'scenario' | 'reflection' | 'prediction' | 'application' | 'transfer'>;

  // Difficulty progression
  difficultyLevels: {
    recognition: string;   // Can identify
    understanding: string; // Can explain why
    application: string;   // Can apply
    transfer: string;      // Can apply in novel contexts
    creation: string;      // Can design new applications
  };

  // Integration with Manifold
  manifoldDimensions: {
    coherence: number;    // How much this affects C
    entropy: number;      // How much this affects E
    generativity: number; // How much this affects G
  };
}

// =============================================================================
// EXTENDED COGNITIVE MANIFOLD
// =============================================================================

/**
 * Extended Manifold state that includes behavioral economics dimensions.
 */
export interface ExtendedManifoldState {
  // Original C/E/G dimensions
  coherence: number;      // 0-100
  entropy: number;        // 0-100
  generativity: number;   // 0-100

  // New behavioral economics dimensions
  epistemicCalibration: EpistemicCalibration;
  biasAwareness: BiasAwareness;
  decisionQuality: DecisionQuality;
  enhancedMetacognition: EnhancedMetacognition;

  // Learning technique profile
  techniqueProfile: LearnerTechniqueProfile;

  // Version and timestamp
  version: string;
  lastUpdated: Date;
}

// =============================================================================
// QUESTION TYPES FOR BEHAVIORAL ECONOMICS
// =============================================================================

/**
 * Types of questions used in behavioral economics curriculum.
 */
export type BEQuestionType =
  | 'bias_recognition'      // Identify which bias is at play
  | 'bias_explanation'      // Explain why the bias exists
  | 'debiasing_selection'   // Choose best debiasing strategy
  | 'scenario_analysis'     // Analyze a decision scenario
  | 'wrap_application'      // Apply WRAP to a decision
  | 'probability_estimate'  // Make calibrated estimates
  | 'metacognitive_prompt'  // Reflect on own thinking
  | 'transfer_challenge';   // Apply to novel domain

/**
 * A behavioral economics assessment question.
 */
export interface BEQuestion {
  id: string;
  type: BEQuestionType;
  standardsAddressed: BEStandardId[];

  // Question content
  scenario: string;
  question: string;
  options?: string[];  // For multiple choice

  // Correct answer and explanation
  correctAnswer: string;
  explanation: {
    why: string;      // WHY this is correct
    common_errors: string[];
    deeper_understanding: string;
  };

  // IRT parameters
  difficulty: number;  // -3 to +3
  discrimination: number;

  // Manifold targeting
  targetManifold: {
    minCoherence?: number;
    minEntropy?: number;
    minGenerativity?: number;
    targetBiasAwareness?: BiasType[];
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * A timestamped event for any behavioral economics activity.
 */
export interface BEEvent<T = unknown> {
  timestamp: Date;
  eventType: string;
  learnerId: string;
  data: T;
  manifoldSnapshot: {
    c: number;
    e: number;
    g: number;
  };
}

/**
 * Configuration for behavioral economics module.
 */
export interface BEModuleConfig {
  // Which biases to include in curriculum
  enabledBiases: BiasType[];

  // WRAP stages to teach
  enabledWRAPStages: WRAPStage[];

  // Metacognition depth
  metacognitionLevel: 'basic' | 'intermediate' | 'advanced';

  // Calibration training frequency
  calibrationFrequency: 'every_session' | 'weekly' | 'on_demand';

  // Decision journaling
  journalingRequired: boolean;

  // Integration with existing curriculum
  crossCurriculumIntegration: boolean;
}

export default {
  // Export all types for easy importing
};
