/**
 * HYRO FORGE PHASE 4: ALERT & NOTIFICATION SYSTEM
 *
 * Generates alerts to keep parents engaged with their child's education:
 * - Streak at risk (no activity in 24h)
 * - Streak milestones (7, 14, 30 days)
 * - Session completion
 * - Level up achievements
 * - Badge/achievement unlocks
 * - Weekly reports
 * - Growth opportunities (declining stats)
 * - Quest reminders (due soon)
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { getCharacter } from './forge-stats';
import { getLevelProgress } from './forge-xp';

// ============================================================================
// TYPES
// ============================================================================

export type AlertType =
  | 'streak_at_risk'
  | 'streak_milestone'
  | 'session_complete'
  | 'level_up'
  | 'achievement_earned'
  | 'weekly_report'
  | 'growth_opportunity'
  | 'quest_reminder';

export type AlertPriority = 'low' | 'medium' | 'high';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  priority: AlertPriority;
  created_at: number;
  read_at?: number;
  dismissed: boolean;
  action_url?: string;
  metadata?: Record<string, any>;
  alert_key?: string;
}

export interface AlertPreferences {
  alert_type: AlertType;
  enabled: boolean;
  email_enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  last_sent_at?: number;
}

// Priority mapping
const PRIORITY_RULES: Record<AlertType, AlertPriority> = {
  streak_at_risk: 'high',
  streak_milestone: 'medium',
  session_complete: 'low',
  level_up: 'medium',
  achievement_earned: 'medium',
  weekly_report: 'low',
  growth_opportunity: 'high',
  quest_reminder: 'medium',
};

// ============================================================================
// ALERT GENERATION (Main Entry Point)
// ============================================================================

/**
 * Check all conditions and generate relevant alerts
 * Call this after sessions, daily, or on-demand
 */
export async function checkAndGenerateAlerts(): Promise<Alert[]> {
  const db = getDatabase();
  const generatedAlerts: Alert[] = [];

  // Get preferences to see what's enabled
  const preferences = await getAlertPreferences();
  const enabledTypes = preferences.filter(p => p.enabled).map(p => p.alert_type);

  // Check each alert type
  if (enabledTypes.includes('streak_at_risk')) {
    const streakAlert = await checkStreakRisk();
    if (streakAlert) generatedAlerts.push(streakAlert);
  }

  if (enabledTypes.includes('streak_milestone')) {
    const milestoneAlerts = await checkStreakMilestones();
    generatedAlerts.push(...milestoneAlerts);
  }

  if (enabledTypes.includes('quest_reminder')) {
    const questAlerts = await checkQuestsDue();
    generatedAlerts.push(...questAlerts);
  }

  if (enabledTypes.includes('growth_opportunity')) {
    const growthAlerts = await checkGrowthOpportunities();
    generatedAlerts.push(...growthAlerts);
  }

  if (enabledTypes.includes('weekly_report')) {
    const reportAlert = await checkWeeklyReport();
    if (reportAlert) generatedAlerts.push(reportAlert);
  }

  // Log generation event
  db.prepare(`
    INSERT INTO hyro_alert_generation_log (id, alert_type, alerts_generated, metadata)
    VALUES (?, ?, ?, ?)
  `).run(
    randomUUID(),
    'batch_check',
    generatedAlerts.length,
    JSON.stringify({ timestamp: Date.now(), types_checked: enabledTypes })
  );

  return generatedAlerts;
}

/**
 * Generate a session complete alert (called after a learning session)
 */
export async function generateSessionCompleteAlert(
  sessionId: string,
  xpEarned: number,
  duration: number
): Promise<Alert> {
  const character = getCharacter();

  const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
    type: 'session_complete',
    title: 'Session Complete!',
    message: `Great work! Earned ${xpEarned} XP in ${Math.round(duration)} minutes.`,
    priority: PRIORITY_RULES['session_complete'],
    action_url: '/hyro/forge',
    metadata: { sessionId, xpEarned, duration },
    alert_key: `session_complete_${sessionId}`,
  };

  return await createAlert(alert);
}

/**
 * Generate a level up alert
 */
export async function generateLevelUpAlert(
  oldLevel: number,
  newLevel: number,
  totalXp: number
): Promise<Alert> {
  const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
    type: 'level_up',
    title: `Level Up! Now Level ${newLevel}`,
    message: `Amazing progress! Just reached Level ${newLevel} with ${totalXp} total XP.`,
    priority: PRIORITY_RULES['level_up'],
    action_url: '/hyro/forge',
    metadata: { oldLevel, newLevel, totalXp },
    alert_key: `level_up_${newLevel}`,
  };

  return await createAlert(alert);
}

