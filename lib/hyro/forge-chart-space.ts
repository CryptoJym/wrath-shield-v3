/**
 * HYRO FORGE: Chart-Space Analytics
 *
 * Implements Pareto-optimal content selection and attractor-field clustering
 * for learning state analysis and optimal trajectory planning.
 *
 * Key Features:
 * - Multi-objective Pareto optimization for content selection
 * - Attractor-field clustering in C/E/G manifold space
 * - State transition prediction and trajectory planning
 * - Visualization data generation for 3D state space
 */

import { getDatabase } from '@/lib/db/Database';
import { StatName } from './forge-types';
import { getStateVector, StateVector } from './forge-zpd-engine';
import { getSkillProficiency } from './forge-proficiency';
import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface Content {
  id: string;
  title: string;
  type: string;
  difficulty: number; // 0-100
  stat_name: StatName;
  estimated_time_minutes: number;
  metadata?: Record<string, any>;
}

export interface ContentWithObjectives extends Content {
  learning_gain: number;        // Expected proficiency improvement (0-100)
  engagement_score: number;     // Predicted engagement (0-100)
  efficiency_score: number;     // Knowledge gain / time ratio
  transfer_potential: number;   // Cross-skill applicability (0-100)
}

export interface ParetoPoint {
  content: ContentWithObjectives;
  dominates: string[];          // IDs of dominated content
  dominated_by: string[];       // IDs of dominating content
  is_pareto_optimal: boolean;
}

export interface ParetoFrontier {
  optimal_content: ContentWithObjectives[];
  dominated_content: ContentWithObjectives[];
  pareto_graph: ParetoPoint[];
  recommendation: {
    top_balanced: ContentWithObjectives;
    top_learning: ContentWithObjectives;
    top_engagement: ContentWithObjectives;
    top_efficiency: ContentWithObjectives;
  };
}

export type AttractorType = 'flow' | 'confusion' | 'boredom' | 'frustration' | 'discovery';

export interface AttractorField {
  id: string;
  type: AttractorType;
  center: StateVector;
  radius: number;
  strength: number;           // 0-1: Basin depth/stability
  student_probability: number; // Likelihood student is in this state
  characteristics: string[];
  intervention_suggestions: string[];
}

export interface StateTransition {
  from_state: StateVector;
  to_state: StateVector;
  intervention: Intervention;
  probability: number;
  expected_time_steps: number;
}

export interface Intervention {
  type: 'content' | 'scaffolding' | 'challenge' | 'rest' | 'exploration';
  content_ids?: string[];
  parameters?: Record<string, any>;
  description: string;
}

export interface TrajectoryPlan {
  current_state: StateVector;
  target_state: StateVector;
  steps: Array<{
    state: StateVector;
    intervention: Intervention;
    expected_duration_minutes: number;
    confidence: number;
  }>;
  total_duration_minutes: number;
  success_probability: number;
  risk_factors: string[];
}

export interface ChartSpaceVisualization {
  student_id: string;
  stat_name: StatName;
  current_state: StateVector;
  state_history: Array<{
    timestamp: number;
    state: StateVector;
    event_type?: string;
  }>;
  attractor_fields: AttractorField[];
  pareto_frontier?: ParetoFrontier;
  trajectory_projection?: TrajectoryPlan;
}

export interface StateHistoryEntry {
  id: string;
  student_id: string;
  stat_name: StatName;
  coherence: number;
  entropy: number;
  generativity: number;
  n_items_used: number;
  event_type?: string;
  created_at: number;
}

// ============================================================================
// Constants
// ============================================================================

