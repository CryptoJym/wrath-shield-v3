/**
 * HYRO FORGE: Enhanced Student Profile System
 *
 * Provides comprehensive student profile management with:
 * - Multi-grade support (enrolled + inferred grades per stat)
 * - Student settings and preferences
 * - Progress tracking and summaries
 * - Integration with grade benchmarks, proficiency, and learner state
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { GradeLevel, getEffectiveGrade as getEffectiveGradeFromBenchmark } from './forge-grade-benchmarks';
import { StatName, STAT_NAMES } from './forge-types';
import { MetaGenerativeDimensions, LearnerState, findNearestAttractor } from './forge-learner-state';
import { getSkillProficiency } from './forge-proficiency';
import { getAllStandardMastery } from './education-store';

// ============================================================================
// Types
// ============================================================================

export type MetaDimensions = MetaGenerativeDimensions;

export interface StudentProfile {
  id: string;
  display_name: string;
  enrolled_grade: GradeLevel;
  inferred_grades: Record<StatName, GradeLevel>;
  grade_confidence: Record<StatName, number>;
  meta_dimensions?: MetaDimensions;
  settings: StudentSettings;
  created_at: number;
  updated_at: number;
}

export interface StudentSettings {
  preferred_difficulty: 'easy' | 'balanced' | 'challenging';
  session_duration_minutes: number;
  notification_preferences: {
    daily_reminders: boolean;
    achievement_alerts: boolean;
    parent_reports: boolean;
  };
  accessibility: {
    high_contrast: boolean;
    larger_text: boolean;
    reduced_motion: boolean;
  };
}

export interface StudentProgressSummary {
  student_id: string;
  overall_level: number;
  stats_summary: Record<StatName, {
    level: number;
    trend: 'improving' | 'stable' | 'declining';
    grade_equivalent: GradeLevel;
  }>;
  current_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  attractor_state: string;
  standards_progress: {
    total: number;
    mastered: number;
    in_progress: number;
  };
  recent_achievements: string[];
  next_recommended_action: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: StudentSettings = {
  preferred_difficulty: 'balanced',
  session_duration_minutes: 30,
  notification_preferences: {
    daily_reminders: true,
    achievement_alerts: true,
    parent_reports: true,
  },
  accessibility: {
    high_contrast: false,
    larger_text: false,
    reduced_motion: false,
  },
};

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Get or create student profile
 */
export function getStudentProfile(studentId: string): StudentProfile {
  const db = getDatabase();

  // Check if profile exists in hyro_character table
  const character = db.prepare(`
    SELECT id, display_name, enrolled_grade, created_at, updated_at
    FROM hyro_character
    WHERE id = ?
  `).get(studentId) as {
    id: string;
    display_name?: string;
    enrolled_grade?: string;
    created_at?: number;
    updated_at?: number;
  } | undefined;

  // Get inferred grades from grade inference table
  const inferences = db.prepare(`
    SELECT stat_name, inferred_grade, confidence
    FROM hyro_student_grade_inference
    WHERE student_id = ?
  `).all(studentId) as Array<{
    stat_name: string;
    inferred_grade: string;
    confidence: number;
  }>;

  const inferredGrades: Record<string, GradeLevel> = {};
  const gradeConfidence: Record<string, number> = {};

  for (const inf of inferences) {
    inferredGrades[inf.stat_name] = inf.inferred_grade as GradeLevel;
    gradeConfidence[inf.stat_name] = inf.confidence;
  }

  // Get settings
  const settingsRow = db.prepare(`
    SELECT settings FROM hyro_student_settings WHERE student_id = ?
  `).get(studentId) as { settings: string } | undefined;

  const settings = settingsRow
    ? JSON.parse(settingsRow.settings) as StudentSettings
    : DEFAULT_SETTINGS;

  // Get meta dimensions from learner state if available
  const stateRow = db.prepare(`
    SELECT meta_dimensions FROM hyro_learner_state WHERE learner_id = ?
    ORDER BY updated_at DESC LIMIT 1
  `).get(studentId) as { meta_dimensions?: string } | undefined;

  const metaDimensions = stateRow?.meta_dimensions
    ? JSON.parse(stateRow.meta_dimensions) as MetaDimensions
    : undefined;

  const enrolledGrade = (character?.enrolled_grade as GradeLevel) || '6';
  const now = Math.floor(Date.now() / 1000);

  // Fill in missing stats with enrolled grade
  for (const stat of STAT_NAMES) {
    if (!inferredGrades[stat]) {
      inferredGrades[stat] = enrolledGrade;
      gradeConfidence[stat] = 0.5; // Default confidence
    }
  }

  return {
    id: studentId,
    display_name: character?.display_name || 'Student',
    enrolled_grade: enrolledGrade,
    inferred_grades: inferredGrades as Record<StatName, GradeLevel>,
    grade_confidence: gradeConfidence as Record<StatName, number>,
    meta_dimensions: metaDimensions,
    settings,
    created_at: character?.created_at || now,
    updated_at: character?.updated_at || now,
  };
}

