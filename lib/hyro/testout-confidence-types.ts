/**
 * Test-Out Confidence System Types - Hyro Education System
 *
 * @hyro-domain competency_testing
 * @hyro-standards CC-TEST-1.*, CC-TEST-2.*, CC-TEST-3.*
 * @hyro-manifold Integrates with mastery tracking and ZPD engine
 * @hyro-rationale Provides confidence-based recommendations for Canyon Grove competency testing
 *
 * PURPOSE:
 * Canyon Grove Academy uses competency-based progression where students can
 * "test out" of grade-level standards. This system predicts readiness and
 * provides confidence levels to help students and parents make informed decisions
 * about when to attempt official competency tests.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Subject areas aligned with Common Core and NGSS
 */
export type Subject = 'math' | 'ela' | 'science';

/**
 * Grade levels K-12
 */
export type GradeLevel = 'K' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

/**
 * Standard mastery levels
 */
export type MasteryLevel =
  | 'not_started'      // No exposure
  | 'introduced'       // Initial exposure, < 40% mastery
  | 'developing'       // Some proficiency, 40-60%
  | 'approaching'      // Near mastery, 60-80%
  | 'proficient'       // Standard mastery, 80-90%
  | 'mastered'         // Full mastery, 90-95%
  | 'exemplary';       // Beyond standard, 95%+

/**
 * Confidence categories for test-out recommendations
 */
export type ConfidenceCategory =
  | 'not_ready'        // < 40% confidence
  | 'needs_more_prep'  // 40-60% confidence
  | 'approaching_ready'// 60-75% confidence
  | 'likely_ready'     // 75-85% confidence
  | 'highly_confident' // 85-95% confidence
  | 'recommend_now';   // 95%+ confidence

/**
 * A single academic standard (Common Core, NGSS)
 */
export interface Standard {
  id: string;              // e.g., "CCSS.MATH.6.RP.A.1"
  subject: Subject;
  gradeLevel: GradeLevel;
  domain: string;          // e.g., "Ratios & Proportional Relationships"
  cluster: string;         // e.g., "Understand ratio concepts"
  description: string;
  dokLevel: 1 | 2 | 3 | 4; // Depth of Knowledge
  prerequisites: string[]; // Standard IDs that should be mastered first
  coreStandard: boolean;   // Is this a power/priority standard?
}

/**
 * Student's mastery record for a single standard
 */
export interface StandardMastery {
  studentId: string;
  standardId: string;

  // Current mastery
  masteryLevel: MasteryLevel;
  masteryScore: number;        // 0-100

  // Evidence
  assessmentCount: number;
  lastAssessedAt: Date;
  assessmentHistory: Array<{
    date: Date;
    score: number;
    assessmentType: 'diagnostic' | 'practice' | 'quiz' | 'test';
    itemCount: number;
    timeSpentMinutes: number;
  }>;

  // Confidence metrics
  stabilityScore: number;      // How consistent is performance? 0-100
  retentionScore: number;      // How well retained over time? 0-100
  transferScore: number;       // Can apply to novel contexts? 0-100

  // Trajectory
  trend: 'improving' | 'stable' | 'declining';
  velocityPerWeek: number;     // Points gained per week (can be negative)
  projectedMasteryDate: Date | null;

  // Spaced repetition
  srsEaseFactor: number;
  srsDueDate: Date | null;
  srsInterval: number;         // Days
}

// =============================================================================
// TEST-OUT ASSESSMENT TYPES
// =============================================================================

/**
 * Grade-level test-out assessment configuration
 */
export interface TestOutAssessment {
  id: string;
  subject: Subject;
  gradeLevel: GradeLevel;

  // Assessment structure
  totalItems: number;
  timeLimit: number;           // Minutes
  passingScore: number;        // 0-100, typically 80
  retakePolicy: {
    waitDays: number;          // Days between attempts
    maxAttempts: number;
    cooldownReductionForPrep: number;  // Days reduced for completing prep
  };

  // Standards coverage
  standardsCovered: string[];  // Standard IDs
  coreStandardsRequired: string[];  // Must pass these specifically
  domainWeights: Record<string, number>;  // Domain -> weight (sums to 1)

  // Item distribution
  dokDistribution: {
    dok1: number;  // % recall
    dok2: number;  // % skill/concept
    dok3: number;  // % strategic thinking
    dok4: number;  // % extended thinking
  };

  // Adaptive features
  adaptive: boolean;
  startingDifficulty: number;  // -3 to +3 IRT scale
  difficultyRange: [number, number];
}

/**
 * A test-out attempt
 */
export interface TestOutAttempt {
  id: string;
  studentId: string;
  assessmentId: string;

  // Attempt info
  attemptNumber: number;
  startedAt: Date;
  completedAt: Date | null;
  status: 'in_progress' | 'completed' | 'abandoned' | 'timed_out';

