/**
 * Test-Out Confidence Engine - Hyro Education System
 *
 * @hyro-domain competency_testing
 * @hyro-standards CC-TEST-1.*, CC-TEST-2.*, CC-TEST-3.*
 * @hyro-manifold Integrates with mastery tracking and ZPD engine
 * @hyro-rationale Provides confidence-based recommendations for Canyon Grove competency testing
 *
 * PURPOSE:
 * This engine calculates test-out readiness confidence scores based on multiple
 * factors including mastery levels, practice performance, and behavioral indicators.
 * It provides actionable recommendations for students, parents, and educators.
 */

import type {
  Subject,
  GradeLevel,
  MasteryLevel,
  ConfidenceCategory,
  Standard,
  StandardMastery,
  TestOutAssessment,
  TestOutAttempt,
  ConfidenceFactors,
  TestOutConfidence,
  PrepPlan,
  PrerequisiteAnalysis,
  LearningPath,
  PracticeTest,
  PracticeTestResult,
  ReadinessReport,
  PredictionCalibration,
  PredictionHistory,
} from './testout-confidence-types';

// =============================================================================
// CONSTANTS & WEIGHTS
// =============================================================================

/**
 * Factor weights for confidence calculation
 * Based on research and calibration data
 */
export const FACTOR_WEIGHTS: Record<keyof ConfidenceFactors, number> = {
  // Mastery-based factors (60% total)
  averageMastery: 0.20,
  lowestMastery: 0.15,
  coreStandardsMastery: 0.15,
  masteredStandardsRatio: 0.10,

  // Performance-based factors (25% total)
  practiceTestAverage: 0.10,
  recentTrend: 0.05,
  consistencyScore: 0.05,
  highStakesPerformance: 0.05,

  // Behavioral factors (15% total)
  studyTimeLastWeek: 0.04,
  practiceProblemsLastWeek: 0.04,
  engagementScore: 0.04,
  selfEfficacyScore: 0.03,
};

/**
 * Mastery level to numeric score mapping
 */
export const MASTERY_SCORES: Record<MasteryLevel, number> = {
  not_started: 0,
  introduced: 20,
  developing: 50,
  approaching: 70,
  proficient: 85,
  mastered: 92,
  exemplary: 98,
};

/**
 * Confidence category thresholds
 */
export const CONFIDENCE_THRESHOLDS: Record<ConfidenceCategory, { min: number; max: number }> = {
  not_ready: { min: 0, max: 40 },
  needs_more_prep: { min: 40, max: 60 },
  approaching_ready: { min: 60, max: 75 },
  likely_ready: { min: 75, max: 85 },
  highly_confident: { min: 85, max: 95 },
  recommend_now: { min: 95, max: 100 },
};

/**
 * Default passing score for test-out assessments
 */
export const DEFAULT_PASSING_SCORE = 80;

/**
 * Minimum mastery for a standard to be considered "ready"
 */
export const MIN_READY_MASTERY = 75;

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

/**
 * Calculates the confidence category from a numeric score
 */
export function getConfidenceCategory(score: number): ConfidenceCategory {
  if (score >= 95) return 'recommend_now';
  if (score >= 85) return 'highly_confident';
  if (score >= 75) return 'likely_ready';
  if (score >= 60) return 'approaching_ready';
  if (score >= 40) return 'needs_more_prep';
  return 'not_ready';
}

/**
 * Calculates mastery-based confidence factors
 */
export function calculateMasteryFactors(
  standardMasteries: StandardMastery[],
  coreStandardIds: string[]
): Pick<ConfidenceFactors, 'averageMastery' | 'lowestMastery' | 'coreStandardsMastery' | 'masteredStandardsRatio'> {
  if (standardMasteries.length === 0) {
    return {
      averageMastery: 0,
      lowestMastery: 0,
      coreStandardsMastery: 0,
      masteredStandardsRatio: 0,
    };
  }

  const scores = standardMasteries.map(m => m.masteryScore);
  const averageMastery = scores.reduce((a, b) => a + b, 0) / scores.length;
  const lowestMastery = Math.min(...scores);

  // Core standards mastery
  const coreStandards = standardMasteries.filter(m => coreStandardIds.includes(m.standardId));
  const coreStandardsMastery = coreStandards.length > 0
    ? coreStandards.reduce((sum, m) => sum + m.masteryScore, 0) / coreStandards.length
    : 0;

  // Ratio of standards at proficient or higher
  const masteredCount = standardMasteries.filter(m =>
    m.masteryLevel === 'proficient' ||
    m.masteryLevel === 'mastered' ||
    m.masteryLevel === 'exemplary'
  ).length;
  const masteredStandardsRatio = (masteredCount / standardMasteries.length) * 100;

  return {
    averageMastery,
    lowestMastery,
    coreStandardsMastery,
    masteredStandardsRatio,
  };
}

/**
 * Calculates performance-based confidence factors
 */
