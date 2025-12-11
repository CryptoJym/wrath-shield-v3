/**
 * Decision Framework Types - Hyro Education System
 *
 * @hyro-domain decision_science
 * @hyro-standards DS-1.*, DS-2.*, DS-3.*, DS-4.*
 * @hyro-manifold Extends C/E/G with Decision Quality (DQ) and Strategic Thinking (ST)
 * @hyro-metacognition Core focus - teaching structured decision-making processes
 *
 * Reference: Heath Brothers "Decisive" - WRAP Framework (extended)
 * Reference: Gary Klein "Sources of Power" - Pre-mortem technique
 * Reference: Thaler & Sunstein "Nudge" - Choice Architecture
 * Reference: Annie Duke "Thinking in Bets" - Probabilistic Thinking
 */

// =============================================================================
// PRE-MORTEM SYSTEM (Gary Klein)
// =============================================================================

/**
 * Pre-mortem analysis: Imagine failure BEFORE the decision, not after
 * This counters planning fallacy and overconfidence
 */
export interface PreMortemAnalysis {
  id: string;
  decisionId: string;

  // Setup
  decision: string;
  stakeholders: string[];
  timeframe: string;
  createdAt: Date;

  // The "failure" scenario
  failureScenario: {
    dateOfFailure: string;  // "6 months from now"
    description: string;    // "This decision failed spectacularly because..."
    severity: 'minor' | 'moderate' | 'severe' | 'catastrophic';
  };

  // Brainstormed causes of failure (key output)
  failureCauses: Array<{
    id: string;
    cause: string;
    likelihood: number;      // 0-100
    impact: number;          // 0-100
    riskScore: number;       // likelihood * impact / 100
    category: 'internal' | 'external' | 'execution' | 'assumption' | 'unknown';
    detectionDifficulty: 'easy' | 'moderate' | 'hard' | 'very_hard';
  }>;

  // Mitigation plans (action items)
  mitigations: Array<{
    id: string;
    failureCauseId: string;
    action: string;
    owner: string;
    deadline: string;
    status: 'planned' | 'in_progress' | 'completed' | 'abandoned';
    effectiveness: number | null;  // 0-100, assessed later
  }>;

  // Tripwires from pre-mortem
  tripwires: Array<{
    id: string;
    failureCauseId: string;
    condition: string;         // Specific, measurable
    action: string;            // What to do when triggered
    checkFrequency: string;    // "weekly", "monthly", etc.
    lastChecked: Date | null;
    triggered: boolean;
    triggeredAt: Date | null;
  }>;

  // Post-implementation review
  postMortemLink?: string;  // Link to actual outcome analysis
}

/**
 * Pre-mortem session state for interactive exercises
 */
export interface PreMortemSession {
  id: string;
  learnerId: string;
  decision: string;
  phase: 'setup' | 'imagine_failure' | 'brainstorm' | 'prioritize' | 'mitigate' | 'review';

  // Time-boxed brainstorming
  brainstormStartTime: Date | null;
  brainstormDuration: number;  // minutes

  // Participant contributions (for group exercises)
  contributions: Array<{
    participantId: string;
    failureCause: string;
    timestamp: Date;
  }>;

  // Final analysis
  analysis: PreMortemAnalysis | null;

  // Learning metrics
  metrics: {
    causesGenerated: number;
    uniqueCategories: number;
    mitigationsPlanned: number;
    tripwiresSet: number;
    qualityScore: number;  // AI-assessed quality of analysis
  };
}

// =============================================================================
// CHOICE ARCHITECTURE (Nudge - Thaler & Sunstein)
// =============================================================================

/**
 * Choice architecture principles for designing better decisions
 */