/**
 * Create new student profile
 */
export function createStudentProfile(
  studentId: string,
  displayName: string,
  enrolledGrade: GradeLevel
): StudentProfile {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Create character entry
  db.prepare(`
    INSERT INTO hyro_character (id, display_name, enrolled_grade, level, total_xp, created_at, updated_at)
    VALUES (?, ?, ?, 1, 0, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      enrolled_grade = excluded.enrolled_grade,
      updated_at = excluded.updated_at
  `).run(studentId, displayName, enrolledGrade, now, now);

  // Create default settings
  db.prepare(`
    INSERT INTO hyro_student_settings (student_id, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(student_id) DO NOTHING
  `).run(studentId, JSON.stringify(DEFAULT_SETTINGS), now, now);

  return getStudentProfile(studentId);
}

/**
 * Update student profile
 */
export function updateStudentProfile(
  studentId: string,
  updates: Partial<StudentProfile>
): StudentProfile {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Update character table if display_name or enrolled_grade changed
  if (updates.display_name !== undefined || updates.enrolled_grade !== undefined) {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.display_name !== undefined) {
      setClauses.push('display_name = ?');
      values.push(updates.display_name);
    }
    if (updates.enrolled_grade !== undefined) {
      setClauses.push('enrolled_grade = ?');
      values.push(updates.enrolled_grade);
    }

    setClauses.push('updated_at = ?');
    values.push(now);
    values.push(studentId);

    db.prepare(`
      UPDATE hyro_character
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `).run(...values);
  }

  // Update settings if provided
  if (updates.settings !== undefined) {
    db.prepare(`
      INSERT INTO hyro_student_settings (student_id, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        settings = excluded.settings,
        updated_at = excluded.updated_at
    `).run(studentId, JSON.stringify(updates.settings), now, now);
  }

  return getStudentProfile(studentId);
}

/**
 * Get effective grade for a stat (uses inference if available)
 */
export function getEffectiveGrade(studentId: string, stat: StatName): GradeLevel {
  const profile = getStudentProfile(studentId);

  // Use inferred grade if confidence is high enough
  if (profile.grade_confidence[stat] >= 0.7) {
    return profile.inferred_grades[stat];
  }

  // Fall back to enrolled grade
  return profile.enrolled_grade;
}

/**
 * Update inferred grade for a stat
 */
