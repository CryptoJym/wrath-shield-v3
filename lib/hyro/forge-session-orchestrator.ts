/**
 * HYRO FORGE: Session Orchestrator
 * Plans optimal daily learning sessions based on all available data
 *
 * Session Flow:
 * 1. Gather context (due cards, quests, books, diagnostics, skill gaps)
 * 2. Identify priority focus areas
 * 3. Sequence activities for optimal learning
 * 4. Estimate time and XP potential
 * 5. Track session completion
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName, STAT_NAMES } from './forge-types';
import { getTotalDueCount, getDueCards, SRSCard } from './forge-srs';
import { getBooksInProgress, BookWithProgress } from './forge-reading';
import { getActiveQuests, getQuestsDueToday, getOverdueQuests } from './forge-quest-generator';
import { getAllStatsWithTrend, StatWithTrend } from './forge-stats';
import { getStatsNeedingDiagnostic, getActiveSkillGaps, SkillGap } from './forge-diagnostics';
import type { Quest } from './forge-types';

// ============================================================================
// Types
// ============================================================================

export type ActivityType =
  | 'diagnostic'
  | 'srs_review'
  | 'reading'
  | 'comprehension'
  | 'quest'
  | 'reflection'
  | 'break';

export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';
export type ActivityStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface SessionActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  estimated_minutes: number;
  xp_potential: number;
  stat_focus: StatName[];
  priority: number; // 1-10, higher = more important
  reference_id?: string; // quest_id, deck_id, book_id, etc.
  status: ActivityStatus;
  started_at?: number;
  completed_at?: number;
  xp_earned?: number;
}

export interface SessionPlan {
  id: string;
  planned_date: string; // YYYY-MM-DD
  activities: SessionActivity[];
  estimated_minutes: number;
  actual_minutes: number | null;
  xp_potential: number;
  xp_earned: number;
  stat_focus: StatName[];
  status: SessionStatus;
  started_at: number | null;
  completed_at: number | null;
  completion_rate: number | null;
  created_at: number;
}

export interface SessionContext {
  // SRS
  due_cards_count: number;
  due_cards_by_deck: Array<{ deck_id: string; deck_title: string; count: number }>;

  // Quests
  active_quests: Quest[];
  quests_due_today: Quest[];
  overdue_quests: Quest[];

  // Reading
  books_in_progress: BookWithProgress[];

  // Diagnostics
  stats_needing_diagnostic: StatName[];
  active_skill_gaps: SkillGap[];

  // Stats
  stats_with_trend: StatWithTrend[];
  weakest_stats: StatWithTrend[];

  // Streak
  streak_days: number;
}

export interface SessionPlanParams {
  available_minutes?: number;
  energy_level?: number; // 1-10
  include_diagnostics?: boolean;
  focus_stat?: StatName;
}

// ============================================================================
// Constants
// ============================================================================

// Activity time estimates (minutes)
const TIME_ESTIMATES = {
  srs_card: 0.5, // Per card
  reading_segment: 15,
  comprehension: 10,
  quest_small: 10,
  quest_medium: 20,
  quest_large: 30,
  diagnostic: 15,
  reflection: 5,
  break: 5,
};

// XP estimates (base values)
const XP_ESTIMATES = {
  srs_card: 5,
  reading_segment: 15,
  comprehension: 20,
  quest_small: 25,
  quest_medium: 50,
  quest_large: 100,
  diagnostic: 50,
  reflection: 10,
};

// Priority weights
const PRIORITY_WEIGHTS = {
  overdue_quest: 10,
  diagnostic_needed: 9,
  due_today_quest: 8,
  skill_gap_critical: 8,
  srs_review: 7,
  skill_gap_significant: 6,
  reading_in_progress: 5,
  active_quest: 4,
  comprehension: 4,
  reflection: 3,
};

// Session configuration
const DEFAULT_SESSION_MINUTES = 45;
const MAX_SRS_CARDS_PER_SESSION = 20;
const BREAK_INTERVAL_MINUTES = 25; // Pomodoro-style

// ============================================================================
// Context Gathering
// ============================================================================

/**
 * Gather all context needed for session planning
 */
