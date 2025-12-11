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
import StandardsGraph from '@/components/hyro/StandardsGraph';
import ExamReadinessCard from '@/components/forge/proficiency/ExamReadinessCard';
import AssessmentModal from '@/components/hyro/AssessmentModal';
import dynamic from 'next/dynamic';

// Dynamic import for graph to avoid SSR issues if needed, but standard import worked before.
// We'll stick to standard imports unless problematic.

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

  const [standards, setStandards] = useState<any[]>([]);
  const [mastery, setMastery] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'synapse'>('graph');

  // Modal State
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState<{ id: string, description: string } | null>(null);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedStandard({ id: node.id, description: node.description || '' });
    setAssessmentOpen(true);
  }, []);

  // Fetch skills and stats
  const fetchProficiency = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both old and new data for now (transition period)
      const [oldRes, newRes] = await Promise.all([
        fetch('/api/hyro/proficiency'),
        fetch('/api/hyro/education?action=standards')
      ]);

      if (oldRes.ok) {
        const data = await oldRes.json();
        setSkills(data.skills || []);
        setStats(data.stats || null);
      }

      if (newRes.ok) {
        const data = await newRes.json();
        setStandards(data.standards || []);
        setMastery(data.mastery || []);
        // Default to graph view if we have standards data
        if (data.standards?.length > 0) {
          setViewMode('graph');
        }
      }

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

  // Render return statement on one line to ensure no ASI issues
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-amber-500/30">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hyro/forge" className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="text-amber-500" size={20} />
                Skill Proficiency Matrix
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'graph' ? 'bg-amber-900/30 text-amber-400 shadow-sm border border-amber-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Graph
              </button>
              <button
                onClick={() => setViewMode('synapse')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'synapse' ? 'bg-purple-900/30 text-purple-400 shadow-sm border border-purple-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Synapse
              </button>
            </div>

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

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <SkillDashboard
          skills={skills}
          categoryFilter={categoryFilter || undefined}
        />

        {/* Oracle Dashboard: Exam Readiness */}
        <div className="mb-8">
          <ExamReadinessCard />
        </div>

        {/* Content Views */}
        {viewMode === 'graph' || viewMode === 'synapse' ? (
          <StandardsGraph
            standards={standards}
            mastery={mastery}
            viewMode={viewMode === 'synapse' ? 'synapse' : 'standard'}
            onNodeClick={handleNodeClick}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.filter(s => !categoryFilter || s.stat_name === categoryFilter).map((skill) => (
              <div key={skill.id} className="bg-zinc-900/50 border border-white/5 rounded-lg p-6 hover:bg-zinc-900 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-zinc-200 font-medium">{skill.name}</h3>
                    <p className="text-xs text-zinc-500 capitalize">{skill.stat_name.replace('_', ' ')}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${skill.proficiency_level >= 80 ? 'bg-emerald-900/30 text-emerald-400' :
                    skill.proficiency_level >= 60 ? 'bg-amber-900/30 text-amber-400' :
                      'bg-red-900/30 text-red-400'
                    }`}>
                    Lvl {skill.proficiency_level}
                  </div>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${skill.proficiency_level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AssessmentModal
        isOpen={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        standardId={selectedStandard?.id || ''}
        standardDescription={selectedStandard?.description || ''}
      />
    </div>
  );
}
