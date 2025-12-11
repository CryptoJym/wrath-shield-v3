/**
 * HYRO FORGE: ULTRA-EDGE - Stats Management System
 * Character stats, spider graph data, and stat history tracking
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import type {
  Stat,
  StatName,
  StatWithTrend,
  Character,
  CharacterSheet,
  SpiderGraphData,
  StatUpdateResult,
  Achievement,
} from './forge-types';
import { getLevelProgress, getTitleForLevel } from './forge-xp';

// 6th grade benchmarks for spider graph comparison
const GRADE_6_BENCHMARKS: Record<StatName, number> = {
  math: 50,
  reading: 50,
  science: 40,
  coding: 45,
  study_skills: 35,
  critical_thinking: 40,
  technology: 30,
  problem_solving: 40,
};

// ============================================================================
// CHARACTER FUNCTIONS
// ============================================================================

/**
 * Get character profile for a student
 */
export function getCharacter(studentId: string = 'hyro'): Character | null {
  const db = getDatabase();

  const character = db.prepare(`
    SELECT * FROM hyro_character WHERE id = ?
  `).get(studentId) as Character | undefined;

  return character || null;
}

/**
 * Get full character sheet with stats and recent activity for a student
 */
export function getCharacterSheet(studentId: string = 'hyro'): CharacterSheet | null {
  const db = getDatabase();

  const character = getCharacter(studentId);
  if (!character) return null;

  const stats = getAllStatsWithTrend(studentId);
  const levelProgress = getLevelProgress(character.total_xp);

  // Get recent achievements
  const recentAchievements = db.prepare(`
    SELECT a.*, ea.earned_at
    FROM hyro_achievements a
    JOIN hyro_earned_achievements ea ON a.id = ea.achievement_id
    ORDER BY ea.earned_at DESC
    LIMIT 5
  `).all() as Achievement[];

  // Get active quests
  const activeQuests = db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ? AND status IN ('available', 'in_progress')
    ORDER BY due_at ASC NULLS LAST, created_at DESC
    LIMIT 5
  `).all(studentId);

  return {
    ...character,
    stats,
    xp_to_next_level: levelProgress.xp_for_next_level - levelProgress.xp_in_level,
    xp_progress_percent: levelProgress.progress_percent,
    recent_achievements: recentAchievements,
    active_quests: activeQuests as CharacterSheet['active_quests'],
  };
}

// ============================================================================
// STAT FUNCTIONS
// ============================================================================

/**
 * Get all stats for a student
 */
export function getAllStats(studentId: string = 'hyro'): Stat[] {
  const db = getDatabase();

  return db.prepare(`
    SELECT * FROM hyro_stats WHERE student_id = ? ORDER BY stat_name
  `).all(studentId) as Stat[];
}

/**
 * Get a single stat by name for a student
 */
export function getStat(statName: StatName, studentId: string = 'hyro'): Stat | null {
  const db = getDatabase();

  const stat = db.prepare(`
    SELECT * FROM hyro_stats WHERE stat_name = ? AND student_id = ?
  `).get(statName, studentId) as Stat | undefined;

  return stat || null;
}

/**
 * Get all stats with trend information (for spider graph) for a student
 */
export function getAllStatsWithTrend(studentId: string = 'hyro'): StatWithTrend[] {
  const db = getDatabase();

  const stats = getAllStats(studentId);
  const weekAgo = Math.floor(Date.now() / 1000) - (7 * 86400);

  return stats.map(stat => {
    // Get 7-day change
    const history = db.prepare(`
      SELECT old_value, new_value FROM hyro_stat_history
      WHERE stat_name = ? AND created_at >= ?
      ORDER BY created_at ASC
    `).all(stat.stat_name, weekAgo) as { old_value: number; new_value: number }[];

    let change7d = 0;
    if (history.length > 0) {
      const startValue = history[0].old_value;
      change7d = stat.current_value - startValue;
    }

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (change7d > 2) trend = 'up';
    else if (change7d < -2) trend = 'down';

    return {
      ...stat,
      trend,
      change_7d: change7d,
      benchmark: GRADE_6_BENCHMARKS[stat.stat_name as StatName] || 50,
    };
  });
}

/**
 * Update a stat value for a student
 */
export function updateStat(
  statName: StatName,
  newValue: number,
  reason: string,
  sessionId?: string,
  studentId: string = 'hyro'
): StatUpdateResult {
  const db = getDatabase();

  const currentStat = getStat(statName, studentId);
  if (!currentStat) {
    throw new Error(`Stat not found: ${statName}`);
  }

  const clampedValue = Math.max(1, Math.min(100, newValue));
  const change = clampedValue - currentStat.current_value;

  return db.transaction(() => {
    // Record history
    db.prepare(`
      INSERT INTO hyro_stat_history (id, stat_name, old_value, new_value, change_reason, session_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      statName,
      currentStat.current_value,
      clampedValue,
      reason,
      sessionId || null
    );

    // Update stat
    db.prepare(`
      UPDATE hyro_stats
      SET current_value = ?, updated_at = unixepoch()
      WHERE stat_name = ?
    `).run(clampedValue, statName);

    // Check for stat-level achievements
    const achievementsUnlocked: Achievement[] = [];

    if (clampedValue >= 25 || clampedValue >= 50 || clampedValue >= 75) {
      const unlockedAchievements = db.prepare(`
        SELECT a.* FROM hyro_achievements a
        WHERE a.requirement_type = 'stat_level'
          AND a.requirement_stat = ?
          AND a.requirement_value <= ?
          AND a.id NOT IN (SELECT achievement_id FROM hyro_earned_achievements)
      `).all(statName, clampedValue) as Achievement[];

      for (const achievement of unlockedAchievements) {
        db.prepare(`
          INSERT INTO hyro_earned_achievements (id, achievement_id)
          VALUES (?, ?)
        `).run(randomUUID(), achievement.id);

        achievementsUnlocked.push(achievement);
      }
    }

    return {
      stat_name: statName,
      previous_value: currentStat.current_value,
      new_value: clampedValue,
      change,
      achievements_unlocked: achievementsUnlocked,
    };
  });
}