export function calculatePerformanceFactors(
  practiceResults: PracticeTestResult[],
  standardMasteries: StandardMastery[]
): Pick<ConfidenceFactors, 'practiceTestAverage' | 'recentTrend' | 'consistencyScore' | 'highStakesPerformance'> {
  // Practice test average
  const practiceTestAverage = practiceResults.length > 0
    ? practiceResults.reduce((sum, r) => sum + r.score, 0) / practiceResults.length
    : 0;

  // Recent trend (from standard masteries)
  const trends = standardMasteries.map(m => {
    if (m.trend === 'improving') return 1;
    if (m.trend === 'stable') return 0;
    return -1;
  });
  const avgTrend = trends.length > 0
    ? trends.reduce((a, b) => a + b, 0) / trends.length
    : 0;
  // Convert -1 to 1 scale to 0-100 scale
  const recentTrend = (avgTrend + 1) * 50;

  // Consistency score (inverse of variance)
  const consistencyScore = calculateConsistencyScore(practiceResults);

  // High-stakes performance (use most recent formal assessment scores)
  const highStakesPerformance = calculateHighStakesPerformance(standardMasteries);

  return {
    practiceTestAverage,
    recentTrend,
    consistencyScore,
    highStakesPerformance,
  };
}

/**
 * Calculates consistency score based on practice test variance
 */
