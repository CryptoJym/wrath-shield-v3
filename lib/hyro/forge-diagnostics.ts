/**
 * HYRO FORGE: Diagnostic Assessment System
 * Initial assessments to establish baseline, identify gaps, and target learning
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName, STAT_NAMES } from './forge-types';
import { recordSkillEvidence, EvidenceSource } from './forge-proficiency';
import { awardXP } from './forge-xp';
import { updateStat } from './forge-stats';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticTest {
  id: string;
  stat_name: StatName;
  title: string;
  description: string | null;
  version: number;
  question_count: number;
  time_limit_minutes: number;
  difficulty_curve: 'adaptive' | 'fixed' | 'progressive';
  grade_level: number;
  is_active: boolean;
}

export interface DiagnosticQuestion {
  id: string;
  test_id: string | null;
  stat_name: StatName;
  question_text: string;
  question_type: 'multiple_choice' | 'short_answer' | 'true_false' | 'fill_blank';
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
  difficulty_level: number;
  topic: string | null;
  subtopic: string | null;
  common_misconceptions: string[] | null;
  hints: string[] | null;
  time_estimate_seconds: number;
}

export interface DiagnosticSession {
  id: string;
  test_id: string | null;
  stat_name: StatName;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: number;
  completed_at: number | null;
  time_spent_seconds: number;
  questions_total: number;
  questions_answered: number;
  current_difficulty: number;
  adaptive_history: AdaptiveHistoryEntry[] | null;
}

export interface AdaptiveHistoryEntry {
  question_id: string;
  difficulty: number;
  correct: boolean;
  timestamp: number;
}

export interface DiagnosticResponse {
  id: string;
  session_id: string;
  question_id: string;
  user_answer: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  confidence_before: number | null;
  difficulty_at_time: number | null;
  hints_used: number;
}

export interface DiagnosticResult {
  id: string;
  session_id: string;
  stat_name: StatName;
  raw_score: number;
  total_questions: number;
  percentage_score: number;
  estimated_level: number;
  confidence_low: number | null;
  confidence_high: number | null;
  identified_gaps: SkillGap[];
  strong_areas: string[];
  recommended_focus: string[];
  topic_breakdown: Record<string, { correct: number; total: number; level: number }>;
  calibration_data: CalibrationData | null;
  time_spent_seconds: number | null;
  completed_at: number;
}

export interface SkillGap {
  id: string;
  stat_name: StatName;
  topic: string;
  subtopic: string | null;
  gap_severity: 'minor' | 'moderate' | 'significant' | 'critical';
  current_level: number | null;
  target_level: number;
  status: 'active' | 'in_progress' | 'resolved';
}

export interface CalibrationData {
  self_predictions: number[];
  actual_results: number[];
  average_error: number;
  tendency: 'overconfident' | 'underconfident' | 'well_calibrated';
}

export interface QuestionWithAnswer extends DiagnosticQuestion {
  user_answer?: string;
  is_correct?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// IRT-style difficulty adjustment parameters
const ADAPTIVE_STEP_UP = 0.15;    // Increase difficulty after correct answer
const ADAPTIVE_STEP_DOWN = 0.20; // Decrease difficulty after wrong answer
const MIN_DIFFICULTY = 0.1;
const MAX_DIFFICULTY = 0.95;

// Level estimation constants
const BASE_LEVEL = 50;
const DIFFICULTY_WEIGHT = 0.4;   // How much difficulty affects level estimate
const ACCURACY_WEIGHT = 0.6;     // How much accuracy affects level estimate

// ============================================================================
// Test & Session Management
// ============================================================================

/**
 * Get all available diagnostic tests
 */
export function getAvailableTests(): DiagnosticTest[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM hyro_diagnostic_tests
    WHERE is_active = 1
    ORDER BY stat_name
  `).all();

  return rows.map(parseTest);
}

/**
 * Get a specific diagnostic test
 */
export function getTest(testId: string): DiagnosticTest | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM hyro_diagnostic_tests WHERE id = ?
  `).get(testId);

  return row ? parseTest(row) : null;
}

/**
 * Get test for a specific stat
 */
