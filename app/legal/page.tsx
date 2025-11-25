"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader,
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
  MessageSquare,
  Scale,
  Gavel,
  AlertCircle,
  Lightbulb,
  Shield,
  User,
  Phone,
  ExternalLink,
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type BriefItem = {
  id: string;
  title: string;
  description: string;
  evidence: Array<{
    type: string;
    source: string;
    snippet: string;
    date?: string;
    dates?: string;
  }>;
  utahLawRef?: string;
  action: string;
  category: "urgent" | "opportunity" | "warning";
};

type DailyBrief = {
  generatedAt: string;
  caseNumber: string;
  nextHearing: { date: string; time: string } | null;
  urgent: BriefItem[];
  opportunities: BriefItem[];
  warnings: BriefItem[];
  summary: string;
  cached?: boolean;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: any;
};

export default function LegalPage() {
  const [showChat, setShowChat] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: briefData, mutate: mutateBrief, error: briefError } = useSWR<DailyBrief>(
    "/api/legal/advisor/brief",
    fetcher,
    { refreshInterval: 300000 } // 5 min refresh
  );

  const generateBrief = async () => {
    setIsGenerating(true);
    try {
      const resp = await fetch("/api/legal/advisor/brief", { method: "POST" });
      const data = await resp.json();
      mutateBrief(data, false);
    } catch (err) {
      console.error("Failed to generate brief:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate brief if not available
  useEffect(() => {
    if (briefData && !briefData.urgent && !briefData.summary && !isGenerating) {
      generateBrief();
    }
  }, [briefData]);

  const brief = briefData;
  const hasBrief = brief?.urgent || brief?.opportunities || brief?.warnings;

  // Calculate days until hearing
  const daysUntilHearing = useMemo(() => {
    if (!brief?.nextHearing?.date) return null;
    const hearingDate = new Date(brief.nextHearing.date.replace(/-/g, '/'));
    const today = new Date();
    const diff = Math.ceil((hearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [brief?.nextHearing]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header with Case Status */}
        <header className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/10 to-transparent rounded-3xl blur-xl" />
          <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Case Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Scale className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                      Legal Command Center
                    </h1>
                    {brief?.cached && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-400">
                        Cached
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 mt-1">
                    Case #{brief?.caseNumber || "164400524"} • Brady v. Hyte
                  </p>
                </div>
              </div>

              {/* Hearing Countdown */}
              {brief?.nextHearing && daysUntilHearing !== null && (
                <div className="flex items-center gap-4">
                  <div className={`px-6 py-4 rounded-2xl border ${
                    daysUntilHearing <= 7
                      ? 'bg-red-500/10 border-red-500/30'
                      : daysUntilHearing <= 14
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Calendar className={`w-6 h-6 ${
                        daysUntilHearing <= 7 ? 'text-red-400' :
                        daysUntilHearing <= 14 ? 'text-amber-400' : 'text-emerald-400'
                      }`} />
                      <div>
                        <div className="text-sm text-slate-400">Next Hearing</div>
                        <div className="text-lg font-semibold">
                          {brief.nextHearing.date} at {brief.nextHearing.time}
                        </div>
                        <div className={`text-sm font-medium ${
                          daysUntilHearing <= 7 ? 'text-red-400' :
                          daysUntilHearing <= 14 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {daysUntilHearing} days away
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={generateBrief}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? 'Generating...' : 'Refresh Brief'}
                </button>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                    showChat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  AI Chat
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Summary Banner */}
        {brief?.summary && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-indigo-400 mb-1">Daily Intelligence Summary</div>
                <p className="text-slate-300 text-sm leading-relaxed">{brief.summary}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Urgent & Warnings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Items */}
            {brief?.urgent && brief.urgent.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-red-400">Urgent Actions Required</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400">
                    {brief.urgent.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {brief.urgent.map((item) => (
                    <BriefCard key={item.id} item={item} variant="urgent" />
                  ))}
                </div>
              </section>
            )}

            {/* Warnings */}
            {brief?.warnings && brief.warnings.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-amber-400">Warnings & Risks</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                    {brief.warnings.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {brief.warnings.map((item) => (
                    <BriefCard key={item.id} item={item} variant="warning" />
                  ))}
                </div>
              </section>
            )}

            {/* Opportunities */}
            {brief?.opportunities && brief.opportunities.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-emerald-400">Strategic Opportunities</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                    {brief.opportunities.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {brief.opportunities.map((item) => (
                    <BriefCard key={item.id} item={item} variant="opportunity" />
                  ))}
                </div>
              </section>
            )}

            {/* Loading State */}
            {!hasBrief && !isGenerating && (
              <div className="bg-slate-900/70 rounded-2xl border border-slate-700/50 p-12 text-center">
                <Scale className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-semibold text-slate-400 mb-2">No Brief Available</h3>
                <p className="text-slate-500 mb-6">Generate a daily brief to see urgent items, warnings, and opportunities.</p>
                <button
                  onClick={generateBrief}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  Generate Daily Brief
                </button>
              </div>
            )}

            {isGenerating && (
              <div className="bg-slate-900/70 rounded-2xl border border-slate-700/50 p-12 text-center">
                <Loader className="w-12 h-12 mx-auto mb-4 text-indigo-400 animate-spin" />
                <h3 className="text-xl font-semibold text-slate-300 mb-2">Analyzing Case Data...</h3>
                <p className="text-slate-500">Reviewing emails, texts, and court filings for actionable insights.</p>
              </div>
            )}
          </div>

          {/* Right Column - Quick Stats & Chat */}
          <div className="space-y-6">
            {/* Key Contacts */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700/50 p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Key Contacts</h3>
              <div className="space-y-3">
                <ContactCard
                  name="Zachary Starr"
                  role="Attorney"
                  email="zstarr@moodybrown.com"
                  icon={<Gavel className="w-4 h-4" />}
                />
                <ContactCard
                  name="Destiny Hyte"
                  role="Opposing Party"
                  phone="+1 (XXX) XXX-XXXX"
                  icon={<User className="w-4 h-4" />}
                />
                <ContactCard
                  name="Judge Derek P. Pullan"
                  role="Presiding Judge"
                  icon={<Scale className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700/50 p-5">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickActionButton
                  label="MyCase Portal"
                  icon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => window.open('https://www.utcourts.gov/mycase/', '_blank')}
                />
                <QuickActionButton
                  label="Email Zack"
                  icon={<Mail className="w-4 h-4" />}
                  onClick={() => window.location.href = 'mailto:zstarr@moodybrown.com'}
                />
                <QuickActionButton
                  label="View Filings"
                  icon={<FileText className="w-4 h-4" />}
                  onClick={() => {}}
                />
                <QuickActionButton
                  label="Case Timeline"
                  icon={<Clock className="w-4 h-4" />}
                  onClick={() => {}}
                />
              </div>
            </div>

            {/* Brief Generation Info */}
            {brief?.generatedAt && (
              <div className="bg-slate-900/70 rounded-2xl border border-slate-700/50 p-5">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Brief Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Generated</span>
                    <span className="text-slate-300">
                      {new Date(brief.generatedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Urgent Items</span>
                    <span className="text-red-400 font-medium">{brief.urgent?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Warnings</span>
                    <span className="text-amber-400 font-medium">{brief.warnings?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opportunities</span>
                    <span className="text-emerald-400 font-medium">{brief.opportunities?.length || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Chat Panel */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 w-[500px] h-[600px] bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-black/50 flex flex-col overflow-hidden z-50"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Scale className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="font-semibold">Legal Advisor AI</span>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <LegalChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============ Brief Card Component ============

function BriefCard({ item, variant }: { item: BriefItem; variant: "urgent" | "warning" | "opportunity" }) {
  const [expanded, setExpanded] = useState(false);

  const colors = {
    urgent: {
      border: "border-red-500/30",
      bg: "bg-red-500/5",
      accent: "text-red-400",
      badge: "bg-red-500/20 text-red-400",
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      accent: "text-amber-400",
      badge: "bg-amber-500/20 text-amber-400",
    },
    opportunity: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/5",
      accent: "text-emerald-400",
      badge: "bg-emerald-500/20 text-emerald-400",
    },
  };

  const c = colors[variant];

  return (
    <motion.div
      layout
      className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden`}
    >
      <div
        className="p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className={`font-semibold ${c.accent} mb-2`}>{item.title}</h3>
            <p className="text-slate-300 text-sm leading-relaxed">{item.description}</p>
          </div>
          <button className="p-1 text-slate-500 hover:text-slate-300 shrink-0">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Evidence Preview */}
        {item.evidence && item.evidence.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.evidence.slice(0, 2).map((ev, idx) => (
              <span key={idx} className={`px-2 py-1 text-xs rounded-lg ${c.badge}`}>
                {ev.type.toUpperCase()}: {ev.source.split('@')[0].slice(0, 20)}...
              </span>
            ))}
            {item.evidence.length > 2 && (
              <span className="px-2 py-1 text-xs rounded-lg bg-slate-700 text-slate-400">
                +{item.evidence.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/50"
          >
            <div className="p-5 space-y-4">
              {/* Evidence Details */}
              {item.evidence && item.evidence.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Supporting Evidence</h4>
                  <div className="space-y-2">
                    {item.evidence.map((ev, idx) => (
                      <div key={idx} className="bg-slate-800/50 rounded-lg p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          {ev.type === 'email' && <Mail className="w-4 h-4 text-blue-400" />}
                          {ev.type === 'text' && <Phone className="w-4 h-4 text-green-400" />}
                          {ev.type === 'case_info' && <FileText className="w-4 h-4 text-purple-400" />}
                          <span className="text-slate-300 font-medium">{ev.source}</span>
                          <span className="text-slate-500 text-xs ml-auto">{ev.date || ev.dates}</span>
                        </div>
                        <p className="text-slate-400 italic">"{ev.snippet}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utah Law Reference */}
              {item.utahLawRef && (
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Legal Reference</h4>
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-sm text-indigo-300">
                    {item.utahLawRef}
                  </div>
                </div>
              )}

              {/* Recommended Action */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Recommended Action</h4>
                <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300">
                  {item.action}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============ Contact Card ============

function ContactCard({ name, role, email, phone, icon }: {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-200 truncate">{name}</div>
        <div className="text-xs text-slate-500">{role}</div>
      </div>
      {email && (
        <a href={`mailto:${email}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
          <Mail className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

// ============ Quick Action Button ============

function QuickActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all text-slate-400 hover:text-white"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

// ============ Legal Chat Panel ============

function LegalChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/legal/advisor/chat")
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
      const resp = await fetch("/api/legal/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });

      if (!resp.ok) throw new Error("Chat failed");

      const data = await resp.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response || "No response",
        metadata: {
          suggestedResponses: data.suggestedResponses,
          evidenceUsed: data.evidenceUsed,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Chat Messages */}
      <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <Scale className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Ask questions about your case</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "What's the status?",
                "Next steps?",
                "Recent communications?",
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
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-100 border border-slate-700"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Analyzing...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your case..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
