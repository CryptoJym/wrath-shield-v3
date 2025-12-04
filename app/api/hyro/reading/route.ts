/**
 * HYRO FORGE: Reading System API
 * Book library, reading sessions, and progress tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getLibrary,
  getBook,
  getBookWithProgress,
  addBookToLibrary,
  addChapter,
  getBookChapters,
  startReadingSession,
  endReadingSession,
  completeChapter,
  completeBook,
  getBookProgress,
  getChapterProgress,
  getRecentSessions,
  getReadingStats,
  getBooksInProgress,
} from '@/lib/hyro/forge-reading';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const bookId = searchParams.get('bookId');

    // Get library
    if (action === 'library') {
      const books = getLibrary();
      return NextResponse.json({ books, count: books.length });
    }

    // Get specific book with progress
    if (bookId && action === 'details') {
      const book = getBookWithProgress(bookId);
      if (!book) {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 });
      }
      return NextResponse.json({ book });
    }

    // Get book chapters
    if (bookId && action === 'chapters') {
      const chapters = getBookChapters(bookId);
      return NextResponse.json({ chapters, count: chapters.length });
    }

    // Get book progress
    if (bookId && action === 'progress') {
      const progress = getBookProgress(bookId);
      const chapterProgress = getChapterProgress(bookId);
      return NextResponse.json({ progress, chapter_progress: chapterProgress });
    }

    // Get recent sessions
    if (action === 'recent-sessions') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const sessions = getRecentSessions(limit);
      return NextResponse.json({ sessions, count: sessions.length });
    }

    // Get reading stats
    if (action === 'stats') {
      const stats = getReadingStats();
      return NextResponse.json(stats);
    }

    // Get books in progress
    if (action === 'in-progress') {
      const books = getBooksInProgress();
      return NextResponse.json({ books, count: books.length });
    }

    // Default: get library with stats
    const library = getLibrary();
    const stats = getReadingStats();
    const inProgress = getBooksInProgress();

    return NextResponse.json({
      library,
      stats,
      in_progress: inProgress,
      summary: {
        total_books: library.length,
        books_in_progress: inProgress.length,
      },
    });
  } catch (error) {
    console.error('Reading GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reading data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Add book to library
    if (action === 'add-book') {
      const { title, author, genre, difficulty_level, page_count, chapter_count, estimated_hours, cover_image_url, description, themes, source, external_id, stat_primary, stat_secondary } = body;
      if (!title || !author) {
        return NextResponse.json({ error: 'title and author are required' }, { status: 400 });
      }

      const book = addBookToLibrary({
        title, author, genre, difficulty_level, page_count, chapter_count,
        estimated_hours, cover_image_url, description, themes, source,
        external_id, stat_primary, stat_secondary,
      });

      return NextResponse.json({ book, message: `Added "${book.title}" to library` });
    }

    // Add chapter to book
    if (action === 'add-chapter') {
      const { book_id, chapter_number, title, page_start, page_end, estimated_minutes, key_concepts, discussion_hooks } = body;
      if (!book_id || chapter_number === undefined) {
        return NextResponse.json({ error: 'book_id and chapter_number are required' }, { status: 400 });
      }

      const chapter = addChapter({
        book_id, chapter_number, title, page_start, page_end,
        estimated_minutes, key_concepts, discussion_hooks,
      });

      return NextResponse.json({ chapter, message: `Added chapter ${chapter_number}` });
    }

    // Start reading session
    if (action === 'start-session') {
      const { book_id, chapter_id, pages_start } = body;
      if (!book_id) {
        return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
      }

      const session = startReadingSession(book_id, chapter_id, pages_start);
      return NextResponse.json({ session, message: 'Reading session started' });
    }

    // End reading session
    if (action === 'end-session') {
      const { session_id, pages_end, focus_self_rating, interruption_count, environment } = body;
      if (!session_id) {
        return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
      }

      const result = endReadingSession(session_id, {
        pages_end, focus_self_rating, interruption_count, environment,
      });

      return NextResponse.json({
        ...result,
        message: result.xp_earned > 0
          ? `Session ended! +${result.xp_earned} XP`
          : 'Session ended',
      });
    }

    // Complete chapter
    if (action === 'complete-chapter') {
      const { chapter_id, comprehension_score, discussion_depth } = body;
      if (!chapter_id) {
        return NextResponse.json({ error: 'chapter_id is required' }, { status: 400 });
      }

      const result = completeChapter(chapter_id, comprehension_score, discussion_depth);
      return NextResponse.json({
        ...result,
        message: `Chapter completed! +${result.xp_earned} XP`,
      });
    }

    // Complete book
    if (action === 'complete-book') {
      const { book_id } = body;
      if (!book_id) {
        return NextResponse.json({ error: 'book_id is required' }, { status: 400 });
      }

      const result = completeBook(book_id);
      return NextResponse.json({
        ...result,
        message: result.xp_earned > 0
          ? `Book completed! +${result.xp_earned} XP`
          : 'Book was already completed',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Reading POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process reading action' },
      { status: 500 }
    );
  }
}
