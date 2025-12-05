'use client';

/**
 * HYRO FORGE: ULTRA-EDGE Dashboard
 * Main dashboard page for Hyro's RPG-style education system
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser, RedirectToSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
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
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [data, setData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingQuests, setGeneratingQuests] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);

  // Timeout fallback if Clerk takes too long to load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded) {
        console.log('[Forge] Auth timeout - Clerk not loading, redirecting to sign-in');
        setAuthTimeout(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timer);
  }, [isLoaded]);

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

  // Check onboarding status (non-blocking)
  useEffect(() => {
    async function checkOnboarding() {
      if (!isLoaded || !user) return;

      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Onboarding check timed out')), 3000)
        );

        // Race the fetch against the timeout
        const res = await Promise.race([
          fetch('/api/hyro/forge/onboarding/status'),
          timeoutPromise
        ]) as Response;

        // If 401 or not OK, skip onboarding check - character load will handle it
        if (!res.ok) {
          console.log('[Forge] Onboarding status check failed with', res.status, '- proceeding');
          return;
        }

        const json = await res.json();

        if (!json.success) {
          // API failed - let user through, will be handled by character load
          return;
        }

        if (json.data?.needsOnboarding || !json.data?.onboardingCompleted) {
          // Redirect to onboarding if not completed
          router.push('/hyro/forge/onboarding');
          return;
        }
      } catch (err) {
        console.error('Failed to check onboarding status:', err);
      }
    }

    checkOnboarding();
  }, [isLoaded, user, router]);

  // Load character data
  useEffect(() => {
    async function loadCharacter() {
      if (!isLoaded || !user) return;

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
  }, [isLoaded, user]);

  // Show loading state while Clerk loads (with timeout fallback)
  if (!isLoaded && !authTimeout) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading FORGE...</p>
          <p className="text-gray-500 text-sm mt-2">Waiting for auth...</p>
        </div>
      </div>
    );
  }

  // If auth timed out or no user, redirect to sign in
  if (authTimeout || (!isLoaded && !user)) {
    return <RedirectToSignIn />;
  }

  // Redirect to sign in if not authenticated
  if (!user) {
    return <RedirectToSignIn />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading character data...</p>
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
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-hidden">
      {/* Global Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
              HYRO FORGE
            </h1>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Ultra-Edge Education System</p>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-zinc-400">
              Welcome, <span className="text-white">{user.firstName || user.username || 'Student'}</span>
            </span>
            <Link
              href="/hyro/forge/reading"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-600/40"
            >
              Start Session
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Character Info */}
          <div className="space-y-8">
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
              <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Recent Achievements</h3>
                <div className="space-y-3">
                  {data.recent_achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="flex items-center gap-4 p-3 bg-zinc-800/40 rounded-xl border border-white/5 hover:bg-zinc-800/60 transition-colors"
                    >
                      <span className="text-3xl filter drop-shadow-md">{ach.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-white">{ach.name}</div>
                        <div className="text-xs text-zinc-400">{ach.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Column - Spider Graph */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2 text-center">
                Character Stats
              </h3>
              <div className="flex items-center justify-center -mt-2">
                <SpiderGraph stats={spiderStats} showBenchmark size="md" className="w-full" />
              </div>
            </div>

            {/* Manifold Link - Prominent Placement */}
            <Link
              href="/hyro/manifold"
              className="group relative overflow-hidden block p-5 bg-gradient-to-r from-purple-900/40 to-blue-900/40 hover:from-purple-900/60 hover:to-blue-900/60 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl transition-all text-center shadow-lg shadow-purple-900/10"
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center justify-center gap-4">
                <span className="text-3xl filter drop-shadow-lg group-hover:scale-110 transition-transform">🔮</span>
                <div className="text-left">
                  <span className="block text-lg font-bold text-white group-hover:text-purple-200 transition-colors">Enter Manifold</span>
                  <span className="block text-xs font-medium text-purple-300/80 uppercase tracking-wider">View State Vector</span>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Stat bars for mobile/detail view */}
            <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 lg:hidden">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Stat Details</h3>
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
          <div className="space-y-8">
            {/* Active Quests */}
            <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Active Quests</h3>
                <button className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  View All
                </button>
              </div>

              {data.active_quests.length > 0 ? (
                <div className="space-y-3">
                  {data.active_quests.map((quest) => (
                    <div
                      key={quest.id}
                      className="group relative overflow-hidden flex items-center justify-between p-4 bg-zinc-800/40 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-blue-500/10 group-hover:to-blue-500/5 transition-all duration-500" />

                      <div className="relative flex items-center gap-4">
                        <span className="text-2xl filter drop-shadow-lg">
                          {quest.quest_type === 'daily' ? '📅' :
                            quest.quest_type === 'weekly' ? '📆' :
                              quest.quest_type === 'epic' ? '🏆' : '🎯'}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-blue-200 transition-colors">{quest.title}</div>
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{quest.quest_type}</div>
                        </div>
                      </div>
                      <div className="relative text-sm font-mono font-bold text-emerald-400">+{quest.xp_reward} XP</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <p className="mb-4">No active quests</p>
                  <button
                    onClick={generateDailyQuests}
                    disabled={generatingQuests}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors border border-white/5 disabled:opacity-50"
                  >
                    {generatingQuests ? 'Generating...' : 'Generate Daily Quests'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6">Quick Actions</h3>

              {/* Primary Action - Daily Session */}
              <Link
                href="/hyro/forge/session"
                className="group block w-full p-5 mb-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="text-center relative z-10">
                  <span className="text-4xl block mb-2 filter drop-shadow-lg">🚀</span>
                  <span className="text-lg font-bold text-blue-100 block">Start Daily Session</span>
                  <span className="text-xs font-medium text-blue-300/70 block mt-1">Guided learning plan</span>
                </div>
              </Link>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/hyro/forge/srs"
                  className="p-4 bg-zinc-800/40 hover:bg-blue-900/20 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all text-center group"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">🧠</span>
                  <span className="text-sm font-bold text-zinc-300 group-hover:text-blue-300">SRS Review</span>
                </Link>
                <Link
                  href="/hyro/forge/intel"
                  className="p-4 bg-zinc-800/40 hover:bg-emerald-900/20 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all text-center group"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">📰</span>
                  <span className="text-sm font-bold text-zinc-300 group-hover:text-emerald-300">Daily Intel</span>
                </Link>
                <Link
                  href="/hyro/forge/reflections"
                  className="p-4 bg-zinc-800/40 hover:bg-purple-900/20 border border-white/5 hover:border-purple-500/30 rounded-xl transition-all text-center group"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">🪞</span>
                  <span className="text-sm font-bold text-zinc-300 group-hover:text-purple-300">Reflect</span>
                </Link>
                <Link
                  href="/hyro/forge/reading"
                  className="p-4 bg-zinc-800/40 hover:bg-amber-900/20 border border-white/5 hover:border-amber-500/30 rounded-xl transition-all text-center group"
                >
                  <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">📚</span>
                  <span className="text-sm font-bold text-zinc-300 group-hover:text-amber-300">Reading</span>
                </Link>
              </div>

              {/* Secondary Actions Row */}
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Link
                  href="/hyro/forge/diagnostic"
                  className="p-3 bg-zinc-800/30 hover:bg-red-900/10 border border-white/5 hover:border-red-500/20 rounded-xl transition-all text-center group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">🧪</span>
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-red-300">Diagnostic</span>
                </Link>
                <Link
                  href="/hyro/forge/analytics"
                  className="p-3 bg-zinc-800/30 hover:bg-cyan-900/10 border border-white/5 hover:border-cyan-500/20 rounded-xl transition-all text-center group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">📊</span>
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-cyan-300">Analytics</span>
                </Link>
                <Link
                  href="/hyro/forge/proficiency"
                  className="p-3 bg-zinc-800/30 hover:bg-orange-900/10 border border-white/5 hover:border-orange-500/20 rounded-xl transition-all text-center group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">🎯</span>
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-orange-300">Proficiency</span>
                </Link>
              </div>

              {/* Manifold & Parent Dashboard Links */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Link
                  href="/hyro/manifold"
                  className="block p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 hover:from-purple-900/30 hover:to-blue-900/30 border border-purple-500/20 hover:border-purple-500/40 rounded-xl transition-all text-center group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">🔮</span>
                  <span className="text-xs font-bold text-purple-300">Manifold</span>
                  <span className="text-[9px] block text-zinc-500 mt-0.5 uppercase tracking-wide">State Vector</span>
                </Link>
                <Link
                  href="/hyro/forge/parent"
                  className="block p-3 bg-gradient-to-r from-blue-900/20 to-cyan-900/20 hover:from-blue-900/30 hover:to-cyan-900/30 border border-blue-500/20 hover:border-blue-500/40 rounded-xl transition-all text-center group"
                >
                  <span className="text-xl block mb-1 group-hover:scale-110 transition-transform">👨‍👩‍👧‍👦</span>
                  <span className="text-xs font-bold text-blue-300">Parent</span>
                  <span className="text-[9px] block text-zinc-500 mt-0.5 uppercase tracking-wide">Dashboard</span>
                </Link>
              </div>
            </div>

            {/* Stat Details (desktop) */}
            <div className="hidden lg:block bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Stat Details</h3>
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
