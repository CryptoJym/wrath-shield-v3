/**
 * HYRO FORGE: Quest Generation from Assignments
 * Converts external platform assignments into RPG-style quests
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { awardXP } from './forge-xp';
import type { StatName, QuestType, QuestDifficulty, Quest } from './forge-types';

// ============================================================================
// Types
// ============================================================================

export interface QuestGenerator {
  id: string;
  platform: string;
  assignment_type: string | null;
  quest_template: QuestTemplate;
  xp_formula: string;
  is_active: boolean;
  created_at: number;
}

export interface QuestTemplate {
  quest_type: QuestType;
  title_prefix: string;
  difficulty: QuestDifficulty;
  required_stat?: StatName;
  stat_boost?: Record<StatName, number>;
}

export interface AssignmentInput {
  platform: string;
  platform_id: string;
  title: string;
  description?: string;
  subject?: string;
  url?: string;
  due_date?: number; // Unix timestamp
  assigned_date?: number;
  difficulty?: string;
  estimated_minutes?: number;
  score?: number;
  max_score?: number;
}

export interface GeneratedQuest extends Quest {
  source_assignment_id: string;
  source_platform: string;
}

export interface QuestGenerationResult {
  quest: GeneratedQuest;
  xp_reward: number;
  generator_used: string;
}

// ============================================================================
// Platform → Stat Mapping
// ============================================================================

const SUBJECT_TO_STAT: Record<string, StatName> = {
  math: 'math',
  mathematics: 'math',
  algebra: 'math',
  geometry: 'math',

  reading: 'reading',
  ela: 'reading',
  english: 'reading',
  language_arts: 'reading',
  literature: 'reading',

  science: 'science',
  biology: 'science',
  physics: 'science',
  chemistry: 'science',

  coding: 'coding',
  computer_science: 'coding',
  programming: 'coding',

  social_studies: 'critical_thinking',
  history: 'critical_thinking',
  geography: 'critical_thinking',
};

const PLATFORM_DEFAULTS: Record<string, { stat: StatName; xp_base: number }> = {
  zearn: { stat: 'math', xp_base: 25 },
  boost: { stat: 'reading', xp_base: 20 },
  lexia: { stat: 'reading', xp_base: 20 },
  canyon_grove: { stat: 'study_skills', xp_base: 15 },
  google_classroom: { stat: 'study_skills', xp_base: 20 },
};

// ============================================================================
// Difficulty Calculation
// ============================================================================

function calculateDifficulty(assignment: AssignmentInput): QuestDifficulty {
  // If assignment has estimated time, use that as a proxy for difficulty
  if (assignment.estimated_minutes) {
    if (assignment.estimated_minutes <= 10) return 'easy';
    if (assignment.estimated_minutes <= 25) return 'medium';
    if (assignment.estimated_minutes <= 45) return 'hard';
    return 'legendary';
  }

  // Use explicit difficulty if provided
  if (assignment.difficulty) {
    const diff = assignment.difficulty.toLowerCase();
    if (['trivial', 'very easy'].includes(diff)) return 'trivial';
    if (['easy', 'beginner'].includes(diff)) return 'easy';
    if (['medium', 'moderate', 'intermediate'].includes(diff)) return 'medium';
    if (['hard', 'difficult', 'advanced'].includes(diff)) return 'hard';
    if (['legendary', 'expert', 'master'].includes(diff)) return 'legendary';
  }

  return 'medium'; // Default
}

function difficultyMultiplier(difficulty: QuestDifficulty): number {
  const multipliers: Record<QuestDifficulty, number> = {
    trivial: 0.5,
    easy: 0.75,
    medium: 1.0,
    hard: 1.5,
    legendary: 2.5,
  };
  return multipliers[difficulty] || 1.0;
}

// ============================================================================
// XP Calculation
// ============================================================================

function calculateXP(
  formula: string,
  assignment: AssignmentInput,
  difficulty: QuestDifficulty
): number {
  const platformDefaults = PLATFORM_DEFAULTS[assignment.platform.toLowerCase()] || { xp_base: 20 };
  const base = platformDefaults.xp_base;
  const mult = difficultyMultiplier(difficulty);

  // Parse formula (simplified formula parser)
  // Supports: difficulty * N, pages * N, base + N, time * N
  try {
    if (formula.includes('difficulty')) {
      const match = formula.match(/difficulty\s*\*\s*(\d+)/);
      if (match) {
        const factor = parseInt(match[1]);
        return Math.round(mult * factor);
      }
    }
    if (formula.includes('base')) {
      const match = formula.match(/base\s*\+\s*(\d+)/);
      if (match) {
        return base + parseInt(match[1]);
      }
    }
    if (formula.includes('time')) {
      const match = formula.match(/time\s*\*\s*(\d+)/);
      if (match && assignment.estimated_minutes) {
        return Math.round(assignment.estimated_minutes * parseInt(match[1]) * mult);
      }
    }
  } catch {
    // Fall back to default calculation
  }

  // Default: base XP * difficulty multiplier
  return Math.round(base * mult);
}

// ============================================================================
// Quest Generator Functions
// ============================================================================

/**
 * Get a quest generator for a platform
 */