// Attractor field definitions based on C/E/G coordinates
const ATTRACTOR_DEFINITIONS: Array<Omit<AttractorField, 'id' | 'student_probability'>> = [
  {
    type: 'flow',
    center: { coherence: 75, entropy: 35, generativity: 70, n_items_used: 0 },
    radius: 15,
    strength: 0.9,
    characteristics: [
      'High knowledge coherence',
      'Comfortable skill level',
      'Strong creative output',
      'Deep engagement',
    ],
    intervention_suggestions: [
      'Maintain current difficulty',
      'Introduce transfer tasks',
      'Encourage exploration',
    ],
  },
  {
    type: 'confusion',
    center: { coherence: 35, entropy: 75, generativity: 45, n_items_used: 0 },
    radius: 20,
    strength: 0.6,
    characteristics: [
      'Fragmented understanding',
      'High uncertainty',
      'Moderate creative attempts',
      'Information overload',
    ],
    intervention_suggestions: [
      'Provide structured practice',
      'Break down complexity',
      'Focus on coherence-building',
      'Reduce cognitive load',
    ],
  },
  {
    type: 'boredom',
    center: { coherence: 80, entropy: 25, generativity: 30, n_items_used: 0 },
    radius: 15,
    strength: 0.7,
    characteristics: [
      'Strong understanding',
      'Low challenge level',
      'Minimal creative output',
      'Disengagement',
    ],
    intervention_suggestions: [
      'Increase difficulty',
      'Introduce novel problems',
      'Encourage transfer tasks',
      'Add time pressure',
    ],
  },
  {
    type: 'frustration',
    center: { coherence: 30, entropy: 80, generativity: 25, n_items_used: 0 },
    radius: 18,
    strength: 0.8,
    characteristics: [
      'Weak understanding',
      'High challenge level',
      'Low creative output',
      'Struggle and stress',
    ],
    intervention_suggestions: [
      'Reduce difficulty immediately',
      'Provide scaffolding',
      'Build foundational skills',
      'Offer encouragement',
    ],
  },
  {
    type: 'discovery',
    center: { coherence: 55, entropy: 60, generativity: 75, n_items_used: 0 },
    radius: 20,
    strength: 0.7,
    characteristics: [
      'Moderate understanding',
      'High novelty tolerance',
      'Strong creative exploration',
      'Active learning',
    ],
    intervention_suggestions: [
      'Support exploration',
      'Provide varied examples',
      'Encourage experimentation',
      'Guide toward coherence',
    ],
  },
];

// ============================================================================
// Pareto-Optimal Content Selection
// ============================================================================

/**
 * Calculate multi-objective scores for content
 */
export function calculateContentObjectives(
  content: Content,
  studentId: string
): ContentWithObjectives {
  const proficiency = getSkillProficiency(content.stat_name);
  const stateVector = getStateVector(content.stat_name, studentId);

  // 1. Learning Gain: Expected proficiency improvement
  const skillGap = Math.max(0, content.difficulty - proficiency.level);
  const optimalGap = 15;
  const gapPenalty = Math.abs(skillGap - optimalGap) / 100;
  const learning_gain = Math.max(0, Math.min(100, 80 * (1 - gapPenalty)));

  // 2. Engagement: Predicted student engagement
  const challengeBalance = 1 - Math.abs(content.difficulty - proficiency.level) / 100;
  const generativityBoost = (stateVector?.generativity || 50) / 100;
  const engagement_score = Math.min(100, (challengeBalance * 60 + generativityBoost * 40));

  // 3. Efficiency: Knowledge gain per unit time
  const baseEfficiency = learning_gain / Math.max(1, content.estimated_time_minutes);
  const efficiency_score = Math.min(100, baseEfficiency * 10);

  // 4. Transfer Potential
  const difficultyFactor = content.difficulty / 100;
  const transfer_potential = Math.min(
    100,
    ((stateVector?.generativity || 50) * 0.6 + difficultyFactor * 40)
  );

  return {
    ...content,
    learning_gain,
    engagement_score,
    efficiency_score,
    transfer_potential,
  };
}

function dominates(a: ContentWithObjectives, b: ContentWithObjectives): boolean {
  const aScores = [a.learning_gain, a.engagement_score, a.efficiency_score, a.transfer_potential];
  const bScores = [b.learning_gain, b.engagement_score, b.efficiency_score, b.transfer_potential];

  let greaterInSome = false;
  for (let i = 0; i < aScores.length; i++) {
    if (aScores[i] < bScores[i]) return false;
    if (aScores[i] > bScores[i]) greaterInSome = true;
  }
  return greaterInSome;
}

