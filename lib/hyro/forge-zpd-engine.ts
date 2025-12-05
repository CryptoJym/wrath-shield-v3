/**
 * HYRO FORGE: Zone of Proximal Development (ZPD) Engine
 *
 * Implements Vygotsky's ZPD concept for adaptive content selection.
 * The ZPD is the "sweet spot" between what a learner can do alone
 * and what they can do with guidance - optimal for growth.
 *
 * Key Principles:
 * - Content should be slightly above current ability (10-20%)
 * - Too easy = boredom, too hard = frustration
 * - Adjust dynamically based on recent performance
 * - Use scaffolding when struggling
 */

import { getDatabase } from '@/lib/db/Database';
import { StatName, STAT_NAMES } from './forge-types';
import { getProficiencyProfile, getSkillProficiency, SkillProficiency } from './forge-proficiency';
import { getLatestResult, DiagnosticResult } from './forge-diagnostics';

// ============================================================================
// State Vector Types (from Manifold)
// ============================================================================

export interface StateVector {
  coherence: number;    // 0-100: Internal consistency of knowledge
  entropy: number;      // 0-100: Ability to handle uncertainty/novelty
  generativity: number; // 0-100: Capacity for novel value creation
  n_items_used: number;
}

export interface ManifoldZPDRecommendation {
  content_type: 'novel_ambiguous' | 'structured_practice' | 'transfer_task' | 'foundational' | 'balanced';
  scaffolding_level: 'minimal' | 'moderate' | 'significant';
  rationale: string;
  target_dimensions: string[]; // Which C/E/G dimensions to develop
}

// ============================================================================
// Types
// ============================================================================

export type ZoneLevel = 'comfort' | 'learning' | 'frustration';
export type PerformanceTrend = 'improving' | 'stable' | 'declining';

export interface ZPDState {
  stat_name: StatName;
  current_level: number;
  confidence: number;
  zpd_lower: number; // Bottom of ZPD
  zpd_upper: number; // Top of ZPD
  optimal_difficulty: number; // Target for content
  zone_width: number;
  recent_performance: number[];
  trend: PerformanceTrend;
  adjustment_needed: 'easier' | 'harder' | 'maintain';
  scaffolding_recommended: boolean;
}

export interface ContentDifficultyMatch {
  content_id: string;
  content_type: string;
  difficulty: number;
  zone_fit: ZoneLevel;
  distance_from_optimal: number;
  recommendation_score: number;
}

export interface ZPDRecommendation {
  stat_name: StatName;
  zpd_state: ZPDState;
  recommended_content: ContentDifficultyMatch[];
  message: string;
}

export interface LearningVelocity {
  stat_name: StatName;
  daily_growth: number;
  weekly_growth: number;
  acceleration: number; // Positive = speeding up, negative = slowing down
  estimated_days_to_benchmark: number | null;
}

// ============================================================================
// Constants
// ============================================================================

// ZPD calculation parameters
const ZPD_OFFSET_LOWER = 0.05; // 5% below current level
const ZPD_OFFSET_UPPER = 0.20; // 20% above current level
const OPTIMAL_OFFSET = 0.12; // Target 12% above current level

// Adjustment thresholds
const SUCCESS_THRESHOLD = 0.80; // 80%+ correct = might be too easy
const STRUGGLE_THRESHOLD = 0.50; // Below 50% = probably too hard
const CONSECUTIVE_SUCCESSES_FOR_INCREASE = 3;
const CONSECUTIVE_FAILURES_FOR_DECREASE = 2;

// Performance window
const RECENT_PERFORMANCE_WINDOW = 10; // Last 10 attempts

// Confidence impact on ZPD width
const MIN_ZONE_WIDTH = 0.10; // At least 10% zone
const MAX_ZONE_WIDTH = 0.25; // At most 25% zone

// Scaffolding triggers
const SCAFFOLDING_FAILURE_STREAK = 3;
const SCAFFOLDING_SUCCESS_RATE_THRESHOLD = 0.40;

// Grade benchmarks
const GRADE_6_BENCHMARK = 50; // Target level for 6th grade

// ============================================================================
// ZPD State Calculation
// ============================================================================

/**
 * Calculate the ZPD state for a stat
 */
