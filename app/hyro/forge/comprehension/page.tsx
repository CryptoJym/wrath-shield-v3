'use client';

/**
 * HYRO FORGE: Comprehension Discussion Page
 * AI-powered Socratic dialogue for reading comprehension
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MessageCircle, BookOpen, Loader2, Trophy, Clock, Brain } from 'lucide-react';
import Link from 'next/link';
import { ComprehensionChat, type Message } from '@/components/forge/comprehension';

interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  cover_image_url?: string;
  status: string;
}

interface Chapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title?: string;
  status: string;
}

interface ComprehensionStats {
  total_discussions: number;
  total_messages: number;
  insights_earned: number;
  xp_earned: number;
  avg_quality_score: number;
}

export default function ComprehensionPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<ComprehensionStats | null>(null);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch books with reading progress
  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/hyro/reading');
      if (!response.ok) throw new Error('Failed to fetch books');

      const data = await response.json();
      // Filter to only show books that are in progress or completed
      const eligibleBooks = (data.library || []).filter(
        (b: Book) => b.status === 'reading' || b.status === 'completed'
      );
      setBooks(eligibleBooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch chapters for selected book
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

  // Fetch comprehension history for book/chapter
  const fetchComprehensionHistory = useCallback(async (bookId: string, chapterId?: string) => {
    try {
      const params = new URLSearchParams({ book_id: bookId });
      if (chapterId) params.append('chapter_id', chapterId);

      const response = await fetch(`/api/hyro/comprehension?${params}`);
      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      setMessages(data.messages || []);
      setStats(data.stats || null);
      setSuggestedTopics(data.suggested_topics || [
        'What themes are present in this chapter?',
        'How does the main character develop?',
        'What literary devices does the author use?',
      ]);
    } catch (err) {
      console.error('Failed to fetch comprehension history:', err);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Handle book selection
  const handleSelectBook = useCallback(async (book: Book) => {
    setSelectedBook(book);
    setSelectedChapter(null);
    await fetchChapters(book.id);
    await fetchComprehensionHistory(book.id);
  }, [fetchChapters, fetchComprehensionHistory]);

  // Handle chapter selection
  const handleSelectChapter = useCallback(async (chapter: Chapter) => {
    setSelectedChapter(chapter);
    if (selectedBook) {
      await fetchComprehensionHistory(selectedBook.id, chapter.id);
    }
  }, [selectedBook, fetchComprehensionHistory]);

  // Send message to AI
  const handleSendMessage = useCallback(async (
    message: string,
    context?: { chapterId?: string }
  ) => {
    if (!selectedBook) throw new Error('No book selected');

    const response = await fetch('/api/hyro/comprehension', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'discuss',
        book_id: selectedBook.id,
        chapter_id: context?.chapterId || selectedChapter?.id,
        message,
      }),
    });

    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }, [selectedBook, selectedChapter]);

  if (loading && books.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading comprehension system...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link href="/hyro/forge" style={styles.backButton}>
            <ArrowLeft size={20} />
            Back to Forge
          </Link>
          <h1 style={styles.title}>
            <MessageCircle size={28} style={{ color: '#a78bfa' }} />
            Comprehension Discussion
          </h1>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <MessageCircle size={16} />
            <span style={styles.statValue}>{stats.total_discussions}</span>
            <span style={styles.statLabel}>Discussions</span>
          </div>
          <div style={styles.statItem}>
            <Brain size={16} color="#a78bfa" />
            <span style={styles.statValue}>{stats.insights_earned}</span>
            <span style={styles.statLabel}>Insights</span>
          </div>
          <div style={styles.statItem}>
            <Trophy size={16} color="#f59e0b" />
            <span style={styles.statValue}>{stats.xp_earned}</span>
            <span style={styles.statLabel}>XP Earned</span>
          </div>
          <div style={styles.statItem}>
            <Clock size={16} />
            <span style={styles.statValue}>{Math.round(stats.avg_quality_score * 100)}%</span>
            <span style={styles.statLabel}>Quality</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={fetchBooks} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        {/* Book Selection - shown when no book selected */}
        {!selectedBook ? (
          <div style={styles.bookSelection}>
            <h2 style={styles.sectionTitle}>Select a Book to Discuss</h2>
            <p style={styles.sectionSubtitle}>
              Choose from books you're currently reading or have completed.
            </p>

            {books.length === 0 ? (
              <div style={styles.emptyState}>
                <BookOpen size={48} style={{ opacity: 0.3 }} />
                <h3>No Books Available</h3>
                <p>Start reading a book first to unlock discussions.</p>
                <Link href="/hyro/forge/reading" style={styles.linkButton}>
                  Go to Reading Forge
                </Link>
              </div>
            ) : (
              <div style={styles.bookGrid}>
                {books.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleSelectBook(book)}
                    style={styles.bookCard}
                  >
                    <div style={styles.bookCover}>
                      {book.cover_image_url ? (
                        <img
                          src={book.cover_image_url}
                          alt={book.title}
                          style={styles.coverImage}
                        />
                      ) : (
                        <BookOpen size={32} style={{ opacity: 0.5 }} />
                      )}
                    </div>
                    <div style={styles.bookInfo}>
                      <h3 style={styles.bookTitle}>{book.title}</h3>
                      <p style={styles.bookAuthor}>{book.author}</p>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: book.status === 'completed'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(59, 130, 246, 0.15)',
                          color: book.status === 'completed' ? '#10b981' : '#60a5fa',
                        }}
                      >
                        {book.status === 'completed' ? 'Completed' : 'Reading'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Chat Interface */
          <div style={styles.chatLayout}>
            {/* Sidebar - Chapter Selection */}
            <div style={styles.sidebar}>
              <div style={styles.sidebarHeader}>
                <button
                  onClick={() => {
                    setSelectedBook(null);
                    setSelectedChapter(null);
                    setMessages([]);
                  }}
                  style={styles.changeBookButton}
                >
                  <ArrowLeft size={16} />
                  Change Book
                </button>
              </div>

              <div style={styles.currentBook}>
                <BookOpen size={18} color="#f59e0b" />
                <div>
                  <h3 style={styles.currentBookTitle}>{selectedBook.title}</h3>
                  <p style={styles.currentBookAuthor}>{selectedBook.author}</p>
                </div>
              </div>

              <div style={styles.chapterList}>
                <h4 style={styles.chapterListTitle}>Chapters</h4>
                <button
                  onClick={() => {
                    setSelectedChapter(null);
                    if (selectedBook) fetchComprehensionHistory(selectedBook.id);
                  }}
                  style={{
                    ...styles.chapterButton,
                    ...(selectedChapter === null ? styles.chapterButtonActive : {}),
                  }}
                >
                  <MessageCircle size={14} />
                  Entire Book
                </button>
                {chapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    onClick={() => handleSelectChapter(chapter)}
                    style={{
                      ...styles.chapterButton,
                      ...(selectedChapter?.id === chapter.id ? styles.chapterButtonActive : {}),
                    }}
                  >
                    <span style={styles.chapterNumber}>Ch {chapter.chapter_number}</span>
                    {chapter.title || `Chapter ${chapter.chapter_number}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div style={styles.chatArea}>
              <ComprehensionChat
                bookId={selectedBook.id}
                bookTitle={selectedBook.title}
                chapterId={selectedChapter?.id}
                chapterTitle={selectedChapter?.title || (selectedChapter ? `Chapter ${selectedChapter.chapter_number}` : undefined)}
                initialMessages={messages}
                suggestedTopics={suggestedTopics}
                onSendMessage={handleSendMessage}
              />
            </div>
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
    overflow: 'hidden',
  },
  bookSelection: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '2rem 0',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.5rem 0',
  },
  sectionSubtitle: {
    color: '#888',
    margin: '0 0 2rem 0',
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
    background: '#1a1a1a',
    borderRadius: '1rem',
    border: '1px solid #333',
  },
  linkButton: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    borderRadius: '0.5rem',
    color: '#000',
    textDecoration: 'none',
    fontWeight: 600,
    marginTop: '1rem',
  },
  bookGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  bookCard: {
    display: 'flex',
    gap: '1rem',
    padding: '1rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    width: '100%',
  },
  bookCover: {
    width: '60px',
    height: '80px',
    background: '#333',
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  bookInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  bookTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
  },
  bookAuthor: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#888',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    marginTop: '0.5rem',
    width: 'fit-content',
  },
  chatLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '1rem',
    height: 'calc(100vh - 160px)',
    maxHeight: '800px',
  },
  sidebar: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '1rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    overflow: 'hidden',
  },
  sidebarHeader: {
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #333',
  },
  changeBookButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '0.375rem',
    color: '#888',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
  },
  currentBook: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '0.5rem',
  },
  currentBookTitle: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#fff',
  },
  currentBookAuthor: {
    margin: 0,
    fontSize: '0.75rem',
    color: '#888',
  },
  chapterList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowY: 'auto',
  },
  chapterListTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '0.6875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#666',
  },
  chapterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.75rem',
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    color: '#ccc',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },
  chapterButtonActive: {
    background: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    color: '#a78bfa',
  },
  chapterNumber: {
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#888',
  },
  chatArea: {
    height: '100%',
    position: 'relative',
  },
};
