/**
 * Wrath Shield v3 - UIX Metrics Calculation
 *
 * Calculates User Interface Experience (UIX) confidence score based on:
 * - Tweak improvements (rewrite/escalate actions)
 * - Recency weighting (72-hour decay)
 * - Open flag penalties
 * - Three pillars: Word (0.4), Action (0.4), Body (0.2)
 */

import { ensureServerOnly } from './server-only-guard';
import type { Tweak, Flag } from './db/types';

ensureServerOnly('lib/metrics');

/**
 * UIX Metrics Interface
 */
export interface UIXMetrics {
  overall_score: number; // 0-100
  pillars: {
    word: number; // 0-100, weight 0.4
    action: number; // 0-100, weight 0.4
    body: number; // 0-100, weight 0.2
  };
  delta: number; // Change from 24h ago
  open_flags: number; // Count of pending flags
  penalties: {
    open_flags_penalty: number; // -1 per open flag
    recency_factor: number; // 0-1, how recent the tweaks are
  };
  top_fixes: Array<{
    flag_id: string;
    original_text: string;
    suggested_lift: number; // Estimated UIX gain
  }>;
}

/**
 * Configuration for UIX calculation
 */
const UIX_CONFIG = {
  PILLAR_WEIGHTS: {
    word: 0.4,
    action: 0.4,
    body: 0.2,
  },
  DECAY_HOURS: 72, // 72-hour window for recency weighting
  OPEN_FLAG_PENALTY: 1, // -1 point per open flag
  BASE_SCORE: 50, // Starting baseline (0 = rock bottom, 50 = average)
  MAX_SCORE: 100,
  MIN_SCORE: 0,
};

/**
 * Calculate time decay factor
 * Linear decay from 1.0 (now) to 0.0 (72h ago)
 */
function calculateDecayFactor(timestamp: number): number {
  const now = Math.floor(Date.now() / 1000);
  const ageInSeconds = now - timestamp;
  const ageInHours = ageInSeconds / 3600;

  if (ageInHours < 0) return 1.0; // Future timestamp (shouldn't happen)
  if (ageInHours >= UIX_CONFIG.DECAY_HOURS) return 0.0; // Too old

  // Linear decay: 1.0 at t=0, 0.0 at t=72h
  return 1.0 - ageInHours / UIX_CONFIG.DECAY_HOURS;
}

/**
 * Classify tweak into pillar category
 * - Word: rewrites that improve text confidence
 * - Action: escalations and boundary-setting
 * - Body: (future) physical confidence signals from WHOOP
 */
function classifyTweakPillar(
  tweak: Tweak
): 'word' | 'action' | 'body' | 'none' {
  switch (tweak.action_type) {
    case 'rewrite':
      // Rewrite actions improve "Word" pillar
      return 'word';
    case 'escalate':
      // Escalations improve "Action" pillar
      return 'action';
    case 'dismiss':
      // Dismissals don't contribute to confidence
      return 'none';
    default:
      return 'none';
  }
}

/**
 * Calculate pillar score from tweaks
 * Applies decay factor and sums delta_uix contributions
 */
function calculatePillarScore(
  tweaks: Tweak[],
  pillar: 'word' | 'action' | 'body'
): number {
  const relevantTweaks = tweaks.filter(
    (t) => classifyTweakPillar(t) === pillar
  );

  const weightedSum = relevantTweaks.reduce((sum, tweak) => {
    const decayFactor = calculateDecayFactor(tweak.created_at);
    return sum + tweak.delta_uix * decayFactor;
  }, 0);

  // Normalize to 0-100 scale
  // Assume ~100 points of delta_uix = 100% pillar score
  const normalized = Math.min(weightedSum, 100);
  return Math.max(normalized, 0);
}

/**
 * Calculate Body pillar from WHOOP recovery data
 * High recovery = confident body state
 */