export function updateInferredGrade(
  studentId: string,
  stat: StatName,
  inferredGrade: GradeLevel,
  confidence: number
): void {
  const db = getDatabase();
  const id = `inf_${studentId}_${stat}`;
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO hyro_student_grade_inference (
      id, student_id, stat_name, inferred_grade, confidence, evidence_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(student_id, stat_name) DO UPDATE SET
      inferred_grade = excluded.inferred_grade,
      confidence = excluded.confidence,
      evidence_count = evidence_count + 1,
      updated_at = excluded.updated_at
  `).run(id, studentId, stat, inferredGrade, confidence, now, now);
}

/**
 * Get complete progress summary
 */
export function getStudentProgressSummary(studentId: string): StudentProgressSummary {
  const profile = getStudentProfile(studentId);

  // Build stats summary
  const statsSummary: Record<string, {
    level: number;
    trend: 'improving' | 'stable' | 'declining';
    grade_equivalent: GradeLevel;
  }> = {};

  let totalLevel = 0;

  for (const stat of STAT_NAMES) {
    const proficiency = getSkillProficiency(stat);
    totalLevel += proficiency.level;

    // Determine trend from velocity
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (proficiency.velocity > 2) trend = 'improving';
    else if (proficiency.velocity < -2) trend = 'declining';

    statsSummary[stat] = {
      level: proficiency.level,
      trend,
      grade_equivalent: profile.inferred_grades[stat],
    };
  }

  const overallLevel = Math.round(totalLevel / STAT_NAMES.length);

  // Get learner state for C/E/G
  const db = getDatabase();
  const stateRow = db.prepare(`
    SELECT C, E, G FROM hyro_learner_state
    WHERE learner_id = ?
    ORDER BY updated_at DESC LIMIT 1
  `).get(studentId) as { C: number; E: number; G: number } | undefined;

  const currentState = stateRow
    ? { C: stateRow.C, E: stateRow.E, G: stateRow.G }
    : { C: 50, E: 50, G: 50 };

  // Find attractor state
  const attractor = findNearestAttractor(currentState);

  // Get standards progress
  const allMastery = getAllStandardMastery(studentId);
  const mastered = allMastery.filter(m => m.status === 'mastered').length;
  const inProgress = allMastery.filter(m => m.status === 'practicing').length;

  // Get recent achievements (last 5)
  const achievements = db.prepare(`
    SELECT name FROM hyro_achievements
    WHERE id IN (
      SELECT achievement_id FROM hyro_character_achievements
      WHERE character_id = ?
      ORDER BY earned_at DESC
      LIMIT 5
    )
  `).all(studentId) as Array<{ name: string }>;

  // Determine next recommended action based on state
  let nextRecommendedAction = 'Continue your current learning path';

  if (attractor.attractor === 'confusion') {
    nextRecommendedAction = 'Review foundational concepts to build clarity';
  } else if (attractor.attractor === 'boredom') {
    nextRecommendedAction = 'Try a more challenging activity to spark engagement';
  } else if (attractor.attractor === 'frustration') {
    nextRecommendedAction = 'Take a step back and work on scaffolding skills';
  } else if (attractor.attractor === 'discovery') {
    nextRecommendedAction = 'Explore creative projects to maximize your generative state';
  } else if (attractor.attractor === 'flow') {
    nextRecommendedAction = 'Keep going! You\'re in an optimal learning state';
  }

  return {
    student_id: studentId,
    overall_level: overallLevel,
    stats_summary: statsSummary as Record<StatName, {
      level: number;
      trend: 'improving' | 'stable' | 'declining';
      grade_equivalent: GradeLevel;
    }>,
    current_state: {
      coherence: currentState.C,
      entropy: currentState.E,
      generativity: currentState.G,
    },
    attractor_state: attractor.attractor,
    standards_progress: {
      total: allMastery.length,
      mastered,
      in_progress: inProgress,
    },
    recent_achievements: achievements.map(a => a.name),
    next_recommended_action: nextRecommendedAction,
  };
}

/**
 * Get student settings
 */
export function getStudentSettings(studentId: string): StudentSettings {
  const profile = getStudentProfile(studentId);
  return profile.settings;
}

/**
 * Update student settings
 */
export function updateStudentSettings(
  studentId: string,
  settings: Partial<StudentSettings>
): StudentSettings {
  const currentSettings = getStudentSettings(studentId);

  // Deep merge settings
  const mergedSettings: StudentSettings = {
    ...currentSettings,
    ...settings,
    notification_preferences: {
      ...currentSettings.notification_preferences,
      ...(settings.notification_preferences || {}),
    },
    accessibility: {
      ...currentSettings.accessibility,
      ...(settings.accessibility || {}),
    },
  };

  updateStudentProfile(studentId, { settings: mergedSettings });
  return mergedSettings;
}

/**
 * Check if student exists
 */
export function studentExists(studentId: string): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT id FROM hyro_character WHERE id = ?
  `).get(studentId);
  return result !== undefined;
}

/**
 * Delete student profile (for testing/cleanup)
 */
export function deleteStudentProfile(studentId: string): boolean {
  const db = getDatabase();

  try {
    db.transaction(() => {
      // Delete from all related tables
      db.prepare(`DELETE FROM hyro_student_settings WHERE student_id = ?`).run(studentId);
      db.prepare(`DELETE FROM hyro_student_grade_inference WHERE student_id = ?`).run(studentId);
      db.prepare(`DELETE FROM hyro_learner_state WHERE learner_id = ?`).run(studentId);
      db.prepare(`DELETE FROM hyro_character_achievements WHERE character_id = ?`).run(studentId);
      db.prepare(`DELETE FROM hyro_character WHERE id = ?`).run(studentId);
    })();

    return true;
  } catch (error) {
    console.error('Error deleting student profile:', error);
    return false;
  }
}

/**
 * Get all students (for admin/parent dashboard)
 */
export function getAllStudents(limit?: number): StudentProfile[] {
  const db = getDatabase();

  let sql = `
    SELECT id, display_name, enrolled_grade, created_at, updated_at
    FROM hyro_character
    ORDER BY created_at DESC
  `;

  if (limit) {
    sql += ` LIMIT ${limit}`;
  }

  const characters = db.prepare(sql).all() as Array<{
    id: string;
    display_name: string;
    enrolled_grade?: string;
    created_at: number;
    updated_at: number;
  }>;

  return characters.map(char => getStudentProfile(char.id));
}

/**
 * Calculate overall student level (aggregate of all stats)
 */
export function calculateOverallLevel(studentId: string): number {
  let totalLevel = 0;

  for (const stat of STAT_NAMES) {
    const proficiency = getSkillProficiency(stat);
    totalLevel += proficiency.level;
  }

  return Math.round(totalLevel / STAT_NAMES.length);
}

// ============================================================================
// Database Schema Initialization
// ============================================================================

/**
 * Initialize student profile tables
 * This should be called during app initialization or migration
 */
export function initializeStudentProfileTables(): void {
  const db = getDatabase();

  // Create student settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_student_settings (
      student_id TEXT PRIMARY KEY,
      settings TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  console.log('[Student Profile] Tables initialized');
}
