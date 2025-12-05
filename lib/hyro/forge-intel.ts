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
export function createIntelItem(studentId: string, params: {
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
      id, student_id, intel_date, title, summary, content_type, subject, difficulty,
      source_url, source_name, thumbnail_url, estimated_time_minutes,
      xp_reward, relevance_score, curation_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    studentId,
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

  return getIntelItem(studentId, id)!;
}

/**
 * Get an intel item by ID
 */
export function getIntelItem(studentId: string, id: string): DailyIntel | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_intel_items WHERE student_id = ? AND id = ?`).get(studentId, id) as DailyIntel | null;
}

/**
 * Get the daily intel feed
 */
export function getDailyFeed(studentId: string, date?: string): IntelFeed {
  const db = getDatabase();
  const targetDate = date || getTodayDate();

  const items = db.prepare(`
    SELECT * FROM hyro_intel_items
    WHERE student_id = ? AND intel_date = ?
    ORDER BY relevance_score DESC NULLS LAST, created_at ASC
  `).all(studentId, targetDate) as DailyIntel[];

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'completed' THEN xp_reward ELSE 0 END) as xp_earned,
      SUM(xp_reward) as xp_available
    FROM hyro_intel_items
    WHERE student_id = ? AND intel_date = ?
  `).get(studentId, targetDate) as any;

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
export function viewIntelItem(studentId: string, id: string): DailyIntel {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE hyro_intel_items
    SET status = 'viewed', viewed_at = ?, updated_at = unixepoch()
    WHERE student_id = ? AND id = ? AND status = 'new'
  `).run(now, studentId, id);

  return getIntelItem(studentId, id)!;
}

/**
 * Complete an intel item and award XP
 */
export function completeIntelItem(studentId: string, id: string): { intel: DailyIntel; xp_earned: number } {
  const db = getDatabase();
  const item = getIntelItem(studentId, id);

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
    WHERE student_id = ? AND id = ?
  `).run(now, studentId, id);

  // Award XP
  awardXP(studentId, item.xp_reward, 'intel_completed', id);

  return {
    intel: getIntelItem(studentId, id)!,
    xp_earned: item.xp_reward,
  };
}

/**
 * Skip an intel item
 */
export function skipIntelItem(studentId: string, id: string): DailyIntel {
  const db = getDatabase();

  db.prepare(`
    UPDATE hyro_intel_items
    SET status = 'skipped', updated_at = unixepoch()
    WHERE student_id = ? AND id = ?
  `).run(studentId, id);

  return getIntelItem(studentId, id)!;
}

/**
 * Get intel history for past N days
 */
