'use client';

/**
 * ReadingSession Component
 * Active reading interface with timer, progress tracking, and session controls
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, Square, Clock, BookOpen, ChevronRight,
  Star, Zap, Target, AlertCircle, CheckCircle
} from 'lucide-react';

interface Book {
  id: string;
  title: string;
  author: string;
  page_count?: number;
  chapter_count?: number;
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

interface Session {
  id: string;
  book_id: string;
  chapter_id?: string;
  pages_start?: number;
  started_at: number;
}

interface ReadingSessionProps {
  book: Book;
  chapters: Chapter[];
  currentChapter?: Chapter;
  activeSession?: Session;
  onStartSession: (bookId: string, chapterId?: string, pagesStart?: number) => Promise<Session>;
  onEndSession: (sessionId: string, data: EndSessionData) => Promise<SessionResult>;
  onCompleteChapter: (chapterId: string, comprehension?: number) => Promise<void>;
}

interface EndSessionData {
  pages_end?: number;
  focus_self_rating?: number;
  interruption_count?: number;
  environment?: string;
}

interface SessionResult {
  session: Session;
  duration_minutes: number;
  pages_read: number;
  xp_earned: number;
}

export function ReadingSession({
  book,
  chapters,
  currentChapter,
  activeSession,
  onStartSession,
  onEndSession,
  onCompleteChapter,
}: ReadingSessionProps) {
  const [session, setSession] = useState<Session | null>(activeSession || null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentPage, setCurrentPage] = useState<number>(
    activeSession?.pages_start || currentChapter?.page_start || 1
  );
  const [focusRating, setFocusRating] = useState<number>(3);
  const [interruptions, setInterruptions] = useState<number>(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  // Timer effect
  useEffect(() => {
    if (!session || isPaused) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [session, isPaused]);

  // Calculate elapsed time from session start
  useEffect(() => {
    if (session && !sessionResult) {
      const elapsed = Math.floor((Date.now() / 1000) - session.started_at);
      setElapsedSeconds(elapsed > 0 ? elapsed : 0);
    }
  }, [session, sessionResult]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const newSession = await onStartSession(
        book.id,
        currentChapter?.id,
        currentChapter?.page_start
      );
      setSession(newSession);
      setCurrentPage(newSession.pages_start || currentChapter?.page_start || 1);
      setElapsedSeconds(0);
      setSessionResult(null);
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [book.id, currentChapter, onStartSession, isLoading]);

  const handleEnd = useCallback(async () => {
    if (!session || isLoading) return;
    setIsLoading(true);
    try {
      const result = await onEndSession(session.id, {
        pages_end: currentPage,
        focus_self_rating: focusRating,
        interruption_count: interruptions,
        environment: 'home',
      });
      setSessionResult(result);
      setSession(null);
      setShowEndDialog(false);
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, currentPage, focusRating, interruptions, onEndSession, isLoading]);

  const handleCompleteChapter = useCallback(async () => {
    if (!currentChapter || isLoading) return;
    setIsLoading(true);
    try {
      await onCompleteChapter(currentChapter.id, focusRating * 20);
    } catch (error) {
      console.error('Failed to complete chapter:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentChapter, focusRating, onCompleteChapter, isLoading]);

  // Session completed view
  if (sessionResult) {
    return (
      <div style={styles.container}>
        <div style={styles.completedCard}>
          <div style={styles.completedIcon}>
            <CheckCircle size={48} color="#10b981" />
          </div>
          <h2 style={styles.completedTitle}>Reading Session Complete!</h2>

          <div style={styles.resultStats}>
            <div style={styles.resultStat}>
              <Clock size={20} />
              <span style={styles.resultValue}>{sessionResult.duration_minutes} min</span>
              <span style={styles.resultLabel}>Time</span>
            </div>
            <div style={styles.resultStat}>
              <BookOpen size={20} />
              <span style={styles.resultValue}>{sessionResult.pages_read}</span>
              <span style={styles.resultLabel}>Pages</span>
            </div>
            <div style={styles.resultStat}>
              <Zap size={20} color="#f59e0b" />
              <span style={{ ...styles.resultValue, color: '#f59e0b' }}>+{sessionResult.xp_earned}</span>
              <span style={styles.resultLabel}>XP Earned</span>
            </div>
          </div>

          <button
            onClick={() => setSessionResult(null)}
            style={styles.primaryButton}
          >
            Continue Reading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Book Info Header */}
      <div style={styles.bookHeader}>
        <div>
          <h2 style={styles.bookTitle}>{book.title}</h2>
          <p style={styles.bookAuthor}>{book.author}</p>
        </div>
        {currentChapter && (
          <div style={styles.chapterBadge}>
            Chapter {currentChapter.chapter_number}
            {currentChapter.title && `: ${currentChapter.title}`}
          </div>
        )}
      </div>

      {/* Timer Display */}
      <div style={styles.timerSection}>
        <div style={styles.timerDisplay}>
          <span style={styles.timerValue}>{formatTime(elapsedSeconds)}</span>
          <span style={styles.timerLabel}>
            {session ? (isPaused ? 'Paused' : 'Reading') : 'Ready'}
          </span>
        </div>
      </div>

      {/* Session Controls */}
      {!session ? (
        <div style={styles.startSection}>
          <button
            onClick={handleStart}
            disabled={isLoading}
            style={styles.startButton}
          >
            <Play size={24} />
            Start Reading Session
          </button>
          <p style={styles.hint}>
            Track your reading time and earn XP!
          </p>
        </div>
      ) : (
        <>
          {/* Active Session Controls */}
          <div style={styles.controlsRow}>
            <button
              onClick={() => setIsPaused(!isPaused)}
              style={styles.controlButton}
            >
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => setShowEndDialog(true)}
              style={{ ...styles.controlButton, borderColor: '#ef4444', color: '#ef4444' }}
            >
              <Square size={20} />
              End Session
            </button>
          </div>

          {/* Page Tracker */}
          <div style={styles.pageTracker}>
            <label style={styles.pageLabel}>Current Page</label>
            <div style={styles.pageInput}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                style={styles.pageButton}
              >
                -
              </button>
              <input
                type="number"
                value={currentPage}
                onChange={(e) => setCurrentPage(parseInt(e.target.value) || 1)}
                style={styles.pageNumber}
                min={1}
                max={book.page_count || 999}
              />
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                style={styles.pageButton}
              >
                +
              </button>
            </div>
            {book.page_count && (
              <span style={styles.pageTotal}>of {book.page_count}</span>
            )}
          </div>

          {/* Focus Rating */}
          <div style={styles.focusSection}>
            <label style={styles.focusLabel}>
              <Target size={16} />
              Focus Level
            </label>
            <div style={styles.focusStars}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setFocusRating(rating)}
                  style={{
                    ...styles.starButton,
                    color: rating <= focusRating ? '#f59e0b' : '#444',
                  }}
                >
                  <Star
                    size={24}
                    fill={rating <= focusRating ? '#f59e0b' : 'transparent'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Interruption Counter */}
          <div style={styles.interruptionSection}>
            <label style={styles.interruptionLabel}>
              <AlertCircle size={16} />
              Interruptions: {interruptions}
            </label>
            <button
              onClick={() => setInterruptions(interruptions + 1)}
              style={styles.interruptionButton}
            >
              +1 Interruption
            </button>
          </div>
        </>
      )}

      {/* Chapter List */}
      {chapters.length > 0 && (
        <div style={styles.chapterList}>
          <h3 style={styles.chapterListTitle}>Chapters</h3>
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              style={{
                ...styles.chapterItem,
                ...(currentChapter?.id === chapter.id ? styles.chapterItemActive : {}),
                ...(chapter.status === 'completed' ? styles.chapterItemCompleted : {}),
              }}
            >
              <div style={styles.chapterInfo}>
                <span style={styles.chapterNumber}>Ch. {chapter.chapter_number}</span>
                {chapter.title && <span style={styles.chapterTitle}>{chapter.title}</span>}
              </div>
              {chapter.status === 'completed' ? (
                <CheckCircle size={16} color="#10b981" />
              ) : (
                <ChevronRight size={16} style={{ opacity: 0.5 }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* End Session Dialog */}
      {showEndDialog && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>End Reading Session?</h3>
            <p style={styles.dialogText}>
              You've been reading for {formatTime(elapsedSeconds)}.
              {currentPage > (session?.pages_start || 1) && (
                <> That's {currentPage - (session?.pages_start || 1)} pages!</>
              )}
            </p>
            <div style={styles.dialogButtons}>
              <button
                onClick={() => setShowEndDialog(false)}
                style={styles.dialogCancel}
              >
                Keep Reading
              </button>
              <button
                onClick={handleEnd}
                disabled={isLoading}
                style={styles.dialogConfirm}
              >
                {isLoading ? 'Saving...' : 'End & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    padding: '1rem',
  },
  bookHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  bookTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    margin: 0,
  },
  bookAuthor: {
    fontSize: '0.875rem',
    color: '#888',
    margin: '0.25rem 0 0 0',
  },
  chapterBadge: {
    padding: '0.5rem 1rem',
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    borderRadius: '999px',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  timerSection: {
    display: 'flex',
    justifyContent: 'center',
    padding: '2rem 0',
  },
  timerDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  timerValue: {
    fontSize: '4rem',
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  timerLabel: {
    fontSize: '0.875rem',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  startSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  startButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '1.125rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  hint: {
    fontSize: '0.875rem',
    color: '#666',
    margin: 0,
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
  },
  controlButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    border: '2px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  pageTracker: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#1a1a1a',
    borderRadius: '0.5rem',
  },
  pageLabel: {
    fontSize: '0.875rem',
    color: '#888',
  },
  pageInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  pageButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#333',
    border: 'none',
    borderRadius: '0.25rem',
    color: '#fff',
    fontSize: '1.25rem',
    cursor: 'pointer',
  },
  pageNumber: {
    width: '60px',
    height: '32px',
    textAlign: 'center',
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '0.25rem',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
  },
  pageTotal: {
    fontSize: '0.875rem',
    color: '#666',
  },
  focusSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  focusLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#888',
  },
  focusStars: {
    display: 'flex',
    gap: '0.25rem',
  },
  starButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    transition: 'transform 0.2s',
  },
  interruptionSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
  },
  interruptionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#888',
  },
  interruptionButton: {
    padding: '0.5rem 1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '0.375rem',
    color: '#ef4444',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  chapterList: {
    borderTop: '1px solid #333',
    paddingTop: '1rem',
  },
  chapterListTitle: {
    fontSize: '0.875rem',
    color: '#888',
    margin: '0 0 0.75rem 0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  chapterItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem',
    background: '#1a1a1a',
    borderRadius: '0.375rem',
    marginBottom: '0.5rem',
    cursor: 'pointer',
  },
  chapterItemActive: {
    background: 'rgba(245, 158, 11, 0.1)',
    borderLeft: '3px solid #f59e0b',
  },
  chapterItemCompleted: {
    opacity: 0.6,
  },
  chapterInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  chapterNumber: {
    fontWeight: 600,
    color: '#888',
  },
  chapterTitle: {
    color: '#fff',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialog: {
    background: '#1a1a1a',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    maxWidth: '400px',
    width: '90%',
  },
  dialogTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 0.5rem 0',
  },
  dialogText: {
    fontSize: '0.9375rem',
    color: '#888',
    margin: '0 0 1.5rem 0',
  },
  dialogButtons: {
    display: 'flex',
    gap: '0.75rem',
  },
  dialogCancel: {
    flex: 1,
    padding: '0.75rem',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    color: '#fff',
    cursor: 'pointer',
  },
  dialogConfirm: {
    flex: 1,
    padding: '0.75rem',
    background: '#10b981',
    border: 'none',
    borderRadius: '0.375rem',
    color: '#fff',
    fontWeight: 500,
    cursor: 'pointer',
  },
  completedCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem 2rem',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(245, 158, 11, 0.1))',
    borderRadius: '1rem',
    textAlign: 'center',
  },
  completedIcon: {
    marginBottom: '1rem',
  },
  completedTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    margin: '0 0 1.5rem 0',
  },
  resultStats: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '2rem',
  },
  resultStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  resultValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  resultLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase',
  },
  primaryButton: {
    padding: '0.75rem 2rem',
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default ReadingSession;
