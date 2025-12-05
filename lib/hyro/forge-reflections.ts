/**
 * HYRO FORGE: Reflections & Metacognition Journal
 * Learning reflections and self-awareness tracking
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { awardXP } from './forge-xp';

// ============================================================================
// Types
// ============================================================================

export type ReflectionType = 'daily' | 'weekly' | 'quest_complete' | 'achievement' | 'milestone';
export type DifficultyLevel = 'easy' | 'medium' | 'deep';

export interface Reflection {
  id: string;
  reflection_type: ReflectionType;
  prompt: string | null;
  response: string | null;
  quest_id: string | null;
  achievement_id: string | null;
  stat_name: string | null;
  sentiment_score: number | null;
  key_insights: string | null;
  growth_indicators: string | null;
  word_count: number | null;
  time_spent_seconds: number | null;
  xp_earned: number;
  reflection_date: string;
  created_at: number;
  updated_at: number;
}

export interface ReflectionPrompt {
  id: string;
  prompt_type: ReflectionType;
  prompt_text: string;
  subject: string | null;
  difficulty_level: DifficultyLevel;
  is_active: number;
  use_count: number;
  created_at: number;
}

export interface ReflectionStats {
  total_reflections: number;
  this_week: number;
  this_month: number;
  total_words: number;
  average_sentiment: number;
  streak_days: number;
  total_xp_earned: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate simple sentiment score (-1 to 1) based on keyword analysis
 * This is a placeholder - in production would use AI analysis
 */
function analyzeSentiment(text: string): number {
  const positiveWords = [
    'good', 'great', 'awesome', 'amazing', 'happy', 'proud', 'excited',
    'learned', 'understand', 'improved', 'better', 'fun', 'interesting',
    'love', 'like', 'easy', 'success', 'accomplished', 'confident'
  ];
  const negativeWords = [
    'bad', 'hard', 'difficult', 'confused', 'frustrated', 'boring',
    'stuck', 'wrong', 'failed', 'hate', 'annoying', 'struggled',
    'don\'t understand', 'can\'t', 'impossible', 'tired'
  ];

  const lowerText = text.toLowerCase();
  let score = 0;
  let matches = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) {
      score += 1;
      matches++;
    }
  }
  for (const word of negativeWords) {
    if (lowerText.includes(word)) {
      score -= 1;
      matches++;
    }
  }

  if (matches === 0) return 0;
  return Math.max(-1, Math.min(1, score / matches));
}

/**
 * Extract key insights from reflection text
 * Placeholder - would use AI in production
 */
function extractInsights(text: string): string[] {
  const insights: string[] = [];
  const lowerText = text.toLowerCase();

  // Look for learning patterns
  if (lowerText.includes('learned') || lowerText.includes('understand')) {
    insights.push('Shows active learning engagement');
  }
  if (lowerText.includes('tried') || lowerText.includes('attempt')) {
    insights.push('Demonstrates persistence');
  }
  if (lowerText.includes('because') || lowerText.includes('reason')) {
    insights.push('Shows causal reasoning');
  }
  if (lowerText.includes('next time') || lowerText.includes('will try')) {
    insights.push('Forward-looking mindset');
  }
  if (lowerText.includes('helped') || lowerText.includes('strategy')) {
    insights.push('Identifies effective strategies');
  }

  return insights;
}

/**
 * Identify growth indicators in reflection
 */
function identifyGrowthIndicators(text: string): string[] {
  const indicators: string[] = [];
  const lowerText = text.toLowerCase();

  if (lowerText.includes('improve') || lowerText.includes('better')) {
    indicators.push('growth_mindset');
  }
  if (lowerText.includes('challenge') || lowerText.includes('difficult')) {
    indicators.push('embraces_challenges');
  }
  if (lowerText.includes('mistake') || lowerText.includes('wrong')) {
    indicators.push('learns_from_mistakes');
  }
  if (lowerText.includes('help') || lowerText.includes('ask')) {
    indicators.push('seeks_help');
  }
  if (lowerText.includes('proud') || lowerText.includes('accomplished')) {
    indicators.push('self_recognition');
  }

  return indicators;
}

// ============================================================================
// Prompt Functions
// ============================================================================

/**
 * Get a random prompt of specified type
 */
export function getRandomPrompt(type: ReflectionType, difficulty?: DifficultyLevel): ReflectionPrompt | null {
  const db = getDatabase();

  let query = `
    SELECT * FROM hyro_reflection_prompts
    WHERE prompt_type = ? AND is_active = 1
  `;
  const params: any[] = [type];

  if (difficulty) {
    query += ` AND difficulty_level = ?`;
    params.push(difficulty);
  }

  query += ` ORDER BY use_count ASC, RANDOM() LIMIT 1`;

  return db.prepare(query).get(...params) as ReflectionPrompt | null;
}

/**
 * Get all prompts of a type
 */
