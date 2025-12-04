'use client';

/**
 * HYRO FORGE: SRS Flashcard Review Page
 * Spaced repetition system for active recall practice
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Brain, Zap, Target, Trophy, Clock, BarChart3, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { FlashcardReview, type Card } from '@/components/forge/srs/FlashcardReview';

interface ReviewStats {
  total_cards: number;
  cards_due: number;
  cards_reviewed_today: number;
  total_reviews: number;
  avg_accuracy: number;
  streak_days: number;
  mastered_cards: number;
}

interface ReviewSummary {
  total_cards: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  total_xp: number;
  avg_response_time_ms: number;
}

type ViewState = 'overview' | 'review' | 'complete';

export default function SRSPage() {
  const [viewState, setViewState] = useState<ViewState>('overview');
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [sessionSummary, setSessionSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch SRS data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/hyro/srs');
      if (!response.ok) throw new Error('Failed to fetch SRS data');

      const data = await response.json();
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SRS data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Start review session
  const startReview = useCallback(async (category?: string) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({ action: 'due' });
      if (category) params.append('category', category);

      const response = await fetch(`/api/hyro/srs/review?${params}`);
      if (!response.ok) throw new Error('Failed to fetch cards');

      const data = await response.json();
      setCards(data.cards || []);
      setSelectedCategory(category || null);
      setViewState('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start review');
    } finally {
      setLoading(false);
    }
  }, []);

  // Review card
  const handleReviewCard = useCallback(async (
    cardId: string,
    quality: number,
    responseTimeMs: number
  ) => {
    const response = await fetch('/api/hyro/srs/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: cardId,
        quality,
        response_time_ms: responseTimeMs,
      }),
    });

    if (!response.ok) throw new Error('Failed to submit review');
    return response.json();
  }, []);

  // Complete session
  const handleComplete = useCallback((summary: ReviewSummary) => {
    setSessionSummary(summary);
    setViewState('complete');
    fetchData(); // Refresh stats
  }, [fetchData]);

  // Reset and go back
  const handleBack = useCallback(() => {
    setViewState('overview');
    setSessionSummary(null);
    setCards([]);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !stats) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading SRS system...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={handleBack} style={styles.backButton}>
            <ArrowLeft size={20} />
            {viewState === 'overview' ? (
              <Link href="/hyro/forge" style={{ color: 'inherit', textDecoration: 'none' }}>
                Back to Forge
              </Link>
            ) : (
              'End Session'
            )}
          </button>
          <h1 style={styles.title}>
            <Brain size={28} style={{ color: '#8b5cf6' }} />
            Memory Forge
          </h1>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={fetchData} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        {viewState === 'overview' && stats && (
          <OverviewView stats={stats} onStartReview={startReview} loading={loading} />
        )}

        {viewState === 'review' && cards.length > 0 && (
          <FlashcardReview
            cards={cards}
            onReviewCard={handleReviewCard}
            onComplete={handleComplete}
          />
        )}

        {viewState === 'review' && cards.length === 0 && !loading && (
          <div style={styles.emptyState}>
            <Brain size={48} style={{ opacity: 0.3 }} />
            <h3>No cards due for review!</h3>
            <p style={{ color: '#888' }}>Check back later or add new cards.</p>
            <button onClick={handleBack} style={styles.primaryButton}>
              Back to Overview
            </button>
          </div>
        )}

        {viewState === 'complete' && sessionSummary && (
          <CompleteView summary={sessionSummary} onBack={handleBack} />
        )}
      </main>
    </div>
  );
}

// Overview Component
function OverviewView({
  stats,
  onStartReview,
  loading,
}: {
  stats: ReviewStats;
  onStartReview: (category?: string) => void;
  loading: boolean;
}) {
  return (
    <div style={styles.overviewContainer}>
      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Brain size={24} color="#8b5cf6" />
          <span style={styles.statValue}>{stats.cards_due}</span>
          <span style={styles.statLabel}>Cards Due</span>
        </div>
        <div style={styles.statCard}>
          <Target size={24} color="#10b981" />
          <span style={styles.statValue}>{stats.mastered_cards}</span>
          <span style={styles.statLabel}>Mastered</span>
        </div>
        <div style={styles.statCard}>
          <BarChart3 size={24} color="#f59e0b" />
          <span style={styles.statValue}>{Math.round(stats.avg_accuracy)}%</span>
          <span style={styles.statLabel}>Accuracy</span>
        </div>
        <div style={styles.statCard}>
          <Zap size={24} color="#ef4444" />
          <span style={styles.statValue}>{stats.streak_days}</span>
          <span style={styles.statLabel}>Day Streak</span>
        </div>
      </div>

      {/* Today's Progress */}
      <div style={styles.todayCard}>
        <h3 style={styles.cardTitle}>Today's Progress</h3>
        <div style={styles.todayStats}>
          <div>
            <span style={styles.todayValue}>{stats.cards_reviewed_today}</span>
            <span style={styles.todayLabel}>Cards Reviewed</span>
          </div>
          <div style={styles.progressRing}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#333"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="6"
                strokeDasharray={`${(stats.cards_reviewed_today / Math.max(stats.cards_due + stats.cards_reviewed_today, 1)) * 220} 220`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <span style={styles.ringText}>
              {stats.cards_due > 0 ? `${stats.cards_due} left` : 'Done!'}
            </span>
          </div>
        </div>
      </div>

      {/* Start Button */}
      {stats.cards_due > 0 ? (
        <button
          onClick={() => onStartReview()}
          disabled={loading}
          style={styles.startButton}
        >
          <Brain size={24} />
          Start Review ({stats.cards_due} cards)
        </button>
      ) : (
        <div style={styles.allDone}>
          <Trophy size={48} color="#f59e0b" />
          <h3>All caught up!</h3>
          <p style={{ color: '#888' }}>No cards due for review. Great job!</p>
        </div>
      )}

      {/* Quick Stats */}
      <div style={styles.quickStats}>
        <div style={styles.quickStat}>
          <span style={styles.quickValue}>{stats.total_cards}</span>
          <span style={styles.quickLabel}>Total Cards</span>
        </div>
        <div style={styles.quickStat}>
          <span style={styles.quickValue}>{stats.total_reviews}</span>
          <span style={styles.quickLabel}>Total Reviews</span>
        </div>
      </div>
    </div>
  );
}

