'use client';

/**
 * Unified Action Lane
 *
 * A single-column feed of actionable items from all sources:
 * - Emails (Gmail, Outlook)
 * - Messages (iMessage)
 * - Lifelogs (Limitless)
 * - Conversations (LLM chats)
 * - Contacts
 * - Tasks/Projects
 *
 * Each item supports:
 * - Edit (modify before action)
 * - Cancel (dismiss)
 * - Delay (snooze for later)
 * - Delegate (assign to someone else)
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Mail,
  MessageCircle,
  Calendar,
  User,
  Brain,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Edit3,
  Pause,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Action item from any source
interface ActionItem {
  id: string;
  source: 'email' | 'imessage' | 'lifelog' | 'llm_chat' | 'contact' | 'task';
  title: string;
  preview: string;
  contact?: string;
  contactEmail?: string;
  contactId?: string;
  contactDisplayName?: string;
  contactHandle?: string;
  timestamp: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done' | 'dismissed' | 'snoozed' | 'delegated';
  suggestedAction?: {
    type: string;
    description: string;
    confidence: number;
  };
  project?: string;
  metadata?: Record<string, unknown>;
}

interface ActionControlsProps {
  item: ActionItem;
  onEdit: () => void;
  onCancel: () => void;
  onDelay: () => void;
  onDelegate: () => void;
  onApprove: () => void;
  loading?: boolean;
}

function ActionControls({ item, onEdit, onCancel, onDelay, onDelegate, onApprove, loading }: ActionControlsProps) {
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
      {item.suggestedAction && (
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Execute
        </button>
      )}
      <button
        onClick={onEdit}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition disabled:opacity-50"
      >
        <Edit3 size={14} />
        Edit
      </button>
      <button
        onClick={onDelay}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 text-sm rounded-lg transition disabled:opacity-50"
      >
        <Pause size={14} />
        Delay
      </button>
      <button
        onClick={onDelegate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-900/50 hover:bg-sky-800/50 text-sky-300 text-sm rounded-lg transition disabled:opacity-50"
      >
        <UserPlus size={14} />
        Delegate
      </button>
      <button
        onClick={onCancel}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/50 hover:bg-rose-800/50 text-rose-300 text-sm rounded-lg transition disabled:opacity-50"
      >
        <XCircle size={14} />
        Dismiss
      </button>
    </div>
  );
}

interface ActionCardProps {
  item: ActionItem;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: 'edit' | 'cancel' | 'delay' | 'delegate' | 'approve', item: ActionItem) => void;
  loading?: boolean;
}

function ActionCard({ item, expanded, onToggle, onAction, loading }: ActionCardProps) {
  const sourceConfig = {
    email: { icon: Mail, color: 'text-sky-400', bg: 'bg-sky-900/30', border: 'border-sky-500/30', label: 'Email' },
    imessage: { icon: MessageCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-500/30', label: 'iMessage' },
    lifelog: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-500/30', label: 'Lifelog' },
    llm_chat: { icon: Sparkles, color: 'text-fuchsia-400', bg: 'bg-fuchsia-900/30', border: 'border-fuchsia-500/30', label: 'LLM Chat' },
    contact: { icon: User, color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-500/30', label: 'Contact' },
    task: { icon: CheckCircle, color: 'text-slate-400', bg: 'bg-slate-800/50', border: 'border-slate-600/30', label: 'Task' },
  };

  const urgencyColors = {
    critical: 'bg-rose-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-slate-500',
  };

  const config = sourceConfig[item.source];
  const Icon = config.icon;

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'just now';
  };

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 transition-all ${expanded ? 'ring-2 ring-sky-500/50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Source Icon */}
        <div className={`p-2 rounded-lg ${config.bg} border ${config.border}`}>
          <Icon size={20} className={config.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
              {config.label}
            </span>
            <div className={`w-2 h-2 rounded-full ${urgencyColors[item.urgency]}`} title={`${item.urgency} urgency`} />
            <span className="text-xs text-slate-500">{timeAgo(item.timestamp)}</span>
            {item.project && (
              <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">
                {item.project}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-slate-100 font-medium mb-1 truncate">{item.title}</h3>

          {/* Contact if present */}
          {(item.contact || item.contactDisplayName) && (
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
              <User size={14} className="text-slate-500" />
              <span className="text-slate-500">From:</span>
              {item.contactId ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-200 font-medium">{item.contactDisplayName || item.contact}</span>
                  {item.contactHandle && item.contactHandle !== item.contactDisplayName && (
                    <span className="text-slate-600 text-xs">({item.contactHandle})</span>
                  )}
                </span>
              ) : (
                <span>{item.contact}</span>
              )}
              {item.contactEmail && !item.contactHandle?.includes('@') && (
                <span className="text-slate-600 text-xs">({item.contactEmail})</span>
              )}
            </div>
          )}

          {/* Preview */}
          <p className={`text-sm text-slate-400 ${expanded ? '' : 'line-clamp-2'}`}>
            {item.preview}
          </p>

          {/* Suggested Action */}
          {item.suggestedAction && (
            <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-fuchsia-400" />
                <span className="text-sm font-medium text-slate-200">Suggested Action</span>
                <span className="text-xs text-slate-500">
                  ({Math.round(item.suggestedAction.confidence * 100)}% confidence)
                </span>
              </div>
              <p className="text-sm text-slate-400">{item.suggestedAction.description}</p>
            </div>
          )}

          {/* Expanded Content */}
          {expanded && (
            <ActionControls
              item={item}
              onEdit={() => onAction('edit', item)}
              onCancel={() => onAction('cancel', item)}
              onDelay={() => onAction('delay', item)}
              onDelegate={() => onAction('delegate', item)}
              onApprove={() => onAction('approve', item)}
              loading={loading}
            />
          )}
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-slate-700/50 transition"
        >
          {expanded ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </button>
      </div>
    </div>
  );
}

interface LLMPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (conversation: string) => void;
}

