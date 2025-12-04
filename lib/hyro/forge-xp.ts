/**
 * HYRO FORGE: ULTRA-EDGE - XP and Leveling System
 * Implements Grok's nonlinear XP progression formula
 */

import { getDatabase } from '@/lib/db/Database';
import { LEVEL_TITLES, type XPSource, type Achievement, type XPAwardResult } from './forge-types';
import { randomUUID } from 'crypto';

// ============================================================================
// XP CALCULATION FORMULAS
// ============================================================================

/**
 * Calculate XP needed for a given level using Grok's formula:
 * xp_needed = 100 * (level ** 1.5)
 *
 * Level 1: 100 XP
 * Level 5: 559 XP
 * Level 10: 3,162 XP
 * Level 20: 17,889 XP
 * Level 50: 176,777 XP
 */
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calculate cumulative XP needed to reach a level
 */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Calculate current level from total XP
 */
export function calculateLevel(totalXp: number): number {
  let level = 1;
  let xpNeeded = xpForLevel(level);
  let cumulative = 0;

  while (cumulative + xpNeeded <= totalXp) {
    cumulative += xpNeeded;
    level++;
    xpNeeded = xpForLevel(level);
  }

  return level;
}

/**
 * Get XP progress within current level
 */
export function getLevelProgress(totalXp: number): {
  level: number;
  xp_in_level: number;
  xp_for_next_level: number;
  progress_percent: number;
} {
  const level = calculateLevel(totalXp);

  // Calculate XP at start of current level
  let xpAtLevelStart = 0;
  for (let i = 1; i < level; i++) {
    xpAtLevelStart += xpForLevel(i);
  }

  const xpInLevel = totalXp - xpAtLevelStart;
  const xpForNextLevel = xpForLevel(level);
  const progressPercent = Math.min(100, (xpInLevel / xpForNextLevel) * 100);

  return {
    level,
    xp_in_level: xpInLevel,
    xp_for_next_level: xpForNextLevel,
    progress_percent: Math.round(progressPercent * 10) / 10,
  };
}

/**
 * Get title for a given level
 */
export function getTitleForLevel(level: number): string {
  const thresholds = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (level >= threshold) {
      return LEVEL_TITLES[threshold];
    }
  }

  return LEVEL_TITLES[1];
}

// ============================================================================
// XP AWARD FUNCTIONS
// ============================================================================

/**
 * Award XP to Hyro and handle level-ups
 */
