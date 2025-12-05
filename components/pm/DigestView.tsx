'use client';

/**
 * DigestView Component
 *
 * Full daily digest display showing complete council activity summary.
 * Can be shown as a modal, tab, or separate page.
 *
 * Features:
 * - Statistics with charts
 * - Auto actions, proposals, escalations sections
 * - AI-generated insights
 * - Warnings and anomaly detection
 * - Period selector
 * - Export functionality
 */

import { useState } from 'react';
import {
  BarChart3,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { CouncilActivityPanel, AutoAction } from './CouncilActivityPanel';
import { ProposalsPanel, Proposal } from './ProposalsPanel';
import { EscalationsPanel, Escalation } from './EscalationsPanel';

export interface DigestStats {
  tasks_completed: number;
  tasks_created: number;
  signals_processed: number;
  decisions_auto: number;
  decisions_proposed: number;
  decisions_escalated: number;
  queue_health: {
    pending: number;
    failed: number;
    avg_processing_time_ms: number;
  };
}

export interface DailyDigest {
  generated_at: string;
  period: { start: string; end: string };
  auto_actions: AutoAction[];
  proposals: Proposal[];
  escalations: Escalation[];
  stats: DigestStats;
  insights: string[];
  warnings: string[];
}

export interface DigestViewProps {
  digest: DailyDigest | null;
  onRefresh?: () => void;
  onClose?: () => void; // For modal mode
  onExport?: (format: 'markdown' | 'html') => void;
  mode?: 'modal' | 'inline'; // Default inline
}

export function DigestView({
  digest,
  onRefresh,
  onClose,
  onExport,
  mode = 'inline',
}: DigestViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stats: true,
    autoActions: false,
    proposals: false,
    escalations: false,
    insights: true,
    warnings: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!digest) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-slate-800">
            <BarChart3 size={32} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-400">No Digest Available</h3>
          <p className="text-sm text-slate-500">Generate a digest to see council activity summary</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition"
            >
              <RefreshCw size={16} />
              Generate Digest
            </button>
          )}
        </div>
      </div>
    );
  }

  const containerClass = mode === 'modal'
    ? 'fixed inset-0 z-50 bg-slate-950/95 overflow-y-auto'
    : '';

  const contentClass = mode === 'modal'
    ? 'min-h-screen p-6'
    : '';

  return (
    <div className={containerClass}>
      <div className={`${contentClass} space-y-6`}>
        {/* Header */}
        <div className="flex items-center justify-between sticky top-0 z-10 bg-slate-950 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              <BarChart3 size={28} className="text-sky-400" />
              PM Council Daily Digest
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {new Date(digest.period.start).toLocaleDateString()} -{' '}
              {new Date(digest.period.end).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <div className="flex gap-1">
                <button
                  onClick={() => onExport('markdown')}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition flex items-center gap-1.5"
                >
                  <Download size={14} />
                  Markdown
                </button>
                <button
                  onClick={() => onExport('html')}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition flex items-center gap-1.5"
                >
                  <Download size={14} />
                  HTML
                </button>
              </div>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 text-sm rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            )}
            {mode === 'modal' && onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        <section className="space-y-3">
          <button
            onClick={() => toggleSection('stats')}
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition"
          >
            <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <BarChart3 size={20} className="text-sky-400" />
              Statistics
            </h3>
            {expandedSections.stats ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expandedSections.stats && (
            <div className="grid md:grid-cols-3 gap-4">
              {/* Tasks */}
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Tasks</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Created</span>
                    <span className="text-lg font-bold text-emerald-400">{digest.stats.tasks_created}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Completed</span>
                    <span className="text-lg font-bold text-sky-400">{digest.stats.tasks_completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Net Change</span>
                    <span className={`text-lg font-bold ${
                      digest.stats.tasks_created - digest.stats.tasks_completed > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {digest.stats.tasks_created > digest.stats.tasks_completed ? '+' : ''}
                      {digest.stats.tasks_created - digest.stats.tasks_completed}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signals */}
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Signals</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Total Processed</span>
                    <span className="text-lg font-bold text-slate-200">{digest.stats.signals_processed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">AUTO</span>
                    <span className="text-sm font-semibold text-emerald-400">
                      {digest.stats.decisions_auto} ({Math.round((digest.stats.decisions_auto / digest.stats.signals_processed) * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">PROPOSE</span>
                    <span className="text-sm font-semibold text-amber-400">
                      {digest.stats.decisions_proposed} ({Math.round((digest.stats.decisions_proposed / digest.stats.signals_processed) * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">CRITICAL</span>
                    <span className="text-sm font-semibold text-rose-400">
                      {digest.stats.decisions_escalated} ({Math.round((digest.stats.decisions_escalated / digest.stats.signals_processed) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Queue Health */}
              <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Queue Health</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Pending</span>
                    <span className="text-lg font-bold text-amber-400">{digest.stats.queue_health.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Failed</span>
                    <span className="text-lg font-bold text-rose-400">{digest.stats.queue_health.failed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Avg Time</span>
                    <span className="text-sm font-semibold text-slate-300">
                      {(digest.stats.queue_health.avg_processing_time_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Insights Section */}
        {digest.insights.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => toggleSection('insights')}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition"
            >
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Lightbulb size={20} className="text-emerald-400" />
                Insights ({digest.insights.length})
              </h3>
              {expandedSections.insights ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedSections.insights && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-4">
                <ul className="space-y-2">
                  {digest.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                      <TrendingUp size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Warnings Section */}
        {digest.warnings.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => toggleSection('warnings')}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition"
            >
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-400" />
                Warnings ({digest.warnings.length})
              </h3>
              {expandedSections.warnings ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedSections.warnings && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-4">
                <ul className="space-y-2">
                  {digest.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-amber-200">
                      <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Auto Actions Section */}
        {digest.auto_actions.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => toggleSection('autoActions')}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition"
            >
              <h3 className="text-lg font-semibold text-slate-200">
                Auto Actions ({digest.auto_actions.length})
              </h3>
              {expandedSections.autoActions ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedSections.autoActions && (
              <CouncilActivityPanel
                autoActions={digest.auto_actions}
                onRefresh={onRefresh}
              />
            )}
          </section>
        )}

        {/* Proposals Section */}
        {digest.proposals.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => toggleSection('proposals')}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition"
            >
              <h3 className="text-lg font-semibold text-slate-200">
                Proposals ({digest.proposals.length})
              </h3>
              {expandedSections.proposals ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedSections.proposals && (
              <ProposalsPanel
                proposals={digest.proposals}
                onApprove={async () => {}}
                onReject={async () => {}}
                onDefer={async () => {}}
                onRefresh={onRefresh}
              />
            )}
          </section>
        )}

        {/* Escalations Section */}
        {digest.escalations.length > 0 && (
          <section className="space-y-3">
            <button
              onClick={() => toggleSection('escalations')}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 transition"
            >
              <h3 className="text-lg font-semibold text-slate-200">
                Escalations ({digest.escalations.length})
              </h3>
              {expandedSections.escalations ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedSections.escalations && (
              <EscalationsPanel
                escalations={digest.escalations}
                onAcknowledge={async () => {}}
                onResolve={async () => {}}
                onSnooze={async () => {}}
                onRefresh={onRefresh}
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