export function getParetoOptimalContent(
  studentId: string,
  candidateContent: Content[]
): ParetoFrontier {
  const contentWithObjectives = candidateContent.map(c =>
    calculateContentObjectives(c, studentId)
  );

  const paretoGraph: ParetoPoint[] = contentWithObjectives.map(content => ({
    content,
    dominates: [],
    dominated_by: [],
    is_pareto_optimal: true,
  }));

  for (let i = 0; i < paretoGraph.length; i++) {
    for (let j = 0; j < paretoGraph.length; j++) {
      if (i === j) continue;
      if (dominates(paretoGraph[i].content, paretoGraph[j].content)) {
        paretoGraph[i].dominates.push(paretoGraph[j].content.id);
        paretoGraph[j].dominated_by.push(paretoGraph[i].content.id);
        paretoGraph[j].is_pareto_optimal = false;
      }
    }
  }

  const optimal_content = paretoGraph.filter(p => p.is_pareto_optimal).map(p => p.content);
  const dominated_content = paretoGraph.filter(p => !p.is_pareto_optimal).map(p => p.content);

  const sortBy = (arr: ContentWithObjectives[], key: keyof ContentWithObjectives) =>
    [...arr].sort((a, b) => (b[key] as number) - (a[key] as number))[0];

  const recommendation = {
    top_balanced: optimal_content.reduce((best, curr) => {
      const bestScore = best.learning_gain + best.engagement_score + best.efficiency_score + best.transfer_potential;
      const currScore = curr.learning_gain + curr.engagement_score + curr.efficiency_score + curr.transfer_potential;
      return currScore > bestScore ? curr : best;
    }, optimal_content[0]),
    top_learning: sortBy(optimal_content, 'learning_gain'),
    top_engagement: sortBy(optimal_content, 'engagement_score'),
    top_efficiency: sortBy(optimal_content, 'efficiency_score'),
  };

  return {
    optimal_content,
    dominated_content,
    pareto_graph: paretoGraph,
    recommendation,
  };
}

// ============================================================================
// Attractor-Field Clustering
// ============================================================================

function stateDistance(a: StateVector, b: StateVector): number {
  return Math.sqrt(
    Math.pow(a.coherence - b.coherence, 2) +
      Math.pow(a.entropy - b.entropy, 2) +
      Math.pow(a.generativity - b.generativity, 2)
  );
}

function calculateAttractorProbability(
  currentState: StateVector,
  attractor: Omit<AttractorField, 'id' | 'student_probability'>
): number {
  const distance = stateDistance(currentState, attractor.center);
  const sigma = attractor.radius / 2;
  const probability = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(sigma, 2)));
  return probability * attractor.strength;
}

export function clusterLearningStates(studentId: string, statName: StatName): AttractorField[] {
  const currentState = getStateVector(statName, studentId);
  if (!currentState) return [];

  const attractors = ATTRACTOR_DEFINITIONS.map(def => ({
    id: randomUUID(),
    ...def,
    student_probability: calculateAttractorProbability(currentState, def),
  }));

  return attractors.sort((a, b) => b.student_probability - a.student_probability);
}

export function detectCurrentAttractor(studentId: string, statName: StatName): AttractorField | null {
  const attractors = clusterLearningStates(studentId, statName);
  return attractors.length > 0 ? attractors[0] : null;
}

// ============================================================================
// State Transition Prediction
// ============================================================================

export function predictStateTransition(
  currentState: StateVector,
  intervention: Intervention
): StateVector {
  const nextState = { ...currentState };

  switch (intervention.type) {
    case 'content':
      nextState.coherence = Math.min(100, currentState.coherence + 3);
      nextState.generativity = Math.min(100, currentState.generativity + 1);
      nextState.entropy = Math.max(0, currentState.entropy - 1);
      break;
    case 'scaffolding':
      nextState.coherence = Math.min(100, currentState.coherence + 5);
      nextState.entropy = Math.max(0, currentState.entropy - 5);
      break;
    case 'challenge':
      nextState.entropy = Math.min(100, currentState.entropy + 5);
      nextState.generativity = Math.min(100, currentState.generativity + 3);
      break;
    case 'exploration':
      nextState.generativity = Math.min(100, currentState.generativity + 5);
      nextState.entropy = Math.min(100, currentState.entropy + 3);
      nextState.coherence = Math.max(0, currentState.coherence - 2);
      break;
    case 'rest':
      nextState.entropy = Math.max(0, currentState.entropy - 3);
      nextState.generativity = Math.min(100, currentState.generativity + 2);
      break;
  }

  return nextState;
}