export function getTestForStat(statName: StatName): DiagnosticTest | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM hyro_diagnostic_tests
    WHERE stat_name = ? AND is_active = 1
    LIMIT 1
  `).get(statName);

  return row ? parseTest(row) : null;
}

/**
 * Check if user has completed initial diagnostics
 */
export function hasCompletedInitialDiagnostics(): boolean {
  const db = getDatabase();

  // Check how many stats have completed diagnostics
  const completed = db.prepare(`
    SELECT COUNT(DISTINCT stat_name) as count
    FROM hyro_diagnostic_results
  `).get() as { count: number };

  return completed.count >= STAT_NAMES.length;
}

/**
 * Get stats that need initial diagnostic
 */
export function getStatsNeedingDiagnostic(): StatName[] {
  const db = getDatabase();

  const completed = db.prepare(`
    SELECT DISTINCT stat_name FROM hyro_diagnostic_results
  `).all() as { stat_name: string }[];

  const completedSet = new Set(completed.map(r => r.stat_name));

  return STAT_NAMES.filter(stat => !completedSet.has(stat));
}

/**
 * Start a new diagnostic session
 */
export function startDiagnosticSession(statName: StatName): DiagnosticSession {
  const db = getDatabase();
  const test = getTestForStat(statName);

  // Check for abandoned session
  const existingSession = db.prepare(`
    SELECT * FROM hyro_diagnostic_sessions
    WHERE stat_name = ? AND status = 'in_progress'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(statName) as Record<string, unknown> | undefined;

  if (existingSession) {
    return parseSession(existingSession);
  }

  const id = randomUUID();
  const questionCount = test?.question_count || 15;

  db.prepare(`
    INSERT INTO hyro_diagnostic_sessions (
      id, test_id, stat_name, questions_total, current_difficulty
    ) VALUES (?, ?, ?, ?, ?)
  `).run(id, test?.id || null, statName, questionCount, 0.5);

  const session = db.prepare(`
    SELECT * FROM hyro_diagnostic_sessions WHERE id = ?
  `).get(id);

  return parseSession(session);
}

/**
 * Get current session for a stat
 */
export function getCurrentSession(statName: StatName): DiagnosticSession | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT * FROM hyro_diagnostic_sessions
    WHERE stat_name = ? AND status = 'in_progress'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(statName);

  return row ? parseSession(row) : null;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): DiagnosticSession | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT * FROM hyro_diagnostic_sessions WHERE id = ?
  `).get(sessionId);

  return row ? parseSession(row) : null;
}

// ============================================================================
// Question Selection (Adaptive)
// ============================================================================

/**
 * Get the next question for a session (adaptive difficulty)
 */
export function getNextQuestion(sessionId: string): DiagnosticQuestion | null {
  const db = getDatabase();
  const session = getSession(sessionId);

  if (!session || session.status !== 'in_progress') {
    return null;
  }

  // Check if session is complete
  if (session.questions_answered >= session.questions_total) {
    return null;
  }

  // Get already answered question IDs
  const answered = db.prepare(`
    SELECT question_id FROM hyro_diagnostic_responses
    WHERE session_id = ?
  `).all(sessionId) as { question_id: string }[];

  const answeredIds = answered.map(r => r.question_id);

  // Find questions at target difficulty
  const targetDifficulty = session.current_difficulty;
  const difficultyRange = 0.2;

  // Build query with exclusions
  let query = `
    SELECT * FROM hyro_diagnostic_questions
    WHERE stat_name = ?
      AND is_active = 1
      AND difficulty_level BETWEEN ? AND ?
  `;

  const params: (string | number)[] = [
    session.stat_name,
    Math.max(0, targetDifficulty - difficultyRange),
    Math.min(1, targetDifficulty + difficultyRange),
  ];

  if (answeredIds.length > 0) {
    query += ` AND id NOT IN (${answeredIds.map(() => '?').join(',')})`;
    params.push(...answeredIds);
  }

  query += ' ORDER BY ABS(difficulty_level - ?) LIMIT 1';
  params.push(targetDifficulty);

  let row = db.prepare(query).get(...params);

  // If no questions at target difficulty, get any unanswered question
  if (!row) {
    let fallbackQuery = `
      SELECT * FROM hyro_diagnostic_questions
      WHERE stat_name = ? AND is_active = 1
    `;
    const fallbackParams: (string | number)[] = [session.stat_name];

    if (answeredIds.length > 0) {
      fallbackQuery += ` AND id NOT IN (${answeredIds.map(() => '?').join(',')})`;
      fallbackParams.push(...answeredIds);
    }

    fallbackQuery += ' ORDER BY difficulty_level LIMIT 1';
    row = db.prepare(fallbackQuery).get(...fallbackParams);
  }

  return row ? parseQuestion(row) : null;
}

/**
 * Get all questions answered in a session
 */
export function getSessionQuestions(sessionId: string): QuestionWithAnswer[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT q.*, r.user_answer, r.is_correct
    FROM hyro_diagnostic_responses r
    JOIN hyro_diagnostic_questions q ON q.id = r.question_id
    WHERE r.session_id = ?
    ORDER BY r.created_at ASC
  `).all(sessionId);

  return rows.map(row => ({
    ...parseQuestion(row),
    user_answer: row.user_answer as string | undefined,
    is_correct: row.is_correct === 1 ? true : row.is_correct === 0 ? false : undefined,
  }));
}

