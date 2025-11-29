'use client';

/**
 * Hyro Education Agent Card
 *
 * Displays Hyro agent status and daily recommendations.
 * Can be used in Roster page or Inbox for quick overview.
 */

import { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Clock, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import type { HyroAgentStatus } from '@/lib/hyro/types';

interface HyroCardProps {
  compact?: boolean;
}

const STATUS_CONFIG = {
  green: {
    label: 'On Track',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: CheckCircle,
  },
  yellow: {
    label: 'Needs Attention',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: Clock,
  },
  red: {
    label: 'Inactive',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    icon: AlertCircle,
  },
};

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHrs < 1) return 'just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

export function HyroCard({ compact = false }: HyroCardProps) {
  const [data, setData] = useState<HyroAgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/hyro/status');
        if (!res.ok) throw new Error('Failed to fetch Hyro status');
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
    const interval = setInterval(fetchStatus, 60000); // Refresh every minute
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
          <span className="text-sm">Hyro Status unavailable</span>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[data.status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${config.border} ${config.bg}`}>
        <BookOpen size={16} className={config.text} />
        <span className="text-sm font-medium text-slate-200">Hyro</span>
        <span className={`text-xs ${config.text}`}>{config.label}</span>
        {data.recommendations_today > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-slate-800 text-slate-300">
            {data.recommendations_today} today
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
            <BookOpen size={24} />
          </div>
          <div>
            <div className="font-semibold text-slate-100">Hyro Education</div>
            <div className={`text-sm flex items-center gap-1.5 ${config.text}`}>
              <StatusIcon size={14} />
              {config.label}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-100">{data.health_score}%</div>
          <div className="text-xs text-slate-400">Health</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-lg font-semibold text-amber-300">{data.pending_items}</div>
          <div className="text-xs text-slate-400">Pending</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-lg font-semibold text-cyan-300">{data.recommendations_today}</div>
          <div className="text-xs text-slate-400">Today</div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="text-lg font-semibold text-emerald-300">{data.items_completed_today}</div>
          <div className="text-xs text-slate-400">Done</div>
        </div>
      </div>

      {/* Sources Status */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Zap size={14} className="text-sky-400" />
          <span>Sources:</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-medium">{data.active_sources}</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">{data.total_sources}</span>
        </div>
      </div>

      {/* Recent Activity */}
      {data.recent_items.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp size={12} />
            Recent Activity
          </div>
          <div className="space-y-1">
            {data.recent_items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 rounded bg-slate-800/30 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    item.status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' :
                    item.status === 'in_progress' ? 'bg-cyan-900/50 text-cyan-300' :
                    item.status === 'pending' ? 'bg-amber-900/50 text-amber-300' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {item.status}
                  </span>
                  <span className="text-slate-300 truncate">
                    {item.title.slice(0, 30)}{item.title.length > 30 ? '...' : ''}
                  </span>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                  {formatRelativeTime(new Date(item.updated_at * 1000).toISOString())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer - Last Sync */}
      <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          Last sync: {formatRelativeTime(data.last_sync)}
        </div>
        <a
          href="/hyro"
          className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
        >
          View All →
        </a>
      </div>
    </div>
  );
}

export default HyroCard;