export function planOptimalTrajectory(
  studentId: string,
  statName: StatName,
  targetState: StateVector
): TrajectoryPlan {
  const currentState = getStateVector(statName, studentId);
  if (!currentState) {
    throw new Error(`No state vector found for student ${studentId}, stat ${statName}`);
  }

  const deltaC = targetState.coherence - currentState.coherence;
  const deltaE = targetState.entropy - currentState.entropy;
  const deltaG = targetState.generativity - currentState.generativity;

  const steps: TrajectoryPlan['steps'] = [];
  let workingState = { ...currentState };
  let totalDuration = 0;

  const deltas = [
    { dim: 'coherence', value: Math.abs(deltaC), sign: Math.sign(deltaC) },
    { dim: 'entropy', value: Math.abs(deltaE), sign: Math.sign(deltaE) },
    { dim: 'generativity', value: Math.abs(deltaG), sign: Math.sign(deltaG) },
  ].sort((a, b) => b.value - a.value);

  for (const delta of deltas) {
    if (delta.value < 5) continue;

    let intervention: Intervention;
    let duration = 20;

    if (delta.dim === 'coherence' && delta.sign > 0) {
      intervention = { type: 'scaffolding', description: 'Structured practice to build coherence' };
      duration = 30;
    } else if (delta.dim === 'entropy' && delta.sign > 0) {
      intervention = { type: 'challenge', description: 'Challenging problems to increase entropy tolerance' };
      duration = 25;
    } else if (delta.dim === 'generativity' && delta.sign > 0) {
      intervention = { type: 'exploration', description: 'Creative transfer tasks to boost generativity' };
      duration = 30;
    } else if (delta.dim === 'entropy' && delta.sign < 0) {
      intervention = { type: 'scaffolding', description: 'Reduce cognitive load with structured support' };
      duration = 20;
    } else {
      intervention = { type: 'content', description: 'Regular content practice' };
    }

    workingState = predictStateTransition(workingState, intervention);
    totalDuration += duration;
    steps.push({ state: { ...workingState }, intervention, expected_duration_minutes: duration, confidence: 0.7 });
  }

  const finalDistance = stateDistance(workingState, targetState);
  const success_probability = Math.max(0.3, Math.min(0.95, 1 - finalDistance / 100));

  const risk_factors: string[] = [];
  if (finalDistance > 20) risk_factors.push('Large state change required');
  if (steps.length > 5) risk_factors.push('Many intervention steps needed');
  if (deltaE > 30) risk_factors.push('Significant entropy increase - may cause confusion');
  if (totalDuration > 120) risk_factors.push('Long trajectory - may lose momentum');

  return {
    current_state: currentState,
    target_state: targetState,
    steps,
    total_duration_minutes: totalDuration,
    success_probability,
    risk_factors,
  };
}

// ============================================================================
// Chart-Space Visualization Data
// ============================================================================

export function getStateHistory(
  studentId: string,
  statName: StatName,
  days: number = 30
): StateHistoryEntry[] {
  const db = getDatabase();
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - days * 86400;

  const snapshots = db
    .prepare(
      `SELECT id, ? as student_id, stat_name, proficiency_level as coherence,
       50 as entropy, 50 as generativity, evidence_count as n_items_used, created_at
       FROM hyro_proficiency_snapshots
       WHERE stat_name = ? AND created_at >= ?
       ORDER BY created_at ASC`
    )
    .all(studentId, statName, cutoffTimestamp) as StateHistoryEntry[];

  return snapshots;
}