export function getQuestGenerator(platform: string, assignmentType?: string): QuestGenerator | null {
  const db = getDatabase();

  let query = `
    SELECT * FROM hyro_quest_generators
    WHERE platform = ? AND is_active = 1
  `;
  const params: any[] = [platform.toLowerCase()];

  if (assignmentType) {
    query += ` AND (assignment_type = ? OR assignment_type IS NULL)`;
    params.push(assignmentType);
  }

  query += ` ORDER BY assignment_type DESC NULLS LAST LIMIT 1`;

  const row = db.prepare(query).get(...params) as any;
  if (!row) return null;

  return {
    ...row,
    quest_template: JSON.parse(row.quest_template),
    is_active: !!row.is_active,
  };
}

/**
 * Get all quest generators
 */
export function getAllQuestGenerators(): QuestGenerator[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM hyro_quest_generators
    ORDER BY platform, assignment_type
  `).all() as any[];

  return rows.map(row => ({
    ...row,
    quest_template: JSON.parse(row.quest_template),
    is_active: !!row.is_active,
  }));
}

/**
 * Create a new quest generator
 */
export function createQuestGenerator(params: {
  platform: string;
  assignment_type?: string;
  quest_template: QuestTemplate;
  xp_formula: string;
}): QuestGenerator {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_quest_generators (id, platform, assignment_type, quest_template, xp_formula)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    params.platform.toLowerCase(),
    params.assignment_type || null,
    JSON.stringify(params.quest_template),
    params.xp_formula
  );

  return getQuestGenerator(params.platform, params.assignment_type)!;
}

/**
 * Update a quest generator
 */
export function updateQuestGenerator(
  id: string,
  updates: Partial<{
    quest_template: QuestTemplate;
    xp_formula: string;
    is_active: boolean;
  }>
): QuestGenerator | null {
  const db = getDatabase();

  const existing = db.prepare(`SELECT * FROM hyro_quest_generators WHERE id = ?`).get(id) as any;
  if (!existing) return null;

  const newTemplate = updates.quest_template
    ? JSON.stringify(updates.quest_template)
    : existing.quest_template;

  db.prepare(`
    UPDATE hyro_quest_generators
    SET
      quest_template = ?,
      xp_formula = ?,
      is_active = ?
    WHERE id = ?
  `).run(
    newTemplate,
    updates.xp_formula ?? existing.xp_formula,
    updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : existing.is_active,
    id
  );

  return db.prepare(`SELECT * FROM hyro_quest_generators WHERE id = ?`).get(id) as any;
}

// ============================================================================
// Quest Generation
// ============================================================================

/**
 * Generate a quest from an assignment
 */
export function generateQuestFromAssignment(
  studentId: string,
  assignment: AssignmentInput
): QuestGenerationResult | null {
  const db = getDatabase();

  // Check if quest already exists for this student and assignment
  const existing = db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ? AND platform = ? AND external_id = ?
  `).get(studentId, assignment.platform, assignment.platform_id) as any;

  if (existing) {
    return null; // Quest already exists
  }

  // Get the appropriate generator
  const generator = getQuestGenerator(assignment.platform, assignment.subject);

  // Calculate difficulty
  const difficulty = calculateDifficulty(assignment);

  // Determine XP reward
  let xpReward: number;
  let generatorUsed = 'default';

  if (generator) {
    xpReward = calculateXP(generator.xp_formula, assignment, difficulty);
    generatorUsed = generator.id;
  } else {
    const platformDefaults = PLATFORM_DEFAULTS[assignment.platform.toLowerCase()];
    xpReward = Math.round((platformDefaults?.xp_base || 20) * difficultyMultiplier(difficulty));
  }

  // Determine stat from subject
  let requiredStat: StatName | null = null;
  if (assignment.subject) {
    requiredStat = SUBJECT_TO_STAT[assignment.subject.toLowerCase()] || null;
  }
  if (!requiredStat) {
    requiredStat = PLATFORM_DEFAULTS[assignment.platform.toLowerCase()]?.stat || null;
  }

  // Build quest title
  const titlePrefix = generator?.quest_template.title_prefix || `${assignment.platform} Quest: `;
  const questTitle = `${titlePrefix}${assignment.title}`;

  // Create the quest
  const questId = randomUUID();
  const questType: QuestType = generator?.quest_template.quest_type || 'daily';

  db.prepare(`
    INSERT INTO hyro_quests (
      id, student_id, quest_type, title, description, required_stat, difficulty,
      xp_reward, status, due_at, platform, external_id, external_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    questId,
    studentId,
    questType,
    questTitle,
    assignment.description || null,
    requiredStat,
    difficulty,
    xpReward,
    'available',
    assignment.due_date || null,
    assignment.platform,
    assignment.platform_id,
    assignment.url || null
  );

  const quest = db.prepare(`SELECT * FROM hyro_quests WHERE id = ?`).get(questId) as GeneratedQuest;

  return {
    quest: {
      ...quest,
      source_assignment_id: assignment.platform_id,
      source_platform: assignment.platform,
    },
    xp_reward: xpReward,
    generator_used: generatorUsed,
  };
}

/**
 * Generate quests from multiple assignments (batch)
 */
export function generateQuestsFromAssignments(
  studentId: string,
  assignments: AssignmentInput[]
): { generated: QuestGenerationResult[]; skipped: string[] } {
  const generated: QuestGenerationResult[] = [];
  const skipped: string[] = [];

  for (const assignment of assignments) {
    const result = generateQuestFromAssignment(studentId, assignment);
    if (result) {
      generated.push(result);
    } else {
      skipped.push(assignment.platform_id);
    }
  }

  return { generated, skipped };
}

/**
 * Complete a quest and award XP
 */
export function completeQuest(studentId: string, questId: string): {
  quest: Quest;
  xp_earned: number;
} | null {
  const db = getDatabase();

  const quest = db.prepare(`SELECT * FROM hyro_quests WHERE student_id = ? AND id = ?`).get(studentId, questId) as Quest | null;
  if (!quest) return null;

  if (quest.status === 'completed') {
    return { quest, xp_earned: 0 }; // Already completed
  }

  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_quests
    SET status = 'completed', completed_at = ?, updated_at = unixepoch()
    WHERE student_id = ? AND id = ?
  `).run(now, studentId, questId);

  // Award XP
  awardXP(studentId, quest.xp_reward, 'quest', questId);

  // Update stats if applicable
  if (quest.required_stat) {
    db.prepare(`
      UPDATE hyro_stats
      SET current_value = current_value + 1, last_assessed = unixepoch()
      WHERE student_id = ? AND stat_name = ?
    `).run(studentId, quest.required_stat);
  }

  const updatedQuest = db.prepare(`SELECT * FROM hyro_quests WHERE student_id = ? AND id = ?`).get(studentId, questId) as Quest;

  return { quest: updatedQuest, xp_earned: quest.xp_reward };
}