export function getIntelHistory(studentId: string, days: number = 7): Array<{
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
    WHERE student_id = ? AND intel_date >= date('now', '-' || ? || ' days')
    GROUP BY intel_date
    ORDER BY intel_date DESC
  `).all(studentId, days) as any[];
}

// ============================================================================
// Content Pool Types
// ============================================================================

interface ContentPoolItem {
  id: string;
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
  tags: string | null;
  times_used: number;
  last_used_date: string | null;
}

// ============================================================================
// Daily Intel Generator (From Content Pool)
// ============================================================================

/**
 * Generate daily intel from the content pool
 * Selects 5-7 items with variety across:
 * - Subjects (at least 3 different)
 * - Content types (mix of videos, facts, quizzes, challenges)
 * - Difficulty (mostly medium, some easy, one hard)
 */
export function generateDailyIntel(studentId: string, date?: string): DailyIntel[] {
  const targetDate = date || getTodayDate();
  const db = getDatabase();

  // Check if intel already exists for this date
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_intel_items WHERE student_id = ? AND intel_date = ?
  `).get(studentId, targetDate) as { count: number };

  if (existing.count > 0) {
    return getDailyFeed(studentId, targetDate).items;
  }

  // Use the date as a seed for deterministic selection
  const dateSeed = targetDate.split('-').join('');
  const numericSeed = parseInt(dateSeed, 10);

  // Get content from pool, prioritizing less-used items
  const poolItems = db.prepare(`
    SELECT * FROM hyro_intel_content_pool
    WHERE age_appropriate = 1
    ORDER BY
      times_used ASC,
      CASE
        WHEN last_used_date IS NULL THEN 0
        WHEN last_used_date < date('now', '-7 days') THEN 1
        ELSE 2
      END,
      RANDOM()
  `).all() as ContentPoolItem[];

  if (poolItems.length === 0) {
    // Fall back to sample intel if pool is empty
    return generateSampleIntel(studentId, targetDate);
  }

  // Select items with variety
  const selectedItems: ContentPoolItem[] = [];
  const usedSubjects = new Set<string>();
  const usedTypes = new Set<string>();
  const targetCount = 5 + (numericSeed % 3); // 5-7 items

  // Strategy: Pick items ensuring diversity
  // 1. One fun fact (quick engagement)
  // 2. One video (visual learning)
  // 3. One quiz or challenge (interactive)
  // 4-7. Mix of remaining items

  // Pick a fun fact
  const facts = poolItems.filter(i => i.content_type === 'fact');
  if (facts.length > 0) {
    const idx = numericSeed % facts.length;
    selectedItems.push(facts[idx]);
    if (facts[idx].subject) usedSubjects.add(facts[idx].subject);
    usedTypes.add('fact');
  }

  // Pick a video
  const videos = poolItems.filter(i => i.content_type === 'video' && !selectedItems.includes(i));
  if (videos.length > 0) {
    const idx = (numericSeed + 1) % videos.length;
    selectedItems.push(videos[idx]);
    if (videos[idx].subject) usedSubjects.add(videos[idx].subject);
    usedTypes.add('video');
  }

  // Pick a quiz or challenge
  const interactive = poolItems.filter(i =>
    (i.content_type === 'quiz' || i.content_type === 'challenge') && !selectedItems.includes(i)
  );
  if (interactive.length > 0) {
    const idx = (numericSeed + 2) % interactive.length;
    selectedItems.push(interactive[idx]);
    if (interactive[idx].subject) usedSubjects.add(interactive[idx].subject);
    usedTypes.add(interactive[idx].content_type);
  }

  // Fill remaining slots with variety
  const remaining = poolItems.filter(i => !selectedItems.includes(i));
  let offset = 3;

  while (selectedItems.length < targetCount && remaining.length > 0) {
    // Prefer items from unused subjects
    let candidates = remaining.filter(i => i.subject && !usedSubjects.has(i.subject));
    if (candidates.length === 0) {
      candidates = remaining;
    }

    const idx = (numericSeed + offset) % candidates.length;
    const item = candidates[idx];
    selectedItems.push(item);
    if (item.subject) usedSubjects.add(item.subject);
    usedTypes.add(item.content_type);

    // Remove from remaining
    const remIdx = remaining.indexOf(item);
    if (remIdx > -1) remaining.splice(remIdx, 1);
    offset++;
  }

  // Create intel items from selected pool items
  const created: DailyIntel[] = [];
  for (const poolItem of selectedItems) {
    // Calculate relevance score based on recency and usage
    const relevanceScore = Math.max(0.5, 1 - (poolItem.times_used * 0.1));

    const intel = createIntelItem(studentId, {
      title: poolItem.title,
      summary: poolItem.summary || undefined,
      content_type: poolItem.content_type,
      subject: poolItem.subject || undefined,
      difficulty: poolItem.difficulty,
      source_url: poolItem.source_url || undefined,
      source_name: poolItem.source_name || undefined,
      thumbnail_url: poolItem.thumbnail_url || undefined,
      estimated_time_minutes: poolItem.estimated_time_minutes || undefined,
      xp_reward: poolItem.xp_reward,
      relevance_score: relevanceScore,
      curation_reason: `Curated from content pool (${usedSubjects.size} subjects, ${usedTypes.size} content types)`,
      intel_date: targetDate,
    });

    created.push(intel);

    // Update pool item usage
    db.prepare(`
      UPDATE hyro_intel_content_pool
      SET times_used = times_used + 1, last_used_date = ?
      WHERE id = ?
    `).run(targetDate, poolItem.id);
  }

  return created;
}

// ============================================================================
// Sample Intel Generators (Legacy - for backwards compatibility)
// ============================================================================

/**
 * Generate sample daily intel (legacy function - use generateDailyIntel instead)
 */
export function generateSampleIntel(studentId: string, date?: string): DailyIntel[] {
  const targetDate = date || getTodayDate();
  const db = getDatabase();

  // Check if intel already exists for this date
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_intel_items WHERE student_id = ? AND intel_date = ?
  `).get(studentId, targetDate) as { count: number };

  if (existing.count > 0) {
    return getDailyFeed(studentId, targetDate).items;
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
    created.push(createIntelItem(studentId, { ...content, intel_date: targetDate }));
  }

  return created;
}
