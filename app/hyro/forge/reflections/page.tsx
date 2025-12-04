'use client';

/**
 * HYRO FORGE: Reflections/Metacognition Journal
 * Daily reflection prompts for self-awareness and growth mindset
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, RefreshCw, CheckCircle, BookOpen, Sparkles } from 'lucide-react';

interface Reflection {
  id: string;
  prompt_text: string;
  response_text: string;
  category: string;
  xp_earned: number;
  created_at: number;
  ai_feedback?: string;
}

interface ReflectionPrompt {
  id: string;
  prompt_text: string;
  category: string;
  difficulty: number;
}

export default function ReflectionsPage() {
  const [currentPrompt, setCurrentPrompt] = useState<ReflectionPrompt | null>(null);
  const [response, setResponse] = useState('');
  const [history, setHistory] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load reflection history
      const histRes = await fetch('/api/hyro/reflections?action=history&limit=10');
      const histJson = await histRes.json();
      if (histJson.success) {
        setHistory(histJson.data || []);
      }

      // Get a random prompt
      const promptRes = await fetch('/api/hyro/reflections?action=random-prompt');
      const promptJson = await promptRes.json();
      if (promptJson.success) {
        setCurrentPrompt(promptJson.data);
      }
    } catch (err) {
      console.error('Failed to load reflections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentPrompt || !response.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/hyro/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          prompt_id: currentPrompt.id,
          response_text: response,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
        setXpEarned(json.data?.xp_earned || 15);
        setAiFeedback(json.data?.ai_feedback || null);
        // Refresh history
        loadData();
      }
    } catch (err) {
      console.error('Failed to submit reflection:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewPrompt = async () => {
    setSubmitted(false);
    setResponse('');
    setAiFeedback(null);
    try {
      const res = await fetch('/api/hyro/reflections?action=random-prompt');
      const json = await res.json();
      if (json.success) {
        setCurrentPrompt(json.data);
      }
    } catch (err) {
      console.error('Failed to get new prompt:', err);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      growth_mindset: 'text-green-400',
      self_awareness: 'text-blue-400',
      gratitude: 'text-yellow-400',
      goal_setting: 'text-purple-400',
      learning: 'text-cyan-400',
      emotions: 'text-pink-400',
    };
    return colors[category] || 'text-gray-400';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      growth_mindset: '🌱',
      self_awareness: '🔍',
      gratitude: '🙏',
      goal_setting: '🎯',
      learning: '📚',
      emotions: '💭',
    };
    return icons[category] || '✨';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading Reflections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-900/50 to-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/hyro/forge"
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                Reflection Journal
              </h1>
              <p className="text-sm text-gray-400">Metacognition & Growth Mindset</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 border border-purple-600/50 rounded-lg">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-purple-300">+15 XP per reflection</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Reflection Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Prompt */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Today&apos;s Reflection</h2>
                <button
                  onClick={handleNewPrompt}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  New Prompt
                </button>
              </div>

              {currentPrompt ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getCategoryIcon(currentPrompt.category)}</span>
                    <div>
                      <p className={`text-xs uppercase tracking-wide mb-1 ${getCategoryColor(currentPrompt.category)}`}>
                        {currentPrompt.category.replace(/_/g, ' ')}
                      </p>
                      <p className="text-lg text-white">{currentPrompt.prompt_text}</p>
                    </div>
                  </div>

                  {!submitted ? (
                    <>
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Write your reflection here... Take your time to think deeply about this question."
                        className="w-full h-40 bg-gray-700 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400">
                          {response.length} characters
                        </p>
                        <button
                          onClick={handleSubmit}
                          disabled={submitting || response.trim().length < 20}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Submit Reflection
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                          <span className="font-semibold text-green-400">Reflection Submitted!</span>
                          <span className="text-sm text-green-300">+{xpEarned} XP</span>
                        </div>
                        <p className="text-gray-300 text-sm italic">&quot;{response}&quot;</p>
                      </div>

                      {aiFeedback && (
                        <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-purple-400" />
                            <span className="font-semibold text-purple-400">AI Feedback</span>
                          </div>
                          <p className="text-gray-300 text-sm">{aiFeedback}</p>
                        </div>
                      )}

                      <button
                        onClick={handleNewPrompt}
                        className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 rounded-lg transition-colors text-purple-300"
                      >
                        Start Another Reflection
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">No prompts available. Check back later!</p>
              )}
            </div>

            {/* Tips */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Reflection Tips</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>Be honest with yourself - there are no wrong answers</li>
                <li>Try to write at least 2-3 sentences for deeper thinking</li>
                <li>Reflect on specific examples from your day</li>
                <li>Consider how you can apply this insight tomorrow</li>
              </ul>
            </div>
          </div>

          {/* History Sidebar */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Past Reflections</h3>
              </div>

              {history.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {history.map((reflection) => (
                    <div
                      key={reflection.id}
                      className="p-3 bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">
                          {new Date(reflection.created_at * 1000).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-green-400">+{reflection.xp_earned} XP</span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-3">
                        {reflection.response_text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No reflections yet. Complete your first one above!
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-300 mb-3">Your Growth</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{history.length}</div>
                  <div className="text-xs text-gray-400">Total Reflections</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    +{history.reduce((sum, r) => sum + r.xp_earned, 0)}
                  </div>
                  <div className="text-xs text-gray-400">XP Earned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
