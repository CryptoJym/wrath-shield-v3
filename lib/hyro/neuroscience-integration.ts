/**
 * Neuroscience Integration - Hyro Education System
 *
 * @hyro-domain brain_based_learning
 * @hyro-standards NS-*
 * @hyro-manifold Connects neuroscience learning to C/E/G, meta-dimensions, and XP
 * @hyro-rationale Bridges neuroscience curriculum with existing Hyro infrastructure
 *
 * PURPOSE:
 * Integrates the neuroscience curriculum with the existing Hyro system,
 * providing functions to:
 * - Award XP for neuroscience learning activities
 * - Update meta-dimensions based on brain-based skill development
 * - Apply C/E/G trajectory effects for neuroscience exercises
 * - Track neuroscience-specific learner state
 */

import { createClient } from '@/lib/supabase/client';
import type {
  NSStandardId,
  NeuroscienceDimension,
  EmotionalState,
  ArousalLevel,
  LearningMode,
  BrainSystem,
  MetacognitiveSkill,
  AttentionProfile,
  WorkingMemoryProfile,
  RewardSensitivityProfile,
  MotivationState,
  MetacognitiveProfile,
  AmygdalaHijackProfile,
} from './neuroscience-types';
import type { TrajectoryEffect, MetaDimensionName } from './forge-learner-state';
import type { XPSource } from './forge-types';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * XP rewards for neuroscience learning activities
 */
export const NS_XP_REWARDS: Record<string, number> = {
  // Standard completion
  standard_introduced: 20,
  standard_developing: 40,
  standard_proficient: 75,
  standard_mastered: 100,

  // Exercise completion
  exercise_attempted: 15,
  exercise_completed: 35,
  exercise_mastered: 60,

  // Self-experiments
  self_experiment_started: 25,
  self_experiment_completed: 100,
  self_experiment_insight: 50,

  // Daily practices
  daily_reflection: 10,
  metacognitive_check: 15,
  emotion_regulation_practice: 20,
  attention_optimization: 15,

  // Streaks
  daily_streak_7: 75,
  daily_streak_30: 200,
  daily_streak_90: 500,

  // Special achievements
  principle_connected: 30,        // Connected principle to own experience
  strategy_adopted: 50,           // Adopted new learning strategy
  breakthrough_insight: 100,      // Major metacognitive breakthrough
  helped_peer: 40,                // Helped another learner
};

/**
 * C/E/G trajectory effects for neuroscience activities
 */
export const NS_TRAJECTORY_EFFECTS: Record<string, TrajectoryEffect> = {
  // Exercise outcomes
  metacognitive_insight: {
    delta_C: 12,   // Strong coherence gain - understanding self
    delta_E: 5,    // Some entropy - new awareness can destabilize
    delta_G: 15,   // High generativity - applies broadly
    confidence: 0.85,
  },
  emotion_regulation_success: {
    delta_C: 10,
    delta_E: -15,  // Major entropy reduction - calming effect
    delta_G: 8,
    confidence: 0.8,
  },
  attention_optimization: {
    delta_C: 8,
    delta_E: -10,  // Reduced entropy through focus
    delta_G: 5,
    confidence: 0.75,
  },
  memory_strategy_applied: {
    delta_C: 15,   // High coherence - organized knowledge
    delta_E: -8,
    delta_G: 10,
    confidence: 0.8,
  },
  self_experiment_completed: {
    delta_C: 10,
    delta_E: 8,    // Some productive entropy from discovery
    delta_G: 20,   // High generativity - self-knowledge
    confidence: 0.7,
  },
  growth_mindset_reinforced: {
    delta_C: 8,
    delta_E: 5,    // Openness to challenge
    delta_G: 18,   // Strong generativity
    confidence: 0.85,
  },
  neuroplasticity_experienced: {
    delta_C: 12,
    delta_E: 3,
    delta_G: 22,   // Very high generativity - transformative belief
    confidence: 0.8,
  },

  // Negative/neutral outcomes
  amygdala_hijack_occurred: {
    delta_C: -5,
    delta_E: 20,   // High entropy during hijack
    delta_G: -3,
    confidence: 0.9,
  },
  hijack_recovery: {
    delta_C: 5,
    delta_E: -12,  // Recovery reduces entropy
    delta_G: 10,   // Learning from recovery
    confidence: 0.75,
  },
  illusion_of_learning_caught: {
    delta_C: 8,    // Insight into own processes
    delta_E: 5,    // Temporary uncertainty
    delta_G: 12,   // Better future learning
    confidence: 0.8,
  },
};