export function getZPDState(statName: StatName): ZPDState {
  const db = getDatabase();

  // Get current proficiency
  const proficiency = getSkillProficiency(statName);
  const currentLevel = proficiency?.level ?? 50;
  const confidence = 1 - (proficiency?.uncertainty ?? 0.5);

  // Get recent performance data
  const recentPerformance = getRecentPerformance(statName);

  // Calculate trend
  const trend = calculateTrend(recentPerformance);

  // Calculate ZPD bounds based on level and confidence
  // Higher confidence = narrower zone (more precise targeting)
  // Lower confidence = wider zone (more exploration needed)
  const zoneWidth = Math.max(
    MIN_ZONE_WIDTH,
    Math.min(MAX_ZONE_WIDTH, MAX_ZONE_WIDTH * (1 - confidence * 0.5))
  );

  const zpdLower = Math.max(0, currentLevel - ZPD_OFFSET_LOWER * 100);
  const zpdUpper = Math.min(100, currentLevel + zoneWidth * 100);

  // Calculate optimal difficulty based on trend
  let optimalOffset = OPTIMAL_OFFSET;
  if (trend === 'improving') {
    optimalOffset *= 1.2; // Push slightly harder when improving
  } else if (trend === 'declining') {
    optimalOffset *= 0.8; // Pull back when declining
  }

  const optimalDifficulty = Math.min(100, currentLevel + optimalOffset * 100);

  // Determine adjustment needed
  const avgPerformance = recentPerformance.length > 0
    ? recentPerformance.reduce((a, b) => a + b, 0) / recentPerformance.length
    : 0.7;

  let adjustmentNeeded: 'easier' | 'harder' | 'maintain' = 'maintain';
  if (avgPerformance > SUCCESS_THRESHOLD && recentPerformance.length >= 3) {
    adjustmentNeeded = 'harder';
  } else if (avgPerformance < STRUGGLE_THRESHOLD && recentPerformance.length >= 2) {
    adjustmentNeeded = 'easier';
  }

  // Check if scaffolding is recommended
  const consecutiveFailures = countConsecutiveFailures(recentPerformance);
  const scaffoldingRecommended =
    consecutiveFailures >= SCAFFOLDING_FAILURE_STREAK ||
    avgPerformance < SCAFFOLDING_SUCCESS_RATE_THRESHOLD;

  return {
    stat_name: statName,
    current_level: currentLevel,
    confidence,
    zpd_lower: zpdLower,
    zpd_upper: zpdUpper,
    optimal_difficulty: optimalDifficulty,
    zone_width: zoneWidth * 100,
    recent_performance: recentPerformance,
    trend,
    adjustment_needed: adjustmentNeeded,
    scaffolding_recommended: scaffoldingRecommended,
  };
}

/**
 * Get ZPD states for all stats
 */
export function getAllZPDStates(): ZPDState[] {
  return STAT_NAMES.map(getZPDState);
}

// ============================================================================
// Content Selection
// ============================================================================

/**
 * Score content based on how well it fits the learner's ZPD
 */
export function scoreContentFit(
  contentDifficulty: number,
  zpdState: ZPDState
): ContentDifficultyMatch {
  const { zpd_lower, zpd_upper, optimal_difficulty } = zpdState;

  // Calculate distance from optimal
  const distanceFromOptimal = Math.abs(contentDifficulty - optimal_difficulty);

  // Determine which zone the content falls in
  let zoneFit: ZoneLevel;
  if (contentDifficulty < zpd_lower) {
    zoneFit = 'comfort';
  } else if (contentDifficulty > zpd_upper) {
    zoneFit = 'frustration';
  } else {
    zoneFit = 'learning';
  }

  // Calculate recommendation score (0-100)
  // Perfect score at optimal_difficulty, decreasing as distance increases
  let recommendationScore: number;
  if (zoneFit === 'learning') {
    // In ZPD: score based on distance from optimal
    recommendationScore = Math.max(0, 100 - distanceFromOptimal * 3);
  } else if (zoneFit === 'comfort') {
    // Below ZPD: penalize more heavily
    const belowBy = zpd_lower - contentDifficulty;
    recommendationScore = Math.max(0, 60 - belowBy * 2);
  } else {
    // Above ZPD: penalize heavily (frustration)
    const aboveBy = contentDifficulty - zpd_upper;
    recommendationScore = Math.max(0, 40 - aboveBy * 3);
  }

  return {
    content_id: '',
    content_type: '',
    difficulty: contentDifficulty,
    zone_fit: zoneFit,
    distance_from_optimal: distanceFromOptimal,
    recommendation_score: recommendationScore,
  };
}