export type NudgeType =
  | 'default_option'          // Make the best choice the default
  | 'feedback_loop'           // Provide immediate feedback
  | 'simplification'          // Reduce complexity
  | 'social_proof'            // Show what others do
  | 'salience'                // Make important info visible
  | 'commitment_device'       // Pre-commitment mechanisms
  | 'implementation_intention' // If-then planning
  | 'cooling_off_period'      // Delay for emotional decisions
  | 'structured_choice'       // Organize options logically
  | 'mapping'                 // Help understand consequences
  | 'error_expected'          // Design for mistakes
  | 'incentive_alignment';    // Align incentives with goals

/**
 * A nudge intervention design
 */
export interface NudgeDesign {
  id: string;
  name: string;
  nudgeType: NudgeType;

  // Context
  targetBehavior: string;         // What behavior we want
  currentBehavior: string;        // What people currently do
  behaviorGap: string;            // Why the gap exists

  // Design
  intervention: string;           // The nudge itself
  mechanism: string;              // Why it works (psychology)
  ethicalConsiderations: string;  // Transparency, autonomy concerns

  // Implementation
  implementation: {
    difficulty: 'easy' | 'moderate' | 'hard';
    cost: 'low' | 'medium' | 'high';
    reversibility: 'easily_reversible' | 'reversible' | 'hard_to_reverse';
    timeline: string;
  };

  // Expected outcomes
  expectedOutcome: {
    effectSize: number;           // Expected improvement (0-100)
    confidence: number;           // Confidence in estimate (0-100)
    timeToEffect: string;         // "immediate", "weeks", "months"
  };

  // Evaluation plan
  evaluationPlan: {
    metrics: string[];
    controlGroup: boolean;
    sampleSize: number;
    duration: string;
  };
}

/**
 * Choice architecture assessment question
 */
export interface ChoiceArchitectureQuestion {
  id: string;
  scenario: string;
  currentDesign: string;
  targetBehavior: string;

  // Question
  question: string;
  questionType: 'identify_nudge' | 'design_nudge' | 'evaluate_nudge' | 'improve_design';

  // For multiple choice
  options?: Array<{
    id: string;
    option: string;
    isCorrect: boolean;
    explanation: string;
  }>;

  // For design questions
  evaluationRubric?: {
    criteria: string[];
    maxScore: number;
  };

  // Difficulty and standards
  difficulty: number;  // -3 to +3
  standardsAddressed: string[];
}

// =============================================================================
// PROBABILISTIC THINKING (Annie Duke - Thinking in Bets)
// =============================================================================

/**
 * A decision treated as a "bet" with explicit probabilities and outcomes
 */
export interface DecisionBet {
  id: string;
  learnerId: string;

  // The decision
  decision: string;
  alternatives: string[];
  chosenAlternative: string;

  // Probability estimates
  outcomeEstimates: Array<{
    outcome: string;
    probability: number;        // 0-100
    confidence: number;         // 0-100 (meta-uncertainty)
    value: number;              // Expected value (-100 to +100)
    reasoning: string;
  }>;

  // Expected value calculation
  expectedValue: number;

  // Risk assessment
  riskProfile: {
    worstCase: { outcome: string; probability: number; impact: number };
    bestCase: { outcome: string; probability: number; impact: number };
    mostLikely: { outcome: string; probability: number; impact: number };
  };

  // Process quality (WRAP application)
  processQuality: {
    widenedOptions: boolean;
    realityTested: boolean;
    attainedDistance: boolean;
    preparedForWrong: boolean;
    overallScore: number;
  };

  // Timestamps
  createdAt: Date;
  decidedAt: Date | null;

  // Outcome tracking (filled in later)
  actualOutcome?: {
    outcome: string;
    assessedAt: Date;
    matchedPrediction: boolean;
    luckFactor: 'mostly_skill' | 'mixed' | 'mostly_luck';
    lessonsLearned: string;
  };
}

/**
 * Resulting analysis - separating decision quality from outcome quality
 */
export interface ResultingAnalysis {
  decisionId: string;

  // The 2x2 matrix
  decisionQuality: 'good' | 'bad';
  outcomeQuality: 'good' | 'bad';

