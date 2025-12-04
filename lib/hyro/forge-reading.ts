/**
 * HYRO FORGE: Book & Reading System
 * Track deep reading engagement, not just page completion
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { awardXP } from './forge-xp';
import { StatName } from './forge-types';

// ============================================================================
// Types
// ============================================================================

export type DifficultyLevel = 'grade_4' | 'grade_5' | 'grade_6' | 'grade_7' | 'grade_8' | 'grade_9';
export type BookSource = 'boost' | 'assigned' | 'personal';
export type BookStatus = 'not_started' | 'reading' | 'completed' | 'abandoned';
export type ChapterStatus = 'not_started' | 'in_progress' | 'completed';
export type Environment = 'quiet' | 'noisy' | 'music' | 'other';

export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  difficulty_level: DifficultyLevel;
  page_count: number | null;
  chapter_count: number | null;
  estimated_hours: number | null;
  cover_image_url: string | null;
  description: string | null;
  themes: string | null;  // JSON array
  source: BookSource;
  external_id: string | null;
  stat_primary: StatName;
  stat_secondary: string | null;
  is_active: number;
  created_at: number;
}

export interface BookChapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string | null;
  page_start: number | null;
  page_end: number | null;
  estimated_minutes: number | null;
  key_concepts: string | null;  // JSON array
  discussion_hooks: string | null;  // JSON array
}

export interface ReadingSession {
  id: string;
  book_id: string;
  chapter_id: string | null;
  started_at: number;
  ended_at: number | null;
  duration_minutes: number | null;
  pages_start: number | null;
  pages_end: number | null;
  focus_self_rating: number | null;
  interruption_count: number;
  environment: Environment | null;
  comprehension_prompted: number;
  comprehension_response_id: string | null;
  xp_earned: number;
  created_at: number;
}

export interface ChapterProgress {
  id: string;
  book_id: string;
  chapter_id: string;
  status: ChapterStatus;
  first_read_at: number | null;
  completed_at: number | null;
  total_time_minutes: number;
  session_count: number;
  comprehension_score: number | null;
  discussion_depth: string | null;
  created_at: number;
  updated_at: number;
}

export interface BookProgress {
  id: string;
  book_id: string;
  status: BookStatus;
  started_at: number | null;
  completed_at: number | null;
  chapters_completed: number;
  total_time_minutes: number;
  session_count: number;
  current_page: number;
  average_comprehension: number | null;
  overall_depth: string | null;
  xp_earned: number;
  created_at: number;
  updated_at: number;
}

export interface SessionMetrics {
  pages_end?: number;
  focus_self_rating?: number;
  interruption_count?: number;
  environment?: Environment;
}

export interface BookWithProgress extends Book {
  progress: BookProgress | null;
  chapters: BookChapter[];
}

export interface ReadingStats {
  total_books: number;
  books_completed: number;
  books_in_progress: number;
  total_chapters: number;
  chapters_completed: number;
  total_reading_minutes: number;
  total_sessions: number;
  average_session_minutes: number;
  total_xp_earned: number;
  current_streak_days: number;
}

// ============================================================================
// XP Constants
// ============================================================================

const XP_PER_MINUTE = 1;
const XP_CAP_PER_BOOK_PER_DAY = 60;
const XP_CHAPTER_COMPLETION = 25;
const XP_FOCUS_BONUS_MULTIPLIER = 0.5;  // +50% for focus >= 4
const XP_DEEP_COMPREHENSION_MULTIPLIER = 0.5;  // +50% for deep discussion

const BOOK_COMPLETION_XP: Record<DifficultyLevel, number> = {
  grade_4: 100,
  grade_5: 150,
  grade_6: 200,
  grade_7: 300,
  grade_8: 400,
  grade_9: 500,
};

// ============================================================================
// Library Functions
// ============================================================================

/**
 * Get all books in the library
 */
export function getLibrary(activeOnly: boolean = true): Book[] {
  const db = getDatabase();
  const query = activeOnly
    ? `SELECT * FROM hyro_library WHERE is_active = 1 ORDER BY title`
    : `SELECT * FROM hyro_library ORDER BY title`;
  return db.prepare(query).all() as Book[];
}

