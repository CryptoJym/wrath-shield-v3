'use client';

/**
 * AnalyticsDashboard Component
 * Comprehensive learning analytics with activity timeline,
 * performance metrics, and AI-generated insights
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Clock, Target, Calendar,
  Brain, Zap, Award, BarChart3, Activity, ChevronRight
} from 'lucide-react';

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

interface AnalyticsDashboardProps {
  dailyActivity: DailyActivity[];
  metrics: PerformanceMetric[];
  insights: AIInsight[];
  streakDays: number;
  totalXP: number;
  level: number;
  xpToNextLevel: number;
  timeRange?: '7d' | '30d' | '90d';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void;
}

const insightStyles: Record<string, { bg: string; color: string; icon: typeof TrendingUp }> = {
  strength: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', icon: TrendingUp },
  opportunity: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', icon: Target },
  recommendation: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', icon: Brain },
  milestone: { bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', icon: Award },
};

export function AnalyticsDashboard({
  dailyActivity,
  metrics,
  insights,
  streakDays,
  totalXP,
  level,
  xpToNextLevel,
  timeRange = '7d',
  onTimeRangeChange,
}: AnalyticsDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Calculate max values for chart scaling
  const maxXP = useMemo(
    () => Math.max(...dailyActivity.map((d) => d.xp_earned), 1),
    [dailyActivity]
  );

  // Calculate totals for time range
  const totals = useMemo(() => {
    return dailyActivity.reduce(
      (acc, day) => ({
        xp: acc.xp + day.xp_earned,
        reading: acc.reading + day.reading_minutes,
        cards: acc.cards + day.cards_reviewed,
        discussions: acc.discussions + day.discussions,
        intel: acc.intel + day.intel_read,
      }),
      { xp: 0, reading: 0, cards: 0, discussions: 0, intel: 0 }
    );
  }, [dailyActivity]);

  return (
    <div style={styles.container}>
      {/* Header Stats */}
      <div style={styles.headerStats}>
        <div style={styles.levelCard}>
          <div style={styles.levelBadge}>
            <span style={styles.levelNumber}>Lv. {level}</span>
          </div>
          <div style={styles.levelInfo}>
            <span style={styles.levelLabel}>Total XP</span>
            <span style={styles.xpValue}>{totalXP.toLocaleString()}</span>
          </div>
          <div style={styles.xpProgress}>
            <div
              style={{
                ...styles.xpProgressFill,
                width: `${Math.min(((totalXP % 1000) / 1000) * 100, 100)}%`,
              }}
            />
          </div>
          <span style={styles.xpToNext}>{xpToNextLevel} XP to level {level + 1}</span>
        </div>

        <div style={styles.streakCard}>
          <Zap size={24} color="#f59e0b" />
          <span style={styles.streakNumber}>{streakDays}</span>
          <span style={styles.streakLabel}>Day Streak</span>
        </div>
      </div>

      {/* Time Range Toggle */}
      <div style={styles.timeToggle}>
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange?.(range)}
            style={{
              ...styles.timeButton,
              ...(timeRange === range ? styles.timeButtonActive : {}),
            }}
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
          </button>
        ))}
      </div>

      {/* Activity Chart */}
      <div style={styles.chartSection}>
        <h3 style={styles.sectionTitle}>
          <Activity size={18} />
          Activity
        </h3>
        <div style={styles.chart}>
          {dailyActivity.map((day, i) => {
            const height = (day.xp_earned / maxXP) * 100;
            const date = new Date(day.date);
            const isToday = new Date().toDateString() === date.toDateString();

            return (
              <div key={day.date} style={styles.chartBar}>
                <div
                  style={{
                    ...styles.barFill,
                    height: `${Math.max(height, 5)}%`,
                    background: isToday
                      ? 'linear-gradient(180deg, #f59e0b, #d97706)'
                      : day.xp_earned > 0
                      ? 'linear-gradient(180deg, #3b82f6, #1d4ed8)'
                      : '#333',
                  }}
                />
                <span style={styles.barLabel}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                </span>
              </div>
            );
          })}
        </div>
        <div style={styles.chartLegend}>
          <span>+{totals.xp} XP this period</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={styles.quickStats}>
        <div style={styles.quickStatCard}>
          <Clock size={16} color="#3b82f6" />
          <span style={styles.quickStatValue}>{Math.round(totals.reading / 60)}h</span>
          <span style={styles.quickStatLabel}>Reading</span>
        </div>
        <div style={styles.quickStatCard}>
          <Brain size={16} color="#a78bfa" />
          <span style={styles.quickStatValue}>{totals.cards}</span>
          <span style={styles.quickStatLabel}>Cards</span>
        </div>
        <div style={styles.quickStatCard}>
          <Target size={16} color="#10b981" />
          <span style={styles.quickStatValue}>{totals.discussions}</span>
          <span style={styles.quickStatLabel}>Discussions</span>
        </div>
        <div style={styles.quickStatCard}>
          <BarChart3 size={16} color="#f59e0b" />
          <span style={styles.quickStatValue}>{totals.intel}</span>
          <span style={styles.quickStatLabel}>Intel</span>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={styles.metricsSection}>
        <h3 style={styles.sectionTitle}>
          <BarChart3 size={18} />
          Performance Metrics
        </h3>
        <div style={styles.metricsList}>
          {metrics.map((metric) => (
            <div key={metric.name} style={styles.metricCard}>
              <div style={styles.metricHeader}>
                <span style={styles.metricName}>{metric.name}</span>
                <div
                  style={{
                    ...styles.trendBadge,
                    color:
                      metric.trend === 'up'
                        ? '#10b981'
                        : metric.trend === 'down'
                        ? '#ef4444'
                        : '#888',
                  }}
                >
                  {metric.trend === 'up' && <TrendingUp size={12} />}
                  {metric.trend === 'down' && <TrendingDown size={12} />}
                  {metric.change_percent !== 0 &&
                    `${metric.change_percent > 0 ? '+' : ''}${metric.change_percent}%`}
                </div>
              </div>
              <div style={styles.metricValue}>
                {metric.current}
                {metric.name.toLowerCase().includes('accuracy') && '%'}
                {metric.name.toLowerCase().includes('time') && 'm'}
              </div>
              <div style={styles.metricBar}>
                <div
                  style={{
                    ...styles.metricBarFill,
                    width: `${Math.min(metric.current, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div style={styles.insightsSection}>
        <h3 style={styles.sectionTitle}>
          <Brain size={18} />
          AI Insights
        </h3>
        <div style={styles.insightsList}>
          {insights.map((insight) => {
            const style = insightStyles[insight.type] || insightStyles.recommendation;
            const Icon = style.icon;

            return (
              <div
                key={insight.id}
                style={{
                  ...styles.insightCard,
                  borderLeftColor: style.color,
                }}
              >
                <div
                  style={{
                    ...styles.insightIcon,
                    background: style.bg,
                    color: style.color,
                  }}
                >
                  <Icon size={16} />
                </div>
                <div style={styles.insightContent}>
                  <h4 style={styles.insightTitle}>{insight.title}</h4>
                  <p style={styles.insightDescription}>{insight.description}</p>
                  {insight.action && (
                    <button style={styles.insightAction}>
                      {insight.action}
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  headerStats: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '1rem',
  },
  levelCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
    borderRadius: '0.75rem',
    border: '1px solid #333',
  },
  levelBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  levelNumber: {
    fontSize: '1.5rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  levelInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  levelLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase',
  },
  xpValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  xpProgress: {
    height: '6px',
    background: '#333',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  xpProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #f59e0b, #10b981)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  xpToNext: {
    fontSize: '0.75rem',
    color: '#888',
    textAlign: 'right',
  },
  streakCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem 1.5rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '0.75rem',
    minWidth: '100px',
  },
  streakNumber: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#f59e0b',
    lineHeight: 1,
  },
  streakLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase',
  },
  timeToggle: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.25rem',
    background: '#1a1a1a',
    borderRadius: '0.5rem',
    width: 'fit-content',
  },
  timeButton: {
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '0.375rem',
    color: '#888',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  timeButtonActive: {
    background: '#333',
    color: '#fff',
  },
  chartSection: {
    padding: '1rem',
    background: '#1a1a1a',
    borderRadius: '0.75rem',
    border: '1px solid #333',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0 0 1rem 0',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#ccc',
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
    height: '120px',
    padding: '0.5rem 0',
  },
  chartBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.375rem',
    height: '100%',
  },
  barFill: {
    width: '100%',
    maxWidth: '24px',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease',
  },
  barLabel: {
    fontSize: '0.625rem',
    color: '#666',
  },
  chartLegend: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid #333',
    fontSize: '0.875rem',
    color: '#10b981',
    fontWeight: 500,
  },
  quickStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
  },
  quickStatCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.875rem 0.5rem',
    background: '#1a1a1a',
    borderRadius: '0.5rem',
    border: '1px solid #333',
  },
  quickStatValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  quickStatLabel: {
    fontSize: '0.6875rem',
    color: '#888',
    textTransform: 'uppercase',
  },
  metricsSection: {
    padding: '1rem',
    background: '#1a1a1a',
    borderRadius: '0.75rem',
    border: '1px solid #333',
  },
  metricsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.75rem',
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    padding: '0.75rem',
    background: '#0f0f0f',
    borderRadius: '0.5rem',
    border: '1px solid #333',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    fontSize: '0.8125rem',
    color: '#888',
  },
  trendBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  metricBar: {
    height: '4px',
    background: '#333',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #10b981)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  insightsSection: {
    padding: '1rem',
    background: '#1a1a1a',
    borderRadius: '0.75rem',
    border: '1px solid #333',
  },
  insightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  insightCard: {
    display: 'flex',
    gap: '0.875rem',
    padding: '0.875rem',
    background: '#0f0f0f',
    borderRadius: '0.5rem',
    borderLeft: '3px solid',
  },
  insightIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  insightContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  insightTitle: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  insightDescription: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#888',
    lineHeight: 1.4,
  },
  insightAction: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    marginTop: '0.5rem',
    padding: '0.375rem 0.75rem',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '999px',
    color: '#ccc',
    fontSize: '0.75rem',
    cursor: 'pointer',
    width: 'fit-content',
  },
};

export default AnalyticsDashboard;