/**
 * Apply temporary modifier to a stat
 */
export function applyStatModifier(statName: StatName, modifier: number, studentId: string = 'hyro'): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_stats
    SET modifier = ?, updated_at = unixepoch()
    WHERE stat_name = ? AND student_id = ?
  `).run(modifier, statName, studentId);
}

/**
 * Clear all stat modifiers for a student
 */
export function clearStatModifiers(studentId: string = 'hyro'): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_stats SET modifier = 0, updated_at = unixepoch()
    WHERE student_id = ?
  `).run(studentId);
}

// ============================================================================
// SPIDER GRAPH DATA
// ============================================================================

/**
 * Get data formatted for Recharts RadarChart (spider graph)
 */
export function getSpiderGraphData(studentId: string = 'hyro'): SpiderGraphData {
  const stats = getAllStatsWithTrend(studentId);
  const character = getCharacter(studentId);

  // Find most recent assessment date
  let lastAssessment: string | null = null;
  for (const stat of stats) {
    if (stat.last_assessed) {
      const date = new Date(stat.last_assessed * 1000).toISOString().split('T')[0];
      if (!lastAssessment || date > lastAssessment) {
        lastAssessment = date;
      }
    }
  }

  return {
    stats: stats.map(stat => ({
      name: stat.stat_name,
      displayName: stat.display_name,
      value: stat.current_value + stat.modifier,
      benchmark: stat.benchmark,
      fullMark: 100,
    })),
    meta: {
      level: character?.level || 1,
      total_xp: character?.total_xp || 0,
      assessment_date: lastAssessment,
    },
  };
}

// ============================================================================
// STAT HISTORY & ANALYTICS
// ============================================================================

/**
 * Get stat history for a specific stat
 */
export function getStatHistory(
  statName: StatName,
  days: number = 30,
  studentId: string = 'hyro'
): Array<{
  date: string;
  value: number;
  change_reason: string;
}> {
  const db = getDatabase();

  const since = Math.floor(Date.now() / 1000) - (days * 86400);

  const history = db.prepare(`
    SELECT new_value as value, change_reason, created_at
    FROM hyro_stat_history
    WHERE stat_name = ? AND student_id = ? AND created_at >= ?
    ORDER BY created_at ASC
  `).all(statName, studentId, since) as { value: number; change_reason: string; created_at: number }[];

  return history.map(h => ({
    date: new Date(h.created_at * 1000).toISOString().split('T')[0],
    value: h.value,
    change_reason: h.change_reason,
  }));
}

/**
 * Calculate overall "power level" from all stats
 */
export function calculatePowerLevel(studentId: string = 'hyro'): {
  power_level: number;
  rank: string;
  strongest_stat: string;
  weakest_stat: string;
} {
  const stats = getAllStats(studentId);

  if (stats.length === 0) {
    return {
      power_level: 0,
      rank: 'Unranked',
      strongest_stat: 'none',
      weakest_stat: 'none',
    };
  }

  // Power level is weighted average of all stats
  const totalValue = stats.reduce((sum, s) => sum + s.current_value, 0);
  const powerLevel = Math.round(totalValue / stats.length);

  // Find strongest and weakest
  let strongest = stats[0];
  let weakest = stats[0];
  for (const stat of stats) {
    if (stat.current_value > strongest.current_value) strongest = stat;
    if (stat.current_value < weakest.current_value) weakest = stat;
  }

  // Determine rank
  let rank = 'Novice';
  if (powerLevel >= 80) rank = 'Legendary';
  else if (powerLevel >= 65) rank = 'Master';
  else if (powerLevel >= 50) rank = 'Adept';
  else if (powerLevel >= 35) rank = 'Journeyman';
  else if (powerLevel >= 20) rank = 'Apprentice';

  return {
    power_level: powerLevel,
    rank,
    strongest_stat: strongest.display_name,
    weakest_stat: weakest.display_name,
  };
}
