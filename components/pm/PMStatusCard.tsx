'use client';

/**
 * PM Status Card Component
 *
 * Displays PM agent status summary with health score and pending items.
 * Can be embedded in Roster page or Inbox routing log area.
 */

import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface PMStatus {
  ok: boolean;
  agent: string;
  status: 'green' | 'yellow' | 'red';
  health_score: number;
  pending: number;
  total_routed: number;
  resolved: number;
  recent_items: Array<{
    id: string;
    status: string;
    created_at: number;
    event_subject?: string;
    channel?: string;
  }>;
}

const STATUS_CONFIG = {
  green: {
    label: 'Healthy',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle,
  },
  yellow: {
    label: 'Attention',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Clock,
  },
  red: {
    label: 'Critical',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    icon: AlertCircle,
  },
};

function formatRelativeTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface PMStatusCardProps {
  compact?: boolean;
}

export function PMStatusCard({ compact = false }: PMStatusCardProps) {
  const [data, setData] = useState<PMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/pm/status');
        if (!res.ok) throw new Error('Failed to fetch PM status');
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-700 bg-slate-800/50 p-4 animate-pulse ${compact ? 'p-3' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-24" />
            <div className="h-3 bg-slate-700 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`rounded-xl border border-rose-800/50 bg-rose-900/20 p-4 ${compact ? 'p-3' : ''}`}>
        <div className="flex items-center gap-3 text-rose-400">
          <AlertCircle size={20} />
          <span className="text-sm">PM Status unavailable</span>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[data.status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${config.border} ${config.bg}`}>
        <ClipboardList size={16} className={config.text} />
        <span className="text-sm font-medium text-slate-200">PM</span>
        <span className={`text-xs ${config.text}`}>{config.label}</span>
        {data.pending > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-slate-800 text-slate-300">
            {data.pending} pending
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-800/50 ${config.text}`}>
            <ClipboardList size={24} />
          </div>
          <div>
            <div className="font-semibold text-slate-100">PM Agent</div>
            <div className={`text-sm flex items-center gap-1.5 ${config.text}`}>
              <StatusIcon size={14} />
              {config.label}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-100">{data.health_score}%</div>
          <div className="text-xs text-slate-400">Health Score</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-lg font-semibold text-amber-300">{data.pending}</div>
          <div className="text-xs text-slate-400">Pending</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-lg font-semibold text-emerald-300">{data.resolved}</div>
          <div className="text-xs text-slate-400">Resolved</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-lg font-semibold text-slate-200">{data.total_routed}</div>
          <div className="text-xs text-slate-400">Total</div>
        </div>
      </div>

      {/* Recent Items */}
      {data.recent_items.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Recent Activity</div>
          <div className="space-y-1">
            {data.recent_items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 rounded bg-slate-800/30 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    item.status === 'done' ? 'bg-emerald-900/50 text-emerald-300' :
                    item.status === 'pending' ? 'bg-amber-900/50 text-amber-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {item.status}
                  </span>
                  <span className="text-slate-300 truncate">
                    {item.event_subject || item.channel || 'Item'}
                  </span>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                  {formatRelativeTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PMStatusCard;