/**
 * Get a book by ID
 */
export function getBook(bookId: string): Book | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_library WHERE id = ?`).get(bookId) as Book | null;
}

/**
 * Get a book with its progress and chapters
 */
export function getBookWithProgress(bookId: string): BookWithProgress | null {
  const book = getBook(bookId);
  if (!book) return null;

  const db = getDatabase();
  const progress = db.prepare(`SELECT * FROM hyro_book_progress WHERE book_id = ?`).get(bookId) as BookProgress | null;
  const chapters = db.prepare(`SELECT * FROM hyro_book_chapters WHERE book_id = ? ORDER BY chapter_number`).all(bookId) as BookChapter[];

  return { ...book, progress, chapters };
}

/**
 * Add a book to the library
 */
export function addBookToLibrary(params: {
  title: string;
  author: string;
  genre?: string;
  difficulty_level?: DifficultyLevel;
  page_count?: number;
  chapter_count?: number;
  estimated_hours?: number;
  cover_image_url?: string;
  description?: string;
  themes?: string[];
  source?: BookSource;
  external_id?: string;
  stat_primary?: StatName;
  stat_secondary?: string;
}): Book {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_library (
      id, title, author, genre, difficulty_level, page_count, chapter_count,
      estimated_hours, cover_image_url, description, themes, source,
      external_id, stat_primary, stat_secondary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.title,
    params.author,
    params.genre || null,
    params.difficulty_level || 'grade_6',
    params.page_count || null,
    params.chapter_count || null,
    params.estimated_hours || null,
    params.cover_image_url || null,
    params.description || null,
    params.themes ? JSON.stringify(params.themes) : null,
    params.source || 'personal',
    params.external_id || null,
    params.stat_primary || 'reading',
    params.stat_secondary || null
  );

  return getBook(id)!;
}

/**
 * Add a chapter to a book
 */
export function addChapter(params: {
  book_id: string;
  chapter_number: number;
  title?: string;
  page_start?: number;
  page_end?: number;
  estimated_minutes?: number;
  key_concepts?: string[];
  discussion_hooks?: string[];
}): BookChapter {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO hyro_book_chapters (
      id, book_id, chapter_number, title, page_start, page_end,
      estimated_minutes, key_concepts, discussion_hooks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.book_id,
    params.chapter_number,
    params.title || null,
    params.page_start || null,
    params.page_end || null,
    params.estimated_minutes || null,
    params.key_concepts ? JSON.stringify(params.key_concepts) : null,
    params.discussion_hooks ? JSON.stringify(params.discussion_hooks) : null
  );

  // Update book chapter count
  db.prepare(`
    UPDATE hyro_library
    SET chapter_count = (SELECT COUNT(*) FROM hyro_book_chapters WHERE book_id = ?)
    WHERE id = ?
  `).run(params.book_id, params.book_id);

  return db.prepare(`SELECT * FROM hyro_book_chapters WHERE id = ?`).get(id) as BookChapter;
}

/**
 * Get chapters for a book
 */
export function getBookChapters(bookId: string): BookChapter[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_book_chapters WHERE book_id = ? ORDER BY chapter_number
  `).all(bookId) as BookChapter[];
}

// ============================================================================
// Reading Session Functions
// ============================================================================

/**
 * Start a new reading session
 */