  // Classification
  classification:
    | 'deserved_success'     // Good decision, good outcome
    | 'bad_luck'             // Good decision, bad outcome
    | 'dumb_luck'            // Bad decision, good outcome
    | 'deserved_failure';    // Bad decision, bad outcome

  // Analysis
  skillVsLuckRatio: number;  // -1 (all luck) to +1 (all skill)
  baseRateComparison: string;
  counterfactualAnalysis: string;  // "If I had chosen differently..."

  // Learning
  keyLessons: string[];
  processImprovements: string[];
}

// =============================================================================
// STRATEGIC THINKING DIMENSIONS (Manifold Extension)
// =============================================================================

/**
 * Strategic Thinking dimension - tracks quality of strategic reasoning
 */
export interface StrategicThinking {
  // Overall score
  overallScore: number;  // 0-100

  // Sub-dimensions
  optionGeneration: {
    score: number;
    fluency: number;         // Number of options generated
    diversity: number;       // Variety across categories
    quality: number;         // Viability of options
    trend: 'improving' | 'stable' | 'declining';
  };

  consequenceMapping: {
    score: number;
    depth: number;           // How many steps ahead
    breadth: number;         // Stakeholders considered
    accuracy: number;        // Actual vs. predicted (calibration)
    trend: 'improving' | 'stable' | 'declining';
  };

  uncertaintyHandling: {
    score: number;
    calibration: number;     // Brier score equivalent
    rangeEstimation: number; // Quality of confidence intervals
    scenarioPlanning: number;// Ability to envision multiple futures
    trend: 'improving' | 'stable' | 'declining';
  };

  adaptability: {
    score: number;
    pivotSpeed: number;      // How quickly adjusts to new info
    sunkCostResistance: number;  // Avoids sunk cost fallacy
    openMindedness: number;  // Updates beliefs with evidence
    trend: 'improving' | 'stable' | 'declining';
  };

  // Historical tracking
  history: Array<{
    timestamp: Date;
    decisionId: string;
    scores: {
      optionGeneration: number;
      consequenceMapping: number;
      uncertaintyHandling: number;
      adaptability: number;
    };
  }>;
}

// =============================================================================
// DECISION SCIENCE STANDARDS
// =============================================================================

export type DSStandardId =
  // DS-1: Pre-mortem & Prospective Hindsight
  | 'DS-1.1'  // Conduct basic pre-mortem analysis
  | 'DS-1.2'  // Generate diverse failure modes
  | 'DS-1.3'  // Create actionable mitigations
  | 'DS-1.4'  // Set effective tripwires
  // DS-2: Choice Architecture
  | 'DS-2.1'  // Identify nudge types in environments
  | 'DS-2.2'  // Design ethical nudges
  | 'DS-2.3'  // Evaluate nudge effectiveness
  | 'DS-2.4'  // Create choice architectures
  // DS-3: Probabilistic Thinking
  | 'DS-3.1'  // Frame decisions as bets
  | 'DS-3.2'  // Calculate expected value
  | 'DS-3.3'  // Separate skill from luck
  | 'DS-3.4'  // Update beliefs with evidence
  // DS-4: Integration
  | 'DS-4.1'  // Apply multiple frameworks to complex decisions
  | 'DS-4.2'  // Adapt frameworks to context
  | 'DS-4.3'  // Teach decision frameworks to others
  | 'DS-4.4'; // Design decision-making systems

/**
 * Decision Science standard definition
 */
export interface DSStandard {
  id: DSStandardId;
  category: 'premortem' | 'choice_architecture' | 'probabilistic' | 'integration';
  title: string;
  description: string;

  performanceIndicators: string[];
  prerequisites: DSStandardId[];
  assessmentTypes: Array<'scenario' | 'design' | 'analysis' | 'application' | 'teaching'>;

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
    strategicThinking: number;
  };
}

// =============================================================================
// DECISION JOURNAL SYSTEM
// =============================================================================

/**
 * Decision journal entry - captures pre-decision thinking to combat hindsight bias
 */
export interface DecisionJournalEntry {
  id: string;
  learnerId: string;

