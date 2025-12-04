/**
 * HYRO FORGE: Daily Intel Feed
 * Educational content recommendations curated daily
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { awardXP } from './forge-xp';

// ============================================================================
// Types
// ============================================================================

export type ContentType = 'video' | 'article' | 'quiz' | 'fact' | 'challenge';
export type IntelStatus = 'new' | 'viewed' | 'engaged' | 'completed' | 'skipped';

export interface DailyIntel {
  id: string;
  intel_date: string;
  title: string;
  summary: string | null;
  content_type: ContentType;
  subject: string | null;
  difficulty: string;
  source_url: string | null;
  source_name: string | null;
  thumbnail_url: string | null;
  estimated_time_minutes: number | null;
  xp_reward: number;
  status: IntelStatus;
  viewed_at: number | null;
  completed_at: number | null;
  relevance_score: number | null;
  curation_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface IntelFeed {
  date: string;
  items: DailyIntel[];
  completion_stats: {
    total: number;
    completed: number;
    xp_earned: number;
    xp_available: number;
  };
}

// ============================================================================
// Daily Intel Functions
// ============================================================================

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Create a new intel item
 */
export function createIntelItem(params: {
  title: string;
  summary?: string;
  content_type: ContentType;
  subject?: string;
  difficulty?: string;
  source_url?: string;
  source_name?: string;
  thumbnail_url?: string;
  estimated_time_minutes?: number;
  xp_reward?: number;
  relevance_score?: number;
  curation_reason?: string;
  intel_date?: string;
}): DailyIntel {
  const db = getDatabase();
  const id = randomUUID();
  const intelDate = params.intel_date || getTodayDate();

  db.prepare(`
    INSERT INTO hyro_intel_items (
      id, intel_date, title, summary, content_type, subject, difficulty,
      source_url, source_name, thumbnail_url, estimated_time_minutes,
      xp_reward, relevance_score, curation_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    intelDate,
    params.title,
    params.summary || null,
    params.content_type,
    params.subject || null,
    params.difficulty || 'medium',
    params.source_url || null,
    params.source_name || null,
    params.thumbnail_url || null,
    params.estimated_time_minutes || null,
    params.xp_reward || 10,
    params.relevance_score || null,
    params.curation_reason || null
  );

  return getIntelItem(id)!;
}

/**
 * Get an intel item by ID
 */
export function getIntelItem(id: string): DailyIntel | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_intel_items WHERE id = ?`).get(id) as DailyIntel | null;
}

/**
 * Get the daily intel feed
 */
export function getDailyFeed(date?: string): IntelFeed {
  const db = getDatabase();
  const targetDate = date || getTodayDate();

  const items = db.prepare(`
    SELECT * FROM hyro_intel_items
    WHERE intel_date = ?
    ORDER BY relevance_score DESC NULLS LAST, created_at ASC
  `).all(targetDate) as DailyIntel[];

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'completed' THEN xp_reward ELSE 0 END) as xp_earned,
      SUM(xp_reward) as xp_available
    FROM hyro_intel_items
    WHERE intel_date = ?
  `).get(targetDate) as any;

  return {
    date: targetDate,
    items,
    completion_stats: {
      total: stats.total || 0,
      completed: stats.completed || 0,
      xp_earned: stats.xp_earned || 0,
      xp_available: stats.xp_available || 0,
    },
  };
}

/**
 * Mark intel item as viewed
 */
export function viewIntelItem(id: string): DailyIntel {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_intel_items
    SET status = 'viewed', viewed_at = ?, updated_at = unixepoch()
    WHERE id = ? AND status = 'new'
  `).run(now, id);

  return getIntelItem(id)!;
}

/**
 * Complete an intel item and award XP
 */