export function getPromptsByType(type: ReflectionType): ReflectionPrompt[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_reflection_prompts
    WHERE prompt_type = ? AND is_active = 1
    ORDER BY difficulty_level, prompt_text
  `).all(type) as ReflectionPrompt[];
}

/**
 * Create a custom prompt
 */
export function createPrompt(params: {
  prompt_type: ReflectionType;
  prompt_text: string;
  subject?: string;
  difficulty_level?: DifficultyLevel;
}): ReflectionPrompt {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_reflection_prompts (id, prompt_type, prompt_text, subject, difficulty_level)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    params.prompt_type,
    params.prompt_text,
    params.subject || null,
    params.difficulty_level || 'medium'
  );

  return db.prepare(`SELECT * FROM hyro_reflection_prompts WHERE id = ?`).get(id) as ReflectionPrompt;
}

/**
 * Increment prompt use count
 */
function incrementPromptUseCount(promptId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE hyro_reflection_prompts
    SET use_count = use_count + 1
    WHERE id = ?
  `).run(promptId);
}

// ============================================================================
// Reflection Functions
// ============================================================================

/**
 * Start a new reflection (returns prompt)
 */
export function startReflection(params: {
  reflection_type: ReflectionType;
  prompt_id?: string;
  quest_id?: string;
  achievement_id?: string;
  stat_name?: string;
}): { reflection_id: string; prompt: ReflectionPrompt | null } {
  const db = getDatabase();
  const id = randomUUID();
  const reflectionDate = getTodayDate();

  // Get prompt
  let prompt: ReflectionPrompt | null = null;
  if (params.prompt_id) {
    prompt = db.prepare(`SELECT * FROM hyro_reflection_prompts WHERE id = ?`).get(params.prompt_id) as ReflectionPrompt | null;
  } else {
    prompt = getRandomPrompt(params.reflection_type);
  }

  if (prompt) {
    incrementPromptUseCount(prompt.id);
  }

  // Create reflection record
  db.prepare(`
    INSERT INTO hyro_reflection_journal (
      id, reflection_type, prompt, quest_id, achievement_id, stat_name, reflection_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.reflection_type,
    prompt?.prompt_text || null,
    params.quest_id || null,
    params.achievement_id || null,
    params.stat_name || null,
    reflectionDate
  );

  return { reflection_id: id, prompt };
}

/**
 * Submit a reflection response
 */
export function submitReflection(
  reflectionId: string,
  response: string,
  timeSpentSeconds?: number
): { reflection: Reflection; xp_earned: number } {
  const db = getDatabase();

  const existing = db.prepare(`SELECT * FROM hyro_reflection_journal WHERE id = ?`).get(reflectionId) as Reflection | null;
  if (!existing) {
    throw new Error(`Reflection not found: ${reflectionId}`);
  }

  // Analyze the response
  const wordCount = countWords(response);
  const sentimentScore = analyzeSentiment(response);
  const insights = extractInsights(response);
  const growthIndicators = identifyGrowthIndicators(response);

  // Calculate XP based on word count and depth
  let xpEarned = 10; // Base XP
  if (wordCount >= 20) xpEarned += 5;
  if (wordCount >= 50) xpEarned += 10;
  if (wordCount >= 100) xpEarned += 10;
  if (insights.length >= 2) xpEarned += 5;
  if (growthIndicators.length >= 2) xpEarned += 5;

  // Update reflection
  db.prepare(`
    UPDATE hyro_reflection_journal
    SET
      response = ?,
      word_count = ?,
      time_spent_seconds = ?,
      sentiment_score = ?,
      key_insights = ?,
      growth_indicators = ?,
      xp_earned = ?,
      updated_at = unixepoch()
    WHERE id = ?
  `).run(
    response,
    wordCount,
    timeSpentSeconds || null,
    sentimentScore,
    JSON.stringify(insights),
    JSON.stringify(growthIndicators),
    xpEarned,
    reflectionId
  );

  // Award XP (TODO: add studentId to reflection functions for full multi-tenant)
  awardXP('hyro', xpEarned, 'reflection_completed', reflectionId);

  const reflection = db.prepare(`SELECT * FROM hyro_reflection_journal WHERE id = ?`).get(reflectionId) as Reflection;

  return { reflection, xp_earned: xpEarned };
}

/**
 * Get a reflection by ID
 */
export function getReflection(reflectionId: string): Reflection | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_reflection_journal WHERE id = ?`).get(reflectionId) as Reflection | null;
}

/**
 * Get today's reflection if exists
 */
export function getTodayReflection(type?: ReflectionType): Reflection | null {
  const db = getDatabase();
  const today = getTodayDate();

  let query = `SELECT * FROM hyro_reflection_journal WHERE reflection_date = ?`;
  const params: any[] = [today];

  if (type) {
    query += ` AND reflection_type = ?`;
    params.push(type);
  }

  query += ` ORDER BY created_at DESC LIMIT 1`;

  return db.prepare(query).get(...params) as Reflection | null;
}

