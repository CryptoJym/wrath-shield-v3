'use client';

/**
 * CouncilActivityPanel Component
 *
 * Shows what the PM council did autonomously (AUTO escalation level).
 * Provides transparency into automated decisions.
 *
 * Features:
 * - Collapsible action list
 * - Summary statistics
 * - Filter by action type
 * - Success/failure indicators
 * - Time-based display
 */

import { useState } from 'react';
import {
  Bot,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Filter,
  Github,
  ListTodo,
  GitCommit,
  FileText,
} from 'lucide-react';

export interface AutoAction {
  id: string;
  action_type: 'github_issue' | 'local_task' | 'commit_close' | 'sync' | 'other';
  description: string;
  result: 'success' | 'failed';
  timestamp: string; // ISO timestamp
  signal_source?: string;
  signal_type?: string;
  details?: Record<string, any>;
  entity_id?: string;
}

export interface CouncilActivityPanelProps {
  autoActions: AutoAction[];
  onViewDetails?: (action: AutoAction) => void;
  onRefresh?: () => void;
}

export function CouncilActivityPanel({
  autoActions,
  onViewDetails,
  onRefresh,
}: CouncilActivityPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const successCount = autoActions.filter(a => a.result === 'success').length;
  const failedCount = autoActions.filter(a => a.result === 'failed').length;

  const filteredActions = filterType === 'all'
    ? autoActions
    : autoActions.filter(a => a.action_type === filterType);

  const actionTypes = Array.from(new Set(autoActions.map(a => a.action_type)));

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'github_issue':
        return Github;
      case 'local_task':
        return ListTodo;
      case 'commit_close':
        return GitCommit;
      case 'sync':
        return FileText;
      default:
        return Bot;
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (hours > 24) {
      return `${Math.floor(hours / 24)}d ago`;
    }
    if (hours > 0) {
      return `${hours}h ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return 'just now';
  };

  if (autoActions.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-full bg-slate-800">
            <Bot size={32} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-400">No Autonomous Actions Yet</h3>
          <p className="text-sm text-slate-500">
            The council hasn't taken any automated actions recently
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-slate-950/20 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-600/20">
            <Bot size={24} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
              COUNCIL ACTIVITY
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-600 text-white font-bold">
                {autoActions.length}
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              {successCount} successful, {failedCount > 0 && `${failedCount} failed`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actionTypes.length > 1 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:border-slate-500"
            >
              <option value="all">All actions</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ')}</option>
              ))}
            </select>
          )}
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
          <div className="text-2xl font-bold text-emerald-400">{autoActions.length}</div>
          <div className="text-xs text-slate-500">Actions Taken</div>
        </div>
        <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-500/30">
          <div className="text-2xl font-bold text-emerald-300">{successCount}</div>
          <div className="text-xs text-slate-500">Successful</div>
        </div>
        {failedCount > 0 && (
          <div className="p-3 rounded-lg bg-rose-900/20 border border-rose-500/30">
            <div className="text-2xl font-bold text-rose-300">{failedCount}</div>
            <div className="text-xs text-slate-500">Failed</div>
          </div>
        )}
      </div>

      {/* Action List (Collapsible) */}
      <div className="space-y-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition"
        >
          <span className="text-sm text-slate-300 font-medium">
            {isExpanded ? 'Hide' : 'Show'} action details ({filteredActions.length})
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {isExpanded && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredActions.map((action) => {
              const ActionIcon = getActionIcon(action.action_type);
              const ResultIcon = action.result === 'success' ? CheckCircle : XCircle;

              return (
                <div
                  key={action.id}
                  className={`rounded-lg border p-3 transition cursor-pointer ${
                    action.result === 'success'
                      ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40'
                      : 'bg-rose-950/10 border-rose-500/20 hover:border-rose-500/40'
                  }`}
                  onClick={() => onViewDetails?.(action)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-1.5 rounded bg-slate-800/50 flex-shrink-0">
                        <ActionIcon size={16} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-slate-500 font-medium">
                            {action.action_type.replace('_', ' ')}
                          </span>
                          {action.signal_source && (
                            <span className="text-xs text-slate-600">
                              from {action.signal_source}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200 line-clamp-2">{action.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">
                        {getRelativeTime(action.timestamp)}
                      </span>
                      <ResultIcon
                        size={18}
                        className={action.result === 'success' ? 'text-emerald-400' : 'text-rose-400'}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View All Button */}
      {!isExpanded && filteredActions.length > 5 && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition"
        >
          View All {filteredActions.length} Actions
          <ChevronRight size={16} />
        </button>
      )}
    </section>
  );
}
