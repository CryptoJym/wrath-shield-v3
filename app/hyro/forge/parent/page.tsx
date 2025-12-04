'use client';

/**
 * HYRO FORGE: Parent/Teacher Dashboard
 * Weekly overview with trends, strengths, growth areas, and AI insights
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ParentSummary } from '@/lib/hyro/forge-parent-dashboard';

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading parent dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-300 mb-4">{error || 'Failed to load dashboard data'}</p>
          <Link
            href="/hyro/forge"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { period, stats, trends, strengths, growth_areas, recent_achievements, ai_insights } = summary;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-purple-900 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold">Parent Dashboard</h1>
              <p className="text-sm text-gray-300">
                Weekly Overview: {period.start} to {period.end}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/hyro/forge/parent/weekly"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
              >
                Detailed Report
              </Link>
              <Link
                href="/hyro/forge"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                Student View
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Weekly Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">XP Earned</div>
            <div className="text-3xl font-bold text-green-400">{stats.xp_earned}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Study Time</div>
            <div className="text-3xl font-bold text-blue-400">{stats.time_minutes}m</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Sessions</div>
            <div className="text-3xl font-bold text-purple-400">{stats.sessions}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Streak</div>
            <div className="text-3xl font-bold text-orange-400">{stats.streak_days}d</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Quests</div>
            <div className="text-3xl font-bold text-yellow-400">{stats.quests_completed}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Trend Analysis */}
            <div className="bg-gray-800 rounded-lg p-5">
              <h3 className="text-xl font-semibold mb-4">Performance Trends</h3>
              {trends.length > 0 ? (
                <div className="space-y-3">
                  {trends.map((trend) => (
                    <div
                      key={trend.stat_name}
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`text-2xl ${
                            trend.direction === 'up'
                              ? 'text-green-400'
                              : trend.direction === 'down'
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{trend.display_name}</div>
                          <div className="text-xs text-gray-400">
                            {trend.previous_value} → {trend.current_value}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-mono font-semibold ${
                          trend.change_percent > 0
                            ? 'text-green-400'
                            : trend.change_percent < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {trend.change_percent > 0 ? '+' : ''}
                        {trend.change_percent}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No trend data available</p>
              )}
            </div>

            {/* Top Strengths */}
            <div className="bg-gray-800 rounded-lg p-5">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-yellow-400">⭐</span>
                Top Strengths
              </h3>
              {strengths.length > 0 ? (
                <div className="space-y-3">
                  {strengths.map((strength, idx) => (
                    <div key={strength.stat_name} className="p-3 bg-green-900/20 border border-green-700/50 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-green-300">
                          #{idx + 1} {strength.display_name}
                        </div>
                        <div className="text-sm font-mono text-green-400">
                          {strength.score}/100
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{strength.evidence}</div>
                      <div className="text-xs text-green-300 mt-1">
                        {strength.percentile}th percentile
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">Keep building skills to identify strengths</p>
              )}
            </div>

            {/* Recent Achievements */}
            {recent_achievements.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-5">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-purple-400">🏆</span>
                  Recent Achievements
                </h3>
                <div className="space-y-2">
                  {recent_achievements.slice(0, 5).map((ach) => (
                    <div
                      key={ach.id}
                      className="flex items-center gap-3 p-2 bg-purple-900/20 border border-purple-700/50 rounded"
                    >
                      <span className="text-2xl">{ach.icon || '🎖️'}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{ach.name}</div>
                        <div className="text-xs text-gray-400">{ach.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* AI Insights */}
            <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-lg p-5">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-blue-400">🤖</span>
                AI Insights
              </h3>
              {ai_insights.length > 0 ? (
                <div className="space-y-3">
                  {ai_insights.map((insight, idx) => (
                    <div key={idx} className="p-3 bg-gray-800/50 rounded border border-gray-700">
                      <div className="flex items-start gap-2">
                        <div className="text-blue-400 font-bold text-sm mt-0.5">
                          {idx + 1}.
                        </div>
                        <p className="text-sm text-gray-200 flex-1">{insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">Generating insights...</p>
              )}
            </div>

            {/* Growth Areas */}
            <div className="bg-gray-800 rounded-lg p-5">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-yellow-400">📈</span>
                Growth Opportunities
              </h3>
              {growth_areas.length > 0 ? (
                <div className="space-y-3">
                  {growth_areas.map((area) => (
                    <div key={area.stat_name} className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-yellow-300">
                          {area.display_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {area.current}/{area.benchmark} (gap: {area.gap})
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{ width: `${(area.current / area.benchmark) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-300">
                        💡 {area.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-400 text-center py-4">
                  All areas at or above benchmark! 🎉
                </p>
              )}
            </div>

            {/* Quick Links */}
            <div className="bg-gray-800 rounded-lg p-5">
              <h3 className="text-lg font-semibold mb-3">Quick Links</h3>
              <div className="space-y-2">
                <Link
                  href="/hyro/forge/parent/weekly"
                  className="block p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 rounded transition-colors"
                >
                  <span className="text-sm font-medium text-blue-300">📊 Detailed Weekly Report</span>
                </Link>
                <Link
                  href="/hyro/forge/analytics"
                  className="block p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 rounded transition-colors"
                >
                  <span className="text-sm font-medium text-purple-300">📈 Analytics Dashboard</span>
                </Link>
                <Link
                  href="/hyro/forge/proficiency"
                  className="block p-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 rounded transition-colors"
                >
                  <span className="text-sm font-medium text-green-300">🎯 Proficiency Analysis</span>
                </Link>
                <Link
                  href="/hyro/forge"
                  className="block p-3 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  <span className="text-sm font-medium text-gray-300">🏠 Student Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