export function getChartSpaceData(studentId: string, statName: StatName): ChartSpaceVisualization {
  const currentState = getStateVector(statName, studentId);
  const stateHistory = getStateHistory(studentId, statName, 30);
  const attractorFields = clusterLearningStates(studentId, statName);

  if (!currentState) {
    throw new Error(`No state vector found for student ${studentId}, stat ${statName}`);
  }

  return {
    student_id: studentId,
    stat_name: statName,
    current_state: currentState,
    state_history: stateHistory.map(s => ({
      timestamp: s.created_at,
      state: {
        coherence: s.coherence,
        entropy: s.entropy,
        generativity: s.generativity,
        n_items_used: s.n_items_used,
      },
    })),
    attractor_fields: attractorFields,
  };
}

export function getChartSpaceDataWithPareto(
  studentId: string,
  statName: StatName,
  candidateContent: Content[]
): ChartSpaceVisualization {
  const baseData = getChartSpaceData(studentId, statName);
  const paretoFrontier = getParetoOptimalContent(studentId, candidateContent);
  return { ...baseData, pareto_frontier: paretoFrontier };
}

export function getChartSpaceDataWithTrajectory(
  studentId: string,
  statName: StatName,
  targetState: StateVector
): ChartSpaceVisualization {
  const baseData = getChartSpaceData(studentId, statName);
  const trajectory = planOptimalTrajectory(studentId, statName, targetState);
  return { ...baseData, trajectory_projection: trajectory };
}

// ============================================================================
// Database Schema Utilities
// ============================================================================

export function initializeStateHistoryTable(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_state_history (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      stat_name TEXT NOT NULL,
      coherence REAL NOT NULL,
      entropy REAL NOT NULL,
      generativity REAL NOT NULL,
      n_items_used INTEGER NOT NULL DEFAULT 0,
      event_type TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_state_history_student_stat
    ON hyro_state_history(student_id, stat_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_state_history_created
    ON hyro_state_history(created_at)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_attractor_assignments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      stat_name TEXT NOT NULL,
      attractor_type TEXT NOT NULL,
      probability REAL NOT NULL,
      state_coherence REAL NOT NULL,
      state_entropy REAL NOT NULL,
      state_generativity REAL NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_attractor_student_stat
    ON hyro_attractor_assignments(student_id, stat_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attractor_type
    ON hyro_attractor_assignments(attractor_type)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_pareto_selections (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      stat_name TEXT NOT NULL,
      content_id TEXT NOT NULL,
      learning_gain REAL NOT NULL,
      engagement_score REAL NOT NULL,
      efficiency_score REAL NOT NULL,
      transfer_potential REAL NOT NULL,
      was_pareto_optimal INTEGER NOT NULL,
      user_selected INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_pareto_student_stat
    ON hyro_pareto_selections(student_id, stat_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pareto_content
    ON hyro_pareto_selections(content_id)`);
}

export function recordStateHistory(
  studentId: string,
  statName: StatName,
  state: StateVector,
  eventType?: string
): void {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO hyro_state_history (
      id, student_id, stat_name, coherence, entropy, generativity,
      n_items_used, event_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, studentId, statName, state.coherence, state.entropy, state.generativity,
    state.n_items_used, eventType || null
  );
}

export function recordAttractorAssignment(
  studentId: string,
  statName: StatName,
  attractor: AttractorField,
  currentState: StateVector
): void {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO hyro_attractor_assignments (
      id, student_id, stat_name, attractor_type, probability,
      state_coherence, state_entropy, state_generativity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, studentId, statName, attractor.type, attractor.student_probability,
    currentState.coherence, currentState.entropy, currentState.generativity
  );
}

export function recordParetoSelection(
  studentId: string,
  statName: StatName,
  content: ContentWithObjectives,
  isParetoOptimal: boolean,
  userSelected: boolean = false
): void {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO hyro_pareto_selections (
      id, student_id, stat_name, content_id,
      learning_gain, engagement_score, efficiency_score, transfer_potential,
      was_pareto_optimal, user_selected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, studentId, statName, content.id, content.learning_gain,
    content.engagement_score, content.efficiency_score, content.transfer_potential,
    isParetoOptimal ? 1 : 0, userSelected ? 1 : 0
  );
}
