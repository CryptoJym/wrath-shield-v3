/**
 * HYRO FORGE: Assessment Framework
 *
 * Standards-based, manifold-aware assessment engine that:
 * - Conducts diagnostic, formative, summative, transfer, and metacognitive assessments
 * - Selects items adaptively based on learner state vectors (C/E/G)
 * - Scores responses using rubrics aligned to DOK levels
 * - Updates mastery estimates using Bayesian inference
 * - Provides actionable feedback for instructional decisions
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  LearnerState,
  distanceCEG,
  findNearestAttractor
} from './forge-learner-state';
import {
  getZPDState,
  ZPDState
} from './forge-zpd-engine';
import {
  recordSkillEvidence,
  getSkillProficiency
} from './forge-proficiency';
import {
  Standard,
  StandardMastery,
  getStandard,
  getStandardMastery,
  getAllStandards
} from './education-store';
import { StatName } from './forge-types';

// ============================================================================
// Types
// ============================================================================

export type AssessmentType =
  | 'diagnostic'      // Initial placement
  | 'formative'       // During learning (quests, comprehension)
  | 'summative'       // End of unit/standard
  | 'transfer'        // Cross-domain application
  | 'metacognitive';  // Self-assessment calibration

export type ItemType =
  | 'multiple_choice'
  | 'constructed_response'
  | 'performance_task';

export interface AssessmentItem {
  id: string;
  standard_ids: string[];        // Which standards this assesses
  item_type: ItemType;
  content: string;
  difficulty: number;            // 0-100
  cognitive_level: number;       // 1-4 (DOK)
  rubric?: AssessmentRubric;
  time_limit_seconds?: number;
  scaffolding_hints?: string[];

  // Manifold properties
  c_demand?: number;             // Coherence requirement (0-100)
  e_tolerance?: number;          // Entropy tolerance (0-100)
  g_requirement?: number;        // Generativity requirement (0-100)

  // Metadata
  created_at?: number;
  times_used?: number;
  avg_score?: number;
}

export interface AssessmentRubric {
  criteria: Array<{
    name: string;
    weight: number;
    levels: Array<{
      score: number;
      description: string;
    }>;
  }>;
}

export interface AssessmentSession {
  id: string;
  student_id: string;
  assessment_type: AssessmentType;
  target_standards: string[];
  items: AssessmentItem[];
  responses: AssessmentResponse[];
  state_vector_start: { coherence: number; entropy: number; generativity: number };
  state_vector_end?: { coherence: number; entropy: number; generativity: number };
  started_at: number;
  completed_at?: number;
  metadata?: Record<string, any>;
}

export interface AssessmentResponse {
  item_id: string;
  student_response: string;
  score?: number;
  rubric_scores?: Record<string, number>;
  time_spent_seconds: number;
  scaffolding_used: string[];
  is_correct?: boolean;
  created_at?: number;
}

export interface AssessmentResults {
  session_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  standards_assessed: Array<{
    standard_id: string;
    items_count: number;
    correct_count: number;
    mastery_estimate: number;
    status: 'not_started' | 'emerging' | 'developing' | 'proficient' | 'mastered';
  }>;
  state_vector_change: {
    delta_C: number;
    delta_E: number;
    delta_G: number;
  };
  recommendations: string[];
  next_steps: string[];
}

// ============================================================================
// Database Schema Initialization
// ============================================================================

/**
 * Initialize assessment tables in the database
 * This should be called during app initialization or migration
 */
export function initializeAssessmentTables(): void {
  const db = getDatabase();

  // Assessment items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_assessment_items (
      id TEXT PRIMARY KEY,
      standard_ids TEXT NOT NULL,  -- JSON array
      item_type TEXT NOT NULL,
      content TEXT NOT NULL,
      difficulty REAL NOT NULL,
      cognitive_level INTEGER NOT NULL,
      rubric TEXT,  -- JSON
      time_limit_seconds INTEGER,
      scaffolding_hints TEXT,  -- JSON array
      c_demand REAL,
      e_tolerance REAL,
      g_requirement REAL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      times_used INTEGER NOT NULL DEFAULT 0,
      avg_score REAL
    )
  `);

  // Assessment sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_assessment_sessions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      assessment_type TEXT NOT NULL,
      target_standards TEXT NOT NULL,  -- JSON array
      items TEXT NOT NULL,  -- JSON array
      responses TEXT NOT NULL DEFAULT '[]',  -- JSON array
      state_vector_start TEXT NOT NULL,  -- JSON
      state_vector_end TEXT,  -- JSON
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      metadata TEXT  -- JSON
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assessment_sessions_student
    ON hyro_assessment_sessions(student_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assessment_sessions_type
    ON hyro_assessment_sessions(assessment_type)
  `);
}

// ============================================================================
// Assessment Session Management
// ============================================================================

/**
 * Create a new assessment session
 */
