"use client";

/**
 * Hyro Education Agent Page
 *
 * Main interface for viewing daily learning recommendations and managing learning items
 */

import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, CheckCircle, Clock, Archive, Calendar } from 'lucide-react';
import { HyroCard } from '@/components/hyro/HyroCard';

interface Recommendation {
  id: string;
  date: string;
  items: Array<{
    item_id: string;
    item_title: string;
    item_source: string;
    rationale: string;
    priority: number;
    time_slot?: string;
    item?: {
      id: string;
      title: string;
      description?: string;
      source: string;
      source_url?: string;
      difficulty: string;
      estimated_time_minutes?: number;
      status: string;
      topics: string[];
    };
  }>;
  focus_topic?: string;
  focus_description?: string;
  total_time_minutes: number;
}

export default function HyroPage() {
  const [recommendations, setRecommendations] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('/api/hyro/recommendations');
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/hyro/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initialize: false }),
      });
      if (res.ok) {
        await fetchRecommendations();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleItemAction = async (itemId: string, action: string) => {
    if (!recommendations) return;

    try {
      const res = await fetch('/api/hyro/recommendations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recommendation_id: recommendations.id,
          item_id: itemId,
          action,
        }),
      });

      if (res.ok) {
        await fetchRecommendations();
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Hyro Education Agent</p>
          <h1 className="text-3xl font-semibold">Daily Learning Plan</h1>
          <p className="text-slate-300">
            Your personalized learning recommendations based on goals, progress, and available time.
          </p>
        </header>

        {/* Agent Status Card */}
        <HyroCard />

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Sources'}
            </button>
          </div>

          {recommendations && (
            <div className="text-sm text-slate-400">
              Estimated time: {recommendations.total_time_minutes} minutes
            </div>
          )}
        </div>

        {/* Focus Topic */}
        {recommendations?.focus_topic && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="text-cyan-400" size={24} />
              <div>
                <div className="font-semibold text-cyan-300">Today's Focus</div>
                <div className="text-sm text-slate-300">{recommendations.focus_description}</div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading recommendations...</div>
        ) : recommendations && recommendations.items.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Today's Recommendations</h2>
            {recommendations.items.map((recItem) => (
              <div
                key={recItem.item_id}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 space-y-3"
              >
                {/* Item Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-sky-900/40 text-sky-300 border border-sky-700">
                        {recItem.item_source}
                      </span>
                      {recItem.time_slot && recItem.time_slot !== 'anytime' && (
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-900/40 text-amber-300 border border-amber-700 flex items-center gap-1">
                          <Clock size={12} />
                          {recItem.time_slot}
                        </span>
                      )}
                      {recItem.item?.difficulty && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-900/40 text-purple-300 border border-purple-700">
                          {recItem.item.difficulty}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-slate-100 mb-2">
                      {recItem.item_title}
                    </h3>

                    {recItem.item?.description && (
                      <p className="text-sm text-slate-300 mb-2 line-clamp-2">
                        {recItem.item.description}
                      </p>
                    )}

                    <p className="text-sm text-slate-400 italic">
                      {recItem.rationale}
                    </p>

                    {recItem.item?.estimated_time_minutes && (
                      <div className="text-xs text-slate-500 mt-2">
                        Estimated time: {recItem.item.estimated_time_minutes} minutes
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-300">
                      {recItem.priority}
                    </div>
                    <div className="text-xs text-slate-500">Priority</div>
                  </div>
                </div>

                {/* Topics */}
                {recItem.item?.topics && recItem.item.topics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recItem.item.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300"
                      >
                        {topic.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-700">
                  <button
                    onClick={() => handleItemAction(recItem.item_id, 'accept')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm transition-colors"
                  >
                    <CheckCircle size={14} />
                    Start Learning
                  </button>
                  <button
                    onClick={() => handleItemAction(recItem.item_id, 'complete')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm transition-colors"
                  >
                    <CheckCircle size={14} />
                    Mark Complete
                  </button>
                  <button
                    onClick={() => handleItemAction(recItem.item_id, 'skip')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
                  >
                    <Archive size={14} />
                    Skip
                  </button>
                  {recItem.item?.source_url && (
                    <a
                      href={recItem.item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 text-sm transition-colors ml-auto"
                    >
                      Open Source →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-slate-700 rounded-xl bg-slate-800/30">
            <BookOpen className="mx-auto mb-4 text-slate-600" size={48} />
            <p className="text-slate-400 mb-4">No recommendations yet.</p>
            <button
              onClick={handleSync}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
            >
              Sync Sources to Get Started
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
