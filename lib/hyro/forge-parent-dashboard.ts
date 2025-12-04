/**
 * HYRO FORGE: Parent/Teacher Dashboard
 * Provides visibility into learning progress with weekly summaries,
 * trend analysis, benchmarking, and AI-powered insights.
 */

import { getDatabase } from '@/lib/db/Database';
import { StatName, STAT_NAMES, Achievement, XPSource } from './forge-types';
import { getSkillProficiency, compareToBenchmark } from './forge-proficiency';
import { getActivePatterns, BehaviorPattern } from './forge-analytics';
import { OpenRouterClient } from '@/lib/OpenRouterClient';

// ============================================================================
// Types
// ============================================================================

export interface WeeklySummary {
  period: {
    start: string;
    end: string;
  };
  stats: {
    xp_earned: number;
    time_minutes: number;
    sessions: number;
    streak_days: number;
    quests_completed: number;
  };
}

export interface TrendIndicator {
  stat_name: string;
  display_name: string;
  direction: 'up' | 'down' | 'stable';
  change_percent: number;
  current_value: number;
  previous_value: number;
}

export interface StrengthArea {
  stat_name: string;
  display_name: string;
  evidence: string;
  score: number;
  percentile: number;
}

export interface GrowthArea {
  stat_name: string;
  display_name: string;
  current: number;
  benchmark: number;
  gap: number;
  suggestion: string;
}

export interface ParentSummary {
  period: { start: string; end: string };
  stats: {
    xp_earned: number;
    time_minutes: number;
    sessions: number;
    streak_days: number;
    quests_completed: number;
  };
  trends: TrendIndicator[];
  strengths: StrengthArea[];
  growth_areas: GrowthArea[];
  recent_achievements: Achievement[];
  ai_insights: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get date range for the past week
 */
function getWeekRange(): { start: string; end: string; startTimestamp: number; endTimestamp: number } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const endTimestamp = Math.floor(now.getTime() / 1000);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const start = weekAgo.toISOString().split('T')[0];
  const startTimestamp = Math.floor(weekAgo.getTime() / 1000);

  return { start, end, startTimestamp, endTimestamp };
}

/**
 * Get date range for comparison period (7-14 days ago)
 */
function getComparisonRange(): { startTimestamp: number; endTimestamp: number } {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  return {
    startTimestamp: Math.floor(twoWeeksAgo.getTime() / 1000),
    endTimestamp: Math.floor(weekAgo.getTime() / 1000),
  };
}

/**
 * Get display name for stat
 */
function getStatDisplayName(statName: StatName): string {
  const displayNames: Record<StatName, string> = {
    math: 'Mathematics',
    reading: 'Reading',
    science: 'Science',
    coding: 'Coding',
    study_skills: 'Study Skills',
    critical_thinking: 'Critical Thinking',
    technology: 'Technology',
    problem_solving: 'Problem Solving',
  };
  return displayNames[statName];
}

// ============================================================================
// Weekly Summary
// ============================================================================

/**
 * Get weekly activity summary
 */
