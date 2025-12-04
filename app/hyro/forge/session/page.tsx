'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Types
interface SessionActivity {
  id: string;
  type: 'diagnostic' | 'srs_review' | 'reading' | 'comprehension' | 'quest' | 'reflection' | 'break';
  title: string;
  description: string;
  estimated_minutes: number;
  xp_potential: number;
  stat_focus: string[];
  priority: number;
  reference_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  started_at?: number;
  completed_at?: number;
  xp_earned?: number;
}

interface SessionPlan {
  id: string;
  planned_date: string;
  activities: SessionActivity[];
  estimated_minutes: number;
  actual_minutes: number | null;
  xp_potential: number;
  xp_earned: number;
  stat_focus: string[];
  status: 'planned' | 'in_progress' | 'completed' | 'abandoned';
  started_at: number | null;
  completed_at: number | null;
  completion_rate: number | null;
  created_at: number;
}

interface SessionContext {
  due_cards_count: number;
  due_cards_by_deck: Array<{ deck_id: string; deck_title: string; count: number }>;
  active_quests: Array<{ id: string; title: string; description?: string }>;
  quests_due_today: Array<{ id: string; title: string }>;
  overdue_quests: Array<{ id: string; title: string }>;
  books_in_progress: Array<{ id: string; title: string; author: string }>;
  stats_needing_diagnostic: string[];
  active_skill_gaps: Array<{ id: string; stat_name: string; topic: string; severity: string }>;
  weakest_stats: Array<{ stat_name: string; current_value: number }>;
  streak_days: number;
}

// Activity type icons and colors
const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  diagnostic: { icon: '🧪', color: 'text-red-400', bgColor: 'bg-red-600/20' },
  srs_review: { icon: '🎴', color: 'text-purple-400', bgColor: 'bg-purple-600/20' },
  reading: { icon: '📚', color: 'text-yellow-400', bgColor: 'bg-yellow-600/20' },
  comprehension: { icon: '🧠', color: 'text-pink-400', bgColor: 'bg-pink-600/20' },
  quest: { icon: '⚔️', color: 'text-green-400', bgColor: 'bg-green-600/20' },
  reflection: { icon: '🪞', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  break: { icon: '☕', color: 'text-orange-400', bgColor: 'bg-orange-600/20' },
};

