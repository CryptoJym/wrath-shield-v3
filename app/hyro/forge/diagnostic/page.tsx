'use client';

/**
 * HYRO FORGE: Diagnostic Assessment Page
 * Take initial assessments to establish baseline and identify skill gaps
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  Brain,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Trophy,
  TrendingUp,
} from 'lucide-react';

type StatName = 'math' | 'reading' | 'science' | 'coding' | 'study_skills' | 'critical_thinking' | 'technology' | 'problem_solving';

interface StatOverview {
  stat_name: StatName;
  has_diagnostic: boolean;
  latest_level: number | null;
  confidence_interval: [number, number] | null;
  gaps_count: number;
  last_assessed: number | null;
}

interface Question {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'short_answer' | 'true_false' | 'fill_blank';
  options: string[] | null;
  difficulty_level: number;
  topic: string | null;
  hints: string[] | null;
}

interface Session {
  id: string;
  stat_name: StatName;
  questions_answered: number;
  questions_total: number;
  current_difficulty: number;
}

interface DiagnosticResult {
  estimated_level: number;
  confidence_low: number | null;
  confidence_high: number | null;
  raw_score: number;
  total_questions: number;
  percentage_score: number;
  identified_gaps: Array<{ topic: string; gap_severity: string }>;
  strong_areas: string[];
  recommended_focus: string[];
  topic_breakdown: Record<string, { correct: number; total: number; level: number }>;
}

const STAT_DISPLAY_NAMES: Record<StatName, string> = {
  math: 'Mathematics',
  reading: 'Reading',
  science: 'Science',
  coding: 'Coding',
  study_skills: 'Study Skills',
  critical_thinking: 'Critical Thinking',
  technology: 'Technology',
  problem_solving: 'Problem Solving',
};

const STAT_ICONS: Record<StatName, string> = {
  math: 'x',
  reading: 'y',
  science: 'z',
  coding: '</>',
  study_skills: 'w',
  critical_thinking: '?',
  technology: 't',
  problem_solving: 'p',
};

export default function DiagnosticPage() {
  const [overview, setOverview] = useState<StatOverview[]>([]);
  const [selectedStat, setSelectedStat] = useState<StatName | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string | null } | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [view, setView] = useState<'overview' | 'test' | 'result'>('overview');

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/hyro/diagnostic?action=overview');
      const json = await res.json();
      if (json.success) {
        setOverview(json.data.overview);
      }
    } catch (err) {
      console.error('Failed to load overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const startDiagnostic = async (statName: StatName) => {
    setLoading(true);
    setSelectedStat(statName);
    setResult(null);
    setFeedback(null);

    try {
      const res = await fetch('/api/hyro/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', stat_name: statName }),
      });

      const json = await res.json();
      if (json.success) {
        setSession(json.data.session);
        setCurrentQuestion(json.data.question);
        setStartTime(Date.now());
        setView('test');
      }
    } catch (err) {
      console.error('Failed to start diagnostic:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!session || !currentQuestion || selectedAnswer === null) return;

    setSubmitting(true);
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

    try {
      const res = await fetch('/api/hyro/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          session_id: session.id,
          question_id: currentQuestion.id,
          user_answer: selectedAnswer,
          time_spent_seconds: timeSpent,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback({
          correct: json.data.is_correct,
          explanation: json.data.explanation,
        });

        // Update session progress
        setSession(prev => prev ? {
          ...prev,
          questions_answered: prev.questions_answered + 1,
          current_difficulty: json.data.new_difficulty,
        } : null);

        // After showing feedback, move to next question
        setTimeout(() => {
          if (json.data.questions_remaining > 0 && json.data.next_question) {
            setCurrentQuestion(json.data.next_question);
            setSelectedAnswer(null);
            setFeedback(null);
            setStartTime(Date.now());
          } else {
            // Complete the diagnostic
            completeDiagnostic();
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const completeDiagnostic = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const res = await fetch('/api/hyro/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', session_id: session.id }),
      });

      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setView('result');
        loadOverview(); // Refresh overview
      }
    } catch (err) {
      console.error('Failed to complete diagnostic:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: number) => {
    if (level < 0.3) return 'text-green-400';
    if (level < 0.6) return 'text-yellow-400';
    if (level < 0.8) return 'text-orange-400';
    return 'text-red-400';
  };

  const getLevelColor = (level: number | null) => {
    if (level === null) return 'text-gray-400';
    if (level >= 75) return 'text-green-400';
    if (level >= 50) return 'text-yellow-400';
    if (level >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-900/30';
      case 'significant': return 'text-orange-400 bg-orange-900/30';
      case 'moderate': return 'text-yellow-400 bg-yellow-900/30';
      default: return 'text-blue-400 bg-blue-900/30';
    }
  };

  if (loading && view === 'overview') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading Diagnostics...</p>
        </div>
      </div>
    );
  }

  // TEST VIEW
  if (view === 'test' && session && currentQuestion) {
    const progress = (session.questions_answered / session.questions_total) * 100;

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-900/50 to-gray-900 border-b border-gray-700 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('overview')}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {STAT_DISPLAY_NAMES[selectedStat!]} Assessment
                </h1>
                <p className="text-sm text-gray-400">
                  Question {session.questions_answered + 1} of {session.questions_total}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
                <Target className="h-4 w-4 text-blue-400" />
                <span className={`text-sm ${getDifficultyColor(session.current_difficulty)}`}>
                  Difficulty: {Math.round(session.current_difficulty * 100)}%
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="bg-gray-800 h-2">
          <div
            className="bg-blue-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <main className="max-w-3xl mx-auto p-6">
          {/* Question Card */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            {currentQuestion.topic && (
              <span className="inline-block px-2 py-1 bg-gray-700 rounded text-xs text-gray-400 mb-4">
                {currentQuestion.topic}
              </span>
            )}
            <h2 className="text-xl font-medium text-white mb-6">
              {currentQuestion.question_text}
            </h2>

            {/* Multiple Choice Options */}
            {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => !feedback && setSelectedAnswer(option)}
                    disabled={!!feedback}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      feedback
                        ? option === selectedAnswer
                          ? feedback.correct
                            ? 'bg-green-900/50 border-green-500'
                            : 'bg-red-900/50 border-red-500'
                          : 'bg-gray-700 opacity-50'
                        : selectedAnswer === option
                        ? 'bg-blue-900/50 border-blue-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    } border-2 ${
                      selectedAnswer === option ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-medium">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{option}</span>
                      {feedback && option === selectedAnswer && (
                        feedback.correct
                          ? <CheckCircle className="ml-auto h-5 w-5 text-green-400" />
                          : <XCircle className="ml-auto h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {currentQuestion.question_type === 'short_answer' && (
              <input
                type="text"
                value={selectedAnswer || ''}
                onChange={(e) => !feedback && setSelectedAnswer(e.target.value)}
                disabled={!!feedback}
                placeholder="Type your answer..."
                className="w-full p-4 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {/* True/False */}
            {currentQuestion.question_type === 'true_false' && (
              <div className="flex gap-4">
                {['True', 'False'].map((option) => (
                  <button
                    key={option}
                    onClick={() => !feedback && setSelectedAnswer(option)}
                    disabled={!!feedback}
                    className={`flex-1 p-4 rounded-lg text-center transition-all ${
                      selectedAnswer === option
                        ? 'bg-blue-900/50 border-blue-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    } border-2 ${
                      selectedAnswer === option ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`rounded-lg p-4 mb-6 ${
              feedback.correct ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {feedback.correct
                  ? <CheckCircle className="h-5 w-5 text-green-400" />
                  : <XCircle className="h-5 w-5 text-red-400" />
                }
                <span className={`font-semibold ${feedback.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback.correct ? 'Correct!' : 'Incorrect'}
                </span>
              </div>
              {feedback.explanation && (
                <p className="text-gray-300 text-sm">{feedback.explanation}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          {!feedback && (
            <button
              onClick={submitAnswer}
              disabled={selectedAnswer === null || submitting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Submit Answer
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
          )}
        </main>
      </div>
    );
  }

  // RESULT VIEW
  if (view === 'result' && result) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gradient-to-r from-green-900/50 to-gray-900 border-b border-gray-700 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/hyro/forge"
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Assessment Complete!
                </h1>
                <p className="text-sm text-gray-400">
                  {STAT_DISPLAY_NAMES[selectedStat!]} Diagnostic Results
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/50 rounded-lg">
              <Trophy className="h-5 w-5 text-green-400" />
              <span className="text-green-300">+50 XP</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Main Score Card */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Your Level</h3>
              <div className="text-center mb-6">
                <div className={`text-6xl font-bold ${getLevelColor(result.estimated_level)}`}>
                  {result.estimated_level}
                </div>
                <div className="text-gray-400 mt-2">
                  Estimated Proficiency Level
                </div>
                {result.confidence_low !== null && result.confidence_high !== null && (
                  <div className="text-sm text-gray-500 mt-1">
                    95% CI: {result.confidence_low} - {result.confidence_high}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-white">
                    {result.raw_score}/{result.total_questions}
                  </div>
                  <div className="text-xs text-gray-400">Correct Answers</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-white">
                    {Math.round(result.percentage_score)}%
                  </div>
                  <div className="text-xs text-gray-400">Accuracy</div>
                </div>
              </div>
            </div>

            {/* Topic Breakdown */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Topic Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(result.topic_breakdown).map(([topic, data]) => (
                  <div key={topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300 capitalize">{topic.replace(/_/g, ' ')}</span>
                      <span className={`text-sm ${getLevelColor(data.level)}`}>
                        {data.correct}/{data.total} ({data.level}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          data.level >= 75 ? 'bg-green-500' :
                          data.level >= 50 ? 'bg-yellow-500' :
                          data.level >= 25 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${data.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Identified Gaps */}
            {result.identified_gaps.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Areas to Improve</h3>
                </div>
                <div className="space-y-2">
                  {result.identified_gaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-lg ${getSeverityColor(gap.gap_severity)}`}
                    >
                      <span className="capitalize">{gap.topic.replace(/_/g, ' ')}</span>
                      <span className="ml-2 text-xs opacity-75 uppercase">
                        {gap.gap_severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {result.strong_areas.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Strengths</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.strong_areas.map((area, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg capitalize"
                    >
                      {area.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Focus */}
            <div className="lg:col-span-2 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Recommended Focus Areas</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Based on your assessment, here are the topics to prioritize:
              </p>
              <div className="flex flex-wrap gap-2">
                {result.recommended_focus.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-blue-900/50 text-blue-300 rounded-lg capitalize border border-blue-700/50"
                  >
                    {idx + 1}. {topic.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <Link
              href="/hyro/forge"
              className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-center transition-colors"
            >
              Return to Dashboard
            </Link>
            <button
              onClick={() => {
                setView('overview');
                setResult(null);
                setSession(null);
                setSelectedStat(null);
              }}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              Take Another Assessment
            </button>
          </div>
        </main>
      </div>
    );
  }

  // OVERVIEW VIEW
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900/50 to-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/hyro/forge"
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Diagnostic Assessments
              </h1>
              <p className="text-sm text-gray-400">Establish your baseline and identify skill gaps</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Info Banner */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Brain className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-300 mb-1">Why Take Diagnostics?</h3>
              <p className="text-sm text-gray-300">
                Diagnostic assessments help establish your current skill levels. The system will then
                adapt content difficulty to match your zone of proximal development - challenging enough
                to grow, but not so hard you get frustrated.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overview.map((stat) => (
            <div
              key={stat.stat_name}
              className="bg-gray-800 rounded-lg p-5 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg font-mono">
                    {STAT_ICONS[stat.stat_name]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {STAT_DISPLAY_NAMES[stat.stat_name]}
                    </h3>
                    {stat.has_diagnostic ? (
                      <p className="text-xs text-gray-400">
                        Assessed {stat.last_assessed
                          ? new Date(stat.last_assessed * 1000).toLocaleDateString()
                          : 'recently'
                        }
                      </p>
                    ) : (
                      <p className="text-xs text-yellow-400">Not yet assessed</p>
                    )}
                  </div>
                </div>
                {stat.has_diagnostic && (
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getLevelColor(stat.latest_level)}`}>
                      {stat.latest_level}
                    </div>
                    <div className="text-xs text-gray-400">Level</div>
                  </div>
                )}
              </div>

              {stat.has_diagnostic && stat.gaps_count > 0 && (
                <div className="mb-3 px-2 py-1 bg-orange-900/30 rounded text-xs text-orange-400">
                  {stat.gaps_count} skill gap{stat.gaps_count > 1 ? 's' : ''} identified
                </div>
              )}

              <button
                onClick={() => startDiagnostic(stat.stat_name)}
                className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  stat.has_diagnostic
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {stat.has_diagnostic ? (
                  <>
                    <Clock className="h-4 w-4" />
                    Retake Assessment
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start Assessment
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