export function awardXP(
  amount: number,
  source: XPSource,
  sourceId?: string,
  multiplier: number = 1.0,
  notes?: string
): XPAwardResult {
  const db = getDatabase();

  // Get current character state
  const character = db.prepare(`
    SELECT * FROM hyro_character WHERE id = 'hyro'
  `).get() as { total_xp: number; level: number; title: string } | undefined;

  if (!character) {
    throw new Error('Character not initialized');
  }

  const previousXp = character.total_xp;
  const previousLevel = character.level;
  const awardedXp = Math.floor(amount * multiplier);
  const newTotalXp = previousXp + awardedXp;
  const newLevel = calculateLevel(newTotalXp);
  const levelUp = newLevel > previousLevel;
  const newTitle = levelUp ? getTitleForLevel(newLevel) : null;

  // Execute in transaction (wrapper's transaction() executes immediately)
  return db.transaction(() => {
    // Log XP transaction
    db.prepare(`
      INSERT INTO hyro_xp_log (id, amount, source, source_id, multiplier, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), awardedXp, source, sourceId || null, multiplier, notes || null);

    // Update character XP and level
    if (levelUp) {
      db.prepare(`
        UPDATE hyro_character
        SET total_xp = ?, level = ?, title = ?, updated_at = unixepoch()
        WHERE id = 'hyro'
      `).run(newTotalXp, newLevel, newTitle);
    } else {
      db.prepare(`
        UPDATE hyro_character
        SET total_xp = ?, updated_at = unixepoch()
        WHERE id = 'hyro'
      `).run(newTotalXp);
    }

    // Check for achievements
    const achievementsUnlocked: Achievement[] = [];

    // Check level-based achievements
    const levelAchievements = db.prepare(`
      SELECT a.* FROM hyro_achievements a
      WHERE a.requirement_type = 'stat_level'
        AND a.requirement_value <= ?
        AND a.id NOT IN (SELECT achievement_id FROM hyro_earned_achievements)
    `).all(newLevel) as Achievement[];

    for (const achievement of levelAchievements) {
      db.prepare(`
        INSERT INTO hyro_earned_achievements (id, achievement_id)
        VALUES (?, ?)
      `).run(randomUUID(), achievement.id);

      // Award bonus XP (recursive but won't trigger more achievements)
      if (achievement.xp_bonus > 0) {
        db.prepare(`
          INSERT INTO hyro_xp_log (id, amount, source, source_id, notes)
          VALUES (?, ?, 'achievement', ?, ?)
        `).run(randomUUID(), achievement.xp_bonus, achievement.id, `Achievement: ${achievement.name}`);

        db.prepare(`
          UPDATE hyro_character SET total_xp = total_xp + ? WHERE id = 'hyro'
        `).run(achievement.xp_bonus);
      }

      achievementsUnlocked.push(achievement);
    }

    return {
      previous_xp: previousXp,
      awarded_xp: awardedXp,
      new_total: newTotalXp + achievementsUnlocked.reduce((sum, a) => sum + a.xp_bonus, 0),
      level_up: levelUp,
      previous_level: previousLevel,
      new_level: newLevel,
      new_title: newTitle,
      achievements_unlocked: achievementsUnlocked,
    };
  });
}

// ============================================================================
// XP QUERIES
// ============================================================================

/**
 * Get XP summary for various time periods
 */
export function getXPSummary(): {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
  by_source: Record<XPSource, number>;
} {
  const db = getDatabase();

  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % 86400); // Start of today UTC
  const weekStart = todayStart - (6 * 86400); // 7 days ago
  const monthStart = todayStart - (29 * 86400); // 30 days ago

  const today = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM hyro_xp_log
    WHERE created_at >= ?
  `).get(todayStart) as { total: number };

  const week = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM hyro_xp_log
    WHERE created_at >= ?
  `).get(weekStart) as { total: number };

  const month = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM hyro_xp_log
    WHERE created_at >= ?
  `).get(monthStart) as { total: number };

  const character = db.prepare(`
    SELECT total_xp FROM hyro_character WHERE id = 'hyro'
  `).get() as { total_xp: number } | undefined;

  const bySource = db.prepare(`
    SELECT source, COALESCE(SUM(amount), 0) as total FROM hyro_xp_log
    GROUP BY source
  `).all() as { source: XPSource; total: number }[];

  const sourceMap: Record<XPSource, number> = {
    quest: 0,
    daily: 0,
    streak: 0,
    achievement: 0,
    srs: 0,
    srs_review: 0,
    intel: 0,
    intel_completed: 0,
    reflection: 0,
    reflection_completed: 0,
    bonus: 0,
    // Phase 3 sources
    reading_session: 0,
    chapter_completed: 0,
    book_completed: 0,
    comprehension_response: 0,
    discussion_exchange: 0,
    discussion_completed: 0,
  };

  for (const row of bySource) {
    sourceMap[row.source] = row.total;
  }

  return {
    today: today.total,
    this_week: week.total,
    this_month: month.total,
    total: character?.total_xp || 0,
    by_source: sourceMap,
  };
}

/**
 * Get recent XP transactions
 */
export function getRecentXP(limit: number = 20): Array<{
  id: string;
  amount: number;
  source: XPSource;
  source_id: string | null;
  notes: string | null;
  created_at: number;
}> {
  const db = getDatabase();

  return db.prepare(`
    SELECT * FROM hyro_xp_log
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string;
    amount: number;
    source: XPSource;
    source_id: string | null;
    notes: string | null;
    created_at: number;
  }>;
}

// ============================================================================
// STREAK MANAGEMENT
// ============================================================================

/**
 * Update streak based on session activity
 */
export function updateStreak(): {
  current_streak: number;
  longest_streak: number;
  streak_bonus_xp: number;
} {
  const db = getDatabase();

  const character = db.prepare(`
    SELECT current_streak, longest_streak, last_session_at
    FROM hyro_character WHERE id = 'hyro'
  `).get() as { current_streak: number; longest_streak: number; last_session_at: number | null } | undefined;

  if (!character) {
    throw new Error('Character not initialized');
  }

  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % 86400);
  const yesterdayStart = todayStart - 86400;

  let newStreak = character.current_streak;
  let streakBonusXp = 0;

  // If last session was yesterday, increment streak
  if (character.last_session_at) {
    if (character.last_session_at >= yesterdayStart && character.last_session_at < todayStart) {
      newStreak = character.current_streak + 1;
      streakBonusXp = newStreak * 2; // Streak bonus: streak × 2 XP
    } else if (character.last_session_at < yesterdayStart) {
      // Streak broken
      newStreak = 1;
    }
    // If last session was today, keep current streak
  } else {
    // First session ever
    newStreak = 1;
  }

  const newLongestStreak = Math.max(newStreak, character.longest_streak);

  db.prepare(`
    UPDATE hyro_character
    SET current_streak = ?, longest_streak = ?, last_session_at = ?, updated_at = unixepoch()
    WHERE id = 'hyro'
  `).run(newStreak, newLongestStreak, now);

  // Award streak bonus XP if applicable
  if (streakBonusXp > 0) {
    awardXP(streakBonusXp, 'streak', undefined, 1.0, `${newStreak}-day streak bonus`);
  }

  return {
    current_streak: newStreak,
    longest_streak: newLongestStreak,
    streak_bonus_xp: streakBonusXp,
  };
}
