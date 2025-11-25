'use client';

/**
 * Agent Bus Log Component
 *
 * Displays inter-agent messages from the agent bus.
 * Read-only view with filtering by agent, priority, and category.
 */

import { useState, useEffect, useCallback } from 'react';

// Types matching lib/agent_bus.ts
type AgentId =
  | 'pm-agent'
  | 'legal-agent'
  | 'finance-agent'
  | 'comms-agent'
  | 'health-agent'
  | 'orchestrator'
  | 'user';

type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

type MessageCategory =
  | 'task'
  | 'alert'
  | 'request'
  | 'response'
  | 'status'
  | 'decision'
  | 'escalation';

interface AgentMessage {
  id: string;
  timestamp: number;
  from: AgentId;
  to: AgentId | AgentId[] | 'broadcast';
  category: MessageCategory;
  priority: MessagePriority;
  subject: string;
  body: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  context?: {
    project?: string;
    domain?: string;
    entity_id?: string;
    entity_type?: string;
    action_required?: boolean;
    deadline?: number;
  };
  metadata?: Record<string, unknown>;
  read: boolean;
  acknowledged: boolean;
  response_to?: string;
}

interface BusStats {
  total_messages: number;
  unread_count: number;
  by_agent: Record<AgentId, number>;
  by_category: Record<MessageCategory, number>;
}

