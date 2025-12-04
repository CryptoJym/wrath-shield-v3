'use client';

/**
 * HYRO FORGE: ULTRA-EDGE Dashboard
 * Main dashboard page for Hyro's RPG-style education system
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SpiderGraph, StatList } from '@/components/forge/SpiderGraph';
import { CharacterCard, XPBreakdown } from '@/components/forge/CharacterCard';

interface CharacterData {
  character: {
    id: string;
    display_name: string;
    title: string;
    level: number;
    total_xp: number;
    current_streak: number;
    longest_streak: number;
    last_session_at: number | null;
    avatar_url: string | null;
  };
  level_progress: {
    level: number;
    xp_in_level: number;
    xp_for_next_level: number;
    progress_percent: number;
  };
  xp_summary: {
    today: number;
    this_week: number;
    this_month: number;
    total: number;
    by_source: Record<string, number>;
  };
  power_level: {
    power_level: number;
    rank: string;
    strongest_stat: string;
    weakest_stat: string;
  };
  stats: Array<{
    stat_name: string;
    display_name: string;
    current_value: number;
    benchmark: number;
    trend: 'up' | 'down' | 'stable';
    change_7d: number;
  }>;
  recent_achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    earned_at: number;
  }>;
  active_quests: Array<{
    id: string;
    title: string;
    quest_type: string;
    xp_reward: number;
    status: string;
  }>;
}

export default function ForgeDashboard() {
  const [data, setData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingQuests, setGeneratingQuests] = useState(false);

  const generateDailyQuests = async () => {
    setGeneratingQuests(true);
    try {
      const res = await fetch('/api/hyro/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', count: 3 }),
      });
      const json = await res.json();
      if (json.success && data) {
        // Reload character data to get updated quests
        const charRes = await fetch('/api/hyro/forge/character');
        const charJson = await charRes.json();
        if (charJson.success) {
          setData(charJson.data);
        }
      }
    } catch (err) {
      console.error('Failed to generate quests:', err);
    } finally {
      setGeneratingQuests(false);
    }
  };

  useEffect(() => {
    async function loadCharacter() {
      try {
        const res = await fetch('/api/hyro/forge/character');
        const json = await res.json();

        if (!json.success) {
          setError(json.error || 'Failed to load character');
          return;
        }

        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadCharacter();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading FORGE...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Character Not Found</h2>
          <p className="text-gray-300 mb-4">{error || 'Character data not initialized'}</p>
          <p className="text-sm text-gray-400">
            The database migration may need to be run. Try restarting the dev server.
          </p>
        </div>
      </div>
    );
  }

  // Format stats for spider graph
  const spiderStats = data.stats.map((s) => ({
    name: s.stat_name,
    displayName: s.display_name,
    value: s.current_value,
    benchmark: s.benchmark || 50,
    fullMark: 100,
  }));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              HYRO FORGE
            </h1>
            <p className="text-sm text-gray-400">ULTRA-EDGE Education System</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/hyro/forge/reading"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Start Session
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Character Info */}
          <div className="space-y-6">
            <CharacterCard
              displayName={data.character.display_name}
              title={data.character.title}
              level={data.character.level}
              totalXp={data.character.total_xp}
              xpProgress={data.level_progress}
              streak={{
                current: data.character.current_streak,
                longest: data.character.longest_streak,
              }}
              powerLevel={data.power_level}
            />

            <XPBreakdown summary={data.xp_summary} />

            {/* Recent Achievements */}
            {data.recent_achievements.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Recent Achievements</h3>
                <div className="space-y-2">
                  {data.recent_achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="flex items-center gap-3 p-2 bg-gray-700/50 rounded"
                    >
                      <span className="text-2xl">{ach.icon}</span>
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

          {/* Center Column - Spider Graph */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2 text-center">
                Character Stats
              </h3>
              <SpiderGraph stats={spiderStats} showBenchmark size="md" />
            </div>

            {/* Stat bars for mobile/detail view */}
            <div className="mt-4 bg-gray-800 rounded-lg p-4 lg:hidden">
              <h3 className="text-lg font-semibold text-white mb-3">Stat Details</h3>
              <StatList
                stats={data.stats.map((s) => ({
                  displayName: s.display_name,
                  value: s.current_value,
                  benchmark: s.benchmark || 50,
                  trend: s.trend,
                }))}
              />
            </div>
          </div>

          {/* Right Column - Quests & Activity */}
          <div className="space-y-6">
            {/* Active Quests */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Active Quests</h3>
                <button className="text-sm text-blue-400 hover:text-blue-300">
                  View All
                </button>
              </div>

              {data.active_quests.length > 0 ? (
                <div className="space-y-3">
                  {data.active_quests.map((quest) => (
                    <div
                      key={quest.id}
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {quest.quest_type === 'daily' ? '📅' :
                           quest.quest_type === 'weekly' ? '📆' :
                           quest.quest_type === 'epic' ? '🏆' : '🎯'}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-white">{quest.title}</div>
                          <div className="text-xs text-gray-400 uppercase">{quest.quest_type}</div>
                        </div>
                      </div>
                      <div className="text-sm font-mono text-green-400">+{quest.xp_reward} XP</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No active quests</p>
                  <button
                    onClick={generateDailyQuests}
                    disabled={generatingQuests}
                    className="mt-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingQuests ? 'Generating...' : 'Generate Daily Quests'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              {/* Primary Action - Daily Session */}
              <Link
                href="/hyro/forge/session"
                className="block w-full p-4 mb-3 bg-gradient-to-r from-blue-600/30 to-purple-600/30 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-500/50 rounded-lg transition-colors text-center"
              >
                <span className="text-3xl block mb-1">🚀</span>
                <span className="text-base font-medium text-blue-300">Start Daily Session</span>
                <span className="text-xs block text-gray-400 mt-1">Guided learning plan</span>
              </Link>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/hyro/forge/srs"
                  className="p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">🧠</span>
                  <span className="text-sm text-blue-300">SRS Review</span>
                </Link>
                <Link
                  href="/hyro/forge/intel"
                  className="p-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">📰</span>
                  <span className="text-sm text-green-300">Daily Intel</span>
                </Link>
                <Link
                  href="/hyro/forge/reflections"
                  className="p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">🪞</span>
                  <span className="text-sm text-purple-300">Reflect</span>
                </Link>
                <Link
                  href="/hyro/forge/reading"
                  className="p-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">📚</span>
                  <span className="text-sm text-yellow-300">Reading</span>
                </Link>
              </div>
              {/* Secondary Actions Row */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Link
                  href="/hyro/forge/diagnostic"
                  className="p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">🧪</span>
                  <span className="text-sm text-red-300">Diagnostic</span>
                </Link>
                <Link
                  href="/hyro/forge/analytics"
                  className="p-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">📊</span>
                  <span className="text-sm text-cyan-300">Analytics</span>
                </Link>
                <Link
                  href="/hyro/forge/proficiency"
                  className="p-3 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">🎯</span>
                  <span className="text-sm text-orange-300">Proficiency</span>
                </Link>
              </div>
              {/* Parent Dashboard Link */}
              <div className="mt-3">
                <Link
                  href="/hyro/forge/parent"
                  className="block p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-600/50 rounded-lg transition-colors text-center"
                >
                  <span className="text-2xl block mb-1">👨‍👩‍👧‍👦</span>
                  <span className="text-sm text-blue-300">Parent Dashboard</span>
                </Link>
              </div>
            </div>

            {/* Stat Details (desktop) */}
            <div className="hidden lg:block bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Stat Details</h3>
              <StatList
                stats={data.stats.map((s) => ({
                  displayName: s.display_name,
                  value: s.current_value,
                  benchmark: s.benchmark || 50,
                  trend: s.trend,
                }))}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