// ============================================================================
// Answer Recording & Adaptive Adjustment
// ============================================================================

/**
 * Record an answer and adjust difficulty
 */
export function recordAnswer(params: {
  session_id: string;
  question_id: string;
  user_answer: string;
  time_spent_seconds?: number;
  confidence_before?: number;
}): {
  is_correct: boolean;
  explanation: string | null;
  new_difficulty: number;
  questions_remaining: number;
} {
  const db = getDatabase();
  const session = getSession(params.session_id);

  if (!session || session.status !== 'in_progress') {
    throw new Error('Session not found or already completed');
  }

  // Get question and check answer
  const question = db.prepare(`
    SELECT * FROM hyro_diagnostic_questions WHERE id = ?
  `).get(params.question_id) as Record<string, unknown>;

  if (!question) {
    throw new Error('Question not found');
  }

  const parsedQuestion = parseQuestion(question);
  const isCorrect = normalizeAnswer(params.user_answer) === normalizeAnswer(parsedQuestion.correct_answer);

  // Calculate new difficulty (adaptive algorithm)
  let newDifficulty = session.current_difficulty;
  if (isCorrect) {
    newDifficulty = Math.min(MAX_DIFFICULTY, session.current_difficulty + ADAPTIVE_STEP_UP);
  } else {
    newDifficulty = Math.max(MIN_DIFFICULTY, session.current_difficulty - ADAPTIVE_STEP_DOWN);
  }

  const responseId = randomUUID();

  return db.transaction(() => {
    // Record response
    db.prepare(`
      INSERT INTO hyro_diagnostic_responses (
        id, session_id, question_id, user_answer, is_correct,
        time_spent_seconds, confidence_before, difficulty_at_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      responseId,
      params.session_id,
      params.question_id,
      params.user_answer,
      isCorrect ? 1 : 0,
      params.time_spent_seconds || null,
      params.confidence_before || null,
      session.current_difficulty
    );

    // Update adaptive history
    const history: AdaptiveHistoryEntry[] = session.adaptive_history || [];
    history.push({
      question_id: params.question_id,
      difficulty: session.current_difficulty,
      correct: isCorrect,
      timestamp: Math.floor(Date.now() / 1000),
    });

    // Update session
    db.prepare(`
      UPDATE hyro_diagnostic_sessions
      SET questions_answered = questions_answered + 1,
          current_difficulty = ?,
          adaptive_history = ?,
          time_spent_seconds = time_spent_seconds + ?
      WHERE id = ?
    `).run(
      newDifficulty,
      JSON.stringify(history),
      params.time_spent_seconds || 0,
      params.session_id
    );

    const questionsRemaining = session.questions_total - session.questions_answered - 1;

    return {
      is_correct: isCorrect,
      explanation: parsedQuestion.explanation,
      new_difficulty: newDifficulty,
      questions_remaining: Math.max(0, questionsRemaining),
    };
  });
}

// ============================================================================
// Session Completion & Results
// ============================================================================

/**
 * Complete a diagnostic session and calculate results
 */
export function completeDiagnosticSession(sessionId: string): DiagnosticResult {
  const db = getDatabase();
  const session = getSession(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  // Get all responses
  const responses = db.prepare(`
    SELECT r.*, q.difficulty_level, q.topic, q.subtopic
    FROM hyro_diagnostic_responses r
    JOIN hyro_diagnostic_questions q ON q.id = r.question_id
    WHERE r.session_id = ?
  `).all(sessionId) as Array<{
    is_correct: number;
    difficulty_level: number;
    topic: string | null;
    subtopic: string | null;
    confidence_before: number | null;
  }>;

  if (responses.length === 0) {
    throw new Error('No responses recorded');
  }

  // Calculate scores
  const correctCount = responses.filter(r => r.is_correct === 1).length;
  const percentageScore = (correctCount / responses.length) * 100;

  // Calculate estimated level using IRT-inspired approach
  // Higher difficulty questions answered correctly = higher level
  const weightedScore = responses.reduce((sum, r) => {
    const difficultyBonus = r.is_correct ? r.difficulty_level : 0;
    return sum + difficultyBonus;
  }, 0);

  const averageDifficultyCorrect = correctCount > 0 ? weightedScore / correctCount : 0;
  const estimatedLevel = Math.round(
    BASE_LEVEL +
    (averageDifficultyCorrect * 50 * DIFFICULTY_WEIGHT) +
    ((percentageScore - 50) * ACCURACY_WEIGHT)
  );

  const clampedLevel = Math.max(10, Math.min(95, estimatedLevel));

  // Calculate confidence interval (simplified)
  const sampleSize = responses.length;
  const standardError = Math.sqrt((clampedLevel * (100 - clampedLevel)) / sampleSize);
  const confidenceLow = Math.round(Math.max(5, clampedLevel - 1.96 * standardError));
  const confidenceHigh = Math.round(Math.min(95, clampedLevel + 1.96 * standardError));

  // Calculate topic breakdown
  const topicBreakdown: Record<string, { correct: number; total: number; level: number }> = {};
  for (const r of responses) {
    const topic = r.topic || 'general';
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = { correct: 0, total: 0, level: 0 };
    }
    topicBreakdown[topic].total++;
    if (r.is_correct === 1) {
      topicBreakdown[topic].correct++;
    }
  }

  // Calculate topic levels
  for (const topic of Object.keys(topicBreakdown)) {
    const { correct, total } = topicBreakdown[topic];
    topicBreakdown[topic].level = Math.round((correct / total) * 100);
  }

  // Identify skill gaps
  const identifiedGaps: SkillGap[] = [];
  const strongAreas: string[] = [];

  for (const [topic, data] of Object.entries(topicBreakdown)) {
    if (data.level < 50 && data.total >= 2) {
      const gap: SkillGap = {
        id: randomUUID(),
        stat_name: session.stat_name,
        topic,
        subtopic: null,
        gap_severity: data.level < 25 ? 'critical' : data.level < 40 ? 'significant' : 'moderate',
        current_level: data.level,
        target_level: 70,
        status: 'active',
      };
      identifiedGaps.push(gap);
    } else if (data.level >= 75) {
      strongAreas.push(topic);
    }
  }

  // Calculate calibration data
  const responsesWithConfidence = responses.filter(r => r.confidence_before !== null);
  let calibrationData: CalibrationData | null = null;

  if (responsesWithConfidence.length >= 3) {
    const predictions = responsesWithConfidence.map(r => (r.confidence_before || 3) * 20);
    const actual = responsesWithConfidence.map(r => r.is_correct ? 100 : 0);
    const errors = predictions.map((p, i) => Math.abs(p - actual[i]));
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const avgActual = actual.reduce((a, b) => a + b, 0) / actual.length;

    calibrationData = {
      self_predictions: predictions,
      actual_results: actual,
      average_error: avgError,
      tendency: avgPrediction > avgActual + 10 ? 'overconfident' :
                avgPrediction < avgActual - 10 ? 'underconfident' : 'well_calibrated',
    };
  }

  // Recommended focus areas (lowest performing topics)
  const recommendedFocus = Object.entries(topicBreakdown)
    .sort((a, b) => a[1].level - b[1].level)
    .slice(0, 3)
    .map(([topic]) => topic);

  const resultId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  return db.transaction(() => {
    // Save result
    db.prepare(`
      INSERT INTO hyro_diagnostic_results (
        id, session_id, stat_name, raw_score, total_questions, percentage_score,
        estimated_level, confidence_low, confidence_high, identified_gaps,
        strong_areas, recommended_focus, topic_breakdown, calibration_data,
        time_spent_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      resultId,
      sessionId,
      session.stat_name,
      correctCount,
      responses.length,
      percentageScore,
      clampedLevel,
      confidenceLow,
      confidenceHigh,
      JSON.stringify(identifiedGaps),
      JSON.stringify(strongAreas),
      JSON.stringify(recommendedFocus),
      JSON.stringify(topicBreakdown),
      calibrationData ? JSON.stringify(calibrationData) : null,
      session.time_spent_seconds
    );

    // Update session status
    db.prepare(`
      UPDATE hyro_diagnostic_sessions
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).run(now, sessionId);

    // Save skill gaps to database
    for (const gap of identifiedGaps) {
      db.prepare(`
        INSERT INTO hyro_skill_gaps (
          id, stat_name, topic, subtopic, gap_severity,
          current_level, target_level, identified_from, source_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        gap.id,
        gap.stat_name,
        gap.topic,
        gap.subtopic,
        gap.gap_severity,
        gap.current_level,
        gap.target_level,
        'diagnostic',
        resultId
      );
    }

    // Record skill evidence
    recordSkillEvidence({
      stat_name: session.stat_name,
      source_type: 'assessment' as EvidenceSource,
      source_id: resultId,
      performance_score: clampedLevel,
      difficulty_level: session.current_difficulty,
    });

    // Update the stat based on diagnostic
    updateStat(session.stat_name, clampedLevel, 'Diagnostic assessment result', sessionId);

    // Award XP for completing diagnostic
    awardXP({
      amount: 50,
      source: 'achievement',
      source_id: resultId,
      notes: `Completed ${session.stat_name} diagnostic assessment`,
    });

    return {
      id: resultId,
      session_id: sessionId,
      stat_name: session.stat_name,
      raw_score: correctCount,
      total_questions: responses.length,
      percentage_score: percentageScore,
      estimated_level: clampedLevel,
      confidence_low: confidenceLow,
      confidence_high: confidenceHigh,
      identified_gaps: identifiedGaps,
      strong_areas: strongAreas,
      recommended_focus: recommendedFocus,
      topic_breakdown: topicBreakdown,
      calibration_data: calibrationData,
      time_spent_seconds: session.time_spent_seconds,
      completed_at: now,
    };
  });
}

/**
 * Get latest diagnostic result for a stat
 */
export function getLatestResult(statName: StatName): DiagnosticResult | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT * FROM hyro_diagnostic_results
    WHERE stat_name = ?
    ORDER BY completed_at DESC
    LIMIT 1
  `).get(statName);

  return row ? parseResult(row) : null;
}

/**
 * Get all diagnostic results
 */
export function getAllResults(): DiagnosticResult[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT * FROM hyro_diagnostic_results
    ORDER BY completed_at DESC
  `).all();

  return rows.map(parseResult);
}

