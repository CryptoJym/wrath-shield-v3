/**
 * HYRO FORGE: Behavioral Analytics Engine
 * Learn from patterns to optimize learning
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'quest_started'
  | 'quest_completed'
  | 'srs_review'
  | 'reading_started'
  | 'reading_ended'
  | 'comprehension_submitted'
  | 'discussion_started'
  | 'discussion_concluded'
  | 'level_up'
  | 'achievement_earned';

export type PatternType =
  | 'optimal_time'
  | 'struggle_subject'
  | 'engagement_decay'
  | 'session_length_optimal'
  | 'subject_affinity';

export type PredictionType =
  | 'session_success'
  | 'quest_difficulty'
  | 'optimal_next_activity';

export interface BehaviorEvent {
  id: string;
  event_type: EventType;
  event_data: string | null;  // JSON
  day_of_week: number;
  hour_of_day: number;
  session_id: string | null;
  device_type: string | null;
  created_at: number;
}

export interface BehaviorPattern {
  id: string;
  pattern_type: PatternType;
  pattern_data: string;  // JSON
  confidence: number;
  evidence_count: number;
  first_detected: number;
  last_confirmed: number;
  is_active: number;
}

export interface Prediction {
  id: string;
  prediction_type: PredictionType;
  prediction_data: string;  // JSON
  confidence: number;
  outcome_recorded: number;
  outcome_data: string | null;
  prediction_accuracy: number | null;
  created_at: number;
}

export interface TimeRange {
  start_hour: number;
  end_hour: number;
  days: number[];  // Day of week (0-6)
  confidence: number;
}

export interface Recommendation {
  type: 'activity' | 'timing' | 'break' | 'focus';
  title: string;
  description: string;
  priority: number;  // 1-5
  based_on: string;  // Pattern that generated this
}

// ============================================================================
// Event Logging
// ============================================================================

/**
 * Log a behavioral event
 */