/**
 * Mapping from neuroscience categories to meta-dimensions
 */
export const NS_TO_META_DIMENSION: Record<string, MetaDimensionName[]> = {
  memory: ['multi_model_coherence', 'gradient_awareness'],
  attention: ['manifold_fluidity', 'entropy_intuition'],
  emotion: ['identity_elasticity', 'non_dual_resolution', 'entropy_intuition'],
  motivation: ['gradient_awareness', 'cooperative_generativity'],
  metacognition: ['identity_elasticity', 'manifold_fluidity', 'non_dual_resolution'],
  plasticity: ['identity_elasticity', 'gradient_awareness', 'cooperative_generativity'],
};

/**
 * Neuroscience state dimension key for storage
 */
export const NS_DIMENSION_KEY = 'neuroscience';

// =============================================================================
// XP INTEGRATION
// =============================================================================

/**
 * Awards XP for a neuroscience learning activity
 */
export async function awardNeuroscienceXP(
  studentId: string,
  activityType: keyof typeof NS_XP_REWARDS,
  metadata?: Record<string, unknown>
): Promise<{ xpAwarded: number; newTotal: number }> {
  const supabase = createClient();
  const xpAmount = NS_XP_REWARDS[activityType] || 0;

  if (xpAmount === 0) {
    console.warn(`Unknown neuroscience activity type: ${activityType}`);
    return { xpAwarded: 0, newTotal: 0 };
  }

  // Record XP transaction
  const { error: txError } = await supabase
    .from('hyro_xp_transactions')
    .insert({
      student_id: studentId,
      xp_amount: xpAmount,
      source: 'neuroscience' as XPSource,
      source_id: activityType,
      metadata: {
        ...metadata,
        activity_type: activityType,
        timestamp: new Date().toISOString(),
      },
    });

  if (txError) {
    console.error('Error recording neuroscience XP:', txError);
    throw txError;
  }

  // Get updated total
  const { data: stats } = await supabase
    .from('hyro_learner_stats')
    .select('total_xp')
    .eq('student_id', studentId)
    .single();

  return {
    xpAwarded: xpAmount,
    newTotal: stats?.total_xp || xpAmount,
  };
}

// =============================================================================
// TRAJECTORY EFFECTS
// =============================================================================

/**
 * Applies a C/E/G trajectory effect from a neuroscience activity
 */
