'use client';

/**
 * Communications Pipeline Dashboard
 *
 * Overview dashboard showing:
 * - Source health (last sync times, event counts, status)
 * - Pipeline metrics (classifications, routing, accuracy)
 * - Recent routed items
 * - Pending by target (finance/legal/pm/ea)
 * - Classification logs and accuracy
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type RoutingTarget = 'finance' | 'pm' | 'legal' | 'orchestrator';
type ClassificationCategory = 'finance' | 'legal' | 'pm' | 'ea' | 'health' | 'comms' | 'junk';

interface SourceHealth {
  source: string;
  last_sync: number | null;
  event_count: number;
  error_count: number;
  status: 'healthy' | 'stale' | 'error' | 'unknown';
}

interface RoutedEvent {
  id: string;
  source: string;
  channel: string;
  subject: string;
  routed_to: string;
  ts: number;
  confidence: number;
  classification: string;
}

interface PipelineMetrics {
  total_processed: number;
  by_category: Record<ClassificationCategory, number>;
  by_source: Record<string, number>;
  avg_confidence: number;
  classification_accuracy: number;
  needs_review_count: number;
  junk_count: number;
  routed_count: number;
  dedupe_hits: number;
  last_updated: number;
}

interface PipelineLog {
  id: string;
  timestamp: number;
  event_id: string;
  stage: string;
  action: string;
  success: boolean;
  details: any;
}

interface CommsStatus {
  status: string;
  timestamp: number;
  source_health: SourceHealth[];
  recent_routed: RoutedEvent[];
  pending_by_target: Record<RoutingTarget, number>;
  pipeline_metrics: PipelineMetrics;
  recent_logs: PipelineLog[];
}

// ============================================================================
// Config
// ============================================================================

const STATUS_COLORS = {
  healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  stale: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

const TARGET_CONFIG: Record<RoutingTarget, { label: string; color: string; icon: string }> = {
  finance: { label: 'Finance', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '💰' },
  pm: { label: 'PM', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '📋' },
  legal: { label: 'Legal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⚖️' },
  orchestrator: { label: 'Orchestrator', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: '🎯' },
};

const CATEGORY_COLORS: Record<ClassificationCategory, string> = {
  finance: 'bg-green-500',
  legal: 'bg-purple-500',
  pm: 'bg-blue-500',
  ea: 'bg-indigo-500',
  health: 'bg-pink-500',
  comms: 'bg-cyan-500',
  junk: 'bg-gray-500',
};

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  const now = Date.now();
  const diff = now - ts * 1000;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

// ============================================================================
// Components
// ============================================================================

function SourceHealthCard({ sources }: { sources: SourceHealth[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold text-slate-100 mb-3">Source Health</h3>
      <div className="space-y-2">
        {sources.map((source) => (
          <div key={source.source} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[source.status]}`}>{source.status}</span>
              <span className="text-sm font-medium text-slate-200">{source.source}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>{source.event_count} events</span>
              {source.last_sync && <span>{formatTimestamp(source.last_sync)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineMetricsCard({ metrics }: { metrics: PipelineMetrics }) {
  const totalCategories = Object.values(metrics.by_category).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold text-slate-100 mb-3">Pipeline Metrics</h3>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-2xl font-bold text-slate-100">{metrics.total_processed}</div>
          <div className="text-xs text-slate-400">Total Processed</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-2xl font-bold text-green-400">{metrics.routed_count}</div>
          <div className="text-xs text-slate-400">Routed</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-2xl font-bold text-amber-400">{metrics.needs_review_count}</div>
          <div className="text-xs text-slate-400">Needs Review</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/50">
          <div className="text-2xl font-bold text-slate-400">{metrics.junk_count}</div>
          <div className="text-xs text-slate-400">Junk</div>
        </div>
      </div>

      {/* Accuracy */}
      <div className="mb-4 p-3 rounded-lg bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Classification Accuracy</span>
          <span className="text-sm font-medium text-slate-200">{formatConfidence(metrics.classification_accuracy)}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${metrics.classification_accuracy * 100}%` }}
          />
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Classifications</div>
        <div className="space-y-2">
          {(Object.entries(metrics.by_category) as [ClassificationCategory, number][])
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => {
              const percentage = totalCategories > 0 ? (count / totalCategories) * 100 : 0;
              return (
                <div key={category} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-16 text-right">{count}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div
                      className={`${CATEGORY_COLORS[category]} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-20">{category}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Dedupe stats */}
      {metrics.dedupe_hits > 0 && (
        <div className="mt-3 p-2 rounded bg-blue-900/20 border border-blue-800/50 text-xs text-blue-300">
          Deduplication: {metrics.dedupe_hits} duplicates filtered
        </div>
      )}
    </div>
  );
}

