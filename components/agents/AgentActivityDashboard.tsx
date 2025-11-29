"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Cpu,
  MessageSquare,
} from 'lucide-react';

/**
 * Agent activity record from the API
 */
interface AgentActivity {
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
}

interface ActivityStats {
  total: number;
  byAgent: Record<string, number>;
  byEscalation: Record<string, number>;
  avgLatency: number;
  totalTokens: number;
  executionRate: number;
}

interface AgentActivityDashboardProps {
  className?: string;
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  agentFilter?: string;
}

/**
 * AgentActivityDashboard Component
 *
 * Displays real-time agent activity from the Life OS AgentInvoker.
 * Shows invocation history, latency metrics, token usage, and escalation patterns.
 */
export function AgentActivityDashboard({
  className = '',
  maxItems = 20,
  autoRefresh = true,
  refreshInterval = 15000,
  agentFilter,
}: AgentActivityDashboardProps) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>(agentFilter || 'all');
  const [selectedEscalation, setSelectedEscalation] = useState<string>('all');

  const fetchActivity = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', maxItems.toString());
      if (selectedAgent && selectedAgent !== 'all') {
        params.set('agentId', selectedAgent);
      }
      if (selectedEscalation && selectedEscalation !== 'all') {
        params.set('escalation', selectedEscalation);
      }

      const response = await fetch(`/api/agents/activity?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch activity: ${response.status}`);
      }
      const data = await response.json();
      setActivities(data.activity || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [maxItems, selectedAgent, selectedEscalation]);

  useEffect(() => {
    fetchActivity();

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchActivity, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchActivity, autoRefresh, refreshInterval]);

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLatency = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getEscalationIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'PROPOSE':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Zap className="w-4 h-4 text-green-500" />;
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

  const getAgentColor = (agentId: string): string => {
    const colors: Record<string, string> = {
      'agent.orchestrator': 'text-purple-600 dark:text-purple-400',
      'agent.legal': 'text-red-600 dark:text-red-400',
      'agent.finance': 'text-green-600 dark:text-green-400',
      'agent.pm': 'text-blue-600 dark:text-blue-400',
      'agent.comms': 'text-cyan-600 dark:text-cyan-400',
      'agent.health': 'text-pink-600 dark:text-pink-400',
      'agent.coaching': 'text-orange-600 dark:text-orange-400',
    };
    return colors[agentId] || 'text-gray-600 dark:text-gray-400';
  };

  const uniqueAgents = Array.from(new Set(activities.map((a) => a.agentId)));

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading activity...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Agent Activity</h3>
          {stats && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
              {stats.total} total
            </span>
          )}
        </div>
        <button
          onClick={() => fetchActivity()}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
              <Cpu className="w-3 h-3" />
              Avg Latency
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatLatency(stats.avgLatency)}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
              <MessageSquare className="w-3 h-3" />
              Total Tokens
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {stats.totalTokens.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
              <CheckCircle className="w-3 h-3" />
              Exec Rate
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {(stats.executionRate * 100).toFixed(0)}%
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
              <BarChart3 className="w-3 h-3" />
              Invocations
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {stats.total}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent.replace('agent.', '')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedEscalation}
            onChange={(e) => setSelectedEscalation(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="PROPOSE">Propose</option>
            <option value="AUTO_EXECUTE">Auto Execute</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 m-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {activities.length === 0 && !error && (
        <div className="p-8 text-center">
          <Activity className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">No agent activity recorded</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            Activity will appear here when agents are invoked
          </p>
        </div>
      )}

      {/* Activity list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {activities.map((item) => (
          <div key={item.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-900/30">
            {/* Item header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {getEscalationIcon(item.escalationLevel)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${getAgentColor(item.agentId)}`}>
                      {item.agentId.replace('agent.', '')}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${getEscalationBadge(item.escalationLevel)}`}>
                      {item.escalationLevel}
                    </span>
                    {item.wasExecuted ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-gray-400" />
                    )}
                    {item.domainId && (
                      <span className="text-xs text-gray-500">
                        {item.domainId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
                    {item.input.substring(0, 100)}...
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{formatTimestamp(item.timestamp)}</span>
                    <span>{formatLatency(item.latencyMs)}</span>
                    <span>{item.tokensUsed} tokens</span>
                    <span className="text-gray-400">{item.model}</span>
                  </div>
                </div>
              </div>

              {/* Expand button */}
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
              <div className="mt-3 pl-7 space-y-2">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Input</div>
                  <div className="p-2 rounded bg-gray-100 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {item.input}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Output</div>
                  <div className="p-2 rounded bg-gray-100 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {item.output}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Request ID: {item.requestId}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentActivityDashboard;
