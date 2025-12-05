'use client';

/**
 * AnalyticsDashboard Component
 * Comprehensive learning analytics with activity timeline,
 * performance metrics, and AI-generated insights
 * Premium "Ultra-Edge" UI Overhaul
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Clock, Target, Calendar,
  Brain, Zap, Award, BarChart3, Activity, ChevronRight, Minus
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

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

const insightStyles: Record<string, { bg: string; color: string; icon: any; border: string }> = {
  strength: { bg: 'bg-emerald-500/10', color: 'text-emerald-400', icon: TrendingUp, border: 'border-emerald-500/20' },
  opportunity: { bg: 'bg-amber-500/10', color: 'text-amber-400', icon: Target, border: 'border-amber-500/20' },
  recommendation: { bg: 'bg-blue-500/10', color: 'text-blue-400', icon: Brain, border: 'border-blue-500/20' },
  milestone: { bg: 'bg-purple-500/10', color: 'text-purple-400', icon: Award, border: 'border-purple-500/20' },
};

export function AnalyticsDashboard({
  dailyActivity = [],
  metrics = [],
  insights = [],
  streakDays,
  totalXP,
  level,
  xpToNextLevel,
  timeRange = '7d',
  onTimeRangeChange,
}: AnalyticsDashboardProps) {

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

  // Format data for Recharts
  const chartData = useMemo(() => {
    return dailyActivity.map(day => ({
      ...day,
      displayDate: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
    }));
  }, [dailyActivity]);

  return (
    <div className="space-y-8">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Level Card */}
        <div className="md:col-span-2 bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <span className="text-2xl font-bold text-white">{level}</span>
              </div>
              <div>
                <h3 className="text-sm text-zinc-400 uppercase tracking-widest font-medium">Current Level</h3>
                <div className="text-3xl font-bold text-white tracking-tight">{(totalXP ?? 0).toLocaleString()} <span className="text-sm text-zinc-500 font-normal">XP</span></div>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-zinc-400">Progress to Level {level + 1}</span>
                <span className="text-purple-400 font-mono">{xpToNextLevel} XP remaining</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((((totalXP ?? 0) % 1000) / 1000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Streak Card */}
        <div className="bg-zinc-900/40 backdrop-blur-md border border-amber-500/20 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-amber-500/5" />
          <Zap className="text-amber-400 mb-2" size={32} />
          <div className="text-4xl font-bold text-white tracking-tight">{streakDays}</div>
          <div className="text-xs text-amber-500/80 uppercase tracking-widest font-medium mt-1">Day Streak</div>
        </div>
      </div>

      {/* Time Range Toggle */}
      <div className="flex justify-end">
        <div className="bg-zinc-900/50 p-1 rounded-lg border border-white/5 inline-flex">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange?.(range)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${timeRange === range
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Chart */}
      <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="text-blue-400" size={20} />
          <h3 className="text-lg font-bold text-white">Activity Vector</h3>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis
                dataKey="displayDate"
                stroke="#666"
                tick={{ fill: '#666', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: '#666', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                dx={-10}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Area
                type="monotone"
                dataKey="xp_earned"
                stroke="#8b5cf6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorXp)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex justify-center">
          <span className="text-sm text-zinc-400">
            Total Output: <span className="text-purple-400 font-bold">+{totals.xp} XP</span> this period
          </span>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStatCard
          label="Reading Time"
          value={`${Math.round(totals.reading / 60)}h`}
          icon={Clock}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <QuickStatCard
          label="Cards Reviewed"
          value={totals.cards}
          icon={Brain}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
        <QuickStatCard
          label="Discussions"
          value={totals.discussions}
          icon={Target}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <QuickStatCard
          label="Intel Gathered"
          value={totals.intel}
          icon={BarChart3}
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance Metrics */}
        <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="text-emerald-400" size={20} />
            <h3 className="text-lg font-bold text-white">Performance Metrics</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <div key={metric.name} className="bg-zinc-950/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{metric.name}</span>
                  <div className={`flex items-center gap-1 text-xs font-bold ${metric.trend === 'up' ? 'text-emerald-400' :
                    metric.trend === 'down' ? 'text-red-400' : 'text-zinc-500'
                    }`}>
                    {metric.trend === 'up' ? <TrendingUp size={12} /> :
                      metric.trend === 'down' ? <TrendingDown size={12} /> :
                        <Minus size={12} />}
                    {metric.change_percent !== 0 && `${Math.abs(metric.change_percent)}%`}
                  </div>
                </div>

                <div className="text-2xl font-bold text-white mb-3">
                  {metric.current}
                  <span className="text-sm text-zinc-500 font-normal ml-1">
                    {metric.name.toLowerCase().includes('accuracy') ? '%' :
                      metric.name.toLowerCase().includes('time') ? 'm' : ''}
                  </span>
                </div>

                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                    style={{ width: `${Math.min(metric.current, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Insights */}
        <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Brain className="text-blue-400" size={20} />
            <h3 className="text-lg font-bold text-white">Neural Insights</h3>
          </div>

          <div className="space-y-4">
            {insights.map((insight) => {
              const style = insightStyles[insight.type] || insightStyles.recommendation;
              const Icon = style.icon;

              return (
                <div
                  key={insight.id}
                  className={`flex gap-4 p-4 rounded-xl border ${style.border} ${style.bg} bg-opacity-50`}
                >
                  <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={style.color} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white mb-1">{insight.title}</h4>
                    <p className="text-xs text-zinc-300 leading-relaxed mb-2">{insight.description}</p>
                    {insight.action && (
                      <button className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-white/70 hover:text-white transition-colors">
                        {insight.action}
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickStatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
      <div className={`p-2 rounded-lg ${bg} mb-2`}>
        <Icon className={color} size={16} />
      </div>
      <div className="text-xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-widest font-medium text-zinc-500">{label}</div>
    </div>
  );
}
