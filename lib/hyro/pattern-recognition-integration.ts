/**
 * Pattern Recognition Integration with Hyro Learning System
 *
 * This file integrates the Pattern Recognition & Medici Effect training modules
 * with the existing Hyro infrastructure:
 * - C/E/G Manifold state tracking
 * - Meta-Dimensions system
 * - XP and achievement system
 * - Standards mapping
 * - Assessment framework
 *
 * @hyro-domain pattern_recognition
 * @hyro-integration manifold, meta-dimensions, xp, assessment
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { randomUUID } from 'crypto';

// Import from existing Hyro infrastructure
import type { LearnerState, TrajectoryEffect, AttractorType } from './forge-learner-state';
import type { MetaDimensions, MetaDimensionName } from './forge-meta-dimensions';
import type { StatName, XPSource, XPTransaction } from './forge-types';

// Import Pattern Recognition types
import type {
  Pattern,
  StructuralPatternType,
  KnowledgeDomain,
  PatternRecognitionDimension,
  AnalogyMapping,
  AnalogyQuality,
  ChunkingExercise,
  PRStandardId,
  CognitiveChunk,
  PRAssessmentResult,
  PREvent,
} from './pattern-recognition-types';

import { PATTERN_LIBRARY, PR_STANDARDS } from './pattern-recognition-curriculum';

ensureServerOnly('lib/hyro/pattern-recognition-integration');

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * XP rewards for pattern recognition activities
 */
export const PR_XP_REWARDS = {
  pattern_introduced: 15,
  pattern_recognized: 25,
  pattern_applied: 40,
  pattern_transferred: 60,
  analogy_completed: 30,
  analogy_generated: 50,
  intersection_explored: 75,
  intersection_innovation: 100,
  chunk_strengthened: 10,
  milestone_reached: 150,
};

/**
 * Pattern Recognition contribution to Meta-Dimensions
 * Pattern recognition training primarily affects these meta-dimensions
 */
export const PR_META_CONTRIBUTIONS: Partial<Record<MetaDimensionName, number>> = {
  manifold_fluidity: 0.4,      // Cross-domain movement
  multi_model_coherence: 0.5,  // Connecting different mental models
  entropy_intuition: 0.3,      // Handling novel patterns
  cooperative_generativity: 0.3, // Creating new connections
};

/**
 * Pattern Recognition to Stat contributions
 * Different patterns contribute to different academic stats
 */
export const PATTERN_STAT_CONTRIBUTIONS: Partial<Record<StructuralPatternType, StatName[]>> = {
  proportional_relationship: ['math', 'science'],
  exponential_growth: ['math', 'science'],
  feedback_loop: ['science', 'critical_thinking'],
  network_effect: ['technology', 'critical_thinking'],
  threshold_effect: ['science', 'critical_thinking'],
  emergence: ['science', 'critical_thinking', 'problem_solving'],
  hierarchy: ['study_skills', 'critical_thinking'],
  modularity: ['coding', 'technology'],
  trade_off: ['math', 'critical_thinking', 'problem_solving'],
  leverage_point: ['problem_solving', 'critical_thinking'],
};

/**
 * C/E/G trajectory effects for pattern recognition activities
 */
