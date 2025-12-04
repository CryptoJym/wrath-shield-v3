'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// Types
interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: string;
    xp_awarded?: number;
    quest_generated?: Quest;
  };
}

interface Quest {
  id: string;
  title: string;
  description: string;
  quest_type: string;
  xp_reward: number;
  difficulty: string;
  required_stat: string;
}

interface TutorContext {
  child_name: string;
  proficiency: Array<{ stat_name: string; level: number; confidence: number }>;
  zpd_summary: Array<{ stat_name: string; optimal_difficulty: number; trend: string; in_flow: boolean }>;
  active_skill_gaps: Array<{ id: string; stat_name: string; topic: string; gap_severity: string }>;
  session_context: { due_cards: number; active_quests: number; streak_days: number };
}

interface SuggestedAction {
  type: 'start_session' | 'take_diagnostic' | 'do_quest' | 'review_cards' | 'read';
  label: string;
  href?: string;
}

// Stat display config
const STAT_COLORS: Record<string, string> = {
  reading_comprehension: 'text-blue-400',
  vocabulary: 'text-purple-400',
  critical_thinking: 'text-pink-400',
  math_reasoning: 'text-orange-400',
  writing: 'text-green-400',
  study_skills: 'text-yellow-400',
};

export default function TutorPage() {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<TutorContext | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [showContext, setShowContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load context on mount
  useEffect(() => {
    loadContext();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const loadContext = async () => {
    try {
      const res = await fetch('/api/hyro/tutor?action=context');
      const data = await res.json();
      if (data.success) {
        setContext(data.data);
      }
    } catch (err) {
      console.error('Failed to load context:', err);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message immediately
    const tempUserMessage: TutorMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Math.floor(Date.now() / 1000),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const res = await fetch('/api/hyro/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: userMessage,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Add assistant message
        const assistantMessage: TutorMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.data.response,
          timestamp: Math.floor(Date.now() / 1000),
          metadata: {
            intent: data.data.intent,
            xp_awarded: data.data.xp_awarded,
            quest_generated: data.data.quest_generated,
          },
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Update state
        if (data.data.conversation_id) {
          setConversationId(data.data.conversation_id);
        }
        if (data.data.total_xp_earned) {
          setTotalXp(data.data.total_xp_earned);
        }
        if (data.data.suggested_actions) {
          setSuggestedActions(data.data.suggested_actions);
        }
      } else {
        // Add error message
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, I had trouble understanding that. ${data.error || 'Please try again.'}`,
            timestamp: Math.floor(Date.now() / 1000),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: Math.floor(Date.now() / 1000),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const generateQuest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hyro/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_quest' }),
      });

      const data = await res.json();
      if (data.success) {
        const quest = data.data;
        setMessages((prev) => [
          ...prev,
          {
            id: `quest-${Date.now()}`,
            role: 'assistant',
            content: `I've created a new quest for you!\n\n**${quest.title}**\n\n${quest.description}\n\nReward: ${quest.xp_reward} XP\nDifficulty: ${quest.difficulty}\nFocuses on: ${quest.required_stat.replace('_', ' ')}`,
            timestamp: Math.floor(Date.now() / 1000),
            metadata: { quest_generated: quest },
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to generate quest:', err);
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = async () => {
    setMessages([]);
    setConversationId(null);
    setTotalXp(0);
    setSuggestedActions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    "What should I work on today?",
    "Give me a challenge!",
    "Explain something about reading",
    "How am I doing?",
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/hyro/forge" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-2xl">&#x1F9D9;</span>
              <div>
                <h1 className="font-bold text-lg">Sage</h1>
                <p className="text-xs text-slate-400">AI Learning Companion</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {totalXp > 0 && (
              <div className="bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium">
                +{totalXp} XP
              </div>
            )}
            <button
              onClick={() => setShowContext(!showContext)}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
              title="Show learning context"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={startNewConversation}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
              title="New conversation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context Panel */}
        {showContext && context && (
          <div className="border-t border-slate-700 bg-slate-800/80 px-4 py-3">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Proficiency Levels</p>
                  <div className="space-y-1">
                    {context.proficiency.slice(0, 3).map((p) => (
                      <div key={p.stat_name} className="flex justify-between">
                        <span className={STAT_COLORS[p.stat_name] || 'text-slate-300'}>
                          {p.stat_name.replace('_', ' ')}
                        </span>
                        <span className="text-slate-400">{p.level}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Session</p>
                  <div className="space-y-1">
                    <p><span className="text-purple-400">{context.session_context.due_cards}</span> cards due</p>
                    <p><span className="text-green-400">{context.session_context.active_quests}</span> active quests</p>
                    <p><span className="text-orange-400">{context.session_context.streak_days}</span> day streak</p>
                  </div>
                </div>
                {context.active_skill_gaps.length > 0 && (
                  <div>
                    <p className="text-slate-500 mb-1">Focus Areas</p>
                    <div className="space-y-1">
                      {context.active_skill_gaps.slice(0, 3).map((gap) => (
                        <p key={gap.id} className="text-red-400 text-xs">
                          {gap.topic} ({gap.stat_name.replace('_', ' ')})
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">&#x1F9D9;</div>
              <h2 className="text-2xl font-bold mb-2">Hey Hyro!</h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                I'm Sage, your AI learning companion. Ask me anything about what you're learning,
                or let me help you figure out what to work on next!
              </p>

              {/* Quick prompts */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-sm transition-colors border border-slate-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Quest button */}
              <button
                onClick={generateQuest}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                Generate a Quest for Me
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.metadata?.xp_awarded && msg.metadata.xp_awarded > 0 && (
                      <div className="mt-2 text-xs text-yellow-400">
                        +{msg.metadata.xp_awarded} XP earned!
                      </div>
                    )}
                    {msg.metadata?.quest_generated && (
                      <Link
                        href="/hyro/forge"
                        className="mt-2 inline-block text-xs text-purple-400 hover:text-purple-300"
                      >
                        View in Quests
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <div className="border-t border-slate-700 bg-slate-800/50 px-4 py-2">
          <div className="max-w-4xl mx-auto flex gap-2 overflow-x-auto">
            {suggestedActions.map((action, i) => (
              <Link
                key={i}
                href={action.href || '/hyro/forge'}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <footer className="border-t border-slate-700 bg-slate-800/80 backdrop-blur-sm sticky bottom-0">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sage anything..."
                rows={1}
                className="w-full bg-slate-700 rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-slate-400 max-h-32"
              />
              <button
                type="button"
                onClick={generateQuest}
                disabled={loading}
                className="absolute right-12 bottom-3 p-1 text-slate-400 hover:text-purple-400 transition-colors disabled:opacity-50"
                title="Generate quest"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
