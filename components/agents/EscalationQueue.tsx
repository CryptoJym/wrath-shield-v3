"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Zap,
  FileQuestion,
} from 'lucide-react';

/**
 * Escalation item from the API
 */
interface EscalationItem {
  id: string;
  created_at: number;
  updated_at: number;
  event_id: string;
  event_payload: {
    channel?: string;
    subject?: string;
    body?: string;
    [key: string]: unknown;
  };
  target: string;
  status: string;
  escalation_level: 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';
  detected_domain?: string;
  dispatched_to: string[];
  bus_message_ids: string[];
  // Enriched fields from API
  escalation_type?: string;
  age_seconds?: number;
  proposed_agents?: string[];
}

interface EscalationCounts {
  total: number;
  critical: number;
  propose: number;
}

interface EscalationQueueProps {
  className?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onAction?: (action: 'approve' | 'reject', item: EscalationItem) => void;
}

/**
 * EscalationQueue Component
 *
 * Displays pending escalations (CRITICAL and PROPOSE) that require user approval.
 * Integrates with Life OS escalation enforcement system.
 */
export function EscalationQueue({
  className = '',
  maxItems = 10,
  autoRefresh = true,
  refreshInterval = 30000,
  onAction,
}: EscalationQueueProps) {
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [counts, setCounts] = useState<EscalationCounts>({ total: 0, critical: 0, propose: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchEscalations = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/escalation');
      if (!response.ok) {
        throw new Error(`Failed to fetch escalations: ${response.status}`);
      }
      const data = await response.json();
      setEscalations(data.pending?.slice(0, maxItems) || []);
      setCounts(data.counts || { total: 0, critical: 0, propose: 0 });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load escalations');
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    fetchEscalations();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchEscalations, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchEscalations, autoRefresh, refreshInterval]);

  const handleAction = async (action: 'approve' | 'reject', item: EscalationItem, reason?: string) => {
    setActionLoading(item.id);
    try {
      const response = await fetch('/api/agents/escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          requestId: item.id,
          reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.status}`);
      }

      // Refresh the list
      await fetchEscalations();

      // Notify parent if callback provided
      onAction?.(action, item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatAge = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getEscalationIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'PROPOSE':
        return <FileQuestion className="w-5 h-5 text-yellow-500" />;
      default:
        return <Zap className="w-5 h-5 text-green-500" />;
    }
  };

  const getEscalationBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'PROPOSE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    }
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading escalations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Escalation Queue</h3>
          {counts.total > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
              {counts.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {counts.critical > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              {counts.critical} Critical
            </span>
          )}
          {counts.propose > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
              {counts.propose} Pending
            </span>
          )}
          <button
            onClick={() => fetchEscalations()}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 m-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {escalations.length === 0 && !error && (
        <div className="p-8 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No pending escalations</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            All systems operating normally
          </p>
        </div>
      )}

      {/* Escalation list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {escalations.map((item) => (
          <div
            key={item.id}
            className={`p-4 ${
              item.escalation_level === 'CRITICAL'
                ? 'bg-red-50/50 dark:bg-red-900/10'
                : ''
            }`}
          >
            {/* Item header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {getEscalationIcon(item.escalation_level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEscalationBadge(item.escalation_level)}`}>
                      {item.escalation_level}
                    </span>
                    {item.detected_domain && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        {item.detected_domain}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.age_seconds ? formatAge(item.age_seconds) : 'Unknown'}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white truncate">
                    {item.event_payload?.subject || 'No subject'}
                  </p>
                  {item.event_payload?.channel && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      via {item.event_payload.channel}
                    </p>
                  )}
                </div>
              </div>

              {/* Expand/collapse button */}
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {expandedId === item.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>

            {/* Expanded details */}
            {expandedId === item.id && (
              <div className="mt-3 pl-8 space-y-2">
                {item.event_payload?.body && (
                  <div className="p-3 rounded bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400">
                    {item.event_payload.body}
                  </div>
                )}
                {item.proposed_agents && item.proposed_agents.length > 0 && (
                  <p className="text-sm text-gray-500">
                    <strong>Proposed agents:</strong> {item.proposed_agents.join(', ')}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  ID: {item.id} | Event: {item.event_id}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 pl-8 flex items-center gap-2">
              <button
                onClick={() => handleAction('approve', item)}
                disabled={actionLoading === item.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading === item.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve
              </button>
              <button
                onClick={() => handleAction('reject', item, 'User rejected')}
                disabled={actionLoading === item.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with stats */}
      {counts.total > maxItems && (
        <div className="p-3 text-center border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">
            Showing {maxItems} of {counts.total} escalations
          </p>
        </div>
      )}
    </div>
  );
}

export default EscalationQueue;