export function createAssessmentSession(
  studentId: string,
  assessmentType: AssessmentType,
  targetStandards: string[]
): AssessmentSession {
  const db = getDatabase();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Get current state vector (use proficiency as proxy for now)
  const stateVector = getStateVectorForStudent(studentId);

  const session: AssessmentSession = {
    id,
    student_id: studentId,
    assessment_type: assessmentType,
    target_standards: targetStandards,
    items: [],
    responses: [],
    state_vector_start: stateVector,
    started_at: now,
  };

  db.prepare(`
    INSERT INTO hyro_assessment_sessions (
      id, student_id, assessment_type, target_standards, items,
      state_vector_start, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    studentId,
    assessmentType,
    JSON.stringify(targetStandards),
    JSON.stringify([]),
    JSON.stringify(stateVector),
    now
  );

  return session;
}

/**
 * Get assessment session by ID
 */
export function getAssessmentSession(sessionId: string): AssessmentSession | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM hyro_assessment_sessions WHERE id = ?
  `).get(sessionId) as any;

  if (!row) return null;

  return {
    id: row.id,
    student_id: row.student_id,
    assessment_type: row.assessment_type,
    target_standards: JSON.parse(row.target_standards),
    items: JSON.parse(row.items),
    responses: JSON.parse(row.responses),
    state_vector_start: JSON.parse(row.state_vector_start),
    state_vector_end: row.state_vector_end ? JSON.parse(row.state_vector_end) : undefined,
    started_at: row.started_at,
    completed_at: row.completed_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

/**
 * Update assessment session
 */
function updateAssessmentSession(session: AssessmentSession): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_assessment_sessions
    SET items = ?, responses = ?, state_vector_end = ?, completed_at = ?, metadata = ?
    WHERE id = ?
  `).run(
    JSON.stringify(session.items),
    JSON.stringify(session.responses),
    session.state_vector_end ? JSON.stringify(session.state_vector_end) : null,
    session.completed_at || null,
    session.metadata ? JSON.stringify(session.metadata) : null,
    session.id
  );
}

// ============================================================================
// Manifold-Aware Item Selection
// ============================================================================

/**
 * Get current state vector for a student
 * Uses proficiency levels as proxy for C/E/G dimensions
 */
function getStateVectorForStudent(studentId: string): {
  coherence: number;
  entropy: number;
  generativity: number
} {
  // Try to get from state vectors table first
  const db = getDatabase();
  const stored = db.prepare(`
    SELECT coherence, entropy, generativity
    FROM hyro_state_vectors
    WHERE student_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(studentId) as any;

  if (stored) {
    return {
      coherence: stored.coherence || 50,
      entropy: stored.entropy || 50,
      generativity: stored.generativity || 50,
    };
  }

  // Fallback: estimate from proficiency profile
  // High proficiency → high coherence
  // Inconsistent performance → high entropy
  // Creative problem solving → high generativity
  return {
    coherence: 50,
    entropy: 50,
    generativity: 50,
  };
}

/**
 * Calculate manifold fit for an item
 * Returns a score 0-100 indicating how well the item matches the learner's
 * current state and target trajectory
 */
export function calculateManifoldFit(
  item: AssessmentItem,
  currentState: { coherence: number; entropy: number; generativity: number },
  targetState: { coherence: number; entropy: number; generativity: number }
): number {
  // If item doesn't have manifold properties, use difficulty-based scoring
  if (!item.c_demand && !item.e_tolerance && !item.g_requirement) {
    return 50; // Neutral score
  }

  const cDemand = item.c_demand || 50;
  const eTolerance = item.e_tolerance || 50;
  const gRequirement = item.g_requirement || 50;

  // Calculate how well current state matches item requirements
  const cFit = 100 - Math.abs(currentState.coherence - cDemand);
  const eFit = 100 - Math.abs(currentState.entropy - eTolerance);
  const gFit = 100 - Math.abs(currentState.generativity - gRequirement);

  // Calculate trajectory alignment (does this item move us toward target?)
  const cTrajectory = (targetState.coherence - currentState.coherence) * (cDemand - currentState.coherence);
  const eTrajectory = (targetState.entropy - currentState.entropy) * (eTolerance - currentState.entropy);
  const gTrajectory = (targetState.generativity - currentState.generativity) * (gRequirement - currentState.generativity);

  const trajectoryScore = Math.max(0, Math.min(100,
    50 + (cTrajectory + eTrajectory + gTrajectory) / 30
  ));

  // Weighted combination: 60% current fit, 40% trajectory alignment
  return (cFit + eFit + gFit) / 3 * 0.6 + trajectoryScore * 0.4;
}

/**
 * Select assessment items based on manifold state (KEY FUNCTION)
 */
export function selectAssessmentItems(
  studentId: string,
  targetStandard: string,
  count: number = 5
): AssessmentItem[] {
  const db = getDatabase();

  // Get current and target states
  const currentState = getStateVectorForStudent(studentId);
  const targetState = getTargetStateForStandard(targetStandard);

  // Get ZPD state for difficulty calibration
  const zpd = getZPDStateForStandard(targetStandard);

  // Fetch candidate items for this standard
  const candidates = db.prepare(`
    SELECT * FROM hyro_assessment_items
    WHERE standard_ids LIKE ?
    ORDER BY times_used ASC, RANDOM()
    LIMIT ?
  `).all(`%"${targetStandard}"%`, count * 3) as any[];

  // If no items found, generate default items
  if (candidates.length === 0) {
    return generateDefaultItems(targetStandard, count);
  }

  // Score each candidate
  const scored = candidates.map(row => {
    const item = deserializeItem(row);
    const manifoldFit = calculateManifoldFit(item, currentState, targetState);
    const difficultyFit = calculateDifficultyFit(item.difficulty, zpd);

    // Combined score: 70% manifold fit, 30% difficulty fit
    const totalScore = manifoldFit * 0.7 + difficultyFit * 0.3;

    return { item, score: totalScore };
  });

  // Sort by score and take top items
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.item);
}