// ============================================================================
// Skill Gaps
// ============================================================================

/**
 * Get all active skill gaps
 */
export function getActiveSkillGaps(statName?: StatName): SkillGap[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM hyro_skill_gaps
    WHERE status = 'active'
  `;
  const params: string[] = [];

  if (statName) {
    query += ' AND stat_name = ?';
    params.push(statName);
  }

  query += ' ORDER BY gap_severity DESC, created_at DESC';

  const rows = db.prepare(query).all(...params);
  return rows.map(parseSkillGap);
}

/**
 * Update skill gap status
 */
export function updateSkillGapStatus(gapId: string, status: 'active' | 'in_progress' | 'resolved'): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_skill_gaps
    SET status = ?,
        resolved_at = CASE WHEN ? = 'resolved' THEN unixepoch() ELSE NULL END
    WHERE id = ?
  `).run(status, status, gapId);
}

// ============================================================================
// Diagnostic Overview
// ============================================================================

/**
 * Get diagnostic overview for all stats
 */
export function getDiagnosticOverview(): Array<{
  stat_name: StatName;
  has_diagnostic: boolean;
  latest_level: number | null;
  confidence_interval: [number, number] | null;
  gaps_count: number;
  last_assessed: number | null;
}> {
  const db = getDatabase();

  return STAT_NAMES.map(statName => {
    const result = getLatestResult(statName);
    const gaps = getActiveSkillGaps(statName);

    return {
      stat_name: statName,
      has_diagnostic: result !== null,
      latest_level: result?.estimated_level || null,
      confidence_interval: result ? [result.confidence_low || 0, result.confidence_high || 100] : null,
      gaps_count: gaps.length,
      last_assessed: result?.completed_at || null,
    };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

function parseTest(row: unknown): DiagnosticTest {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    stat_name: r.stat_name as StatName,
    title: r.title as string,
    description: r.description as string | null,
    version: r.version as number,
    question_count: r.question_count as number,
    time_limit_minutes: r.time_limit_minutes as number,
    difficulty_curve: r.difficulty_curve as 'adaptive' | 'fixed' | 'progressive',
    grade_level: r.grade_level as number,
    is_active: r.is_active === 1,
  };
}

function parseQuestion(row: unknown): DiagnosticQuestion {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    test_id: r.test_id as string | null,
    stat_name: r.stat_name as StatName,
    question_text: r.question_text as string,
    question_type: r.question_type as DiagnosticQuestion['question_type'],
    options: r.options ? JSON.parse(r.options as string) : null,
    correct_answer: r.correct_answer as string,
    explanation: r.explanation as string | null,
    difficulty_level: r.difficulty_level as number,
    topic: r.topic as string | null,
    subtopic: r.subtopic as string | null,
    common_misconceptions: r.common_misconceptions ? JSON.parse(r.common_misconceptions as string) : null,
    hints: r.hints ? JSON.parse(r.hints as string) : null,
    time_estimate_seconds: r.time_estimate_seconds as number,
  };
}

function parseSession(row: unknown): DiagnosticSession {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    test_id: r.test_id as string | null,
    stat_name: r.stat_name as StatName,
    status: r.status as DiagnosticSession['status'],
    started_at: r.started_at as number,
    completed_at: r.completed_at as number | null,
    time_spent_seconds: r.time_spent_seconds as number,
    questions_total: r.questions_total as number,
    questions_answered: r.questions_answered as number,
    current_difficulty: r.current_difficulty as number,
    adaptive_history: r.adaptive_history ? JSON.parse(r.adaptive_history as string) : null,
  };
}

