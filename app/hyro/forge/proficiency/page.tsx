'use client';

/**
 * HYRO FORGE: Skill Proficiency Page
 * Detailed view of skill progress and mastery levels
 * Premium "Ultra-Edge" UI Overhaul
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Trophy, Loader2, Target, Star, TrendingUp, Brain, Shield } from 'lucide-react';
import Link from 'next/link';
import { SkillDashboard, type Skill } from '@/components/forge/proficiency';

interface ProficiencyStats {
  total_skills: number;
  unlocked_skills: number;
  mastered_skills: number;
  avg_proficiency: number;
  total_practice_sessions: number;
  strongest_category: string;
  weakest_category: string;
}

const categoryList = [
  { value: '', label: 'All Categories' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'reading', label: 'Reading' },
  { value: 'science', label: 'Science' },
  { value: 'history', label: 'History' },
  { value: 'language_arts', label: 'Language Arts' },
  { value: 'critical_thinking', label: 'Critical Thinking' },
  { value: 'communication', label: 'Communication' },
  { value: 'creativity', label: 'Creativity' },
];

export default function ProficiencyPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [stats, setStats] = useState<ProficiencyStats | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch skills and stats
  const fetchProficiency = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/hyro/proficiency');
      if (!response.ok) throw new Error('Failed to fetch proficiency data');

      const data = await response.json();
      setSkills(data.skills || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proficiency');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProficiency();
  }, [fetchProficiency]);

  // Calculate stat summaries
  const statSummaries = useMemo(() => {
    const summaries: Record<string, { count: number; avgLevel: number }> = {};

    skills.forEach((skill) => {
      if (!skill.is_unlocked) return;

      if (!summaries[skill.stat_name]) {
        summaries[skill.stat_name] = { count: 0, avgLevel: 0 };
      }
      summaries[skill.stat_name].count++;
      summaries[skill.stat_name].avgLevel += skill.proficiency_level;
    });

    // Calculate averages
    Object.keys(summaries).forEach((stat) => {
      if (summaries[stat].count > 0) {
        summaries[stat].avgLevel /= summaries[stat].count;
      }
    });

    return summaries;
  }, [skills]);

  if (loading && skills.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400 uppercase tracking-widest text-sm">Calibrating Skill Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-amber-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-zinc-900/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/hyro/forge"
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 flex items-center gap-3">
                  <Trophy className="text-amber-400" size={24} />
                  SKILL PROFICIENCY
                </h1>
              </div>
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none bg-zinc-900/80 border border-white/10 rounded-lg pl-4 pr-10 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all cursor-pointer hover:bg-zinc-800"
              >
                {categoryList.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <Target size={14} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="relative z-10 border-b border-white/5 bg-zinc-900/30 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-widest font-medium">
                  <Target size={14} />
                  <span>Unlocked</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {stats.unlocked_skills}<span className="text-zinc-600 text-sm font-normal">/{stats.total_skills}</span>
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-widest font-medium">
                  <Star size={14} className="text-amber-400" />
                  <span>Mastered</span>
                </div>
                <span className="text-xl font-bold text-amber-400 glow-text-amber">
                  {stats.mastered_skills}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-widest font-medium">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span>Average</span>
                </div>
                <span className="text-xl font-bold text-emerald-400">
                  {Math.round(stats.avg_proficiency)}%
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-widest font-medium">
                  <Brain size={14} className="text-purple-400" />
                  <span>Practices</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {stats.total_practice_sessions}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat Summaries */}
      {Object.keys(statSummaries).length > 0 && (
        <div className="relative z-10 border-b border-white/5 bg-zinc-950/50 backdrop-blur-sm overflow-x-auto">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex gap-4 min-w-max">
              {Object.entries(statSummaries).map(([stat, data]) => (
                <div key={stat} className="flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 rounded-lg border border-white/5">
                  <span className="text-xs font-medium text-zinc-400 capitalize w-16 truncate">{stat}</span>
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                      style={{ width: `${data.avgLevel}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white w-8 text-right">{Math.round(data.avgLevel)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strength/Weakness Hints */}
      {stats && stats.strongest_category && stats.weakest_category && (
        <div className="relative z-10 bg-zinc-900/20 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-2 flex justify-center gap-8 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <TrendingUp size={12} className="text-emerald-400" />
              <span>Strongest: <strong className="text-emerald-400 capitalize ml-1">{stats.strongest_category.replace('_', ' ')}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Target size={12} className="text-amber-400" />
              <span>Focus Area: <strong className="text-amber-400 capitalize ml-1">{stats.weakest_category.replace('_', ' ')}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="max-w-md mx-auto mt-8 p-6 bg-red-950/30 border border-red-500/30 rounded-2xl text-center backdrop-blur-md">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-400 mb-2">Data Retrieval Failed</h3>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={fetchProficiency}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-all"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-6">
        <SkillDashboard
          skills={skills}
          categoryFilter={categoryFilter || undefined}
        />
      </main>
    </div>
  );
}
