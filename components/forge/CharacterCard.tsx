'use client';

/**
 * HYRO FORGE: Character Card Component
 * Displays character level, XP progress, streak, and title
 */

import React from 'react';

interface CharacterCardProps {
  displayName: string;
  title: string;
  level: number;
  totalXp: number;
  xpProgress: {
    level: number;
    xp_in_level: number;
    xp_for_next_level: number;
    progress_percent: number;
  };
  streak: {
    current: number;
    longest: number;
  };
  powerLevel?: {
    power_level: number;
    rank: string;
    strongest_stat: string;
    weakest_stat: string;
  };
  className?: string;
}

export function CharacterCard({
  displayName,
  title,
  level,
  totalXp,
  xpProgress,
  streak,
  powerLevel,
  className = '',
}: CharacterCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-md p-6 ${className}`}>
      {/* Ambient Glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with name and title */}
      <div className="relative flex items-start justify-between mb-6">
        <div className="min-w-0 flex-1 mr-4">
          <h2 className="text-3xl font-bold text-white tracking-tight truncate" title={displayName}>{displayName}</h2>
          <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-medium italic truncate">
            "{title}"
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-300">
            Lv.{level}
          </div>
          <div className="text-sm font-medium text-zinc-400">{totalXp.toLocaleString()} XP</div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="relative mb-6">
        <div className="flex justify-between text-sm font-medium text-zinc-400 mb-2">
          <span>Level Progress</span>
          <span className="text-zinc-300">{xpProgress.xp_in_level} / {xpProgress.xp_for_next_level} XP</span>
        </div>
        <div className="h-4 bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${xpProgress.progress_percent}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
          </div>
        </div>
        <div className="text-right text-xs font-bold text-zinc-500 mt-1.5">
          {xpProgress.progress_percent.toFixed(1)}%
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 relative">
        {/* Streak */}
        <div className="bg-zinc-800/40 rounded-xl p-4 border border-white/5 hover:bg-zinc-800/60 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔥</span>
            <span className="text-2xl font-bold text-orange-400">{streak.current}</span>
          </div>
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Day Streak</div>
          <div className="text-xs text-zinc-500 mt-1">Best: {streak.longest}</div>
        </div>

        {/* Power Level */}
        {powerLevel && (
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-white/5 hover:bg-zinc-800/60 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚡</span>
              <span className="text-2xl font-bold text-yellow-400">{powerLevel.power_level}</span>
            </div>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{powerLevel.rank}</div>
            <div className="text-xs text-zinc-500 mt-1">Power Level</div>
          </div>
        )}
      </div>

      {/* Stat highlights */}
      {powerLevel && (
        <div className="mt-6 pt-4 border-t border-white/5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Strongest Asset</span>
              <span className="font-bold text-emerald-400">{powerLevel.strongest_stat}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Focus Area</span>
              <span className="font-bold text-amber-400">{powerLevel.weakest_stat}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * XP Breakdown component
 */
export function XPBreakdown({
  summary,
  className = '',
}: {
  summary: {
    today: number;
    this_week: number;
    this_month: number;
    by_source: Record<string, number>;
  };
  className?: string;
}) {
  const sourceLabels: Record<string, { label: string; icon: string; color: string }> = {
    quest: { label: 'Quests', icon: '🎯', color: 'text-red-400' },
    daily: { label: 'Daily', icon: '📅', color: 'text-blue-400' },
    streak: { label: 'Streak', icon: '🔥', color: 'text-orange-400' },
    achievement: { label: 'Achievements', icon: '🏆', color: 'text-yellow-400' },
    srs: { label: 'Reviews', icon: '🧠', color: 'text-pink-400' },
    intel: { label: 'Intel', icon: '📰', color: 'text-green-400' },
    reflection: { label: 'Reflection', icon: '🪞', color: 'text-purple-400' },
    bonus: { label: 'Bonus', icon: '🎁', color: 'text-cyan-400' },
  };

  return (
    <div className={`bg-zinc-900/50 backdrop-blur-md rounded-2xl p-6 border border-white/10 ${className}`}>
      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">XP Breakdown</h3>

      {/* Time periods */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-3 bg-zinc-800/40 rounded-xl border border-white/5">
          <div className="text-xl font-bold text-blue-400">{summary.today}</div>
          <div className="text-[10px] font-medium text-zinc-500 uppercase mt-1">Today</div>
        </div>
        <div className="text-center p-3 bg-zinc-800/40 rounded-xl border border-white/5">
          <div className="text-xl font-bold text-emerald-400">{summary.this_week}</div>
          <div className="text-[10px] font-medium text-zinc-500 uppercase mt-1">Week</div>
        </div>
        <div className="text-center p-3 bg-zinc-800/40 rounded-xl border border-white/5">
          <div className="text-xl font-bold text-purple-400">{summary.this_month}</div>
          <div className="text-[10px] font-medium text-zinc-500 uppercase mt-1">Month</div>
        </div>
      </div>

      {/* By source */}
      <div className="space-y-3">
        {Object.entries(summary.by_source)
          .filter(([, value]) => value > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([source, value]) => {
            const info = sourceLabels[source] || { label: source, icon: '📊', color: 'text-gray-400' };
            return (
              <div key={source} className="flex items-center justify-between group">
                <span className="flex items-center gap-3 text-zinc-300 group-hover:text-white transition-colors">
                  <span className={`text-lg opacity-80 ${info.color}`}>{info.icon}</span>
                  <span className="text-sm font-medium">{info.label}</span>
                </span>
                <span className="text-sm font-mono font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  +{value} XP
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
