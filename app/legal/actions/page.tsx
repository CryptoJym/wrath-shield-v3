"use client";

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  Sparkles,
  Shield,
  Calendar,
  Gavel,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Brain,
  Loader2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Types
interface BriefItem {
  id: string;
  category: 'urgent' | 'opportunity' | 'warning';
  title: string;
  description: string;
  evidence: Array<{ type: string; source: string; snippet: string; date: string }>;
  utahLawRef?: string;
  action?: string;
}

interface DailyBrief {
  generatedAt: string;
  caseNumber: string;
  nextHearing: { date: string; time: string } | null;
  urgent: BriefItem[];
  opportunities: BriefItem[];
  warnings: BriefItem[];
  summary: string;
  cached?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// Format date helper
function formatDate(dateStr: string): string {
  if (!dateStr) return 'TBD';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const isYYYYFirst = parts[0].length === 4;
  let year: number, month: number, day: number;

  if (isYYYYFirst) {
    [year, month, day] = parts.map(p => parseInt(p));
  } else {
    const [m, d, y] = parts.map(p => parseInt(p));
    year = y; month = m; day = d;
  }

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getDaysUntil(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';

  const isYYYYFirst = parts[0].length === 4;
  let year: number, month: number, day: number;

  if (isYYYYFirst) {
    [year, month, day] = parts.map(p => parseInt(p));
  } else {
    const [m, d, y] = parts.map(p => parseInt(p));
    year = y; month = m; day = d;
  }

  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff < 7) return `${diff} days`;
  if (diff < 30) return `${Math.floor(diff / 7)} weeks`;
  return `${Math.floor(diff / 30)} months`;
}

// Hearing Banner Component
function HearingBanner({ hearing }: { hearing: { date: string; time: string } | null }) {
  if (!hearing) return null;

  const daysUntil = getDaysUntil(hearing.date);
  const isUrgent = daysUntil.includes('day') && parseInt(daysUntil) <= 7;

  return (
    <div className={`rounded-xl p-4 mb-6 ${isUrgent ? 'bg-red-500/20 border border-red-500/50' : 'bg-blue-500/20 border border-blue-500/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className={`w-6 h-6 ${isUrgent ? 'text-red-400' : 'text-blue-400'}`} />
          <div>
            <div className="text-sm text-gray-400">Next Hearing</div>
            <div className="text-lg font-bold text-white">
              {formatDate(hearing.date)} at {hearing.time}
            </div>
          </div>
        </div>
        <div className={`px-4 py-2 rounded-lg font-bold ${isUrgent ? 'bg-red-500 text-white' : 'bg-blue-500/30 text-blue-300'}`}>
          {daysUntil}
        </div>
      </div>
    </div>
  );
}

// Brief Item Card
function BriefItemCard({ item, expanded, onToggle }: { item: BriefItem; expanded: boolean; onToggle: () => void }) {
  const categoryStyles = {
    urgent: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle, iconColor: 'text-red-400' },
    opportunity: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: Sparkles, iconColor: 'text-green-400' },
    warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Shield, iconColor: 'text-yellow-400' },
  };

  const style = categoryStyles[item.category];
  const Icon = style.icon;

  return (
    <div className={`rounded-lg ${style.bg} border ${style.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className={`w-5 h-5 mt-0.5 ${style.iconColor}`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">{item.title}</h4>
          <p className="text-sm text-gray-400 line-clamp-2">{item.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          {item.evidence && item.evidence.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Evidence</div>
              {item.evidence.map((e, i) => (
                <div key={i} className="text-sm bg-black/20 rounded p-2 mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    {e.type === 'EMAIL' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                    <span>{e.source}</span>
                    {e.date && <span>• {e.date}</span>}
                  </div>
                  <p className="text-gray-300 italic">&quot;{e.snippet}&quot;</p>
                </div>
              ))}
            </div>
          )}

          {item.utahLawRef && (
            <div className="text-sm">
              <span className="text-gray-500">Utah Law: </span>
              <span className="text-blue-400">{item.utahLawRef}</span>
            </div>
          )}

          {item.action && (
            <div className="bg-white/5 rounded p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Recommended Action</div>
              <p className="text-sm text-white">{item.action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Brief Section
function BriefSection({ title, items, icon: Icon, color }: {
  title: string;
  items: BriefItem[];
  icon: React.ElementType;
  color: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
        <h3 className="font-bold text-lg">{title}</h3>
        <span className="text-sm opacity-70">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <BriefItemCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Chat Component
function LegalAdvisorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    fetch('/api/legal/advisor/history')
      .then(r => r.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages.slice(-20));
        }
      })
      .catch(console.error);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/legal/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "What should I prepare for the hearing?",
    "Analyze recent communications",
    "What are my strongest arguments?",
    "Draft a response to Zack",
  ];

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isExpanded ? 'w-[500px] h-[600px]' : 'w-auto h-auto'}`}>
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-3 rounded-full shadow-lg transition-all"
        >
          <Brain className="w-5 h-5" />
          <span className="font-medium">Legal Advisor</span>
          {messages.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{messages.length}</span>
          )}
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="font-bold text-white">Legal Advisor AI</span>
              <span className="text-xs text-gray-500">GPT-5.1 / Grok-4.1</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-50" />
                <p className="text-gray-400 mb-4">Ask me anything about your case</p>
                <div className="space-y-2">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(q); }}
                      className="block w-full text-left text-sm text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 px-3 py-2 rounded-lg transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-sm text-gray-400">Analyzing...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your case..."
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Page
export default function LegalActionsPage() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached brief on mount
  useEffect(() => {
    fetch('/api/legal/advisor/brief')
      .then(r => r.json())
      .then(data => {
        if (data.urgent || data.opportunities || data.warnings) {
          setBrief(data);
        }
      })
      .catch(console.error);
  }, []);

  // Load court data for header
  const { data: courtData } = useSWR('/api/legal/court-data', fetcher);

  const generateBrief = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/legal/advisor/brief', { method: 'POST' });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setBrief(data);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate brief');
    } finally {
      setIsGenerating(false);
    }
  };

  const hearing = brief?.nextHearing || courtData?.data?.nextHearing;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gavel className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold">Legal Advisor</h1>
                <p className="text-sm text-gray-400">
                  Case #{brief?.caseNumber || courtData?.data?.caseNumber || '164400524'}
                  {courtData?.data?.assignedJudge && ` | Judge ${courtData.data.assignedJudge}`}
                </p>
              </div>
            </div>

            <button
              onClick={generateBrief}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Brief'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Hearing Banner */}
        <HearingBanner hearing={hearing} />

        {/* Error State */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">Error generating brief</span>
            </div>
            <p className="text-sm text-gray-300 mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && !brief && (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
            <p className="text-gray-400">Analyzing case data with AI...</p>
            <p className="text-sm text-gray-500 mt-2">This may take 30-60 seconds</p>
          </div>
        )}

        {/* No Brief State */}
        {!brief && !isGenerating && (
          <div className="text-center py-16 bg-gray-900/50 rounded-xl border border-gray-800">
            <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold mb-2">No Daily Brief Yet</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Generate an AI-powered strategic brief analyzing your case data, communications, and upcoming deadlines.
            </p>
            <button
              onClick={generateBrief}
              className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Generate Daily Brief
            </button>
          </div>
        )}

        {/* Brief Content */}
        {brief && (
          <>
            {/* Summary */}
            {brief.summary && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-300">Summary</h3>
                  {brief.cached && (
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-400">Cached</span>
                  )}
                </div>
                <p className="text-white">{brief.summary}</p>
                <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Generated {new Date(brief.generatedAt).toLocaleString()}
                </div>
              </div>
            )}

            {/* Brief Sections */}
            <BriefSection
              title="Urgent"
              items={brief.urgent || []}
              icon={AlertTriangle}
              color="text-red-400"
            />

            <BriefSection
              title="Opportunities"
              items={brief.opportunities || []}
              icon={Sparkles}
              color="text-green-400"
            />

            <BriefSection
              title="Warnings"
              items={brief.warnings || []}
              icon={Shield}
              color="text-yellow-400"
            />

            {/* Empty State */}
            {(!brief.urgent?.length && !brief.opportunities?.length && !brief.warnings?.length) && (
              <div className="text-center py-8 text-gray-500">
                <p>No items in this brief. Try regenerating with more data.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Chat */}
      <LegalAdvisorChat />
    </div>
  );
}