export function startReadingSession(
  bookId: string,
  chapterId?: string,
  pagesStart?: number
): ReadingSession {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const id = randomUUID();

  return db.transaction(() => {
    // Create session
    db.prepare(`
      INSERT INTO hyro_reading_sessions (id, book_id, chapter_id, started_at, pages_start)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, bookId, chapterId || null, now, pagesStart || null);

    // Ensure book progress exists
    const bookProgress = db.prepare(`SELECT * FROM hyro_book_progress WHERE book_id = ?`).get(bookId);
    if (!bookProgress) {
      db.prepare(`
        INSERT INTO hyro_book_progress (id, book_id, status, started_at)
        VALUES (?, ?, 'reading', ?)
      `).run(randomUUID(), bookId, now);
    } else if ((bookProgress as BookProgress).status === 'not_started') {
      db.prepare(`
        UPDATE hyro_book_progress SET status = 'reading', started_at = ?, updated_at = unixepoch()
        WHERE book_id = ?
      `).run(now, bookId);
    }

    // Ensure chapter progress exists if chapter specified
    if (chapterId) {
      const chapterProgress = db.prepare(`SELECT * FROM hyro_chapter_progress WHERE chapter_id = ?`).get(chapterId);
      if (!chapterProgress) {
        db.prepare(`
          INSERT INTO hyro_chapter_progress (id, book_id, chapter_id, status, first_read_at)
          VALUES (?, ?, ?, 'in_progress', ?)
        `).run(randomUUID(), bookId, chapterId, now);
      } else if ((chapterProgress as ChapterProgress).status === 'not_started') {
        db.prepare(`
          UPDATE hyro_chapter_progress SET status = 'in_progress', first_read_at = ?, updated_at = unixepoch()
          WHERE chapter_id = ?
        `).run(now, chapterId);
      }
    }

    return db.prepare(`SELECT * FROM hyro_reading_sessions WHERE id = ?`).get(id) as ReadingSession;
  });
}

/**
 * End a reading session and calculate XP
 */
export function endReadingSession(
  sessionId: string,
  metrics: SessionMetrics
): { session: ReadingSession; xp_earned: number; should_prompt_comprehension: boolean } {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return db.transaction(() => {
    const session = db.prepare(`SELECT * FROM hyro_reading_sessions WHERE id = ?`).get(sessionId) as ReadingSession;
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.ended_at) throw new Error(`Session already ended: ${sessionId}`);

    const durationSeconds = now - session.started_at;
    const durationMinutes = Math.floor(durationSeconds / 60);

    // Calculate XP
    let xpEarned = 0;
    const book = getBook(session.book_id);

    // Check daily XP cap for this book
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).getTime() / 1000;
    const todayXP = db.prepare(`
      SELECT COALESCE(SUM(xp_earned), 0) as total
      FROM hyro_reading_sessions
      WHERE book_id = ? AND started_at >= ?
    `).get(session.book_id, todayStart) as { total: number };

    const remainingDailyXP = Math.max(0, XP_CAP_PER_BOOK_PER_DAY - todayXP.total);

    // Base XP: 1 per minute
    let baseXP = Math.min(durationMinutes * XP_PER_MINUTE, remainingDailyXP);

    // Focus bonus: +50% for focus >= 4
    if (metrics.focus_self_rating && metrics.focus_self_rating >= 4) {
      baseXP = Math.floor(baseXP * (1 + XP_FOCUS_BONUS_MULTIPLIER));
    }

    xpEarned = Math.min(baseXP, remainingDailyXP);

    // Update session
    db.prepare(`
      UPDATE hyro_reading_sessions
      SET ended_at = ?, duration_minutes = ?, pages_end = ?,
          focus_self_rating = ?, interruption_count = ?, environment = ?, xp_earned = ?
      WHERE id = ?
    `).run(
      now,
      durationMinutes,
      metrics.pages_end || null,
      metrics.focus_self_rating || null,
      metrics.interruption_count || 0,
      metrics.environment || null,
      xpEarned,
      sessionId
    );

    // Update book progress
    db.prepare(`
      UPDATE hyro_book_progress
      SET total_time_minutes = total_time_minutes + ?,
          session_count = session_count + 1,
          current_page = COALESCE(?, current_page),
          xp_earned = xp_earned + ?,
          updated_at = unixepoch()
      WHERE book_id = ?
    `).run(durationMinutes, metrics.pages_end, xpEarned, session.book_id);

    // Update chapter progress if applicable
    if (session.chapter_id) {
      db.prepare(`
        UPDATE hyro_chapter_progress
        SET total_time_minutes = total_time_minutes + ?,
            session_count = session_count + 1,
            updated_at = unixepoch()
        WHERE chapter_id = ?
      `).run(durationMinutes, session.chapter_id);
    }

    // Award XP
    if (xpEarned > 0) {
      awardXP(xpEarned, 'reading_session', sessionId);
    }

    // Determine if we should prompt for comprehension (sessions >= 10 minutes)
    const shouldPromptComprehension = durationMinutes >= 10;

    if (shouldPromptComprehension) {
      db.prepare(`
        UPDATE hyro_reading_sessions SET comprehension_prompted = 1 WHERE id = ?
      `).run(sessionId);
    }

    return {
      session: db.prepare(`SELECT * FROM hyro_reading_sessions WHERE id = ?`).get(sessionId) as ReadingSession,
      xp_earned: xpEarned,
      should_prompt_comprehension: shouldPromptComprehension,
    };
  });
}

/**
 * Complete a chapter
 */
export function completeChapter(
  chapterId: string,
  comprehensionScore?: number,
  discussionDepth?: 'surface' | 'moderate' | 'deep'
): { chapter_progress: ChapterProgress; xp_earned: number } {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return db.transaction(() => {
    const chapter = db.prepare(`SELECT * FROM hyro_book_chapters WHERE id = ?`).get(chapterId) as BookChapter;
    if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

    let progress = db.prepare(`SELECT * FROM hyro_chapter_progress WHERE chapter_id = ?`).get(chapterId) as ChapterProgress | null;

    if (!progress) {
      // Create progress entry
      db.prepare(`
        INSERT INTO hyro_chapter_progress (id, book_id, chapter_id, status, first_read_at, completed_at, comprehension_score, discussion_depth)
        VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)
      `).run(randomUUID(), chapter.book_id, chapterId, now, now, comprehensionScore || null, discussionDepth || null);
    } else if (progress.status !== 'completed') {
      db.prepare(`
        UPDATE hyro_chapter_progress
        SET status = 'completed', completed_at = ?, comprehension_score = ?, discussion_depth = ?, updated_at = unixepoch()
        WHERE chapter_id = ?
      `).run(now, comprehensionScore || progress.comprehension_score, discussionDepth || progress.discussion_depth, chapterId);
    }

    // Calculate XP
    let xpEarned = XP_CHAPTER_COMPLETION;
    if (discussionDepth === 'deep') {
      xpEarned = Math.floor(xpEarned * (1 + XP_DEEP_COMPREHENSION_MULTIPLIER));
    }

    // Update book progress chapter count
    db.prepare(`
      UPDATE hyro_book_progress
      SET chapters_completed = (SELECT COUNT(*) FROM hyro_chapter_progress WHERE book_id = ? AND status = 'completed'),
          xp_earned = xp_earned + ?,
          updated_at = unixepoch()
      WHERE book_id = ?
    `).run(chapter.book_id, xpEarned, chapter.book_id);

    // Award XP
    const book = getBook(chapter.book_id);
    awardXP(xpEarned, 'chapter_completed', chapterId);

    // Check if book is now complete
    const bookProgress = db.prepare(`SELECT * FROM hyro_book_progress WHERE book_id = ?`).get(chapter.book_id) as BookProgress;
    const bookInfo = getBook(chapter.book_id);
    if (bookInfo && bookProgress.chapters_completed >= (bookInfo.chapter_count || 0)) {
      completeBook(chapter.book_id);
    }

    return {
      chapter_progress: db.prepare(`SELECT * FROM hyro_chapter_progress WHERE chapter_id = ?`).get(chapterId) as ChapterProgress,
      xp_earned: xpEarned,
    };
  });
}

/**
 * Complete a book
 */
export function completeBook(bookId: string): { book_progress: BookProgress; xp_earned: number } {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return db.transaction(() => {
    const book = getBook(bookId);
    if (!book) throw new Error(`Book not found: ${bookId}`);

    const progress = db.prepare(`SELECT * FROM hyro_book_progress WHERE book_id = ?`).get(bookId) as BookProgress;
    if (!progress) throw new Error(`No progress found for book: ${bookId}`);
    if (progress.status === 'completed') {
      return { book_progress: progress, xp_earned: 0 };
    }

    // Calculate completion XP
    const xpEarned = BOOK_COMPLETION_XP[book.difficulty_level];

    // Calculate average comprehension
    const comprehensionStats = db.prepare(`
      SELECT AVG(comprehension_score) as avg_score,
             GROUP_CONCAT(discussion_depth) as depths
      FROM hyro_chapter_progress
      WHERE book_id = ? AND comprehension_score IS NOT NULL
    `).get(bookId) as { avg_score: number | null; depths: string | null };

    let overallDepth = 'surface';
    if (comprehensionStats.depths) {
      const depthList = comprehensionStats.depths.split(',');
      const deepCount = depthList.filter(d => d === 'deep').length;
      const moderateCount = depthList.filter(d => d === 'moderate').length;
      if (deepCount > depthList.length / 2) overallDepth = 'deep';
      else if (moderateCount + deepCount > depthList.length / 2) overallDepth = 'moderate';
    }

    db.prepare(`
      UPDATE hyro_book_progress
      SET status = 'completed', completed_at = ?, average_comprehension = ?, overall_depth = ?,
          xp_earned = xp_earned + ?, updated_at = unixepoch()
      WHERE book_id = ?
    `).run(now, comprehensionStats.avg_score, overallDepth, xpEarned, bookId);

    // Award XP
    awardXP(xpEarned, 'book_completed', bookId);

    return {
      book_progress: db.prepare(`SELECT * FROM hyro_book_progress WHERE book_id = ?`).get(bookId) as BookProgress,
      xp_earned: xpEarned,
    };
  });
}

// ============================================================================
// Stats Functions
// ============================================================================

/**
 * Get book progress
 */
export function getBookProgress(bookId: string): BookProgress | null {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM hyro_book_progress WHERE book_id = ?`).get(bookId) as BookProgress | null;
}

/**
 * Get chapter progress for a book
 */
export function getChapterProgress(bookId: string): ChapterProgress[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT cp.* FROM hyro_chapter_progress cp
    JOIN hyro_book_chapters bc ON cp.chapter_id = bc.id
    WHERE cp.book_id = ?
    ORDER BY bc.chapter_number
  `).all(bookId) as ChapterProgress[];
}

/**
 * Get recent reading sessions
 */
export function getRecentSessions(limit: number = 10): ReadingSession[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM hyro_reading_sessions
    WHERE ended_at IS NOT NULL
    ORDER BY ended_at DESC
    LIMIT ?
  `).all(limit) as ReadingSession[];
}

