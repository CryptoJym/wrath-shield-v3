'use client';

/**
 * AI Triage Intelligence Dashboard
 *
 * A beautiful, comprehensible view of how your AI assistant is learning
 * to handle incoming tasks. Shows:
 * - How often AI and rules agree (building trust)
 * - AI confidence distribution (how sure it is)
 * - Recent decisions that need your review
 * - Performance over time
 */

import { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Zap,
  Target,
  Activity,
  ChevronRight,
  Info,
  HelpCircle,
} from 'lucide-react';

// Types matching the API response
interface DisagreementSummary {
  total_decisions: number;
  ai_only: number;
  rules_only: number;
  both_available: number;
  agreements: number;
  disagreements: number;
  agreement_rate: number;
  disagreement_by_type: {
    action: number;
    escalation: number;
    priority: number;
    multiple: number;
  };
  human_overrides: number;
  ai_correct_after_override: number;
  rules_correct_after_override: number;
}

interface ConfidenceBucket {
  bucket: string;
  count: number;
  ai_accepted: number;
  fallback_to_rules: number;
  human_override: number;
}

interface PerformanceMetrics {
  period_start: number;
  period_end: number;
  total_signals: number;
  ai_processed: number;
  ai_success_rate: number;
  avg_ai_confidence: number;
  avg_processing_time_ms: number;
  zep_context_usage_rate: number;
  human_override_rate: number;
}

interface PendingDecision {
  id: string;
  signal_id: string;
  signal_source: string;
  signal_type: string;
  timestamp: number;
  ai_action: string | null;
  rule_action: string | null;
  final_action: string;
  final_escalation: string;
  final_priority: string;
  decision_source: string;
  human_override: boolean;
  ai_rules_agreed: boolean;
}

interface ThresholdAnalysis {
  current_threshold: number;
  recommended_threshold: number;
  analysis: Array<{
    threshold: number;
    ai_acceptance_rate: number;
    human_agreement_rate: number;
    disagreement_rate: number;
  }>;
}

interface AIMetricsData {
  disagreement_summary?: DisagreementSummary;
  confidence_distribution?: ConfidenceBucket[];
  performance_metrics?: PerformanceMetrics;
  pending_review?: PendingDecision[];
  threshold_analysis?: ThresholdAnalysis;
  metadata: {
    timestamp: number;
    view: string;
  };
}

// Helper to format relative time
function formatRelativeTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Format action for display
function formatAction(action: string | null): string {
  if (!action) return 'Unknown';
  return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Color for confidence level
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-400';
  if (confidence >= 0.6) return 'text-amber-400';
  return 'text-rose-400';
}

// Tooltip component
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-slate-200 bg-slate-900 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

