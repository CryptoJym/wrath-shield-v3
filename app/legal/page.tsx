"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader,
  Bell,
  Check,
  X,
  AlertTriangle,
  Clock,
  FileText,
  Mail,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  MessageSquare,
  Scale,
  Gavel,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type LegalRequest = {
  id: string;
  case_number?: string;
  contact?: string;
  topic?: string;
  source?: string;
  summary?: string;
  status: "pending" | "resolved";
  confidence?: number;
  due_date?: string;
  action?: string;
  rationale?: string;
  attachments?: string[];
  created_at?: string;
};

type PendingAction = {
  id: string;
  case_number?: string;
  action_type: string;
  title: string;
  description?: string;
  payload?: any;
  status: "pending" | "approved" | "rejected" | "executed";
  priority: "low" | "normal" | "high" | "urgent";
  requires_approval: boolean;
  created_at?: string;
};

type Notification = {
  id: string;
  case_number?: string;
  notification_type: string;
  title: string;
  message?: string;
  severity: "info" | "warning" | "urgent" | "critical";
  read: boolean;
  created_at?: string;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: any;
};

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "queue" | "actions">("chat");
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: requestsData, mutate: mutateRequests } = useSWR<{ requests: LegalRequest[] }>(
    "/api/legal/context-requests",
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: actionsData, mutate: mutateActions } = useSWR<{ actions: PendingAction[] }>(
    "/api/legal/actions",
    fetcher,
    { refreshInterval: 15000 }
  );

  const { data: notifData, mutate: mutateNotifs } = useSWR<{ notifications: Notification[]; unread: number }>(
    "/api/legal/notifications",
    fetcher,
    { refreshInterval: 10000 }
  );

  const pendingRequests = useMemo(() => requestsData?.requests || [], [requestsData]);
  const pendingActions = useMemo(
    () => (actionsData?.actions || []).filter((a) => a.status === "pending"),
    [actionsData]
  );
  const notifications = useMemo(() => notifData?.notifications || [], [notifData]);
  const unreadCount = notifData?.unread || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Scale className="w-8 h-8 text-indigo-400" />
              <h1 className="text-2xl font-semibold">Legal Advocate</h1>
            </div>
            <p className="text-sm text-slate-400">
              AI-assisted legal case management with action approval
            </p>
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-medium">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <NotificationPanel
                  notifications={notifications}
                  onClose={() => setShowNotifications(false)}
                  onDismiss={async (id) => {
                    await fetch("/api/legal/notifications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "dismiss", id }),
                    });
                    mutateNotifs();
                  }}
                  onMarkRead={async (id) => {
                    await fetch("/api/legal/notifications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "read", id }),
                    });
                    mutateNotifs();
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <TabButton
            active={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
            icon={<MessageSquare className="w-4 h-4" />}
            label="AI Chat"
          />
          <TabButton
            active={activeTab === "queue"}
            onClick={() => setActiveTab("queue")}
            icon={<FileText className="w-4 h-4" />}
            label="Context Queue"
            badge={pendingRequests.length}
          />
          <TabButton
            active={activeTab === "actions"}
            onClick={() => setActiveTab("actions")}
            icon={<Gavel className="w-4 h-4" />}
            label="Pending Actions"
            badge={pendingActions.length}
            badgeColor="amber"
          />
        </div>

        {/* Content */}
        <div className="min-h-[600px]">
          {activeTab === "chat" && <LegalChatPanel onActionCreated={() => mutateActions()} />}
          {activeTab === "queue" && (
            <ContextQueuePanel requests={pendingRequests} mutate={mutateRequests} />
          )}
          {activeTab === "actions" && (
            <ActionsPanel
              actions={actionsData?.actions || []}
              mutate={mutateActions}
              onNotify={() => mutateNotifs()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = "indigo",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: "indigo" | "amber" | "red";
}) {
  const badgeColors = {
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${badgeColors[badgeColor]} text-white`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ============ Legal Chat Panel ============

function LegalChatPanel({ onActionCreated }: { onActionCreated: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/legal/chat")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const resp = await fetch("/api/legal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history: messages }),
      });

      if (!resp.ok) throw new Error("Chat failed");

      const data = await resp.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply || data.message || "No response",
        metadata: data.metadata,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Check if any actions were created
      if (data.actionsCreated) {
        onActionCreated();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err?.message || "Unknown error"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    await fetch("/api/legal/chat", { method: "DELETE" });
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[600px] rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
      {/* Chat Messages */}
      <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Legal Advocate AI</p>
            <p className="text-sm mt-2">
              Ask questions about your case, draft emails, or request actions.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "Summarize the 10/21 Order",
                "Draft email to Zack about CS modification",
                "What are my next steps?",
                "Review July violations",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-1.5 text-xs rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessageBubble key={idx} message={msg} isStreaming={isStreaming && idx === messages.length - 1} />
        ))}

        {isLoading && !isStreaming && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your case or request an action..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            rows={2}
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Enter to send | Shift+Enter for newline | Try: "Create action to email Zack"
        </p>
      </div>
    </div>
  );
}

function ChatMessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-slate-800 text-slate-100 border border-slate-700"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
            <Scale className="w-3 h-3" />
            <span>Legal Advocate</span>
            {isStreaming && <Loader className="w-3 h-3 animate-spin" />}
          </div>
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.metadata?.actionCreated && (
          <div className="mt-2 pt-2 border-t border-slate-600 text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Action created - awaiting approval
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============ Context Queue Panel ============

function ContextQueuePanel({
  requests,
  mutate,
}: {
  requests: LegalRequest[];
  mutate: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = async () => {
    setRefreshing(true);
    await fetch("/api/legal/refresh", { method: "POST" }).catch(() => undefined);
    await mutate();
    setRefreshing(false);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pending Context Requests</h2>
          <p className="text-sm text-slate-400">
            Items requiring review, action, or response
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => mutate()}
            className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Reload
          </button>
          <button
            onClick={triggerRefresh}
            disabled={refreshing}
            className="text-xs px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync External"}
          </button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No pending items</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-auto">
          {requests.map((r) => (
            <ContextItem key={r.id} r={r} mutate={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContextItem({ r, mutate }: { r: LegalRequest; mutate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState(r.summary || "");
  const [action, setAction] = useState(r.action || "");
  const [saving, setSaving] = useState(false);

  const resolve = async () => {
    setSaving(true);
    await fetch("/api/legal/context-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal: true,
        id: r.id,
        summary,
        action: action || undefined,
        status: "resolved",
      }),
    });
    setSaving(false);
    mutate();
  };

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            {r.source === "court_pdf" ? (
              <Gavel className="w-4 h-4 text-indigo-400" />
            ) : r.source?.includes("email") ? (
              <Mail className="w-4 h-4 text-amber-400" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div>
            <div className="font-medium text-sm">{r.topic || "Item"}</div>
            <div className="text-xs text-slate-500">
              {r.contact && <span>{r.contact}</span>}
              {r.due_date && <span className="ml-2 text-amber-400">Due: {r.due_date}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {r.confidence && r.confidence > 0.8 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              High confidence
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-800"
          >
            <div className="p-4 space-y-3">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summary / what is needed"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 text-sm text-slate-100 placeholder:text-slate-500 resize-none"
                rows={3}
              />
              <input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="Action to take"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={resolve}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Mark Resolved
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Actions Panel ============

function ActionsPanel({
  actions,
  mutate,
  onNotify,
}: {
  actions: PendingAction[];
  mutate: () => void;
  onNotify: () => void;
}) {
  const pending = actions.filter((a) => a.status === "pending");
  const approved = actions.filter((a) => a.status === "approved");
  const executed = actions.filter((a) => a.status === "executed");
  const rejected = actions.filter((a) => a.status === "rejected");

  const handleAction = async (id: string, newStatus: "approved" | "rejected") => {
    await fetch("/api/legal/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    mutate();
    onNotify();
  };

  const executeAction = async (id: string) => {
    await fetch("/api/legal/actions/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
    onNotify();
  };

  return (
    <div className="space-y-6">
      {/* Pending Actions */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-400" />
          Pending Approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No actions awaiting approval</p>
        ) : (
          <div className="space-y-3">
            {pending.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={() => handleAction(action.id, "approved")}
                onReject={() => handleAction(action.id, "rejected")}
              />
            ))}
          </div>
        )}
      </div>

      {/* Approved Actions */}
      {approved.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Approved - Ready to Execute ({approved.length})
          </h2>
          <div className="space-y-3">
            {approved.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onExecute={() => executeAction(action.id)}
                showExecute
              />
            ))}
          </div>
        </div>
      )}

      {/* Executed Actions */}
      {executed.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-400">
            <Check className="w-5 h-5" />
            Completed ({executed.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {executed.slice(0, 5).map((action) => (
              <div key={action.id} className="text-sm text-slate-400 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                {action.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({
  action,
  onApprove,
  onReject,
  onExecute,
  showExecute,
}: {
  action: PendingAction;
  onApprove?: () => void;
  onReject?: () => void;
  onExecute?: () => void;
  showExecute?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const priorityColors = {
    low: "bg-slate-500/20 text-slate-400",
    normal: "bg-blue-500/20 text-blue-400",
    high: "bg-amber-500/20 text-amber-400",
    urgent: "bg-red-500/20 text-red-400",
  };

  const actionTypeIcons: Record<string, React.ReactNode> = {
    email_draft: <Mail className="w-4 h-4" />,
    file_motion: <FileText className="w-4 h-4" />,
    schedule_hearing: <Calendar className="w-4 h-4" />,
    send_document: <FileText className="w-4 h-4" />,
    other: <Gavel className="w-4 h-4" />,
  };

  return (
    <div className="border border-slate-700 rounded-xl bg-slate-900/80 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              {actionTypeIcons[action.action_type] || <Gavel className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-medium">{action.title}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full ${priorityColors[action.priority]}`}>
                  {action.priority}
                </span>
                <span>{action.action_type.replace("_", " ")}</span>
              </div>
            </div>
          </div>

          {action.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={onApprove}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                title="Approve"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={onReject}
                className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                title="Reject"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {showExecute && (
            <button
              onClick={onExecute}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Execute
            </button>
          )}
        </div>

        {action.description && (
          <p className="mt-3 text-sm text-slate-400">{action.description}</p>
        )}

        {action.payload && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            {expanded ? "Hide" : "Show"} details
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && action.payload && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="border-t border-slate-700 overflow-hidden"
          >
            <pre className="p-4 text-xs text-slate-400 overflow-auto max-h-48">
              {JSON.stringify(action.payload, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Notification Panel ============

function NotificationPanel({
  notifications,
  onClose,
  onDismiss,
  onMarkRead,
}: {
  notifications: Notification[];
  onClose: () => void;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const severityColors = {
    info: "border-l-blue-500",
    warning: "border-l-amber-500",
    urgent: "border-l-orange-500",
    critical: "border-l-red-500",
  };

  const severityIcons = {
    info: <Bell className="w-4 h-4 text-blue-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    urgent: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    critical: <AlertTriangle className="w-4 h-4 text-red-400" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl z-50"
    >
      <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-3 flex items-center justify-between">
        <span className="font-medium text-sm">Notifications</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="p-6 text-center text-slate-500 text-sm">No notifications</div>
      ) : (
        <div className="divide-y divide-slate-800">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 border-l-4 ${severityColors[n.severity]} ${
                n.read ? "opacity-60" : ""
              } hover:bg-slate-800/50 transition-colors`}
              onClick={() => !n.read && onMarkRead(n.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {severityIcons[n.severity]}
                  <div>
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.message && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{n.message}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(n.id);
                  }}
                  className="text-slate-500 hover:text-slate-300 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
