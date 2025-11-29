/**
 * Hyro Agent Data Store
 *
 * SQLite-based storage for learning items, progress, and recommendations
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type {
  LearningItem,
  DailyRecommendation,
  LearningProgress,
  CrawlerConfig,
  SyncResult,
  LearningSource,
  TopicCategory,
  LearningStatus,
} from './types';

const dbPath = path.resolve(process.cwd(), '.data', 'hyro', 'hyro.db');

const schema = `
CREATE TABLE IF NOT EXISTS learning_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  published_at INTEGER,
  topics TEXT NOT NULL, -- JSON array
  difficulty TEXT NOT NULL,
  estimated_time_minutes INTEGER,
  status TEXT DEFAULT 'pending',
  progress_percent INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  notes TEXT,
  tags TEXT, -- JSON array
  priority_score REAL DEFAULT 0,
  confidence REAL DEFAULT 0,
  scheduled_for INTEGER
);
CREATE INDEX IF NOT EXISTS idx_learning_user ON learning_items(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_status ON learning_items(status);
CREATE INDEX IF NOT EXISTS idx_learning_scheduled ON learning_items(scheduled_for);

CREATE TABLE IF NOT EXISTS daily_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  created_at INTEGER NOT NULL,
  items TEXT NOT NULL, -- JSON array
  focus_topic TEXT,
  focus_description TEXT,
  accepted_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  total_time_minutes INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_daily_recs_user_date ON daily_recommendations(user_id, date);

CREATE TABLE IF NOT EXISTS crawler_configs (
  source TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  config TEXT NOT NULL, -- JSON
  last_sync_at INTEGER,
  last_success_at INTEGER,
  error_count INTEGER DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS sync_history (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  success INTEGER NOT NULL,
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  error TEXT,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_source ON sync_history(source, synced_at DESC);
`;

function getDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

function generateId(): string {
  return crypto.randomBytes(12).toString('hex');
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// ============================================================================
// Learning Items CRUD
// ============================================================================

export function createLearningItem(item: Omit<LearningItem, 'id' | 'created_at' | 'updated_at'>): LearningItem {
  const db = getDb();
  const id = generateId();
  const timestamp = now();

  const newItem: LearningItem = {
    ...item,
    id,
    created_at: timestamp,
    updated_at: timestamp,
  };

  db.prepare(`
    INSERT INTO learning_items (
      id, user_id, created_at, updated_at, source, source_url, title, description, author,
      published_at, topics, difficulty, estimated_time_minutes, status, progress_percent,
      started_at, completed_at, notes, tags, priority_score, confidence, scheduled_for
    ) VALUES (
      @id, @user_id, @created_at, @updated_at, @source, @source_url, @title, @description, @author,
      @published_at, @topics, @difficulty, @estimated_time_minutes, @status, @progress_percent,
      @started_at, @completed_at, @notes, @tags, @priority_score, @confidence, @scheduled_for
    )
  `).run({
    ...newItem,
    topics: JSON.stringify(newItem.topics),
    tags: JSON.stringify(newItem.tags),
    source_url: newItem.source_url || null,
    description: newItem.description || null,
    author: newItem.author || null,
    published_at: newItem.published_at || null,
    estimated_time_minutes: newItem.estimated_time_minutes || null,
    started_at: newItem.started_at || null,
    completed_at: newItem.completed_at || null,
    notes: newItem.notes || null,
    scheduled_for: newItem.scheduled_for || null,
  });

  db.close();
  return newItem;
}

export function updateLearningItem(
  id: string,
  updates: Partial<Omit<LearningItem, 'id' | 'created_at' | 'user_id'>>
): LearningItem | null {
  const db = getDb();
  const existing = getLearningItem(id);
  if (!existing) {
    db.close();
    return null;
  }

  const merged = { ...existing, ...updates, updated_at: now() };

  db.prepare(`
    UPDATE learning_items SET
      updated_at = @updated_at,
      source = @source,
      source_url = @source_url,
      title = @title,
      description = @description,
      author = @author,
      published_at = @published_at,
      topics = @topics,
      difficulty = @difficulty,
      estimated_time_minutes = @estimated_time_minutes,
      status = @status,
      progress_percent = @progress_percent,
      started_at = @started_at,
      completed_at = @completed_at,
      notes = @notes,
      tags = @tags,
      priority_score = @priority_score,
      confidence = @confidence,
      scheduled_for = @scheduled_for
    WHERE id = @id
  `).run({
    ...merged,
    topics: JSON.stringify(merged.topics),
    tags: JSON.stringify(merged.tags),
    source_url: merged.source_url || null,
    description: merged.description || null,
    author: merged.author || null,
    published_at: merged.published_at || null,
    estimated_time_minutes: merged.estimated_time_minutes || null,
    started_at: merged.started_at || null,
    completed_at: merged.completed_at || null,
    notes: merged.notes || null,
    scheduled_for: merged.scheduled_for || null,
  });

  db.close();
  return merged;
}

export function getLearningItem(id: string): LearningItem | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM learning_items WHERE id = ?').get(id) as any;
  db.close();

  if (!row) return null;

  return {
    ...row,
    topics: JSON.parse(row.topics),
    tags: JSON.parse(row.tags || '[]'),
  };
}

export function listLearningItems(options?: {
  user_id?: string;
  status?: LearningStatus;
  source?: LearningSource;
  limit?: number;
  offset?: number;
}): LearningItem[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (options?.user_id) {
    where.push('user_id = ?');
    params.push(options.user_id);
  }

  if (options?.status) {
    where.push('status = ?');
    params.push(options.status);
  }

  if (options?.source) {
    where.push('source = ?');
    params.push(options.source);
  }

  const sql = `
    SELECT * FROM learning_items
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY priority_score DESC, updated_at DESC
    ${options?.limit ? 'LIMIT ?' : ''}
    ${options?.offset ? 'OFFSET ?' : ''}
  `;

  if (options?.limit) params.push(options.limit);
  if (options?.offset) params.push(options.offset);

  const rows = db.prepare(sql).all(...params) as any[];
  db.close();

  return rows.map(row => ({
    ...row,
    topics: JSON.parse(row.topics),
    tags: JSON.parse(row.tags || '[]'),
  }));
}

// ============================================================================
// Daily Recommendations
// ============================================================================

export function createDailyRecommendation(rec: Omit<DailyRecommendation, 'id' | 'created_at'>): DailyRecommendation {
  const db = getDb();
  const id = generateId();
  const timestamp = now();

  const newRec: DailyRecommendation = {
    ...rec,
    id,
    created_at: timestamp,
  };

  db.prepare(`
    INSERT INTO daily_recommendations (
      id, user_id, date, created_at, items, focus_topic, focus_description,
      accepted_count, completed_count, total_time_minutes
    ) VALUES (
      @id, @user_id, @date, @created_at, @items, @focus_topic, @focus_description,
      @accepted_count, @completed_count, @total_time_minutes
    )
  `).run({
    ...newRec,
    items: JSON.stringify(newRec.items),
    focus_topic: newRec.focus_topic || null,
    focus_description: newRec.focus_description || null,
  });

  db.close();
  return newRec;
}

export function getDailyRecommendation(user_id: string, date: string): DailyRecommendation | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM daily_recommendations WHERE user_id = ? AND date = ?').get(user_id, date) as any;
  db.close();

  if (!row) return null;

  return {
    ...row,
    items: JSON.parse(row.items),
  };
}

export function updateDailyRecommendation(
  id: string,
  updates: Partial<Omit<DailyRecommendation, 'id' | 'user_id' | 'date' | 'created_at'>>
): DailyRecommendation | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM daily_recommendations WHERE id = ?').get(id) as any;
  if (!existing) {
    db.close();
    return null;
  }

  const merged = { ...existing, ...updates };
  if (updates.items) {
    merged.items = JSON.stringify(updates.items);
  }

  db.prepare(`
    UPDATE daily_recommendations SET
      items = @items,
      focus_topic = @focus_topic,
      focus_description = @focus_description,
      accepted_count = @accepted_count,
      completed_count = @completed_count,
      total_time_minutes = @total_time_minutes
    WHERE id = @id
  `).run({
    ...merged,
    focus_topic: merged.focus_topic || null,
    focus_description: merged.focus_description || null,
  });

  db.close();
  return {
    ...merged,
    items: JSON.parse(merged.items),
  };
}

// ============================================================================
// Progress Tracking
// ============================================================================

export function getLearningProgress(user_id: string): LearningProgress {
  const db = getDb();
  const items = listLearningItems({ user_id });

  const total = items.length;
  const completed = items.filter(i => i.status === 'completed').length;
  const inProgress = items.filter(i => i.status === 'in_progress').length;

  // Calculate total learning hours from completed items
  const totalMinutes = items
    .filter(i => i.status === 'completed')
    .reduce((sum, i) => sum + (i.estimated_time_minutes || 0), 0);

  // Calculate streak
  const completedSorted = items
    .filter(i => i.status === 'completed' && i.completed_at)
    .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0));

  let currentStreak = 0;
  let longestStreak = 0;
  let streakCount = 0;
  let lastDate: string | null = null;

  for (const item of completedSorted) {
    if (!item.completed_at) continue;
    const date = new Date(item.completed_at * 1000).toISOString().split('T')[0];

    if (!lastDate) {
      lastDate = date;
      streakCount = 1;
      currentStreak = 1;
    } else if (date === lastDate) {
      continue; // Same day
    } else {
      const dayDiff = Math.floor((new Date(lastDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff === 1) {
        streakCount++;
        currentStreak = Math.max(currentStreak, streakCount);
      } else {
        longestStreak = Math.max(longestStreak, streakCount);
        streakCount = 1;
      }
      lastDate = date;
    }
  }
  longestStreak = Math.max(longestStreak, streakCount);

  // By category
  const byCategory: LearningProgress['by_category'] = {} as any;
  const categories: TopicCategory[] = ['ai_ml', 'programming', 'business', 'health', 'productivity', 'science', 'engineering', 'philosophy', 'other'];

  for (const cat of categories) {
    const catItems = items.filter(i => i.topics.includes(cat));
    const catCompleted = catItems.filter(i => i.status === 'completed').length;
    const avgDiff = catItems.length > 0
      ? catItems.reduce((sum, i) => sum + (i.difficulty === 'beginner' ? 1 : i.difficulty === 'intermediate' ? 2 : i.difficulty === 'advanced' ? 3 : 4), 0) / catItems.length
      : 0;

    byCategory[cat] = {
      total: catItems.length,
      completed: catCompleted,
      avg_difficulty: avgDiff,
    };
  }

  // Recent activity
  const lastActivity = items.length > 0
    ? Math.max(...items.map(i => i.updated_at))
    : undefined;

  const weekAgo = now() - 7 * 24 * 60 * 60;
  const monthAgo = now() - 30 * 24 * 60 * 60;
  const itemsThisWeek = items.filter(i => i.status === 'completed' && (i.completed_at || 0) >= weekAgo).length;
  const itemsThisMonth = items.filter(i => i.status === 'completed' && (i.completed_at || 0) >= monthAgo).length;

  db.close();

  return {
    user_id,
    total_items: total,
    completed_items: completed,
    in_progress_items: inProgress,
    total_learning_hours: totalMinutes / 60,
    current_streak_days: currentStreak,
    longest_streak_days: longestStreak,
    by_category: byCategory,
    last_activity_at: lastActivity,
    items_completed_this_week: itemsThisWeek,
    items_completed_this_month: itemsThisMonth,
  };
}

// ============================================================================
// Crawler Config
// ============================================================================

export function upsertCrawlerConfig(config: CrawlerConfig): void {
  const db = getDb();

  db.prepare(`
    INSERT INTO crawler_configs (source, enabled, config, last_sync_at, last_success_at, error_count, last_error)
    VALUES (@source, @enabled, @config, @last_sync_at, @last_success_at, @error_count, @last_error)
    ON CONFLICT(source) DO UPDATE SET
      enabled = excluded.enabled,
      config = excluded.config,
      last_sync_at = excluded.last_sync_at,
      last_success_at = excluded.last_success_at,
      error_count = excluded.error_count,
      last_error = excluded.last_error
  `).run({
    source: config.source,
    enabled: config.enabled ? 1 : 0,
    config: JSON.stringify(config.config),
    last_sync_at: config.last_sync_at || null,
    last_success_at: config.last_success_at || null,
    error_count: config.error_count,
    last_error: config.last_error || null,
  });

  db.close();
}

export function getCrawlerConfig(source: LearningSource): CrawlerConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM crawler_configs WHERE source = ?').get(source) as any;
  db.close();

  if (!row) return null;

  return {
    source: row.source,
    enabled: !!row.enabled,
    config: JSON.parse(row.config),
    last_sync_at: row.last_sync_at,
    last_success_at: row.last_success_at,
    error_count: row.error_count,
    last_error: row.last_error,
  };
}

export function listCrawlerConfigs(): CrawlerConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM crawler_configs').all() as any[];
  db.close();

  return rows.map(row => ({
    source: row.source,
    enabled: !!row.enabled,
    config: JSON.parse(row.config),
    last_sync_at: row.last_sync_at,
    last_success_at: row.last_success_at,
    error_count: row.error_count,
    last_error: row.last_error,
  }));
}

// ============================================================================
// Sync History
// ============================================================================

export function recordSyncResult(result: SyncResult): void {
  const db = getDb();
  const id = generateId();

  db.prepare(`
    INSERT INTO sync_history (id, source, success, items_found, items_new, items_updated, error, synced_at)
    VALUES (@id, @source, @success, @items_found, @items_new, @items_updated, @error, @synced_at)
  `).run({
    id,
    source: result.source,
    success: result.success ? 1 : 0,
    items_found: result.items_found,
    items_new: result.items_new,
    items_updated: result.items_updated,
    error: result.error || null,
    synced_at: result.synced_at,
  });

  db.close();
}

export function getLastSyncResult(source: LearningSource): SyncResult | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sync_history WHERE source = ? ORDER BY synced_at DESC LIMIT 1').get(source) as any;
  db.close();

  if (!row) return null;

  return {
    source: row.source,
    success: !!row.success,
    items_found: row.items_found,
    items_new: row.items_new,
    items_updated: row.items_updated,
    error: row.error,
    synced_at: row.synced_at,
  };
}
