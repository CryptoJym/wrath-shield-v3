'use client';

/**
 * Unified Orchestration Dashboard
 *
 * The command center for James's Life OS orchestration system.
 * Shows at a glance:
 * - Signal flow from all sources
 * - Escalation levels (what needs attention vs what's handled)
 * - VIP contact activity
 * - Domain distribution
 * - Recent decisions with reasoning
 */

import { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Mail,
  MessageSquare,
  Github,
  Calendar,
  Activity,
  ChevronRight,
  RefreshCw,
  Zap,
  Shield,
  Eye,
  BellRing,
  Layers,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';

// Types
interface OrchestrationSummary {
  total_signals_7d: number;
  ai_processed: number;
  ai_processing_rate: number;
  pending_review: number;
  auto_executed_24h: number;
}

interface SourceData {
  source: string;
  count: number;
  ai_processed: number;
}

interface EscalationData {
  level: string;
  count: number;
}

interface PriorityData {
  priority: string;
  count: number;
}

interface RecentDecision {
  id: string;
  source: string;
  signal_type: string;
  title: string;
  content: string;
  status: string;
  timestamp: string;
  triage_action: string;
  triage_priority: string;
  triage_escalation_level: string;
  triage_decision_source: string;
  triage_confidence: number;
}

interface VIPActivity {
  name: string;
  count: number;
}

interface DomainData {
  domain: string;
  count: number;
}

interface DashboardData {
  summary: OrchestrationSummary;
  source_distribution: SourceData[];
  escalation_breakdown: EscalationData[];
  priority_distribution: PriorityData[];
  recent_decisions: RecentDecision[];
  vip_activity: VIPActivity[];
  domain_distribution: DomainData[];
  error?: string;
}

// Source icons mapping
const sourceIcons: Record<string, React.ReactNode> = {
  comms: <Mail className="w-4 h-4" />,
  inbox: <Mail className="w-4 h-4" />,
  github: <Github className="w-4 h-4" />,
  calendar: <Calendar className="w-4 h-4" />,
  lifelog: <MessageSquare className="w-4 h-4" />,
  finance: <Activity className="w-4 h-4" />,
  legal: <Shield className="w-4 h-4" />,
  pm: <Layers className="w-4 h-4" />,
};

// Escalation colors
const escalationColors: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-400/10 border-red-400/30',
  PROPOSE: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  AUTO_EXECUTE: 'text-green-400 bg-green-400/10 border-green-400/30',
};

// Priority colors
const priorityColors: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
};