function PendingByTargetCard({ pending }: { pending: Record<RoutingTarget, number> }) {
  const totalPending = Object.values(pending).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold text-slate-100 mb-3">Pending by Target</h3>

      {totalPending === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p>No pending items</p>
          <p className="text-xs mt-1">All routed items processed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.entries(TARGET_CONFIG) as [RoutingTarget, typeof TARGET_CONFIG[RoutingTarget]][])
            .filter(([key]) => pending[key] > 0)
            .map(([key, cfg]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>
                <span className="text-xl font-bold text-slate-100">{pending[key]}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function RecentRoutedCard({ events }: { events: RoutedEvent[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-lg font-semibold text-slate-100 mb-3">Recent Routed Items</h3>

      {events.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p>No routed items yet</p>
          <p className="text-xs mt-1">Run pipeline to classify and route events</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.map((event) => (
            <div key={event.id} className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm text-slate-200 font-medium truncate flex-1">{event.subject || '(no subject)'}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{formatTimestamp(event.ts)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{event.source}</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-400">{event.routed_to}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{formatConfidence(event.confidence)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineLogsCard({ logs }: { logs: PipelineLog[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-100">Pipeline Logs</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className={`space-y-1 ${expanded ? 'max-h-96' : 'max-h-48'} overflow-y-auto`}>
        {logs.map((log) => (
          <div
            key={log.id}
            className={`p-2 rounded text-xs ${
              log.success ? 'bg-slate-800/30 text-slate-400' : 'bg-red-900/20 text-red-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded ${log.success ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
                  {log.stage}
                </span>
                <span>{log.action}</span>
                <span className="text-slate-600">({log.event_id})</span>
              </div>
              <span className="text-slate-600">{formatTimestamp(log.timestamp / 1000)}</span>
            </div>
            {expanded && log.details && Object.keys(log.details).length > 0 && (
              <div className="mt-1 pl-2 text-slate-500">{JSON.stringify(log.details)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export function CommsDashboard() {
  const [status, setStatus] = useState<CommsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/comms/status');
      if (!res.ok) throw new Error('Failed to load comms status');

      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadStatus]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 animate-pulse">
            <div className="h-6 bg-slate-700 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-slate-700 rounded w-3/4" />
              <div className="h-4 bg-slate-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-800 bg-red-900/20 p-6 text-center">
        <p className="text-red-300 font-medium mb-2">Failed to load dashboard</p>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button onClick={loadStatus} className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 rounded-lg text-red-200 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Communications Pipeline</h2>
          <p className="text-sm text-slate-400">Real-time classification, routing, and monitoring</p>
        </div>
        <button
          onClick={loadStatus}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 text-sm transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SourceHealthCard sources={status.source_health} />
        <PendingByTargetCard pending={status.pending_by_target} />
        <PipelineMetricsCard metrics={status.pipeline_metrics} />
        <RecentRoutedCard events={status.recent_routed} />
      </div>

      {/* Logs (full width) */}
      <PipelineLogsCard logs={status.recent_logs} />
    </div>
  );
}

export default CommsDashboard;
