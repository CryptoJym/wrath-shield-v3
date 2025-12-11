/**
 * HYRO FORGE: Standards-to-Manifold Mapping System
 *
 * Connects educational standards (Common Core, etc.) to the C/E/G Manifold geometry,
 * enabling ZPD-aware content selection that aligns with both curriculum requirements
 * and cognitive development patterns.
 *
 * Key Components:
 * - Standard → Manifold coordinate mapping
 * - Cognitive complexity profiling (DOK levels)
 * - ZPD-aware standard suggestion
 * - Prerequisite chain analysis
 * - Mastery tracking and progression
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName } from './forge-types';
import {
  Standard,
  StandardMastery,
  getStandard,
  getAllStandards,
  getStandardMastery as getStandardMasteryFromStore,
  updateStandardMastery as updateStandardMasteryInStore,
  getAllStandardMastery,
} from './education-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Maps a standard to its position in the C/E/G manifold
 */
export interface StandardManifoldMapping {
  standard_id: string;
  coherence_weight: number;      // How much this standard contributes to C (0-1)
  entropy_weight: number;        // How much this standard contributes to E (0-1)
  generativity_weight: number;   // How much this standard contributes to G (0-1)
  target_state: {
    coherence: number;    // 0-100: Target coherence for mastery
    entropy: number;      // 0-100: Target entropy tolerance needed
    generativity: number; // 0-100: Target generative capacity
  };
  dok_level: DOKLevel;             // Depth of Knowledge classification
  cognitive_complexity: number;    // 0-1 scale
}

/**
 * Enhanced StandardMastery with status tracking
 */
export interface StandardMasteryRecord {
  student_id: string;
  standard_id: string;
  mastery_level: number;         // 0-100
  evidence_count: number;
  first_exposure: number;        // Unix timestamp
  last_assessment: number;       // Unix timestamp
  status: MasteryStatus;
  confidence_score: number;      // 0-1
}

export type MasteryStatus = 'not_started' | 'introduced' | 'developing' | 'proficient' | 'mastered';

export type DOKLevel = 1 | 2 | 3 | 4;

export interface DOKProfile {
  level: DOKLevel;
  description: string;
  coherence_target: number;    // 0-100
  entropy_target: number;      // 0-100
  generativity_target: number; // 0-100
}