export function getSessionContext(): SessionContext {
  const db = getDatabase();

  // Get SRS context
  const dueCardsCount = getTotalDueCount();
  const dueCards = getDueCards(undefined, 50);

  // Group due cards by deck
  const cardsByDeck = new Map<string, { deck_id: string; deck_title: string; count: number }>();
  for (const card of dueCards) {
    const existing = cardsByDeck.get(card.deck_id);
    if (existing) {
      existing.count++;
    } else {
      // Get deck title
      const deck = db.prepare('SELECT title FROM hyro_srs_decks WHERE id = ?').get(card.deck_id) as { title: string } | undefined;
      cardsByDeck.set(card.deck_id, {
        deck_id: card.deck_id,
        deck_title: deck?.title || 'Unknown Deck',
        count: 1,
      });
    }
  }

  // Get quest context
  const activeQuests = getActiveQuests();
  const questsDueToday = getQuestsDueToday();
  const overdueQuests = getOverdueQuests();

  // Get reading context
  const booksInProgress = getBooksInProgress();

  // Get diagnostic context
  const statsNeedingDiagnostic = getStatsNeedingDiagnostic();
  const activeSkillGaps = getActiveSkillGaps();

  // Get stats context
  const statsWithTrend = getAllStatsWithTrend();
  const weakestStats = [...statsWithTrend]
    .sort((a, b) => a.current_value - b.current_value)
    .slice(0, 3);

  // Get streak (from character)
  const character = db.prepare('SELECT streak_days FROM hyro_character LIMIT 1').get() as { streak_days: number } | undefined;

  return {
    due_cards_count: dueCardsCount,
    due_cards_by_deck: Array.from(cardsByDeck.values()),
    active_quests: activeQuests,
    quests_due_today: questsDueToday,
    overdue_quests: overdueQuests,
    books_in_progress: booksInProgress,
    stats_needing_diagnostic: statsNeedingDiagnostic,
    active_skill_gaps: activeSkillGaps,
    stats_with_trend: statsWithTrend,
    weakest_stats: weakestStats,
    streak_days: character?.streak_days || 0,
  };
}

// ============================================================================
// Session Planning
// ============================================================================

/**
 * Plan an optimal learning session
 */