  // Results
  score: number | null;        // 0-100
  passed: boolean | null;
  itemsAttempted: number;
  itemsCorrect: number;
  timeUsedMinutes: number;

  // Per-domain breakdown
  domainScores: Record<string, {
    score: number;
    itemsCorrect: number;
    itemsTotal: number;
  }>;

  // Per-standard breakdown
  standardScores: Record<string, {
    score: number;
    itemsCorrect: number;
    itemsTotal: number;
    passed: boolean;
  }>;

  // Detailed item analysis
  itemResponses: Array<{
    itemId: string;
    standardId: string;
    correct: boolean;
    responseTimeSeconds: number;
    difficulty: number;
  }>;

  // Post-test analysis
  analysis?: {
    strengthAreas: string[];
    weaknessAreas: string[];
    recommendedFocus: string[];
    estimatedPrepTime: number;  // Hours to address gaps
  };
}

// =============================================================================
// CONFIDENCE PREDICTION SYSTEM
// =============================================================================

/**
 * Factors that influence test-out confidence prediction
 */
export interface ConfidenceFactors {
  // Mastery-based factors (60% weight)
  averageMastery: number;          // Average mastery across standards
  lowestMastery: number;           // Weakest standard mastery
  coreStandardsMastery: number;    // Average of required core standards
  masteredStandardsRatio: number;  // % of standards at proficient+

  // Performance-based factors (25% weight)
  practiceTestAverage: number;     // Average of practice tests
  recentTrend: number;             // Recent improvement/decline
  consistencyScore: number;        // Variance in performance
  highStakesPerformance: number;   // Performance under test conditions

  // Behavioral factors (15% weight)
  studyTimeLastWeek: number;       // Hours
  practiceProblemsLastWeek: number;
  engagementScore: number;         // Learning platform engagement
  selfEfficacyScore: number;       // Student's own confidence rating
}

/**
 * Test-out confidence prediction
 */
export interface TestOutConfidence {
  studentId: string;
  assessmentId: string;
  calculatedAt: Date;

  // Overall confidence
  confidenceScore: number;         // 0-100
  confidenceCategory: ConfidenceCategory;
  passLikelihood: number;          // 0-100, probability of passing

  // Factor breakdown
  factors: ConfidenceFactors;
  factorWeights: Record<keyof ConfidenceFactors, number>;

  // Score distribution prediction
  scoreDistribution: {
    predicted: number;             // Point estimate
    lowerBound: number;            // 90% CI lower
    upperBound: number;            // 90% CI upper
    standardError: number;
  };

  // Risk analysis
  risks: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    mitigation: string;
  }>;

  // Recommendation
  recommendation: {
    action: 'wait' | 'prepare' | 'attempt' | 'attempt_soon';
    reasoning: string;
    targetDate: Date | null;
    prepPlan: PrepPlan | null;
  };
}

/**
 * Preparation plan for test-out
 */
export interface PrepPlan {
  studentId: string;
  assessmentId: string;
  createdAt: Date;

  // Timeline
  targetTestDate: Date;
  totalPrepHours: number;
  dailyPrepMinutes: number;

  // Focus areas
  priorityStandards: Array<{
    standardId: string;
    currentMastery: number;
    targetMastery: number;
    estimatedHours: number;
    resources: string[];
  }>;

  // Weekly breakdown
  weeklyPlan: Array<{
    weekNumber: number;
    focusAreas: string[];
    practiceItems: number;
    practiceTestScheduled: boolean;
    milestones: string[];
  }>;

  // Checkpoints
  checkpoints: Array<{
    date: Date;
    type: 'practice_test' | 'skill_check' | 'review';
    targetScore: number;
    actualScore: number | null;
    passed: boolean | null;
  }>;

  // Adaptive adjustments
  adjustmentHistory: Array<{
    date: Date;
    reason: string;
    change: string;
  }>;
}

// =============================================================================
// LEARNING PATH & PREREQUISITES
// =============================================================================

/**
 * Prerequisites analysis for a test-out assessment
 */
export interface PrerequisiteAnalysis {
  studentId: string;
  assessmentId: string;
  analyzedAt: Date;

  // Prerequisite coverage
  prerequisitesMet: number;        // Count of met prerequisites
  prerequisitesTotal: number;      // Total prerequisites
  prerequisiteScore: number;       // 0-100

  // Gap analysis
  gaps: Array<{
    standardId: string;
    standardName: string;
    currentMastery: number;
    requiredMastery: number;
    gap: number;
    blocksStandards: string[];     // Standards that depend on this
    priority: 'critical' | 'important' | 'helpful';
  }>;

  // Dependency graph
  criticalPath: string[];          // Most important standards to address
  estimatedGapClosureHours: number;

  // Recommendations
  prerequisitePlan: Array<{
    phase: number;
    standards: string[];
    estimatedHours: number;
    resources: string[];
  }>;
}

/**
 * Learning path through standards
 */
export interface LearningPath {
  studentId: string;
  subject: Subject;
  targetGradeLevel: GradeLevel;

