'use client';

/**
 * HYRO FORGE: Reading System Page
 * Book library, reading sessions, and progress tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen, Clock, Trophy, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BookLibrary } from '@/components/forge/reading/BookLibrary';
import { ReadingSession } from '@/components/forge/reading/ReadingSession';

interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  difficulty_level?: string;
  page_count?: number;
  chapter_count?: number;
  estimated_hours?: number;
  cover_image_url?: string;
  description?: string;
  themes?: string[];
  status: string;
  stat_primary?: string;
  stat_secondary?: string;
  created_at: number;
}

interface BookProgress {
  book_id: string;
  total_pages_read: number;
  chapters_completed: number;
  total_time_minutes: number;
  sessions_count: number;
  progress_percent: number;
  current_chapter?: number;
  last_session_at?: number;
}

interface BookWithProgress extends Book {
  progress?: BookProgress;
}

interface Chapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title?: string;
  page_start?: number;
  page_end?: number;
  estimated_minutes?: number;
  status: string;
}

interface ReadingStats {
  total_books: number;
  books_completed: number;
  books_in_progress: number;
  total_pages_read: number;
  total_time_minutes: number;
  total_sessions: number;
  avg_session_minutes: number;
  avg_pages_per_session: number;
  streak_days: number;
}

type ViewMode = 'library' | 'reading';

export default function ReadingPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookWithProgress | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch library data
  const fetchLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/hyro/reading');
      if (!response.ok) throw new Error('Failed to fetch library');

      const data = await response.json();
      setBooks(data.library || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch book chapters
  const fetchChapters = useCallback(async (bookId: string) => {
    try {
      const response = await fetch(`/api/hyro/reading?action=chapters&bookId=${bookId}`);
      if (!response.ok) throw new Error('Failed to fetch chapters');

      const data = await response.json();
      setChapters(data.chapters || []);
    } catch (err) {
      console.error('Failed to fetch chapters:', err);
      setChapters([]);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Handle book selection
  const handleSelectBook = useCallback(async (book: BookWithProgress) => {
    setSelectedBook(book);
    await fetchChapters(book.id);
    setViewMode('reading');
  }, [fetchChapters]);

  // Start reading session
  const handleStartSession = useCallback(async (
    bookId: string,
    chapterId?: string,
    pagesStart?: number
  ) => {
    const response = await fetch('/api/hyro/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start-session',
        book_id: bookId,
        chapter_id: chapterId,
        pages_start: pagesStart,
      }),
    });

    if (!response.ok) throw new Error('Failed to start session');
    const data = await response.json();
    return data.session;
  }, []);

  // End reading session
  const handleEndSession = useCallback(async (
    sessionId: string,
    sessionData: {
      pages_end?: number;
      focus_self_rating?: number;
      interruption_count?: number;
      environment?: string;
    }
  ) => {
    const response = await fetch('/api/hyro/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'end-session',
        session_id: sessionId,
        ...sessionData,
      }),
    });

    if (!response.ok) throw new Error('Failed to end session');
    const data = await response.json();

    // Refresh library to update progress
    await fetchLibrary();

    return data;
  }, [fetchLibrary]);

  // Complete chapter
  const handleCompleteChapter = useCallback(async (
    chapterId: string,
    comprehension?: number
  ) => {
    const response = await fetch('/api/hyro/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'complete-chapter',
        chapter_id: chapterId,
        comprehension_score: comprehension,
      }),
    });

    if (!response.ok) throw new Error('Failed to complete chapter');

    // Refresh chapters
    if (selectedBook) {
      await fetchChapters(selectedBook.id);
    }
  }, [selectedBook, fetchChapters]);

  if (loading && books.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading reading system...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {viewMode === 'reading' ? (
            <button
              onClick={() => setViewMode('library')}
              style={styles.backButton}
            >
              <ArrowLeft size={20} />
              Back to Library
            </button>
          ) : (
            <Link href="/hyro/forge" style={styles.backButton}>
              <ArrowLeft size={20} />
              Back to Forge
            </Link>
          )}
          <h1 style={styles.title}>
            <BookOpen size={28} style={{ color: '#f59e0b' }} />
            Reading Forge
          </h1>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && viewMode === 'library' && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <BookOpen size={16} />
            <span style={styles.statValue}>{stats.total_books}</span>
            <span style={styles.statLabel}>Books</span>
          </div>
          <div style={styles.statItem}>
            <Trophy size={16} color="#10b981" />
            <span style={styles.statValue}>{stats.books_completed}</span>
            <span style={styles.statLabel}>Completed</span>
          </div>
          <div style={styles.statItem}>
            <Clock size={16} />
            <span style={styles.statValue}>{Math.round(stats.total_time_minutes / 60)}h</span>
            <span style={styles.statLabel}>Read</span>
          </div>
          <div style={styles.statItem}>
            <TrendingUp size={16} color="#f59e0b" />
            <span style={styles.statValue}>{stats.total_pages_read}</span>
            <span style={styles.statLabel}>Pages</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={fetchLibrary} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        {viewMode === 'library' ? (
          <BookLibrary
            books={books}
            onSelectBook={handleSelectBook}
            selectedBookId={selectedBook?.id}
            loading={loading}
          />
        ) : selectedBook ? (
          <ReadingSession
            book={selectedBook}
            chapters={chapters}
            currentChapter={chapters.find(c => c.status !== 'completed')}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onCompleteChapter={handleCompleteChapter}
          />
        ) : (
          <div style={styles.emptyState}>
            <BookOpen size={48} style={{ opacity: 0.3 }} />
            <p>Select a book to start reading</p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    gap: '1rem',
    color: '#888',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    color: '#888',
    textDecoration: 'none',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  statsBar: {
    display: 'flex',
    gap: '2rem',
    padding: '1rem',
    background: '#1a1a1a',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#888',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
  },
  statLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
  },
  retryButton: {
    padding: '0.5rem 1rem',
    background: '#ef4444',
    border: 'none',
    borderRadius: '0.375rem',
    color: '#fff',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    padding: '1rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    gap: '1rem',
    color: '#666',
    textAlign: 'center',
  },
};
