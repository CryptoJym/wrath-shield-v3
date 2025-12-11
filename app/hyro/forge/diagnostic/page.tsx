'use client';

/**
 * HYRO FORGE: Diagnostic Assessment Page (v2)
 * Manifold-Integrated Assessment with Meta Probes and State Vectors
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
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

// ============================================================================
// Types (v2)
// ============================================================================

type StatName = 'math' | 'reading' | 'science' | 'coding' | 'study_skills' | 'critical_thinking' | 'technology' | 'problem_solving';

interface StatOverview {
  stat_name: StatName;
  has_diagnostic: boolean;
  latest_level: number | null;
  confidence_interval: [number, number] | null;
  gaps_count: number;
  last_assessed: number | null;
}

interface DiagnosticItem {
  id: string;
  stat_name: StatName;
  item_type: 'multiple_choice' | 'short_answer' | 'true_false' | 'fill_blank' | 'meta_probe';
  prompt_text: string;
  options_json: string | null; // JSON string of options
  difficulty: number;
  constructs_measured: string | null;
}

interface MetaProbe extends DiagnosticItem {
  probe_type: 'frame_shift' | 'entropy_compression' | 'non_dual_synthesis';
  target_dimensions: string; // JSON string
}

interface Session {
  id: string;
  focus_stat: StatName | null;
  status: 'active' | 'completed';
  target_items: number;
}

interface Progress {
  completed: number;
  target: number;
  domain_items: number;
  meta_probes: number;
  current_difficulty?: number;
}

interface EvaluationResult {
  scores: {
    validity: number;
    coherence: number;
    transfer: number;
    utility: number;
    efficiency: number;
  };
  meta?: {
    manifold_fluidity?: number;
    multi_model_coherence?: number;
    identity_elasticity?: number;
    gradient_awareness?: number;
    entropy_intuition?: number;
    non_dual_resolution?: number;
    cooperative_generativity?: number;
  };
  flags?: {
    overconfident: boolean;
    handwavy: boolean;
  };
  evidence?: {
    quotes: string[];
    observations: string[];
  };
}

interface StateVector {
  coherence: number;
  entropy: number;
  generativity: number;
  ci_low: number;
  ci_high: number;
}

interface DiagnosticResultV2 {
  updated_stats: string[];
  state_vectors: Array<{
    stat_name: string;
    coherence: number;
    entropy: number;
    generativity: number;
    ci_low: number;
    ci_high: number;
  }>;
  total_responses: number;
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

// ============================================================================
// Component
// ============================================================================

export default function DiagnosticPage() {
  // State
  const [overview, setOverview] = useState<StatOverview[]>([]);
  const [selectedStat, setSelectedStat] = useState<StatName | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentItem, setCurrentItem] = useState<DiagnosticItem | null>(null);
  const [isMetaProbe, setIsMetaProbe] = useState(false);
  const [targetStrand, setTargetStrand] = useState<string | null>(null);
  const [targetTier, setTargetTier] = useState<string | null>(null);
  const [targetManifold, setTargetManifold] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  // Interaction State
  const [answerText, setAnswerText] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(3); // 1-5
  const [startTime, setStartTime] = useState<number>(0);

  // Feedback/Result State
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [finalResult, setFinalResult] = useState<DiagnosticResultV2 | null>(null);

  // UI State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<'overview' | 'test' | 'result'>('overview');

  // Load Overview
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/hyro/forge/diagnostic?action=overview'); // Using v2 API default action
      const json = await res.json();
      if (json.stats_summary) {
        // Map v2 summary to overview format
        // Note: v2 summary structure is different, adapting here for now
        // Ideally we'd update the overview interface to match v2 fully
        const mappedOverview: StatOverview[] = (Object.keys(STAT_DISPLAY_NAMES) as StatName[]).map(stat => {
          const summary = json.stats_summary.find((s: any) => s.stat_name === stat);
          return {
            stat_name: stat,
            has_diagnostic: !!summary,
            latest_level: summary ? Math.round(summary.avg_validity * 100) : null, // Proxy for level
            confidence_interval: null,
            gaps_count: 0, // v2 doesn't explicitly count gaps in summary yet
            last_assessed: null // v2 summary doesn't return date yet
          };
        });
        setOverview(mappedOverview);
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

  // Start Session
  const startDiagnostic = async (statName: StatName) => {
    setLoading(true);
    setSelectedStat(statName);
    setFinalResult(null);
    setEvaluation(null);

    try {
      const res = await fetch('/api/hyro/forge/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          focus_stat: statName,
          target_items: 30
        }),
      });

      const json = await res.json();
      if (json.session) {
        setSession(json.session);
        setCurrentItem(json.first_item);
        setIsMetaProbe(false); // First item is usually domain
        setStartTime(Date.now());
        setProgress({
          completed: 0,
          target: 30,
          domain_items: 0,
          meta_probes: 0
        });
        setView('test');
      }
    } catch (err) {
      console.error('Failed to start diagnostic:', err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Answer
  const submitAnswer = async () => {
    if (!session || !currentItem) return;

    setSubmitting(true);
    const timeSpent = Date.now() - startTime;

    try {
      const res = await fetch('/api/hyro/forge/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          session_id: session.id,
          item_id: currentItem.id,
          response_text: isMetaProbe || currentItem.item_type === 'short_answer' ? answerText : selectedOption,
          response_json: currentItem.item_type === 'multiple_choice' ? { selected: selectedOption } : null,
          time_spent_ms: timeSpent,
          confidence_before: confidence
        }),
      });

      const json = await res.json();

      if (json.evaluation) {
        setEvaluation(json.evaluation);
      }

      if (json.session_complete) {
        // Session is done, fetch final results
        await completeDiagnostic(session.id);
      } else if (json.next_item) {
        // Wait a moment to show feedback if available, then move on
        setTimeout(() => {
          setCurrentItem(json.next_item);
          setIsMetaProbe(json.is_meta_probe);
          setTargetStrand(json.target_strand || null);
          setTargetTier(json.target_tier || null);
          setTargetManifold(json.target_manifold || null);
          setProgress(json.progress);
          setAnswerText('');
          setSelectedOption(null);
          setEvaluation(null);
          setStartTime(Date.now());
        }, json.evaluation ? 3000 : 500); // Longer delay if showing evaluation
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Complete Session
  const completeDiagnostic = async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/hyro/forge/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', session_id: sessionId }),
      });

      const json = await res.json();
      if (json.state_vectors) {
        setFinalResult(json);
        setView('result');
        loadOverview();
      }
    } catch (err) {
      console.error('Failed to complete diagnostic:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Parse options
  const getOptions = (item: DiagnosticItem): string[] => {
    if (!item.options_json) return [];
    try {
      const parsed = JSON.parse(item.options_json);
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Handle {"a": "Option A", "b": "Option B"} format
        return Object.values(parsed);
      }
      return [];
    } catch {
      return [];
    }
  };

  // Helper: Render State Vector Chart
  const renderStateVectorChart = (sv: StateVector) => {
    const data = [
      { subject: 'Coherence', A: sv.coherence, fullMark: 100 },
      { subject: 'Entropy', A: sv.entropy, fullMark: 100 },
      { subject: 'Generativity', A: sv.generativity, fullMark: 100 },
    ];

    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="State Vector"
              dataKey="A"
              stroke="#8B5CF6"
              strokeWidth={2}
              fill="#8B5CF6"
              fillOpacity={0.3}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
              itemStyle={{ color: '#A78BFA' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // LOADING VIEW
  if (loading && view === 'overview') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-zinc-400">Loading Manifold Diagnostics...</p>
        </div>
      </div>
    );
  }

  // TEST VIEW
  if (view === 'test' && session && currentItem) {
    const progressPercent = progress ? (progress.completed / progress.target) * 100 : 0;

    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Header */}
        <header className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('overview')}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-zinc-400" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  {isMetaProbe ? (
                    <span className="text-purple-400 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Meta Probe
                    </span>
                  ) : (
                    <span>{STAT_DISPLAY_NAMES[selectedStat!] || 'Diagnostic'} Assessment</span>
                  )}
                </h1>
                <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
                  <span>Item {progress?.completed ? progress.completed + 1 : 1} of {progress?.target || 30}</span>
                  {isMetaProbe && <span className="px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded">Deep Concept</span>}
                  {!isMetaProbe && targetStrand && <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded">{targetStrand}</span>}
                  {!isMetaProbe && targetTier && <span className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 rounded border border-emerald-800/50">{targetTier}</span>}
                  {!isMetaProbe && targetManifold && <span className="px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded border border-amber-800/50 uppercase tracking-wider text-[10px]">{targetManifold.replace(/_/g, ' ')}</span>}
                </div>
              </div>
            </div>

            {/* Difficulty Indicator (only for domain items) */}
            {!isMetaProbe && progress?.current_difficulty && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
                <Activity className="h-3 w-3 text-blue-400" />
                <div className="flex gap-0.5 h-1.5">
                  {[0.2, 0.4, 0.6, 0.8].map((threshold) => (
                    <div
                      key={threshold}
                      className={`w-3 rounded-full ${progress.current_difficulty! >= threshold ? 'bg-blue-500' : 'bg-zinc-700'
                        }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1 bg-zinc-900">
          <div
            className={`h-full transition-all duration-500 ${isMetaProbe ? 'bg-purple-500' : 'bg-blue-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <main className="max-w-3xl mx-auto p-6">
          {/* Question Card */}
          <div className={`rounded-2xl p-8 mb-6 border transition-all ${isMetaProbe
            ? 'bg-gradient-to-b from-purple-900/10 to-zinc-900 border-purple-500/30 shadow-lg shadow-purple-900/10'
            : 'bg-zinc-900 border-zinc-800'
            }`}>
            {isMetaProbe && (
              <div className="mb-6 flex items-center gap-2 text-purple-300 text-sm font-medium">
                <Brain className="h-4 w-4" />
                <span>Think deeply. There is no single right answer.</span>
              </div>
            )}

            <h2 className="text-xl md:text-2xl font-medium text-white mb-8 leading-relaxed">
              {currentItem.prompt_text}
            </h2>

            {/* Input Area */}
            <div className="space-y-6">
              {/* Multiple Choice */}
              {currentItem.item_type === 'multiple_choice' && (
                <div className="grid gap-3">
                  {getOptions(currentItem).map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => !evaluation && setSelectedOption(option)}
                      disabled={!!evaluation}
                      className={`w-full p-4 rounded-xl text-left transition-all border-2 ${selectedOption === option
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-zinc-800/50 border-transparent hover:bg-zinc-800 text-zinc-300'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${selectedOption === option ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-400'
                          }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Text Input (Short Answer or Meta Probe) */}
              {(currentItem.item_type === 'short_answer' || isMetaProbe) && (
                <div className="relative">
                  <textarea
                    value={answerText}
                    onChange={(e) => !evaluation && setAnswerText(e.target.value)}
                    disabled={!!evaluation}
                    placeholder={isMetaProbe ? "Express your thoughts freely..." : "Type your answer..."}
                    className={`w-full p-4 bg-zinc-950/50 rounded-xl border-2 text-white placeholder-zinc-600 focus:outline-none focus:ring-0 resize-none transition-all ${isMetaProbe
                      ? 'border-purple-500/30 focus:border-purple-500 min-h-[200px]'
                      : 'border-zinc-800 focus:border-blue-500 min-h-[100px]'
                      }`}
                  />
                  {isMetaProbe && (
                    <div className="absolute bottom-4 right-4 text-xs text-zinc-500">
                      {answerText.length} chars
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Confidence Self-Report (Optional) */}
          {!evaluation && (
            <div className="mb-8 flex items-center justify-center gap-4 text-sm text-zinc-500">
              <span>Confidence:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setConfidence(level)}
                    className={`w-8 h-8 rounded-full transition-all ${confidence === level
                      ? 'bg-zinc-700 text-white scale-110'
                      : 'bg-zinc-900 text-zinc-600 hover:bg-zinc-800'
                      }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Evaluation Feedback */}
          {evaluation && (
            <div className="mb-6 animate-fade-in">
              <div className={`rounded-xl p-6 border ${evaluation.scores.validity > 0.7
                ? 'bg-green-900/10 border-green-500/30'
                : 'bg-orange-900/10 border-orange-500/30'
                }`}>
                <div className="flex items-center gap-3 mb-4">
                  {evaluation.scores.validity > 0.7
                    ? <CheckCircle className="h-6 w-6 text-green-400" />
                    : <AlertTriangle className="h-6 w-6 text-orange-400" />
                  }
                  <h3 className="font-semibold text-white">
                    {evaluation.scores.validity > 0.7 ? 'Solid Reasoning' : 'Needs Improvement'}
                  </h3>
                </div>

                {/* Evidence/Quotes */}
                {evaluation.evidence?.observations && (
                  <div className="space-y-2 mb-4">
                    {evaluation.evidence.observations.map((obs, i) => (
                      <p key={i} className="text-zinc-300 text-sm flex gap-2">
                        <span className="text-blue-500">•</span> {obs}
                      </p>
                    ))}
                  </div>
                )}

                {/* Meta Dimension Impact (if any) */}
                {evaluation.meta && Object.keys(evaluation.meta).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Manifold Impact</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(evaluation.meta).map(([key, val]) => (
                        <span key={key} className="px-2 py-1 bg-purple-500/10 text-purple-300 rounded text-xs border border-purple-500/20">
                          {key.replace(/_/g, ' ')}: +{Math.round(val * 100)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          {!evaluation && (
            <button
              onClick={submitAnswer}
              disabled={submitting || (!answerText && !selectedOption)}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 ${isMetaProbe
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-900/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isMetaProbe ? 'Submit Reflection' : 'Submit Answer'}
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
  if (view === 'result' && finalResult) {
    // Find the state vector for the focused stat
    const sv = finalResult.state_vectors.find(s => s.stat_name === selectedStat);

    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <header className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link
              href="/hyro/forge"
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-zinc-400" />
            </Link>
            <h1 className="text-xl font-bold text-white">Manifold Analysis Complete</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-900/20 border border-green-900/50 rounded-lg">
              <Trophy className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-medium">+100 XP</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* State Vector Visualization */}
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-6">
                <Radar className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Cognitive State Vector</h2>
              </div>

              {sv ? renderStateVectorChart(sv) : (
                <div className="h-64 flex items-center justify-center text-zinc-500">
                  No state vector data available
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Coherence</div>
                  <div className="text-xl font-bold text-purple-400">{sv?.coherence ? Math.round(sv.coherence) : '-'}</div>
                </div>
                <div className="text-center p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Entropy</div>
                  <div className="text-xl font-bold text-blue-400">{sv?.entropy ? Math.round(sv.entropy) : '-'}</div>
                </div>
                <div className="text-center p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-xs text-zinc-500 mb-1">Generativity</div>
                  <div className="text-xl font-bold text-green-400">{sv?.generativity ? Math.round(sv.generativity) : '-'}</div>
                </div>
              </div>
            </div>

            {/* Recommendations / Next Steps */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl p-6 border border-blue-500/20">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Next Steps
                </h2>
                <p className="text-zinc-300 mb-6">
                  Based on your state vector, we've calibrated your learning path.
                  Your high entropy score suggests you're ready for more open-ended challenges.
                </p>

                <div className="space-y-3">
                  <button className="w-full p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-xl text-left transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white group-hover:text-blue-400 transition-colors">Start Recommended Quest</div>
                        <div className="text-xs text-zinc-500">Targeting Coherence Gap</div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-blue-400" />
                    </div>
                  </button>

                  <button className="w-full p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-xl text-left transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white group-hover:text-purple-400 transition-colors">Explore Meta Concepts</div>
                        <div className="text-xs text-zinc-500">Boost Generativity</div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-purple-400" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                setView('overview');
                setFinalResult(null);
                setSession(null);
              }}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // OVERVIEW VIEW
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-4 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/hyro/forge"
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Manifold Diagnostics
              </h1>
              <p className="text-sm text-zinc-400">Calibrate your cognitive state vector</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Info Banner */}
        <div className="bg-blue-900/10 border border-blue-500/20 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Radar className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-blue-100 mb-2">Beyond Standard Testing</h3>
              <p className="text-sm text-blue-200/70 leading-relaxed max-w-2xl">
                The Manifold doesn't just measure what you know. It measures <strong>Coherence</strong> (how well you connect ideas),
                <strong>Entropy</strong> (how you handle uncertainty), and <strong>Generativity</strong> (your ability to create new value).
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overview.map((stat) => (
            <div
              key={stat.stat_name}
              className="group bg-zinc-900 rounded-2xl p-5 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-black/50"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-xl font-mono group-hover:bg-zinc-700 transition-colors">
                    {STAT_ICONS[stat.stat_name]}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">
                      {STAT_DISPLAY_NAMES[stat.stat_name]}
                    </h3>
                    {stat.has_diagnostic ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-zinc-400">Calibrated</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-xs text-zinc-400">Needs Calibration</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => startDiagnostic(stat.stat_name)}
                className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${stat.has_diagnostic
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                  }`}
              >
                {stat.has_diagnostic ? (
                  <>
                    <Activity className="h-4 w-4" />
                    Recalibrate
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