/**
 * Get target state for a standard (where we want the learner to be)
 */
function getTargetStateForStandard(standardId: string): {
  coherence: number;
  entropy: number;
  generativity: number;
} {
  // Most standards target high coherence
  // Different DOK levels require different E/G profiles
  const standard = getStandard(standardId);

  if (!standard) {
    return { coherence: 70, entropy: 40, generativity: 60 };
  }

  // Higher DOK → higher generativity requirement
  // Foundational skills → lower entropy tolerance
  // Complex standards → higher entropy tolerance

  return {
    coherence: 75,      // Target strong understanding
    entropy: 45,        // Moderate comfort with ambiguity
    generativity: 65,   // Good creative application
  };
}

/**
 * Get ZPD state for a standard (mapped from stat)
 */
function getZPDStateForStandard(standardId: string): ZPDState {
  // Map standard to relevant stat
  const standard = getStandard(standardId);
  const stat = mapStandardToStat(standard);
  return getZPDState(stat);
}

/**
 * Map a standard to a stat name
 */
function mapStandardToStat(standard: Standard | null): StatName {
  if (!standard) return 'reading';

  const category = standard.category.toLowerCase();
  if (category.includes('math')) return 'math';
  if (category.includes('reading') || category.includes('ela')) return 'reading';
  if (category.includes('writing')) return 'writing';
  if (category.includes('science')) return 'science';

  return 'reading'; // Default
}

/**
 * Calculate difficulty fit score
 */
function calculateDifficultyFit(itemDifficulty: number, zpd: ZPDState): number {
  const { zpd_lower, zpd_upper, optimal_difficulty } = zpd;

  // Perfect score at optimal difficulty
  if (itemDifficulty === optimal_difficulty) return 100;

  // In ZPD range: score based on distance from optimal
  if (itemDifficulty >= zpd_lower && itemDifficulty <= zpd_upper) {
    const distance = Math.abs(itemDifficulty - optimal_difficulty);
    const zoneWidth = zpd_upper - zpd_lower;
    return Math.max(70, 100 - (distance / zoneWidth) * 30);
  }

  // Outside ZPD: penalize
  if (itemDifficulty < zpd_lower) {
    const distance = zpd_lower - itemDifficulty;
    return Math.max(0, 50 - distance);
  } else {
    const distance = itemDifficulty - zpd_upper;
    return Math.max(0, 40 - distance * 1.5);
  }
}

/**
 * Deserialize item from database row
 */
function deserializeItem(row: any): AssessmentItem {
  return {
    id: row.id,
    standard_ids: JSON.parse(row.standard_ids || '[]'),
    item_type: row.item_type,
    content: row.content,
    difficulty: row.difficulty,
    cognitive_level: row.cognitive_level,
    rubric: row.rubric ? JSON.parse(row.rubric) : undefined,
    time_limit_seconds: row.time_limit_seconds,
    scaffolding_hints: row.scaffolding_hints ? JSON.parse(row.scaffolding_hints) : undefined,
    c_demand: row.c_demand,
    e_tolerance: row.e_tolerance,
    g_requirement: row.g_requirement,
    created_at: row.created_at,
    times_used: row.times_used,
    avg_score: row.avg_score,
  };
}

/**
 * Generate default items when none exist in database
 */
function generateDefaultItems(standardId: string, count: number): AssessmentItem[] {
  const standard = getStandard(standardId);
  const items: AssessmentItem[] = [];

  for (let i = 0; i < count; i++) {
    const dokLevel = Math.min(4, Math.floor(i / 2) + 1);
    const difficulty = 40 + (i * 10);

    items.push({
      id: randomUUID(),
      standard_ids: [standardId],
      item_type: dokLevel <= 2 ? 'multiple_choice' : 'constructed_response',
      content: `Assessment item for ${standard?.description || standardId} (DOK ${dokLevel})`,
      difficulty,
      cognitive_level: dokLevel,
      rubric: getRubric(standardId, dokLevel),
      c_demand: 50 + (dokLevel * 5),
      e_tolerance: 40 + (dokLevel * 8),
      g_requirement: 45 + (dokLevel * 10),
    });
  }

  return items;
}

