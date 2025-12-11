/**
 * Neuroscience Integration Types - Hyro Education System
 *
 * @hyro-domain brain_based_learning
 * @hyro-standards NS-BRAIN-1.*, NS-BRAIN-2.*, NS-BRAIN-3.*, NS-BRAIN-4.*
 * @hyro-manifold Integrates with C/E/G manifold and meta-dimensions
 * @hyro-rationale Applies cutting-edge neuroscience research to optimize learning
 *
 * PURPOSE:
 * Integrates neuroscience principles from leading researchers into the learning
 * system to optimize memory formation, emotional regulation, attention management,
 * and metacognitive awareness.
 *
 * KEY RESEARCHERS & CONTRIBUTIONS:
 * - Michael Gazzaniga: Split-brain research, interpreter module, narrative self
 * - David Eagleman: Neuroplasticity, time perception, sensory substitution
 * - Joseph LeDoux: Emotional brain, amygdala, fear/anxiety circuits
 * - Robert Sapolsky: Stress, dopamine, behavioral biology
 * - Stanislas Dehaene: Conscious access, reading brain, number sense
 * - Barbara Oakley: Learning how to learn, chunking, diffuse/focused modes
 */

// =============================================================================
// BRAIN SYSTEM FOUNDATIONS
// =============================================================================

/**
 * Major brain systems relevant to learning
 * Based on Gazzaniga's cognitive neuroscience framework
 */
export type BrainSystem =
  | 'prefrontal_cortex'      // Executive function, planning, decision-making
  | 'hippocampus'            // Memory consolidation, spatial navigation
  | 'amygdala'               // Emotional processing, threat detection
  | 'basal_ganglia'          // Habit formation, procedural learning
  | 'cerebellum'             // Motor learning, timing, prediction
  | 'anterior_cingulate'     // Error detection, conflict monitoring
  | 'insula'                 // Interoception, emotional awareness
  | 'parietal_cortex'        // Attention, spatial processing
  | 'temporal_cortex'        // Language, semantic memory
  | 'occipital_cortex'       // Visual processing
  | 'default_mode_network'   // Self-reflection, mind wandering
  | 'salience_network';      // Attention switching, relevance detection

/**
 * Neurotransmitter systems that modulate learning
 * Based on Sapolsky's behavioral endocrinology
 */
export type NeurotransmitterSystem =
  | 'dopamine'      // Reward, motivation, prediction error
  | 'norepinephrine'// Alertness, attention, arousal
  | 'serotonin'     // Mood, patience, long-term thinking
  | 'acetylcholine' // Attention, memory consolidation
  | 'gaba'          // Inhibition, calming, focus
  | 'glutamate'     // Excitation, learning, plasticity
  | 'cortisol'      // Stress response (hormone but critical)
  | 'oxytocin';     // Social bonding, trust (hormone)

/**
 * Learning modes based on brain states
 * Based on Oakley's focused vs diffuse modes
 */
export type LearningMode =
  | 'focused'        // High attention, sequential processing, prefrontal active
  | 'diffuse'        // Relaxed, background processing, default mode active
  | 'flow'           // Optimal engagement, balanced arousal
  | 'interleaved'    // Switching between topics/modes
  | 'retrieval'      // Active recall, memory strengthening
  | 'elaborative'    // Connecting to existing knowledge
  | 'generative';    // Creating new connections/outputs

/**
 * Memory types and their neural substrates
 */
export type MemoryType =
  | 'working'        // Active manipulation (prefrontal cortex)
  | 'episodic'       // Personal experiences (hippocampus)
  | 'semantic'       // Facts and concepts (temporal cortex)
  | 'procedural'     // Skills and habits (basal ganglia, cerebellum)
  | 'emotional'      // Affect-laden memories (amygdala)
  | 'prospective';   // Future intentions (prefrontal)

/**
 * Attention types relevant to learning
 */
export type AttentionType =
  | 'sustained'      // Maintaining focus over time
  | 'selective'      // Filtering relevant from irrelevant
  | 'divided'        // Managing multiple streams (limited)
  | 'executive'      // Top-down control
  | 'alerting';      // Readiness to respond

// =============================================================================
// NEUROPLASTICITY & LEARNING
// =============================================================================