export function getWeeklySummary(): WeeklySummary {
  const db = getDatabase();
  const { start, end, startTimestamp, endTimestamp } = getWeekRange();

  // Get XP earned in period
  const xpResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_xp
    FROM hyro_xp_log
    WHERE created_at >= ? AND created_at <= ?
  `).get(startTimestamp, endTimestamp) as { total_xp: number };

  // Get session data from behavior events
  const sessionResult = db.prepare(`
    SELECT
      COUNT(DISTINCT session_id) as session_count,
      COALESCE(SUM(CAST(json_extract(event_data, '$.duration_minutes') as INTEGER)), 0) as total_minutes
    FROM hyro_behavior_events
    WHERE event_type = 'session_end'
      AND created_at >= ? AND created_at <= ?
      AND session_id IS NOT NULL
  `).get(startTimestamp, endTimestamp) as { session_count: number; total_minutes: number };

  // Get quests completed
  const questResult = db.prepare(`
    SELECT COUNT(*) as completed_quests
    FROM hyro_quests
    WHERE status = 'completed'
      AND completed_at >= ? AND completed_at <= ?
  `).get(startTimestamp, endTimestamp) as { completed_quests: number };

  // Get current streak
  const character = db.prepare(`
    SELECT current_streak FROM hyro_character LIMIT 1
  `).get() as { current_streak: number } | undefined;

  return {
    period: { start, end },
    stats: {
      xp_earned: xpResult.total_xp,
      time_minutes: sessionResult.total_minutes,
      sessions: sessionResult.session_count,
      streak_days: character?.current_streak || 0,
      quests_completed: questResult.completed_quests,
    },
  };
}

// ============================================================================
// Trend Analysis
// ============================================================================

/**
 * Get trend analysis comparing current week to previous week
 */
export function getTrendAnalysis(): TrendIndicator[] {
  const db = getDatabase();
  const currentWeek = getWeekRange();
  const previousWeek = getComparisonRange();

  const trends: TrendIndicator[] = [];

  for (const statName of STAT_NAMES) {
    // Get current week average
    const currentResult = db.prepare(`
      SELECT AVG(performance_score) as avg_score
      FROM hyro_skill_evidence
      WHERE stat_name = ?
        AND created_at >= ? AND created_at <= ?
    `).get(statName, currentWeek.startTimestamp, currentWeek.endTimestamp) as { avg_score: number | null };

    // Get previous week average
    const previousResult = db.prepare(`
      SELECT AVG(performance_score) as avg_score
      FROM hyro_skill_evidence
      WHERE stat_name = ?
        AND created_at >= ? AND created_at <= ?
    `).get(statName, previousWeek.startTimestamp, previousWeek.endTimestamp) as { avg_score: number | null };

    const currentValue = currentResult.avg_score || 0;
    const previousValue = previousResult.avg_score || 0;

    if (previousValue === 0) continue;

    const changePercent = ((currentValue - previousValue) / previousValue) * 100;

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (changePercent > 5) direction = 'up';
    else if (changePercent < -5) direction = 'down';

    trends.push({
      stat_name: statName,
      display_name: getStatDisplayName(statName),
      direction,
      change_percent: Math.round(changePercent),
      current_value: Math.round(currentValue),
      previous_value: Math.round(previousValue),
    });
  }

  return trends;
}

// ============================================================================
// Strengths & Growth Areas
// ============================================================================

/**
 * Get top 3 performing areas
 */
export function getTopStrengths(): StrengthArea[] {
  const strengths: StrengthArea[] = [];

  for (const statName of STAT_NAMES) {
    const proficiency = getSkillProficiency(statName);
    const benchmark = compareToBenchmark(statName);

    if (proficiency.level >= 70) {
      strengths.push({
        stat_name: statName,
        display_name: getStatDisplayName(statName),
        evidence: `Proficiency level of ${proficiency.level} with ${proficiency.evidence_count} activities`,
        score: proficiency.level,
        percentile: benchmark.percentile,
      });
    }
  }

  // Sort by score and take top 3
  return strengths
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Get areas needing attention (below benchmark)
 */
export function getGrowthAreas(): GrowthArea[] {
  const growthAreas: GrowthArea[] = [];

  for (const statName of STAT_NAMES) {
    const benchmark = compareToBenchmark(statName);

    if (benchmark.status === 'below') {
      const gap = benchmark.benchmark_level - benchmark.user_level;

      let suggestion = '';
      if (gap > 20) {
        suggestion = 'Focus on foundational concepts with guided practice';
      } else if (gap > 10) {
        suggestion = 'Increase practice frequency and variety';
      } else {
        suggestion = 'Continue current pace with challenging exercises';
      }

      growthAreas.push({
        stat_name: statName,
        display_name: getStatDisplayName(statName),
        current: benchmark.user_level,
        benchmark: benchmark.benchmark_level,
        gap,
        suggestion,
      });
    }
  }

  // Sort by gap size (largest first)
  return growthAreas.sort((a, b) => b.gap - a.gap);
}

// ============================================================================
// Benchmark Comparison
// ============================================================================

/**
 * Get benchmark comparison for all stats
 */
export function getBenchmarkComparison() {
  return STAT_NAMES.map(stat => compareToBenchmark(stat));
}

// ============================================================================
// Recent Achievements
// ============================================================================

/**
 * Get achievements earned in the past week
 */
export function getRecentAchievements(): Achievement[] {
  const db = getDatabase();
  const { startTimestamp, endTimestamp } = getWeekRange();

  const achievements = db.prepare(`
    SELECT a.*, ae.earned_at
    FROM hyro_achievements a
    INNER JOIN hyro_earned_achievements ae ON a.id = ae.achievement_id
    WHERE ae.earned_at >= ? AND ae.earned_at <= ?
    ORDER BY ae.earned_at DESC
    LIMIT 10
  `).all(startTimestamp, endTimestamp) as Achievement[];

  return achievements;
}

// ============================================================================
// AI Insights
// ============================================================================

/**
 * Generate AI-powered insights using LLM
 */
export async function generateAIInsights(summary: ParentSummary): Promise<string[]> {
  // Build context from summary
  const context = `
# Learning Summary for Week of ${summary.period.start}

## Activity Stats
- XP Earned: ${summary.stats.xp_earned}
- Study Time: ${summary.stats.time_minutes} minutes
- Sessions: ${summary.stats.sessions}
- Streak: ${summary.stats.streak_days} days
- Quests Completed: ${summary.stats.quests_completed}

## Trends
${summary.trends.map(t =>
  `- ${t.display_name}: ${t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'} ${t.change_percent > 0 ? '+' : ''}${t.change_percent}% (${t.previous_value} → ${t.current_value})`
).join('\n')}

## Strengths
${summary.strengths.map(s =>
  `- ${s.display_name}: ${s.score}/100 (${s.percentile}th percentile)`
).join('\n')}

## Growth Areas
${summary.growth_areas.map(g =>
  `- ${g.display_name}: ${g.current}/100 (benchmark: ${g.benchmark})`
).join('\n')}

## Recent Achievements
${summary.recent_achievements.map(a => `- ${a.name}`).join('\n')}
`.trim();

  const systemPrompt = 'You are an educational advisor. Return only valid JSON arrays.';
  const userPrompt = `You are an educational advisor reviewing a student's weekly progress. Based on the data below, provide 3-4 actionable insights for a parent or teacher. Focus on:

1. Patterns in engagement and performance
2. Areas showing progress worth celebrating
3. Specific suggestions for growth areas
4. Behavioral observations (study habits, consistency)

Be encouraging but honest. Each insight should be 1-2 sentences.

${context}

Return ONLY a JSON array of insight strings, no other text:`;

  try {
    // Build prompt manually for simpler AI insights
    const prompt = {
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      metadata: {
        date: new Date().toISOString(),
        has_whoop_data: false,
        has_manipulations: false,
        wrath_deployed: false,
        memory_count: 0,
        anchor_count: 0,
      },
    };

    const client = new OpenRouterClient();
    const response = await client.getCoachingResponse(prompt);

    // Parse JSON response
    const content = response.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const insights = JSON.parse(jsonMatch[0]) as string[];
      return insights.slice(0, 4); // Max 4 insights
    }

    // Fallback if parsing fails
    return [
      'Continue encouraging consistent study habits to maintain the current streak.',
      'Focus additional practice on areas below benchmark level.',
      'Celebrate recent achievements to maintain motivation.',
    ];
  } catch (error) {
    console.error('Failed to generate AI insights:', error);

    // Fallback insights based on data
    const insights: string[] = [];

    if (summary.stats.streak_days >= 7) {
      insights.push(`Excellent consistency with a ${summary.stats.streak_days}-day streak! This habit is key to long-term success.`);
    }

    if (summary.trends.filter(t => t.direction === 'up').length > 0) {
      const improving = summary.trends.filter(t => t.direction === 'up').map(t => t.display_name);
      insights.push(`Showing improvement in ${improving.join(' and ')}. Keep up the focused practice.`);
    }

    if (summary.growth_areas.length > 0) {
      const topGrowth = summary.growth_areas[0];
      insights.push(`${topGrowth.display_name} needs attention. ${topGrowth.suggestion}`);
    }

    if (summary.recent_achievements.length > 0) {
      insights.push(`Earned ${summary.recent_achievements.length} achievement${summary.recent_achievements.length > 1 ? 's' : ''} this week - great motivation!`);
    }

    return insights.slice(0, 4);
  }
}

// ============================================================================
// Complete Parent Summary
// ============================================================================

/**
 * Get complete parent dashboard summary
 */
export async function getParentSummary(): Promise<ParentSummary> {
  const weeklySummary = getWeeklySummary();
  const trends = getTrendAnalysis();
  const strengths = getTopStrengths();
  const growthAreas = getGrowthAreas();
  const recentAchievements = getRecentAchievements();

  const summary: ParentSummary = {
    period: weeklySummary.period,
    stats: weeklySummary.stats,
    trends,
    strengths,
    growth_areas: growthAreas,
    recent_achievements: recentAchievements,
    ai_insights: [], // Will be populated below
  };

  // Generate AI insights
  summary.ai_insights = await generateAIInsights(summary);

  return summary;
}

// ============================================================================
// Day-by-Day Breakdown
// ============================================================================

export interface DayBreakdown {
  date: string;
  xp_earned: number;
  time_minutes: number;
  sessions: number;
  quests_completed: number;
  activities: string[];
}

/**
 * Get day-by-day breakdown for the past week
 */
export function getWeeklyBreakdown(): DayBreakdown[] {
  const db = getDatabase();
  const { startTimestamp, endTimestamp } = getWeekRange();

  // Get all days in range
  const days: DayBreakdown[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayStart = Math.floor(date.setHours(0, 0, 0, 0) / 1000);
    const dayEnd = Math.floor(date.setHours(23, 59, 59, 999) / 1000);

    // Get XP for day
    const xpResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as xp
      FROM hyro_xp_log
      WHERE created_at >= ? AND created_at <= ?
    `).get(dayStart, dayEnd) as { xp: number };

    // Get session data
    const sessionResult = db.prepare(`
      SELECT
        COUNT(DISTINCT session_id) as sessions,
        COALESCE(SUM(CAST(json_extract(event_data, '$.duration_minutes') as INTEGER)), 0) as minutes
      FROM hyro_behavior_events
      WHERE event_type = 'session_end'
        AND created_at >= ? AND created_at <= ?
    `).get(dayStart, dayEnd) as { sessions: number; minutes: number };

    // Get quests completed
    const questResult = db.prepare(`
      SELECT COUNT(*) as quests
      FROM hyro_quests
      WHERE status = 'completed'
        AND completed_at >= ? AND completed_at <= ?
    `).get(dayStart, dayEnd) as { quests: number };

    // Get activity types
    const activities = db.prepare(`
      SELECT DISTINCT event_type
      FROM hyro_behavior_events
      WHERE created_at >= ? AND created_at <= ?
        AND event_type IN ('quest_completed', 'srs_review', 'reading_ended', 'comprehension_submitted')
    `).all(dayStart, dayEnd) as { event_type: string }[];

    days.push({
      date: dateStr,
      xp_earned: xpResult.xp,
      time_minutes: sessionResult.minutes,
      sessions: sessionResult.sessions,
      quests_completed: questResult.quests,
      activities: activities.map(a => a.event_type),
    });
  }

  return days;
}