/**
 * Generate an achievement earned alert
 */
export async function generateAchievementAlert(
  achievementId: string,
  achievementName: string,
  achievementDescription: string
): Promise<Alert> {
  const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
    type: 'achievement_earned',
    title: `Achievement Unlocked: ${achievementName}`,
    message: achievementDescription,
    priority: PRIORITY_RULES['achievement_earned'],
    action_url: '/hyro/forge',
    metadata: { achievementId, achievementName },
    alert_key: `achievement_${achievementId}`,
  };

  return await createAlert(alert);
}

// ============================================================================
// ALERT DETECTION LOGIC
// ============================================================================

/**
 * Check if streak is at risk (no activity in 24 hours)
 * Only fires once per 24h period to avoid spam
 */
async function checkStreakRisk(): Promise<Alert | null> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 86400;

  // Get streak tracker
  const tracker = db.prepare(`
    SELECT * FROM hyro_streak_tracker WHERE id = 'singleton'
  `).get() as any;

  if (!tracker || !tracker.last_session_at) {
    return null; // No sessions yet
  }

  // Check if last session was > 24h ago
  if (tracker.last_session_at >= twentyFourHoursAgo) {
    return null; // Activity is recent
  }

  // Check if we've already alerted in the last 24h
  if (tracker.last_streak_alert_at && tracker.last_streak_alert_at >= twentyFourHoursAgo) {
    return null; // Already alerted recently
  }

  // Check for existing alert with same key today
  const today = new Date().toISOString().split('T')[0];
  const alertKey = `streak_risk_${today}`;
  const existing = db.prepare(`
    SELECT id FROM hyro_alerts WHERE alert_key = ?
  `).get(alertKey);

  if (existing) {
    return null; // Already generated today
  }

  const hoursAgo = Math.floor((now - tracker.last_session_at) / 3600);

  const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
    type: 'streak_at_risk',
    title: `Streak at Risk! ${hoursAgo}h Since Last Session`,
    message: `It's been ${hoursAgo} hours since the last learning session. Keep the streak alive!`,
    priority: PRIORITY_RULES['streak_at_risk'],
    action_url: '/hyro/forge',
    metadata: { hoursAgo, lastSessionAt: tracker.last_session_at },
    alert_key: alertKey,
  };

  // Update tracker
  db.prepare(`
    UPDATE hyro_streak_tracker SET last_streak_alert_at = ? WHERE id = 'singleton'
  `).run(now);

  return await createAlert(alert);
}

/**
 * Check for streak milestones (7, 14, 30 days)
 */
async function checkStreakMilestones(): Promise<Alert[]> {
  const db = getDatabase();
  const alerts: Alert[] = [];

  const tracker = db.prepare(`
    SELECT * FROM hyro_streak_tracker WHERE id = 'singleton'
  `).get() as any;

  if (!tracker) return [];

  const milestones = [7, 14, 30, 60, 90];
  const currentStreak = tracker.current_streak_days;

  for (const milestone of milestones) {
    if (currentStreak === milestone) {
      const alertKey = `streak_milestone_${milestone}`;

      // Check if already exists
      const existing = db.prepare(`
        SELECT id FROM hyro_alerts WHERE alert_key = ?
      `).get(alertKey);

      if (!existing) {
        const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
          type: 'streak_milestone',
          title: `${milestone}-Day Streak Achieved!`,
          message: `Incredible dedication! Maintained a ${milestone}-day learning streak.`,
          priority: PRIORITY_RULES['streak_milestone'],
          action_url: '/hyro/forge',
          metadata: { milestone, currentStreak },
          alert_key: alertKey,
        };

        alerts.push(await createAlert(alert));
      }
    }
  }

  return alerts;
}

/**
 * Check for quests due within 24h that haven't been started
 */
async function checkQuestsDue(): Promise<Alert[]> {
  const db = getDatabase();
  const alerts: Alert[] = [];
  const now = Math.floor(Date.now() / 1000);
  const tomorrow = now + 86400;

  const quests = db.prepare(`
    SELECT * FROM hyro_quests
    WHERE status = 'available'
      AND due_at IS NOT NULL
      AND due_at <= ?
      AND due_at >= ?
  `).all(tomorrow, now) as any[];

  for (const quest of quests) {
    const alertKey = `quest_reminder_${quest.id}`;

    // Check if already exists
    const existing = db.prepare(`
      SELECT id FROM hyro_alerts WHERE alert_key = ?
    `).get(alertKey);

    if (!existing) {
      const hoursUntilDue = Math.floor((quest.due_at - now) / 3600);

      const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
        type: 'quest_reminder',
        title: `Quest Due Soon: ${quest.title}`,
        message: `The quest "${quest.title}" is due in ${hoursUntilDue} hours!`,
        priority: PRIORITY_RULES['quest_reminder'],
        action_url: `/hyro/forge/quests/${quest.id}`,
        metadata: { questId: quest.id, questTitle: quest.title, hoursUntilDue },
        alert_key: alertKey,
      };

      alerts.push(await createAlert(alert));
    }
  }

  return alerts;
}

