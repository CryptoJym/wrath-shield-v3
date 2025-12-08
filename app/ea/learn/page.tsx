"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Message {
  role: "user" | "ea" | "system";
  content: string;
  timestamp: number;
  correction?: {
    itemId: string;
    original: string;
    corrected: string;
  };
}

interface PendingItem {
  id: string;
  title: string;
  content: string;
  source: string;
  eaClassification: {
    domain: string;
    priority: string;
    action: string;
    reasoning: string;
  };
  confidence: number;
}

export default function EALearningPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ea",
      content: "Hello James. I'm ready to learn your preferences. I'll show you recent items and you can tell me how I should handle similar ones in the future. You can also ask me questions about my current understanding.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch pending items that need review
  const { data: pendingData, mutate: mutatePending } = useSWR("/api/ea/pending", fetcher, {
    refreshInterval: 30000,
  });

  // Fetch current preferences for display
  const { data: prefsData } = useSWR("/api/ea/preferences", fetcher);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string, correction?: Message["correction"]) => {
    if (!content.trim() && !correction) return;

    const userMessage: Message = {
      role: "user",
      content: content || `Corrected: ${correction?.original} → ${correction?.corrected}`,
      timestamp: Date.now(),
      correction,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ea/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          correction,
          conversationContext: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      const eaMessage: Message = {
        role: "ea",
        content: data.response || "I've noted that. Thank you for helping me learn.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, eaMessage]);

      // Refresh pending items if a correction was made
      if (correction) {
        mutatePending();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Error communicating with EA. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCorrection = (item: PendingItem, newDomain: string) => {
    sendMessage("", {
      itemId: item.id,
      original: item.eaClassification.domain,
      corrected: newDomain,
    });
    setSelectedItem(null);
  };

  const handleConfirm = (item: PendingItem) => {
    sendMessage(`Good job on classifying "${item.title}" as ${item.eaClassification.domain}. Keep doing that.`);
    setSelectedItem(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {/* Left Panel: Pending Items */}
      <div className="w-1/3 border-r border-slate-800 p-4 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-cyan-400">Pending Review</h2>
          <p className="text-xs text-slate-500">Click an item to review my classification</p>
        </div>

        <div className="space-y-3">
          {pendingData?.items?.length > 0 ? (
            pendingData.items.map((item: PendingItem) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedItem?.id === item.id
                    ? "border-cyan-500 bg-slate-800"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="text-sm font-medium text-slate-200 truncate">{item.title}</div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-2">{item.content}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                    {item.eaClassification.domain}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {Math.round(item.confidence * 100)}% conf
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500 italic">No pending items for review</div>
          )}
        </div>

        {/* Current Preferences Summary */}
        {prefsData?.preferences && (
          <div className="mt-6 p-3 rounded-lg bg-slate-900 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Current Understanding</h3>
            <div className="space-y-1 text-xs text-slate-400">
              <div>Priority Contacts: {prefsData.preferences.priority_contacts?.length || 0}</div>
              <div>Urgency Triggers: {prefsData.preferences.urgency_triggers?.length || 0}</div>
              <div>Auto-Archive Patterns: {prefsData.preferences.auto_archive_patterns?.length || 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Chat Interface */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-800 p-4">
          <h1 className="text-xl font-semibold">EA Learning Session</h1>
          <p className="text-sm text-slate-400">Help me understand your preferences</p>
        </div>

        {/* Selected Item Detail */}
        {selectedItem && (
          <div className="border-b border-slate-800 p-4 bg-slate-900/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-200">{selectedItem.title}</div>
                <div className="text-xs text-slate-400 mt-1">{selectedItem.content}</div>
                <div className="text-xs text-slate-500 mt-2">
                  My reasoning: {selectedItem.eaClassification.reasoning}
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Correction Buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-slate-500 mr-2">Correct to:</span>
              {["Finance", "Legal", "PM", "Health", "Personal", "Junk"].map((domain) => (
                <button
                  key={domain}
                  onClick={() => handleCorrection(selectedItem, domain.toLowerCase())}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    selectedItem.eaClassification.domain === domain.toLowerCase()
                      ? "border-cyan-500 bg-cyan-900/30 text-cyan-300"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {domain}
                </button>
              ))}
              <button
                onClick={() => handleConfirm(selectedItem)}
                className="text-xs px-2 py-1 rounded border border-emerald-700 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-800/50"
              >
                ✓ Correct!
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-cyan-900/50 text-cyan-100"
                    : msg.role === "system"
                    ? "bg-rose-900/50 text-rose-200"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {msg.role === "ea" && (
                  <div className="text-[10px] text-cyan-400 mb-1 font-semibold">EA</div>
                )}
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                {msg.correction && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    Correction recorded: {msg.correction.original} → {msg.correction.corrected}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Tell me about your preferences, or ask about my understanding..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => sendMessage("What are my current priority contacts?")}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
            >
              Priority contacts?
            </button>
            <button
              onClick={() => sendMessage("What patterns do you auto-archive?")}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
            >
              Auto-archive rules?
            </button>
            <button
              onClick={() => sendMessage("What triggers urgent classification?")}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700"
            >
              Urgency triggers?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
