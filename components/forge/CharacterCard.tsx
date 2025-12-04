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
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 ${className}`}>
      {/* Header with name and title */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{displayName}</h2>
          <p className="text-purple-400 italic">"{title}"</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-400">Lv.{level}</div>
          <div className="text-sm text-gray-400">{totalXp.toLocaleString()} XP</div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Level Progress</span>
          <span>{xpProgress.xp_in_level} / {xpProgress.xp_for_next_level} XP</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress.progress_percent}%` }}
          />
        </div>
        <div className="text-right text-xs text-gray-500 mt-1">
          {xpProgress.progress_percent.toFixed(1)}%
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Streak */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🔥</span>
            <span className="text-xl font-bold text-orange-400">{streak.current}</span>
          </div>
          <div className="text-xs text-gray-400">Day Streak</div>
          <div className="text-xs text-gray-500">Best: {streak.longest}</div>
        </div>

        {/* Power Level */}
        {powerLevel && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">⚡</span>
              <span className="text-xl font-bold text-yellow-400">{powerLevel.power_level}</span>
            </div>
            <div className="text-xs text-gray-400">{powerLevel.rank}</div>
            <div className="text-xs text-gray-500">Power Level</div>
          </div>
        )}
      </div>

      {/* Stat highlights */}
      {powerLevel && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Strongest: </span>
              <span className="text-green-400">{powerLevel.strongest_stat}</span>
            </div>
            <div>
              <span className="text-gray-400">Focus on: </span>
              <span className="text-yellow-400">{powerLevel.weakest_stat}</span>
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
  const sourceLabels: Record<string, { label: string; icon: string }> = {
    quest: { label: 'Quests', icon: '🎯' },
    daily: { label: 'Daily', icon: '📅' },
    streak: { label: 'Streak', icon: '🔥' },
    achievement: { label: 'Achievements', icon: '🏆' },
    srs: { label: 'Reviews', icon: '🧠' },
    intel: { label: 'Intel', icon: '📰' },
    reflection: { label: 'Reflection', icon: '🪞' },
    bonus: { label: 'Bonus', icon: '🎁' },
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-3">XP Breakdown</h3>

      {/* Time periods */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-gray-700/50 rounded">
          <div className="text-lg font-bold text-blue-400">{summary.today}</div>
          <div className="text-xs text-gray-400">Today</div>
        </div>
        <div className="text-center p-2 bg-gray-700/50 rounded">
          <div className="text-lg font-bold text-green-400">{summary.this_week}</div>
          <div className="text-xs text-gray-400">This Week</div>
        </div>
        <div className="text-center p-2 bg-gray-700/50 rounded">
          <div className="text-lg font-bold text-purple-400">{summary.this_month}</div>
          <div className="text-xs text-gray-400">This Month</div>
        </div>
      </div>

      {/* By source */}
      <div className="space-y-2">
        {Object.entries(summary.by_source)
          .filter(([, value]) => value > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([source, value]) => {
            const info = sourceLabels[source] || { label: source, icon: '📊' };
            return (
              <div key={source} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-300">
                  <span>{info.icon}</span>
                  {info.label}
                </span>
                <span className="text-gray-400 font-mono">{value} XP</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