function calculateConsistencyScore(practiceResults: PracticeTestResult[]): number {
  if (practiceResults.length < 2) return 50; // Neutral if insufficient data

  const scores = practiceResults.map(r => r.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Convert standard deviation to consistency score
  // Lower stdDev = higher consistency
  // stdDev of 0 = 100, stdDev of 20+ = 0
  return Math.max(0, 100 - (stdDev * 5));
}

/**
 * Calculates high-stakes performance from formal assessments
 */
function calculateHighStakesPerformance(standardMasteries: StandardMastery[]): number {
  const testScores: number[] = [];

  for (const mastery of standardMasteries) {
    for (const assessment of mastery.assessmentHistory) {
      if (assessment.assessmentType === 'test' || assessment.assessmentType === 'quiz') {
        testScores.push(assessment.score);
      }
    }
  }

  if (testScores.length === 0) return 50; // Neutral if no formal assessments

  // Weight recent scores more heavily
  const weightedSum = testScores.reduce((sum, score, i) => {
    const weight = (i + 1) / testScores.length; // More recent = higher weight
    return sum + (score * weight);
  }, 0);
  const totalWeight = testScores.reduce((sum, _, i) => sum + (i + 1) / testScores.length, 0);

  return weightedSum / totalWeight;
}

/**
 * Calculates behavioral confidence factors
 */
export function calculateBehavioralFactors(
  studyTimeLastWeek: number, // hours
  practiceProblemsLastWeek: number,
  engagementScore: number, // 0-100, from learning platform
  selfEfficacyScore: number // 0-100, from self-report
): Pick<ConfidenceFactors, 'studyTimeLastWeek' | 'practiceProblemsLastWeek' | 'engagementScore' | 'selfEfficacyScore'> {
  // Normalize study time (0-10 hours -> 0-100)
  const normalizedStudyTime = Math.min(100, studyTimeLastWeek * 10);

  // Normalize practice problems (0-100 problems -> 0-100)
  const normalizedPractice = Math.min(100, practiceProblemsLastWeek);

  return {
    studyTimeLastWeek: normalizedStudyTime,
    practiceProblemsLastWeek: normalizedPractice,
    engagementScore,
    selfEfficacyScore,
  };
}

/**
 * Main confidence calculation function
 */
export function calculateTestOutConfidence(
  studentId: string,
  assessment: TestOutAssessment,
  standardMasteries: StandardMastery[],
  practiceResults: PracticeTestResult[],
  behavioralData: {
    studyTimeLastWeek: number;
    practiceProblemsLastWeek: number;
    engagementScore: number;
    selfEfficacyScore: number;
  }
): TestOutConfidence {
  // Filter masteries to those relevant to this assessment
  const relevantMasteries = standardMasteries.filter(m =>
    assessment.standardsCovered.includes(m.standardId)
  );

  // Calculate factor groups
  const masteryFactors = calculateMasteryFactors(
    relevantMasteries,
    assessment.coreStandardsRequired
  );

  const performanceFactors = calculatePerformanceFactors(
    practiceResults,
    relevantMasteries
  );

  const behavioralFactors = calculateBehavioralFactors(
    behavioralData.studyTimeLastWeek,
    behavioralData.practiceProblemsLastWeek,
    behavioralData.engagementScore,
    behavioralData.selfEfficacyScore
  );

  // Combine all factors
  const factors: ConfidenceFactors = {
    ...masteryFactors,
    ...performanceFactors,
    ...behavioralFactors,
  };

  // Calculate weighted confidence score
  let confidenceScore = 0;
  for (const [factor, value] of Object.entries(factors)) {
    const weight = FACTOR_WEIGHTS[factor as keyof ConfidenceFactors];
    confidenceScore += value * weight;
  }

  // Calculate pass likelihood using logistic function
  const passLikelihood = calculatePassLikelihood(confidenceScore, assessment.passingScore);

  // Calculate score distribution
  const scoreDistribution = calculateScoreDistribution(factors, assessment);

  // Identify risks
  const risks = identifyRisks(factors, relevantMasteries, assessment);

  // Generate recommendation
  const recommendation = generateRecommendation(
    confidenceScore,
    passLikelihood,
    risks,
    studentId,
    assessment
  );

  return {
    studentId,
    assessmentId: assessment.id,
    calculatedAt: new Date(),
    confidenceScore,
    confidenceCategory: getConfidenceCategory(confidenceScore),
    passLikelihood,
    factors,
    factorWeights: FACTOR_WEIGHTS,
    scoreDistribution,
    risks,
    recommendation,
  };
}

/**
 * Calculates pass likelihood using logistic regression model
 */
function calculatePassLikelihood(confidenceScore: number, passingScore: number): number {
  // Logistic function centered at passing threshold
  // k controls steepness of the curve
  const k = 0.15;
  const midpoint = passingScore - 10; // Slightly below passing to be conservative

  const likelihood = 100 / (1 + Math.exp(-k * (confidenceScore - midpoint)));
  return Math.round(likelihood * 10) / 10; // Round to 1 decimal
}

/**
 * Calculates predicted score distribution
 */
function calculateScoreDistribution(
  factors: ConfidenceFactors,
  assessment: TestOutAssessment
): TestOutConfidence['scoreDistribution'] {
  // Base prediction on average mastery and practice performance
  const predicted = (factors.averageMastery * 0.6) + (factors.practiceTestAverage * 0.4);

  // Calculate standard error based on consistency
  const consistencyFactor = factors.consistencyScore / 100;
  const baseError = 10; // Base standard error
  const standardError = baseError * (2 - consistencyFactor); // Lower consistency = higher error

  // 90% confidence interval (1.645 standard deviations)
  const marginOfError = 1.645 * standardError;

  return {
    predicted: Math.round(predicted * 10) / 10,
    lowerBound: Math.max(0, Math.round((predicted - marginOfError) * 10) / 10),
    upperBound: Math.min(100, Math.round((predicted + marginOfError) * 10) / 10),
    standardError: Math.round(standardError * 10) / 10,
  };
}

/**
 * Identifies risk factors for test-out attempt
 */
function identifyRisks(
  factors: ConfidenceFactors,
  masteries: StandardMastery[],
  assessment: TestOutAssessment
): TestOutConfidence['risks'] {
  const risks: TestOutConfidence['risks'] = [];

  // Risk: Lowest mastery too low
  if (factors.lowestMastery < 60) {
    const weakStandards = masteries
      .filter(m => m.masteryScore < 60)
      .map(m => m.standardId);
    risks.push({
      factor: 'lowestMastery',
      severity: factors.lowestMastery < 40 ? 'high' : 'medium',
      description: `${weakStandards.length} standard(s) below proficiency threshold`,
      mitigation: 'Focus practice on weak standards before attempting test',
    });
  }

  // Risk: Core standards not mastered
  if (factors.coreStandardsMastery < 80) {
    risks.push({
      factor: 'coreStandardsMastery',
      severity: factors.coreStandardsMastery < 70 ? 'high' : 'medium',
      description: 'Core/power standards not yet mastered',
      mitigation: 'Prioritize core standards - these are required for passing',
    });
  }

  // Risk: High variance in performance
  if (factors.consistencyScore < 50) {
    risks.push({
      factor: 'consistencyScore',
      severity: 'medium',
      description: 'Performance is inconsistent across attempts',
      mitigation: 'More practice to stabilize performance before high-stakes test',
    });
  }

  // Risk: Poor performance under pressure
  if (factors.highStakesPerformance < factors.practiceTestAverage - 10) {
    risks.push({
      factor: 'highStakesPerformance',
      severity: 'medium',
      description: 'Score drops in formal test conditions',
      mitigation: 'Practice under timed, test-like conditions',
    });
  }

  // Risk: Declining trend
  if (factors.recentTrend < 40) {
    risks.push({
      factor: 'recentTrend',
      severity: 'medium',
      description: 'Recent performance is declining',
      mitigation: 'Review recent topics and address any comprehension gaps',
    });
  }

  // Risk: Low engagement
  if (factors.engagementScore < 40) {
    risks.push({
      factor: 'engagementScore',
      severity: 'low',
      description: 'Low recent engagement with learning platform',
      mitigation: 'Increase daily practice before test attempt',
    });
  }

  // Risk: Low self-efficacy
  if (factors.selfEfficacyScore < 50) {
    risks.push({
      factor: 'selfEfficacyScore',
      severity: 'low',
      description: 'Student feels uncertain about readiness',
      mitigation: 'Build confidence with successful practice sessions',
    });
  }

  return risks;
}

/**
 * Generates recommendation based on confidence analysis
 */
function generateRecommendation(
  confidenceScore: number,
  passLikelihood: number,
  risks: TestOutConfidence['risks'],
  studentId: string,
  assessment: TestOutAssessment
): TestOutConfidence['recommendation'] {
  const highSeverityRisks = risks.filter(r => r.severity === 'high').length;
  const mediumSeverityRisks = risks.filter(r => r.severity === 'medium').length;

  // Decision logic
  if (confidenceScore >= 95 && highSeverityRisks === 0) {
    return {
      action: 'attempt',
      reasoning: `Excellent readiness with ${Math.round(passLikelihood)}% pass likelihood. All systems indicate student is ready.`,
      targetDate: new Date(), // Ready now
      prepPlan: null,
    };
  }

  if (confidenceScore >= 85 && highSeverityRisks === 0 && mediumSeverityRisks <= 1) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7); // Within a week
    return {
      action: 'attempt_soon',
      reasoning: `Strong readiness with ${Math.round(passLikelihood)}% pass likelihood. Consider attempting within the next week.`,
      targetDate,
      prepPlan: generateQuickPrepPlan(studentId, assessment, risks),
    };
  }

  if (confidenceScore >= 60) {
    const weeksNeeded = Math.ceil((85 - confidenceScore) / 5);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weeksNeeded * 7));
    return {
      action: 'prepare',
      reasoning: `Making progress but more preparation recommended. Estimated ${weeksNeeded} weeks to reach optimal readiness.`,
      targetDate,
      prepPlan: generateFullPrepPlan(studentId, assessment, risks, weeksNeeded),
    };
  }

  return {
    action: 'wait',
    reasoning: `Not yet ready for test-out. Focus on building mastery of foundational standards first.`,
    targetDate: null,
    prepPlan: generateFoundationalPlan(studentId, assessment),
  };
}