export interface StandardSuggestion {
  standard_id: string;
  standard: Standard;
  readiness_score: number;       // 0-1
  manifold_fit_score: number;    // 0-1
  combined_score: number;        // 0-1
  reasoning: string;
  prerequisites_met: boolean;
  missing_prerequisites: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Depth of Knowledge (DOK) cognitive profiles
 * Maps DOK levels to manifold target states
 */
const DOK_PROFILES: Record<DOKLevel, DOKProfile> = {
  1: {
    level: 1,
    description: 'Recall and Reproduction',
    coherence_target: 70,  // High coherence (facts must be consistent)
    entropy_target: 30,    // Low entropy (minimal ambiguity)
    generativity_target: 20, // Minimal generativity (reproduction only)
  },
  2: {
    level: 2,
    description: 'Skills and Concepts',
    coherence_target: 65,  // Balanced coherence
    entropy_target: 50,    // Moderate entropy (some problem variation)
    generativity_target: 40, // Growing generativity (application)
  },
  3: {
    level: 3,
    description: 'Strategic Thinking',
    coherence_target: 60,  // Lower coherence (multiple approaches)
    entropy_target: 70,    // Higher entropy (novel problems)
    generativity_target: 65, // Strong generativity (strategy creation)
  },
  4: {
    level: 4,
    description: 'Extended Thinking',
    coherence_target: 55,  // Flexible coherence
    entropy_target: 75,    // High entropy tolerance
    generativity_target: 80, // Maximum generativity (original work)
  },
};

/**
 * Stat-to-manifold cognitive profiles
 * Defines how each stat relates to C/E/G dimensions
 */
export const STAT_COGNITIVE_PROFILE: Record<StatName, { coherence: number; entropy: number; generativity: number }> = {
  math: { coherence: 0.7, entropy: 0.5, generativity: 0.6 },
  reading: { coherence: 0.6, entropy: 0.6, generativity: 0.5 },
  science: { coherence: 0.6, entropy: 0.7, generativity: 0.6 },
  coding: { coherence: 0.7, entropy: 0.6, generativity: 0.7 },
  study_skills: { coherence: 0.8, entropy: 0.4, generativity: 0.4 },
  critical_thinking: { coherence: 0.5, entropy: 0.7, generativity: 0.8 },
  technology: { coherence: 0.6, entropy: 0.6, generativity: 0.6 },
  problem_solving: { coherence: 0.6, entropy: 0.7, generativity: 0.7 },
};

// Thresholds for mastery status classification
const MASTERY_THRESHOLDS = {
  not_started: 0,
  introduced: 20,
  developing: 50,
  proficient: 75,
  mastered: 90,
};

// Prerequisite readiness threshold
const PREREQUISITE_MASTERY_THRESHOLD = 70;

// ZPD fit scoring weights
const ZPD_FIT_WEIGHTS = {
  coherence: 0.35,
  entropy: 0.35,
  generativity: 0.30,
};

// ============================================================================
// Manifold Mapping
// ============================================================================

/**
 * Get manifold mapping for a standard
 * Analyzes the standard and returns its C/E/G profile
 */
export function getStandardManifoldMapping(standardId: string): StandardManifoldMapping {
  const standard = getStandard(standardId);
  if (!standard) {
    throw new Error(`Standard not found: ${standardId}`);
  }

  // Infer DOK level from standard content
  const dokLevel = inferDOKLevel(standard);
  const dokProfile = DOK_PROFILES[dokLevel];

  // Calculate weights based on category and domain
  const weights = calculateCategoryWeights(standard.category, standard.domain);

  // Calculate cognitive complexity (0-1)
  const complexity = (dokLevel - 1) / 3; // Map DOK 1-4 to 0-1 scale

  return {
    standard_id: standardId,
    coherence_weight: weights.coherence,
    entropy_weight: weights.entropy,
    generativity_weight: weights.generativity,
    target_state: {
      coherence: dokProfile.coherence_target,
      entropy: dokProfile.entropy_target,
      generativity: dokProfile.generativity_target,
    },
    dok_level: dokLevel,
    cognitive_complexity: complexity,
  };
}

/**
 * Infer DOK level from standard description and metadata
 */
function inferDOKLevel(standard: Standard): DOKLevel {
  const desc = standard.description.toLowerCase();
  const cluster = (standard.cluster || '').toLowerCase();

  // DOK 4 indicators: create, design, prove, synthesize
  if (
    desc.includes('create') ||
    desc.includes('design') ||
    desc.includes('prove') ||
    desc.includes('synthesize') ||
    desc.includes('develop a model') ||
    cluster.includes('extended')
  ) {
    return 4;
  }

  // DOK 3 indicators: analyze, evaluate, investigate, explain why
  if (
    desc.includes('analyze') ||
    desc.includes('evaluate') ||
    desc.includes('investigate') ||
    desc.includes('explain why') ||
    desc.includes('justify') ||
    desc.includes('construct') ||
    cluster.includes('strategic')
  ) {
    return 3;
  }

  // DOK 2 indicators: apply, solve, explain how, compare
  if (
    desc.includes('apply') ||
    desc.includes('solve') ||
    desc.includes('explain how') ||
    desc.includes('compare') ||
    desc.includes('classify') ||
    desc.includes('organize') ||
    cluster.includes('skill')
  ) {
    return 2;
  }

  // DOK 1 (default): recall, identify, define, list
  return 1;
}

/**
 * Calculate C/E/G weights based on subject category and domain
 */
function calculateCategoryWeights(
  category: string,
  domain: string
): { coherence: number; entropy: number; generativity: number } {
  const cat = category.toLowerCase();
  const dom = domain.toLowerCase();

  // Math typically has higher coherence requirements
  if (cat.includes('math')) {
    // But some domains require more generativity
    if (dom.includes('modeling') || dom.includes('problem solving')) {
      return { coherence: 0.65, entropy: 0.55, generativity: 0.70 };
    }
    return { coherence: 0.75, entropy: 0.45, generativity: 0.55 };
  }

  // ELA balances all three
  if (cat.includes('ela') || cat.includes('reading') || cat.includes('writing')) {
    if (dom.includes('writing')) {
      return { coherence: 0.55, entropy: 0.60, generativity: 0.75 };
    }
    return { coherence: 0.60, entropy: 0.65, generativity: 0.60 };
  }

  // Science emphasizes entropy and generativity
  if (cat.includes('science')) {
    return { coherence: 0.60, entropy: 0.70, generativity: 0.65 };
  }

  // Default balanced profile
  return { coherence: 0.60, entropy: 0.60, generativity: 0.60 };
}

// ============================================================================
// Standard Contribution Calculation
// ============================================================================

/**
 * Calculate how much a standard at a given mastery level contributes to C/E/G state
 */
export function calculateStandardContribution(
  standardId: string,
  masteryLevel: number
): { coherence: number; entropy: number; generativity: number } {
  const mapping = getStandardManifoldMapping(standardId);

  // Contribution is proportional to mastery level and weights
  // Normalized to 0-100 scale
  const normalizedMastery = masteryLevel / 100;

  return {
    coherence: mapping.target_state.coherence * mapping.coherence_weight * normalizedMastery,
    entropy: mapping.target_state.entropy * mapping.entropy_weight * normalizedMastery,
    generativity: mapping.target_state.generativity * mapping.generativity_weight * normalizedMastery,
  };
}

// ============================================================================
// Standard Suggestion (ZPD-Aware)
// ============================================================================

/**
 * Get suggestable standards based on ZPD and current manifold state
 * Returns standards that are:
 * 1. Prerequisites met (readiness)
 * 2. Not yet mastered
 * 3. Good fit for current manifold position
 */
export function getSuggestableStandards(
  studentId: string,
  subject: 'math' | 'ela' | 'science',
  currentState: { coherence: number; entropy: number; generativity: number },
  limit: number = 10
): string[] {
  const allStandards = getAllStandards();
  const studentMastery = getAllStandardMastery(studentId);

  // Build mastery lookup
  const masteryMap = new Map<string, StandardMastery>();
  for (const m of studentMastery) {
    masteryMap.set(m.standard_id, m);
  }

  const suggestions: StandardSuggestion[] = [];

  for (const standard of allStandards) {
    // Filter by subject
    const category = standard.category.toLowerCase();
    if (subject === 'math' && !category.includes('math')) continue;
    if (subject === 'ela' && !(category.includes('ela') || category.includes('reading') || category.includes('writing'))) continue;
    if (subject === 'science' && !category.includes('science')) continue;

    // Skip if already mastered
    const mastery = masteryMap.get(standard.id);
    if (mastery && mastery.mastery_level >= MASTERY_THRESHOLDS.mastered) {
      continue;
    }

    // Check prerequisites
    const prereqCheck = checkPrerequisites(studentId, standard.id, masteryMap);

    // Calculate readiness score (0-1)
    const readinessScore = prereqCheck.met ? 1.0 : prereqCheck.partialScore;

    // Calculate manifold fit score
    const manifoldFitScore = calculateManifoldFit(standard.id, currentState);

    // Combined score (weighted average)
    const combinedScore = readinessScore * 0.6 + manifoldFitScore * 0.4;

    suggestions.push({
      standard_id: standard.id,
      standard,
      readiness_score: readinessScore,
      manifold_fit_score: manifoldFitScore,
      combined_score: combinedScore,
      reasoning: generateSuggestionReasoning(
        prereqCheck,
        manifoldFitScore,
        mastery?.mastery_level || 0
      ),
      prerequisites_met: prereqCheck.met,
      missing_prerequisites: prereqCheck.missing,
    });
  }

  // Sort by combined score (descending)
  suggestions.sort((a, b) => b.combined_score - a.combined_score);

  // Return top N standard IDs
  return suggestions.slice(0, limit).map(s => s.standard_id);
}

/**
 * Calculate how well a standard fits the current manifold state
 */
function calculateManifoldFit(
  standardId: string,
  currentState: { coherence: number; entropy: number; generativity: number }
): number {
  const mapping = getStandardManifoldMapping(standardId);
  const target = mapping.target_state;

  // Calculate normalized distance in C/E/G space
  const coherenceDiff = Math.abs(target.coherence - currentState.coherence) / 100;
  const entropyDiff = Math.abs(target.entropy - currentState.entropy) / 100;
  const generativityDiff = Math.abs(target.generativity - currentState.generativity) / 100;

  // Weighted Euclidean distance
  const distance = Math.sqrt(
    ZPD_FIT_WEIGHTS.coherence * coherenceDiff * coherenceDiff +
    ZPD_FIT_WEIGHTS.entropy * entropyDiff * entropyDiff +
    ZPD_FIT_WEIGHTS.generativity * generativityDiff * generativityDiff
  );

  // Convert distance to fit score (closer = better)
  // Use exponential decay for scoring
  const fitScore = Math.exp(-distance * 3);

  return fitScore;
}

/**
 * Generate human-readable reasoning for suggestion
 */
function generateSuggestionReasoning(
  prereqCheck: { met: boolean; missing: string[]; partialScore: number },
  manifoldFit: number,
  currentMastery: number
): string {
  const reasons: string[] = [];

  if (prereqCheck.met) {
    reasons.push('All prerequisites mastered');
  } else if (prereqCheck.partialScore > 0.7) {
    reasons.push('Most prerequisites met');
  } else {
    reasons.push(`Missing ${prereqCheck.missing.length} prerequisite(s)`);
  }

  if (manifoldFit > 0.8) {
    reasons.push('Excellent fit for current learning state');
  } else if (manifoldFit > 0.6) {
    reasons.push('Good fit for current learning state');
  } else {
    reasons.push('Moderate fit for current learning state');
  }

  if (currentMastery > 0) {
    reasons.push(`Previously introduced (${Math.round(currentMastery)}% mastery)`);
  }

  return reasons.join('. ');
}

// ============================================================================
// Mastery Management
// ============================================================================

/**
 * Update standard mastery with new evidence
 * Returns updated mastery record with recalculated status
 */
export function updateStandardMastery(
  studentId: string,
  standardId: string,
  evidence: { score: number; source: string }
): StandardMasteryRecord {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Get existing mastery
  let existing = getStandardMasteryFromStore(studentId, standardId);

  let newMasteryLevel: number;
  let evidenceCount: number;
  let firstExposure: number;

  if (!existing) {
    // First exposure to this standard
    newMasteryLevel = evidence.score;
    evidenceCount = 1;
    firstExposure = now;
  } else {
    // Update using exponential moving average
    // New evidence weighted more heavily (alpha = 0.3)
    const alpha = 0.3;
    newMasteryLevel = alpha * evidence.score + (1 - alpha) * existing.mastery_level;
    evidenceCount = existing.evidence_count + 1;
    firstExposure = existing.last_practiced_at || now;
  }

  // Determine status based on mastery level
  const status = getMasteryStatus(newMasteryLevel);

  // Calculate confidence (increases with evidence count)
  const confidence = Math.min(1.0, 0.3 + (evidenceCount * 0.1));

  // Update in database
  updateStandardMasteryInStore({
    student_id: studentId,
    standard_id: standardId,
    mastery_level: newMasteryLevel,
    evidence_count: evidenceCount,
    last_practiced_at: now,
    status,
    confidence_score: confidence,
  });

  return {
    student_id: studentId,
    standard_id: standardId,
    mastery_level: newMasteryLevel,
    evidence_count: evidenceCount,
    first_exposure: firstExposure,
    last_assessment: now,
    status,
    confidence_score: confidence,
  };
}

/**
 * Get mastery status from mastery level
 */
function getMasteryStatus(masteryLevel: number): MasteryStatus {
  if (masteryLevel >= MASTERY_THRESHOLDS.mastered) return 'mastered';
  if (masteryLevel >= MASTERY_THRESHOLDS.proficient) return 'proficient';
  if (masteryLevel >= MASTERY_THRESHOLDS.developing) return 'developing';
  if (masteryLevel >= MASTERY_THRESHOLDS.introduced) return 'introduced';
  return 'not_started';
}

/**
 * Get all mastery records for a student
 */
export function getStudentMastery(studentId: string): StandardMasteryRecord[] {
  const masteryRecords = getAllStandardMastery(studentId);

  return masteryRecords.map(m => ({
    student_id: m.student_id,
    standard_id: m.standard_id,
    mastery_level: m.mastery_level,
    evidence_count: m.evidence_count,
    first_exposure: m.last_practiced_at || 0,
    last_assessment: m.last_practiced_at || 0,
    status: m.status as MasteryStatus,
    confidence_score: m.confidence_score,
  }));
}

// ============================================================================
// Prerequisite Analysis
// ============================================================================

/**
 * Get the full prerequisite chain for a standard
 * Returns all standards that must be mastered (direct and transitive)
 */
export function getPrerequisiteChain(standardId: string): string[] {
  const visited = new Set<string>();
  const chain: string[] = [];

  function traverse(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const standard = getStandard(id);
    if (!standard) return;

    for (const prereqId of standard.prerequisites || []) {
      traverse(prereqId);
      if (!chain.includes(prereqId)) {
        chain.push(prereqId);
      }
    }
  }

  traverse(standardId);
  return chain;
}

/**
 * Calculate readiness for a standard (0-1)
 * Based on prerequisite mastery levels
 */
export function calculateStandardReadiness(
  studentId: string,
  standardId: string
): number {
  const masteryMap = new Map<string, StandardMastery>();
  const allMastery = getAllStandardMastery(studentId);
  for (const m of allMastery) {
    masteryMap.set(m.standard_id, m);
  }

  const prereqCheck = checkPrerequisites(studentId, standardId, masteryMap);
  return prereqCheck.partialScore;
}

/**
 * Check prerequisites for a standard
 * Returns detailed prerequisite analysis
 */
function checkPrerequisites(
  studentId: string,
  standardId: string,
  masteryMap?: Map<string, StandardMastery>
): { met: boolean; missing: string[]; partialScore: number } {
  const standard = getStandard(standardId);
  if (!standard) {
    throw new Error(`Standard not found: ${standardId}`);
  }

  // Build mastery map if not provided
  if (!masteryMap) {
    masteryMap = new Map<string, StandardMastery>();
    const allMastery = getAllStandardMastery(studentId);
    for (const m of allMastery) {
      masteryMap.set(m.standard_id, m);
    }
  }

  const prerequisites = standard.prerequisites || [];
  if (prerequisites.length === 0) {
    return { met: true, missing: [], partialScore: 1.0 };
  }

  const missing: string[] = [];
  let totalMastery = 0;

  for (const prereqId of prerequisites) {
    const mastery = masteryMap.get(prereqId);
    const masteryLevel = mastery?.mastery_level || 0;

    totalMastery += masteryLevel;

    if (masteryLevel < PREREQUISITE_MASTERY_THRESHOLD) {
      missing.push(prereqId);
    }
  }

  // Calculate partial score (average mastery of prerequisites)
  const partialScore = totalMastery / (prerequisites.length * 100);

  return {
    met: missing.length === 0,
    missing,
    partialScore,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get DOK profile for a given level
 */
export function getDOKProfile(level: DOKLevel): DOKProfile {
  return DOK_PROFILES[level];
}

/**
 * Get all DOK profiles
 */
export function getAllDOKProfiles(): Record<DOKLevel, DOKProfile> {
  return DOK_PROFILES;
}

/**
 * Get cognitive profile for a stat
 */
export function getStatCognitiveProfile(stat: StatName) {
  return STAT_COGNITIVE_PROFILE[stat];
}

/**
 * Calculate aggregate manifold state from all mastered standards
 */
export function calculateAggregateManifoldState(
  studentId: string
): { coherence: number; entropy: number; generativity: number } {
  const masteryRecords = getAllStandardMastery(studentId);

  let totalCoherence = 0;
  let totalEntropy = 0;
  let totalGenerativity = 0;
  let totalWeight = 0;

  for (const mastery of masteryRecords) {
    if (mastery.mastery_level < 20) continue; // Skip not-started standards

    const contribution = calculateStandardContribution(
      mastery.standard_id,
      mastery.mastery_level
    );

    const weight = mastery.mastery_level / 100;
    totalCoherence += contribution.coherence * weight;
    totalEntropy += contribution.entropy * weight;
    totalGenerativity += contribution.generativity * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { coherence: 50, entropy: 50, generativity: 50 };
  }

  return {
    coherence: Math.min(100, totalCoherence / totalWeight),
    entropy: Math.min(100, totalEntropy / totalWeight),
    generativity: Math.min(100, totalGenerativity / totalWeight),
  };
}
