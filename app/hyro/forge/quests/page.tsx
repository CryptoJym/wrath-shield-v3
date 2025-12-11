'use client';

/**
 * HYRO FORGE: Quest Management Dashboard
 * Full quest list, details view, and quest actions
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle, Clock, AlertTriangle, Trophy, Target, Calendar, Zap, Play } from 'lucide-react';

interface Quest {
  id: string;
  title: string;
  description?: string;
  quest_type: 'daily' | 'weekly' | 'epic' | 'challenge';
  xp_reward: number;
  status: 'available' | 'in_progress' | 'completed';
  platform?: string;
  due_at?: number;  // Unix timestamp
  created_at?: number;
  completed_at?: number;
}

interface QuestData {
  active: Quest[];
  due_today: Quest[];
  overdue: Quest[];
  summary: {
    active_count: number;
    due_today_count: number;
    overdue_count: number;
  };
}

function QuestsContent() {
  const searchParams = useSearchParams();
  const selectedQuestId = searchParams.get('id');

  const [data, setData] = useState<QuestData | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'in_progress' | 'completed'>('all');
  const [error, setError] = useState<string | null>(null);

  // Fetch quests
  useEffect(() => {
    fetchQuests();
  }, []);

  // If quest ID is in URL, fetch that specific quest
  useEffect(() => {
    if (selectedQuestId) {
      fetchQuestById(selectedQuestId);
    }
  }, [selectedQuestId]);

  const fetchQuests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hyro/quests');
      if (!res.ok) throw new Error('Failed to fetch quests');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestById = async (id: string) => {
    try {
      const res = await fetch(`/api/hyro/quests?id=${id}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedQuest(json.quest);
      }
    } catch (err) {
      console.error('Failed to fetch quest:', err);
    }
  };

  const startQuest = async (questId: string) => {
    try {
      setActionLoading(questId);
      const res = await fetch('/api/hyro/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', quest_id: questId }),
      });
      if (!res.ok) throw new Error('Failed to start quest');
      await fetchQuests();
      if (selectedQuestId === questId) {
        await fetchQuestById(questId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start quest');
    } finally {
      setActionLoading(null);
    }
  };

  const completeQuest = async (questId: string) => {
    try {
      setActionLoading(questId);
      const res = await fetch('/api/hyro/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', quest_id: questId }),
      });
      if (!res.ok) throw new Error('Failed to complete quest');
      const result = await res.json();
      await fetchQuests();
      if (selectedQuestId === questId) {
        await fetchQuestById(questId);
      }
      // Show XP earned toast or notification
      if (result.xp_earned > 0) {
        // Could add toast notification here
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete quest');
    } finally {
      setActionLoading(null);
    }
  };

  const generateDailyQuests = async () => {
    try {
      setActionLoading('generate');
      const res = await fetch('/api/hyro/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-daily' }),
      });
      if (!res.ok) throw new Error('Failed to generate quests');
      await fetchQuests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate quests');
    } finally {
      setActionLoading(null);
    }
  };

  const getQuestIcon = (type: string) => {
    switch (type) {
      case 'daily': return '📅';
      case 'weekly': return '📆';
      case 'epic': return '🏆';
      case 'challenge': return '⚔️';
      default: return '🎯';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <Target className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'in_progress': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  const getAllQuests = (): Quest[] => {
    if (!data) return [];
    const all = [...data.active, ...data.due_today, ...data.overdue];
    // Remove duplicates by ID
    const seen = new Set<string>();
    return all.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  };

  const getFilteredQuests = (): Quest[] => {
    const all = getAllQuests();
    switch (filter) {
      case 'active': return all.filter(q => q.status === 'available');
      case 'in_progress': return all.filter(q => q.status === 'in_progress');
      case 'completed': return all.filter(q => q.status === 'completed');
      default: return all;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg">Loading your quests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-4xl">📜</span>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Quest Log
                </h1>
                <p className="text-sm text-zinc-400">
                  {data?.summary.active_count || 0} active quests • {data?.summary.due_today_count || 0} due today
                </p>
              </div>
            </div>
            <button
              onClick={generateDailyQuests}
              disabled={actionLoading === 'generate'}
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-500/25"
            >
              {actionLoading === 'generate' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Generate New Quests</span>
              <span className="sm:hidden">Generate</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quest List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="flex gap-2">
              {(['all', 'active', 'in_progress', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                    }`}
                >
                  {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Overdue Warning */}
            {data && data.overdue.length > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-3 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">{data.overdue.length} overdue quest{data.overdue.length > 1 ? 's' : ''}</span>
                </div>
              </div>
            )}

            {/* Quest Grid */}
            <div className="space-y-3">
              {getFilteredQuests().length > 0 ? (
                getFilteredQuests().map((quest) => (
                  <Link
                    key={quest.id}
                    href={`/hyro/forge/quests?id=${quest.id}`}
                    className={`group block p-5 rounded-xl border transition-all ${selectedQuestId === quest.id
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-zinc-900/50 border-white/5 hover:border-blue-500/30 hover:bg-zinc-900/80'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <span className="text-3xl filter drop-shadow-lg">
                          {getQuestIcon(quest.quest_type)}
                        </span>
                        <div>
                          <h3 className="font-bold text-white group-hover:text-blue-200 transition-colors">
                            {quest.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(quest.status)}`}>
                              {getStatusIcon(quest.status)}
                              {quest.status === 'in_progress' ? 'In Progress' : quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                            </span>
                            <span className="text-xs text-zinc-500 uppercase tracking-wider">
                              {quest.quest_type}
                            </span>
                            {quest.platform && (
                              <span className="text-xs text-zinc-600">
                                {quest.platform}
                              </span>
                            )}
                          </div>
                          {quest.description && (
                            <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                              {quest.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-mono font-bold text-emerald-400">
                          +{quest.xp_reward} XP
                        </div>
                        {quest.due_at && (
                          <div className="text-xs text-zinc-500 mt-1 flex items-center justify-end gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(quest.due_at * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-16 text-zinc-500">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No quests found</p>
                  <p className="text-sm mt-1">Generate some daily quests to get started!</p>
                </div>
              )}
            </div>
          </div>

          {/* Quest Detail Panel */}
          <div className="lg:col-span-1">
            {selectedQuest ? (
              <div className="sticky top-24 bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
                {/* Quest Header */}
                <div className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl filter drop-shadow-lg">
                      {getQuestIcon(selectedQuest.quest_type)}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedQuest.title}</h2>
                      <span className="text-sm text-zinc-400 uppercase tracking-wider">
                        {selectedQuest.quest_type} Quest
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Status & XP */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(selectedQuest.status)}`}>
                      {getStatusIcon(selectedQuest.status)}
                      {selectedQuest.status === 'in_progress' ? 'In Progress' : selectedQuest.status.charAt(0).toUpperCase() + selectedQuest.status.slice(1)}
                    </span>
                    <div className="text-2xl font-mono font-bold text-emerald-400">
                      +{selectedQuest.xp_reward} XP
                    </div>
                  </div>

                  {/* Description */}
                  {selectedQuest.description && (
                    <div>
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Description
                      </h4>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {selectedQuest.description}
                      </p>
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-3">
                    {selectedQuest.platform && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Platform</span>
                        <span className="text-zinc-300">{selectedQuest.platform}</span>
                      </div>
                    )}
                    {selectedQuest.due_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Due Date</span>
                        <span className="text-zinc-300">
                          {new Date(selectedQuest.due_at * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    {selectedQuest.status === 'available' && (
                      <button
                        onClick={() => startQuest(selectedQuest.id)}
                        disabled={actionLoading === selectedQuest.id}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {actionLoading === selectedQuest.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                        Start Quest
                      </button>
                    )}
                    {selectedQuest.status === 'in_progress' && (
                      <button
                        onClick={() => completeQuest(selectedQuest.id)}
                        disabled={actionLoading === selectedQuest.id}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {actionLoading === selectedQuest.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                        Complete Quest
                      </button>
                    )}
                    {selectedQuest.status === 'completed' && (
                      <div className="text-center py-4">
                        <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                        <p className="text-emerald-400 font-bold">Quest Completed!</p>
                        {selectedQuest.completed_at && (
                          <p className="text-xs text-zinc-500 mt-1">
                            {new Date(selectedQuest.completed_at * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="sticky top-24 bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-8 text-center">
                <Target className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-zinc-400 mb-2">Select a Quest</h3>
                <p className="text-sm text-zinc-500">
                  Click on a quest to view details and take action
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuestsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
      </div>
    }>
      <QuestsContent />
    </Suspense>
  );
}