// =============================================================================
// PREPARATION PLANNING
// =============================================================================

/**
 * Generates a quick prep plan for students who are almost ready
 */
function generateQuickPrepPlan(
  studentId: string,
  assessment: TestOutAssessment,
  risks: TestOutConfidence['risks']
): PrepPlan {
  const now = new Date();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);

  return {
    studentId,
    assessmentId: assessment.id,
    createdAt: now,
    targetTestDate: targetDate,
    totalPrepHours: 5,
    dailyPrepMinutes: 45,
    priorityStandards: risks.map(risk => ({
      standardId: risk.factor,
      currentMastery: 70, // Estimate
      targetMastery: 85,
      estimatedHours: 1,
      resources: ['Practice problems', 'Review videos'],
    })),
    weeklyPlan: [{
      weekNumber: 1,
      focusAreas: risks.map(r => r.factor),
      practiceItems: 50,
      practiceTestScheduled: true,
      milestones: ['Address identified risk factors', 'Complete practice test'],
    }],
    checkpoints: [{
      date: new Date(targetDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
      type: 'practice_test',
      targetScore: assessment.passingScore,
      actualScore: null,
      passed: null,
    }],
    adjustmentHistory: [],
  };
}

/**
 * Generates a full prep plan for students who need more preparation
 */
function generateFullPrepPlan(
  studentId: string,
  assessment: TestOutAssessment,
  risks: TestOutConfidence['risks'],
  weeksNeeded: number
): PrepPlan {
  const now = new Date();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (weeksNeeded * 7));

  const weeklyPlan = [];
  for (let i = 1; i <= weeksNeeded; i++) {
    weeklyPlan.push({
      weekNumber: i,
      focusAreas: risks.slice(0, 2).map(r => r.factor), // Focus on top 2 risks
      practiceItems: 75,
      practiceTestScheduled: i === weeksNeeded,
      milestones: i < weeksNeeded
        ? [`Master week ${i} focus areas`]
        : ['Final review', 'Complete readiness assessment'],
    });
  }

  const checkpoints = [];
  for (let i = 1; i <= weeksNeeded; i++) {
    const checkpointDate = new Date(now);
    checkpointDate.setDate(checkpointDate.getDate() + (i * 7));
    checkpoints.push({
      date: checkpointDate,
      type: i === weeksNeeded ? 'practice_test' as const : 'skill_check' as const,
      targetScore: 70 + (i * 5), // Progressive targets
      actualScore: null,
      passed: null,
    });
  }

  return {
    studentId,
    assessmentId: assessment.id,
    createdAt: now,
    targetTestDate: targetDate,
    totalPrepHours: weeksNeeded * 5,
    dailyPrepMinutes: 45,
    priorityStandards: risks.map(risk => ({
      standardId: risk.factor,
      currentMastery: 50, // Estimate
      targetMastery: 85,
      estimatedHours: weeksNeeded,
      resources: ['Adaptive practice', 'Tutorial videos', 'Worked examples'],
    })),
    weeklyPlan,
    checkpoints,
    adjustmentHistory: [],
  };
}

/**
 * Generates a foundational plan for students who need significant preparation
 */
function generateFoundationalPlan(
  studentId: string,
  assessment: TestOutAssessment
): PrepPlan {
  const now = new Date();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 60); // 8-9 weeks

  return {
    studentId,
    assessmentId: assessment.id,
    createdAt: now,
    targetTestDate: targetDate,
    totalPrepHours: 40,
    dailyPrepMinutes: 45,
    priorityStandards: assessment.coreStandardsRequired.map(standardId => ({
      standardId,
      currentMastery: 30, // Estimate
      targetMastery: 85,
      estimatedHours: 5,
      resources: ['Foundational lessons', 'Scaffolded practice', 'Concept videos'],
    })),
    weeklyPlan: Array.from({ length: 8 }, (_, i) => ({
      weekNumber: i + 1,
      focusAreas: [assessment.coreStandardsRequired[i % assessment.coreStandardsRequired.length]],
      practiceItems: 50,
      practiceTestScheduled: i === 7,
      milestones: [`Build mastery of core standard ${(i % assessment.coreStandardsRequired.length) + 1}`],
    })),
    checkpoints: [
      { date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), type: 'skill_check' as const, targetScore: 50, actualScore: null, passed: null },
      { date: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000), type: 'skill_check' as const, targetScore: 60, actualScore: null, passed: null },
      { date: new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000), type: 'skill_check' as const, targetScore: 70, actualScore: null, passed: null },
      { date: new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000), type: 'practice_test' as const, targetScore: 80, actualScore: null, passed: null },
    ],
    adjustmentHistory: [],
  };
}

// =============================================================================
// PREREQUISITE ANALYSIS
// =============================================================================