export const PR_TRAJECTORY_EFFECTS: Record<string, TrajectoryEffect> = {
  pattern_introduction: {
    delta_C: 5,   // Learning new patterns increases coherence
    delta_E: 8,   // Some uncertainty while learning
    delta_G: 3,   // Mild generativity boost
    confidence: 0.7,
  },
  pattern_recognition_success: {
    delta_C: 8,   // Successful recognition boosts coherence
    delta_E: -5,  // Reduces entropy (more confident)
    delta_G: 5,   // Can now generate with this pattern
    confidence: 0.8,
  },
  pattern_recognition_failure: {
    delta_C: -3,  // Mild coherence hit
    delta_E: 10,  // Increased uncertainty
    delta_G: 2,   // Still some learning
    confidence: 0.6,
  },
  transfer_success: {
    delta_C: 10,  // Strong coherence from cross-domain connection
    delta_E: -3,  // More stability
    delta_G: 15,  // High generativity from novel application
    confidence: 0.85,
  },
  transfer_failure: {
    delta_C: 0,   // Neutral - attempted something hard
    delta_E: 12,  // More uncertainty
    delta_G: 5,   // Learning from the attempt
    confidence: 0.5,
  },
  intersection_insight: {
    delta_C: 8,
    delta_E: 5,   // Productive uncertainty
    delta_G: 20,  // Major generativity from innovation
    confidence: 0.75,
  },
};

// =============================================================================
// LEARNER STATE INTEGRATION
// =============================================================================

/**
 * Get student's Pattern Recognition dimension state
 */