/**
 * Get quests by platform
 */
export function getQuestsByPlatform(studentId: string, platform: string, status?: string): Quest[] {
  const db = getDatabase();

  let query = `SELECT * FROM hyro_quests WHERE student_id = ? AND platform = ?`;
  const params: any[] = [studentId, platform];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC`;

  return db.prepare(query).all(...params) as Quest[];
}

/**
 * Get active quests (available or in progress)
 */
export function getActiveQuests(studentId: string): Quest[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ? AND status IN ('available', 'active')
    ORDER BY due_at ASC NULLS LAST, created_at DESC
  `).all(studentId) as Quest[];
}

/**
 * Get quests due today
 */
export function getQuestsDueToday(studentId: string): Quest[] {
  const db = getDatabase();
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const endOfDay = Math.floor(today.getTime() / 1000);

  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  const startOfDay = Math.floor(yesterday.getTime() / 1000);

  return db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ?
    AND status IN ('available', 'active')
    AND due_at IS NOT NULL
    AND due_at >= ? AND due_at <= ?
    ORDER BY due_at ASC
  `).all(studentId, startOfDay, endOfDay) as Quest[];
}

/**
 * Get overdue quests
 */
export function getOverdueQuests(studentId: string): Quest[] {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ?
    AND status IN ('available', 'active')
    AND due_at IS NOT NULL
    AND due_at < ?
    ORDER BY due_at ASC
  `).all(studentId, now) as Quest[];
}