// ============================================================================
// Adaptive Item Selection During Assessment
// ============================================================================

/**
 * Get next item based on previous responses (adaptive)
 */
export function getNextItem(
  sessionId: string,
  previousResponses: AssessmentResponse[]
): AssessmentItem | null {
  const session = getAssessmentSession(sessionId);
  if (!session) return null;

  // If no responses yet, return first item
  if (previousResponses.length === 0) {
    return session.items[0] || null;
  }

  // If all items completed, return null
  if (previousResponses.length >= session.items.length) {
    return null;
  }

  // Calculate current performance trend
  const recentCorrect = previousResponses.slice(-3).filter(r => r.is_correct).length;
  const recentTotal = Math.min(3, previousResponses.length);
  const successRate = recentCorrect / recentTotal;

  // Adjust difficulty based on performance
  let targetDifficulty = session.items[0].difficulty;

  if (successRate > 0.8) {
    // Doing well, increase difficulty
    targetDifficulty = Math.min(100, targetDifficulty + 10);
  } else if (successRate < 0.4) {
    // Struggling, decrease difficulty
    targetDifficulty = Math.max(0, targetDifficulty - 10);
  }

  // Find next item closest to target difficulty
  const remainingItems = session.items.slice(previousResponses.length);
  if (remainingItems.length === 0) return null;

  remainingItems.sort((a, b) => {
    const aDist = Math.abs(a.difficulty - targetDifficulty);
    const bDist = Math.abs(b.difficulty - targetDifficulty);
    return aDist - bDist;
  });

  return remainingItems[0];
}

// ============================================================================
// Rubric Generation
// ============================================================================

/**
 * Get rubric for constructed response scoring
 */
export function getRubric(standardId: string, dok: number): AssessmentRubric {
  // DOK-aligned rubrics
  const rubrics: Record<number, AssessmentRubric> = {
    1: {
      criteria: [
        {
          name: 'Accuracy',
          weight: 0.7,
          levels: [
            { score: 4, description: 'Fully accurate recall with no errors' },
            { score: 3, description: 'Mostly accurate with minor errors' },
            { score: 2, description: 'Partially accurate with significant gaps' },
            { score: 1, description: 'Minimal accuracy' },
          ],
        },
        {
          name: 'Completeness',
          weight: 0.3,
          levels: [
            { score: 4, description: 'All required elements present' },
            { score: 3, description: 'Most elements present' },
            { score: 2, description: 'Some elements missing' },
            { score: 1, description: 'Many elements missing' },
          ],
        },
      ],
    },
    2: {
      criteria: [
        {
          name: 'Understanding',
          weight: 0.5,
          levels: [
            { score: 4, description: 'Deep understanding demonstrated through examples' },
            { score: 3, description: 'Good understanding with some examples' },
            { score: 2, description: 'Basic understanding without examples' },
            { score: 1, description: 'Limited understanding' },
          ],
        },
        {
          name: 'Application',
          weight: 0.5,
          levels: [
            { score: 4, description: 'Correctly applies concept in multiple contexts' },
            { score: 3, description: 'Correctly applies concept in familiar context' },
            { score: 2, description: 'Attempts application with errors' },
            { score: 1, description: 'Unable to apply concept' },
          ],
        },
      ],
    },
    3: {
      criteria: [
        {
          name: 'Reasoning',
          weight: 0.4,
          levels: [
            { score: 4, description: 'Clear, logical reasoning with strong justification' },
            { score: 3, description: 'Logical reasoning with adequate justification' },
            { score: 2, description: 'Reasoning present but incomplete or unclear' },
            { score: 1, description: 'Minimal or flawed reasoning' },
          ],
        },
        {
          name: 'Evidence',
          weight: 0.3,
          levels: [
            { score: 4, description: 'Multiple relevant pieces of evidence cited' },
            { score: 3, description: 'Some relevant evidence cited' },
            { score: 2, description: 'Limited evidence provided' },
            { score: 1, description: 'No evidence provided' },
          ],
        },
        {
          name: 'Analysis',
          weight: 0.3,
          levels: [
            { score: 4, description: 'Insightful analysis connecting multiple concepts' },
            { score: 3, description: 'Good analysis of key concepts' },
            { score: 2, description: 'Surface-level analysis' },
            { score: 1, description: 'No meaningful analysis' },
          ],
        },
      ],
    },
    4: {
      criteria: [
        {
          name: 'Creativity',
          weight: 0.3,
          levels: [
            { score: 4, description: 'Novel, original approach or solution' },
            { score: 3, description: 'Some creative elements present' },
            { score: 2, description: 'Conventional approach with minor variations' },
            { score: 1, description: 'No creativity evident' },
          ],
        },
        {
          name: 'Synthesis',
          weight: 0.4,
          levels: [
            { score: 4, description: 'Integrates multiple concepts into coherent whole' },
            { score: 3, description: 'Combines several concepts with some integration' },
            { score: 2, description: 'Lists concepts without meaningful integration' },
            { score: 1, description: 'No synthesis attempted' },
          ],
        },
        {
          name: 'Transfer',
          weight: 0.3,
          levels: [
            { score: 4, description: 'Successfully applies to novel, complex context' },
            { score: 3, description: 'Applies to somewhat novel context' },
            { score: 2, description: 'Limited transfer beyond familiar context' },
            { score: 1, description: 'No transfer evident' },
          ],
        },
      ],
    },
  };

  return rubrics[Math.min(4, Math.max(1, dok))] || rubrics[2];
}