export default function UnifiedOrchestrationDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orchestration/summary');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(json.error || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const summary = data?.summary;
  const isGettingStarted = !summary || summary.total_signals_7d === 0;

  // Getting Started State
  if (isGettingStarted) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Brain className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Unified Orchestration</h2>
              <p className="text-slate-400">The brain of your Life OS</p>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Getting Started
            </h3>
            <div className="space-y-4 text-slate-300">
              <p>
                The Unified Orchestration Layer is your intelligent gateway that processes
                <span className="text-violet-400 font-medium"> all incoming signals</span> and
                determines the appropriate action.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                    <Eye className="w-5 h-5 text-blue-400" />
                  </div>
                  <h4 className="font-medium text-white mb-1">WHO</h4>
                  <p className="text-sm text-slate-400">
                    VIP detection and relationship context from your contacts
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5 text-amber-400" />
                  </div>
                  <h4 className="font-medium text-white mb-1">WHAT</h4>
                  <p className="text-sm text-slate-400">
                    Domain detection (Vuplicity, NewReward, Family, etc.)
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-4">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                    <Zap className="w-5 h-5 text-green-400" />
                  </div>
                  <h4 className="font-medium text-white mb-1">HOW</h4>
                  <p className="text-sm text-slate-400">
                    Life Charter rules determine escalation level
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Unified Orchestration</h2>
            <p className="text-slate-400 text-sm">Last 7 days</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Activity className="w-5 h-5" />}
          label="Total Signals"
          value={summary?.total_signals_7d || 0}
          color="violet"
        />
        <SummaryCard
          icon={<Zap className="w-5 h-5" />}
          label="Auto-Executed"
          value={summary?.auto_executed_24h || 0}
          subLabel="last 24h"
          color="green"
        />
        <SummaryCard
          icon={<BellRing className="w-5 h-5" />}
          label="Pending Review"
          value={summary?.pending_review || 0}
          color={summary?.pending_review && summary.pending_review > 0 ? 'amber' : 'slate'}
        />
        <SummaryCard
          icon={<Brain className="w-5 h-5" />}
          label="AI Processing"
          value={`${summary?.ai_processing_rate || 0}%`}
          color="purple"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escalation Breakdown */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            Escalation Levels
          </h3>
          <div className="space-y-3">
            {data?.escalation_breakdown && data.escalation_breakdown.length > 0 ? (
              data.escalation_breakdown.map(({ level, count }) => (
                <EscalationBar key={level} level={level} count={count} total={summary?.total_signals_7d || 1} />
              ))
            ) : (
              <p className="text-slate-500 text-sm">No escalation data yet</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <HelpCircle className="w-3 h-3" />
              <span><span className="text-red-400">CRITICAL</span> = You decide</span>
              <span className="mx-2">|</span>
              <span><span className="text-amber-400">PROPOSE</span> = Review suggested</span>
              <span className="mx-2">|</span>
              <span><span className="text-green-400">AUTO</span> = Handled</span>
            </div>
          </div>
        </div>

        {/* Signal Sources */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            Signal Sources
          </h3>
          <div className="space-y-2">
            {data?.source_distribution && data.source_distribution.length > 0 ? (
              data.source_distribution.slice(0, 6).map(({ source, count, ai_processed }) => (
                <SourceRow
                  key={source}
                  source={source}
                  count={count}
                  aiProcessed={ai_processed}
                  total={summary?.total_signals_7d || 1}
                />
              ))
            ) : (
              <p className="text-slate-500 text-sm">No signal data yet</p>
            )}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Priority Distribution
          </h3>
          <div className="flex gap-4 flex-wrap">
            {data?.priority_distribution && data.priority_distribution.length > 0 ? (
              data.priority_distribution.map(({ priority, count }) => (
                <PriorityBadge key={priority} priority={priority} count={count} />
              ))
            ) : (
              <p className="text-slate-500 text-sm">No priority data yet</p>
            )}
          </div>
        </div>

        {/* VIP Activity */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-pink-400" />
            VIP Activity
          </h3>
          {data?.vip_activity && data.vip_activity.length > 0 ? (
            <div className="space-y-2">
              {data.vip_activity.map(({ name, count }) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {name}
                  </span>
                  <span className="text-slate-400 text-sm">{count} signals</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No VIP activity this week</p>
          )}
        </div>
      </div>

      {/* Recent Decisions */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Recent Decisions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-3">Signal</th>
                <th className="pb-3">Source</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3">Escalation</th>
                <th className="pb-3">Decision</th>
                <th className="pb-3">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {data?.recent_decisions && data.recent_decisions.length > 0 ? (
                data.recent_decisions.slice(0, 10).map((decision) => (
                  <tr key={decision.id} className="text-sm">
                    <td className="py-3 pr-4">
                      <div className="max-w-[200px] truncate text-slate-300">
                        {decision.title}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        {sourceIcons[decision.source] || <Activity className="w-4 h-4" />}
                        {decision.source}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`capitalize ${priorityColors[decision.triage_priority] || 'text-slate-400'}`}>
                        {decision.triage_priority || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${escalationColors[decision.triage_escalation_level] || 'text-slate-400 bg-slate-400/10 border-slate-400/30'}`}>
                        {decision.triage_escalation_level || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {decision.triage_action || 'pending'}
                    </td>
                    <td className="py-3">
                      <ConfidenceBar value={decision.triage_confidence || 0} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">
                    No recent decisions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function SummaryCard({
  icon,
  label,
  value,
  subLabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subLabel?: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-400/10',
    green: 'text-green-400 bg-green-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    slate: 'text-slate-400 bg-slate-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">
        {label}
        {subLabel && <span className="text-xs ml-1">({subLabel})</span>}
      </div>
    </div>
  );
}

function EscalationBar({ level, count, total }: { level: string; count: number; total: number }) {
  const percentage = Math.round((count / total) * 100);
  const colors: Record<string, { bg: string; fill: string }> = {
    CRITICAL: { bg: 'bg-red-400/10', fill: 'bg-red-400' },
    PROPOSE: { bg: 'bg-amber-400/10', fill: 'bg-amber-400' },
    AUTO_EXECUTE: { bg: 'bg-green-400/10', fill: 'bg-green-400' },
  };
  const { bg, fill } = colors[level] || { bg: 'bg-slate-400/10', fill: 'bg-slate-400' };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className={`${level === 'CRITICAL' ? 'text-red-400' : level === 'PROPOSE' ? 'text-amber-400' : 'text-green-400'}`}>
          {level}
        </span>
        <span className="text-slate-400">{count} ({percentage}%)</span>
      </div>
      <div className={`h-2 rounded-full ${bg}`}>
        <div
          className={`h-full rounded-full ${fill} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SourceRow({ source, count, aiProcessed, total }: { source: string; count: number; aiProcessed: number; total: number }) {
  const percentage = Math.round((count / total) * 100);
  const aiRate = count > 0 ? Math.round((aiProcessed / count) * 100) : 0;

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{sourceIcons[source] || <Activity className="w-4 h-4" />}</span>
        <span className="text-slate-300 capitalize">{source}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-400">{count}</span>
        <span className="text-xs text-green-400/70">{aiRate}% AI</span>
      </div>
    </div>
  );
}

function PriorityBadge({ priority, count }: { priority: string; count: number }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-400/10 border-red-400/30 text-red-400',
    high: 'bg-orange-400/10 border-orange-400/30 text-orange-400',
    medium: 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400',
    low: 'bg-slate-400/10 border-slate-400/30 text-slate-400',
  };

  return (
    <div className={`px-3 py-1.5 rounded-lg border ${colors[priority] || colors.low}`}>
      <span className="capitalize font-medium">{priority}</span>
      <span className="ml-2 text-sm opacity-75">{count}</span>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const color = percentage >= 80 ? 'bg-green-400' : percentage >= 60 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">{percentage}%</span>
    </div>
  );
}