// Trust Score Ring - a beautiful circular indicator
function TrustScoreRing({ score, label }: { score: number; label: string }) {
  const percentage = Math.round(score * 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score * circumference);

  const getColor = () => {
    if (percentage >= 80) return { stroke: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (percentage >= 60) return { stroke: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { stroke: '#ef4444', text: 'text-rose-400', bg: 'bg-rose-500/10' };
  };

  const colors = getColor();

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="56"
            cy="56"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx="56"
            cy="56"
            r="45"
            stroke={colors.stroke}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${colors.text}`}>{percentage}%</span>
        </div>
      </div>
      <span className="mt-2 text-sm text-slate-400">{label}</span>
    </div>
  );
}

// Confidence bar chart
function ConfidenceChart({ data }: { data: ConfidenceBucket[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((bucket, idx) => {
        const total = bucket.count || 1;
        const acceptedPct = (bucket.ai_accepted / total) * 100;
        const fallbackPct = (bucket.fallback_to_rules / total) * 100;
        const overridePct = (bucket.human_override / total) * 100;

        return (
          <div key={bucket.bucket} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">{bucket.bucket}</span>
              <span className="text-slate-500">{bucket.count} signals</span>
            </div>
            <div className="h-6 bg-slate-800 rounded-full overflow-hidden flex">
              {bucket.ai_accepted > 0 && (
                <Tooltip content={`${bucket.ai_accepted} AI accepted`}>
                  <div
                    className="h-full bg-emerald-500/80 transition-all duration-300"
                    style={{ width: `${acceptedPct}%` }}
                  />
                </Tooltip>
              )}
              {bucket.fallback_to_rules > 0 && (
                <Tooltip content={`${bucket.fallback_to_rules} fell back to rules`}>
                  <div
                    className="h-full bg-amber-500/80 transition-all duration-300"
                    style={{ width: `${fallbackPct}%` }}
                  />
                </Tooltip>
              )}
              {bucket.human_override > 0 && (
                <Tooltip content={`${bucket.human_override} human overrides`}>
                  <div
                    className="h-full bg-rose-500/80 transition-all duration-300"
                    style={{ width: `${overridePct}%` }}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="text-slate-400">AI Accepted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="text-slate-400">Rules Fallback</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="text-slate-400">Human Override</span>
        </div>
      </div>
    </div>
  );
}

// Decision card for pending reviews
function DecisionCard({
  decision,
  onFeedback,
}: {
  decision: PendingDecision;
  onFeedback: (id: string, approved: boolean, action?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const sourceIcon = {
    github: '🐙',
    inbox: '📧',
    comms: '💬',
    legal: '⚖️',
    finance: '💰',
  }[decision.signal_source] || '📋';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden transition-all duration-200 hover:border-slate-600">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-xl flex-shrink-0">{sourceIcon}</span>
            <div className="min-w-0">
              <div className="font-medium text-slate-200 truncate">
                {decision.signal_type === 'task' ? 'New Task' : formatAction(decision.signal_type)}
              </div>
              <div className="text-sm text-slate-400">
                from {decision.signal_source} · {formatRelativeTime(decision.timestamp)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!decision.ai_rules_agreed && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Needs Review
              </span>
            )}
            <ChevronRight
              size={16}
              className={`text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>

        {/* Quick comparison */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          {decision.ai_action && (
            <div className="flex items-center gap-1.5">
              <Brain size={14} className="text-violet-400" />
              <span className="text-slate-400">AI:</span>
              <span className="text-slate-300">{formatAction(decision.ai_action)}</span>
            </div>
          )}
          {decision.rule_action && (
            <div className="flex items-center gap-1.5">
              <Scale size={14} className="text-blue-400" />
              <span className="text-slate-400">Rules:</span>
              <span className="text-slate-300">{formatAction(decision.rule_action)}</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">Current Decision:</span>{' '}
            {formatAction(decision.final_action)} ({decision.final_escalation} priority)
          </div>

          <div className="text-sm text-slate-500">
            Was the AI's suggestion correct? Your feedback helps it learn.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFeedback(decision.id, true, decision.ai_action || undefined);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
            >
              <ThumbsUp size={16} />
              AI was right
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFeedback(decision.id, false, decision.rule_action || undefined);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              <ThumbsDown size={16} />
              Rules were right
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Dashboard Component
export function AITriageDashboard() {
  const [data, setData] = useState<AIMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/pm/ai-metrics');
      if (!res.ok) throw new Error('Failed to fetch AI metrics');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleFeedback = async (decisionId: string, approved: boolean, action?: string) => {
    setFeedbackLoading(decisionId);
    try {
      await fetch('/api/pm/ai-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          decision_id: decisionId,
          human_action: action,
          feedback: approved ? 'AI decision confirmed' : 'Rules decision preferred',
        }),
      });
      // Refresh data
      await fetchData();
    } catch (e) {
      console.error('Failed to submit feedback:', e);
    } finally {
      setFeedbackLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-8">
        <div className="flex items-center justify-center gap-3 text-slate-400">
          <RefreshCw size={20} className="animate-spin" />
          <span>Loading AI Intelligence...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-800/50 bg-rose-900/20 p-6">
        <div className="flex items-center gap-3 text-rose-400">
          <AlertTriangle size={20} />
          <span>Unable to load AI metrics: {error}</span>
        </div>
      </div>
    );
  }

  const summary = data.disagreement_summary;
  const confidence = data.confidence_distribution;
  const performance = data.performance_metrics;
  const pending = data.pending_review;
  const threshold = data.threshold_analysis;

  // Check if this is a fresh start (no decisions yet)
  const isGettingStarted = !summary || summary.total_decisions === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
            <Brain size={24} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">AI Intelligence</h2>
            <p className="text-sm text-slate-400">How your AI assistant is learning</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Getting Started State */}
      {isGettingStarted && (
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-slate-800/50 to-purple-500/5 p-8">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles size={32} className="text-violet-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Your AI is Ready to Learn</h3>
            <p className="text-slate-400 mb-6">
              As tasks flow through your PM inbox, the AI will analyze patterns and make intelligent triage decisions.
              You'll see metrics here as it learns from incoming signals.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="text-2xl mb-1">1</div>
                <div className="text-xs text-slate-500">Tasks arrive in inbox</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="text-2xl mb-1">2</div>
                <div className="text-xs text-slate-500">AI analyzes & suggests</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="text-2xl mb-1">3</div>
                <div className="text-xs text-slate-500">Your feedback trains it</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trust & Performance Cards */}
      {summary && performance && !isGettingStarted && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* AI/Rules Agreement */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-blue-400" />
                <span className="font-medium text-slate-200">Trust Score</span>
              </div>
              <Tooltip content="How often AI and rules agree on decisions">
                <HelpCircle size={14} className="text-slate-500" />
              </Tooltip>
            </div>
            <TrustScoreRing score={summary.agreement_rate || 0} label="AI & Rules Agree" />
            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-slate-200">{summary.agreements}</div>
                <div className="text-xs text-slate-500">Agreements</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-amber-400">{summary.disagreements}</div>
                <div className="text-xs text-slate-500">Disagreements</div>
              </div>
            </div>
          </div>

          {/* AI Performance */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                <span className="font-medium text-slate-200">AI Performance</span>
              </div>
              <Tooltip content="How well AI is handling signals">
                <HelpCircle size={14} className="text-slate-500" />
              </Tooltip>
            </div>
            <TrustScoreRing score={performance.ai_success_rate || 0} label="Success Rate" />
            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-slate-200">{performance.ai_processed}</div>
                <div className="text-xs text-slate-500">AI Processed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-200">{performance.total_signals}</div>
                <div className="text-xs text-slate-500">Total Signals</div>
              </div>
            </div>
          </div>

          {/* Human Feedback */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-emerald-400" />
                <span className="font-medium text-slate-200">Learning Progress</span>
              </div>
              <Tooltip content="How your feedback is improving AI">
                <HelpCircle size={14} className="text-slate-500" />
              </Tooltip>
            </div>
            <TrustScoreRing
              score={1 - (performance.human_override_rate || 0)}
              label="Autonomous Decisions"
            />
            <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-emerald-400">{summary.ai_correct_after_override}</div>
                <div className="text-xs text-slate-500">AI Confirmed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-200">{summary.human_overrides}</div>
                <div className="text-xs text-slate-500">Overrides</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confidence Distribution */}
      {confidence && confidence.length > 0 && !isGettingStarted && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-violet-400" />
              <span className="font-medium text-slate-200">AI Confidence Distribution</span>
            </div>
            <Tooltip content="How confident AI is in its decisions, and how those played out">
              <HelpCircle size={14} className="text-slate-500" />
            </Tooltip>
          </div>
          <ConfidenceChart data={confidence} />

          {threshold && (
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Current confidence threshold:</span>
                  <span className="font-mono text-slate-200">{(threshold.current_threshold * 100).toFixed(0)}%</span>
                </div>
                {threshold.recommended_threshold !== threshold.current_threshold && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Sparkles size={14} />
                    <span>Recommended: {(threshold.recommended_threshold * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Reviews */}
      {pending && pending.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-amber-400" />
              <span className="font-medium text-slate-200">Needs Your Review</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300">
                {pending.length}
              </span>
            </div>
            <span className="text-sm text-slate-400">
              AI and rules disagreed - your feedback helps it learn
            </span>
          </div>

          <div className="space-y-3">
            {pending.slice(0, 5).map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                onFeedback={handleFeedback}
              />
            ))}
          </div>

          {pending.length > 5 && (
            <div className="mt-4 text-center">
              <button className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
                View all {pending.length} pending reviews
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state for pending - only show when NOT getting started */}
      {(!pending || pending.length === 0) && !isGettingStarted && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 size={20} />
            <span className="font-medium">All caught up!</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            No decisions need your review right now. The AI and rules are in agreement.
          </p>
        </div>
      )}

      {/* Quick Stats - only show when NOT getting started */}
      {performance && !isGettingStarted && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-center">
            <div className="text-2xl font-bold text-slate-200">
              {performance.avg_processing_time_ms.toFixed(0)}ms
            </div>
            <div className="text-xs text-slate-500">Avg Processing Time</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-center">
            <div className={`text-2xl font-bold ${getConfidenceColor(performance.avg_ai_confidence)}`}>
              {(performance.avg_ai_confidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500">Avg AI Confidence</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-center">
            <div className="text-2xl font-bold text-violet-400">
              {(performance.zep_context_usage_rate * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500">Memory Context Used</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-center">
            <div className="text-2xl font-bold text-slate-200">
              {summary?.total_decisions || 0}
            </div>
            <div className="text-xs text-slate-500">Total Decisions</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AITriageDashboard;