/**
 * Check for declining stats that need attention
 */
async function checkGrowthOpportunities(): Promise<Alert[]> {
  const db = getDatabase();
  const alerts: Alert[] = [];
  const weekAgo = Math.floor(Date.now() / 1000) - (7 * 86400);

  // Get stats that have declined significantly
  const stats = db.prepare(`
    SELECT
      s.stat_name,
      s.display_name,
      s.current_value,
      (
        SELECT old_value FROM hyro_stat_history
        WHERE stat_name = s.stat_name
          AND created_at >= ?
        ORDER BY created_at ASC
        LIMIT 1
      ) as value_7d_ago
    FROM hyro_stats s
    WHERE s.current_value < 50
  `).all(weekAgo) as any[];

  for (const stat of stats) {
    if (stat.value_7d_ago && stat.current_value < stat.value_7d_ago - 5) {
      const decline = stat.value_7d_ago - stat.current_value;
      const alertKey = `growth_opportunity_${stat.stat_name}_${Math.floor(Date.now() / (7 * 86400))}`;

      // Check if already exists this week
      const existing = db.prepare(`
        SELECT id FROM hyro_alerts WHERE alert_key = ?
      `).get(alertKey);

      if (!existing) {
        const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
          type: 'growth_opportunity',
          title: `${stat.display_name} Needs Attention`,
          message: `${stat.display_name} has declined by ${Math.round(decline)} points this week. Time to focus here!`,
          priority: PRIORITY_RULES['growth_opportunity'],
          action_url: '/hyro/forge/analytics',
          metadata: { statName: stat.stat_name, decline, currentValue: stat.current_value },
          alert_key: alertKey,
        };

        alerts.push(await createAlert(alert));
      }
    }
  }

  return alerts;
}

/**
 * Check if weekly report should be generated (Sunday evening)
 */
async function checkWeeklyReport(): Promise<Alert | null> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const hour = now.getHours();

  // Generate on Sunday evening (6pm-11pm)
  if (dayOfWeek !== 0 || hour < 18 || hour >= 23) {
    return null;
  }

  const db = getDatabase();
  const today = now.toISOString().split('T')[0];
  const alertKey = `weekly_report_${today}`;

  // Check if already generated today
  const existing = db.prepare(`
    SELECT id FROM hyro_alerts WHERE alert_key = ?
  `).get(alertKey);

  if (existing) {
    return null;
  }

  // Get weekly stats
  const weekAgo = Math.floor(Date.now() / 1000) - (7 * 86400);
  const sessions = db.prepare(`
    SELECT COUNT(*) as count, SUM(xp_earned) as total_xp
    FROM hyro_sessions
    WHERE started_at >= ?
  `).get(weekAgo) as any;

  const alert: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'> = {
    type: 'weekly_report',
    title: 'Weekly Progress Report Ready',
    message: `This week: ${sessions.count || 0} sessions completed, ${sessions.total_xp || 0} XP earned!`,
    priority: PRIORITY_RULES['weekly_report'],
    action_url: '/hyro/forge/analytics',
    metadata: { sessionCount: sessions.count || 0, totalXp: sessions.total_xp || 0 },
    alert_key: alertKey,
  };

  return await createAlert(alert);
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new alert
 */
async function createAlert(
  input: Omit<Alert, 'id' | 'created_at' | 'read_at' | 'dismissed'>
): Promise<Alert> {
  const db = getDatabase();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO hyro_alerts (
      id, type, title, message, priority, action_url, metadata, alert_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.type,
    input.title,
    input.message,
    input.priority,
    input.action_url || null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.alert_key || null
  );

  const alert = db.prepare(`SELECT * FROM hyro_alerts WHERE id = ?`).get(id) as any;
  return mapAlertRow(alert);
}

/**
 * Get all alerts (with optional filters)
 */
