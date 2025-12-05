'use client';

/**
 * EscalationsPanel Component
 *
 * Displays CRITICAL items that need immediate attention.
 * This panel always appears at the top of the PM dashboard when there are escalations.
 *
 * Features:
 * - Critical items (red) and warning items (yellow)
 * - Deadline countdowns
 * - Acknowledge, Resolve, and Snooze actions
 * - Visual and auditory alerts (optional)
 * - Always visible when escalations exist
 */

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Check,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

export interface Escalation {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  context: string;
  required_action: string;
  deadline?: string; // ISO timestamp
  entity_type?: string;
  entity_id?: string;
  source: string;
  created_at: string;
}

export interface EscalationsPanelProps {
  escalations: Escalation[];
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string, resolution: string) => Promise<void>;
  onSnooze: (id: string, until: Date) => Promise<void>;
  onRefresh?: () => void;
}

export function EscalationsPanel({
  escalations,
  onAcknowledge,
  onResolve,
  onSnooze,
  onRefresh,
}: EscalationsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [snoozeHours, setSnoozeHours] = useState<Record<string, number>>({});

  const criticalCount = escalations.filter(e => e.severity === 'critical').length;
  const warningCount = escalations.filter(e => e.severity === 'warning').length;

  if (escalations.length === 0) {
    return null; // Don't show panel if no escalations
  }

  const handleAcknowledge = async (id: string) => {
    setActioningId(id);
    try {
      await onAcknowledge(id);
      onRefresh?.();
    } finally {
      setActioningId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setActioningId(id);
    try {
      await onResolve(id, resolutions[id] || '');
      setResolutions(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onRefresh?.();
    } finally {
      setActioningId(null);
    }
  };

  const handleSnooze = async (id: string) => {
    const hours = snoozeHours[id] || 24;
    const until = new Date();
    until.setHours(until.getHours() + hours);

    setActioningId(id);
    try {
      await onSnooze(id, until);
      setSnoozeHours(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onRefresh?.();
    } finally {
      setActioningId(null);
    }
  };

  const getTimeRemaining = (deadline: string | undefined) => {
    if (!deadline) return null;

    const now = new Date();
    const due = new Date(deadline);
    const diff = due.getTime() - now.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) {
      return { text: 'OVERDUE', className: 'text-rose-400 font-bold' };
    }

    if (hours < 24) {
      return { text: `${hours}h remaining`, className: 'text-rose-400 font-medium' };
    }

    if (days < 3) {
      return { text: `${days}d remaining`, className: 'text-amber-400 font-medium' };
    }

    return { text: `${days}d remaining`, className: 'text-slate-400' };
  };

  return (
    <section
      className="rounded-xl border-2 border-rose-500/50 bg-gradient-to-br from-rose-950/30 to-slate-950/30 p-6 space-y-4 shadow-lg shadow-rose-500/10"
      role="alert"
      aria-live="assertive"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-600/20 animate-pulse">
            <AlertTriangle size={24} className="text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
              NEEDS YOUR ATTENTION
              <span className="px-2 py-0.5 text-xs rounded-full bg-rose-600 text-white font-bold">
                {escalations.length}
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              {criticalCount > 0 && `${criticalCount} critical`}
              {criticalCount > 0 && warningCount > 0 && ', '}
              {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
        >
          Refresh
        </button>
      </div>

      {/* Escalation Cards */}
      <div className="space-y-3">
        {escalations
          .sort((a, b) => {
            // Critical first, then by deadline
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (a.severity !== 'critical' && b.severity === 'critical') return 1;
            if (a.deadline && b.deadline) {
              return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            }
            return 0;
          })
          .map((escalation) => {
            const isExpanded = expandedId === escalation.id;
            const isActioning = actioningId === escalation.id;
            const timeRemaining = getTimeRemaining(escalation.deadline);

            const severityConfig = {
              critical: {
                icon: AlertCircle,
                bg: 'bg-rose-900/20',
                border: 'border-rose-500/30',
                text: 'text-rose-400',
                badgeBg: 'bg-rose-600',
              },
              warning: {
                icon: AlertTriangle,
                bg: 'bg-amber-900/20',
                border: 'border-amber-500/30',
                text: 'text-amber-400',
                badgeBg: 'bg-amber-600',
              },
            };

            const config = severityConfig[escalation.severity];
            const SeverityIcon = config.icon;

            return (
              <div
                key={escalation.id}
                className={`rounded-lg border ${config.border} ${config.bg} p-4 space-y-3 transition ${
                  escalation.severity === 'critical' ? 'ring-2 ring-rose-500/30' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityIcon size={18} className={config.text} />
                      <span className={`px-2 py-0.5 text-xs rounded font-medium text-white ${config.badgeBg}`}>
                        {escalation.severity.toUpperCase()}
                      </span>
                      {timeRemaining && (
                        <span className={`flex items-center gap-1 text-xs ${timeRemaining.className}`}>
                          <Clock size={12} />
                          {timeRemaining.text}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{escalation.title}</h3>
                    <p className="text-sm text-slate-300 mt-1">{escalation.context}</p>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : escalation.id)}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={18} className="text-slate-400" />
                    )}
                  </button>
                </div>

                {/* Required Action */}
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Required Action:</span>
                  <p className="text-sm text-slate-200 mt-1">{escalation.required_action}</p>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="space-y-3 pt-3 border-t border-slate-700/50">
                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                      <div>
                        <span className="text-slate-600">Source:</span> {escalation.source}
                      </div>
                      <div>
                        <span className="text-slate-600">Created:</span>{' '}
                        {new Date(escalation.created_at).toLocaleString()}
                      </div>
                      {escalation.entity_type && (
                        <>
                          <div>
                            <span className="text-slate-600">Entity Type:</span> {escalation.entity_type}
                          </div>
                          <div>
                            <span className="text-slate-600">Entity ID:</span> {escalation.entity_id}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Resolution Input */}
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">Resolution notes (optional):</label>
                      <textarea
                        value={resolutions[escalation.id] || ''}
                        onChange={(e) =>
                          setResolutions((prev) => ({ ...prev, [escalation.id]: e.target.value }))
                        }
                        placeholder="Describe how you resolved this..."
                        className="w-full px-3 py-2 text-sm rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-slate-500 resize-none"
                        rows={2}
                        disabled={isActioning}
                      />
                    </div>

                    {/* Snooze Options */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Snooze for:</label>
                      <select
                        value={snoozeHours[escalation.id] || 24}
                        onChange={(e) =>
                          setSnoozeHours((prev) => ({ ...prev, [escalation.id]: parseInt(e.target.value) }))
                        }
                        className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-slate-500"
                        disabled={isActioning}
                      >
                        <option value={1}>1 hour</option>
                        <option value={4}>4 hours</option>
                        <option value={24}>1 day</option>
                        <option value={72}>3 days</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                  <button
                    onClick={() => handleResolve(escalation.id)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {isActioning && actioningId === escalation.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Resolve
                  </button>
                  <button
                    onClick={() => handleAcknowledge(escalation.id)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    <BellOff size={16} />
                    Acknowledge
                  </button>
                  {isExpanded && (
                    <button
                      onClick={() => handleSnooze(escalation.id)}
                      disabled={isActioning}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      <Bell size={16} />
                      Snooze
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