/**
 * Neuroplasticity mechanisms
 * Based on Eagleman's neuroplasticity research
 */
export type PlasticityMechanism =
  | 'synaptic_strengthening'   // LTP - Long-term potentiation
  | 'synaptic_weakening'       // LTD - Long-term depression
  | 'synaptogenesis'           // New synapse formation
  | 'synaptic_pruning'         // Elimination of unused connections
  | 'neurogenesis'             // New neuron formation (hippocampus)
  | 'myelination'              // Increased signal speed
  | 'dendritic_growth'         // Expansion of dendritic trees
  | 'receptor_changes';        // Changes in receptor density

/**
 * Factors that enhance neuroplasticity
 */
export interface PlasticityEnhancer {
  id: string;
  name: string;
  mechanism: PlasticityMechanism;
  description: string;

  // Implementation
  practicalApplications: string[];
  contraindications: string[];

  // Timing
  optimalDuration: number;        // Minutes
  optimalFrequency: string;       // e.g., "daily", "3x/week"

  // Evidence
  researchSupport: 'strong' | 'moderate' | 'emerging';
  keyCitations: string[];
}

/**
 * Sleep stages and their learning functions
 * Critical for memory consolidation
 */
export interface SleepStage {
  stage: 'N1' | 'N2' | 'N3' | 'REM';
  name: string;
  learningFunction: string;
  memoryTypes: MemoryType[];
  brainwavePattern: string;
  typicalDuration: number;        // Minutes per cycle
}

/**
 * Circadian effects on learning
 */
export interface CircadianLearningWindow {
  timeRange: { start: string; end: string };  // "09:00" - "12:00"
  optimalFor: LearningMode[];
  cognitiveStrengths: string[];
  cognitiveWeaknesses: string[];
  hormonalState: Record<NeurotransmitterSystem, 'high' | 'moderate' | 'low'>;
}

// =============================================================================
// EMOTIONAL REGULATION
// =============================================================================

/**
 * Emotional states relevant to learning
 * Based on LeDoux's emotional brain research
 */
export type EmotionalState =
  | 'curious'        // Approach motivation, dopamine active
  | 'anxious'        // Threat detection, amygdala hyperactive
  | 'frustrated'     // Goal blockage, ACC active
  | 'bored'          // Under-stimulation, low arousal
  | 'engaged'        // Optimal arousal, balanced
  | 'confident'      // Self-efficacy, reward anticipation
  | 'overwhelmed'    // Cognitive overload, stress response
  | 'calm'           // Parasympathetic dominant
  | 'excited';       // High arousal, positive valence

/**
 * Arousal level for Yerkes-Dodson curve
 */
export type ArousalLevel =
  | 'very_low'    // Under-aroused, disengaged
  | 'low'         // Relaxed, diffuse thinking possible
  | 'moderate'    // Optimal for most learning
  | 'high'        // Good for simple/practiced tasks
  | 'very_high';  // Stress response, impaired complex cognition

/**
 * Stress response stages (Sapolsky)
 */
export type StressStage =
  | 'eustress'           // Positive stress, enhances performance
  | 'acute_manageable'   // Short-term, recoverable
  | 'prolonged'          // Extended but not chronic
  | 'chronic'            // Harmful, impairs learning
  | 'recovery';          // Post-stress restoration

/**
 * Emotion regulation strategies
 * Evidence-based approaches
 */
export interface EmotionRegulationStrategy {
  id: string;
  name: string;
  type: 'cognitive' | 'behavioral' | 'physiological' | 'social';

  // When to use
  targetEmotions: EmotionalState[];
  contraindicated: EmotionalState[];

  // How it works
  mechanism: string;
  brainSystems: BrainSystem[];

  // Implementation
  steps: string[];
  durationMinutes: number;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';

  // Effectiveness
  effectivenessRating: number;  // 0-100
  researchSupport: string[];
}

/**
 * Amygdala hijack detection and recovery
 * Based on LeDoux's fear circuit research
 */
export interface AmygdalaHijackProfile {
  studentId: string;

  // Triggers (personalized)
  knownTriggers: Array<{
    trigger: string;
    category: 'academic' | 'social' | 'time_pressure' | 'failure' | 'comparison';
    intensity: number;          // 0-100
    frequency: 'rare' | 'occasional' | 'frequent';
  }>;