export function completeIntelItem(id: string): { intel: DailyIntel; xp_earned: number } {
  const db = getDatabase();
  const item = getIntelItem(id);

  if (!item) {
    throw new Error(`Intel item not found: ${id}`);
  }

  if (item.status === 'completed') {
    return { intel: item, xp_earned: 0 };
  }

  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_intel_items
    SET status = 'completed', completed_at = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(now, id);

  // Award XP
  awardXP(item.xp_reward, 'intel_completed', id);

  return {
    intel: getIntelItem(id)!,
    xp_earned: item.xp_reward,
  };
}

/**
 * Skip an intel item
 */
export function skipIntelItem(id: string): DailyIntel {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_intel_items
    SET status = 'skipped', updated_at = unixepoch()
    WHERE id = ?
  `).run(id);

  return getIntelItem(id)!;
}

/**
 * Get intel history for past N days
 */
export function getIntelHistory(days: number = 7): Array<{
  date: string;
  completed: number;
  total: number;
  xp_earned: number;
}> {
  const db = getDatabase();

  return db.prepare(`
    SELECT
      intel_date as date,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN xp_reward ELSE 0 END) as xp_earned
    FROM hyro_intel_items
    WHERE intel_date >= date('now', '-' || ? || ' days')
    GROUP BY intel_date
    ORDER BY intel_date DESC
  `).all(days) as any[];
}

// ============================================================================
// Sample Intel Generators
// ============================================================================

/**
 * Generate sample daily intel (would be AI-curated in production)
 */
export function generateSampleIntel(date?: string): DailyIntel[] {
  const targetDate = date || getTodayDate();
  const db = getDatabase();

  // Check if intel already exists for this date
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_intel_items WHERE intel_date = ?
  `).get(targetDate) as { count: number };

  if (existing.count > 0) {
    return getDailyFeed(targetDate).items;
  }

  // Sample content for different subjects
  const sampleContent = [
    {
      title: 'Math Mystery: The Fibonacci Sequence in Nature',
      summary: 'Discover how this famous number pattern appears in sunflowers, pinecones, and galaxies!',
      content_type: 'video' as ContentType,
      subject: 'math',
      difficulty: 'medium',
      estimated_time_minutes: 8,
      xp_reward: 15,
      source_name: 'Numberphile',
      relevance_score: 0.9,
      curation_reason: 'High engagement with pattern recognition topics',
    },
    {
      title: 'Fun Fact: Octopuses Have 3 Hearts!',
      summary: 'Learn about the amazing biology of one of the ocean\'s smartest creatures.',
      content_type: 'fact' as ContentType,
      subject: 'science',
      difficulty: 'easy',
      estimated_time_minutes: 2,
      xp_reward: 5,
      relevance_score: 0.7,
      curation_reason: 'Animal facts popular with this age group',
    },
    {
      title: 'Code Challenge: Build a Simple Calculator',
      summary: 'Use what you know about variables and functions to create a working calculator!',
      content_type: 'challenge' as ContentType,
      subject: 'coding',
      difficulty: 'medium',
      estimated_time_minutes: 20,
      xp_reward: 25,
      relevance_score: 0.85,
      curation_reason: 'Matches current coding skill level',
    },
    {
      title: 'Reading Adventure: The History of Comic Books',
      summary: 'From Superman to Spider-Man, explore how your favorite heroes came to be!',
      content_type: 'article' as ContentType,
      subject: 'reading',
      difficulty: 'easy',
      estimated_time_minutes: 10,
      xp_reward: 10,
      relevance_score: 0.8,
      curation_reason: 'Interests in superhero content detected',
    },
    {
      title: 'Quick Quiz: Test Your Geography Knowledge',
      summary: '10 questions about countries, capitals, and continents. How many can you get right?',
      content_type: 'quiz' as ContentType,
      subject: 'science',
      difficulty: 'medium',
      estimated_time_minutes: 5,
      xp_reward: 15,
      relevance_score: 0.75,
      curation_reason: 'Quizzes have high completion rate',
    },
  ];

  const created: DailyIntel[] = [];
  for (const content of sampleContent) {
    created.push(createIntelItem({ ...content, intel_date: targetDate }));
  }

  return created;
}