export function planSession(params: SessionPlanParams = {}): SessionPlan {
  const {
    available_minutes = DEFAULT_SESSION_MINUTES,
    energy_level = 7,
    include_diagnostics = true,
    focus_stat,
  } = params;

  const context = getSessionContext();
  const activities: SessionActivity[] = [];
  let remainingMinutes = available_minutes;
  let totalXpPotential = 0;
  const statFocus = new Set<StatName>();

  // Helper to add activity if time permits
  const addActivity = (activity: Omit<SessionActivity, 'id' | 'status'>) => {
    if (remainingMinutes >= activity.estimated_minutes) {
      activities.push({
        ...activity,
        id: randomUUID(),
        status: 'pending',
      });
      remainingMinutes -= activity.estimated_minutes;
      totalXpPotential += activity.xp_potential;
      activity.stat_focus.forEach((s) => statFocus.add(s));
      return true;
    }
    return false;
  };

  // 1. HIGHEST PRIORITY: Diagnostics needed (if enabled)
  if (include_diagnostics && context.stats_needing_diagnostic.length > 0) {
    const statToDiagnose = focus_stat && context.stats_needing_diagnostic.includes(focus_stat)
      ? focus_stat
      : context.stats_needing_diagnostic[0];

    addActivity({
      type: 'diagnostic',
      title: `${formatStatName(statToDiagnose)} Assessment`,
      description: `Take a diagnostic test to establish your baseline in ${formatStatName(statToDiagnose)}`,
      estimated_minutes: TIME_ESTIMATES.diagnostic,
      xp_potential: XP_ESTIMATES.diagnostic,
      stat_focus: [statToDiagnose],
      priority: PRIORITY_WEIGHTS.diagnostic_needed,
      reference_id: statToDiagnose,
    });
  }

  // 2. CRITICAL: Overdue quests
  for (const quest of context.overdue_quests.slice(0, 2)) {
    const questTime = getQuestTime(quest.difficulty || 'normal');
    const questXp = getQuestXp(quest.difficulty || 'normal');

    addActivity({
      type: 'quest',
      title: quest.title,
      description: `OVERDUE: ${quest.description || 'Complete this quest'}`,
      estimated_minutes: questTime,
      xp_potential: quest.xp_reward || questXp,
      stat_focus: quest.required_stat ? [quest.required_stat as StatName] : [],
      priority: PRIORITY_WEIGHTS.overdue_quest,
      reference_id: quest.id,
    });
  }

  // 3. HIGH: SRS Review (memory retention critical)
  if (context.due_cards_count > 0) {
    const cardsToReview = Math.min(context.due_cards_count, MAX_SRS_CARDS_PER_SESSION);
    const srsTime = Math.ceil(cardsToReview * TIME_ESTIMATES.srs_card);

    addActivity({
      type: 'srs_review',
      title: 'Flashcard Review',
      description: `Review ${cardsToReview} due cards across your decks`,
      estimated_minutes: srsTime,
      xp_potential: cardsToReview * XP_ESTIMATES.srs_card,
      stat_focus: [], // SRS cards can target multiple stats
      priority: PRIORITY_WEIGHTS.srs_review,
    });
  }

  // 4. HIGH: Quests due today
  for (const quest of context.quests_due_today.slice(0, 2)) {
    const questTime = getQuestTime(quest.difficulty || 'normal');
    const questXp = getQuestXp(quest.difficulty || 'normal');

    addActivity({
      type: 'quest',
      title: quest.title,
      description: `DUE TODAY: ${quest.description || 'Complete this quest'}`,
      estimated_minutes: questTime,
      xp_potential: quest.xp_reward || questXp,
      stat_focus: quest.required_stat ? [quest.required_stat as StatName] : [],
      priority: PRIORITY_WEIGHTS.due_today_quest,
      reference_id: quest.id,
    });
  }

  // 5. MEDIUM: Reading (if book in progress)
  if (context.books_in_progress.length > 0) {
    const book = context.books_in_progress[0];

    addActivity({
      type: 'reading',
      title: `Read: ${book.title}`,
      description: `Continue reading ${book.title} by ${book.author}`,
      estimated_minutes: TIME_ESTIMATES.reading_segment,
      xp_potential: XP_ESTIMATES.reading_segment,
      stat_focus: [book.stat_primary as StatName],
      priority: PRIORITY_WEIGHTS.reading_in_progress,
      reference_id: book.id,
    });

    // Add comprehension check after reading
    if (remainingMinutes >= TIME_ESTIMATES.comprehension) {
      addActivity({
        type: 'comprehension',
        title: 'Reading Comprehension',
        description: 'Answer questions about what you just read',
        estimated_minutes: TIME_ESTIMATES.comprehension,
        xp_potential: XP_ESTIMATES.comprehension,
        stat_focus: [book.stat_primary as StatName, 'critical_thinking'],
        priority: PRIORITY_WEIGHTS.comprehension,
        reference_id: book.id,
      });
    }
  }

  // 6. MEDIUM: Active quests (targeting weak stats if possible)
  const weakStatNames = context.weakest_stats.map((s) => s.stat_name);
  const prioritizedQuests = [...context.active_quests].sort((a, b) => {
    const aTargetsWeak = a.required_stat && weakStatNames.includes(a.required_stat as StatName) ? 1 : 0;
    const bTargetsWeak = b.required_stat && weakStatNames.includes(b.required_stat as StatName) ? 1 : 0;
    return bTargetsWeak - aTargetsWeak;
  });

  for (const quest of prioritizedQuests.slice(0, 2)) {
    // Don't add if already in activities (overdue or due today)
    if (activities.some((a) => a.reference_id === quest.id)) continue;

    const questTime = getQuestTime(quest.difficulty || 'normal');
    const questXp = getQuestXp(quest.difficulty || 'normal');

    addActivity({
      type: 'quest',
      title: quest.title,
      description: quest.description || 'Complete this quest',
      estimated_minutes: questTime,
      xp_potential: quest.xp_reward || questXp,
      stat_focus: quest.required_stat ? [quest.required_stat as StatName] : [],
      priority: PRIORITY_WEIGHTS.active_quest,
      reference_id: quest.id,
    });
  }

  // 7. LOW: Reflection (always end with reflection if time)
  if (remainingMinutes >= TIME_ESTIMATES.reflection) {
    addActivity({
      type: 'reflection',
      title: 'Daily Reflection',
      description: 'Take a moment to reflect on what you learned today',
      estimated_minutes: TIME_ESTIMATES.reflection,
      xp_potential: XP_ESTIMATES.reflection,
      stat_focus: ['study_skills'],
      priority: PRIORITY_WEIGHTS.reflection,
    });
  }

  // Add breaks for longer sessions (Pomodoro-style)
  if (available_minutes > BREAK_INTERVAL_MINUTES) {
    const breakCount = Math.floor(available_minutes / BREAK_INTERVAL_MINUTES) - 1;
    if (breakCount > 0) {
      // Insert breaks between activities
      const activitiesWithBreaks: SessionActivity[] = [];
      let minutesSoFar = 0;
      let nextBreakAt = BREAK_INTERVAL_MINUTES;

      for (const activity of activities) {
        if (minutesSoFar + activity.estimated_minutes > nextBreakAt && activity.type !== 'break') {
          activitiesWithBreaks.push({
            id: randomUUID(),
            type: 'break',
            title: 'Short Break',
            description: 'Take a 5-minute break to rest your mind',
            estimated_minutes: TIME_ESTIMATES.break,
            xp_potential: 0,
            stat_focus: [],
            priority: 1,
            status: 'pending',
          });
          nextBreakAt += BREAK_INTERVAL_MINUTES;
        }
        activitiesWithBreaks.push(activity);
        minutesSoFar += activity.estimated_minutes;
      }

      activities.length = 0;
      activities.push(...activitiesWithBreaks);
    }
  }

  // Sort by priority (descending)
  activities.sort((a, b) => b.priority - a.priority);

  // Calculate actual estimated time
  const estimatedMinutes = activities.reduce((sum, a) => sum + a.estimated_minutes, 0);

  // Create session plan
  const today = new Date().toISOString().split('T')[0];
  const sessionPlan: SessionPlan = {
    id: randomUUID(),
    planned_date: today,
    activities,
    estimated_minutes: estimatedMinutes,
    actual_minutes: null,
    xp_potential: totalXpPotential,
    xp_earned: 0,
    stat_focus: Array.from(statFocus),
    status: 'planned',
    started_at: null,
    completed_at: null,
    completion_rate: null,
    created_at: Math.floor(Date.now() / 1000),
  };

  // Save to database
  saveSessionPlan(sessionPlan);

  return sessionPlan;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Save session plan to database
 */
function saveSessionPlan(plan: SessionPlan): void {
  const db = getDatabase();

  db.prepare(`
    INSERT INTO hyro_session_plans (
      id, planned_date, activities, estimated_minutes, actual_minutes,
      xp_potential, xp_earned, completion_rate, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    plan.id,
    plan.planned_date,
    JSON.stringify(plan.activities),
    plan.estimated_minutes,
    plan.actual_minutes,
    plan.xp_potential,
    plan.xp_earned,
    plan.completion_rate,
    plan.created_at
  );
}

/**
 * Get today's session plan (or most recent)
 */
export function getTodaySession(): SessionPlan | null {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const row = db.prepare(`
    SELECT * FROM hyro_session_plans
    WHERE planned_date = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(today) as SessionPlanRow | undefined;

  if (!row) return null;

  return parseSessionPlanRow(row);
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SessionPlan | null {
  const db = getDatabase();

  const row = db.prepare('SELECT * FROM hyro_session_plans WHERE id = ?').get(sessionId) as SessionPlanRow | undefined;

  if (!row) return null;

  return parseSessionPlanRow(row);
}

/**
 * Get recent sessions
 */
export function getRecentSessions(limit: number = 7): SessionPlan[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT * FROM hyro_session_plans
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as SessionPlanRow[];

  return rows.map(parseSessionPlanRow);
}

/**
 * Start a session
 */
export function startSession(sessionId: string): SessionPlan | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const session = getSession(sessionId);
  if (!session) return null;

  session.status = 'in_progress';
  session.started_at = now;

  // Mark first activity as in progress
  if (session.activities.length > 0) {
    session.activities[0].status = 'in_progress';
    session.activities[0].started_at = now;
  }

  db.prepare(`
    UPDATE hyro_session_plans
    SET activities = ?
    WHERE id = ?
  `).run(JSON.stringify(session.activities), sessionId);

  return session;
}

/**
 * Complete an activity in a session
 */
export function completeActivity(
  sessionId: string,
  activityId: string,
  xpEarned: number = 0
): SessionPlan | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const session = getSession(sessionId);
  if (!session) return null;

  // Find and update the activity
  const activityIndex = session.activities.findIndex((a) => a.id === activityId);
  if (activityIndex === -1) return session;

  session.activities[activityIndex].status = 'completed';
  session.activities[activityIndex].completed_at = now;
  session.activities[activityIndex].xp_earned = xpEarned;
  session.xp_earned += xpEarned;

  // Start next activity if available
  const nextActivity = session.activities.find((a) => a.status === 'pending');
  if (nextActivity) {
    nextActivity.status = 'in_progress';
    nextActivity.started_at = now;
  }

  // Calculate completion rate
  const completedCount = session.activities.filter((a) => a.status === 'completed').length;
  session.completion_rate = completedCount / session.activities.length;

  // Check if session is complete
  if (session.activities.every((a) => a.status === 'completed' || a.status === 'skipped')) {
    session.status = 'completed';
    session.completed_at = now;
    session.actual_minutes = session.started_at
      ? Math.round((now - session.started_at) / 60)
      : session.estimated_minutes;
  }

  // Update database
  db.prepare(`
    UPDATE hyro_session_plans
    SET activities = ?,
        xp_earned = ?,
        completion_rate = ?,
        actual_minutes = ?
    WHERE id = ?
  `).run(
    JSON.stringify(session.activities),
    session.xp_earned,
    session.completion_rate,
    session.actual_minutes,
    sessionId
  );

  return session;
}

/**
 * Skip an activity
 */
export function skipActivity(sessionId: string, activityId: string): SessionPlan | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const session = getSession(sessionId);
  if (!session) return null;

  const activityIndex = session.activities.findIndex((a) => a.id === activityId);
  if (activityIndex === -1) return session;

  session.activities[activityIndex].status = 'skipped';
  session.activities[activityIndex].completed_at = now;

  // Start next activity if available
  const nextActivity = session.activities.find((a) => a.status === 'pending');
  if (nextActivity) {
    nextActivity.status = 'in_progress';
    nextActivity.started_at = now;
  }

  // Calculate completion rate (skipped counts as 0)
  const completedCount = session.activities.filter((a) => a.status === 'completed').length;
  session.completion_rate = completedCount / session.activities.length;

  // Check if session is complete
  if (session.activities.every((a) => a.status === 'completed' || a.status === 'skipped')) {
    session.status = 'completed';
    session.completed_at = now;
    session.actual_minutes = session.started_at
      ? Math.round((now - session.started_at) / 60)
      : session.estimated_minutes;
  }

  db.prepare(`
    UPDATE hyro_session_plans
    SET activities = ?,
        completion_rate = ?,
        actual_minutes = ?
    WHERE id = ?
  `).run(
    JSON.stringify(session.activities),
    session.completion_rate,
    session.actual_minutes,
    sessionId
  );

  return session;
}

