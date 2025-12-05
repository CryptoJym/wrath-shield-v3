'use client';

/**
 * ProposalsPanel Component
 *
 * Displays items that need human review before the council executes them (PROPOSE escalation).
 * User can approve, reject with reason, defer, or modify before approving.
 *
 * Features:
 * - Clear rationale display
 * - Approve/Reject/Defer/Modify actions
 * - Correction feedback on rejection
 * - Optimistic UI updates
 * - Confidence indicators
 */

import { useState } from 'react';
import {
  FileQuestion,
  Check,
  X,
  Clock,
  Edit,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export interface Proposal {
  id: string;
  proposal_type: string; // classification, priority, follow_up, create_issue, etc.
  recommendation: string;
  rationale: string;
  signal_source?: string;
  signal_type?: string;
  confidence?: number;
  signal_payload?: Record<string, any>;
  triage_action?: string;
  triage_priority?: string;
  triage_metadata?: Record<string, any>;
  created_at: string;
}

export interface ProposalsPanelProps {
  proposals: Proposal[];
  onApprove: (id: string, params?: any) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onDefer: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

export function ProposalsPanel({
  proposals,
  onApprove,
  onReject,
  onDefer,
  onRefresh,
}: ProposalsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [modifyParams, setModifyParams] = useState<Record<string, any>>({});
  const [showModifyModal, setShowModifyModal] = useState<string | null>(null);

  if (proposals.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-emerald-900/20">
            <Check size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300">No Proposals Pending</h3>
          <p className="text-sm text-slate-500">
            The council is confident - all decisions were made automatically
          </p>
        </div>
      </section>
    );
  }

  const handleApprove = async (id: string) => {
    setActioningId(id);
    try {
      await onApprove(id, modifyParams[id]);
      setModifyParams((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onRefresh?.();
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = rejectReasons[id];
    if (!reason?.trim()) {
      return; // Validation should prevent this
    }

    setActioningId(id);
    try {
      await onReject(id, reason);
      setRejectReasons((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onRefresh?.();
    } finally {
      setActioningId(null);
    }
  };

  const handleDefer = async (id: string) => {
    setActioningId(id);
    try {
      await onDefer(id);
      onRefresh?.();
    } finally {
      setActioningId(null);
    }
  };

  const getProposalTypeIcon = (type: string) => {
    switch (type) {
      case 'classification':
        return FileQuestion;
      case 'priority':
        return AlertCircle;
      case 'create_issue':
        return Sparkles;
      default:
        return FileQuestion;
    }
  };

  const getConfidenceBadge = (confidence: number | undefined) => {
    if (!confidence) return null;

    const pct = Math.round(confidence * 100);
    let color = 'bg-slate-700 text-slate-400';
    if (pct >= 80) color = 'bg-emerald-900/50 text-emerald-300';
    else if (pct >= 60) color = 'bg-amber-900/50 text-amber-300';

    return (
      <span className={`px-2 py-0.5 text-xs rounded font-medium ${color}`}>
        {pct}% confidence
      </span>
    );
  };

  return (
    <section className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-slate-950/20 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-600/20">
            <FileQuestion size={24} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
              PROPOSALS NEEDING REVIEW
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600 text-white font-bold">
                {proposals.length}
              </span>
            </h2>
            <p className="text-sm text-slate-400">Council recommends these actions but needs your approval</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
        >
          Refresh
        </button>
      </div>

      {/* Proposal Cards */}
      <div className="space-y-3">
        {proposals.map((proposal) => {
          const isExpanded = expandedId === proposal.id;
          const isActioning = actioningId === proposal.id;
          const ProposalIcon = getProposalTypeIcon(proposal.proposal_type);
          const [showRejectInput, setShowRejectInput] = useState(false);

          return (
            <div
              key={proposal.id}
              className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <ProposalIcon size={18} className="text-amber-400" />
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-900/50 text-amber-300 font-medium">
                      {proposal.proposal_type}
                    </span>
                    {getConfidenceBadge(proposal.confidence)}
                    {proposal.signal_source && (
                      <span className="text-xs text-slate-500">from {proposal.signal_source}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">{proposal.recommendation}</h3>
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : proposal.id)}
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

              {/* Rationale */}
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Rationale:</span>
                <p className="text-sm text-slate-200 mt-1">{proposal.rationale}</p>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="space-y-3 pt-3 border-t border-slate-700/50">
                  {/* Signal Payload */}
                  {proposal.signal_payload && Object.keys(proposal.signal_payload).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Signal Details:</span>
                      <div className="p-2 rounded bg-slate-900/70 border border-slate-700/30 text-xs font-mono text-slate-300 overflow-x-auto">
                        <pre>{JSON.stringify(proposal.signal_payload, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {/* Triage Decision */}
                  {proposal.triage_action && (
                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                      <div>
                        <span className="text-slate-600">Proposed Action:</span> {proposal.triage_action}
                      </div>
                      {proposal.triage_priority && (
                        <div>
                          <span className="text-slate-600">Priority:</span> {proposal.triage_priority}
                        </div>
                      )}
                      <div>
                        <span className="text-slate-600">Created:</span>{' '}
                        {new Date(proposal.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rejection Input (conditionally shown) */}
              {showRejectInput && (
                <div className="space-y-2 pt-2 border-t border-amber-500/20">
                  <label className="text-xs text-amber-400 font-medium">
                    Help the council learn: Why should this not be done?
                  </label>
                  <textarea
                    value={rejectReasons[proposal.id] || ''}
                    onChange={(e) =>
                      setRejectReasons((prev) => ({ ...prev, [proposal.id]: e.target.value }))
                    }
                    placeholder="E.g., 'This task is on hold pending client feedback, not abandoned'"
                    className="w-full px-3 py-2 text-sm rounded bg-slate-900 border border-amber-500/30 text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                    rows={2}
                    disabled={isActioning}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-700/50 flex-wrap">
                <button
                  onClick={() => handleApprove(proposal.id)}
                  disabled={isActioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {isActioning && actioningId === proposal.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Approve
                </button>

                {showRejectInput ? (
                  <button
                    onClick={() => handleReject(proposal.id)}
                    disabled={isActioning || !rejectReasons[proposal.id]?.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    <X size={16} />
                    Submit Rejection
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    <X size={16} />
                    Reject
                  </button>
                )}

                <button
                  onClick={() => handleDefer(proposal.id)}
                  disabled={isActioning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  <Clock size={16} />
                  Defer
                </button>

                {/* Modify button (future enhancement) */}
                {isExpanded && (
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-slate-500 text-sm font-medium cursor-not-allowed opacity-50"
                    title="Modify functionality coming soon"
                  >
                    <Edit size={16} />
                    Modify
                  </button>
                )}

                {showRejectInput && (
                  <button
                    onClick={() => {
                      setShowRejectInput(false);
                      setRejectReasons((prev) => {
                        const next = { ...prev };
                        delete next[proposal.id];
                        return next;
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
                  >
                    Cancel
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
