"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Bell,
  BellOff,
  Users,
  Brain,
  Shield,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from 'lucide-react';

interface OrgCouncilProposal {
  id: string;
  proposedBy: string;
  text: string;
  metadata?: Record<string, any>;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

interface ProposalCounts {
  pending: number;
  approved: number;
  rejected: number;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function CouncilPage() {
  const [proposals, setProposals] = useState<OrgCouncilProposal[]>([]);
  const [counts, setCounts] = useState<ProposalCounts>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  const fetchProposals = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const statusParam = filter === 'all' ? '' : `&status=${filter}`;
      const res = await fetch(`/api/memory/council?action=proposals${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
        if (data.counts) {
          setCounts(data.counts);
        }
      }
    } catch (error) {
      console.error("Failed to fetch proposals", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  const fetchNotificationCount = async () => {
    try {
      const res = await fetch('/api/memory/council?action=notifications');
      if (res.ok) {
        const data = await res.json();
        setNotificationCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  useEffect(() => {
    fetchProposals();
    fetchNotificationCount();
  }, [fetchProposals]);

  const handleApprove = async (proposalId: string) => {
    setActionLoading(proposalId);
    try {
      const res = await fetch('/api/memory/council', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          action: 'approve',
          reviewedBy: 'council-ui', // In production, use actual user ID
        }),
      });
      if (res.ok) {
        await fetchProposals();
      }
    } catch (error) {
      console.error("Failed to approve proposal", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (proposalId: string) => {
    setActionLoading(proposalId);
    try {
      const res = await fetch('/api/memory/council', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          action: 'reject',
          reviewedBy: 'council-ui',
        }),
      });
      if (res.ok) {
        await fetchProposals();
      }
    } catch (error) {
      console.error("Failed to reject proposal", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      case 'approved': return 'text-green-500 border-green-500/30 bg-green-500/10';
      case 'rejected': return 'text-red-500 border-red-500/30 bg-red-500/10';
      default: return 'text-gray-500 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="text-yellow-500" />;
      case 'approved': return <CheckCircle size={16} className="text-green-500" />;
      case 'rejected': return <XCircle size={16} className="text-red-500" />;
      default: return null;
    }
  };

  const getAgentDisplayName = (agentId: string) => {
    return agentId
      .replace('-agent', '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimestamp = (timestamp: string) => {
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

  const filteredProposals = proposals.filter(p =>
    searchQuery === '' ||
    p.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.proposedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex items-center gap-3">
              <Shield className="text-primary" size={36} />
              Org Council
            </h1>
            <p className="text-muted-foreground">
              Review and approve agent proposals for shared organizational knowledge.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Badge */}
            <div className="relative">
              {notificationCount > 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/20 border-primary text-primary">
                  <Bell size={16} />
                  <span className="font-medium">{notificationCount}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-secondary/50 border-border text-muted-foreground">
                  <BellOff size={16} />
                </div>
              )}
            </div>

            <button
              onClick={() => { fetchProposals(); fetchNotificationCount(); }}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium shadow-sm"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Clock size={20} className="text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.pending}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <XCircle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-border">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${filter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Proposals List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading proposals...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Brain size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No proposals found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === 'pending' ? 'No pending proposals to review' : 'Try a different filter'}
              </p>
            </div>
          ) : (
            filteredProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300"
              >
                {/* Proposal Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === proposal.id ? null : proposal.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${getStatusColor(proposal.status)} border`}>
                        <Users size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{getAgentDisplayName(proposal.proposedBy)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(proposal.status)} border flex items-center gap-1`}>
                            {getStatusIcon(proposal.status)}
                            <span className="capitalize">{proposal.status}</span>
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {proposal.text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatTimestamp(proposal.timestamp)}
                          {proposal.reviewedBy && (
                            <span className="ml-2">
                              {proposal.status === 'approved' ? 'Approved' : 'Rejected'} by {proposal.reviewedBy}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {proposal.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApprove(proposal.id); }}
                            disabled={actionLoading === proposal.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={14} />
                            Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(proposal.id); }}
                            disabled={actionLoading === proposal.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </>
                      )}
                      {expandedId === proposal.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === proposal.id && (
                  <div className="px-4 pb-4 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-secondary/30 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Full Proposal Text
                      </h4>
                      <p className="text-sm whitespace-pre-wrap">{proposal.text}</p>

                      {proposal.metadata && Object.keys(proposal.metadata).length > 0 && (
                        <>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2">
                            Metadata
                          </h4>
                          <pre className="text-xs bg-black/20 rounded p-2 overflow-x-auto">
                            {JSON.stringify(proposal.metadata, null, 2)}
                          </pre>
                        </>
                      )}

                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Proposal ID:</span>
                          <code className="ml-2 bg-black/20 px-1.5 py-0.5 rounded">{proposal.id}</code>
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>
                          <span className="ml-2">{new Date(proposal.timestamp).toLocaleString()}</span>
                        </div>
                        {proposal.reviewedAt && (
                          <>
                            <div>
                              <span className="font-medium">Reviewed By:</span>
                              <span className="ml-2">{proposal.reviewedBy}</span>
                            </div>
                            <div>
                              <span className="font-medium">Reviewed At:</span>
                              <span className="ml-2">{new Date(proposal.reviewedAt).toLocaleString()}</span>
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
