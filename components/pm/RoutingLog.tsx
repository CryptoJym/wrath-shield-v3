'use client';

/**
 * Routing Log Component
 *
 * Shows routed items, target, status, and follow-up questions.
 * Integrates with context-requests API and agent bus.
 */

import { useState, useEffect, useCallback } from 'react';

type RoutingTarget = 'finance' | 'pm' | 'legal' | 'orchestrator';
type RequestStatus = 'pending' | 'processing' | 'dispatched' | 'done' | 'failed';

interface ContextRequest {
  id: string;
  created_at: number;
  updated_at: number;
  event_id: string;
  event_payload: {
    channel: string;
    subject?: string;
    preview?: string;
    contact?: string;
    source?: string;
    ts?: number;
  };
  target: RoutingTarget;
  status: RequestStatus;
  dispatched_to?: string[];
  bus_message_ids: string[];
  follow_up_questions?: string[];
  resolution_summary?: string;
}

interface RoutingStats {
  total: number;
  by_target: Record<RoutingTarget, number>;
  by_status: Record<RequestStatus, number>;
}

// Target display config
const TARGET_CONFIG: Record<RoutingTarget, { label: string; color: string; icon: string }> = {
  finance: { label: 'Finance', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '💰' },
  pm: { label: 'PM', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '📋' },
  legal: { label: 'Legal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⚖️' },
  orchestrator: { label: 'Orchestrator', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: '🎯' },
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600 dark:text-yellow-400', icon: '○' },
  processing: { label: 'Processing', color: 'text-blue-600 dark:text-blue-400', icon: '◐' },
  dispatched: { label: 'Dispatched', color: 'text-cyan-600 dark:text-cyan-400', icon: '↗' },
  done: { label: 'Done', color: 'text-green-600 dark:text-green-400', icon: '●' },
  failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400', icon: '✕' },
};

function formatTimestamp(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(ts * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    email: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    calendar: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    imessage: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    lifelog: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  };
  return colors[channel] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
}

interface RoutingRowProps {
  request: ContextRequest;
  onUpdateStatus?: (id: string, status: RequestStatus) => void;
}

function RoutingRow({ request, onUpdateStatus }: RoutingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const targetConfig = TARGET_CONFIG[request.target];
  const statusConfig = STATUS_CONFIG[request.status];

  return (
    <div className="border-b border-slate-700 last:border-b-0">
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/50"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <span className={`text-sm ${statusConfig.color}`} title={statusConfig.label}>
          {statusConfig.icon}
        </span>

        {/* Target badge */}
        <span className={`px-2 py-0.5 text-xs rounded ${targetConfig.color} flex-shrink-0`}>
          {targetConfig.icon} {targetConfig.label}
        </span>

        {/* Channel badge */}
        <span className={`px-2 py-0.5 text-xs rounded ${getChannelColor(request.event_payload.channel)} flex-shrink-0`}>
          {request.event_payload.channel}
        </span>

        {/* Subject/Preview */}
        <span className="flex-1 text-sm text-slate-100 truncate">
          {request.event_payload.subject || request.event_payload.preview || '(no subject)'}
        </span>

        {/* Dispatched to (if orchestrator) */}
        {request.dispatched_to && request.dispatched_to.length > 0 && (
          <span className="text-xs text-slate-400 flex-shrink-0">
            → {request.dispatched_to.map((a) => a.replace('-agent', '')).join(', ')}
          </span>
        )}

        {/* Follow-ups indicator */}
        {request.follow_up_questions && request.follow_up_questions.length > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-amber-900/40 text-amber-300 flex-shrink-0">
            {request.follow_up_questions.length} Q
          </span>
        )}

        {/* Timestamp */}
        <span className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">
          {formatTimestamp(request.created_at)}
        </span>

        {/* Expand indicator */}
        <span className="text-slate-500 flex-shrink-0">{expanded ? '▼' : '▶'}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-6 border-l-2 border-slate-600 space-y-3">
          {/* Event details */}
          <div className="space-y-1 text-sm">
            {request.event_payload.contact && (
              <p className="text-slate-400">
                <span className="text-slate-500">From:</span> {request.event_payload.contact}
              </p>
            )}
            {request.event_payload.preview && (
              <p className="text-slate-300 whitespace-pre-wrap line-clamp-3">
                {request.event_payload.preview}
              </p>
            )}
          </div>

          {/* Follow-up questions */}
          {request.follow_up_questions && request.follow_up_questions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Follow-up Questions</div>
              {request.follow_up_questions.map((q, i) => (
                <div key={i} className="px-3 py-2 rounded bg-amber-900/20 border border-amber-800/50 text-sm text-amber-200">
                  {q}
                </div>
              ))}
            </div>
          )}

          {/* Resolution */}
          {request.resolution_summary && (
            <div className="px-3 py-2 rounded bg-green-900/20 border border-green-800/50 text-sm text-green-200">
              <span className="text-green-400 font-medium">Resolution:</span> {request.resolution_summary}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              ID: {request.id.slice(0, 8)} | Event: {request.event_id.slice(0, 8)} | Messages: {request.bus_message_ids.length}
            </span>

            {/* Actions */}
            {onUpdateStatus && request.status !== 'done' && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(request.id, 'done');
                  }}
                  className="px-2 py-1 text-xs bg-green-900/40 hover:bg-green-900/60 text-green-300 rounded"
                >
                  Mark Done
                </button>
                {request.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(request.id, 'processing');
                    }}
                    className="px-2 py-1 text-xs bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 rounded"
                  >
                    Start Processing
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface RoutingLogProps {
  limit?: number;
  showStats?: boolean;
}