  // Early warning signs
  physicalSigns: string[];      // e.g., "increased heart rate", "shallow breathing"
  cognitiveSign: string[];      // e.g., "catastrophizing", "mind going blank"
  behavioralSigns: string[];    // e.g., "avoidance", "rushing"

  // Recovery strategies (personalized effectiveness)
  effectiveStrategies: Array<{
    strategyId: string;
    effectivenessForStudent: number;  // 0-100
    notes: string;
  }>;

  // Recovery time
  typicalRecoveryMinutes: number;
  lastOccurrence: Date | null;
}

// =============================================================================
// ATTENTION & COGNITIVE LOAD
// =============================================================================

/**
 * Cognitive load types (Sweller)
 */
export type CognitiveLoadType =
  | 'intrinsic'      // Inherent difficulty of material
  | 'extraneous'     // Poor instructional design
  | 'germane';       // Productive learning effort

/**
 * Working memory model (Baddeley)
 */
export interface WorkingMemoryProfile {
  studentId: string;

  // Component capacities (estimated)
  phonologicalLoop: {
    capacity: number;           // Items (typically 4-7)
    decayRate: number;          // Seconds without rehearsal
    rehearsalSpeed: number;     // Items per second
  };

  visuospatialSketchpad: {
    capacity: number;           // Objects/locations
    spatialResolution: number;  // Detail level
  };

  centralExecutive: {
    attentionSwitchingCost: number;   // Milliseconds
    inhibitionStrength: number;        // 0-100
    updateEfficiency: number;          // 0-100
  };

  episodicBuffer: {
    integrationCapacity: number;       // Multimodal chunks
    bindingEfficiency: number;         // 0-100
  };

  // Overall metrics
  overallCapacity: number;      // Composite score
  optimalLoadLevel: number;     // Target cognitive load
  overloadThreshold: number;    // Point of performance decline
}

/**
 * Attention profile for a student
 */
export interface AttentionProfile {
  studentId: string;
  assessedAt: Date;

  // Attention capacities by type
  capacities: Record<AttentionType, {
    baselineScore: number;      // 0-100
    fatigueRate: number;        // Decline per hour
    optimalDuration: number;    // Minutes at peak
    recoveryTime: number;       // Minutes to restore
  }>;

  // Circadian pattern
  peakAttentionTime: string;    // "10:00"
  secondaryPeak: string | null; // "15:00"
  lowPoints: string[];          // ["14:00"]

  // Distractibility factors
  vulnerabilities: Array<{
    distractor: string;
    category: 'auditory' | 'visual' | 'internal' | 'social' | 'digital';
    impact: number;             // 0-100
    mitigations: string[];
  }>;

  // Environmental preferences
  optimalEnvironment: {
    noiseLevel: 'silent' | 'ambient' | 'music' | 'varies';
    visualClutter: 'minimal' | 'moderate' | 'comfortable';
    temperature: 'cool' | 'moderate' | 'warm';
    lighting: 'dim' | 'moderate' | 'bright' | 'natural';
  };
}

// =============================================================================
// METACOGNITION & SELF-AWARENESS
// =============================================================================

/**
 * Metacognitive skill areas
 */
export type MetacognitiveSkill =
  | 'self_monitoring'        // Awareness of own thinking
  | 'strategy_selection'     // Choosing learning approaches
  | 'progress_evaluation'    // Judging learning progress
  | 'effort_allocation'      // Deciding where to focus
  | 'error_detection'        // Noticing mistakes
  | 'confidence_calibration' // Accuracy of self-assessment
  | 'planning'               // Setting learning goals
  | 'reflection';            // Post-learning analysis

/**
 * The interpreter module (Gazzaniga)
 * Left hemisphere narrative construction
 */
export interface InterpreterAwareness {
  studentId: string;

  // Awareness of biases
  recognizedBiases: Array<{
    biasType: string;          // e.g., "confirmation_bias", "hindsight_bias"
    selfRating: number;        // 0-100 awareness
    observedInstances: number;
    mitigationStrategies: string[];
  }>;

  // Narrative tendencies
  narrativePatterns: Array<{
    pattern: string;           // e.g., "attribution to effort", "attribution to ability"
    frequency: number;         // 0-100
    accuracy: number;          // How accurate these narratives typically are
    adaptiveness: number;      // How helpful they are
  }>;