export default function SessionPage() {
  const router = useRouter();
  const [view, setView] = useState<'overview' | 'active' | 'complete'>('overview');
  const [session, setSession] = useState<SessionPlan | null>(null);
  const [context, setContext] = useState<SessionContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planningMinutes, setPlanningMinutes] = useState(45);

  // Load session and context
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [sessionRes, contextRes] = await Promise.all([
        fetch('/api/hyro/session?action=today'),
        fetch('/api/hyro/session?action=context'),
      ]);

      const sessionData = await sessionRes.json();
      const contextData = await contextRes.json();

      if (sessionData.success) {
        setSession(sessionData.data);
        if (sessionData.data?.status === 'in_progress') {
          setView('active');
        }
      }

      if (contextData.success) {
        setContext(contextData.data);
      }
    } catch (err) {
      setError('Failed to load session data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Plan a new session
  const handlePlanSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hyro/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          available_minutes: planningMinutes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSession(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to plan session');
    } finally {
      setLoading(false);
    }
  };

  // Start the session
  const handleStartSession = async () => {
    if (!session) return;

    try {
      const res = await fetch('/api/hyro/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          session_id: session.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        setView('active');
      }
    } catch (err) {
      setError('Failed to start session');
    }
  };

  // Complete activity
  const handleCompleteActivity = async (activityId: string, xpEarned: number = 0) => {
    if (!session) return;

    try {
      const res = await fetch('/api/hyro/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_activity',
          session_id: session.id,
          activity_id: activityId,
          xp_earned: xpEarned,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        if (data.data.status === 'completed') {
          setView('complete');
        }
      }
    } catch (err) {
      setError('Failed to complete activity');
    }
  };

  // Skip activity
  const handleSkipActivity = async (activityId: string) => {
    if (!session) return;

    try {
      const res = await fetch('/api/hyro/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'skip_activity',
          session_id: session.id,
          activity_id: activityId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        if (data.data.status === 'completed') {
          setView('complete');
        }
      }
    } catch (err) {
      setError('Failed to skip activity');
    }
  };

  // Navigate to activity
  const handleGoToActivity = (activity: SessionActivity) => {
    switch (activity.type) {
      case 'diagnostic':
        router.push(`/hyro/forge/diagnostic?stat=${activity.reference_id}`);
        break;
      case 'srs_review':
        router.push('/hyro/forge/srs');
        break;
      case 'reading':
        router.push(`/hyro/forge/reading?book=${activity.reference_id}`);
        break;
      case 'quest':
        router.push(`/hyro/forge/quests?quest=${activity.reference_id}`);
        break;
      case 'reflection':
        router.push('/hyro/forge/reflections');
        break;
      default:
        // For breaks, just mark complete
        handleCompleteActivity(activity.id, 0);
    }
  };

  // Get current activity
  const currentActivity = session?.activities.find((a) => a.status === 'in_progress');
  const completedCount = session?.activities.filter((a) => a.status === 'completed').length || 0;
  const totalCount = session?.activities.length || 0;

  if (loading && !session && !context) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/hyro/forge"
              className="text-gray-400 hover:text-white transition-colors"
            >
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold">Daily Session</h1>
          </div>
          {context && (
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>🔥 {context.streak_days} day streak</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-600/20 border border-red-600/50 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Overview View - No session or planning */}
        {view === 'overview' && !session && context && (
          <div className="space-y-6">
            {/* Context Summary */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Today's Learning Context</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-1">🎴</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {context.due_cards_count}
                  </div>
                  <div className="text-sm text-gray-400">Cards Due</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-1">⚔️</div>
                  <div className="text-2xl font-bold text-green-400">
                    {context.active_quests.length}
                  </div>
                  <div className="text-sm text-gray-400">Active Quests</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-1">📚</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {context.books_in_progress.length}
                  </div>
                  <div className="text-sm text-gray-400">Books Reading</div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-1">🧪</div>
                  <div className="text-2xl font-bold text-red-400">
                    {context.stats_needing_diagnostic.length}
                  </div>
                  <div className="text-sm text-gray-400">Need Assessment</div>
                </div>
              </div>

              {/* Warnings */}
              {context.overdue_quests.length > 0 && (
                <div className="mt-4 p-3 bg-red-600/20 border border-red-600/50 rounded-lg">
                  <span className="text-red-400 font-medium">
                    {context.overdue_quests.length} overdue quest(s)!
                  </span>
                </div>
              )}

              {context.active_skill_gaps.filter((g) => g.severity === 'critical').length > 0 && (
                <div className="mt-4 p-3 bg-orange-600/20 border border-orange-600/50 rounded-lg">
                  <span className="text-orange-400 font-medium">
                    Critical skill gaps detected - recommend diagnostic assessment
                  </span>
                </div>
              )}
            </div>

            {/* Session Planner */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4">Plan Your Session</h2>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  How much time do you have?
                </label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setPlanningMinutes(mins)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        planningMinutes === mins
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePlanSession}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Planning...' : `Create ${planningMinutes}-Minute Session`}
              </button>
            </div>

            {/* Weakest Stats */}
            {context.weakest_stats.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg font-semibold mb-4">Focus Areas</h2>
                <div className="space-y-2">
                  {context.weakest_stats.map((stat) => (
                    <div
                      key={stat.stat_name}
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                    >
                      <span className="capitalize">
                        {stat.stat_name.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${stat.current_value}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400">{stat.current_value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session Planned - Ready to Start */}
        {view === 'overview' && session && session.status === 'planned' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Session Ready</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">
                    ~{session.estimated_minutes} min
                  </span>
                  <span className="text-yellow-400">
                    ⭐ {session.xp_potential} XP
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {session.activities.map((activity, index) => {
                  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.quest;
                  return (
                    <div
                      key={activity.id}
                      className={`flex items-center gap-3 p-3 ${config.bgColor} rounded-lg border border-gray-700`}
                    >
                      <span className="text-2xl">{config.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{activity.title}</div>
                        <div className="text-sm text-gray-400">
                          {activity.estimated_minutes}m &bull; {activity.xp_potential} XP
                        </div>
                      </div>
                      <span className="text-gray-500 text-sm">#{index + 1}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleStartSession}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-medium transition-colors"
              >
                Start Session
              </button>
            </div>
          </div>
        )}

        {/* Active Session */}
        {view === 'active' && session && currentActivity && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Session Progress</span>
                <span className="text-sm text-gray-400">
                  {completedCount}/{totalCount} activities
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-yellow-400">⭐ {session.xp_earned} XP earned</span>
                <span className="text-gray-400">
                  {session.xp_potential - session.xp_earned} XP remaining
                </span>
              </div>
            </div>

            {/* Current Activity */}
            <div className="bg-gray-800 rounded-lg p-6 border border-blue-600">
              <div className="text-sm text-blue-400 mb-2">Current Activity</div>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">
                  {ACTIVITY_CONFIG[currentActivity.type]?.icon || '📌'}
                </span>
                <div>
                  <h2 className="text-xl font-bold">{currentActivity.title}</h2>
                  <p className="text-gray-400">{currentActivity.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6 text-sm">
                <span className="text-gray-400">
                  ~{currentActivity.estimated_minutes} min
                </span>
                <span className="text-yellow-400">
                  ⭐ {currentActivity.xp_potential} XP
                </span>
                {currentActivity.stat_focus.length > 0 && (
                  <span className="text-blue-400">
                    {currentActivity.stat_focus.map((s) => s.replace(/_/g, ' ')).join(', ')}
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleGoToActivity(currentActivity)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  {currentActivity.type === 'break' ? 'Take Break' : 'Go to Activity'}
                </button>
                <button
                  onClick={() => handleCompleteActivity(currentActivity.id, currentActivity.xp_potential)}
                  className="py-3 px-6 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
                >
                  Mark Done
                </button>
                <button
                  onClick={() => handleSkipActivity(currentActivity.id)}
                  className="py-3 px-6 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Upcoming Activities */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-3">Coming Up</h3>
              <div className="space-y-2">
                {session.activities
                  .filter((a) => a.status === 'pending')
                  .slice(0, 3)
                  .map((activity) => {
                    const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.quest;
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg"
                      >
                        <span>{config.icon}</span>
                        <span className="flex-1 text-sm">{activity.title}</span>
                        <span className="text-xs text-gray-500">
                          {activity.estimated_minutes}m
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Session Complete */}
        {view === 'complete' && session && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-green-600 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
              <p className="text-gray-400 mb-6">Great work on your learning today.</p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-400">
                    {session.xp_earned}
                  </div>
                  <div className="text-sm text-gray-400">XP Earned</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400">
                    {completedCount}/{totalCount}
                  </div>
                  <div className="text-sm text-gray-400">Activities</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-400">
                    {session.actual_minutes || session.estimated_minutes}m
                  </div>
                  <div className="text-sm text-gray-400">Time Spent</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/hyro/forge"
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-center"
                >
                  Return to Dashboard
                </Link>
                <button
                  onClick={() => {
                    setSession(null);
                    setView('overview');
                    loadData();
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  Plan Another Session
                </button>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-3">Activity Summary</h3>
              <div className="space-y-2">
                {session.activities.map((activity) => {
                  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.quest;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg"
                    >
                      <span>{config.icon}</span>
                      <span className="flex-1 text-sm">{activity.title}</span>
                      {activity.status === 'completed' && (
                        <span className="text-green-400 text-sm">
                          +{activity.xp_earned || activity.xp_potential} XP
                        </span>
                      )}
                      {activity.status === 'skipped' && (
                        <span className="text-gray-500 text-sm">Skipped</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