/**
 * Abandon a session
 */
export function abandonSession(sessionId: string): SessionPlan | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const session = getSession(sessionId);
  if (!session) return null;

  session.status = 'abandoned';
  session.completed_at = now;
  session.actual_minutes = session.started_at
    ? Math.round((now - session.started_at) / 60)
    : 0;

  // Calculate completion rate
  const completedCount = session.activities.filter((a) => a.status === 'completed').length;
  session.completion_rate = completedCount / session.activities.length;

  db.prepare(`
    UPDATE hyro_session_plans
    SET activities = ?,
        completion_rate = ?,
        actual_minutes = ?
    WHERE id = ?
  `).run(
    JSON.stringify(session.activities),
    session.completion_rate,
    session.actual_minutes,
    sessionId
  );

  return session;
}

/**
 * Get session analytics
 */
export function getSessionAnalytics(): {
  total_sessions: number;
  completed_sessions: number;
  average_completion_rate: number;
  total_xp_earned: number;
  total_minutes: number;
  sessions_this_week: number;
  stat_focus_distribution: Record<StatName, number>;
} {
  const db = getDatabase();

  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      SUM(CASE WHEN completion_rate >= 0.8 THEN 1 ELSE 0 END) as completed_sessions,
      AVG(completion_rate) as average_completion_rate,
      SUM(xp_earned) as total_xp_earned,
      SUM(actual_minutes) as total_minutes
    FROM hyro_session_plans
  `).get() as {
    total_sessions: number;
    completed_sessions: number;
    average_completion_rate: number;
    total_xp_earned: number;
    total_minutes: number;
  };

  const weekCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM hyro_session_plans
    WHERE created_at >= ?
  `).get(weekAgo) as { count: number };

  // Calculate stat focus distribution
  const sessions = db.prepare('SELECT activities FROM hyro_session_plans').all() as { activities: string }[];
  const statCounts: Record<string, number> = {};

  for (const session of sessions) {
    try {
      const activities = JSON.parse(session.activities) as SessionActivity[];
      for (const activity of activities) {
        for (const stat of activity.stat_focus) {
          statCounts[stat] = (statCounts[stat] || 0) + 1;
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return {
    total_sessions: stats.total_sessions || 0,
    completed_sessions: stats.completed_sessions || 0,
    average_completion_rate: stats.average_completion_rate || 0,
    total_xp_earned: stats.total_xp_earned || 0,
    total_minutes: stats.total_minutes || 0,
    sessions_this_week: weekCount.count || 0,
    stat_focus_distribution: statCounts as Record<StatName, number>,
  };
}

// ============================================================================
// Helpers
// ============================================================================

interface SessionPlanRow {
  id: string;
  planned_date: string;
  activities: string;
  estimated_minutes: number;
  actual_minutes: number | null;
  xp_potential: number;
  xp_earned: number;
  completion_rate: number | null;
  created_at: number;
}

function parseSessionPlanRow(row: SessionPlanRow): SessionPlan {
  let activities: SessionActivity[] = [];
  try {
    activities = JSON.parse(row.activities);
  } catch {
    activities = [];
  }

  // Determine status based on activities
  let status: SessionStatus = 'planned';
  if (activities.some((a) => a.status === 'in_progress')) {
    status = 'in_progress';
  } else if (activities.every((a) => a.status === 'completed' || a.status === 'skipped')) {
    status = 'completed';
  }

  // Calculate stat focus
  const statFocus = new Set<StatName>();
  for (const activity of activities) {
    for (const stat of activity.stat_focus || []) {
      statFocus.add(stat as StatName);
    }
  }

  return {
    id: row.id,
    planned_date: row.planned_date,
    activities,
    estimated_minutes: row.estimated_minutes,
    actual_minutes: row.actual_minutes,
    xp_potential: row.xp_potential,
    xp_earned: row.xp_earned,
    stat_focus: Array.from(statFocus),
    status,
    started_at: null, // Not stored in DB currently
    completed_at: null,
    completion_rate: row.completion_rate,
    created_at: row.created_at,
  };
}

function formatStatName(stat: StatName): string {
  return stat
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getQuestTime(difficulty: string): number {
  switch (difficulty) {
    case 'easy':
      return TIME_ESTIMATES.quest_small;
    case 'hard':
    case 'boss':
      return TIME_ESTIMATES.quest_large;
    default:
      return TIME_ESTIMATES.quest_medium;
  }
}

function getQuestXp(difficulty: string): number {
  switch (difficulty) {
    case 'easy':
      return XP_ESTIMATES.quest_small;
    case 'hard':
    case 'boss':
      return XP_ESTIMATES.quest_large;
    default:
      return XP_ESTIMATES.quest_medium;
  }
}
