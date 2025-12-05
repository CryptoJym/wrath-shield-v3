'use client';

/**
 * SkillDashboard Component
 * Visual display of skill proficiencies with progress tracking
 * Shows individual skills, category summaries, and growth trends
 * Premium "Ultra-Edge" UI Overhaul
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Star, Trophy,
  Target, ChevronDown, ChevronUp, Lock, Unlock, ArrowUpDown
} from 'lucide-react';

export interface Skill {
  id: string;
  name: string;
  category: string;
  stat_name: string;
  proficiency_level: number;
  xp_current: number;
  xp_required: number;
  mastery_percent: number;
  last_practiced_at?: number;
  practice_count: number;
  trend: 'up' | 'down' | 'stable';
  is_unlocked: boolean;
  unlock_requirement?: string;
}

interface SkillDashboardProps {
  skills: Skill[];
  categoryFilter?: string;
  onSelectSkill?: (skill: Skill) => void;
}

const statColors: Record<string, string> = {
  strength: 'text-red-400 bg-red-500/10 border-red-500/20',
  intelligence: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  wisdom: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  charisma: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  dexterity: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  constitution: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
};

const categoryLabels: Record<string, string> = {
  mathematics: 'Math',
  reading: 'Reading',
  science: 'Science',
  history: 'History',
  language_arts: 'Language',
  critical_thinking: 'Thinking',
  communication: 'Communication',
  creativity: 'Creativity',
};

function getLevelLabel(level: number): string {
  if (level >= 90) return 'Master';
  if (level >= 75) return 'Expert';
  if (level >= 60) return 'Advanced';
  if (level >= 40) return 'Intermediate';
  if (level >= 20) return 'Novice';
  return 'Beginner';
}

function getLevelColorClass(level: number): string {
  if (level >= 90) return 'text-amber-400';
  if (level >= 75) return 'text-purple-400';
  if (level >= 60) return 'text-blue-400';
  if (level >= 40) return 'text-emerald-400';
  if (level >= 20) return 'text-lime-400';
  return 'text-zinc-500';
}

function getLevelGradient(level: number): string {
  if (level >= 90) return 'from-amber-500 to-orange-600';
  if (level >= 75) return 'from-purple-500 to-indigo-600';
  if (level >= 60) return 'from-blue-500 to-cyan-600';
  if (level >= 40) return 'from-emerald-500 to-teal-600';
  if (level >= 20) return 'from-lime-500 to-green-600';
  return 'from-zinc-600 to-zinc-700';
}

export function SkillDashboard({ skills, categoryFilter, onSelectSkill }: SkillDashboardProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'level' | 'recent' | 'name'>('level');

  // Group skills by category
  const groupedSkills = useMemo(() => {
    const groups: Record<string, Skill[]> = {};

    skills.forEach((skill) => {
      if (categoryFilter && skill.category !== categoryFilter) return;

      if (!groups[skill.category]) {
        groups[skill.category] = [];
      }
      groups[skill.category].push(skill);
    });

    // Sort within each group
    Object.keys(groups).forEach((cat) => {
      groups[cat].sort((a, b) => {
        switch (sortBy) {
          case 'level':
            return b.proficiency_level - a.proficiency_level;
          case 'recent':
            return (b.last_practiced_at || 0) - (a.last_practiced_at || 0);
          case 'name':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
    });

    return groups;
  }, [skills, categoryFilter, sortBy]);

  // Calculate category averages
  const categoryStats = useMemo(() => {
    const stats: Record<string, { avg: number; count: number; unlocked: number }> = {};

    Object.entries(groupedSkills).forEach(([cat, catSkills]) => {
      const unlocked = catSkills.filter((s) => s.is_unlocked);
      stats[cat] = {
        avg: unlocked.length > 0
          ? unlocked.reduce((sum, s) => sum + s.proficiency_level, 0) / unlocked.length
          : 0,
        count: catSkills.length,
        unlocked: unlocked.length,
      };
    });

    return stats;
  }, [groupedSkills]);

  const toggleCategory = (cat: string) => {
    setExpandedCategory((prev) => (prev === cat ? null : cat));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-zinc-900/40 backdrop-blur-md border border-white/5 p-4 rounded-xl">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          Skill Proficiency
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Sort:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none bg-zinc-950 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50 cursor-pointer hover:bg-zinc-900 transition-colors"
            >
              <option value="level">By Level</option>
              <option value="recent">Recently Practiced</option>
              <option value="name">Alphabetical</option>
            </select>
            <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Category List */}
      <div className="space-y-4">
        {Object.entries(groupedSkills).map(([category, catSkills]) => {
          const stats = categoryStats[category];
          const isExpanded = expandedCategory === category;

          return (
            <div key={category} className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden transition-all duration-300">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left group"
              >
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
                    {categoryLabels[category] || category}
                    <span className="text-xs font-normal text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-white/5">
                      {stats.unlocked}/{stats.count}
                    </span>
                  </h3>
                </div>

                {/* Category Progress */}
                <div className="flex items-center gap-3 w-32 md:w-48">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getLevelGradient(stats.avg)} rounded-full transition-all duration-500`}
                      style={{ width: `${stats.avg}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold w-10 text-right ${getLevelColorClass(stats.avg)}`}>
                    {Math.round(stats.avg)}%
                  </span>
                </div>

                <div className={`text-zinc-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown size={20} />
                </div>
              </button>

              {/* Expanded Skills */}
              {isExpanded && (
                <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="h-px bg-white/5 col-span-full mb-2" />
                  {catSkills.map((skill) => (
                    <div
                      key={skill.id}
                      onClick={() => skill.is_unlocked && onSelectSkill?.(skill)}
                      className={`
                        relative p-4 rounded-xl border transition-all duration-200 group
                        ${skill.is_unlocked
                          ? 'bg-zinc-950/50 border-white/5 hover:border-amber-500/30 hover:bg-zinc-900/80 cursor-pointer'
                          : 'bg-zinc-950/30 border-white/5 opacity-60 cursor-not-allowed'}
                      `}
                    >
                      {/* Skill Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {skill.is_unlocked ? (
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                              <Unlock size={14} />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500">
                              <Lock size={14} />
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                              {skill.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${statColors[skill.stat_name] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                                {skill.stat_name}
                              </span>
                            </div>
                          </div>
                        </div>

                        {skill.is_unlocked && (
                          <div className="flex items-center gap-1">
                            {skill.trend === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
                            {skill.trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
                            {skill.trend === 'stable' && <Minus size={14} className="text-zinc-600" />}
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {skill.is_unlocked ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${getLevelGradient(skill.proficiency_level)} rounded-full transition-all duration-500`}
                                style={{ width: `${skill.proficiency_level}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-white">{skill.proficiency_level}%</span>
                          </div>

                          {/* Skill Details */}
                          <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-white/5 pt-2">
                            <div className={`flex items-center gap-1 font-medium ${getLevelColorClass(skill.proficiency_level)}`}>
                              <Star size={12} />
                              {getLevelLabel(skill.proficiency_level)}
                            </div>
                            <div className="flex items-center gap-3">
                              <span>{skill.xp_current}/{skill.xp_required} XP</span>
                              <span className="flex items-center gap-1 text-zinc-400">
                                <Target size={12} />
                                {skill.practice_count}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded-lg border border-white/5">
                          <Lock size={12} />
                          {skill.unlock_requirement || 'Complete prerequisites to unlock'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(groupedSkills).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-6 bg-zinc-900/50 rounded-full mb-4">
            <Trophy size={48} className="text-zinc-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Skills Available</h3>
          <p className="text-zinc-400 max-w-md">
            Start learning to unlock new skills!
          </p>
        </div>
      )}
    </div>
  );
}