/**
 * Start a quest (mark as active)
 */
export function startQuest(studentId: string, questId: string): Quest | null {
  const db = getDatabase();

  const quest = db.prepare(`SELECT * FROM hyro_quests WHERE student_id = ? AND id = ?`).get(studentId, questId) as Quest | null;
  if (!quest || quest.status !== 'available') return null;

  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_quests
    SET status = 'active', started_at = ?, updated_at = unixepoch()
    WHERE student_id = ? AND id = ?
  `).run(now, studentId, questId);

  return db.prepare(`SELECT * FROM hyro_quests WHERE student_id = ? AND id = ?`).get(studentId, questId) as Quest;
}

/**
 * Sync quest status from external platform completion
 */
export function syncQuestCompletion(
  studentId: string,
  platform: string,
  platformId: string,
  score?: number
): { quest: Quest; xp_earned: number } | null {
  const db = getDatabase();

  const quest = db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ? AND platform = ? AND external_id = ?
  `).get(studentId, platform, platformId) as Quest | null;

  if (!quest) return null;
  if (quest.status === 'completed') {
    return { quest, xp_earned: 0 };
  }

  // Calculate XP with optional score bonus
  let xpEarned = quest.xp_reward;
  if (score !== undefined && score >= 0.9) {
    xpEarned = Math.round(xpEarned * 1.25); // 25% bonus for 90%+ score
  } else if (score !== undefined && score >= 0.8) {
    xpEarned = Math.round(xpEarned * 1.1); // 10% bonus for 80%+ score
  }

  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_quests
    SET status = 'completed', completed_at = ?, updated_at = unixepoch()
    WHERE student_id = ? AND id = ?
  `).run(now, studentId, quest.id);

  // Award XP
  awardXP(studentId, xpEarned, 'quest', quest.id);

  const updatedQuest = db.prepare(`SELECT * FROM hyro_quests WHERE student_id = ? AND id = ?`).get(studentId, quest.id) as Quest;

  return { quest: updatedQuest, xp_earned: xpEarned };
}

/**
 * Get quest generation stats
 */
export function getQuestGenerationStats(studentId: string): {
  total_generated: number;
  by_platform: Record<string, number>;
  completed: number;
  completion_rate: number;
  total_xp_earned: number;
} {
  const db = getDatabase();

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_quests WHERE student_id = ? AND external_id IS NOT NULL
  `).get(studentId) as { count: number };

  const byPlatform = db.prepare(`
    SELECT platform, COUNT(*) as count
    FROM hyro_quests
    WHERE student_id = ? AND external_id IS NOT NULL
    GROUP BY platform
  `).all(studentId) as { platform: string; count: number }[];

  const completed = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_quests
    WHERE student_id = ? AND external_id IS NOT NULL AND status = 'completed'
  `).get(studentId) as { count: number };

  const xpEarned = db.prepare(`
    SELECT SUM(xp_reward) as total FROM hyro_quests
    WHERE student_id = ? AND external_id IS NOT NULL AND status = 'completed'
  `).get(studentId) as { total: number | null };

  const platformMap: Record<string, number> = {};
  for (const row of byPlatform) {
    platformMap[row.platform] = row.count;
  }

  return {
    total_generated: total.count,
    by_platform: platformMap,
    completed: completed.count,
    completion_rate: total.count > 0 ? completed.count / total.count : 0,
    total_xp_earned: xpEarned.total || 0,
  };
}

// ============================================================================
// STAT-BASED QUEST GENERATION (Daily/Weekly)
// ============================================================================

export interface QuestPoolItem {
  id: string;
  quest_type: string;
  title: string;
  description: string | null;
  required_stat: string | null;
  difficulty: string;
  xp_reward: number;
  estimated_minutes: number | null;
  activity_type: string | null;
  activity_config: string | null;
  tags: string | null;
  is_active: number;
  times_assigned: number;
  success_rate: number | null;
}

export interface StudentStat {
  stat_name: string;
  current_value: number;
  display_name: string;
}

/**
 * Get the student's weakest stats (for prioritizing quests)
 * Uses manifold state vectors (C, E, G) when available, falls back to hyro_stats
 *
 * The "weakness" score combines:
 * - Lower coherence = less organized understanding
 * - Lower generativity = less ability to apply/transfer
 * - Higher entropy with low coherence = confusion (needs work)
 */
export function getWeakestStats(studentId: string, limit: number = 3): StudentStat[] {
  const db = getDatabase();

  // Try to get from manifold state vectors first (more nuanced assessment)
  const stateVectors = db.prepare(`
    SELECT
      stat_name,
      coherence,
      entropy,
      generativity,
      ci_high - ci_low as uncertainty,
      n_items_used
    FROM hyro_state_vectors
    WHERE student_id = ?
  `).all(studentId) as any[];

  if (stateVectors.length > 0) {
    // Calculate weakness score: lower is weaker
    // - Low coherence = weak (confused understanding)
    // - Low generativity = weak (can't apply knowledge)
    // - High entropy + low coherence = very weak (chaos without structure)
    // - High uncertainty = needs more assessment
    const scoredStats = stateVectors.map(sv => {
      // Composite score: weighted average favoring coherence and generativity
      // Entropy is inverted when coherence is low (chaos is bad)
      const entropyPenalty = sv.coherence < 50 ? (100 - sv.entropy) * 0.2 : 0;
      const weaknessScore =
        sv.coherence * 0.4 +
        sv.generativity * 0.4 +
        (100 - entropyPenalty) * 0.2 -
        sv.uncertainty * 0.1; // More uncertainty = prioritize for assessment

      return {
        stat_name: sv.stat_name,
        current_value: Math.round(weaknessScore),
        display_name: sv.stat_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        coherence: sv.coherence,
        entropy: sv.entropy,
        generativity: sv.generativity,
      };
    });

    // Sort by weakness score (lower = weaker = higher priority)
    scoredStats.sort((a, b) => a.current_value - b.current_value);
    return scoredStats.slice(0, limit);
  }

  // Fallback to traditional hyro_stats table
  return db.prepare(`
    SELECT stat_name, current_value, display_name
    FROM hyro_stats
    WHERE student_id = ?
    ORDER BY current_value ASC
    LIMIT ?
  `).all(studentId, limit) as StudentStat[];
}

/**
 * Get available quest templates from the pool
 */
export function getQuestPoolTemplates(
  questType: 'daily' | 'weekly' | 'challenge',
  statName?: string,
  limit: number = 10
): QuestPoolItem[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM hyro_quest_pool
    WHERE quest_type = ? AND is_active = 1
  `;
  const params: any[] = [questType];

  if (statName) {
    query += ` AND required_stat = ?`;
    params.push(statName);
  }

  query += ` ORDER BY times_assigned ASC, RANDOM() LIMIT ?`;
  params.push(limit);

  return db.prepare(query).all(...params) as QuestPoolItem[];
}