/**
 * Select optimal content from a list based on ZPD
 */
export function selectOptimalContent(
  contents: Array<{ id: string; type: string; difficulty: number; stat: StatName }>,
  statName?: StatName
): ContentDifficultyMatch[] {
  const zpdStates = statName
    ? [getZPDState(statName)]
    : getAllZPDStates();

  const scored: ContentDifficultyMatch[] = [];

  for (const content of contents) {
    const relevantZPD = zpdStates.find((z) => z.stat_name === content.stat);
    if (!relevantZPD) continue;

    const match = scoreContentFit(content.difficulty, relevantZPD);
    scored.push({
      ...match,
      content_id: content.id,
      content_type: content.type,
    });
  }

  // Sort by recommendation score (highest first)
  return scored.sort((a, b) => b.recommendation_score - a.recommendation_score);
}

/**
 * Get content recommendation with context
 */
export function getContentRecommendation(statName: StatName): ZPDRecommendation {
  const db = getDatabase();
  const zpdState = getZPDState(statName);

  // Get available content for this stat
  const contentItems = db.prepare(`
    SELECT
      id,
      content_type as type,
      difficulty_level as difficulty,
      primary_stat as stat
    FROM hyro_content_skill_map
    WHERE primary_stat = ?
    ORDER BY difficulty_level
  `).all(statName) as Array<{ id: string; type: string; difficulty: number; stat: StatName }>;

  const recommendedContent = selectOptimalContent(contentItems, statName);

  // Generate message
  let message: string;
  if (zpdState.scaffolding_recommended) {
    message = `${formatStatName(statName)} needs support. Recent performance suggests starting with easier material and building up.`;
  } else if (zpdState.adjustment_needed === 'harder') {
    message = `Great progress in ${formatStatName(statName)}! Ready for more challenging content.`;
  } else if (zpdState.adjustment_needed === 'easier') {
    message = `Let's reinforce ${formatStatName(statName)} foundations before moving forward.`;
  } else {
    message = `${formatStatName(statName)} is progressing well. Continue at current difficulty.`;
  }

  return {
    stat_name: statName,
    zpd_state: zpdState,
    recommended_content: recommendedContent.slice(0, 5),
    message,
  };
}

// ============================================================================
// Learning Velocity
// ============================================================================

/**
 * Calculate learning velocity (rate of improvement)
 */