/**
 * Get reading statistics
 */
export function getReadingStats(): ReadingStats {
  const db = getDatabase();

  const bookStats = db.prepare(`
    SELECT
      COUNT(*) as total_books,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as books_completed,
      SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) as books_in_progress,
      SUM(chapters_completed) as chapters_completed,
      SUM(total_time_minutes) as total_reading_minutes,
      SUM(session_count) as total_sessions,
      SUM(xp_earned) as total_xp_earned
    FROM hyro_book_progress
  `).get() as any;

  const totalChapters = db.prepare(`SELECT COUNT(*) as count FROM hyro_book_chapters`).get() as { count: number };

  // Calculate streak
  const recentDates = db.prepare(`
    SELECT DISTINCT date(started_at, 'unixepoch') as session_date
    FROM hyro_reading_sessions
    WHERE ended_at IS NOT NULL
    ORDER BY session_date DESC
    LIMIT 30
  `).all() as { session_date: string }[];

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];

    if (recentDates.some(r => r.session_date === dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    total_books: bookStats.total_books || 0,
    books_completed: bookStats.books_completed || 0,
    books_in_progress: bookStats.books_in_progress || 0,
    total_chapters: totalChapters.count || 0,
    chapters_completed: bookStats.chapters_completed || 0,
    total_reading_minutes: bookStats.total_reading_minutes || 0,
    total_sessions: bookStats.total_sessions || 0,
    average_session_minutes: bookStats.total_sessions > 0
      ? Math.round(bookStats.total_reading_minutes / bookStats.total_sessions)
      : 0,
    total_xp_earned: bookStats.total_xp_earned || 0,
    current_streak_days: streak,
  };
}

/**
 * Get books currently being read
 */
export function getBooksInProgress(): BookWithProgress[] {
  const db = getDatabase();
  const progresses = db.prepare(`
    SELECT bp.book_id FROM hyro_book_progress bp
    WHERE bp.status = 'reading'
    ORDER BY bp.updated_at DESC
  `).all() as { book_id: string }[];

  return progresses.map(p => getBookWithProgress(p.book_id)!).filter(Boolean);
}