export function RoutingLog({ limit = 50, showStats = true }: RoutingLogProps) {
  const [requests, setRequests] = useState<ContextRequest[]>([]);
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [pendingByTarget, setPendingByTarget] = useState<Record<RoutingTarget, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTarget, setFilterTarget] = useState<RoutingTarget | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'all'>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterTarget !== 'all') params.set('target', filterTarget);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/context-requests?${params}`);
      if (!res.ok) throw new Error('Failed to load routing data');

      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || null);
      setPendingByTarget(data.pending_by_target || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit, filterTarget, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (id: string, status: RequestStatus) => {
    try {
      await fetch('/api/context-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', requestId: id, status }),
      });
      loadData();
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Routing Log</h3>
          <p className="text-sm text-slate-400">
            {stats ? `${stats.by_status.pending + stats.by_status.processing} active of ${stats.total}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded-md text-slate-200"
        >
          Refresh
        </button>
      </div>

      {/* Target counts (stats bar) */}
      {showStats && pendingByTarget && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-800/30">
          <span className="text-xs text-slate-500">Pending:</span>
          {(Object.entries(TARGET_CONFIG) as [RoutingTarget, typeof TARGET_CONFIG[RoutingTarget]][]).map(([key, cfg]) => (
            <span
              key={key}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                pendingByTarget[key] > 0 ? cfg.color : 'bg-slate-800 text-slate-500'
              }`}
            >
              {cfg.icon} {cfg.label}: {pendingByTarget[key]}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-800 bg-slate-800/20">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Target:</label>
          <select
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value as RoutingTarget | 'all')}
            className="text-sm border border-slate-700 rounded px-2 py-1 bg-slate-800 text-slate-200"
          >
            <option value="all">All</option>
            {Object.entries(TARGET_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as RequestStatus | 'all')}
            className="text-sm border border-slate-700 rounded px-2 py-1 bg-slate-800 text-slate-200"
          >
            <option value="all">All</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-900/20 border-b border-red-800/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 items-center">
                <div className="w-4 h-4 rounded-full bg-slate-700" />
                <div className="h-4 bg-slate-700 rounded w-16" />
                <div className="h-4 bg-slate-700 rounded flex-1" />
                <div className="h-4 bg-slate-700 rounded w-12" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <p className="text-lg">No routed items</p>
            <p className="text-sm mt-1">Route events from the Recent Signals feed</p>
          </div>
        ) : (
          <div>
            {requests.map((req) => (
              <RoutingRow key={req.id} request={req} onUpdateStatus={handleUpdateStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact stats panel for target counts (can be embedded in health panel)
 */
export function RoutingStatsBar() {
  const [stats, setStats] = useState<{ pending_by_target: Record<RoutingTarget, number> } | null>(null);

  useEffect(() => {
    fetch('/api/context-requests?stats=true')
      .then((r) => r.json())
      .then((data) => setStats({ pending_by_target: data.pending_by_target }))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const totalPending = Object.values(stats.pending_by_target).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">Routed:</span>
      {totalPending > 0 ? (
        (Object.entries(TARGET_CONFIG) as [RoutingTarget, typeof TARGET_CONFIG[RoutingTarget]][]).map(([key, cfg]) => {
          const count = stats.pending_by_target[key];
          if (count === 0) return null;
          return (
            <span key={key} className={`px-1.5 py-0.5 rounded ${cfg.color}`}>
              {cfg.icon} {count}
            </span>
          );
        })
      ) : (
        <span className="text-slate-600">none pending</span>
      )}
    </div>
  );
}

export default RoutingLog;