/**
 * Generate daily quests based on student goals/stats
 * Selects 3-5 quests prioritizing:
 * 1. Student's weakest stats
 * 2. Variety across different activities
 * 3. Less-assigned templates
 */
export function generateDailyQuestsFromGoals(studentId: string): Quest[] {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  // Check if daily quests already generated today
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_quests
    WHERE student_id = ?
    AND quest_type = 'daily'
    AND platform = 'forge'
    AND DATE(created_at, 'unixepoch') = ?
  `).get(studentId, today) as { count: number };

  if (existing.count >= 3) {
    // Already have daily quests, return them
    return db.prepare(`
      SELECT * FROM hyro_quests
      WHERE student_id = ?
      AND quest_type = 'daily'
      AND platform = 'forge'
      AND DATE(created_at, 'unixepoch') = ?
      ORDER BY created_at DESC
    `).all(studentId, today) as Quest[];
  }

  // Get weakest stats
  const weakestStats = getWeakestStats(studentId, 4);
  const createdQuests: Quest[] = [];
  const usedTemplates = new Set<string>();
  const usedStats = new Set<string>();
  const targetCount = 3 + Math.floor(Math.random() * 2); // 3-4 daily quests

  // Priority 1: One quest for each of the 2 weakest stats
  for (let i = 0; i < Math.min(2, weakestStats.length) && createdQuests.length < targetCount; i++) {
    const stat = weakestStats[i];
    const templates = getQuestPoolTemplates('daily', stat.stat_name, 3);

    for (const template of templates) {
      if (!usedTemplates.has(template.id)) {
        const quest = createQuestFromTemplate(studentId, template, 'daily');
        if (quest) {
          createdQuests.push(quest);
          usedTemplates.add(template.id);
          usedStats.add(stat.stat_name);
          break;
        }
      }
    }
  }

  // Priority 2: Fill remaining with variety
  const allDailyTemplates = getQuestPoolTemplates('daily', undefined, 20);
  for (const template of allDailyTemplates) {
    if (createdQuests.length >= targetCount) break;
    if (usedTemplates.has(template.id)) continue;

    // Prefer templates for stats we haven't covered yet
    if (template.required_stat && usedStats.has(template.required_stat) && createdQuests.length > 2) {
      continue;
    }

    const quest = createQuestFromTemplate(studentId, template, 'daily');
    if (quest) {
      createdQuests.push(quest);
      usedTemplates.add(template.id);
      if (template.required_stat) {
        usedStats.add(template.required_stat);
      }
    }
  }

  return createdQuests;
}

/**
 * Generate weekly quests based on student stats
 * Creates 2-3 weekly challenges
 */
export function generateWeeklyQuestsFromGoals(studentId: string): Quest[] {
  const db = getDatabase();

  // Check day of week - only generate on Monday (or if none exist)
  const dayOfWeek = new Date().getDay();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Check if weekly quests already exist for this week
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_quests
    WHERE student_id = ?
    AND quest_type = 'weekly'
    AND platform = 'forge'
    AND DATE(created_at, 'unixepoch') >= ?
  `).get(studentId, weekStartStr) as { count: number };

  if (existing.count >= 2) {
    return db.prepare(`
      SELECT * FROM hyro_quests
      WHERE student_id = ?
      AND quest_type = 'weekly'
      AND platform = 'forge'
      AND DATE(created_at, 'unixepoch') >= ?
    `).all(studentId, weekStartStr) as Quest[];
  }

  const weakestStats = getWeakestStats(studentId, 3);
  const createdQuests: Quest[] = [];
  const usedTemplates = new Set<string>();

  // Create 2 weekly quests, prioritizing weak stats
  for (let i = 0; i < Math.min(2, weakestStats.length); i++) {
    const stat = weakestStats[i];
    const templates = getQuestPoolTemplates('weekly', stat.stat_name, 2);

    for (const template of templates) {
      if (!usedTemplates.has(template.id)) {
        const quest = createQuestFromTemplate(studentId, template, 'weekly');
        if (quest) {
          createdQuests.push(quest);
          usedTemplates.add(template.id);
          break;
        }
      }
    }
  }

  return createdQuests;
}

