'use client';

/**
 * HYRO FORGE: Weekly Report
 * Detailed day-by-day breakdown with subject analysis and printable format
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ParentSummary, DayBreakdown } from '@/lib/hyro/forge-parent-dashboard';

interface WeeklyData {
  summary: ParentSummary;
  daily_breakdown: DayBreakdown[];
}

export default function WeeklyReport() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load summary
        const summaryRes = await fetch('/api/hyro/parent/summary');
        const summaryJson = await summaryRes.json();

        if (!summaryJson.success) {
          setError(summaryJson.error || 'Failed to load summary');
          return;
        }

        // For daily breakdown, we'll need to fetch from the database
        // For now, create a simple breakdown from the summary
        const weeklyData: WeeklyData = {
          summary: summaryJson.data,
          daily_breakdown: [], // Would be populated by API endpoint
        };

        setData(weeklyData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading weekly report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Report</h2>
          <p className="text-gray-300 mb-4">{error || 'Failed to load report data'}</p>
          <Link
            href="/hyro/forge/parent"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { summary } = data;
  const { period, stats, trends, strengths, growth_areas, recent_achievements } = summary;

  // Calculate averages
  const avgSessionTime = stats.sessions > 0 ? Math.round(stats.time_minutes / stats.sessions) : 0;
  const dailyAvgXP = Math.round(stats.xp_earned / 7);

  return (
    <div className={`min-h-screen ${printMode ? 'bg-white' : 'bg-gray-900'} text-white`}>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-friendly {
            color: black !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className={`${printMode ? 'print-friendly' : 'bg-gradient-to-r from-blue-900 to-purple-900'} border-b border-gray-700 px-6 py-4 no-print`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Weekly Progress Report</h1>
              <p className="text-sm text-gray-300">
                Week of {period.start} to {period.end}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <span>🖨️</span>
                Print Report
              </button>
              <Link
                href="/hyro/forge/parent"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Print Header */}
        <div className="hidden print:block mb-6 print-friendly">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Weekly Progress Report</h1>
          <p className="text-gray-700">Period: {period.start} to {period.end}</p>
        </div>

        {/* Executive Summary */}
        <section className={`${printMode ? 'print-friendly border border-gray-300' : 'bg-gray-800'} rounded-lg p-6 mb-6`}>
          <h2 className={`text-xl font-bold mb-4 ${printMode ? 'text-gray-900' : 'text-white'}`}>
            Executive Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className={`text-sm ${printMode ? 'text-gray-600' : 'text-gray-400'} mb-1`}>Total XP</div>
              <div className={`text-2xl font-bold ${printMode ? 'text-gray-900' : 'text-green-400'}`}>
                {stats.xp_earned}
              </div>
              <div className={`text-xs ${printMode ? 'text-gray-500' : 'text-gray-500'}`}>
                ~{dailyAvgXP}/day
              </div>
            </div>
            <div>
              <div className={`text-sm ${printMode ? 'text-gray-600' : 'text-gray-400'} mb-1`}>Study Time</div>
              <div className={`text-2xl font-bold ${printMode ? 'text-gray-900' : 'text-blue-400'}`}>
                {stats.time_minutes}m
              </div>
              <div className={`text-xs ${printMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {stats.sessions} sessions • ~{avgSessionTime}m avg
              </div>
            </div>
            <div>
              <div className={`text-sm ${printMode ? 'text-gray-600' : 'text-gray-400'} mb-1`}>Consistency</div>
              <div className={`text-2xl font-bold ${printMode ? 'text-gray-900' : 'text-orange-400'}`}>
                {stats.streak_days}d
              </div>
              <div className={`text-xs ${printMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Current streak
              </div>
            </div>
            <div>
              <div className={`text-sm ${printMode ? 'text-gray-600' : 'text-gray-400'} mb-1`}>Quests</div>
              <div className={`text-2xl font-bold ${printMode ? 'text-gray-900' : 'text-purple-400'}`}>
                {stats.quests_completed}
              </div>
              <div className={`text-xs ${printMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Completed
              </div>
            </div>
          </div>
        </section>

        {/* Performance Trends */}
        <section className={`${printMode ? 'print-friendly border border-gray-300' : 'bg-gray-800'} rounded-lg p-6 mb-6`}>
          <h2 className={`text-xl font-bold mb-4 ${printMode ? 'text-gray-900' : 'text-white'}`}>
            Performance Trends (vs. Previous Week)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trends.map((trend) => (
              <div
                key={trend.stat_name}
                className={`flex items-center justify-between p-3 ${
                  printMode ? 'border border-gray-200' : 'bg-gray-700/50'
                } rounded`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`text-xl ${
                      printMode
                        ? trend.direction === 'up'
                          ? 'text-green-600'
                          : trend.direction === 'down'
                          ? 'text-red-600'
                          : 'text-gray-600'
                        : trend.direction === 'up'
                        ? 'text-green-400'
                        : trend.direction === 'down'
                        ? 'text-red-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${printMode ? 'text-gray-900' : 'text-white'}`}>
                      {trend.display_name}
                    </div>
                    <div className={`text-xs ${printMode ? 'text-gray-600' : 'text-gray-400'}`}>
                      {trend.previous_value} → {trend.current_value}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    printMode
                      ? trend.change_percent > 0
                        ? 'text-green-600'
                        : trend.change_percent < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                      : trend.change_percent > 0
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
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Strengths */}
          <section className={`${printMode ? 'print-friendly border border-gray-300' : 'bg-gray-800'} rounded-lg p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${printMode ? 'text-gray-900' : 'text-white'}`}>
              Top Strengths
            </h2>
            {strengths.length > 0 ? (
              <div className="space-y-3">
                {strengths.map((strength, idx) => (
                  <div
                    key={strength.stat_name}
                    className={`p-3 ${
                      printMode ? 'border border-green-300 bg-green-50' : 'bg-green-900/20 border border-green-700/50'
                    } rounded`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-sm font-medium ${printMode ? 'text-green-900' : 'text-green-300'}`}>
                        #{idx + 1} {strength.display_name}
                      </div>
                      <div className={`text-sm font-mono ${printMode ? 'text-green-700' : 'text-green-400'}`}>
                        {strength.score}/100
                      </div>
                    </div>
                    <div className={`text-xs ${printMode ? 'text-gray-700' : 'text-gray-400'}`}>
                      {strength.evidence}
                    </div>
                    <div className={`text-xs ${printMode ? 'text-green-800' : 'text-green-300'} mt-1`}>
                      {strength.percentile}th percentile
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-4 ${printMode ? 'text-gray-600' : 'text-gray-400'}`}>
                Keep building skills
              </p>
            )}
          </section>

          {/* Growth Areas */}
          <section className={`${printMode ? 'print-friendly border border-gray-300' : 'bg-gray-800'} rounded-lg p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${printMode ? 'text-gray-900' : 'text-white'}`}>
              Growth Opportunities
            </h2>
            {growth_areas.length > 0 ? (
              <div className="space-y-3">
                {growth_areas.map((area) => (
                  <div
                    key={area.stat_name}
                    className={`p-3 ${
                      printMode ? 'border border-yellow-300 bg-yellow-50' : 'bg-yellow-900/20 border border-yellow-700/50'
                    } rounded`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-medium ${printMode ? 'text-yellow-900' : 'text-yellow-300'}`}>
                        {area.display_name}
                      </div>
                      <div className={`text-xs ${printMode ? 'text-gray-700' : 'text-gray-400'}`}>
                        {area.current}/{area.benchmark} (gap: {area.gap})
                      </div>
                    </div>
                    <div className={`w-full ${printMode ? 'bg-gray-200' : 'bg-gray-700'} rounded-full h-2 mb-2`}>
                      <div
                        className={`${printMode ? 'bg-yellow-600' : 'bg-yellow-500'} h-2 rounded-full`}
                        style={{ width: `${(area.current / area.benchmark) * 100}%` }}
                      />
                    </div>
                    <div className={`text-xs ${printMode ? 'text-gray-700' : 'text-gray-300'}`}>
                      💡 {area.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-4 ${printMode ? 'text-green-700' : 'text-green-400'}`}>
                All areas at or above benchmark! 🎉
              </p>
            )}
          </section>
        </div>

        {/* Achievements */}
        {recent_achievements.length > 0 && (
          <section className={`${printMode ? 'print-friendly border border-gray-300' : 'bg-gray-800'} rounded-lg p-6 mb-6`}>
            <h2 className={`text-xl font-bold mb-4 ${printMode ? 'text-gray-900' : 'text-white'}`}>
              Achievements Earned This Week
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recent_achievements.map((ach) => (
                <div
                  key={ach.id}
                  className={`flex items-center gap-3 p-3 ${
                    printMode ? 'border border-purple-300 bg-purple-50' : 'bg-purple-900/20 border border-purple-700/50'
                  } rounded`}
                >
                  <span className="text-2xl">{ach.icon || '🎖️'}</span>
                  <div>
                    <div className={`text-sm font-medium ${printMode ? 'text-purple-900' : 'text-white'}`}>
                      {ach.name}
                    </div>
                    <div className={`text-xs ${printMode ? 'text-gray-700' : 'text-gray-400'}`}>
                      {ach.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comparison to Previous Weeks */}
        <section className={`${printMode ? 'print-friendly border border-gray-300' : 'bg-gray-800'} rounded-lg p-6`}>
          <h2 className={`text-xl font-bold mb-4 ${printMode ? 'text-gray-900' : 'text-white'}`}>
            Historical Comparison
          </h2>
          <div className={`${printMode ? 'text-gray-700' : 'text-gray-400'} text-sm`}>
            <p className="mb-2">
              <strong className={printMode ? 'text-gray-900' : 'text-white'}>Current Week:</strong> {stats.xp_earned} XP,
              {stats.time_minutes} minutes across {stats.sessions} sessions
            </p>
            <p className={printMode ? 'text-gray-600' : 'text-gray-500'}>
              Track long-term trends in the Analytics dashboard for deeper insights into learning patterns and velocity.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className={`mt-8 pt-4 border-t ${printMode ? 'border-gray-300 text-gray-600' : 'border-gray-700 text-gray-500'} text-center text-sm`}>
          <p>Generated by HYRO FORGE - ULTRA-EDGE Education System</p>
          <p className="mt-1">Report Date: {new Date().toLocaleDateString()}</p>
        </div>
      </main>
    </div>
  );
}
