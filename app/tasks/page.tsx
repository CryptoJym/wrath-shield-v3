/**
 * Wrath Shield v3 - Tasks (Deck) Page
 *
 * Daily confidence-building tasks with UIX gating enforcement.
 *
 * GATING RULES:
 * - UIX < 70 for 2 consecutive days = deck locked
 * - Requires stomping 3 flags to unlock
 * - Tasks reset daily
 */

'use client';

import { useEffect, useState } from 'react';

interface DailyTask {
  category: 'word' | 'action' | 'body';
  title: string;
  description: string;
  completed: boolean;
}

interface GatingState {
  is_gated: boolean;
  uix_score: number;
  consecutive_low_days: number;
  flags_stomped: number;
  flags_required: number;
  reason: string | null;
}

interface PendingFlag {
  id: string;
  original_text: string;
  severity: number;
  manipulation_type: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [gating, setGating] = useState<GatingState | null>(null);
  const [pendingFlags, setPendingFlags] = useState<PendingFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch deck state and pending flags
  useEffect(() => {
    fetchDeckState();
    fetchPendingFlags();
  }, []);

  async function fetchDeckState() {
    try {
      const response = await fetch('/api/deck');
      if (!response.ok) {
        throw new Error('Failed to fetch deck state');
      }
      const data = await response.json();
      setTasks(data.tasks || []);
      setGating(data.gating || null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingFlags() {
    try {
      const response = await fetch('/api/burst');
      if (!response.ok) return;
      const data = await response.json();
      setPendingFlags(data.pending_flags || []);
    } catch (err) {
      console.error('Failed to fetch pending flags:', err);
    }
  }

  async function handleTaskToggle(category: 'word' | 'action' | 'body') {
    try {
      const response = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_task',
          task_category: category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete task');
      }

      // Update local state
      setTasks((prev) =>
        prev.map((task) =>
          task.category === category ? { ...task, completed: true } : task
        )
      );
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  }

  async function handleStompFlag(flagId: string) {
    try {
      const response = await fetch('/api/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: flagId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to stomp flag');
      }

      const result = await response.json();

      // Refresh deck state and flags
      await fetchDeckState();
      await fetchPendingFlags();

      if (result.unlocked) {
        alert('🎉 Deck unlocked! All 3 flags stomped.');
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error('Failed to stomp flag:', err);
      alert('Failed to stomp flag');
    }
  }

  if (loading) {
    return (
      <div className="loading">
        Loading deck...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-green mb-4">Tasks</h1>
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  const tasksCompleted = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-green mb-2">Daily Deck</h1>
          <p className="text-secondary">
            Build confidence through daily action. Complete all three tasks to maintain your momentum.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* UIX Score */}
          <div className="card">
            <h3 className="text-secondary mb-2">UIX Score</h3>
            <div className="text-4xl font-bold text-green">
              {gating?.uix_score ?? 0}
            </div>
            <p className="text-muted mt-2">Momentum metric</p>
          </div>

          {/* Streak */}
          <div className="card">
            <h3 className="text-secondary mb-2">Status</h3>
            <div className="text-4xl font-bold">
              {gating?.is_gated ? '🔒' : '✓'}
            </div>
            <p className="text-muted mt-2">
              {gating?.is_gated ? 'Deck locked' : 'Deck active'}
            </p>
          </div>

          {/* Tasks Progress */}
          <div className="card">
            <h3 className="text-secondary mb-2">Today's Progress</h3>
            <div className="text-4xl font-bold text-green">
              {tasksCompleted}/{totalTasks}
            </div>
            <p className="text-muted mt-2">Tasks completed</p>
          </div>
        </div>

        {/* Gating Warning */}
        {gating?.is_gated && (
          <div className="card mb-8" style={{ borderColor: 'var(--color-warning)', borderWidth: '2px' }}>
            <h3 style={{ color: 'var(--color-warning)' }} className="mb-2">
              ⚠️ Deck Locked
            </h3>
            <p className="text-secondary mb-4">{gating.reason}</p>
            <p className="text-secondary">
              Stomp {gating.flags_required - gating.flags_stomped} more{' '}
              {gating.flags_required - gating.flags_stomped === 1 ? 'flag' : 'flags'} to unlock.
            </p>
          </div>
        )}

        {/* Daily Tasks */}
        <div className="mb-8">
          <h2 className="mb-4">Daily Tasks</h2>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.category}
                className="card"
                style={{ opacity: gating?.is_gated ? 0.5 : 1 }}
              >
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => !gating?.is_gated && handleTaskToggle(task.category)}
                    disabled={gating?.is_gated || task.completed}
                    className="mt-1 mr-4 w-5 h-5 cursor-pointer"
                    style={{ accentColor: 'var(--color-success)' }}
                  />
                  <div className="flex-1">
                    <h3 className="text-secondary mb-2">{task.title}</h3>
                    <p className="text-muted">{task.description}</p>
                  </div>
                  {task.completed && (
                    <span className="text-success ml-4">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flag Stomping UI (only shown when gated) */}
        {gating?.is_gated && pendingFlags.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4">Stomp Flags to Unlock</h2>
            <p className="text-secondary mb-4">
              Review these manipulative phrases and mark them as resolved to unlock your deck.
            </p>
            <div className="space-y-4">
              {pendingFlags.slice(0, 5).map((flag) => (
                <div key={flag.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span
                          className="text-sm font-bold mr-2"
                          style={{
                            color:
                              flag.severity >= 4
                                ? 'var(--color-danger)'
                                : flag.severity >= 2
                                ? 'var(--color-warning)'
                                : 'var(--color-info)',
                          }}
                        >
                          Severity {flag.severity}
                        </span>
                        <span className="text-muted text-sm">
                          {flag.manipulation_type}
                        </span>
                      </div>
                      <p className="text-secondary">{flag.original_text}</p>
                    </div>
                    <button
                      onClick={() => handleStompFlag(flag.id)}
                      className="ml-4 px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'var(--color-danger)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Stomp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Flags */}
        {gating?.is_gated && pendingFlags.length === 0 && (
          <div className="card">
            <p className="text-secondary">
              No pending flags available to stomp. Wait for new manipulation detections.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