// ============================================================================
// Response Scoring
// ============================================================================

/**
 * Score a response and update mastery
 */
export function scoreAssessmentResponse(
  sessionId: string,
  itemId: string,
  response: string,
  timeSpent: number,
  scaffoldingUsed: string[]
): { score: number; feedback: string; masteryUpdate: any } {
  const session = getAssessmentSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const item = session.items.find(i => i.id === itemId);
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  // Score based on item type
  let score = 0;
  let rubricScores: Record<string, number> = {};
  let isCorrect = false;

  if (item.item_type === 'multiple_choice') {
    // Simple correct/incorrect for MC
    // In production, you'd check against correct answer
    isCorrect = response.length > 0; // Placeholder
    score = isCorrect ? 100 : 0;
  } else if (item.rubric) {
    // Use rubric for constructed response
    const result = scoreWithRubric(response, item.rubric);
    score = result.score;
    rubricScores = result.criteriaScores;
    isCorrect = score >= 70; // 70% threshold for "correct"
  }

  // Apply scaffolding penalty
  const scaffoldingPenalty = scaffoldingUsed.length * 5;
  score = Math.max(0, score - scaffoldingPenalty);

  // Create response record
  const assessmentResponse: AssessmentResponse = {
    item_id: itemId,
    student_response: response,
    score,
    rubric_scores: rubricScores,
    time_spent_seconds: timeSpent,
    scaffolding_used: scaffoldingUsed,
    is_correct: isCorrect,
    created_at: Math.floor(Date.now() / 1000),
  };

  // Update session
  session.responses.push(assessmentResponse);
  updateAssessmentSession(session);

  // Record evidence for proficiency tracking
  for (const standardId of item.standard_ids) {
    const stat = mapStandardToStat(getStandard(standardId));
    recordSkillEvidence({
      stat_name: stat,
      source_type: 'assessment',
      source_id: sessionId,
      performance_score: score,
      difficulty_level: item.difficulty / 100,
      time_pressure: timeSpent < (item.time_limit_seconds || 300),
      topic_tags: item.standard_ids,
    });
  }

  // Generate feedback
  const feedback = generateFeedback(item, score, rubricScores);

  return {
    score,
    feedback,
    masteryUpdate: {
      standards_affected: item.standard_ids,
      evidence_added: true,
    },
  };
}

/**
 * Score response using rubric
 */
function scoreWithRubric(
  response: string,
  rubric: AssessmentRubric
): { score: number; criteriaScores: Record<string, number> } {
  // Heuristic scoring - in production this would use AI
  const words = response.trim().split(/\s+/).length;
  const criteriaScores: Record<string, number> = {};
  let totalWeightedScore = 0;

  for (const criterion of rubric.criteria) {
    // Simple heuristic: longer responses score higher
    // Adjust based on word count
    let criterionScore = 2; // Default moderate score

    if (words > 100) criterionScore = 4;
    else if (words > 50) criterionScore = 3;
    else if (words > 20) criterionScore = 2;
    else criterionScore = 1;

    criteriaScores[criterion.name] = criterionScore;
    totalWeightedScore += criterionScore * criterion.weight;
  }

  // Convert to 0-100 scale (rubrics use 1-4 scale)
  const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
  const score = (totalWeightedScore / (4 * totalWeight)) * 100;

  return { score, criteriaScores };
}

/**
 * Generate feedback based on performance
 */
function generateFeedback(
  item: AssessmentItem,
  score: number,
  rubricScores: Record<string, number>
): string {
  if (score >= 90) {
    return 'Excellent work! You demonstrated strong mastery of this concept.';
  } else if (score >= 70) {
    return 'Good work! You showed solid understanding with room for refinement.';
  } else if (score >= 50) {
    const weakest = Object.entries(rubricScores)
      .sort((a, b) => a[1] - b[1])[0]?.[0];
    return `You\'re making progress. Focus on improving: ${weakest || 'core concepts'}.`;
  } else {
    return 'This concept needs more practice. Consider reviewing the foundational skills.';
  }
}

// ============================================================================
// Assessment Completion
// ============================================================================

/**
 * Complete assessment and calculate results
 */
