'use client';

/**
 * HYRO FORGE: Daily Intel Page
 * Personalized educational content feed with stat boosts
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Newspaper, Loader2, Trophy, Zap, Target, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { IntelFeed, type IntelItem } from '@/components/forge/intel';

interface IntelStats {
  total_items_read: number;
  total_xp_earned: number;
  streak_days: number;
  favorite_topics: string[];
  items_today: number;
  items_read_today: number;
}

export default function IntelPage() {
  const [items, setItems] = useState<IntelItem[]>([]);
  const [stats, setStats] = useState<IntelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch intel feed
  const fetchIntel = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch('/api/hyro/intel');
      if (!response.ok) throw new Error('Failed to fetch intel');

      const data = await response.json();
      setItems(data.items || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  // Mark item as read
  const handleReadItem = useCallback(async (itemId: string) => {
    const response = await fetch('/api/hyro/intel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark-read',
        item_id: itemId,
      }),
    });

    if (!response.ok) throw new Error('Failed to mark as read');

    const data = await response.json();

    // Update local state
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_read: true } : item
      )
    );

    // Update stats
    if (stats) {
      setStats({
        ...stats,
        total_items_read: stats.total_items_read + 1,
        items_read_today: stats.items_read_today + 1,
        total_xp_earned: stats.total_xp_earned + data.xp_earned,
      });
    }

    return data;
  }, [stats]);

  // Refresh feed
  const handleRefresh = useCallback(async () => {
    await fetchIntel(true);
  }, [fetchIntel]);

  if (loading && items.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading daily intel...</span>
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
            <Newspaper size={28} style={{ color: '#f59e0b' }} />
            Daily Intel
          </h1>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={styles.refreshButton}
        >
          <RefreshCw
            size={18}
            style={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <Newspaper size={16} />
            <span style={styles.statValue}>
              {stats.items_read_today}/{stats.items_today}
            </span>
            <span style={styles.statLabel}>Today</span>
          </div>
          <div style={styles.statItem}>
            <Trophy size={16} color="#f59e0b" />
            <span style={styles.statValue}>{stats.total_xp_earned}</span>
            <span style={styles.statLabel}>Total XP</span>
          </div>
          <div style={styles.statItem}>
            <Zap size={16} color="#10b981" />
            <span style={styles.statValue}>{stats.streak_days}</span>
            <span style={styles.statLabel}>Day Streak</span>
          </div>
          <div style={styles.statItem}>
            <Target size={16} color="#a78bfa" />
            <span style={styles.statValue}>{stats.total_items_read}</span>
            <span style={styles.statLabel}>All Time</span>
          </div>
        </div>
      )}

      {/* Favorite Topics */}
      {stats && stats.favorite_topics.length > 0 && (
        <div style={styles.topicsBar}>
          <span style={styles.topicsLabel}>Your Interests:</span>
          {stats.favorite_topics.map((topic) => (
            <span key={topic} style={styles.topicBadge}>
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => fetchIntel()} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        <IntelFeed
          items={items}
          onReadItem={handleReadItem}
          onRefresh={handleRefresh}
          loading={refreshing}
        />
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
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '0.5rem',
    color: '#f59e0b',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
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
  topicsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    background: '#0f0f0f',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
  },
  topicsLabel: {
    fontSize: '0.75rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  topicBadge: {
    padding: '0.25rem 0.625rem',
    background: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    borderRadius: '999px',
    fontSize: '0.75rem',
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
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
  },
};