  // Path structure
  phases: Array<{
    phaseNumber: number;
    title: string;
    standards: string[];
    estimatedWeeks: number;
    milestones: string[];
  }>;

  // Progress tracking
  currentPhase: number;
  standardsCompleted: number;
  standardsRemaining: number;
  percentComplete: number;

  // Projections
  estimatedCompletionDate: Date;
  onTrack: boolean;
  paceAdjustment: number;          // % faster or slower than plan

  // Adaptive routing
  alternativePaths?: Array<{
    name: string;
    description: string;
    timelineChange: number;        // Weeks added/removed
    tradeoffs: string[];
  }>;
}

// =============================================================================
// PRACTICE TEST SYSTEM
// =============================================================================

/**
 * Practice test configuration
 */
export interface PracticeTest {
  id: string;
  assessmentId: string;           // Links to real assessment
  difficulty: 'easier' | 'similar' | 'harder';
  itemCount: number;
  timeLimit: number;              // Minutes (typically longer than real test)
  allowedAttempts: number;

  // Purpose
  purpose: 'diagnostic' | 'practice' | 'readiness_check';
  recommendedBefore: Date;        // Should take before this date

  // Content
  itemIds: string[];
  domainDistribution: Record<string, number>;
}

/**
 * Practice test result
 */
export interface PracticeTestResult {
  id: string;
  practiceTestId: string;
  studentId: string;
  attemptNumber: number;
  takenAt: Date;

  // Score
  score: number;
  itemsCorrect: number;
  itemsTotal: number;
  timeUsedMinutes: number;

  // Analysis
  domainScores: Record<string, number>;
  standardScores: Record<string, number>;
  strengthAreas: string[];
  weaknessAreas: string[];

  // Comparison to actual test
  predictedActualScore: number;
  confidenceChange: number;        // How this changed test-out confidence

  // Feedback
  feedback: {
    overall: string;
    perDomain: Record<string, string>;
    nextSteps: string[];
  };
}

// =============================================================================
// PARENT/GUARDIAN REPORTING
// =============================================================================

/**
 * Parent-facing readiness report
 */
export interface ReadinessReport {
  studentId: string;
  studentName: string;
  reportDate: Date;
  subject: Subject;
  gradeLevel: GradeLevel;

  // Summary
  overallReadiness: ConfidenceCategory;
  confidenceScore: number;
  recommendation: string;
  targetDate: Date | null;

  // Progress visualization data
  progressData: {
    standardsMastered: number;
    standardsTotal: number;
    percentComplete: number;
    weeklyProgress: number;        // Standards mastered per week
  };

  // Domain breakdown (parent-friendly)
  domainSummary: Array<{
    domain: string;
    displayName: string;
    status: 'needs_work' | 'progressing' | 'ready';
    score: number;
    keySkills: string[];
  }>;

  // Action items for parents
  parentActions: Array<{
    action: string;
    importance: 'required' | 'recommended' | 'optional';
    timeCommitment: string;
    resources?: string[];
  }>;

  // FAQ for this student's situation
  relevantFAQ: Array<{
    question: string;
    answer: string;
  }>;

  // Historical comparison
  progressHistory: Array<{
    date: Date;
    confidenceScore: number;
    milestone: string | null;
  }>;
}

// =============================================================================
// ANALYTICS & CALIBRATION
// =============================================================================

/**
 * System-wide prediction calibration
 */
export interface PredictionCalibration {
  subject: Subject;
  gradeLevel: GradeLevel;
  calculatedAt: Date;
  sampleSize: number;

  // Calibration metrics
  brierScore: number;              // Lower is better
  calibrationError: number;        // Predicted - actual
  discriminationIndex: number;     // Ability to distinguish pass/fail

  // Calibration by confidence bucket
  calibrationCurve: Array<{
    confidenceBucket: number;      // 0-10, 10-20, etc.
    predictedPassRate: number;
    actualPassRate: number;
    sampleSize: number;
  }>;

  // Feature importance
  featureImportance: Record<keyof ConfidenceFactors, number>;

  // Model performance
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;

  // Adjustments needed
  calibrationAdjustments: Record<string, number>;
}

/**
 * Individual student prediction history for model improvement
 */
export interface PredictionHistory {
  studentId: string;
  predictions: Array<{
    assessmentId: string;
    predictedAt: Date;
    predictedScore: number;
    predictedPassProbability: number;
    confidenceCategory: ConfidenceCategory;
    factors: ConfidenceFactors;

    // Actual outcome (filled after test)
    attemptedAt: Date | null;
    actualScore: number | null;
    passed: boolean | null;

    // Prediction error
    scoreError: number | null;
    probabilityError: number | null;
  }>;

  // Personal calibration
  personalBias: number;            // Systematic over/under prediction
  personalCalibration: number;     // How well-calibrated for this student
}

export default {
  // Export for easy importing
};