/**
 * Analyzes prerequisites for a test-out assessment
 */
export function analyzePrerequisites(
  studentId: string,
  assessment: TestOutAssessment,
  allStandards: Standard[],
  studentMasteries: StandardMastery[]
): PrerequisiteAnalysis {
  const standardsInAssessment = allStandards.filter(s =>
    assessment.standardsCovered.includes(s.id)
  );

  // Collect all prerequisites
  const allPrerequisites = new Set<string>();
  for (const standard of standardsInAssessment) {
    for (const prereq of standard.prerequisites) {
      allPrerequisites.add(prereq);
    }
  }

  // Check which prerequisites are met
  const gaps: PrerequisiteAnalysis['gaps'] = [];
  let prerequisitesMet = 0;

  for (const prereqId of allPrerequisites) {
    const mastery = studentMasteries.find(m => m.standardId === prereqId);
    const masteryScore = mastery?.masteryScore ?? 0;

    if (masteryScore >= MIN_READY_MASTERY) {
      prerequisitesMet++;
    } else {
      const prereqStandard = allStandards.find(s => s.id === prereqId);
      const blocksStandards = standardsInAssessment
        .filter(s => s.prerequisites.includes(prereqId))
        .map(s => s.id);

      gaps.push({
        standardId: prereqId,
        standardName: prereqStandard?.description ?? prereqId,
        currentMastery: masteryScore,
        requiredMastery: MIN_READY_MASTERY,
        gap: MIN_READY_MASTERY - masteryScore,
        blocksStandards,
        priority: blocksStandards.length > 2 ? 'critical' :
                  blocksStandards.length > 0 ? 'important' : 'helpful',
      });
    }
  }

  // Sort gaps by priority and gap size
  gaps.sort((a, b) => {
    const priorityOrder = { critical: 0, important: 1, helpful: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.gap - a.gap;
  });

  // Create critical path (most important gaps to address first)
  const criticalPath = gaps
    .filter(g => g.priority === 'critical' || g.priority === 'important')
    .map(g => g.standardId);

  // Estimate hours to close gaps
  const estimatedGapClosureHours = gaps.reduce((sum, gap) => {
    const hoursPerPoint = 0.2; // 12 minutes per mastery point
    return sum + (gap.gap * hoursPerPoint);
  }, 0);

  // Generate prerequisite plan
  const prerequisitePlan = generatePrerequisitePlan(gaps);

  const prerequisitesTotal = allPrerequisites.size;
  const prerequisiteScore = prerequisitesTotal > 0
    ? (prerequisitesMet / prerequisitesTotal) * 100
    : 100;

  return {
    studentId,
    assessmentId: assessment.id,
    analyzedAt: new Date(),
    prerequisitesMet,
    prerequisitesTotal,
    prerequisiteScore,
    gaps,
    criticalPath,
    estimatedGapClosureHours: Math.round(estimatedGapClosureHours * 10) / 10,
    prerequisitePlan,
  };
}

/**
 * Generates a phased plan to address prerequisite gaps
 */
function generatePrerequisitePlan(
  gaps: PrerequisiteAnalysis['gaps']
): PrerequisiteAnalysis['prerequisitePlan'] {
  const plan: PrerequisiteAnalysis['prerequisitePlan'] = [];

  // Phase 1: Critical gaps
  const criticalGaps = gaps.filter(g => g.priority === 'critical');
  if (criticalGaps.length > 0) {
    plan.push({
      phase: 1,
      standards: criticalGaps.map(g => g.standardId),
      estimatedHours: criticalGaps.reduce((sum, g) => sum + (g.gap * 0.2), 0),
      resources: ['Foundation tutorials', 'Scaffolded practice', 'Concept reviews'],
    });
  }

  // Phase 2: Important gaps
  const importantGaps = gaps.filter(g => g.priority === 'important');
  if (importantGaps.length > 0) {
    plan.push({
      phase: plan.length + 1,
      standards: importantGaps.map(g => g.standardId),
      estimatedHours: importantGaps.reduce((sum, g) => sum + (g.gap * 0.2), 0),
      resources: ['Practice problems', 'Worked examples', 'Self-assessment'],
    });
  }

  // Phase 3: Helpful gaps (optional)
  const helpfulGaps = gaps.filter(g => g.priority === 'helpful');
  if (helpfulGaps.length > 0) {
    plan.push({
      phase: plan.length + 1,
      standards: helpfulGaps.map(g => g.standardId),
      estimatedHours: helpfulGaps.reduce((sum, g) => sum + (g.gap * 0.15), 0),
      resources: ['Review materials', 'Optional enrichment'],
    });
  }

  return plan;
}

// =============================================================================
// READINESS REPORT GENERATION
// =============================================================================

/**
 * Generates a parent-friendly readiness report
 */
export function generateReadinessReport(
  studentId: string,
  studentName: string,
  subject: Subject,
  gradeLevel: GradeLevel,
  confidence: TestOutConfidence,
  masteries: StandardMastery[],
  progressHistory: Array<{ date: Date; confidenceScore: number; milestone: string | null }>
): ReadinessReport {
  // Calculate progress data
  const masteredCount = masteries.filter(m =>
    m.masteryLevel === 'proficient' ||
    m.masteryLevel === 'mastered' ||
    m.masteryLevel === 'exemplary'
  ).length;

  // Group standards by domain for summary
  const domainGroups = new Map<string, StandardMastery[]>();
  for (const mastery of masteries) {
    // Extract domain from standard ID (simplified)
    const domain = mastery.standardId.split('.').slice(0, 3).join('.');
    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain)!.push(mastery);
  }

  const domainSummary: ReadinessReport['domainSummary'] = [];
  for (const [domain, domainMasteries] of domainGroups) {
    const avgScore = domainMasteries.reduce((sum, m) => sum + m.masteryScore, 0) / domainMasteries.length;
    domainSummary.push({
      domain,
      displayName: formatDomainName(domain),
      status: avgScore >= 80 ? 'ready' : avgScore >= 60 ? 'progressing' : 'needs_work',
      score: Math.round(avgScore),
      keySkills: domainMasteries.slice(0, 3).map(m => m.standardId),
    });
  }

  // Generate parent actions based on confidence level
  const parentActions = generateParentActions(confidence);

  // Generate relevant FAQ
  const relevantFAQ = generateRelevantFAQ(confidence);

  // Calculate weekly progress (standards mastered per week)
  const weeklyProgress = calculateWeeklyProgress(masteries);

  return {
    studentId,
    studentName,
    reportDate: new Date(),
    subject,
    gradeLevel,
    overallReadiness: confidence.confidenceCategory,
    confidenceScore: confidence.confidenceScore,
    recommendation: confidence.recommendation.reasoning,
    targetDate: confidence.recommendation.targetDate,
    progressData: {
      standardsMastered: masteredCount,
      standardsTotal: masteries.length,
      percentComplete: masteries.length > 0 ? Math.round((masteredCount / masteries.length) * 100) : 0,
      weeklyProgress,
    },
    domainSummary,
    parentActions,
    relevantFAQ,
    progressHistory,
  };
}