export async function getAlerts(filters?: {
  type?: AlertType;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<Alert[]> {
  const db = getDatabase();

  let sql = 'SELECT * FROM hyro_alerts WHERE dismissed = 0';
  const params: any[] = [];

  if (filters?.type) {
    sql += ' AND type = ?';
    params.push(filters.type);
  }

  if (filters?.unreadOnly) {
    sql += ' AND read_at IS NULL';
  }

  sql += ' ORDER BY ';
  sql += "CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, ";
  sql += 'created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(mapAlertRow);
}

/**
 * Get unread alerts
 */
export async function getUnreadAlerts(): Promise<Alert[]> {
  return getAlerts({ unreadOnly: true });
}

/**
 * Get unread alert count
 */
export async function getUnreadAlertCount(): Promise<number> {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_alerts
    WHERE read_at IS NULL AND dismissed = 0
  `).get() as any;
  return result.count;
}

/**
 * Mark alert as read
 */
export async function markAlertRead(id: string): Promise<void> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_alerts SET read_at = ? WHERE id = ? AND read_at IS NULL
  `).run(now, id);
}

/**
 * Mark all alerts as read
 */
export async function markAllAlertsRead(): Promise<number> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const result = db.prepare(`
    UPDATE hyro_alerts SET read_at = ? WHERE read_at IS NULL AND dismissed = 0
  `).run(now);

  return result.changes;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(id: string): Promise<void> {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_alerts SET dismissed = 1 WHERE id = ?
  `).run(id);
}

// ============================================================================
// PREFERENCES
// ============================================================================

/**
 * Get all alert preferences
 */
export async function getAlertPreferences(): Promise<AlertPreferences[]> {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT * FROM hyro_alert_preferences ORDER BY alert_type
  `).all() as any[];

  return rows.map(mapPreferenceRow);
}

/**
 * Update alert preferences
 */
export async function updateAlertPreferences(
  prefs: Partial<AlertPreferences> & { alert_type: AlertType }
): Promise<void> {
  const db = getDatabase();

  const updates: string[] = [];
  const params: any[] = [];

  if (prefs.enabled !== undefined) {
    updates.push('enabled = ?');
    params.push(prefs.enabled ? 1 : 0);
  }

  if (prefs.email_enabled !== undefined) {
    updates.push('email_enabled = ?');
    params.push(prefs.email_enabled ? 1 : 0);
  }

  if (prefs.frequency) {
    updates.push('frequency = ?');
    params.push(prefs.frequency);
  }

  if (updates.length === 0) return;

  params.push(prefs.alert_type);

  db.prepare(`
    UPDATE hyro_alert_preferences
    SET ${updates.join(', ')}
    WHERE alert_type = ?
  `).run(...params);
}

// ============================================================================
// STREAK MANAGEMENT
// ============================================================================

/**
 * Update streak tracker after a session
 */
export async function updateStreakTracker(sessionTimestamp: number): Promise<void> {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const tracker = db.prepare(`
    SELECT * FROM hyro_streak_tracker WHERE id = 'singleton'
  `).get() as any;

  if (!tracker) {
    // Initialize
    db.prepare(`
      INSERT INTO hyro_streak_tracker (id, last_session_at, current_streak_days, longest_streak_days)
      VALUES ('singleton', ?, 1, 1)
    `).run(sessionTimestamp);
    return;
  }

  const daysSinceLastSession = Math.floor((sessionTimestamp - tracker.last_session_at) / 86400);

  let newStreak = tracker.current_streak_days;
  if (daysSinceLastSession === 1) {
    // Consecutive day
    newStreak += 1;
  } else if (daysSinceLastSession > 1) {
    // Streak broken
    newStreak = 1;
  }
  // Same day doesn't change streak

  const newLongest = Math.max(tracker.longest_streak_days, newStreak);

  db.prepare(`
    UPDATE hyro_streak_tracker
    SET last_session_at = ?,
        current_streak_days = ?,
        longest_streak_days = ?,
        updated_at = ?
    WHERE id = 'singleton'
  `).run(sessionTimestamp, newStreak, newLongest, now);
}

/**
 * Get current streak info
 */
export async function getStreakInfo(): Promise<{
  current_streak: number;
  longest_streak: number;
  last_session_at: number | null;
}> {
  const db = getDatabase();

  const tracker = db.prepare(`
    SELECT * FROM hyro_streak_tracker WHERE id = 'singleton'
  `).get() as any;

  if (!tracker) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_session_at: null,
    };
  }

  return {
    current_streak: tracker.current_streak_days,
    longest_streak: tracker.longest_streak_days,
    last_session_at: tracker.last_session_at,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function mapAlertRow(row: any): Alert {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    created_at: row.created_at,
    read_at: row.read_at || undefined,
    dismissed: !!row.dismissed,
    action_url: row.action_url || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    alert_key: row.alert_key || undefined,
  };
}

function mapPreferenceRow(row: any): AlertPreferences {
  return {
    alert_type: row.alert_type,
    enabled: !!row.enabled,
    email_enabled: !!row.email_enabled,
    frequency: row.frequency,
    last_sent_at: row.last_sent_at || undefined,
  };
}