function calculateBodyPillar(recoveryScore: number | null): number {
  if (recoveryScore === null) return UIX_CONFIG.BASE_SCORE;

  // Recovery score is 0-100, directly maps to body confidence
  return Math.min(Math.max(recoveryScore, UIX_CONFIG.MIN_SCORE), UIX_CONFIG.MAX_SCORE);
}

/**
 * Calculate UIX metrics from database data
 *
 * @param tweaks - All tweaks from last 72 hours
 * @param flags - All flags (to count open ones)
 * @param previousScore - UIX score from 24h ago (for delta calculation)
 * @param recoveryScore - Latest WHOOP recovery score (for Body pillar)
 */
export function calculateUIXMetrics(
  tweaks: Tweak[],
  flags: Flag[],
  previousScore: number | null,
  recoveryScore: number | null
): UIXMetrics {
  // Filter tweaks to last 72 hours
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - UIX_CONFIG.DECAY_HOURS * 3600;
  const recentTweaks = tweaks.filter((t) => t.created_at >= cutoff);

  // Calculate pillar scores
  const wordScore = calculatePillarScore(recentTweaks, 'word');
  const actionScore = calculatePillarScore(recentTweaks, 'action');
  const bodyScore = calculateBodyPillar(recoveryScore);

  // Calculate weighted overall score
  // When there's no tweak data (word and action both 0), use base score
  let rawScore: number;
  if (wordScore === 0 && actionScore === 0) {
    // No tweak data - start from base score
    rawScore = UIX_CONFIG.BASE_SCORE;
  } else {
    // Has tweak data - use weighted formula
    rawScore =
      wordScore * UIX_CONFIG.PILLAR_WEIGHTS.word +
      actionScore * UIX_CONFIG.PILLAR_WEIGHTS.action +
      bodyScore * UIX_CONFIG.PILLAR_WEIGHTS.body;
  }

  // Count open flags for penalty
  const openFlags = flags.filter((f) => f.status === 'pending');
  const openFlagPenalty = openFlags.length * UIX_CONFIG.OPEN_FLAG_PENALTY;

  // Apply penalties
  const finalScore = Math.max(
    UIX_CONFIG.MIN_SCORE,
    Math.min(UIX_CONFIG.MAX_SCORE, rawScore - openFlagPenalty)
  );

  // Calculate delta from previous score
  const delta = previousScore !== null ? finalScore - previousScore : 0;

  // Calculate average recency factor (for observability)
  const avgRecency =
    recentTweaks.length > 0
      ? recentTweaks.reduce(
          (sum, t) => sum + calculateDecayFactor(t.created_at),
          0
        ) / recentTweaks.length
      : 0;

  // Generate top fix suggestions (highest severity open flags)
  const topFixes = openFlags
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2)
    .map((flag) => ({
      flag_id: flag.id,
      original_text: flag.original_text,
      suggested_lift: flag.severity * 5, // Estimate: severity * 5 points
    }));

  return {
    overall_score: Math.round(finalScore),
    pillars: {
      word: Math.round(wordScore),
      action: Math.round(actionScore),
      body: Math.round(bodyScore),
    },
    delta: Math.round(delta),
    open_flags: openFlags.length,
    penalties: {
      open_flags_penalty: openFlagPenalty,
      recency_factor: avgRecency,
    },
    top_fixes: topFixes,
  };
}

/**
 * Get UIX score from 24 hours ago (for delta calculation)
 * Fetches tweaks and flags from 24-96h window and recalculates
 */
export async function getPreviousUIXScore(
  tweaks: Tweak[],
  flags: Flag[],
  recoveryScore: number | null
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 24 * 3600;
  const threeDaysAgo = now - 72 * 3600;

  // Filter tweaks to 24-96h window (as of 24h ago)
  const historicalTweaks = tweaks.filter(
    (t) => t.created_at >= threeDaysAgo && t.created_at < oneDayAgo
  );

  // Calculate metrics as they would have been 24h ago
  const metrics = calculateUIXMetrics(
    historicalTweaks,
    flags,
    null,
    recoveryScore
  );

  return metrics.overall_score;
}