export function getLearningVelocity(statName: StatName): LearningVelocity {
  const db = getDatabase();

  // Get proficiency history
  const history = db.prepare(`
    SELECT estimated_level, updated_at
    FROM hyro_stat_proficiency
    WHERE stat_name = ?
    ORDER BY updated_at DESC
    LIMIT 30
  `).all(statName) as Array<{ estimated_level: number; updated_at: number }>;

  if (history.length < 2) {
    return {
      stat_name: statName,
      daily_growth: 0,
      weekly_growth: 0,
      acceleration: 0,
      estimated_days_to_benchmark: null,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 24 * 60 * 60;
  const weekAgo = now - 7 * 24 * 60 * 60;

  // Find levels at different points
  const currentLevel = history[0].estimated_level;
  const dayAgoLevel = history.find((h) => h.updated_at <= dayAgo)?.estimated_level ?? currentLevel;
  const weekAgoLevel = history.find((h) => h.updated_at <= weekAgo)?.estimated_level ?? dayAgoLevel;

  const dailyGrowth = currentLevel - dayAgoLevel;
  const weeklyGrowth = currentLevel - weekAgoLevel;

  // Calculate acceleration (is learning speeding up or slowing down?)
  // Compare first half of week to second half
  const midWeek = now - 3.5 * 24 * 60 * 60;
  const midWeekLevel = history.find((h) => h.updated_at <= midWeek)?.estimated_level ?? weekAgoLevel;

  const firstHalfGrowth = midWeekLevel - weekAgoLevel;
  const secondHalfGrowth = currentLevel - midWeekLevel;
  const acceleration = secondHalfGrowth - firstHalfGrowth;

  // Estimate days to benchmark
  let estimatedDays: number | null = null;
  if (currentLevel < GRADE_6_BENCHMARK && dailyGrowth > 0) {
    const remaining = GRADE_6_BENCHMARK - currentLevel;
    estimatedDays = Math.ceil(remaining / dailyGrowth);
  }

  return {
    stat_name: statName,
    daily_growth: dailyGrowth,
    weekly_growth: weeklyGrowth,
    acceleration,
    estimated_days_to_benchmark: estimatedDays,
  };
}

/**
 * Get learning velocity for all stats
 */
export function getAllLearningVelocities(): LearningVelocity[] {
  return STAT_NAMES.map(getLearningVelocity);
}

// ============================================================================
// Adaptive Difficulty Adjustment
// ============================================================================

/**
 * Get recommended difficulty adjustment after an activity
 */
export function getPostActivityAdjustment(
  statName: StatName,
  activitySuccess: boolean,
  activityDifficulty: number,
  timeSpentSeconds?: number
): {
  new_target_difficulty: number;
  adjustment_reason: string;
  confidence_change: number;
} {
  const zpdState = getZPDState(statName);

  let difficultyChange = 0;
  let confidenceChange = 0;
  let reason: string;

  if (activitySuccess) {
    // Success - potentially increase difficulty
    if (activityDifficulty >= zpdState.optimal_difficulty) {
      // Success at or above optimal - good progress
      difficultyChange = 3;
      confidenceChange = 0.02;
      reason = 'Success at challenging level - increasing difficulty';
    } else {
      // Success below optimal - move toward optimal
      difficultyChange = Math.min(5, (zpdState.optimal_difficulty - activityDifficulty) / 2);
      confidenceChange = 0.01;
      reason = 'Success at comfortable level - progressing toward ZPD';
    }

    // Fast completion bonus
    if (timeSpentSeconds && timeSpentSeconds < 60) {
      difficultyChange += 2;
      reason += ' (fast completion)';
    }
  } else {
    // Failure - potentially decrease difficulty
    if (activityDifficulty > zpdState.zpd_upper) {
      // Failed above ZPD - expected, significant decrease
      difficultyChange = -5;
      confidenceChange = -0.01;
      reason = 'Struggled above ZPD - returning to optimal zone';
    } else if (activityDifficulty > zpdState.optimal_difficulty) {
      // Failed above optimal but in ZPD - moderate decrease
      difficultyChange = -3;
      confidenceChange = -0.005;
      reason = 'Challenge was slightly too high - adjusting down';
    } else {
      // Failed at or below optimal - concerning, check for patterns
      difficultyChange = -2;
      confidenceChange = -0.01;
      reason = 'Unexpected struggle - may need review or scaffolding';
    }
  }

  const newTargetDifficulty = Math.max(
    zpdState.zpd_lower,
    Math.min(zpdState.zpd_upper, activityDifficulty + difficultyChange)
  );

  return {
    new_target_difficulty: newTargetDifficulty,
    adjustment_reason: reason,
    confidence_change: confidenceChange,
  };
}

// ============================================================================
// Flow State Detection
// ============================================================================

/**
 * Detect if learner is likely in a "flow state"
 * Flow = optimal challenge + engagement + immediate feedback
 */
export function detectFlowState(statName: StatName): {
  in_flow: boolean;
  flow_score: number;
  indicators: string[];
} {
  const zpdState = getZPDState(statName);
  const velocity = getLearningVelocity(statName);

  const indicators: string[] = [];
  let flowScore = 50; // Neutral baseline

  // Check challenge-skill balance
  if (zpdState.adjustment_needed === 'maintain') {
    flowScore += 15;
    indicators.push('Good challenge-skill balance');
  }

  // Check performance trend
  if (zpdState.trend === 'improving') {
    flowScore += 10;
    indicators.push('Improving performance trend');
  } else if (zpdState.trend === 'declining') {
    flowScore -= 10;
  }

  // Check recent performance consistency
  if (zpdState.recent_performance.length >= 5) {
    const variance = calculateVariance(zpdState.recent_performance);
    if (variance < 0.1) {
      flowScore += 10;
      indicators.push('Consistent performance');
    }
  }

  // Check learning velocity
  if (velocity.acceleration > 0) {
    flowScore += 10;
    indicators.push('Accelerating learning');
  }

  // Negative indicators
  if (zpdState.scaffolding_recommended) {
    flowScore -= 20;
    indicators.push('Scaffolding needed (not in flow)');
  }

  const inFlow = flowScore >= 70;

  return {
    in_flow: inFlow,
    flow_score: Math.max(0, Math.min(100, flowScore)),
    indicators,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getRecentPerformance(statName: StatName): number[] {
  const db = getDatabase();

  // Get recent diagnostic responses
  const diagnosticResponses = db.prepare(`
    SELECT is_correct
    FROM hyro_diagnostic_responses dr
    JOIN hyro_diagnostic_sessions ds ON dr.session_id = ds.id
    WHERE ds.stat_name = ?
    ORDER BY dr.created_at DESC
    LIMIT ?
  `).all(statName, RECENT_PERFORMANCE_WINDOW) as Array<{ is_correct: number }>;

  // Get recent SRS responses
  const srsResponses = db.prepare(`
    SELECT CASE WHEN quality >= 3 THEN 1 ELSE 0 END as is_correct
    FROM hyro_srs_review_history rh
    JOIN hyro_srs_cards c ON rh.card_id = c.id
    JOIN hyro_srs_decks d ON c.deck_id = d.id
    WHERE d.subject = ?
    ORDER BY rh.reviewed_at DESC
    LIMIT ?
  `).all(statName, RECENT_PERFORMANCE_WINDOW) as Array<{ is_correct: number }>;

  // Combine and return as percentages
  const allResponses = [...diagnosticResponses, ...srsResponses]
    .slice(0, RECENT_PERFORMANCE_WINDOW)
    .map((r) => r.is_correct);

  return allResponses;
}

function calculateTrend(performance: number[]): PerformanceTrend {
  if (performance.length < 3) return 'stable';

  // Compare first half to second half
  const midpoint = Math.floor(performance.length / 2);
  const firstHalf = performance.slice(midpoint);
  const secondHalf = performance.slice(0, midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const difference = secondAvg - firstAvg;

  if (difference > 0.1) return 'improving';
  if (difference < -0.1) return 'declining';
  return 'stable';
}

function countConsecutiveFailures(performance: number[]): number {
  let count = 0;
  for (const p of performance) {
    if (p === 0) count++;
    else break;
  }
  return count;
}

function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

function formatStatName(stat: StatName): string {
  return stat
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// State Vector Integration (Manifold)
// ============================================================================

/**
 * Get state vector for a stat from the database
 */
export function getStateVector(statName: StatName, studentId?: string): StateVector | null {
  const db = getDatabase();
  const id = studentId ? `sv_${studentId}_${statName}` : null;

  // If no studentId, get from hyro_state_vectors with default student
  const query = studentId
    ? `SELECT * FROM hyro_state_vectors WHERE student_id = ? AND stat_name = ?`
    : `SELECT * FROM hyro_state_vectors WHERE stat_name = ? LIMIT 1`;

  const vector = studentId
    ? db.prepare(query).get(studentId, statName) as any
    : db.prepare(query).get(statName) as any;

  if (!vector) {
    return null;
  }

  return {
    coherence: vector.coherence ?? 50,
    entropy: vector.entropy ?? 50,
    generativity: vector.generativity ?? 50,
    n_items_used: vector.n_items_used ?? 0,
  };
}

/**
 * Get manifold-based ZPD recommendation using state vectors
 * Implements the rules from HYRO_MANIFOLD_FOUNDATION.md section 8.2
 */
export function getManifoldZPDRecommendation(
  statName: StatName,
  studentId?: string
): ManifoldZPDRecommendation {
  const stateVector = getStateVector(statName, studentId);

  // Default if no state vector data
  if (!stateVector || stateVector.n_items_used < 3) {
    return {
      content_type: 'balanced',
      scaffolding_level: 'moderate',
      rationale: 'Insufficient data for manifold recommendation. Using balanced approach.',
      target_dimensions: ['coherence', 'entropy', 'generativity'],
    };
  }

  const { coherence, entropy, generativity } = stateVector;

  // Classification based on HYRO_MANIFOLD_FOUNDATION.md section 8.2
  // High = > 65, Low = < 40

  // Case 1: High Coherence, Low Entropy → Ready for novel/ambiguous content
  if (coherence > 65 && entropy < 40) {
    return {
      content_type: 'novel_ambiguous',
      scaffolding_level: 'minimal',
      rationale: `Strong knowledge coherence (${coherence}) but limited entropy tolerance (${entropy}). Ready to stretch comfort with ambiguity.`,
      target_dimensions: ['entropy', 'generativity'],
    };
  }

  // Case 2: Low Coherence, High Entropy → Needs structured practice
  if (coherence < 40 && entropy > 65) {
    return {
      content_type: 'structured_practice',
      scaffolding_level: 'significant',
      rationale: `High adaptability (${entropy}) but fragmented understanding (${coherence}). Focus on building integrated knowledge.`,
      target_dimensions: ['coherence'],
    };
  }

  // Case 3: High Generativity → Ready for transfer tasks
  if (generativity > 65) {
    return {
      content_type: 'transfer_task',
      scaffolding_level: 'minimal',
      rationale: `Strong generative capacity (${generativity}). Ready for cross-domain application and creative transfer.`,
      target_dimensions: ['generativity', 'entropy'],
    };
  }

  // Case 4: Low Generativity → Focus on foundational understanding
  if (generativity < 40) {
    return {
      content_type: 'foundational',
      scaffolding_level: 'moderate',
      rationale: `Limited generative capacity (${generativity}). Build foundational understanding before transfer tasks.`,
      target_dimensions: ['coherence', 'generativity'],
    };
  }

  // Case 5: Balanced profile → Continue balanced development
  return {
    content_type: 'balanced',
    scaffolding_level: determineScaffoldingLevel(coherence, entropy, generativity),
    rationale: `Balanced manifold position (C:${coherence}, E:${entropy}, G:${generativity}). Continue well-rounded development.`,
    target_dimensions: identifyWeakestDimensions(coherence, entropy, generativity),
  };
}

/**
 * Get enhanced ZPD state that incorporates state vectors
 */
export function getEnhancedZPDState(statName: StatName, studentId?: string): ZPDState & {
  manifold_recommendation: ManifoldZPDRecommendation;
  state_vector: StateVector | null;
} {
  const baseZPDState = getZPDState(statName);
  const stateVector = getStateVector(statName, studentId);
  const manifoldRecommendation = getManifoldZPDRecommendation(statName, studentId);

  // Adjust ZPD bounds based on state vector if available
  if (stateVector && stateVector.n_items_used >= 3) {
    // High entropy tolerance → widen the upper ZPD bound (can handle more challenge)
    if (stateVector.entropy > 65) {
      baseZPDState.zpd_upper = Math.min(100, baseZPDState.zpd_upper + 5);
      baseZPDState.optimal_difficulty = Math.min(100, baseZPDState.optimal_difficulty + 3);
    }

    // Low entropy tolerance → narrow the ZPD (needs more structure)
    if (stateVector.entropy < 40) {
      baseZPDState.zpd_upper = Math.max(baseZPDState.zpd_lower + 10, baseZPDState.zpd_upper - 5);
      baseZPDState.optimal_difficulty = Math.max(
        baseZPDState.zpd_lower + 5,
        baseZPDState.optimal_difficulty - 3
      );
    }

    // Low coherence → recommend scaffolding
    if (stateVector.coherence < 40) {
      baseZPDState.scaffolding_recommended = true;
    }
  }

  return {
    ...baseZPDState,
    manifold_recommendation: manifoldRecommendation,
    state_vector: stateVector,
  };
}

/**
 * Get all enhanced ZPD states
 */
export function getAllEnhancedZPDStates(studentId?: string) {
  return STAT_NAMES.map(stat => getEnhancedZPDState(stat, studentId));
}

// Helper: Determine scaffolding level based on overall manifold position
function determineScaffoldingLevel(
  coherence: number,
  entropy: number,
  generativity: number
): 'minimal' | 'moderate' | 'significant' {
  const average = (coherence + entropy + generativity) / 3;

  if (average > 60) return 'minimal';
  if (average > 40) return 'moderate';
  return 'significant';
}

// Helper: Identify weakest dimensions to target
function identifyWeakestDimensions(
  coherence: number,
  entropy: number,
  generativity: number
): string[] {
  const dims = [
    { name: 'coherence', value: coherence },
    { name: 'entropy', value: entropy },
    { name: 'generativity', value: generativity },
  ];

  dims.sort((a, b) => a.value - b.value);

  // Return the two weakest
  return dims.slice(0, 2).map(d => d.name);
}