// Agent display config
const AGENT_CONFIG: Record<AgentId, { label: string; color: string; icon: string }> = {
  'pm-agent': { label: 'PM', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '📋' },
  'legal-agent': { label: 'Legal', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⚖️' },
  'finance-agent': { label: 'Finance', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '💰' },
  'comms-agent': { label: 'Comms', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200', icon: '📧' },
  'health-agent': { label: 'Health', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: '❤️' },
  'orchestrator': { label: 'Orch', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: '🎯' },
  'user': { label: 'User', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: '👤' },
};

const PRIORITY_CONFIG: Record<MessagePriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-500 dark:text-gray-400' },
  normal: { label: 'Normal', color: 'text-blue-600 dark:text-blue-400' },
  high: { label: 'High', color: 'text-orange-600 dark:text-orange-400' },
  critical: { label: 'Critical', color: 'text-red-600 dark:text-red-400 font-bold' },
};

const CATEGORY_CONFIG: Record<MessageCategory, { label: string; icon: string }> = {
  task: { label: 'Task', icon: '✓' },
  alert: { label: 'Alert', icon: '!' },
  request: { label: 'Request', icon: '?' },
  response: { label: 'Response', icon: '↩' },
  status: { label: 'Status', icon: '●' },
  decision: { label: 'Decision', icon: '⚡' },
  escalation: { label: 'Escalation', icon: '⬆' },
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

function formatRecipient(to: AgentId | AgentId[] | 'broadcast'): string {
  if (to === 'broadcast') return 'All';
  if (Array.isArray(to)) return to.map((a) => AGENT_CONFIG[a]?.label || a).join(', ');
  return AGENT_CONFIG[to]?.label || to;
}

interface MessageRowProps {
  message: AgentMessage;
  onMarkRead?: (id: string) => void;
  onAcknowledge?: (id: string) => void;
}

function MessageRow({ message, onMarkRead, onAcknowledge }: MessageRowProps) {
  const [expanded, setExpanded] = useState(false);
  const fromConfig = AGENT_CONFIG[message.from];
  const priorityConfig = PRIORITY_CONFIG[message.priority];
  const categoryConfig = CATEGORY_CONFIG[message.category];

  return (
    <div
      className={`border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
        !message.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
      }`}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Unread indicator */}
        <div className="w-2 flex-shrink-0">
          {!message.read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
        </div>

        {/* From agent */}
        <span className={`px-2 py-0.5 text-xs rounded ${fromConfig.color} flex-shrink-0`}>
          {fromConfig.icon} {fromConfig.label}
        </span>

        {/* Arrow */}
        <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">→</span>

        {/* To agent(s) */}
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 w-16">
          {formatRecipient(message.to)}
        </span>

        {/* Category icon */}
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0" title={categoryConfig.label}>
          {categoryConfig.icon}
        </span>

        {/* Subject */}
        <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate font-medium">
          {message.subject}
        </span>

        {/* Priority */}
        <span className={`text-xs ${priorityConfig.color} flex-shrink-0`}>{message.priority}</span>

        {/* Confidence */}
        <span
          className={`text-xs flex-shrink-0 ${
            message.confidence < 0.8 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {Math.round(message.confidence * 100)}%
        </span>

        {/* Timestamp */}
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 w-16 text-right">
          {formatTimestamp(message.timestamp)}
        </span>

        {/* Expand indicator */}
        <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{expanded ? '▼' : '▶'}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-6 border-l-2 border-gray-200 dark:border-gray-600">
          {/* Body */}
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">{message.body}</p>

          {/* Context */}
          {message.context && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.context.project && (
                <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  Project: {message.context.project}
                </span>
              )}
              {message.context.domain && (
                <span className="px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  Domain: {message.context.domain}
                </span>
              )}
              {message.context.action_required && (
                <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  Action Required
                </span>
              )}
              {message.context.deadline && (
                <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Due: {formatTimestamp(message.context.deadline)}
                </span>
              )}
            </div>
          )}

          {/* Metadata row */}
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>
              Impact: <span className={message.impact === 'high' ? 'text-red-500' : ''}>{message.impact}</span> |
              Category: {categoryConfig.label} | ID: {message.id.slice(0, 8)}
            </span>

            {/* Actions */}
            <div className="flex gap-2">
              {!message.read && onMarkRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(message.id);
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                >
                  Mark Read
                </button>
              )}
              {!message.acknowledged && onAcknowledge && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge(message.id);
                  }}
                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 rounded"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AgentBusLogProps {
  agentFilter?: AgentId;
  limit?: number;
}

export function AgentBusLog({ agentFilter, limit = 50 }: AgentBusLogProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [stats, setStats] = useState<BusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAgent, setFilterAgent] = useState<AgentId | 'all'>(agentFilter || 'all');
  const [filterPriority, setFilterPriority] = useState<MessagePriority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<MessageCategory | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterAgent !== 'all') params.set('agent', filterAgent);
      if (filterPriority !== 'all') params.set('priority', filterPriority);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (showUnreadOnly) params.set('unread', 'true');

      const res = await fetch(`/api/pm/agent-bus?${params}`);
      if (!res.ok) throw new Error('Failed to load messages');

      const data = await res.json();
      setMessages(data.messages || []);
      setStats(data.stats || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit, filterAgent, filterPriority, filterCategory, showUnreadOnly]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/pm/agent-bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', messageId: id }),
      });
      loadMessages();
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await fetch('/api/pm/agent-bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', messageId: id }),
      });
      loadMessages();
    } catch (e) {
      console.error('Failed to acknowledge:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/pm/agent-bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      loadMessages();
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const handleSeedMessages = async () => {
    try {
      await fetch('/api/pm/agent-bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      loadMessages();
    } catch (e) {
      console.error('Failed to seed messages:', e);
    }
  };

  // Filter messages locally if API doesn't support all filters
  const filteredMessages = messages.filter((msg) => {
    if (filterAgent !== 'all' && msg.from !== filterAgent && msg.to !== filterAgent) return false;
    if (filterPriority !== 'all' && msg.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && msg.category !== filterCategory) return false;
    if (showUnreadOnly && msg.read) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Agent Bus</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats ? `${stats.unread_count} unread of ${stats.total_messages}` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeedMessages}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md"
          >
            Seed Demo
          </button>
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md"
          >
            Mark All Read
          </button>
          <button
            onClick={loadMessages}
            className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {/* Agent filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Agent:</label>
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value as AgentId | 'all')}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
          >
            <option value="all">All</option>
            {Object.entries(AGENT_CONFIG).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Priority:</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as MessagePriority | 'all')}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
          >
            <option value="all">All</option>
            {Object.entries(PRIORITY_CONFIG).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Category:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as MessageCategory | 'all')}
            className="text-sm border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
          >
            <option value="all">All</option>
            {Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Unread only toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">Unread only</span>
        </label>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 items-center">
                <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
              </div>
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No messages</p>
            <p className="text-sm mt-1">Click "Seed Demo" to add example messages</p>
          </div>
        ) : (
          <div>
            {filteredMessages.map((msg) => (
              <MessageRow key={msg.id} message={msg} onMarkRead={handleMarkRead} onAcknowledge={handleAcknowledge} />
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {stats && !loading && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>By agent:</span>
            {Object.entries(stats.by_agent).map(([agent, count]) => (
              <span key={agent} className="flex items-center gap-1">
                <span className={`px-1.5 py-0.5 rounded ${AGENT_CONFIG[agent as AgentId]?.color || ''}`}>
                  {AGENT_CONFIG[agent as AgentId]?.label || agent}
                </span>
                <span>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentBusLog;