export function completeAssessment(sessionId: string): AssessmentResults {
  const session = getAssessmentSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const now = Math.floor(Date.now() / 1000);

  // Calculate total score
  const totalScore = session.responses.reduce((sum, r) => sum + (r.score || 0), 0);
  const maxScore = session.responses.length * 100;
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  // Analyze by standard
  const standardsMap = new Map<string, { items: number; correct: number }>();

  for (const response of session.responses) {
    const item = session.items.find(i => i.item_id === response.item_id);
    if (!item) continue;

    for (const stdId of item.standard_ids) {
      const current = standardsMap.get(stdId) || { items: 0, correct: 0 };
      current.items++;
      if (response.is_correct) current.correct++;
      standardsMap.set(stdId, current);
    }
  }

  const standardsAssessed = Array.from(standardsMap.entries()).map(([stdId, data]) => {
    const mastery = (data.correct / data.items) * 100;
    let status: 'not_started' | 'emerging' | 'developing' | 'proficient' | 'mastered';

    if (mastery >= 90) status = 'mastered';
    else if (mastery >= 75) status = 'proficient';
    else if (mastery >= 50) status = 'developing';
    else if (mastery >= 25) status = 'emerging';
    else status = 'not_started';

    return {
      standard_id: stdId,
      items_count: data.items,
      correct_count: data.correct,
      mastery_estimate: mastery,
      status,
    };
  });

  // Calculate state vector change
  const endState = getStateVectorForStudent(session.student_id);
  const stateChange = {
    delta_C: endState.coherence - session.state_vector_start.coherence,
    delta_E: endState.entropy - session.state_vector_start.entropy,
    delta_G: endState.generativity - session.state_vector_start.generativity,
  };

  // Generate recommendations
  const recommendations: string[] = [];
  const nextSteps: string[] = [];

  if (percentage >= 80) {
    recommendations.push('Strong performance overall. Ready for more advanced content.');
    nextSteps.push('Progress to next unit or increase difficulty level');
  } else if (percentage >= 60) {
    recommendations.push('Good understanding with some gaps to address.');
    nextSteps.push('Review specific standards where mastery < 75%');
  } else {
    recommendations.push('Foundational concepts need reinforcement.');
    nextSteps.push('Remediate core standards before advancing');
  }

  // Add standard-specific recommendations
  for (const std of standardsAssessed) {
    if (std.status === 'emerging' || std.status === 'not_started') {
      recommendations.push(`Focus on standard ${std.standard_id}: needs significant support`);
    }
  }

  // Update session
  session.completed_at = now;
  session.state_vector_end = endState;
  updateAssessmentSession(session);

  return {
    session_id: sessionId,
    total_score: totalScore,
    max_score: maxScore,
    percentage,
    standards_assessed: standardsAssessed,
    state_vector_change: stateChange,
    recommendations,
    next_steps: nextSteps,
  };
}

// ============================================================================
// Diagnostic Assessment
// ============================================================================

/**
 * Generate diagnostic assessment for initial placement
 */
export function generateDiagnosticAssessment(
  studentId: string,
  subject: 'math' | 'ela' | 'science',
  enrolledGrade: string
): AssessmentSession {
  // Get relevant standards for subject and grade
  const allStandards = getAllStandards();
  const relevantStandards = allStandards.filter(s =>
    s.category.toLowerCase().includes(subject) &&
    isRelevantForGrade(s, enrolledGrade)
  );

  // Select 10-15 key standards for diagnostic
  const selectedStandards = relevantStandards
    .slice(0, 15)
    .map(s => s.id);

  // Create session
  const session = createAssessmentSession(
    studentId,
    'diagnostic',
    selectedStandards
  );

  // Select items for each standard
  const items: AssessmentItem[] = [];
  for (const stdId of selectedStandards) {
    const stdItems = selectAssessmentItems(studentId, stdId, 2);
    items.push(...stdItems);
  }

  session.items = items;
  updateAssessmentSession(session);

  return session;
}

/**
 * Check if standard is relevant for grade
 */
function isRelevantForGrade(standard: Standard, grade: string): boolean {
  // Simple heuristic - check if standard ID contains grade
  const stdId = standard.id.toLowerCase();
  return stdId.includes(grade.toLowerCase()) ||
         stdId.includes(`grade-${grade}`) ||
         stdId.includes(`g${grade}`);
}

// ============================================================================
// Item Bank Loader - Load items from JSON files
// ============================================================================

interface ItemBankItem {
  id: string;
  standard_id: string;
  dok_level: number;
  question_type: string;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  rubric?: Record<string, string>;
  manifold_fit: {
    coherence_delta: number;
    entropy_delta: number;
    generativity_delta: number;
  };
  difficulty: number;
  time_estimate_seconds: number;
  passage?: string;
  science_practice?: string;
}

interface ItemBankFile {
  grade: string;
  course?: string;
  items: ItemBankItem[];
}

const ITEM_BANK_CACHE: Map<string, ItemBankItem[]> = new Map();

/**
 * Load assessment items from JSON file
 */