// Complete View Component
function CompleteView({
  summary,
  onBack,
}: {
  summary: ReviewSummary;
  onBack: () => void;
}) {
  const accuracy = summary.accuracy;
  const performanceLevel =
    accuracy >= 90 ? 'Excellent' :
    accuracy >= 75 ? 'Good' :
    accuracy >= 60 ? 'Okay' : 'Needs Practice';

  const performanceColor =
    accuracy >= 90 ? '#10b981' :
    accuracy >= 75 ? '#84cc16' :
    accuracy >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={styles.completeContainer}>
      <div style={styles.completeCard}>
        <Trophy size={64} color="#f59e0b" style={{ marginBottom: '1rem' }} />
        <h2 style={styles.completeTitle}>Session Complete!</h2>

        <div style={styles.performanceBadge} data-level={performanceLevel}>
          <span style={{ color: performanceColor, fontWeight: 700, fontSize: '1.5rem' }}>
            {performanceLevel}
          </span>
          <span style={{ color: performanceColor }}>{Math.round(accuracy)}% Accuracy</span>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryValue}>{summary.total_cards}</span>
            <span style={styles.summaryLabel}>Cards Reviewed</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryValue, color: '#10b981' }}>{summary.correct}</span>
            <span style={styles.summaryLabel}>Correct</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryValue, color: '#ef4444' }}>{summary.incorrect}</span>
            <span style={styles.summaryLabel}>Incorrect</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryValue, color: '#f59e0b' }}>+{summary.total_xp}</span>
            <span style={styles.summaryLabel}>XP Earned</span>
          </div>
        </div>

        <div style={styles.avgTime}>
          <Clock size={16} />
          Average response: {Math.round(summary.avg_response_time_ms / 1000)}s per card
        </div>

        <button onClick={onBack} style={styles.primaryButton}>
          Back to Overview
        </button>
      </div>
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
  overviewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1.5rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.75rem',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase',
  },
  todayCard: {
    padding: '1.5rem',
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '0.75rem',
  },
  cardTitle: {
    margin: '0 0 1rem 0',
    fontSize: '1rem',
    fontWeight: 600,
  },
  todayStats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayValue: {
    display: 'block',
    fontSize: '2.5rem',
    fontWeight: 700,
    color: '#8b5cf6',
  },
  todayLabel: {
    display: 'block',
    fontSize: '0.875rem',
    color: '#888',
  },
  progressRing: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    position: 'absolute',
    fontSize: '0.75rem',
    color: '#888',
  },
  startButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
    border: 'none',
    borderRadius: '0.75rem',
    color: '#fff',
    fontSize: '1.125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  allDone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '3rem',
    textAlign: 'center',
  },
  quickStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '3rem',
    padding: '1rem',
    borderTop: '1px solid #333',
  },
  quickStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  quickValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#888',
  },
  quickLabel: {
    fontSize: '0.75rem',
    color: '#666',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    gap: '1rem',
    textAlign: 'center',
  },
  completeContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  completeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(139, 92, 246, 0.1))',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '1rem',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
  },
  completeTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 1rem 0',
  },
  performanceBadge: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    marginBottom: '1.5rem',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    width: '100%',
    marginBottom: '1.5rem',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '1rem',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '0.5rem',
  },
  summaryValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  summaryLabel: {
    fontSize: '0.75rem',
    color: '#888',
  },
  avgTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#888',
    marginBottom: '1.5rem',
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