/**
 * Formats domain ID into readable name
 */
function formatDomainName(domain: string): string {
  // This would normally look up a domain name map
  // Simplified version
  const parts = domain.split('.');
  return parts.length > 2 ? parts[2] : domain;
}

/**
 * Generates parent action items based on confidence level
 */
function generateParentActions(confidence: TestOutConfidence): ReadinessReport['parentActions'] {
  const actions: ReadinessReport['parentActions'] = [];

  if (confidence.confidenceCategory === 'recommend_now' || confidence.confidenceCategory === 'highly_confident') {
    actions.push({
      action: 'Schedule the test-out assessment',
      importance: 'recommended',
      timeCommitment: '1-2 hours for the test',
      resources: ['Contact school coordinator', 'Review test-day procedures'],
    });
  } else if (confidence.confidenceCategory === 'likely_ready' || confidence.confidenceCategory === 'approaching_ready') {
    actions.push({
      action: 'Continue daily practice sessions',
      importance: 'required',
      timeCommitment: '30-45 minutes daily',
      resources: ['Practice problem sets', 'Review lessons'],
    });
    actions.push({
      action: 'Complete practice test before scheduling official test',
      importance: 'recommended',
      timeCommitment: '1-2 hours',
    });
  } else {
    actions.push({
      action: 'Focus on foundational skill building',
      importance: 'required',
      timeCommitment: '45-60 minutes daily',
      resources: ['Foundation lessons', 'Tutoring resources'],
    });
    actions.push({
      action: 'Review weekly progress reports',
      importance: 'recommended',
      timeCommitment: '15 minutes weekly',
    });
  }

  // Add risk-specific actions
  for (const risk of confidence.risks.filter(r => r.severity === 'high' || r.severity === 'medium')) {
    actions.push({
      action: risk.mitigation,
      importance: risk.severity === 'high' ? 'required' : 'recommended',
      timeCommitment: 'Varies',
    });
  }

  return actions;
}

/**
 * Generates FAQ relevant to student's current situation
 */
function generateRelevantFAQ(confidence: TestOutConfidence): ReadinessReport['relevantFAQ'] {
  const faq: ReadinessReport['relevantFAQ'] = [];

  // Always include basics
  faq.push({
    question: 'What is a test-out assessment?',
    answer: 'A test-out assessment allows students to demonstrate mastery of grade-level standards and potentially advance to the next level without completing traditional coursework.',
  });

  faq.push({
    question: 'How is the confidence score calculated?',
    answer: 'The confidence score combines mastery of individual standards (60%), practice test performance (25%), and learning engagement metrics (15%).',
  });

  // Add situation-specific FAQ
  if (confidence.confidenceCategory === 'recommend_now' || confidence.confidenceCategory === 'highly_confident') {
    faq.push({
      question: 'My child is ready - what happens next?',
      answer: 'Contact the school coordinator to schedule the official test-out assessment. Tests are typically offered monthly. Your child can continue practicing while waiting for the test date.',
    });
  }

  if (confidence.risks.some(r => r.factor === 'consistencyScore')) {
    faq.push({
      question: 'Why is consistency important?',
      answer: 'Consistent performance indicates stable mastery. Variable scores suggest some concepts may not be fully solidified, which could affect test-day performance.',
    });
  }

  if (confidence.risks.some(r => r.factor === 'lowestMastery')) {
    faq.push({
      question: 'Should we focus on weak areas or strong areas?',
      answer: 'Focus on bringing weak areas up to proficiency. The test covers all standards, so significant gaps in any area can prevent passing even if other areas are strong.',
    });
  }

  return faq;
}