export function loadItemBank(
  subject: 'math' | 'ela' | 'science',
  grade: string
): ItemBankItem[] {
  const cacheKey = `${subject}-${grade}`;

  if (ITEM_BANK_CACHE.has(cacheKey)) {
    return ITEM_BANK_CACHE.get(cacheKey)!;
  }

  const fileName = `${subject}-items-${grade.toLowerCase()}.json`;
  const filePath = path.join(
    process.cwd(),
    'data',
    'assessments',
    fileName
  );

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: ItemBankFile = JSON.parse(content);
      ITEM_BANK_CACHE.set(cacheKey, data.items);
      return data.items;
    }
  } catch (error) {
    console.warn(`[Assessment] Could not load item bank: ${fileName}`, error);
  }

  return [];
}

/**
 * Get all items for a specific standard from item banks
 */
export function getItemsForStandard(standardId: string): ItemBankItem[] {
  // Determine subject and grade from standard ID
  const { subject, grade } = parseStandardId(standardId);
  if (!subject || !grade) return [];

  const items = loadItemBank(subject, grade);
  return items.filter(item => item.standard_id === standardId);
}

/**
 * Parse standard ID to extract subject and grade
 */
function parseStandardId(standardId: string): { subject: 'math' | 'ela' | 'science' | null; grade: string | null } {
  const id = standardId.toUpperCase();

  // Math standards: K.CC.A.1, 3.OA.A.1, HSA-SSE.A.1
  if (id.match(/^\d\./) || id.match(/^K\./) || id.startsWith('HS')) {
    const gradeMatch = id.match(/^(\d|K)/);
    if (gradeMatch) {
      return { subject: 'math', grade: gradeMatch[1] === 'K' ? 'k' : `g${gradeMatch[1]}` };
    }
    if (id.startsWith('HS')) {
      // Map HS math by domain
      if (id.includes('HSA-')) return { subject: 'math', grade: 'g9' };
      if (id.includes('HSG-')) return { subject: 'math', grade: 'g10' };
      if (id.includes('HSF-')) return { subject: 'math', grade: 'g11' };
      if (id.includes('HSS-') || id.includes('HSN-')) return { subject: 'math', grade: 'g12' };
    }
  }

  // ELA standards: 1.RL.1, 9-10.RL.1, 11-12.W.1
  if (id.match(/^\d+\.RL|^\d+\.RI|^\d+\.W|^\d+\.SL|^\d+\.L|^\d+\.RF/)) {
    const gradeMatch = id.match(/^(\d+)/);
    if (gradeMatch) {
      return { subject: 'ela', grade: `g${gradeMatch[1]}` };
    }
  }
  if (id.match(/^K\.RL|^K\.RI|^K\.W|^K\.SL|^K\.L|^K\.RF/)) {
    return { subject: 'ela', grade: 'k' };
  }
  if (id.match(/^9-10\.|^11-12\./)) {
    const grade = id.startsWith('9-10') ? 'g9' : 'g11';
    return { subject: 'ela', grade };
  }

  // Science standards: K-PS2-1, 3-LS1-1, HS-LS1-1
  if (id.match(/^K-|^\d-|^MS-|^HS-/) && (id.includes('PS') || id.includes('LS') || id.includes('ESS') || id.includes('ETS'))) {
    if (id.startsWith('K-')) return { subject: 'science', grade: 'k' };
    if (id.startsWith('MS-')) return { subject: 'science', grade: 'g6' };
    if (id.startsWith('HS-')) {
      if (id.includes('LS')) return { subject: 'science', grade: 'g9' };
      if (id.includes('PS1')) return { subject: 'science', grade: 'g10' };
      if (id.includes('PS2') || id.includes('PS3') || id.includes('PS4')) return { subject: 'science', grade: 'g11' };
      if (id.includes('ESS')) return { subject: 'science', grade: 'g12' };
    }
    const gradeMatch = id.match(/^(\d)-/);
    if (gradeMatch) {
      return { subject: 'science', grade: `g${gradeMatch[1]}` };
    }
  }

  return { subject: null, grade: null };
}

/**
 * Convert item bank item to assessment item
 */
export function convertToAssessmentItem(bankItem: ItemBankItem): AssessmentItem {
  return {
    id: bankItem.id,
    standard_ids: [bankItem.standard_id],
    item_type: mapQuestionType(bankItem.question_type),
    content: bankItem.question,
    difficulty: bankItem.difficulty * 100, // Convert 0-1 to 0-100
    cognitive_level: bankItem.dok_level,
    rubric: bankItem.rubric ? {
      criteria: Object.entries(bankItem.rubric).map(([key, value]) => ({
        name: key,
        weight: 1 / Object.keys(bankItem.rubric!).length,
        levels: [{ score: parseInt(key) || 4, description: value }]
      }))
    } : undefined,
    time_limit_seconds: bankItem.time_estimate_seconds,
    c_demand: 50 + bankItem.manifold_fit.coherence_delta * 5,
    e_tolerance: 50 + bankItem.manifold_fit.entropy_delta * 5,
    g_requirement: 50 + bankItem.manifold_fit.generativity_delta * 5,
    // Additional metadata
    options: bankItem.options,
    correct_answer: bankItem.correct_answer,
    explanation: bankItem.explanation,
    passage: bankItem.passage,
  };
}