export async function applyNSTrajectoryEffect(
  studentId: string,
  effectType: keyof typeof NS_TRAJECTORY_EFFECTS,
  context?: string
): Promise<{ effect: TrajectoryEffect; newState: { C: number; E: number; G: number } }> {
  const supabase = createClient();
  const effect = NS_TRAJECTORY_EFFECTS[effectType];

  if (!effect) {
    console.warn(`Unknown NS trajectory effect: ${effectType}`);
    return {
      effect: { delta_C: 0, delta_E: 0, delta_G: 0, confidence: 0 },
      newState: { C: 50, E: 50, G: 50 },
    };
  }

  // Get current state
  const { data: currentState } = await supabase
    .from('hyro_learner_states')
    .select('coherence, entropy, generativity')
    .eq('student_id', studentId)
    .single();

  const current = currentState || { coherence: 50, entropy: 50, generativity: 50 };

  // Apply effect with bounds
  const newState = {
    C: Math.max(0, Math.min(100, current.coherence + effect.delta_C)),
    E: Math.max(0, Math.min(100, current.entropy + effect.delta_E)),
    G: Math.max(0, Math.min(100, current.generativity + effect.delta_G)),
  };

  // Update state
  const { error } = await supabase
    .from('hyro_learner_states')
    .upsert({
      student_id: studentId,
      coherence: newState.C,
      entropy: newState.E,
      generativity: newState.G,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error updating CEG state:', error);
    throw error;
  }

  // Record trajectory event
  await supabase.from('hyro_trajectory_events').insert({
    student_id: studentId,
    event_type: effectType,
    delta_c: effect.delta_C,
    delta_e: effect.delta_E,
    delta_g: effect.delta_G,
    confidence: effect.confidence,
    context: context || `neuroscience:${effectType}`,
    timestamp: new Date().toISOString(),
  });

  return { effect, newState };
}

// =============================================================================
// META-DIMENSION UPDATES
// =============================================================================

/**
 * Updates meta-dimensions based on neuroscience skill development
 */
export async function updateNSMetaDimensions(
  studentId: string,
  category: 'memory' | 'attention' | 'emotion' | 'motivation' | 'metacognition' | 'plasticity',
  skillLevel: number,  // 0-100
  evidenceStrength: number = 0.7
): Promise<void> {
  const supabase = createClient();
  const affectedDimensions = NS_TO_META_DIMENSION[category] || [];

  // Calculate update amount based on skill level and evidence
  const updateAmount = (skillLevel / 100) * evidenceStrength * 10;

  for (const dimensionName of affectedDimensions) {
    // Record the observation
    await supabase.from('hyro_meta_dimension_estimates').insert({
      student_id: studentId,
      dimension_name: dimensionName,
      estimate_value: skillLevel,
      confidence: evidenceStrength,
      source: `neuroscience:${category}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Update the state vector
  const { data: currentVector } = await supabase
    .from('hyro_state_vectors')
    .select('dimension_values')
    .eq('student_id', studentId)
    .eq('vector_type', 'meta_dimensions')
    .single();

  const dimensionValues = currentVector?.dimension_values || {};

  for (const dim of affectedDimensions) {
    const current = dimensionValues[dim] || 50;
    dimensionValues[dim] = Math.max(0, Math.min(100,
      current + (updateAmount * (1 - current / 100))  // Diminishing returns
    ));
  }

  await supabase.from('hyro_state_vectors').upsert({
    student_id: studentId,
    vector_type: 'meta_dimensions',
    dimension_values: dimensionValues,
    updated_at: new Date().toISOString(),
  });
}

// =============================================================================
// NEUROSCIENCE DIMENSION STATE
// =============================================================================

/**
 * Gets the neuroscience dimension state for a student
 */
export async function getNeuroscienceDimension(
  studentId: string
): Promise<NeuroscienceDimension> {
  const supabase = createClient();

  const { data } = await supabase
    .from('hyro_state_vectors')
    .select('dimension_values')
    .eq('student_id', studentId)
    .eq('vector_type', NS_DIMENSION_KEY)
    .single();

  if (!data?.dimension_values) {
    return createDefaultNeuroscienceDimension();
  }

  return data.dimension_values as NeuroscienceDimension;
}

/**
 * Updates the neuroscience dimension state
 */
export async function updateNeuroscienceDimension(
  studentId: string,
  updates: Partial<NeuroscienceDimension>
): Promise<NeuroscienceDimension> {
  const supabase = createClient();

  // Get current state
  const current = await getNeuroscienceDimension(studentId);

  // Deep merge updates
  const updated = deepMerge(current, updates) as NeuroscienceDimension;

  // Recalculate overall score
  updated.overallScore = calculateNSOverallScore(updated);

  // Save
  await supabase.from('hyro_state_vectors').upsert({
    student_id: studentId,
    vector_type: NS_DIMENSION_KEY,
    dimension_values: updated,
    updated_at: new Date().toISOString(),
  });

  return updated;
}

/**
 * Creates default neuroscience dimension state
 */
function createDefaultNeuroscienceDimension(): NeuroscienceDimension {
  return {
    overallScore: 50,
    memoryOptimization: {
      score: 50,
      spacedPracticeAdherence: 50,
      retrievalPracticeUse: 50,
      interleavingApplication: 50,
      sleepConsistency: 50,
    },
    attentionManagement: {
      score: 50,
      sustainedFocusDuration: 25,
      distractionResistance: 50,
      modeFlexibility: 50,
      breakEffectiveness: 50,
    },
    emotionalRegulation: {
      score: 50,
      arousalOptimization: 50,
      stressManagement: 50,
      recoverySpeed: 50,
      emotionalAwareness: 50,
    },
    motivationSustainability: {
      score: 50,
      intrinsicDrive: 50,
      delayTolerance: 50,
      goalPersistence: 50,
      burnoutResistance: 50,
    },
    metacognitiveAccuracy: {
      score: 50,
      confidenceCalibration: 50,
      strategySelection: 50,
      progressMonitoring: 50,
      illusionResistance: 50,
    },
    plasticityEngagement: {
      score: 50,
      challengeSeeking: 50,
      effortInvestment: 50,
      growthMindsetStrength: 50,
      feedbackUtilization: 50,
    },
  };
}

/**
 * Calculates overall neuroscience score from subscores
 */
function calculateNSOverallScore(dimension: NeuroscienceDimension): number {
  const weights = {
    memoryOptimization: 0.20,
    attentionManagement: 0.18,
    emotionalRegulation: 0.18,
    motivationSustainability: 0.15,
    metacognitiveAccuracy: 0.17,
    plasticityEngagement: 0.12,
  };

  return Math.round(
    dimension.memoryOptimization.score * weights.memoryOptimization +
    dimension.attentionManagement.score * weights.attentionManagement +
    dimension.emotionalRegulation.score * weights.emotionalRegulation +
    dimension.motivationSustainability.score * weights.motivationSustainability +
    dimension.metacognitiveAccuracy.score * weights.metacognitiveAccuracy +
    dimension.plasticityEngagement.score * weights.plasticityEngagement
  );
}

// =============================================================================
// PROFILE MANAGEMENT
// =============================================================================

/**
 * Gets or creates an attention profile for a student
 */
export async function getAttentionProfile(
  studentId: string
): Promise<AttentionProfile | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('hyro_learner_profiles')
    .select('profile_data')
    .eq('student_id', studentId)
    .eq('profile_type', 'attention')
    .single();

  return data?.profile_data as AttentionProfile | null;
}

/**
 * Updates attention profile
 */
export async function updateAttentionProfile(
  studentId: string,
  profile: Partial<AttentionProfile>
): Promise<void> {
  const supabase = createClient();

  const current = await getAttentionProfile(studentId);
  const updated = { ...current, ...profile, studentId, assessedAt: new Date() };

  await supabase.from('hyro_learner_profiles').upsert({
    student_id: studentId,
    profile_type: 'attention',
    profile_data: updated,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Gets metacognitive profile
 */
export async function getMetacognitiveProfile(
  studentId: string
): Promise<MetacognitiveProfile | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('hyro_learner_profiles')
    .select('profile_data')
    .eq('student_id', studentId)
    .eq('profile_type', 'metacognition')
    .single();

  return data?.profile_data as MetacognitiveProfile | null;
}

/**
 * Updates metacognitive profile
 */
export async function updateMetacognitiveProfile(
  studentId: string,
  updates: Partial<MetacognitiveProfile>
): Promise<void> {
  const supabase = createClient();

  const current = await getMetacognitiveProfile(studentId);
  const updated = deepMerge(current || {}, updates) as MetacognitiveProfile;
  updated.studentId = studentId;
  updated.assessedAt = new Date();

  await supabase.from('hyro_learner_profiles').upsert({
    student_id: studentId,
    profile_type: 'metacognition',
    profile_data: updated,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Gets amygdala hijack profile
 */
export async function getAmygdalaProfile(
  studentId: string
): Promise<AmygdalaHijackProfile | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('hyro_learner_profiles')
    .select('profile_data')
    .eq('student_id', studentId)
    .eq('profile_type', 'amygdala_hijack')
    .single();

  return data?.profile_data as AmygdalaHijackProfile | null;
}

/**
 * Records an amygdala hijack event and triggers recovery protocol
 */
export async function recordAmygdalaHijack(
  studentId: string,
  trigger: string,
  category: 'academic' | 'social' | 'time_pressure' | 'failure' | 'comparison',
  intensity: number
): Promise<{
  recoveryStrategies: string[];
  trajectoryEffect: TrajectoryEffect;
}> {
  const supabase = createClient();

  // Update profile
  const profile = await getAmygdalaProfile(studentId) || {
    studentId,
    knownTriggers: [],
    physicalSigns: [],
    cognitiveSign: [],
    behavioralSigns: [],
    effectiveStrategies: [],
    typicalRecoveryMinutes: 15,
    lastOccurrence: null,
  };

  // Add or update trigger
  const existingTrigger = profile.knownTriggers.find(t => t.trigger === trigger);
  if (existingTrigger) {
    existingTrigger.intensity = Math.max(existingTrigger.intensity, intensity);
    existingTrigger.frequency = existingTrigger.frequency === 'rare' ? 'occasional' :
                                existingTrigger.frequency === 'occasional' ? 'frequent' : 'frequent';
  } else {
    profile.knownTriggers.push({
      trigger,
      category,
      intensity,
      frequency: 'rare',
    });
  }

  profile.lastOccurrence = new Date();

  await supabase.from('hyro_learner_profiles').upsert({
    student_id: studentId,
    profile_type: 'amygdala_hijack',
    profile_data: profile,
    updated_at: new Date().toISOString(),
  });

  // Apply trajectory effect
  const { effect } = await applyNSTrajectoryEffect(
    studentId,
    'amygdala_hijack_occurred',
    `trigger:${trigger}`
  );

  // Return recovery strategies based on effectiveness
  const effectiveStrategies = profile.effectiveStrategies
    .sort((a, b) => b.effectivenessForStudent - a.effectivenessForStudent)
    .slice(0, 3)
    .map(s => s.strategyId);

  // Default strategies if none recorded yet
  const recoveryStrategies = effectiveStrategies.length > 0
    ? effectiveStrategies
    : ['strategy-box-breathing', 'strategy-grounding-5-4-3-2-1', 'strategy-self-distancing'];

  return {
    recoveryStrategies,
    trajectoryEffect: effect,
  };
}

/**
 * Records successful recovery from amygdala hijack
 */
export async function recordHijackRecovery(
  studentId: string,
  strategyUsed: string,
  recoveryTimeMinutes: number,
  effectivenessRating: number
): Promise<void> {
  const supabase = createClient();

  // Update profile with strategy effectiveness
  const profile = await getAmygdalaProfile(studentId);
  if (profile) {
    const existingStrategy = profile.effectiveStrategies.find(
      s => s.strategyId === strategyUsed
    );

    if (existingStrategy) {
      // Running average of effectiveness
      existingStrategy.effectivenessForStudent =
        (existingStrategy.effectivenessForStudent + effectivenessRating) / 2;
    } else {
      profile.effectiveStrategies.push({
        strategyId: strategyUsed,
        effectivenessForStudent: effectivenessRating,
        notes: '',
      });
    }

    // Update typical recovery time (running average)
    profile.typicalRecoveryMinutes =
      (profile.typicalRecoveryMinutes + recoveryTimeMinutes) / 2;

    await supabase.from('hyro_learner_profiles').upsert({
      student_id: studentId,
      profile_type: 'amygdala_hijack',
      profile_data: profile,
      updated_at: new Date().toISOString(),
    });
  }

  // Apply positive trajectory effect for recovery
  await applyNSTrajectoryEffect(studentId, 'hijack_recovery', `strategy:${strategyUsed}`);

  // Award XP for emotion regulation practice
  await awardNeuroscienceXP(studentId, 'emotion_regulation_practice', {
    strategy: strategyUsed,
    recoveryTime: recoveryTimeMinutes,
    effectiveness: effectivenessRating,
  });
}

// =============================================================================
// EXERCISE PROCESSING
// =============================================================================

/**
 * Processes completion of a neuroscience exercise
 */
export async function processNSExercise(
  studentId: string,
  exerciseId: string,
  standardId: NSStandardId,
  success: boolean,
  rubricLevel: number,
  timeSpentMinutes: number,
  insights?: string[]
): Promise<{
  xpAwarded: number;
  trajectoryEffect: TrajectoryEffect;
  dimensionUpdates: Partial<NeuroscienceDimension>;
}> {
  // Determine XP based on rubric level
  const xpType = rubricLevel >= 4 ? 'exercise_mastered' :
                 rubricLevel >= 3 ? 'exercise_completed' : 'exercise_attempted';

  const { xpAwarded } = await awardNeuroscienceXP(studentId, xpType, {
    exerciseId,
    standardId,
    rubricLevel,
    timeSpent: timeSpentMinutes,
  });

  // Determine appropriate trajectory effect
  const category = standardId.split('-')[1].toLowerCase() as
    'mem' | 'att' | 'emo' | 'mot' | 'meta' | 'plast';

  const effectMap: Record<string, keyof typeof NS_TRAJECTORY_EFFECTS> = {
    mem: 'memory_strategy_applied',
    att: 'attention_optimization',
    emo: 'emotion_regulation_success',
    mot: 'growth_mindset_reinforced',
    meta: 'metacognitive_insight',
    plast: 'neuroplasticity_experienced',
  };

  const effectType = success ? effectMap[category] || 'metacognitive_insight' : 'illusion_of_learning_caught';
  const { effect } = await applyNSTrajectoryEffect(studentId, effectType, `exercise:${exerciseId}`);

  // Update neuroscience dimension
  const fullCategory = {
    mem: 'memory',
    att: 'attention',
    emo: 'emotion',
    mot: 'motivation',
    meta: 'metacognition',
    plast: 'plasticity',
  }[category] as 'memory' | 'attention' | 'emotion' | 'motivation' | 'metacognition' | 'plasticity';

  await updateNSMetaDimensions(studentId, fullCategory, rubricLevel * 25, 0.7);

  // Build dimension updates based on exercise type
  const dimensionUpdates = buildDimensionUpdates(fullCategory, rubricLevel, success);

  await updateNeuroscienceDimension(studentId, dimensionUpdates);

  // Award bonus XP for insights
  if (insights && insights.length > 0) {
    await awardNeuroscienceXP(studentId, 'principle_connected', {
      insights: insights.length,
    });
  }

  return {
    xpAwarded,
    trajectoryEffect: effect,
    dimensionUpdates,
  };
}

/**
 * Builds dimension updates based on exercise category and performance
 */
function buildDimensionUpdates(
  category: 'memory' | 'attention' | 'emotion' | 'motivation' | 'metacognition' | 'plasticity',
  rubricLevel: number,
  success: boolean
): Partial<NeuroscienceDimension> {
  const improvement = success ? rubricLevel * 2 : 1;

  switch (category) {
    case 'memory':
      return {
        memoryOptimization: {
          score: improvement,
          spacedPracticeAdherence: improvement,
          retrievalPracticeUse: improvement,
          interleavingApplication: improvement * 0.5,
          sleepConsistency: 0,
        },
      };
    case 'attention':
      return {
        attentionManagement: {
          score: improvement,
          sustainedFocusDuration: improvement * 0.5,
          distractionResistance: improvement,
          modeFlexibility: improvement,
          breakEffectiveness: improvement * 0.5,
        },
      };
    case 'emotion':
      return {
        emotionalRegulation: {
          score: improvement,
          arousalOptimization: improvement,
          stressManagement: improvement,
          recoverySpeed: improvement * 0.5,
          emotionalAwareness: improvement,
        },
      };
    case 'motivation':
      return {
        motivationSustainability: {
          score: improvement,
          intrinsicDrive: improvement,
          delayTolerance: improvement * 0.5,
          goalPersistence: improvement,
          burnoutResistance: improvement * 0.5,
        },
      };
    case 'metacognition':
      return {
        metacognitiveAccuracy: {
          score: improvement,
          confidenceCalibration: improvement,
          strategySelection: improvement,
          progressMonitoring: improvement,
          illusionResistance: improvement,
        },
      };
    case 'plasticity':
      return {
        plasticityEngagement: {
          score: improvement,
          challengeSeeking: improvement,
          effortInvestment: improvement,
          growthMindsetStrength: improvement,
          feedbackUtilization: improvement * 0.5,
        },
      };
    default:
      return {};
  }
}

/**
 * Processes completion of a self-experiment
 */
export async function processNSSelfExperiment(
  studentId: string,
  experimentId: string,
  standardId: NSStandardId,
  completed: boolean,
  dataCollected: Record<string, unknown>,
  reflections: string[],
  insightGained: boolean
): Promise<{
  xpAwarded: number;
  totalXP: number;
  trajectoryEffect: TrajectoryEffect;
}> {
  let totalXP = 0;

  // XP for starting/completing
  if (completed) {
    const { xpAwarded } = await awardNeuroscienceXP(studentId, 'self_experiment_completed', {
      experimentId,
      standardId,
      dataPoints: Object.keys(dataCollected).length,
    });
    totalXP += xpAwarded;
  } else {
    const { xpAwarded } = await awardNeuroscienceXP(studentId, 'self_experiment_started', {
      experimentId,
      standardId,
    });
    totalXP += xpAwarded;
  }

  // Bonus XP for insight
  if (insightGained) {
    const { xpAwarded } = await awardNeuroscienceXP(studentId, 'self_experiment_insight', {
      experimentId,
      reflections: reflections.length,
    });
    totalXP += xpAwarded;
  }

  // Apply trajectory effect
  const { effect } = await applyNSTrajectoryEffect(
    studentId,
    completed ? 'self_experiment_completed' : 'metacognitive_insight',
    `experiment:${experimentId}`
  );

  // Update metacognitive dimension for self-experimentation
  const dimension = await getNeuroscienceDimension(studentId);
  await updateNeuroscienceDimension(studentId, {
    metacognitiveAccuracy: {
      ...dimension.metacognitiveAccuracy,
      score: dimension.metacognitiveAccuracy.score + (completed ? 5 : 2),
      progressMonitoring: dimension.metacognitiveAccuracy.progressMonitoring + 3,
    },
  });

  return {
    xpAwarded: totalXP,
    totalXP,
    trajectoryEffect: effect,
  };
}

// =============================================================================
// DAILY PRACTICES
// =============================================================================

/**
 * Records a daily metacognitive reflection
 */
export async function recordDailyReflection(
  studentId: string,
  reflection: {
    whatWorked: string[];
    whatDidntWork: string[];
    tomorrowFocus: string;
    emotionalState: EmotionalState;
    energyLevel: number;
  }
): Promise<{ xpAwarded: number; streak: number }> {
  const supabase = createClient();

  // Record the reflection
  await supabase.from('hyro_daily_reflections').insert({
    student_id: studentId,
    reflection_data: reflection,
    created_at: new Date().toISOString(),
  });

  // Award XP
  const { xpAwarded } = await awardNeuroscienceXP(studentId, 'daily_reflection');

  // Check and update streak
  const { data: streakData } = await supabase
    .from('hyro_streaks')
    .select('current_streak, longest_streak')
    .eq('student_id', studentId)
    .eq('streak_type', 'daily_reflection')
    .single();

  const currentStreak = (streakData?.current_streak || 0) + 1;
  const longestStreak = Math.max(currentStreak, streakData?.longest_streak || 0);

  await supabase.from('hyro_streaks').upsert({
    student_id: studentId,
    streak_type: 'daily_reflection',
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_activity: new Date().toISOString(),
  });

  // Award streak bonuses
  if (currentStreak === 7) {
    await awardNeuroscienceXP(studentId, 'daily_streak_7');
  } else if (currentStreak === 30) {
    await awardNeuroscienceXP(studentId, 'daily_streak_30');
  } else if (currentStreak === 90) {
    await awardNeuroscienceXP(studentId, 'daily_streak_90');
  }

  // Update metacognitive dimension
  const dimension = await getNeuroscienceDimension(studentId);
  await updateNeuroscienceDimension(studentId, {
    metacognitiveAccuracy: {
      ...dimension.metacognitiveAccuracy,
      progressMonitoring: Math.min(100, dimension.metacognitiveAccuracy.progressMonitoring + 1),
    },
  });

  return { xpAwarded, streak: currentStreak };
}

/**
 * Records an attention check-in during study
 */
export async function recordAttentionCheckIn(
  studentId: string,
  checkIn: {
    currentTask: string;
    focusLevel: number;          // 1-10
    distractions: string[];
    minutesSinceLastBreak: number;
    arousalLevel: ArousalLevel;
    recommendation?: 'continue' | 'take_break' | 'change_task' | 'adjust_environment';
  }
): Promise<{ xpAwarded: number; suggestion: string }> {
  const supabase = createClient();

  // Record check-in
  await supabase.from('hyro_attention_checkins').insert({
    student_id: studentId,
    checkin_data: checkIn,
    created_at: new Date().toISOString(),
  });

  // Award XP
  const { xpAwarded } = await awardNeuroscienceXP(studentId, 'metacognitive_check');

  // Generate suggestion based on check-in data
  let suggestion = '';

  if (checkIn.focusLevel < 4 && checkIn.minutesSinceLastBreak > 45) {
    suggestion = "Your focus is low and it's been a while since your last break. Consider a 5-10 minute break with some movement.";
  } else if (checkIn.arousalLevel === 'very_high' || checkIn.arousalLevel === 'high') {
    suggestion = "Your arousal seems high. Try some deep breathing (box breathing: 4-4-4-4) before continuing.";
  } else if (checkIn.arousalLevel === 'very_low' || checkIn.arousalLevel === 'low') {
    suggestion = "Energy seems low. Consider a brief walk, some stretching, or a healthy snack.";
  } else if (checkIn.distractions.length > 2) {
    suggestion = "Multiple distractions noted. Consider changing your environment or using a website blocker.";
  } else if (checkIn.focusLevel >= 7) {
    suggestion = "Great focus! You're in a good state. Continue with your current approach.";
  } else {
    suggestion = "Moderate focus. Consider what small adjustment might help boost your concentration.";
  }

  // Update attention dimension
  const dimension = await getNeuroscienceDimension(studentId);
  await updateNeuroscienceDimension(studentId, {
    attentionManagement: {
      ...dimension.attentionManagement,
      sustainedFocusDuration: checkIn.focusLevel >= 7
        ? Math.min(120, dimension.attentionManagement.sustainedFocusDuration + 1)
        : dimension.attentionManagement.sustainedFocusDuration,
    },
  });

  return { xpAwarded, suggestion };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Deep merge utility for nested objects
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
      output[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

/**
 * Gets a summary of neuroscience learning progress
 */
export async function getNeuroscienceSummary(studentId: string): Promise<{
  dimension: NeuroscienceDimension;
  standardsProgress: Record<string, number>;
  recentActivities: Array<{ type: string; date: Date; xp: number }>;
  streaks: Record<string, number>;
  recommendations: string[];
}> {
  const supabase = createClient();

  // Get dimension state
  const dimension = await getNeuroscienceDimension(studentId);

  // Get standards progress
  const { data: progress } = await supabase
    .from('hyro_standard_progress')
    .select('standard_id, mastery_level')
    .eq('student_id', studentId)
    .like('standard_id', 'NS-%');

  const standardsProgress: Record<string, number> = {};
  for (const p of progress || []) {
    standardsProgress[p.standard_id] = p.mastery_level;
  }

  // Get recent XP transactions
  const { data: transactions } = await supabase
    .from('hyro_xp_transactions')
    .select('source_id, created_at, xp_amount')
    .eq('student_id', studentId)
    .eq('source', 'neuroscience')
    .order('created_at', { ascending: false })
    .limit(10);

  const recentActivities = (transactions || []).map(t => ({
    type: t.source_id,
    date: new Date(t.created_at),
    xp: t.xp_amount,
  }));

  // Get streaks
  const { data: streakData } = await supabase
    .from('hyro_streaks')
    .select('streak_type, current_streak')
    .eq('student_id', studentId);

  const streaks: Record<string, number> = {};
  for (const s of streakData || []) {
    streaks[s.streak_type] = s.current_streak;
  }

  // Generate recommendations based on dimension scores
  const recommendations: string[] = [];

  if (dimension.memoryOptimization.retrievalPracticeUse < 60) {
    recommendations.push("Try more retrieval practice - test yourself before re-reading notes.");
  }
  if (dimension.attentionManagement.breakEffectiveness < 50) {
    recommendations.push("Experiment with different break activities - nature walks and stretching often work better than phone use.");
  }
  if (dimension.emotionalRegulation.stressManagement < 50) {
    recommendations.push("Practice emotion regulation strategies like box breathing before stressful situations.");
  }
  if (dimension.metacognitiveAccuracy.confidenceCalibration < 60) {
    recommendations.push("Track your confidence predictions vs. actual performance to improve calibration.");
  }
  if (dimension.plasticityEngagement.growthMindsetStrength < 60) {
    recommendations.push("Remember: your brain physically changes when you struggle with hard material. Difficulty means growth!");
  }

  return {
    dimension,
    standardsProgress,
    recentActivities,
    streaks,
    recommendations,
  };
}

export default {};