export function getPatternRecognitionState(studentId: string): PatternRecognitionDimension {
  const db = getDatabase();

  // Get existing PR state or create default
  const row = db.prepare(`
    SELECT components_json
    FROM hyro_state_vectors
    WHERE student_id = ? AND stat_name = 'pattern_recognition'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(studentId) as { components_json: string } | undefined;

  if (row) {
    try {
      return JSON.parse(row.components_json) as PatternRecognitionDimension;
    } catch {
      // Fall through to default
    }
  }

  // Return default state
  return createDefaultPRState();
}

/**
 * Create default Pattern Recognition state
 */
function createDefaultPRState(): PatternRecognitionDimension {
  return {
    overallScore: 50,
    patternLibrary: {
      score: 50,
      chunksAcquired: 0,
      chunksActive: 0,
      averageChunkStrength: 50,
      domainCoverage: {} as Record<KnowledgeDomain, number>,
    },
    analogicalReasoning: {
      score: 50,
      analogiesCompleted: 0,
      averageQuality: 'surface_only',
      structuralMappingAccuracy: 50,
      inferenceGenerationRate: 0,
    },
    crossDomainTransfer: {
      score: 50,
      successfulTransfers: 0,
      attemptedTransfers: 0,
      transferRate: 0,
      preferredSourceDomains: [],
      difficultTargetDomains: [],
    },
    intersectionThinking: {
      score: 50,
      explorationsSessions: 0,
      uniqueIntersectionsFound: 0,
      noveltyScoreAverage: 50,
      feasibilityScoreAverage: 50,
    },
    history: [],
  };
}

/**
 * Update Pattern Recognition state
 */
export function updatePatternRecognitionState(
  studentId: string,
  updates: Partial<PatternRecognitionDimension>,
  source: string
): PatternRecognitionDimension {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const current = getPatternRecognitionState(studentId);
  const updated: PatternRecognitionDimension = {
    ...current,
    ...updates,
    history: [
      {
        timestamp: new Date(),
        scores: {
          patternLibrary: updates.patternLibrary?.score ?? current.patternLibrary.score,
          analogicalReasoning: updates.analogicalReasoning?.score ?? current.analogicalReasoning.score,
          crossDomainTransfer: updates.crossDomainTransfer?.score ?? current.crossDomainTransfer.score,
          intersectionThinking: updates.intersectionThinking?.score ?? current.intersectionThinking.score,
        },
        activity: source,
      },
      ...current.history.slice(0, 99), // Keep last 100 entries
    ],
  };

  // Recalculate overall score
  updated.overallScore = (
    updated.patternLibrary.score +
    updated.analogicalReasoning.score +
    updated.crossDomainTransfer.score +
    updated.intersectionThinking.score
  ) / 4;

  // Store in state vectors table
  const id = randomUUID();
  db.prepare(`
    INSERT INTO hyro_state_vectors (
      id, student_id, stat_name, coherence, entropy, generativity,
      components_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    studentId,
    'pattern_recognition',
    0, 0, 0, // Not used directly for PR dimension
    JSON.stringify(updated),
    now,
    now
  );

  return updated;
}

// =============================================================================
// CHUNK MANAGEMENT
// =============================================================================

/**
 * Get student's cognitive chunks (patterns in long-term memory)
 */
export function getStudentChunks(
  studentId: string,
  options?: {
    domain?: KnowledgeDomain;
    minStrength?: number;
    dueSoon?: boolean;
  }
): CognitiveChunk[] {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  let query = `
    SELECT components_json
    FROM hyro_state_vectors
    WHERE student_id = ? AND stat_name = 'cognitive_chunk'
  `;
  const params: (string | number)[] = [studentId];

  const rows = db.prepare(query).all(...params) as { components_json: string }[];

  let chunks: CognitiveChunk[] = rows
    .map(row => {
      try {
        return JSON.parse(row.components_json) as CognitiveChunk;
      } catch {
        return null;
      }
    })
    .filter((c): c is CognitiveChunk => c !== null);

  // Apply filters
  if (options?.domain) {
    chunks = chunks.filter(c => c.domain === options.domain);
  }
  if (options?.minStrength !== undefined) {
    chunks = chunks.filter(c => c.strength >= options.minStrength!);
  }
  if (options?.dueSoon) {
    const soonThreshold = now + 7 * 24 * 60 * 60; // 7 days
    // Filter to chunks that need review (would need SRS integration)
    chunks = chunks.filter(c => c.activationCount < 5 || c.strength < 70);
  }

  return chunks;
}

/**
 * Record a new cognitive chunk or update existing
 */
export function recordChunk(
  studentId: string,
  patternId: string,
  domain: KnowledgeDomain,
  triggerCues: string[]
): CognitiveChunk {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Check for existing chunk
  const existing = getStudentChunks(studentId).find(c => c.patternId === patternId);

  if (existing) {
    // Strengthen existing chunk
    existing.strength = Math.min(100, existing.strength + 5);
    existing.lastActivated = new Date();
    existing.activationCount++;

    // Update in DB
    db.prepare(`
      UPDATE hyro_state_vectors
      SET components_json = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(existing), now, existing.id);

    return existing;
  }

  // Create new chunk
  const chunk: CognitiveChunk = {
    id: randomUUID(),
    learnerId: studentId,
    patternId,
    domain,
    description: PATTERN_LIBRARY[patternId as StructuralPatternType]?.abstractDescription ?? patternId,
    triggerCues,
    strength: 50, // Start at neutral
    lastActivated: new Date(),
    activationCount: 1,
    linkedChunks: [],
    transferHistory: [],
  };

  // Store
  db.prepare(`
    INSERT INTO hyro_state_vectors (
      id, student_id, stat_name, coherence, entropy, generativity,
      components_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chunk.id,
    studentId,
    'cognitive_chunk',
    0, 0, 0,
    JSON.stringify(chunk),
    now,
    now
  );

  return chunk;
}

/**
 * Record transfer attempt for a chunk
 */
export function recordChunkTransfer(
  studentId: string,
  chunkId: string,
  toDomain: KnowledgeDomain,
  successful: boolean,
  notes?: string
): CognitiveChunk | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const chunks = getStudentChunks(studentId);
  const chunk = chunks.find(c => c.id === chunkId);

  if (!chunk) return null;

  chunk.transferHistory.push({
    toDomain,
    successful,
    timestamp: new Date(),
    notes,
  });

  // Update strength based on transfer success
  if (successful) {
    chunk.strength = Math.min(100, chunk.strength + 10);
  } else {
    chunk.strength = Math.max(0, chunk.strength - 2); // Small penalty for failed transfer
  }

  // Update in DB
  db.prepare(`
    UPDATE hyro_state_vectors
    SET components_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(chunk), now, chunk.id);

  return chunk;
}

// =============================================================================
// XP & ACHIEVEMENT INTEGRATION
// =============================================================================

/**
 * Award XP for pattern recognition activities
 */
export function awardPatternXP(
  studentId: string,
  activityType: keyof typeof PR_XP_REWARDS,
  multiplier: number = 1,
  notes?: string
): XPTransaction {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const baseXP = PR_XP_REWARDS[activityType];
  const amount = Math.round(baseXP * multiplier);

  const transaction: XPTransaction = {
    id: randomUUID(),
    amount,
    source: 'study_pattern' as XPSource, // Use existing XP source type
    source_id: activityType,
    multiplier,
    notes: notes ?? `Pattern recognition: ${activityType}`,
    created_at: now,
  };

  // Insert into XP transactions table
  db.prepare(`
    INSERT INTO hyro_xp_transactions (
      id, student_id, amount, source, source_id, multiplier, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    transaction.id,
    studentId,
    transaction.amount,
    transaction.source,
    transaction.source_id,
    transaction.multiplier,
    transaction.notes,
    transaction.created_at
  );

  // Update total XP on character
  db.prepare(`
    UPDATE hyro_characters
    SET total_xp = total_xp + ?, updated_at = ?
    WHERE student_id = ?
  `).run(amount, now, studentId);

  return transaction;
}

/**
 * Check and award pattern recognition achievements
 */
export function checkPatternAchievements(studentId: string): string[] {
  const db = getDatabase();
  const prState = getPatternRecognitionState(studentId);
  const chunks = getStudentChunks(studentId);
  const awarded: string[] = [];

  // Define pattern recognition achievements
  const achievements = [
    {
      id: 'pr_first_pattern',
      name: 'Pattern Spotter',
      condition: () => chunks.length >= 1,
      xp: 50,
    },
    {
      id: 'pr_pattern_collector',
      name: 'Pattern Collector',
      condition: () => chunks.length >= 10,
      xp: 150,
    },
    {
      id: 'pr_cross_domain_thinker',
      name: 'Cross-Domain Thinker',
      condition: () => {
        const domains = new Set(chunks.map(c => c.domain));
        return domains.size >= 5;
      },
      xp: 200,
    },
    {
      id: 'pr_analogy_master',
      name: 'Analogy Master',
      condition: () => prState.analogicalReasoning.analogiesCompleted >= 50,
      xp: 250,
    },
    {
      id: 'pr_intersection_innovator',
      name: 'Intersection Innovator',
      condition: () => prState.intersectionThinking.uniqueIntersectionsFound >= 10,
      xp: 300,
    },
  ];

  // Check each achievement
  for (const achievement of achievements) {
    // Check if already earned
    const existing = db.prepare(`
      SELECT 1 FROM hyro_student_achievements
      WHERE student_id = ? AND achievement_id = ?
    `).get(studentId, achievement.id);

    if (!existing && achievement.condition()) {
      // Award achievement
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT INTO hyro_student_achievements (
          id, student_id, achievement_id, earned_at
        ) VALUES (?, ?, ?, ?)
      `).run(randomUUID(), studentId, achievement.id, now);

      // Award bonus XP
      awardPatternXP(studentId, 'milestone_reached', achievement.xp / PR_XP_REWARDS.milestone_reached, achievement.name);

      awarded.push(achievement.name);
    }
  }

  return awarded;
}

// =============================================================================
// META-DIMENSION INTEGRATION
// =============================================================================

/**
 * Apply pattern recognition activity to meta-dimensions
 */
export function applyPRToMetaDimensions(
  studentId: string,
  activityType: string,
  performance: number, // 0-100
  duration_minutes: number
): void {
  // Import dynamically to avoid circular dependency
  const { updateMetaDimension } = require('./forge-meta-dimensions');

  // Scale contributions by session duration (cap at 60 minutes)
  const durationScalar = Math.min(duration_minutes / 60, 1);
  const performanceScalar = performance / 100;

  for (const [dimension, maxBoost] of Object.entries(PR_META_CONTRIBUTIONS)) {
    const scaledBoost = maxBoost * durationScalar * performanceScalar * 0.3;
    if (scaledBoost > 0.001) {
      updateMetaDimension(
        studentId,
        dimension as MetaDimensionName,
        scaledBoost,
        `pr_${activityType}`
      );
    }
  }
}

// =============================================================================
// C/E/G MANIFOLD INTEGRATION
// =============================================================================

/**
 * Calculate trajectory effect for pattern recognition activity
 */
export function calculatePRTrajectoryEffect(
  activityType: keyof typeof PR_TRAJECTORY_EFFECTS,
  success: boolean,
  difficulty: number // -3 to +3
): TrajectoryEffect {
  const baseEffect = PR_TRAJECTORY_EFFECTS[activityType] ??
    (success ? PR_TRAJECTORY_EFFECTS.pattern_recognition_success : PR_TRAJECTORY_EFFECTS.pattern_recognition_failure);

  // Scale by difficulty
  const difficultyMultiplier = 1 + (difficulty * 0.15); // -3 = 0.55x, +3 = 1.45x

  return {
    delta_C: baseEffect.delta_C * difficultyMultiplier,
    delta_E: baseEffect.delta_E * (success ? 1 : 1.2), // More entropy on failure
    delta_G: baseEffect.delta_G * difficultyMultiplier,
    confidence: baseEffect.confidence * (success ? 1 : 0.8),
  };
}

/**
 * Apply trajectory effect to learner state
 */
export function applyPRTrajectoryEffect(
  studentId: string,
  effect: TrajectoryEffect
): void {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Get current C/E/G values
  const current = db.prepare(`
    SELECT coherence, entropy, generativity
    FROM hyro_state_vectors
    WHERE student_id = ? AND stat_name != 'pattern_recognition' AND stat_name != 'cognitive_chunk'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(studentId) as { coherence: number; entropy: number; generativity: number } | undefined;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const newC = clamp((current?.coherence ?? 50) + effect.delta_C);
  const newE = clamp((current?.entropy ?? 50) + effect.delta_E);
  const newG = clamp((current?.generativity ?? 50) + effect.delta_G);

  // Record new state vector
  db.prepare(`
    INSERT INTO hyro_state_vectors (
      id, student_id, stat_name, coherence, entropy, generativity,
      components_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    studentId,
    'pr_trajectory',
    newC,
    newE,
    newG,
    JSON.stringify({ source: 'pattern_recognition', effect }),
    now,
    now
  );
}

// =============================================================================
// EVENT RECORDING
// =============================================================================

/**
 * Record a pattern recognition event
 */
export function recordPREvent<T>(
  studentId: string,
  eventType: PREvent<T>['eventType'],
  data: T
): PREvent<T> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Get current manifold state
  const manifold = db.prepare(`
    SELECT coherence, entropy, generativity
    FROM hyro_state_vectors
    WHERE student_id = ? AND stat_name NOT IN ('pattern_recognition', 'cognitive_chunk', 'meta_event')
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(studentId) as { coherence: number; entropy: number; generativity: number } | undefined;

  const prState = getPatternRecognitionState(studentId);

  const event: PREvent<T> = {
    timestamp: new Date(),
    eventType,
    learnerId: studentId,
    data,
    manifoldSnapshot: {
      c: manifold?.coherence ?? 50,
      e: manifold?.entropy ?? 50,
      g: manifold?.generativity ?? 50,
      pr: prState.overallScore,
    },
  };

  // Store event
  db.prepare(`
    INSERT INTO hyro_state_vectors (
      id, student_id, stat_name, coherence, entropy, generativity,
      components_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    studentId,
    'pr_event',
    event.manifoldSnapshot.c,
    event.manifoldSnapshot.e,
    event.manifoldSnapshot.g,
    JSON.stringify(event),
    now,
    now
  );

  return event;
}

// =============================================================================
// MAIN ORCHESTRATION FUNCTIONS
// =============================================================================

/**
 * Process a pattern recognition exercise completion
 */
export async function processPatternExercise(
  studentId: string,
  exerciseId: string,
  patternId: string,
  domain: KnowledgeDomain,
  success: boolean,
  difficulty: number,
  timeSpentSeconds: number
): Promise<{
  xpAwarded: number;
  trajectoryEffect: TrajectoryEffect;
  achievementsUnlocked: string[];
  chunkUpdated: CognitiveChunk;
}> {
  // 1. Record/update cognitive chunk
  const chunk = recordChunk(studentId, patternId, domain, [exerciseId]);

  // 2. Calculate and apply trajectory effect
  const effect = calculatePRTrajectoryEffect(
    success ? 'pattern_recognition_success' : 'pattern_recognition_failure',
    success,
    difficulty
  );
  applyPRTrajectoryEffect(studentId, effect);

  // 3. Award XP
  const xpType = success ? 'pattern_recognized' : 'pattern_introduced';
  const xpMultiplier = success ? 1 + (difficulty * 0.1) : 0.5;
  const xpTx = awardPatternXP(studentId, xpType, xpMultiplier);

  // 4. Apply to meta-dimensions
  applyPRToMetaDimensions(studentId, 'exercise', success ? 80 : 40, timeSpentSeconds / 60);

  // 5. Update PR state
  const currentState = getPatternRecognitionState(studentId);
  updatePatternRecognitionState(studentId, {
    patternLibrary: {
      ...currentState.patternLibrary,
      score: Math.min(100, currentState.patternLibrary.score + (success ? 2 : 0.5)),
      chunksActive: getStudentChunks(studentId).length,
    },
  }, 'exercise_completed');

  // 6. Record event
  recordPREvent(studentId, success ? 'pattern_practiced' : 'pattern_introduced', {
    exerciseId,
    patternId,
    success,
    difficulty,
  });

  // 7. Check achievements
  const achievements = checkPatternAchievements(studentId);

  return {
    xpAwarded: xpTx.amount,
    trajectoryEffect: effect,
    achievementsUnlocked: achievements,
    chunkUpdated: chunk,
  };
}

/**
 * Process a cross-domain transfer attempt
 */
export async function processTransferAttempt(
  studentId: string,
  chunkId: string,
  sourceDomain: KnowledgeDomain,
  targetDomain: KnowledgeDomain,
  success: boolean,
  difficulty: number
): Promise<{
  xpAwarded: number;
  trajectoryEffect: TrajectoryEffect;
  achievementsUnlocked: string[];
  transferRate: number;
}> {
  // 1. Record transfer on chunk
  const chunk = recordChunkTransfer(studentId, chunkId, targetDomain, success);

  // 2. Calculate trajectory effect
  const effect = calculatePRTrajectoryEffect(
    success ? 'transfer_success' : 'transfer_failure',
    success,
    difficulty
  );
  applyPRTrajectoryEffect(studentId, effect);

  // 3. Award XP
  const xpTx = awardPatternXP(
    studentId,
    'pattern_transferred',
    success ? 1 + (difficulty * 0.2) : 0.3
  );

  // 4. Apply to meta-dimensions
  applyPRToMetaDimensions(studentId, 'transfer', success ? 90 : 50, 30);

  // 5. Update PR state
  const currentState = getPatternRecognitionState(studentId);
  const newAttempted = currentState.crossDomainTransfer.attemptedTransfers + 1;
  const newSuccessful = currentState.crossDomainTransfer.successfulTransfers + (success ? 1 : 0);

  updatePatternRecognitionState(studentId, {
    crossDomainTransfer: {
      ...currentState.crossDomainTransfer,
      score: Math.min(100, currentState.crossDomainTransfer.score + (success ? 5 : 1)),
      attemptedTransfers: newAttempted,
      successfulTransfers: newSuccessful,
      transferRate: newSuccessful / newAttempted,
    },
  }, 'transfer_attempt');

  // 6. Record event
  recordPREvent(studentId, 'transfer_attempted', {
    chunkId,
    sourceDomain,
    targetDomain,
    success,
    difficulty,
  });

  // 7. Check achievements
  const achievements = checkPatternAchievements(studentId);

  return {
    xpAwarded: xpTx.amount,
    trajectoryEffect: effect,
    achievementsUnlocked: achievements,
    transferRate: newSuccessful / newAttempted,
  };
}

/**
 * Process an intersection exploration session
 */
export async function processIntersectionExploration(
  studentId: string,
  field1: KnowledgeDomain,
  field2: KnowledgeDomain,
  ideasGenerated: number,
  averageNovelty: number,
  averageFeasibility: number,
  durationMinutes: number
): Promise<{
  xpAwarded: number;
  trajectoryEffect: TrajectoryEffect;
  achievementsUnlocked: string[];
}> {
  // 1. Calculate trajectory effect
  const effect = PR_TRAJECTORY_EFFECTS.intersection_insight;
  const scaledEffect: TrajectoryEffect = {
    delta_C: effect.delta_C * (averageFeasibility / 100),
    delta_E: effect.delta_E * (averageNovelty / 100),
    delta_G: effect.delta_G * (ideasGenerated / 5), // Scale by ideas
    confidence: effect.confidence,
  };
  applyPRTrajectoryEffect(studentId, scaledEffect);

  // 2. Award XP
  const xpMultiplier = (averageNovelty + averageFeasibility) / 200 * (ideasGenerated / 3);
  const xpTx = awardPatternXP(studentId, 'intersection_explored', Math.max(0.5, xpMultiplier));

  // 3. Apply to meta-dimensions
  applyPRToMetaDimensions(studentId, 'intersection', (averageNovelty + averageFeasibility) / 2, durationMinutes);

  // 4. Update PR state
  const currentState = getPatternRecognitionState(studentId);
  updatePatternRecognitionState(studentId, {
    intersectionThinking: {
      ...currentState.intersectionThinking,
      score: Math.min(100, currentState.intersectionThinking.score + 3),
      explorationsSessions: currentState.intersectionThinking.explorationsSessions + 1,
      uniqueIntersectionsFound: currentState.intersectionThinking.uniqueIntersectionsFound + ideasGenerated,
      noveltyScoreAverage: (currentState.intersectionThinking.noveltyScoreAverage + averageNovelty) / 2,
      feasibilityScoreAverage: (currentState.intersectionThinking.feasibilityScoreAverage + averageFeasibility) / 2,
    },
  }, 'intersection_explored');

  // 5. Record event
  recordPREvent(studentId, 'intersection_explored', {
    field1,
    field2,
    ideasGenerated,
    averageNovelty,
    averageFeasibility,
  });

  // 6. Check achievements
  const achievements = checkPatternAchievements(studentId);

  return {
    xpAwarded: xpTx.amount,
    trajectoryEffect: scaledEffect,
    achievementsUnlocked: achievements,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // State management
  getPatternRecognitionState,
  updatePatternRecognitionState,

  // Chunk management
  getStudentChunks,
  recordChunk,
  recordChunkTransfer,

  // XP & Achievements
  awardPatternXP,
  checkPatternAchievements,

  // Meta-dimension integration
  applyPRToMetaDimensions,

  // Manifold integration
  calculatePRTrajectoryEffect,
  applyPRTrajectoryEffect,

  // Event recording
  recordPREvent,

  // Main orchestration
  processPatternExercise,
  processTransferAttempt,
  processIntersectionExploration,

  // Constants
  PR_XP_REWARDS,
  PR_META_CONTRIBUTIONS,
  PR_TRAJECTORY_EFFECTS,
};
