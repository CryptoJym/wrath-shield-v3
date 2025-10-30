/**
 * Saturation learning scaffolding for Lane B (Task 10).
 * This module exposes a deterministic, side-effect-free interface that can be
 * integrated later with personalization signals.
 */

export interface SaturationInput {
  correctStreak: number; // consecutive correct answers
  ease: number; // 1..3 scale (1=hard, 2=medium, 3=easy)
  lastIntervalMinutes: number; // previous interval in minutes
}

export interface SaturationOutput {
  nextIntervalMinutes: number;
  confidence: number; // 0..1 normalized confidence score
}

/**
 * Compute the next interval using a simple exponential approach with
 * streak and ease multipliers. Pure and deterministic.
 */
export function computeNextInterval(input: SaturationInput): SaturationOutput {
  const base = Math.max(1, input.lastIntervalMinutes || 1);
  const easeMultiplier = input.ease <= 1 ? 1.2 : input.ease >= 3 ? 2.2 : 1.6;
  const streakMultiplier = 1 + Math.min(10, Math.max(0, input.correctStreak)) * 0.08; // up to ~1.8x
  const next = Math.round(base * easeMultiplier * streakMultiplier);
  // Confidence rises with both ease and streak, bounded [0.2..0.98]
  const confidence = Math.max(0.2, Math.min(0.98, 0.4 + (input.ease - 1) * 0.2 + Math.min(10, input.correctStreak) * 0.04));
  return { nextIntervalMinutes: next, confidence: Number(confidence.toFixed(2)) };
}
