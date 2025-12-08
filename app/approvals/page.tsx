"use client";

/**
 * Approval Queue Page
 *
 * Displays PROPOSE-level escalations that require human approval.
 * Allows users to approve, reject, or modify agent proposals before execution.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Edit3,
  ChevronDown,
  ChevronUp,
  Search,
  Bot,
  Zap,
  Shield,
  X,
} from 'lucide-react';

interface PendingApproval {
  id: string;
  agentId: string;
  timestamp: number;
  input: string;
  output: string;
  escalationLevel: 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';
  wasExecuted: boolean;
  domainId?: string;
  tokensUsed: number;
  model: string;
  latencyMs: number;
  requestId: string;
  reviewed?: boolean;
  decision?: 'approved' | 'rejected' | 'modified';
  decidedAt?: string;
  modifiedContent?: string;
}

interface ApprovalCounts {
  pending: number;
  approved: number;
  rejected: number;
  modified: number;
  total: number;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [counts, setCounts] = useState<ApprovalCounts>({ pending: 0, approved: 0, rejected: 0, modified: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const fetchApprovals = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const statusParam = filter === 'all' ? '' : `?status=${filter === 'approved' || filter === 'rejected' ? 'reviewed' : filter}`;
      const res = await fetch(`/api/approvals${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        let filteredApprovals = data.approvals || [];

        // Additional client-side filtering for approved/rejected
        if (filter === 'approved') {
          filteredApprovals = filteredApprovals.filter((a: PendingApproval) => a.decision === 'approved' || a.decision === 'modified');
        } else if (filter === 'rejected') {
          filteredApprovals = filteredApprovals.filter((a: PendingApproval) => a.decision === 'rejected');
        }

        setApprovals(filteredApprovals);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (error) {
      console.error("Failed to fetch approvals", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (approvalId: string) => {
    setActionLoading(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        await fetchApprovals();
      }
    } catch (error) {
      console.error("Failed to approve", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    setActionLoading(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (res.ok) {
        await fetchApprovals();
      }
    } catch (error) {
      console.error("Failed to reject", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleModify = async (approvalId: string) => {
    if (!editContent.trim()) return;

    setActionLoading(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          modifiedContent: editContent,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditContent('');
        await fetchApprovals();
      }
    } catch (error) {
      console.error("Failed to modify", error);
    } finally {
      setActionLoading(null);
    }
  };

  const startEditing = (approval: PendingApproval) => {
    setEditingId(approval.id);
    setEditContent(approval.input);
    setExpandedId(approval.id);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const getAgentDisplayName = (agentId: string) => {
    return agentId
      .replace('agent.', '')
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getEscalationColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'PROPOSE': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'AUTO_EXECUTE': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getDecisionColor = (decision?: string) => {
    switch (decision) {
      case 'approved': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'modified': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'rejected': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    }
  };

  const filteredApprovals = approvals.filter(a =>
    searchQuery === '' ||
    a.input.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.output.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.agentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-3">
              <Shield className="text-amber-500" size={36} />
              Approval Queue
            </h1>
            <p className="text-slate-400">
              Review and approve agent proposals before execution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Pending Count Badge */}
            {counts.pending > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-500/20 border-amber-500/50 text-amber-400">
                <AlertTriangle size={16} />
                <span className="font-medium">{counts.pending} pending</span>
              </div>
            )}

            <button
              onClick={fetchApprovals}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 font-medium shadow-sm"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{counts.pending}</p>
                <p className="text-xs text-slate-400">Pending</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{counts.approved + counts.modified}</p>
                <p className="text-xs text-slate-400">Approved</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{counts.rejected}</p>
                <p className="text-xs text-slate-400">Rejected</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
                <Zap size={20} className="text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{counts.total}</p>
                <p className="text-xs text-slate-400">Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${filter === f
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Approvals List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading approvals...</div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
              <Bot size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No approvals found</p>
              <p className="text-sm text-slate-500 mt-1">
                {filter === 'pending' ? 'No pending proposals to review' : 'Try a different filter'}
              </p>
            </div>
          ) : (
            filteredApprovals.map((approval) => (
              <div
                key={approval.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all duration-300"
              >
                {/* Approval Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === approval.id ? null : approval.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg border ${getEscalationColor(approval.escalationLevel)}`}>
                        <Bot size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-white">{getAgentDisplayName(approval.agentId)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${getEscalationColor(approval.escalationLevel)}`}>
                            {approval.escalationLevel}
                          </span>
                          {approval.reviewed && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${getDecisionColor(approval.decision)}`}>
                              {approval.decision === 'approved' && <CheckCircle size={10} />}
                              {approval.decision === 'modified' && <Edit3 size={10} />}
                              {approval.decision === 'rejected' && <XCircle size={10} />}
                              <span className="capitalize">{approval.decision}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2">
                          {approval.output || approval.input}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span>{formatTimestamp(approval.timestamp)}</span>
                          <span>{approval.model}</span>
                          <span>{approval.latencyMs}ms</span>
                          {approval.domainId && <span className="text-amber-500/70">{approval.domainId}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!approval.reviewed && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(approval.id); }}
                            disabled={actionLoading === approval.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(approval.id); }}
                            disabled={actionLoading === approval.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditing(approval); }}
                            disabled={actionLoading === approval.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          >
                            <Edit3 size={14} />
                            Modify
                          </button>
                        </>
                      )}
                      {expandedId === approval.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === approval.id && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Edit Mode */}
                    {editingId === approval.id && (
                      <div className="mb-4 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                            <Edit3 size={14} />
                            Modify Before Approval
                          </h4>
                          <button
                            onClick={cancelEditing}
                            className="text-slate-400 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                          placeholder="Edit the content..."
                        />
                        <div className="flex justify-end gap-2 mt-3">
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleModify(approval.id)}
                            disabled={actionLoading === approval.id || !editContent.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm font-medium"
                          >
                            <CheckCircle size={14} />
                            Apply & Approve
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-950 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Original Input
                      </h4>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{approval.input}</p>

                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">
                        Agent Response
                      </h4>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{approval.output}</p>

                      {approval.modifiedContent && (
                        <>
                          <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mt-4 mb-2">
                            Modified Content
                          </h4>
                          <p className="text-sm text-blue-300 whitespace-pre-wrap bg-blue-500/5 p-2 rounded">{approval.modifiedContent}</p>
                        </>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4 text-xs text-slate-500">
                        <div>
                          <span className="font-medium">Request ID:</span>
                          <code className="ml-2 bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{approval.requestId}</code>
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>
                          <span className="ml-2">{new Date(approval.timestamp).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-medium">Tokens Used:</span>
                          <span className="ml-2">{approval.tokensUsed}</span>
                        </div>
                        <div>
                          <span className="font-medium">Model:</span>
                          <span className="ml-2">{approval.model}</span>
                        </div>
                        {approval.decidedAt && (
                          <>
                            <div>
                              <span className="font-medium">Decision:</span>
                              <span className={`ml-2 capitalize ${approval.decision === 'approved' ? 'text-green-400' : approval.decision === 'rejected' ? 'text-red-400' : 'text-blue-400'}`}>
                                {approval.decision}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Decided At:</span>
                              <span className="ml-2">{new Date(approval.decidedAt).toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