  // Confabulation awareness
  confabulationAwareness: {
    score: number;             // 0-100
    commonTriggers: string[];
    recoveryStrategies: string[];
  };

  // Growth vs fixed mindset indicators
  mindsetIndicators: {
    growthMindsetScore: number;
    challengeResponse: 'approach' | 'avoid' | 'mixed';
    effortBeliefs: 'positive' | 'negative' | 'mixed';
    failureAttribution: 'learning' | 'ability' | 'mixed';
  };
}

/**
 * Metacognitive profile for learning optimization
 */
export interface MetacognitiveProfile {
  studentId: string;
  assessedAt: Date;

  // Skill levels
  skills: Record<MetacognitiveSkill, {
    level: number;             // 0-100
    trend: 'improving' | 'stable' | 'declining';
    lastPracticed: Date;
  }>;

  // Calibration metrics
  calibration: {
    overallAccuracy: number;   // How accurate are self-assessments
    bias: 'overconfident' | 'underconfident' | 'calibrated';
    biasAmount: number;        // Percentage over/under
    domainVariation: Record<string, number>;  // Accuracy by subject
  };

  // Learning strategy repertoire
  strategyRepertoire: Array<{
    strategy: string;
    proficiency: number;
    frequencyOfUse: number;
    appropriatenessOfUse: number;  // Uses it in right contexts
  }>;

  // Illusions of learning detection
  illusionsOfLearning: {
    fluencyIllusion: number;      // Mistaking familiarity for understanding
    exposureIllusion: number;     // Mistaking exposure for learning
    planningFallacy: number;      // Underestimating time needed
    cramBelief: number;           // Belief in massed practice
  };
}

// =============================================================================
// DOPAMINE & MOTIVATION SYSTEMS
// =============================================================================

/**
 * Reward sensitivity profile
 * Based on Sapolsky's dopamine research
 */
export interface RewardSensitivityProfile {
  studentId: string;

  // Baseline dopamine traits
  baselineMotivation: number;     // 0-100
  rewardSensitivity: number;      // Response to rewards
  punishmentSensitivity: number;  // Response to losses
  noveltySeeking: number;         // Drive for new experiences

  // Temporal discounting
  delayDiscounting: {
    rate: number;                 // Higher = more impulsive
    consistentWithPeers: boolean;
    improvementTrend: 'improving' | 'stable' | 'worsening';
  };

  // Reward preferences
  preferredRewardTypes: Array<{
    type: 'points' | 'badges' | 'progress' | 'social' | 'autonomy' | 'mastery' | 'verbal';
    effectiveness: number;        // 0-100
    sustainedEffect: boolean;     // Does it maintain motivation?
  }>;

  // Dopamine management
  dopaminePatterns: {
    peakResponseTo: string[];     // What generates strongest response
    habituation: {
      rate: number;               // How quickly rewards lose effect
      varietyNeeded: number;      // 0-100
    };
    anticipationVsDelivery: number;  // -100 to +100, preference for anticipation vs receipt
  };
}

/**
 * Motivation state tracking
 */
export interface MotivationState {
  studentId: string;
  timestamp: Date;

  // Current state
  overallMotivation: number;      // 0-100
  intrinsicMotivation: number;
  extrinsicMotivation: number;

  // Self-determination theory needs
  autonomyNeed: { current: number; satisfied: number };
  competenceNeed: { current: number; satisfied: number };
  relatednessNeed: { current: number; satisfied: number };

  // Goal orientation
  masteryGoalOrientation: number;
  performanceApproach: number;
  performanceAvoidance: number;

  // Burnout indicators
  burnoutRisk: {
    exhaustion: number;
    cynicism: number;
    reducedEfficacy: number;
    overallRisk: 'low' | 'moderate' | 'high';
  };
}

// =============================================================================
// BRAIN-BASED LEARNING PRINCIPLES
// =============================================================================

/**
 * Core neuroscience-based learning principles
 */
export interface NeurosciencePrinciple {
  id: string;
  name: string;
  category: 'memory' | 'attention' | 'emotion' | 'motivation' | 'plasticity' | 'metacognition';

  // Scientific basis
  description: string;
  brainMechanisms: string[];
  brainSystems: BrainSystem[];
  neurotransmitters: NeurotransmitterSystem[];