export function logBehaviorEvent(
  eventType: EventType,
  eventData?: Record<string, any>,
  sessionId?: string,
  deviceType?: string
): BehaviorEvent {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);

  db.prepare(`
    INSERT INTO hyro_behavior_events (
      id, event_type, event_data, day_of_week, hour_of_day, session_id, device_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    eventType,
    eventData ? JSON.stringify(eventData) : null,
    now.getDay(),
    now.getHours(),
    sessionId || null,
    deviceType || null,
    timestamp
  );

  return db.prepare(`SELECT * FROM hyro_behavior_events WHERE id = ?`).get(id) as BehaviorEvent;
}

/**
 * Get recent events
 */
export function getRecentEvents(limit: number = 100): BehaviorEvent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_behavior_events
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as BehaviorEvent[];
}

/**
 * Get events by type
 */
export function getEventsByType(eventType: EventType, limit: number = 50): BehaviorEvent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_behavior_events
    WHERE event_type = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(eventType, limit) as BehaviorEvent[];
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect optimal study time pattern
 */
function detectOptimalTimePattern(): BehaviorPattern | null {
  const db = getDatabase();

  // Get successful activities by hour/day
  const hourStats = db.prepare(`
    SELECT
      hour_of_day,
      day_of_week,
      COUNT(*) as total_events,
      SUM(CASE WHEN json_extract(event_data, '$.success') = 1 THEN 1 ELSE 0 END) as success_events
    FROM hyro_behavior_events
    WHERE event_type IN ('quest_completed', 'srs_review', 'reading_ended', 'comprehension_submitted')
      AND created_at >= unixepoch() - (30 * 86400)  -- Last 30 days
    GROUP BY hour_of_day, day_of_week
    HAVING total_events >= 3
    ORDER BY success_events DESC, total_events DESC
  `).all() as any[];

  if (hourStats.length < 3) return null;

  // Find peak hours
  const peakHours = hourStats.slice(0, 5);
  const avgHour = Math.round(peakHours.reduce((sum, h) => sum + h.hour_of_day, 0) / peakHours.length);
  const days = [...new Set(peakHours.map(h => h.day_of_week))];
  const totalEvents = peakHours.reduce((sum, h) => sum + h.total_events, 0);
  const successRate = peakHours.reduce((sum, h) => sum + h.success_events, 0) / totalEvents;

  const patternData = {
    optimal_hours: [Math.max(0, avgHour - 1), avgHour, Math.min(23, avgHour + 1)],
    optimal_days: days,
    success_rate: successRate,
    sample_size: totalEvents,
  };

  return saveOrUpdatePattern('optimal_time', patternData, successRate, totalEvents);
}

/**
 * Detect struggle subject pattern
 */
function detectStrugglePattern(): BehaviorPattern | null {
  const db = getDatabase();

  // Get performance by subject
  const subjectStats = db.prepare(`
    SELECT
      json_extract(event_data, '$.subject') as subject,
      COUNT(*) as attempts,
      AVG(CAST(json_extract(event_data, '$.score') as REAL)) as avg_score,
      SUM(CASE WHEN json_extract(event_data, '$.success') = 0 THEN 1 ELSE 0 END) as failures
    FROM hyro_behavior_events
    WHERE event_type IN ('quest_completed', 'srs_review', 'comprehension_submitted')
      AND json_extract(event_data, '$.subject') IS NOT NULL
      AND created_at >= unixepoch() - (30 * 86400)
    GROUP BY subject
    HAVING attempts >= 5
    ORDER BY avg_score ASC
  `).all() as any[];

  if (subjectStats.length === 0) return null;

  // Find struggling subjects (below 60% avg score)
  const struggles = subjectStats.filter(s => s.avg_score < 60);
  if (struggles.length === 0) return null;

  const patternData = {
    struggling_subjects: struggles.map(s => ({
      subject: s.subject,
      avg_score: s.avg_score,
      attempts: s.attempts,
    })),
    most_difficult: struggles[0]?.subject,
  };

  const confidence = Math.min(1, struggles[0]?.attempts / 20);
  return saveOrUpdatePattern('struggle_subject', patternData, confidence, struggles.reduce((sum, s) => sum + s.attempts, 0));
}

/**
 * Detect engagement decay pattern
 */
function detectEngagementDecayPattern(): BehaviorPattern | null {
  const db = getDatabase();

  // Get session lengths over time
  const sessionStats = db.prepare(`
    SELECT
      date(created_at, 'unixepoch') as session_date,
      AVG(CAST(json_extract(event_data, '$.duration_minutes') as REAL)) as avg_duration,
      COUNT(*) as session_count
    FROM hyro_behavior_events
    WHERE event_type = 'session_end'
      AND json_extract(event_data, '$.duration_minutes') IS NOT NULL
      AND created_at >= unixepoch() - (14 * 86400)  -- Last 2 weeks
    GROUP BY session_date
    ORDER BY session_date DESC
  `).all() as any[];

  if (sessionStats.length < 5) return null;

  // Calculate trend
  const recent = sessionStats.slice(0, 3);
  const older = sessionStats.slice(3, 7);

  if (recent.length === 0 || older.length === 0) return null;

  const recentAvg = recent.reduce((sum, s) => sum + s.avg_duration, 0) / recent.length;
  const olderAvg = older.reduce((sum, s) => sum + s.avg_duration, 0) / older.length;
  const decayRate = (olderAvg - recentAvg) / olderAvg;

  // Only report if significant decay (>20%)
  if (decayRate < 0.2) return null;

  const patternData = {
    recent_avg_duration: recentAvg,
    older_avg_duration: olderAvg,
    decay_rate: decayRate,
    trend: 'declining',
  };

  const confidence = Math.min(1, sessionStats.length / 10);
  return saveOrUpdatePattern('engagement_decay', patternData, confidence, sessionStats.reduce((sum, s) => sum + s.session_count, 0));
}

/**
 * Detect optimal session length pattern
 */
function detectOptimalSessionLengthPattern(): BehaviorPattern | null {
  const db = getDatabase();

  // Correlate session length with performance
  const lengthPerformance = db.prepare(`
    SELECT
      CASE
        WHEN CAST(json_extract(event_data, '$.duration_minutes') as INTEGER) < 15 THEN 'short'
        WHEN CAST(json_extract(event_data, '$.duration_minutes') as INTEGER) < 30 THEN 'medium'
        WHEN CAST(json_extract(event_data, '$.duration_minutes') as INTEGER) < 45 THEN 'long'
        ELSE 'extended'
      END as length_category,
      AVG(CAST(json_extract(event_data, '$.focus_rating') as REAL)) as avg_focus,
      COUNT(*) as session_count
    FROM hyro_behavior_events
    WHERE event_type = 'session_end'
      AND json_extract(event_data, '$.duration_minutes') IS NOT NULL
      AND json_extract(event_data, '$.focus_rating') IS NOT NULL
      AND created_at >= unixepoch() - (30 * 86400)
    GROUP BY length_category
    HAVING session_count >= 3
    ORDER BY avg_focus DESC
  `).all() as any[];

  if (lengthPerformance.length < 2) return null;

  const optimal = lengthPerformance[0];
  const lengthRanges: Record<string, [number, number]> = {
    short: [0, 15],
    medium: [15, 30],
    long: [30, 45],
    extended: [45, 60],
  };

  const patternData = {
    optimal_category: optimal.length_category,
    optimal_range_minutes: lengthRanges[optimal.length_category] || [15, 30],
    avg_focus_by_length: Object.fromEntries(lengthPerformance.map(l => [l.length_category, l.avg_focus])),
  };

  const confidence = Math.min(1, optimal.session_count / 15);
  return saveOrUpdatePattern('session_length_optimal', patternData, confidence, lengthPerformance.reduce((sum, l) => sum + l.session_count, 0));
}

/**
 * Detect subject affinity pattern
 */
function detectSubjectAffinityPattern(): BehaviorPattern | null {
  const db = getDatabase();

  // Get engagement by subject
  const subjectEngagement = db.prepare(`
    SELECT
      json_extract(event_data, '$.subject') as subject,
      COUNT(*) as activity_count,
      AVG(CAST(json_extract(event_data, '$.score') as REAL)) as avg_score,
      SUM(CAST(json_extract(event_data, '$.duration_minutes') as INTEGER)) as total_time
    FROM hyro_behavior_events
    WHERE event_type IN ('quest_completed', 'srs_review', 'reading_ended', 'comprehension_submitted')
      AND json_extract(event_data, '$.subject') IS NOT NULL
      AND created_at >= unixepoch() - (30 * 86400)
    GROUP BY subject
    HAVING activity_count >= 5
    ORDER BY activity_count DESC, avg_score DESC
  `).all() as any[];

  if (subjectEngagement.length < 2) return null;

  const patternData = {
    favorite_subjects: subjectEngagement.slice(0, 3).map(s => s.subject),
    subject_stats: Object.fromEntries(subjectEngagement.map(s => [s.subject, {
      activity_count: s.activity_count,
      avg_score: s.avg_score,
      total_time: s.total_time,
    }])),
  };

  const confidence = Math.min(1, subjectEngagement[0]?.activity_count / 20);
  return saveOrUpdatePattern('subject_affinity', patternData, confidence, subjectEngagement.reduce((sum, s) => sum + s.activity_count, 0));
}

/**
 * Save or update a pattern
 */
function saveOrUpdatePattern(
  patternType: PatternType,
  patternData: Record<string, any>,
  confidence: number,
  evidenceCount: number
): BehaviorPattern {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Check for existing pattern
  const existing = db.prepare(`
    SELECT * FROM hyro_behavior_patterns WHERE pattern_type = ? AND is_active = 1
  `).get(patternType) as BehaviorPattern | null;

  if (existing) {
    db.prepare(`
      UPDATE hyro_behavior_patterns
      SET pattern_data = ?, confidence = ?, evidence_count = ?, last_confirmed = ?
      WHERE id = ?
    `).run(JSON.stringify(patternData), confidence, evidenceCount, now, existing.id);

    return db.prepare(`SELECT * FROM hyro_behavior_patterns WHERE id = ?`).get(existing.id) as BehaviorPattern;
  } else {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO hyro_behavior_patterns (
        id, pattern_type, pattern_data, confidence, evidence_count, first_detected, last_confirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, patternType, JSON.stringify(patternData), confidence, evidenceCount, now, now);

    return db.prepare(`SELECT * FROM hyro_behavior_patterns WHERE id = ?`).get(id) as BehaviorPattern;
  }
}

/**
 * Run all pattern detection algorithms
 */
export function detectPatterns(): BehaviorPattern[] {
  const patterns: BehaviorPattern[] = [];

  const optimalTime = detectOptimalTimePattern();
  if (optimalTime) patterns.push(optimalTime);

  const struggle = detectStrugglePattern();
  if (struggle) patterns.push(struggle);

  const decay = detectEngagementDecayPattern();
  if (decay) patterns.push(decay);

  const sessionLength = detectOptimalSessionLengthPattern();
  if (sessionLength) patterns.push(sessionLength);

  const affinity = detectSubjectAffinityPattern();
  if (affinity) patterns.push(affinity);

  return patterns;
}

/**
 * Get all active patterns
 */
export function getActivePatterns(): BehaviorPattern[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_behavior_patterns WHERE is_active = 1 ORDER BY confidence DESC
  `).all() as BehaviorPattern[];
}