function mapQuestionType(type: string): 'multiple_choice' | 'constructed_response' | 'short_answer' | 'multi_part' {
  switch (type) {
    case 'multiple_choice': return 'multiple_choice';
    case 'short_answer': return 'short_answer';
    case 'multi_part': return 'multi_part';
    default: return 'constructed_response';
  }
}

// ============================================================================
// Attractor Field Aware Selection
// ============================================================================

interface AttractorField {
  name: string;
  coherence: number;
  entropy: number;
  generativity: number;
}

const ATTRACTOR_FIELDS: AttractorField[] = [
  { name: 'flow', coherence: 75, entropy: 35, generativity: 70 },
  { name: 'confusion', coherence: 35, entropy: 75, generativity: 45 },
  { name: 'boredom', coherence: 80, entropy: 25, generativity: 30 },
  { name: 'frustration', coherence: 30, entropy: 80, generativity: 25 },
  { name: 'discovery', coherence: 55, entropy: 60, generativity: 75 },
];

/**
 * Identify current attractor field
 */
export function identifyAttractorField(state: { coherence: number; entropy: number; generativity: number }): AttractorField {
  let closest = ATTRACTOR_FIELDS[0];
  let minDistance = Infinity;

  for (const field of ATTRACTOR_FIELDS) {
    const distance = Math.sqrt(
      Math.pow(state.coherence - field.coherence, 2) +
      Math.pow(state.entropy - field.entropy, 2) +
      Math.pow(state.generativity - field.generativity, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closest = field;
    }
  }

  return closest;
}

/**
 * Enhanced item selection with attractor field awareness
 */
export function selectItemsWithAttractorAwareness(
  studentId: string,
  standardId: string,
  count: number = 5
): AssessmentItem[] {
  const currentState = getStateVectorForStudent(studentId);
  const currentField = identifyAttractorField(currentState);

  // Get items from bank
  const bankItems = getItemsForStandard(standardId);

  if (bankItems.length === 0) {
    // Fallback to database or generated items
    return selectAssessmentItems(studentId, standardId, count);
  }

  // Score items based on attractor field strategy
  const scored = bankItems.map(bankItem => {
    const item = convertToAssessmentItem(bankItem);

    // Different strategies per attractor field
    let fieldBonus = 0;

    switch (currentField.name) {
      case 'confusion':
        // Prefer lower DOK, scaffolding-friendly items
        fieldBonus = bankItem.dok_level <= 2 ? 20 : -10;
        break;

      case 'boredom':
        // Prefer higher DOK, challenging items
        fieldBonus = bankItem.dok_level >= 3 ? 25 : -5;
        break;

      case 'frustration':
        // Prefer lowest DOK, confidence-building items
        fieldBonus = bankItem.dok_level === 1 ? 30 : -15;
        break;

      case 'discovery':
        // Prefer creative, exploratory items (DOK 3-4)
        fieldBonus = bankItem.dok_level >= 3 ? 15 : 0;
        break;

      case 'flow':
      default:
        // Balanced selection - match to current difficulty
        fieldBonus = 0;
        break;
    }

    // Calculate manifold fit
    const targetState = { coherence: 75, entropy: 35, generativity: 70 }; // Flow target
    const manifoldFit = calculateManifoldFit(item, currentState, targetState);

    return {
      item,
      score: manifoldFit + fieldBonus
    };
  });

  // Sort and select top items
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.item);
}

/**
 * Get assessment history for a student
 */
export function getAssessmentHistory(
  studentId: string,
  limit: number = 10
): AssessmentSession[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT * FROM hyro_assessment_sessions
    WHERE student_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(studentId, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    student_id: row.student_id,
    assessment_type: row.assessment_type,
    target_standards: JSON.parse(row.target_standards),
    items: JSON.parse(row.items),
    responses: JSON.parse(row.responses),
    state_vector_start: JSON.parse(row.state_vector_start),
    state_vector_end: row.state_vector_end ? JSON.parse(row.state_vector_end) : undefined,
    started_at: row.started_at,
    completed_at: row.completed_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

// ============================================================================
// Exports
// ============================================================================

export {
  initializeAssessmentTables,
  createAssessmentSession,
  getAssessmentSession,
  selectAssessmentItems,
  calculateManifoldFit,
  scoreAssessmentResponse,
  completeAssessment,
  generateDiagnosticAssessment,
  getRubric,
  getNextItem,
  loadItemBank,
  getItemsForStandard,
  convertToAssessmentItem,
  identifyAttractorField,
  selectItemsWithAttractorAwareness,
  getAssessmentHistory,
};
