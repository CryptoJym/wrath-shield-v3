'use client';

/**
 * HYRO FORGE: Analytics Page
 * Comprehensive learning analytics and AI-powered insights
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AnalyticsDashboard } from '@/components/forge/analytics';

interface DailyActivity {
  date: string;
  xp_earned: number;
  reading_minutes: number;
  cards_reviewed: number;
  discussions: number;
  intel_read: number;
}

interface PerformanceMetric {
  name: string;
  current: number;
  previous: number;
  change_percent: number;
  trend: 'up' | 'down' | 'stable';
}

interface AIInsight {
  id: string;
  type: 'strength' | 'opportunity' | 'recommendation' | 'milestone';
  title: string;
  description: string;
  action?: string;
  priority?: number;
}

interface AnalyticsData {
  daily_activity: DailyActivity[];
  metrics: PerformanceMetric[];
  insights: AIInsight[];
  streak_days: number;
  total_xp: number;
  level: number;
  xp_to_next_level: number;
}

type TimeRange = '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async (range: TimeRange) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/hyro/analytics?range=${range}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [fetchAnalytics, timeRange]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  if (loading && !data) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading analytics...</span>
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
            <BarChart3 size={28} style={{ color: '#10b981' }} />
            Learning Analytics
          </h1>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => fetchAnalytics(timeRange)} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={styles.main}>
        {data ? (
          <AnalyticsDashboard
            dailyActivity={data.daily_activity}
            metrics={data.metrics}
            insights={data.insights}
            streakDays={data.streak_days}
            totalXP={data.total_xp}
            level={data.level}
            xpToNextLevel={data.xp_to_next_level}
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
          />
        ) : (
          <div style={styles.emptyState}>
            <BarChart3 size={48} style={{ opacity: 0.3 }} />
            <h3>No Analytics Data</h3>
            <p style={{ color: '#888' }}>
              Start learning to see your progress here!
            </p>
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
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
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
};