function parseResult(row: unknown): DiagnosticResult {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    session_id: r.session_id as string,
    stat_name: r.stat_name as StatName,
    raw_score: r.raw_score as number,
    total_questions: r.total_questions as number,
    percentage_score: r.percentage_score as number,
    estimated_level: r.estimated_level as number,
    confidence_low: r.confidence_low as number | null,
    confidence_high: r.confidence_high as number | null,
    identified_gaps: r.identified_gaps ? JSON.parse(r.identified_gaps as string) : [],
    strong_areas: r.strong_areas ? JSON.parse(r.strong_areas as string) : [],
    recommended_focus: r.recommended_focus ? JSON.parse(r.recommended_focus as string) : [],
    topic_breakdown: r.topic_breakdown ? JSON.parse(r.topic_breakdown as string) : {},
    calibration_data: r.calibration_data ? JSON.parse(r.calibration_data as string) : null,
    time_spent_seconds: r.time_spent_seconds as number | null,
    completed_at: r.completed_at as number,
  };
}

function parseSkillGap(row: unknown): SkillGap {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    stat_name: r.stat_name as StatName,
    topic: r.topic as string,
    subtopic: r.subtopic as string | null,
    gap_severity: r.gap_severity as SkillGap['gap_severity'],
    current_level: r.current_level as number | null,
    target_level: r.target_level as number,
    status: r.status as SkillGap['status'],
  };
}