  // Research foundation
  keyResearchers: string[];
  keyCitations: string[];
  evidenceStrength: 'strong' | 'moderate' | 'emerging';

  // Practical application
  learningImplications: string[];
  teachingStrategies: string[];
  studentStrategies: string[];
  commonMisapplications: string[];

  // Integration with Hyro
  relevantMetaDimensions: string[];
  cegEffects: {
    coherence: number;          // -100 to +100
    entropy: number;
    generativity: number;
  };
}

/**
 * Brain-compatible learning session design
 */
export interface BrainOptimizedSession {
  id: string;
  subject: string;
  duration: number;             // Minutes

  // Timing optimization
  optimalTimeOfDay: string[];
  circadianAlignment: boolean;

  // Cognitive load management
  phases: Array<{
    name: string;
    duration: number;
    learningMode: LearningMode;
    cognitiveLoadTarget: number;
    brainSystemsEngaged: BrainSystem[];
    activities: string[];
  }>;

  // Break structure (based on attention research)
  breakSchedule: {
    workInterval: number;       // Minutes (Pomodoro-like)
    microBreakDuration: number;
    majorBreakInterval: number;
    majorBreakDuration: number;
    breakActivities: string[];
  };

  // Emotional arc
  emotionalDesign: {
    openingEmotion: EmotionalState;
    targetEngagement: number;
    challengeGradient: number[]; // Difficulty curve through session
    closingEmotion: EmotionalState;
  };

  // Memory consolidation hooks
  consolidationSupport: {
    spacedReviewPoints: number[];  // Minutes from start
    retrievalPracticeFrequency: number;
    interleaving: boolean;
    sleepDependentContent: boolean;
  };
}

// =============================================================================
// NEUROSCIENCE STANDARDS
// =============================================================================

/**
 * Standard IDs for neuroscience learning objectives
 */
export type NSStandardId =
  // Memory & Learning (NS-MEM)
  | 'NS-MEM-1.1'   // Understand memory types and their functions
  | 'NS-MEM-1.2'   // Apply spaced practice principles
  | 'NS-MEM-1.3'   // Use retrieval practice effectively
  | 'NS-MEM-1.4'   // Leverage interleaving for retention
  | 'NS-MEM-2.1'   // Understand sleep's role in consolidation
  | 'NS-MEM-2.2'   // Apply chunking for working memory
  | 'NS-MEM-2.3'   // Use elaboration for semantic encoding

  // Attention & Focus (NS-ATT)
  | 'NS-ATT-1.1'   // Recognize attention as limited resource
  | 'NS-ATT-1.2'   // Manage cognitive load effectively
  | 'NS-ATT-1.3'   // Alternate focused and diffuse modes
  | 'NS-ATT-2.1'   // Identify personal attention patterns
  | 'NS-ATT-2.2'   // Apply environment optimization
  | 'NS-ATT-2.3'   // Use strategic breaks for restoration

  // Emotion & Stress (NS-EMO)
  | 'NS-EMO-1.1'   // Understand emotion-cognition interaction
  | 'NS-EMO-1.2'   // Recognize stress effects on learning
  | 'NS-EMO-1.3'   // Apply emotion regulation strategies
  | 'NS-EMO-2.1'   // Identify amygdala hijack signs
  | 'NS-EMO-2.2'   // Use arousal optimization techniques
  | 'NS-EMO-2.3'   // Cultivate productive emotional states

  // Motivation & Reward (NS-MOT)
  | 'NS-MOT-1.1'   // Understand dopamine's role in motivation
  | 'NS-MOT-1.2'   // Apply reward timing principles
  | 'NS-MOT-1.3'   // Balance intrinsic and extrinsic motivation
  | 'NS-MOT-2.1'   // Manage temporal discounting
  | 'NS-MOT-2.2'   // Design effective goal structures
  | 'NS-MOT-2.3'   // Maintain sustainable motivation

  // Metacognition & Self-Awareness (NS-META)
  | 'NS-META-1.1'  // Recognize illusions of learning
  | 'NS-META-1.2'  // Calibrate confidence accurately
  | 'NS-META-1.3'  // Monitor comprehension in real-time
  | 'NS-META-2.1'  // Understand interpreter module biases
  | 'NS-META-2.2'  // Develop growth mindset foundations
  | 'NS-META-2.3'  // Apply strategic self-reflection

  // Neuroplasticity & Development (NS-PLAST)
  | 'NS-PLAST-1.1' // Understand brain changeability
  | 'NS-PLAST-1.2' // Apply deliberate practice principles
  | 'NS-PLAST-1.3' // Leverage sensitive periods
  | 'NS-PLAST-2.1' // Support myelination through practice
  | 'NS-PLAST-2.2' // Use enriched environments
  | 'NS-PLAST-2.3' // Balance challenge and support;