// ============================================================================
// Recommendations
// ============================================================================

/**
 * Get optimal study time based on patterns
 */
export function getOptimalStudyTime(): TimeRange | null {
  const db = getDatabase();
  const pattern = db.prepare(`
    SELECT * FROM hyro_behavior_patterns
    WHERE pattern_type = 'optimal_time' AND is_active = 1
  `).get() as BehaviorPattern | null;

  if (!pattern) return null;

  try {
    const data = JSON.parse(pattern.pattern_data);
    return {
      start_hour: Math.min(...data.optimal_hours),
      end_hour: Math.max(...data.optimal_hours),
      days: data.optimal_days,
      confidence: pattern.confidence,
    };
  } catch {
    return null;
  }
}

/**
 * Generate personalized recommendations
 */
export function getPersonalizedRecommendations(): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const patterns = getActivePatterns();

  for (const pattern of patterns) {
    try {
      const data = JSON.parse(pattern.pattern_data);

      switch (pattern.pattern_type) {
        case 'optimal_time':
          recommendations.push({
            type: 'timing',
            title: 'Best Study Time',
            description: `You perform best between ${data.optimal_hours[0]}:00 and ${data.optimal_hours[data.optimal_hours.length - 1]}:00`,
            priority: 4,
            based_on: 'optimal_time',
          });
          break;

        case 'struggle_subject':
          if (data.most_difficult) {
            recommendations.push({
              type: 'focus',
              title: `Focus on ${data.most_difficult}`,
              description: `Your ${data.most_difficult} scores are lower than other subjects. Consider extra practice!`,
              priority: 5,
              based_on: 'struggle_subject',
            });
          }
          break;

        case 'engagement_decay':
          if (data.decay_rate > 0.2) {
            recommendations.push({
              type: 'break',
              title: 'Mix It Up',
              description: 'Your session lengths have been declining. Try shorter, more focused sessions or different activities.',
              priority: 3,
              based_on: 'engagement_decay',
            });
          }
          break;

        case 'session_length_optimal':
          const range = data.optimal_range_minutes;
          recommendations.push({
            type: 'timing',
            title: 'Optimal Session Length',
            description: `You focus best in ${range[0]}-${range[1]} minute sessions. Try setting a timer!`,
            priority: 3,
            based_on: 'session_length_optimal',
          });
          break;

        case 'subject_affinity':
          if (data.favorite_subjects?.length > 0) {
            recommendations.push({
              type: 'activity',
              title: 'Your Strengths',
              description: `You excel at ${data.favorite_subjects.slice(0, 2).join(' and ')}. Use these to build confidence!`,
              priority: 2,
              based_on: 'subject_affinity',
            });
          }
          break;
      }
    } catch {
      // Skip malformed pattern data
    }
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Predictions
// ============================================================================

/**
 * Predict success for an activity
 */
export function predictSessionSuccess(activityType: string): Prediction {
  const db = getDatabase();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay();

  // Get historical success at this time
  const historicalSuccess = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN json_extract(event_data, '$.success') = 1 THEN 1 ELSE 0 END) as successes
    FROM hyro_behavior_events
    WHERE hour_of_day = ?
      AND day_of_week = ?
      AND created_at >= unixepoch() - (30 * 86400)
  `).get(currentHour, currentDay) as { total: number; successes: number };

  let confidence = 0.5;  // Default
  let predictedSuccess = true;

  if (historicalSuccess.total >= 5) {
    const successRate = historicalSuccess.successes / historicalSuccess.total;
    confidence = Math.min(0.95, 0.5 + (historicalSuccess.total / 50));
    predictedSuccess = successRate >= 0.5;
  }

  const predictionData = {
    activity_type: activityType,
    current_hour: currentHour,
    current_day: currentDay,
    predicted_success: predictedSuccess,
    historical_sample: historicalSuccess.total,
  };

  db.prepare(`
    INSERT INTO hyro_predictions (id, prediction_type, prediction_data, confidence, created_at)
    VALUES (?, 'session_success', ?, ?, ?)
  `).run(id, JSON.stringify(predictionData), confidence, now);

  return db.prepare(`SELECT * FROM hyro_predictions WHERE id = ?`).get(id) as Prediction;
}

/**
 * Record prediction outcome
 */
export function recordPredictionOutcome(predictionId: string, success: boolean): void {
  const db = getDatabase();
  const prediction = db.prepare(`SELECT * FROM hyro_predictions WHERE id = ?`).get(predictionId) as Prediction | null;
  if (!prediction) return;

  try {
    const data = JSON.parse(prediction.prediction_data);
    const wasCorrect = data.predicted_success === success;

    db.prepare(`
      UPDATE hyro_predictions
      SET outcome_recorded = 1,
          outcome_data = ?,
          prediction_accuracy = ?
      WHERE id = ?
    `).run(
      JSON.stringify({ actual_success: success, was_correct: wasCorrect }),
      wasCorrect ? 1.0 : 0.0,
      predictionId
    );
  } catch {
    // Ignore
  }
}

/**
 * Get prediction accuracy stats
 */
export function getPredictionAccuracy(): { total: number; correct: number; accuracy: number } {
  const db = getDatabase();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN prediction_accuracy = 1.0 THEN 1 ELSE 0 END) as correct
    FROM hyro_predictions
    WHERE outcome_recorded = 1
  `).get() as { total: number; correct: number };

  return {
    total: stats.total || 0,
    correct: stats.correct || 0,
    accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
  };
}