/**
 * Create a quest from a pool template
 */
function createQuestFromTemplate(
  studentId: string,
  template: QuestPoolItem,
  questType: QuestType
): Quest | null {
  const db = getDatabase();
  const questId = randomUUID();

  // Set due date based on quest type
  let dueAt: number | null = null;
  const now = new Date();

  if (questType === 'daily') {
    now.setHours(23, 59, 59, 999);
    dueAt = Math.floor(now.getTime() / 1000);
  } else if (questType === 'weekly') {
    // Due end of week (Sunday)
    const daysUntilSunday = 7 - now.getDay();
    now.setDate(now.getDate() + daysUntilSunday);
    now.setHours(23, 59, 59, 999);
    dueAt = Math.floor(now.getTime() / 1000);
  }

  db.prepare(`
    INSERT INTO hyro_quests (
      id, student_id, quest_type, title, description, required_stat, difficulty,
      xp_reward, status, due_at, platform, external_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    questId,
    studentId,
    questType,
    template.title,
    template.description,
    template.required_stat,
    template.difficulty as QuestDifficulty,
    template.xp_reward,
    'available',
    dueAt,
    'forge',  // Internal platform
    template.id  // Link to template
  );

  // Update template usage count
  db.prepare(`
    UPDATE hyro_quest_pool SET times_assigned = times_assigned + 1 WHERE id = ?
  `).run(template.id);

  return db.prepare(`SELECT * FROM hyro_quests WHERE id = ?`).get(questId) as Quest;
}

/**
 * Get recommended quests for a student based on their stats and goals
 */
export function getRecommendedQuests(studentId: string): {
  daily: Quest[];
  weekly: Quest[];
  available_challenges: QuestPoolItem[];
} {
  const dailyQuests = generateDailyQuestsFromGoals(studentId);
  const weeklyQuests = generateWeeklyQuestsFromGoals(studentId);

  // Get available challenge quests
  const weakestStats = getWeakestStats(studentId, 2);
  const challenges: QuestPoolItem[] = [];

  for (const stat of weakestStats) {
    const statChallenges = getQuestPoolTemplates('challenge', stat.stat_name, 2);
    challenges.push(...statChallenges);
  }

  return {
    daily: dailyQuests,
    weekly: weeklyQuests,
    available_challenges: challenges.slice(0, 5),
  };
}

/**
 * Accept a challenge quest from the pool
 */
export function acceptChallengeQuest(studentId: string, templateId: string): Quest | null {
  const db = getDatabase();

  const template = db.prepare(`
    SELECT * FROM hyro_quest_pool WHERE id = ? AND quest_type = 'challenge' AND is_active = 1
  `).get(templateId) as QuestPoolItem | null;

  if (!template) return null;

  // Check if already has this challenge active
  const existing = db.prepare(`
    SELECT * FROM hyro_quests
    WHERE student_id = ? AND external_id = ? AND status IN ('available', 'active')
  `).get(studentId, templateId) as Quest | null;

  if (existing) return existing;

  return createQuestFromTemplate(studentId, template, 'challenge');
}
