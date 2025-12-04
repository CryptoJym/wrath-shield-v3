'use client';

/**
 * BookLibrary Component
 * Displays book collection with filtering, progress indicators, and selection
 */

import { useState, useMemo } from 'react';
import { BookOpen, Clock, Trophy, Filter, Grid, List, Star, TrendingUp, Search } from 'lucide-react';

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

interface BookLibraryProps {
  books: BookWithProgress[];
  onSelectBook: (book: BookWithProgress) => void;
  selectedBookId?: string;
  loading?: boolean;
}

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'not_started' | 'in_progress' | 'completed';
type SortBy = 'title' | 'progress' | 'recent' | 'difficulty';

const difficultyColors: Record<string, string> = {
  beginner: '#10b981',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
};

const statColors: Record<string, string> = {
  math: '#ef4444',
  reading: '#3b82f6',
  writing: '#8b5cf6',
  science: '#10b981',
  social_studies: '#f59e0b',
  technology: '#06b6d4',
  critical_thinking: '#ec4899',
  creativity: '#f97316',
};

export function BookLibrary({ books, onSelectBook, selectedBookId, loading }: BookLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedBooks = useMemo(() => {
    let result = [...books];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.author.toLowerCase().includes(query) ||
          b.genre?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((b) => {
        const progress = b.progress?.progress_percent || 0;
        if (filterStatus === 'not_started') return progress === 0;
        if (filterStatus === 'in_progress') return progress > 0 && progress < 100;
        if (filterStatus === 'completed') return progress === 100;
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress':
          return (b.progress?.progress_percent || 0) - (a.progress?.progress_percent || 0);
        case 'recent':
          return (b.progress?.last_session_at || b.created_at) - (a.progress?.last_session_at || a.created_at);
        case 'difficulty':
          const diffOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          return (diffOrder[a.difficulty_level as keyof typeof diffOrder] || 2) -
                 (diffOrder[b.difficulty_level as keyof typeof diffOrder] || 2);
        default:
          return 0;
      }
    });

    return result;
  }, [books, filterStatus, sortBy, searchQuery]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <span>Loading library...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <BookOpen size={24} style={{ color: '#f59e0b' }} />
          Book Library
        </h2>
        <div style={styles.stats}>
          <span style={styles.statBadge}>
            {books.length} Books
          </span>
          <span style={{ ...styles.statBadge, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            {books.filter(b => b.progress?.progress_percent === 100).length} Completed
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        {/* Search */}
        <div style={styles.searchContainer}>
          <Search size={16} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Filters */}
        <div style={styles.filterGroup}>
          <Filter size={16} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            style={styles.select}
          >
            <option value="all">All Books</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            style={styles.select}
          >
            <option value="recent">Recently Active</option>
            <option value="title">Title A-Z</option>
            <option value="progress">By Progress</option>
            <option value="difficulty">By Difficulty</option>
          </select>
        </div>

        {/* View Toggle */}
        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              ...styles.viewButton,
              ...(viewMode === 'grid' ? styles.viewButtonActive : {}),
            }}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              ...styles.viewButton,
              ...(viewMode === 'list' ? styles.viewButtonActive : {}),
            }}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Book Grid/List */}
      {filteredAndSortedBooks.length === 0 ? (
        <div style={styles.emptyState}>
          <BookOpen size={48} style={{ opacity: 0.3 }} />
          <p>No books found</p>
          {searchQuery && <p style={{ fontSize: '0.875rem', opacity: 0.6 }}>Try a different search term</p>}
        </div>
      ) : (
        <div style={viewMode === 'grid' ? styles.grid : styles.list}>
          {filteredAndSortedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              viewMode={viewMode}
              isSelected={selectedBookId === book.id}
              onClick={() => onSelectBook(book)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BookCardProps {
  book: BookWithProgress;
  viewMode: ViewMode;
  isSelected: boolean;
  onClick: () => void;
}

function BookCard({ book, viewMode, isSelected, onClick }: BookCardProps) {
  const progress = book.progress?.progress_percent || 0;
  const isCompleted = progress === 100;
  const isInProgress = progress > 0 && progress < 100;

  const cardStyle = viewMode === 'grid' ? styles.gridCard : styles.listCard;

  return (
    <div
      onClick={onClick}
      style={{
        ...cardStyle,
        ...(isSelected ? styles.cardSelected : {}),
        cursor: 'pointer',
      }}
    >
      {/* Cover Image */}
      <div style={viewMode === 'grid' ? styles.coverGrid : styles.coverList}>
        {book.cover_image_url ? (
          <img src={book.cover_image_url} alt={book.title} style={styles.coverImage} />
        ) : (
          <div style={styles.coverPlaceholder}>
            <BookOpen size={viewMode === 'grid' ? 32 : 24} />
          </div>
        )}
        {isCompleted && (
          <div style={styles.completedBadge}>
            <Trophy size={12} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={styles.bookInfo}>
        <h3 style={styles.bookTitle}>{book.title}</h3>
        <p style={styles.bookAuthor}>{book.author}</p>

        {/* Stats Row */}
        <div style={styles.bookMeta}>
          {book.difficulty_level && (
            <span
              style={{
                ...styles.difficultyBadge,
                background: `${difficultyColors[book.difficulty_level]}20`,
                color: difficultyColors[book.difficulty_level],
              }}
            >
              {book.difficulty_level}
            </span>
          )}
          {book.stat_primary && (
            <span
              style={{
                ...styles.statBadgeSm,
                background: `${statColors[book.stat_primary] || '#666'}20`,
                color: statColors[book.stat_primary] || '#666',
              }}
            >
              {book.stat_primary.replace('_', ' ')}
            </span>
          )}
          {book.estimated_hours && (
            <span style={styles.timeBadge}>
              <Clock size={10} />
              {book.estimated_hours}h
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {(isInProgress || isCompleted) && (
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progress}%`,
                  background: isCompleted ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
            <span style={styles.progressText}>
              {isCompleted ? (
                <><Star size={10} /> Complete</>
              ) : (
                <>{Math.round(progress)}%</>
              )}
            </span>
          </div>
        )}

        {/* Time spent */}
        {book.progress && book.progress.total_time_minutes > 0 && (
          <div style={styles.timeSpent}>
            <TrendingUp size={12} />
            {Math.round(book.progress.total_time_minutes)} min read
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
  },
  stats: {
    display: 'flex',
    gap: '0.5rem',
  },
  statBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
  },
  controls: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchContainer: {
    position: 'relative',
    flex: '1 1 200px',
    minWidth: '150px',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#666',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem 0.5rem 2rem',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '0.875rem',
    outline: 'none',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#666',
  },
  select: {
    padding: '0.5rem',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  viewToggle: {
    display: 'flex',
    border: '1px solid #333',
    borderRadius: '0.375rem',
    overflow: 'hidden',
  },
  viewButton: {
    padding: '0.5rem',
    background: 'transparent',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  viewButtonActive: {
    background: '#333',
    color: '#fff',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  gridCard: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  },
  listCard: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  cardSelected: {
    borderColor: '#f59e0b',
    boxShadow: '0 0 0 1px #f59e0b',
  },
  coverGrid: {
    position: 'relative',
    height: '160px',
    background: '#0a0a0a',
  },
  coverList: {
    position: 'relative',
    width: '60px',
    height: '80px',
    borderRadius: '0.25rem',
    overflow: 'hidden',
    flexShrink: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
    color: '#444',
  },
  completedBadge: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    background: '#10b981',
    color: '#fff',
    padding: '0.25rem',
    borderRadius: '999px',
  },
  bookInfo: {
    padding: '0.75rem',
    flex: 1,
  },
  bookTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    margin: '0 0 0.25rem 0',
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  bookAuthor: {
    fontSize: '0.8125rem',
    color: '#888',
    margin: '0 0 0.5rem 0',
  },
  bookMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    marginBottom: '0.5rem',
  },
  difficultyBadge: {
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  statBadgeSm: {
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  timeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    background: 'rgba(255,255,255,0.05)',
    color: '#888',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  progressBar: {
    flex: 1,
    height: '4px',
    background: '#333',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.6875rem',
    color: '#888',
    minWidth: '50px',
  },
  timeSpent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.6875rem',
    color: '#666',
    marginTop: '0.25rem',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
    color: '#888',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #333',
    borderTopColor: '#f59e0b',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '0.5rem',
    color: '#666',
    textAlign: 'center',
  },
};

export default BookLibrary;