  // Pre-decision capture (MUST be filled before outcome known)
  priorRecord: {
    timestamp: Date;
    decision: string;
    context: string;
    options: string[];
    chosenOption: string;
    reasoning: string;
    keyAssumptions: string[];
    predictions: Array<{
      prediction: string;
      probability: number;
      confidence: number;
    }>;
    emotionalState: {
      stress: number;
      time_pressure: number;
      confidence: number;
    };
    processApplied: {
      wrapScore: number;
      premortemDone: boolean;
      probabilitiesEstimated: boolean;
    };
  };

  // Post-outcome review (filled after outcome known)
  outcomeRecord?: {
    timestamp: Date;
    actualOutcome: string;
    surprises: string[];
    assumptionsViolated: string[];
    predictionAccuracy: number;
    resultingClassification: 'deserved_success' | 'bad_luck' | 'dumb_luck' | 'deserved_failure';
    processEvaluation: number;  // Would same process work again?
    lessonsLearned: string[];
    processImprovements: string[];
  };

  // Meta-analysis
  metaAnalysis?: {
    hindsightBiasCheck: boolean;  // Did they verify they're not revising history?
    skillVsLuck: number;          // -1 to +1
    wouldDecideAgain: boolean;
    integrationWithOtherDecisions: string[];
  };
}

/**
 * Decision journal analytics
 */
export interface DecisionJournalAnalytics {
  learnerId: string;

  // Overall statistics
  totalDecisions: number;
  decisionsWithOutcomes: number;

  // Process quality trends
  processQualityTrend: Array<{
    month: string;
    averageWrapScore: number;
    premortemRate: number;
    probabilityEstimationRate: number;
  }>;

  // Calibration metrics
  calibration: {
    overall: number;
    byConfidenceLevel: Record<number, { predicted: number; actual: number; n: number }>;
    trend: 'improving' | 'stable' | 'declining';
  };

  // Resulting analysis
  resultingDistribution: {
    deservedSuccess: number;
    badLuck: number;
    dumbLuck: number;
    deservedFailure: number;
  };

  // Common patterns
  patterns: {
    commonAssumptionFailures: string[];
    blindSpots: string[];
    strengths: string[];
    improvementAreas: string[];
  };
}

// =============================================================================
// EXERCISE & PRACTICE TYPES
// =============================================================================

/**
 * Decision framework practice exercise
 */
export interface DecisionExercise {
  id: string;
  exerciseType: 'premortem' | 'nudge_design' | 'bet_framing' | 'resulting_analysis' | 'journal_review';

  // Content
  scenario: string;
  context: string;
  stakeholders: string[];
  constraints: string[];

  // For guided exercises
  hints?: string[];
  scaffolding?: Array<{
    step: number;
    prompt: string;
    example?: string;
  }>;

  // Evaluation
  rubric: {
    criteria: Array<{
      name: string;
      description: string;
      maxPoints: number;
    }>;
    totalPoints: number;
    passingScore: number;
  };

  // Metadata
  difficulty: number;  // -3 to +3
  estimatedMinutes: number;
  standardsAddressed: DSStandardId[];
  prerequisiteExercises: string[];
}

/**
 * Exercise submission and evaluation
 */
export interface DecisionExerciseSubmission {
  id: string;
  exerciseId: string;
  learnerId: string;

  // Submission content
  submission: Record<string, unknown>;  // Exercise-specific structure
  submittedAt: Date;
  timeSpentMinutes: number;

  // AI evaluation
  evaluation: {
    scores: Record<string, number>;
    totalScore: number;
    passed: boolean;
    feedback: string;
    strengthsIdentified: string[];
    areasForImprovement: string[];
    suggestedNextExercises: string[];
  };

  // Manifold updates
  manifoldUpdates: {
    strategicThinkingDelta: number;
    coherenceDelta: number;
    entropyDelta: number;
    generativityDelta: number;
  };
}

export default {
  // Export for easy importing
};