/**
 * Calculates average standards mastered per week
 */
function calculateWeeklyProgress(masteries: StandardMastery[]): number {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let progressThisWeek = 0;
  for (const mastery of masteries) {
    // Check if mastery level improved this week
    const recentAssessments = mastery.assessmentHistory.filter(a =>
      a.date >= oneWeekAgo
    );
    if (recentAssessments.length > 0) {
      const latestScore = recentAssessments[recentAssessments.length - 1].score;
      const earliestScore = recentAssessments[0].score;
      if (latestScore >= 80 && earliestScore < 80) {
        progressThisWeek++;
      }
    }
  }

  return progressThisWeek;
}

// =============================================================================
// CALIBRATION & ANALYTICS
// =============================================================================

/**
 * Updates prediction history with actual outcome
 */
export function recordPredictionOutcome(
  history: PredictionHistory,
  assessmentId: string,
  actualScore: number,
  passed: boolean
): PredictionHistory {
  const updatedPredictions = history.predictions.map(p => {
    if (p.assessmentId === assessmentId && p.actualScore === null) {
      return {
        ...p,
        attemptedAt: new Date(),
        actualScore,
        passed,
        scoreError: actualScore - p.predictedScore,
        probabilityError: (passed ? 100 : 0) - p.predictedPassProbability,
      };
    }
    return p;
  });

  // Recalculate personal calibration
  const completedPredictions = updatedPredictions.filter(p => p.actualScore !== null);
  const totalBias = completedPredictions.reduce((sum, p) =>
    sum + (p.scoreError ?? 0), 0);
  const personalBias = completedPredictions.length > 0
    ? totalBias / completedPredictions.length
    : 0;

  // Calculate calibration (how close predictions are to outcomes)
  const calibrationError = completedPredictions.reduce((sum, p) =>
    sum + Math.abs(p.probabilityError ?? 0), 0);
  const personalCalibration = completedPredictions.length > 0
    ? 100 - (calibrationError / completedPredictions.length)
    : 50;

  return {
    ...history,
    predictions: updatedPredictions,
    personalBias,
    personalCalibration,
  };
}

/**
 * Calculates system-wide prediction calibration metrics
 */
export function calculateSystemCalibration(
  allHistories: PredictionHistory[],
  subject: Subject,
  gradeLevel: GradeLevel
): PredictionCalibration {
  // Collect all completed predictions for this subject/grade
  const predictions: Array<{
    predictedScore: number;
    predictedPassProbability: number;
    actualScore: number;
    passed: boolean;
    factors: ConfidenceFactors;
  }> = [];

  for (const history of allHistories) {
    for (const pred of history.predictions) {
      if (pred.actualScore !== null) {
        predictions.push({
          predictedScore: pred.predictedScore,
          predictedPassProbability: pred.predictedPassProbability,
          actualScore: pred.actualScore,
          passed: pred.passed!,
          factors: pred.factors,
        });
      }
    }
  }

  if (predictions.length === 0) {
    // Return default calibration if no data
    return createDefaultCalibration(subject, gradeLevel);
  }

  // Calculate Brier score
  const brierScore = predictions.reduce((sum, p) => {
    const predicted = p.predictedPassProbability / 100;
    const actual = p.passed ? 1 : 0;
    return sum + Math.pow(predicted - actual, 2);
  }, 0) / predictions.length;

  // Calculate calibration curve
  const calibrationCurve = calculateCalibrationCurve(predictions);

  // Calculate overall metrics
  const calibrationError = calibrationCurve.reduce((sum, bucket) =>
    sum + Math.abs(bucket.predictedPassRate - bucket.actualPassRate) * bucket.sampleSize, 0) /
    predictions.length;

  // Classification metrics
  const threshold = 50; // Using 50% probability as threshold
  const tp = predictions.filter(p => p.predictedPassProbability >= threshold && p.passed).length;
  const fp = predictions.filter(p => p.predictedPassProbability >= threshold && !p.passed).length;
  const tn = predictions.filter(p => p.predictedPassProbability < threshold && !p.passed).length;
  const fn = predictions.filter(p => p.predictedPassProbability < threshold && p.passed).length;

  const accuracy = (tp + tn) / predictions.length;
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

  // Calculate feature importance (simplified)
  const featureImportance = calculateFeatureImportance(predictions);

  return {
    subject,
    gradeLevel,
    calculatedAt: new Date(),
    sampleSize: predictions.length,
    brierScore,
    calibrationError,
    discriminationIndex: calculateDiscriminationIndex(predictions),
    calibrationCurve,
    featureImportance,
    accuracy,
    precision,
    recall,
    f1Score,
    auc: calculateAUC(predictions),
    calibrationAdjustments: calculateCalibrationAdjustments(calibrationCurve),
  };
}

/**
 * Creates default calibration for when no data exists
 */
function createDefaultCalibration(subject: Subject, gradeLevel: GradeLevel): PredictionCalibration {
  return {
    subject,
    gradeLevel,
    calculatedAt: new Date(),
    sampleSize: 0,
    brierScore: 0.25, // Default
    calibrationError: 10,
    discriminationIndex: 0.5,
    calibrationCurve: [],
    featureImportance: FACTOR_WEIGHTS,
    accuracy: 0.5,
    precision: 0.5,
    recall: 0.5,
    f1Score: 0.5,
    auc: 0.5,
    calibrationAdjustments: {},
  };
}