/**
 * Get reflection history
 */
export function getReflectionHistory(params?: {
  limit?: number;
  type?: ReflectionType;
  startDate?: string;
  endDate?: string;
}): Reflection[] {
  const db = getDatabase();
  const limit = params?.limit || 30;

  let query = `SELECT * FROM hyro_reflection_journal WHERE 1=1`;
  const queryParams: any[] = [];

  if (params?.type) {
    query += ` AND reflection_type = ?`;
    queryParams.push(params.type);
  }
  if (params?.startDate) {
    query += ` AND reflection_date >= ?`;
    queryParams.push(params.startDate);
  }
  if (params?.endDate) {
    query += ` AND reflection_date <= ?`;
    queryParams.push(params.endDate);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  queryParams.push(limit);

  return db.prepare(query).all(...queryParams) as Reflection[];
}

/**
 * Get reflection statistics
 */
export function getReflectionStats(): ReflectionStats {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_reflections,
      SUM(CASE WHEN reflection_date >= date('now', '-7 days') THEN 1 ELSE 0 END) as this_week,
      SUM(CASE WHEN reflection_date >= date('now', '-30 days') THEN 1 ELSE 0 END) as this_month,
      SUM(COALESCE(word_count, 0)) as total_words,
      AVG(sentiment_score) as average_sentiment,
      SUM(xp_earned) as total_xp_earned
    FROM hyro_reflection_journal
    WHERE response IS NOT NULL
  `).get() as any;

  // Calculate streak
  const recentDates = db.prepare(`
    SELECT DISTINCT reflection_date
    FROM hyro_reflection_journal
    WHERE response IS NOT NULL
    ORDER BY reflection_date DESC
    LIMIT 30
  `).all() as { reflection_date: string }[];

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (recentDates.some(r => r.reflection_date === dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    total_reflections: stats.total_reflections || 0,
    this_week: stats.this_week || 0,
    this_month: stats.this_month || 0,
    total_words: stats.total_words || 0,
    average_sentiment: stats.average_sentiment || 0,
    streak_days: streak,
    total_xp_earned: stats.total_xp_earned || 0,
  };
}

/**
 * Get reflections for a specific quest
 */
export function getQuestReflections(questId: string): Reflection[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_reflection_journal
    WHERE quest_id = ?
    ORDER BY created_at DESC
  `).all(questId) as Reflection[];
}

/**
 * Get growth report summarizing recent reflections
 */
export function getGrowthReport(days: number = 30): {
  period_start: string;
  period_end: string;
  total_reflections: number;
  common_insights: string[];
  growth_areas: string[];
  sentiment_trend: number;
  recommendations: string[];
} {
  const db = getDatabase();
  const endDate = getTodayDate();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  const reflections = db.prepare(`
    SELECT * FROM hyro_reflection_journal
    WHERE reflection_date >= ? AND reflection_date <= ? AND response IS NOT NULL
    ORDER BY reflection_date ASC
  `).all(startDateStr, endDate) as Reflection[];

  // Aggregate insights and growth indicators
  const insightCounts: Record<string, number> = {};
  const growthCounts: Record<string, number> = {};
  let sentimentSum = 0;
  let sentimentCount = 0;

  for (const reflection of reflections) {
    if (reflection.key_insights) {
      try {
        const insights = JSON.parse(reflection.key_insights) as string[];
        for (const insight of insights) {
          insightCounts[insight] = (insightCounts[insight] || 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
    if (reflection.growth_indicators) {
      try {
        const indicators = JSON.parse(reflection.growth_indicators) as string[];
        for (const indicator of indicators) {
          growthCounts[indicator] = (growthCounts[indicator] || 0) + 1;
        }
      } catch {
        // Ignore parse errors
      }
    }
    if (reflection.sentiment_score !== null) {
      sentimentSum += reflection.sentiment_score;
      sentimentCount++;
    }
  }

  // Get top insights and growth areas
  const commonInsights = Object.entries(insightCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([insight]) => insight);

  const growthAreas = Object.entries(growthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area]) => area);

  // Generate recommendations based on patterns
  const recommendations: string[] = [];
  if (reflections.length < days / 3) {
    recommendations.push('Try to reflect more regularly - aim for at least every other day');
  }
  if (!growthCounts['growth_mindset']) {
    recommendations.push('Focus on how challenges help you grow');
  }
  if (!growthCounts['learns_from_mistakes']) {
    recommendations.push('Reflect on what you learn when things don\'t go as planned');
  }
  if (sentimentCount > 0 && sentimentSum / sentimentCount < 0) {
    recommendations.push('Look for positive moments in your learning journey');
  }

  return {
    period_start: startDateStr,
    period_end: endDate,
    total_reflections: reflections.length,
    common_insights: commonInsights,
    growth_areas: growthAreas,
    sentiment_trend: sentimentCount > 0 ? sentimentSum / sentimentCount : 0,
    recommendations,
  };
}
