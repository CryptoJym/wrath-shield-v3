'use client';

/**
 * HYRO FORGE: Analytics Page
 * Comprehensive learning analytics and AI-powered insights
 * Premium "Ultra-Edge" UI Overhaul
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BarChart3, Loader2, Shield } from 'lucide-react';
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400 uppercase tracking-widest text-sm">Analyzing Neural Patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-purple-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/hyro/forge"
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 flex items-center gap-3">
                  <BarChart3 className="text-purple-400" size={24} />
                  NEURAL ANALYTICS
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="max-w-md mx-auto mt-8 p-6 bg-red-950/30 border border-red-500/30 rounded-2xl text-center backdrop-blur-md">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-400 mb-2">Analysis Failed</h3>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={() => fetchAnalytics(timeRange)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-all"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-6">
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
        ) : !loading && !error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-6 bg-zinc-900/50 rounded-full mb-4">
              <BarChart3 size={48} className="text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Data Available</h3>
            <p className="text-zinc-400 max-w-md">
              Engage with learning modules to generate neural analytics data.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