function LLMPasteModal({ isOpen, onClose, onSubmit }: LLMPasteModalProps) {
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setProcessing(true);
    await onSubmit(text);
    setProcessing(false);
    setText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Sparkles className="text-fuchsia-400" />
          Paste LLM Conversation
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Paste a conversation with an LLM and we'll analyze it to extract action items, decisions, and follow-ups.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your LLM conversation here..."
          className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 resize-none"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || processing}
            className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Process Conversation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function AgentChatPanel({ isOpen, onClose }: AgentChatPanelProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || sending) return;

    const userMessage = message;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessage('');
    setSending(true);

    try {
      const res = await fetch('/api/pm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'No response' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error processing message' }]);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-sky-400" size={20} />
          <span className="font-medium text-slate-100">PM Agent Chat</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <XCircle size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            Ask the PM agent about tasks, priorities, or actions.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 p-3 rounded-lg text-sm border border-slate-700">
              <Loader2 size={14} className="animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask the PM agent..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnifiedActionLane() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'email' | 'imessage' | 'lifelog' | 'llm_chat' | 'task'>('all');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch unified action items
  const { data, error, isLoading, mutate } = useSWR<{ ok: boolean; items: ActionItem[] }>(
    '/api/pm/unified',
    fetcher,
    { refreshInterval: 30000 }
  );

  const items = data?.items || [];
  const filteredItems = filter === 'all' ? items : items.filter(i => i.source === filter);

  const handleAction = useCallback(async (action: 'edit' | 'cancel' | 'delay' | 'delegate' | 'approve', item: ActionItem) => {
    setActionLoading(item.id);

    try {
      await fetch('/api/pm/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, itemId: item.id }),
      });
      mutate();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [mutate]);

  const handleLLMPaste = useCallback(async (conversation: string) => {
    try {
      await fetch('/api/pm/llm-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation }),
      });
      mutate();
    } catch (err) {
      console.error('LLM paste failed:', err);
    }
  }, [mutate]);

  const sourceCounts = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Action Lane</h2>
          <p className="text-sm text-slate-400 mt-1">
            {items.length} items requiring attention
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-900/50 hover:bg-fuchsia-800/50 text-fuchsia-300 border border-fuchsia-500/30 rounded-lg transition"
          >
            <Sparkles size={18} />
            Paste LLM Chat
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-900/50 hover:bg-sky-800/50 text-sky-300 border border-sky-500/30 rounded-lg transition"
          >
            <MessageSquare size={18} />
            Agent Chat
          </button>
          <button
            onClick={() => mutate()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All', count: items.length },
          { key: 'email', label: 'Email', count: sourceCounts.email || 0 },
          { key: 'imessage', label: 'Messages', count: sourceCounts.imessage || 0 },
          { key: 'lifelog', label: 'Lifelogs', count: sourceCounts.lifelog || 0 },
          { key: 'llm_chat', label: 'LLM Chats', count: sourceCounts.llm_chat || 0 },
          { key: 'task', label: 'Tasks', count: sourceCounts.task || 0 },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.key
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-slate-700/50 rounded text-xs">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-slate-500" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-900/10 p-6 text-center">
          <p className="text-rose-300">Failed to load action items</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredItems.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-200 mb-2">All Clear!</h3>
          <p className="text-slate-400">No pending actions at the moment.</p>
        </div>
      )}

      {/* Action Items */}
      <div className="space-y-3">
        {filteredItems.map(item => (
          <ActionCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onAction={handleAction}
            loading={actionLoading === item.id}
          />
        ))}
      </div>

      {/* Modals */}
      <LLMPasteModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onSubmit={handleLLMPaste}
      />

      <AgentChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />
    </div>
  );
}
