'use client';

/**
 * HYRO FORGE: Parent/Teacher Dashboard
 * Weekly overview with trends, strengths, growth areas, and AI insights
 * Premium "Ultra-Edge" UI Overhaul
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ParentSummary } from '@/lib/hyro/forge-parent-dashboard';
import {
  TrendingUp, TrendingDown, Minus,
  Award, Brain, Target, Zap, Clock,
  ChevronRight, BarChart3, BookOpen,
  Activity, Shield, Star
} from 'lucide-react';

export default function ParentDashboard() {
  const [summary, setSummary] = useState<ParentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch('/api/hyro/parent/summary');
        const json = await res.json();

        if (!json.success) {
          setError(json.error || 'Failed to load summary');
          return;
        }

        setSummary(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400 uppercase tracking-widest text-sm">Initializing Command Center...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-8 max-w-md text-center backdrop-blur-md">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2 uppercase tracking-wide">System Error</h2>
          <p className="text-zinc-400 mb-6">{error || 'Failed to load dashboard data'}</p>
          <Link
            href="/hyro/forge"
            className="inline-flex items-center px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-full transition-all"
          >
            Return to Forge
          </Link>
        </div>
      </div>
    );
  }

  const { period, stats, trends, strengths, growth_areas, recent_achievements, ai_insights } = summary;

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-cyan-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                PARENT COMMAND
              </h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1 font-medium">
                Cycle: {period.start} — {period.end}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/hyro/forge/parent/weekly"
                className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-white/10 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
              >
                <BarChart3 size={16} />
                Detailed Report
              </Link>
              <Link
                href="/hyro/forge"
                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg transition-all text-sm font-medium flex items-center gap-2"
              >
                Student View
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="XP Earned"
            value={stats.xp_earned.toLocaleString()}
            icon={Zap}
            color="text-amber-400"
            bg="bg-amber-500/10"
            border="border-amber-500/20"
          />
          <StatCard
            label="Study Time"
            value={`${stats.time_minutes}m`}
            icon={Clock}
            color="text-blue-400"
            bg="bg-blue-500/10"
            border="border-blue-500/20"
          />
          <StatCard
            label="Sessions"
            value={stats.sessions}
            icon={Activity}
            color="text-purple-400"
            bg="bg-purple-500/10"
            border="border-purple-500/20"
          />
          <StatCard
            label="Streak"
            value={`${stats.streak_days}d`}
            icon={TrendingUp}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            border="border-emerald-500/20"
          />
          <StatCard
            label="Quests"
            value={stats.quests_completed}
            icon={Target}
            color="text-cyan-400"
            bg="bg-cyan-500/10"
            border="border-cyan-500/20"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column (Main Stats) */}
          <div className="lg:col-span-7 space-y-8">

            {/* Trend Analysis */}
            <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="text-zinc-400" size={20} />
                  Performance Vector
                </h3>
              </div>
              <div className="p-6">
                {trends.length > 0 ? (
                  <div className="space-y-4">
                    {trends.map((trend) => (
                      <div
                        key={trend.stat_name}
                        className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${trend.direction === 'up' ? 'bg-emerald-500/10 text-emerald-400' :
                              trend.direction === 'down' ? 'bg-red-500/10 text-red-400' :
                                'bg-zinc-500/10 text-zinc-400'
                            }`}>
                            {trend.direction === 'up' ? <TrendingUp size={20} /> :
                              trend.direction === 'down' ? <TrendingDown size={20} /> :
                                <Minus size={20} />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{trend.display_name}</div>
                            <div className="text-xs text-zinc-500 font-mono mt-0.5">
                              {trend.previous_value} <span className="text-zinc-600">→</span> {trend.current_value}
                            </div>
                          </div>
                        </div>
                        <div className={`text-sm font-mono font-bold ${trend.change_percent > 0 ? 'text-emerald-400' :
                            trend.change_percent < 0 ? 'text-red-400' :
                              'text-zinc-500'
                          }`}>
                          {trend.change_percent > 0 ? '+' : ''}{trend.change_percent}%
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-zinc-900/50 mb-4">
                      <BarChart3 className="text-zinc-600" size={24} />
                    </div>
                    <p className="text-zinc-500 text-sm">Insufficient data for trend analysis</p>
                  </div>
                )}
              </div>
            </section>

            {/* Top Strengths */}
            <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Star className="text-amber-400" size={20} />
                  Core Competencies
                </h3>
              </div>
              <div className="p-6">
                {strengths.length > 0 ? (
                  <div className="grid gap-4">
                    {strengths.map((strength, idx) => (
                      <div key={strength.stat_name} className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                        <div className="relative p-4 bg-zinc-950/50 border border-amber-500/20 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <span className="text-sm font-bold text-white">{strength.display_name}</span>
                            </div>
                            <p className="text-xs text-zinc-400">{strength.evidence}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-amber-400 font-mono">{strength.score}</div>
                            <div className="text-[10px] text-amber-500/60 uppercase tracking-wider">Score</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    Complete more activities to identify strengths
                  </div>
                )}
              </div>
            </section>

            {/* Recent Achievements */}
            {recent_achievements.length > 0 && (
              <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="text-purple-400" size={20} />
                    Recent Accolades
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid gap-3">
                    {recent_achievements.slice(0, 5).map((ach) => (
                      <div
                        key={ach.id}
                        className="flex items-center gap-4 p-3 bg-zinc-950/50 border border-purple-500/20 rounded-xl hover:bg-purple-500/5 transition-colors"
                      >
                        <div className="text-3xl bg-zinc-900 p-2 rounded-lg">{ach.icon || '🎖️'}</div>
                        <div>
                          <div className="text-sm font-bold text-white">{ach.name}</div>
                          <div className="text-xs text-zinc-400">{ach.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Column (Insights & Growth) */}
          <div className="lg:col-span-5 space-y-8">

            {/* AI Insights */}
            <section className="bg-gradient-to-b from-blue-900/20 to-zinc-900/40 backdrop-blur-md border border-blue-500/30 rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Brain size={120} className="text-blue-500" />
              </div>
              <div className="p-6 border-b border-blue-500/20 relative z-10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Brain className="text-blue-400" size={20} />
                  Neural Insights
                </h3>
              </div>
              <div className="p-6 relative z-10">
                {ai_insights.length > 0 ? (
                  <div className="space-y-4">
                    {ai_insights.map((insight, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        <p className="text-sm text-blue-100/90 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-blue-300/50 text-sm animate-pulse">
                    Analyzing neural patterns...
                  </div>
                )}
              </div>
            </section>

            {/* Growth Areas */}
            <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Target className="text-red-400" size={20} />
                  Optimization Targets
                </h3>
              </div>
              <div className="p-6">
                {growth_areas.length > 0 ? (
                  <div className="space-y-4">
                    {growth_areas.map((area) => (
                      <div key={area.stat_name} className="p-4 bg-zinc-950/50 border border-red-500/10 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-bold text-white">
                            {area.display_name}
                          </div>
                          <div className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded">
                            Gap: {area.gap}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative h-2 bg-zinc-800 rounded-full mb-3 overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-zinc-600 w-[70%]" // Benchmark marker
                            title="Benchmark"
                          />
                          <div
                            className="absolute top-0 left-0 h-full bg-red-500 rounded-full"
                            style={{ width: `${(area.current / 100) * 100}%` }}
                          />
                        </div>

                        <div className="flex items-start gap-2 text-xs text-zinc-400">
                          <div className="mt-0.5 text-red-400">💡</div>
                          {area.suggestion}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
                      <Shield size={24} />
                    </div>
                    <p className="text-emerald-400 font-medium text-sm">All systems nominal</p>
                    <p className="text-zinc-500 text-xs mt-1">Performance exceeds benchmarks</p>
                  </div>
                )}
              </div>
            </section>

            {/* Quick Links */}
            <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">Quick Access</h3>
              </div>
              <div className="p-4 grid gap-2">
                <QuickLink
                  href="/hyro/forge/parent/weekly"
                  label="Detailed Weekly Report"
                  icon={BookOpen}
                  color="text-blue-400"
                  hover="hover:bg-blue-500/10 hover:border-blue-500/30"
                />
                <QuickLink
                  href="/hyro/forge/analytics"
                  label="Analytics Dashboard"
                  icon={BarChart3}
                  color="text-purple-400"
                  hover="hover:bg-purple-500/10 hover:border-purple-500/30"
                />
                <QuickLink
                  href="/hyro/forge/proficiency"
                  label="Proficiency Analysis"
                  icon={Target}
                  color="text-emerald-400"
                  hover="hover:bg-emerald-500/10 hover:border-emerald-500/30"
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg, border }: any) {
  return (
    <div className={`p-4 rounded-xl border ${border} ${bg} backdrop-blur-sm flex flex-col items-center justify-center text-center`}>
      <Icon className={`mb-2 ${color}`} size={20} />
      <div className={`text-2xl font-bold text-white tracking-tight`}>{value}</div>
      <div className={`text-[10px] uppercase tracking-widest font-medium ${color} opacity-80`}>{label}</div>
    </div>
  );
}

function QuickLink({ href, label, icon: Icon, color, hover }: any) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between p-3 rounded-lg border border-white/5 bg-zinc-950/30 transition-all ${hover} group`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`${color} opacity-70 group-hover:opacity-100 transition-opacity`} size={18} />
        <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</span>
      </div>
      <ChevronRight className="text-zinc-600 group-hover:text-zinc-400 transition-colors" size={16} />
    </Link>
  );
}