/**
 * Calculates calibration curve by confidence bucket
 */
function calculateCalibrationCurve(
  predictions: Array<{ predictedPassProbability: number; passed: boolean }>
): PredictionCalibration['calibrationCurve'] {
  const buckets: Map<number, { predicted: number[]; actual: number[] }> = new Map();

  for (const pred of predictions) {
    const bucket = Math.floor(pred.predictedPassProbability / 10) * 10;
    if (!buckets.has(bucket)) {
      buckets.set(bucket, { predicted: [], actual: [] });
    }
    buckets.get(bucket)!.predicted.push(pred.predictedPassProbability);
    buckets.get(bucket)!.actual.push(pred.passed ? 100 : 0);
  }

  const curve: PredictionCalibration['calibrationCurve'] = [];
  for (const [bucket, data] of buckets) {
    curve.push({
      confidenceBucket: bucket,
      predictedPassRate: data.predicted.reduce((a, b) => a + b, 0) / data.predicted.length,
      actualPassRate: data.actual.reduce((a, b) => a + b, 0) / data.actual.length,
      sampleSize: data.predicted.length,
    });
  }

  return curve.sort((a, b) => a.confidenceBucket - b.confidenceBucket);
}

/**
 * Calculates discrimination index (ability to separate pass/fail)
 */
function calculateDiscriminationIndex(
  predictions: Array<{ predictedPassProbability: number; passed: boolean }>
): number {
  const passers = predictions.filter(p => p.passed);
  const failers = predictions.filter(p => !p.passed);

  if (passers.length === 0 || failers.length === 0) return 0.5;

  const avgPasserPrediction = passers.reduce((sum, p) =>
    sum + p.predictedPassProbability, 0) / passers.length;
  const avgFailerPrediction = failers.reduce((sum, p) =>
    sum + p.predictedPassProbability, 0) / failers.length;

  // Normalize to 0-1 scale
  return (avgPasserPrediction - avgFailerPrediction) / 100;
}

/**
 * Calculates feature importance (simplified correlation-based approach)
 */
function calculateFeatureImportance(
  predictions: Array<{ factors: ConfidenceFactors; passed: boolean }>
): Record<keyof ConfidenceFactors, number> {
  // Start with default weights
  const importance: Record<keyof ConfidenceFactors, number> = { ...FACTOR_WEIGHTS };

  if (predictions.length < 10) return importance;

  // Calculate correlation of each factor with pass/fail outcome
  for (const factor of Object.keys(FACTOR_WEIGHTS) as (keyof ConfidenceFactors)[]) {
    const factorValues = predictions.map(p => p.factors[factor]);
    const outcomes = predictions.map(p => p.passed ? 1 : 0);

    // Simple correlation calculation
    const n = predictions.length;
    const sumX = factorValues.reduce((a, b) => a + b, 0);
    const sumY = outcomes.reduce((a, b) => a + b, 0);
    const sumXY = factorValues.reduce((sum, x, i) => sum + x * outcomes[i], 0);
    const sumX2 = factorValues.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = outcomes.reduce((sum, y) => sum + y * y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator !== 0) {
      const correlation = Math.abs(numerator / denominator);
      importance[factor] = correlation;
    }
  }

  // Normalize to sum to 1
  const total = Object.values(importance).reduce((a, b) => a + b, 0);
  for (const factor of Object.keys(importance) as (keyof ConfidenceFactors)[]) {
    importance[factor] = importance[factor] / total;
  }

  return importance;
}

/**
 * Calculates AUC (Area Under ROC Curve)
 */
function calculateAUC(
  predictions: Array<{ predictedPassProbability: number; passed: boolean }>
): number {
  // Sort by predicted probability descending
  const sorted = [...predictions].sort((a, b) =>
    b.predictedPassProbability - a.predictedPassProbability
  );

  const totalPositives = predictions.filter(p => p.passed).length;
  const totalNegatives = predictions.length - totalPositives;

  if (totalPositives === 0 || totalNegatives === 0) return 0.5;

  let auc = 0;
  let tpCount = 0;

  for (const pred of sorted) {
    if (pred.passed) {
      tpCount++;
    } else {
      auc += tpCount;
    }
  }

  return auc / (totalPositives * totalNegatives);
}

/**
 * Calculates adjustments needed to improve calibration
 */
function calculateCalibrationAdjustments(
  curve: PredictionCalibration['calibrationCurve']
): Record<string, number> {
  const adjustments: Record<string, number> = {};

  for (const bucket of curve) {
    const error = bucket.actualPassRate - bucket.predictedPassRate;
    if (Math.abs(error) > 5 && bucket.sampleSize >= 5) {
      adjustments[`bucket_${bucket.confidenceBucket}`] = error;
    }
  }

  return adjustments;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Core calculation
  calculateTestOutConfidence,
  getConfidenceCategory,

  // Factor calculations
  calculateMasteryFactors,
  calculatePerformanceFactors,
  calculateBehavioralFactors,

  // Prerequisites
  analyzePrerequisites,

  // Reports
  generateReadinessReport,

  // Calibration
  recordPredictionOutcome,
  calculateSystemCalibration,

  // Constants
  FACTOR_WEIGHTS,
  MASTERY_SCORES,
  CONFIDENCE_THRESHOLDS,
};