/**
 * Neuroscience standard definition
 */
export interface NSStandard {
  id: NSStandardId;
  title: string;
  description: string;
  category: 'memory' | 'attention' | 'emotion' | 'motivation' | 'metacognition' | 'plasticity';

  // Learning objectives
  objectives: string[];
  prerequisites: NSStandardId[];

  // Assessment criteria
  assessmentCriteria: string[];
  masteryIndicators: string[];

  // Practical applications
  practiceActivities: string[];
  realWorldApplications: string[];

  // Difficulty and sequencing
  difficultyLevel: number;        // 1-10
  suggestedGradeRange: string;    // e.g., "6-8"
  estimatedHours: number;
}

// =============================================================================
// NEUROSCIENCE DIMENSION
// =============================================================================

/**
 * Neuroscience-based learning dimension for state tracking
 * Extension of the manifold system
 */
export interface NeuroscienceDimension {
  overallScore: number;           // 0-100 composite

  memoryOptimization: {
    score: number;
    spacedPracticeAdherence: number;
    retrievalPracticeUse: number;
    interleavingApplication: number;
    sleepConsistency: number;
  };

  attentionManagement: {
    score: number;
    sustainedFocusDuration: number;   // Minutes average
    distractionResistance: number;
    modeFlexibility: number;          // Focused/diffuse switching
    breakEffectiveness: number;
  };

  emotionalRegulation: {
    score: number;
    arousalOptimization: number;
    stressManagement: number;
    recoverySpeed: number;
    emotionalAwareness: number;
  };

  motivationSustainability: {
    score: number;
    intrinsicDrive: number;
    delayTolerance: number;
    goalPersistence: number;
    burnoutResistance: number;
  };

  metacognitiveAccuracy: {
    score: number;
    confidenceCalibration: number;
    strategySelection: number;
    progressMonitoring: number;
    illusionResistance: number;       // Resisting illusions of learning
  };

  plasticityEngagement: {
    score: number;
    challengeSeeking: number;
    effortInvestment: number;
    growthMindsetStrength: number;
    feedbackUtilization: number;
  };
}

// =============================================================================
// EXERCISES & ASSESSMENTS
// =============================================================================

/**
 * Neuroscience learning exercise
 */
export interface NSExercise {
  id: string;
  standardId: NSStandardId;
  title: string;

  // Content
  description: string;
  instructions: string[];
  durationMinutes: number;

  // Type
  type: 'reflection' | 'experiment' | 'practice' | 'analysis' | 'application';
  mode: LearningMode;

  // Brain engagement
  targetBrainSystems: BrainSystem[];
  cognitiveLoadLevel: number;      // 1-10

  // Assessment
  successCriteria: string[];
  rubric: Array<{
    level: number;
    description: string;
    examples: string[];
  }>;

  // Scaffolding
  difficulty: number;              // 1-10
  hints: string[];
  prerequisiteExercises: string[];
}

/**
 * Self-experiment for neuroscience learning
 * Students test principles on themselves
 */
export interface NSSelfExperiment {
  id: string;
  standardId: NSStandardId;
  title: string;

  // Hypothesis
  principle: string;
  hypothesis: string;

  // Protocol
  controlCondition: string;
  experimentalCondition: string;
  duration: string;               // e.g., "1 week"
  measurementMethod: string;

  // Data collection
  dataPoints: Array<{
    name: string;
    type: 'numeric' | 'categorical' | 'text';
    frequency: string;            // e.g., "daily", "after each session"
  }>;

  // Analysis
  expectedOutcome: string;
  howToInterpret: string;
  personalVariables: string[];    // Individual differences to consider

  // Reflection
  reflectionPrompts: string[];
}

export default {};
