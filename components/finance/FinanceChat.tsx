'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  Brain,
  BookOpen,
  Lightbulb,
  Send as SendProposal,
  ChevronRight,
  Database,
} from 'lucide-react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  actions?: SuggestedAction[];
};

type SuggestedAction = {
  type: 'mark_reimbursable' | 'mark_not_reimbursable' | 'set_company' | 'set_assignee' | 'bulk_update';
  transactionIds?: string[];
  company?: string;
  assignee?: string;
  label: string;
};

type Transaction = {
  id: string;
  date: string;
  vendor?: string;
  raw_desc?: string;
  amount: number;
  reimbursable: boolean;
  assignee?: string;
  company?: string;
};

type AgentMemory = {
  id: string;
  text: string;
  score?: number;
  createdAt?: string;
};

type FinanceChatProps = {
  cycleStart?: string;
  cycleEnd?: string;
  transactions?: Transaction[];
  companies?: string[];
  assignees?: string[];
  onUpdate?: () => void;
};

export function FinanceChat({
  cycleStart,
  cycleEnd,
  transactions = [],
  companies = [],
  assignees = [],
  onUpdate,
}: FinanceChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'learn'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your Finance Agent with persistent memory. I learn from our conversations and remember your preferences.\n\nTry asking me things like:\n- "What's the total for Vuplicity?"\n- "Mark all OpenAI charges as reimbursable"\n- "Which transactions need review?"\n- "Remember: Cursor charges are always for Solution Stream"`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemories] = useState<{ private: AgentMemory[]; org: AgentMemory[] }>({ private: [], org: [] });
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [learnText, setLearnText] = useState('');
  const [isLearning, setIsLearning] = useState(false);
  const [proposalText, setProposalText] = useState('');
  const [isProposing, setIsProposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

  // Load memories when memory tab is selected
  useEffect(() => {
    if (isOpen && activeTab === 'memory') {
      loadMemories();
    }
  }, [isOpen, activeTab]);

  const loadMemories = async () => {
    setMemoryLoading(true);
    try {
      const response = await fetch('/api/finance/agent-memory?type=all&limit=10');
      if (response.ok) {
        const data = await response.json();
        setMemories({
          private: data.private?.memories || [],
          org: data.org?.memories || [],
        });
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setMemoryLoading(false);
    }
  };

  // Build context for the agent
  const buildContext = useCallback(() => {
    const reimbursable = transactions.filter((t) => t.reimbursable);
    const totalReimbursable = reimbursable.reduce((sum, t) => sum + t.amount, 0);

    // Group by company
    const byCompany: Record<string, number> = {};
    reimbursable.forEach((t) => {
      const co = t.company || 'Unassigned';
      byCompany[co] = (byCompany[co] || 0) + t.amount;
    });

    // Recent transactions sample
    const recentSample = transactions
      .slice(0, 20)
      .map((t) => `- ${t.date}: ${t.vendor || t.raw_desc} $${t.amount.toFixed(2)} [${t.reimbursable ? 'Reimbursable' : 'Not Reimbursable'}] ${t.company || ''}`);

    return `
CURRENT CYCLE: ${cycleStart} to ${cycleEnd}
TOTAL TRANSACTIONS: ${transactions.length}
REIMBURSABLE TOTAL: $${totalReimbursable.toFixed(2)}

BY COMPANY:
${Object.entries(byCompany).map(([co, amt]) => `- ${co}: $${amt.toFixed(2)}`).join('\n')}

AVAILABLE COMPANIES: ${companies.join(', ')}
AVAILABLE ASSIGNEES: ${assignees.join(', ')}

RECENT TRANSACTIONS:
${recentSample.join('\n')}

You are a Finance Agent helping manage expense reimbursements. You can:
1. Answer questions about transactions and totals
2. Suggest marking items as reimbursable or not
3. Suggest assigning transactions to companies (Vuplicity, Solution Stream, Utlyze, etc.)
4. Help identify patterns and anomalies
5. Learn and remember user preferences for future use

When the user says "remember" or teaches you something, acknowledge that you've learned it.
When suggesting changes, be specific about which transactions and what changes to make.
`;
  }, [cycleStart, cycleEnd, transactions, companies, assignees]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setIsLoading(true);

    // Check if this is a "remember" or learning instruction
    const isLearningInstruction = /^(remember|learn|note|always|never|rule:|policy:)/i.test(query);

    try {
      const context = buildContext();
      const response = await fetch('/api/agentic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          agent_id: 'agent.finance',
          user_id: 'default',
          conversation_history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            domainId: 'personal_finance',
            systemContext: context,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.message || data?.reply || data?.content || 'No response received.';

      // If this was a learning instruction, also explicitly save it to memory
      if (isLearningInstruction) {
        try {
          await fetch('/api/finance/agent-memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'learn',
              text: `User instruction: ${query}`,
              metadata: { source: 'chat_learning', timestamp: new Date().toISOString() },
            }),
          });
        } catch (e) {
          console.warn('Failed to save learning:', e);
        }
      }

      // Parse for suggested actions (simple heuristic)
      const actions = parseActionsFromResponse(reply, transactions);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, actions },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple action parser - looks for patterns in agent responses
  const parseActionsFromResponse = (
    response: string,
    txns: Transaction[]
  ): SuggestedAction[] => {
    const actions: SuggestedAction[] = [];
    const lowerResponse = response.toLowerCase();

    // Look for vendor mentions and action keywords
    const vendorMatches = txns.filter((t) => {
      const vendor = (t.vendor || t.raw_desc || '').toLowerCase();
      return lowerResponse.includes(vendor.split(' ')[0]?.toLowerCase() || '');
    });

    if (vendorMatches.length > 0) {
      if (lowerResponse.includes('mark') && lowerResponse.includes('reimbursable')) {
        actions.push({
          type: 'mark_reimbursable',
          transactionIds: vendorMatches.slice(0, 5).map((t) => t.id),
          label: `Mark ${vendorMatches.length} items as reimbursable`,
        });
      }

      // Check for company assignments
      for (const co of ['vuplicity', 'solution stream', 'utlyze', 'kahoa']) {
        if (lowerResponse.includes(co)) {
          actions.push({
            type: 'set_company',
            transactionIds: vendorMatches.slice(0, 5).map((t) => t.id),
            company: co.toUpperCase().replace(' ', '_'),
            label: `Assign to ${co.charAt(0).toUpperCase() + co.slice(1)}`,
          });
          break;
        }
      }
    }

    return actions;
  };

  const executeAction = async (action: SuggestedAction) => {
    if (!action.transactionIds?.length) return;

    try {
      // Execute bulk update
      const updates: Record<string, unknown> = {};
      if (action.type === 'mark_reimbursable') {
        updates.reimbursable = true;
      } else if (action.type === 'mark_not_reimbursable') {
        updates.reimbursable = false;
      } else if (action.type === 'set_company' && action.company) {
        updates.company = action.company;
      } else if (action.type === 'set_assignee' && action.assignee) {
        updates.assignee = action.assignee;
      }

      const response = await fetch('/api/finance/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: action.transactionIds,
          updates,
        }),
      });

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Done! Updated ${action.transactionIds?.length} transactions.`,
          },
        ]);
        onUpdate?.();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    }
  };

  const handleLearn = async () => {
    if (!learnText.trim() || isLearning) return;

    setIsLearning(true);
    try {
      const response = await fetch('/api/finance/agent-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'learn',
          text: learnText,
          metadata: { source: 'manual_learning' },
        }),
      });

      if (response.ok) {
        setLearnText('');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Got it! I've learned: "${learnText.substring(0, 100)}..."` },
        ]);
        loadMemories();
      }
    } catch (error) {
      console.error('Learning failed:', error);
    } finally {
      setIsLearning(false);
    }
  };

  const handlePropose = async () => {
    if (!proposalText.trim() || isProposing) return;

    setIsProposing(true);
    try {
      const response = await fetch('/api/finance/agent-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          text: proposalText,
          metadata: { source: 'finance_rule_proposal', type: 'org_policy' },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProposalText('');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Proposal submitted to council for review!\n\nProposal ID: ${data.proposalId}\nStatus: Pending approval\n\nThis will become organizational policy once approved.`,
          },
        ]);
      }
    } catch (error) {
      console.error('Proposal failed:', error);
    } finally {
      setIsProposing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              className="relative"
            >
              <MessageCircle className="w-6 h-6" />
              <Brain className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[420px] h-[650px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Bot className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">Finance Agent</h3>
                  <p className="text-xs text-slate-400">
                    {cycleStart && cycleEnd
                      ? `${cycleStart} to ${cycleEnd}`
                      : 'Manage expenses with AI'}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-400">Zep Memory</span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('memory')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    activeTab === 'memory'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  Memory
                </button>
                <button
                  onClick={() => setActiveTab('learn')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    activeTab === 'learn'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Teach
                </button>
              </div>
            </div>

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${
                        msg.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.role === 'user'
                            ? 'bg-blue-500/20'
                            : 'bg-emerald-500/20'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Bot className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div
                        className={`flex-1 ${
                          msg.role === 'user' ? 'text-right' : ''
                        }`}
                      >
                        <div
                          className={`inline-block px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white rounded-br-none'
                              : 'bg-slate-800 text-slate-200 rounded-bl-none'
                          }`}
                        >
                          {msg.content}
                        </div>

                        {/* Action Buttons */}
                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.actions.map((action, actionIdx) => (
                              <button
                                key={actionIdx}
                                onClick={() => executeAction(action)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="bg-slate-800 px-4 py-2 rounded-2xl rounded-bl-none">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                  <div className="flex gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about expenses or say 'remember...' to teach me"
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      rows={1}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    Say "remember" to teach me something new
                  </p>
                </div>
              </>
            )}

            {/* Memory Tab */}
            {activeTab === 'memory' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Agent&apos;s Zep Memory ({memories.private.length + memories.org.length} items)
                </div>

                {memoryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : (
                  <>
                    {/* Private Memories */}
                    {memories.private.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-1">
                          <Brain className="w-3.5 h-3.5" />
                          Private Knowledge
                        </h4>
                        <div className="space-y-2">
                          {memories.private.map((mem, idx) => (
                            <div
                              key={mem.id || idx}
                              className="p-3 bg-slate-800/50 rounded-lg text-xs text-slate-300 border border-purple-500/20"
                            >
                              {mem.text.substring(0, 200)}
                              {mem.text.length > 200 && '...'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Org Memories */}
                    {memories.org.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          Organizational Policies (Council-Approved)
                        </h4>
                        <div className="space-y-2">
                          {memories.org.map((mem, idx) => (
                            <div
                              key={mem.id || idx}
                              className="p-3 bg-slate-800/50 rounded-lg text-xs text-slate-300 border border-amber-500/20"
                            >
                              {mem.text.substring(0, 200)}
                              {mem.text.length > 200 && '...'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {memories.private.length === 0 && memories.org.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No memories yet</p>
                        <p className="text-xs mt-1">Chat with me to build knowledge</p>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={loadMemories}
                  disabled={memoryLoading}
                  className="w-full mt-4 py-2 text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center justify-center gap-1"
                >
                  <Loader2 className={`w-3.5 h-3.5 ${memoryLoading ? 'animate-spin' : ''}`} />
                  Refresh Memory
                </button>
              </div>
            )}

            {/* Learn/Teach Tab */}
            {activeTab === 'learn' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Direct Learning */}
                <div>
                  <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    Teach Me (Private Knowledge)
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    Add rules or facts I should remember. This goes to my private memory.
                  </p>
                  <textarea
                    value={learnText}
                    onChange={(e) => setLearnText(e.target.value)}
                    placeholder="e.g., Cursor charges should always go to Solution Stream"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    rows={3}
                  />
                  <button
                    onClick={handleLearn}
                    disabled={!learnText.trim() || isLearning}
                    className="mt-2 w-full py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isLearning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Brain className="w-4 h-4" />
                        Save to My Memory
                      </>
                    )}
                  </button>
                </div>

                {/* Council Proposals */}
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <h4 className="text-xs font-medium text-blue-400 mb-2 flex items-center gap-1">
                    <SendProposal className="w-3.5 h-3.5" />
                    Propose to Council (Org Policy)
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    Propose a new organizational rule. Requires council approval before it becomes policy.
                  </p>
                  <textarea
                    value={proposalText}
                    onChange={(e) => setProposalText(e.target.value)}
                    placeholder="e.g., All AI/SaaS subscriptions over $100/month require manager approval"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    rows={3}
                  />
                  <button
                    onClick={handlePropose}
                    disabled={!proposalText.trim() || isProposing}
                    className="mt-2 w-full py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isProposing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ChevronRight className="w-4 h-4" />
                        Submit Proposal to Council
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 p-3 bg-slate-800/30 rounded-lg text-xs text-slate-400">
                  <p className="font-medium text-slate-300 mb-1">How it works:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><span className="text-amber-400">Private</span>: Only I (Finance Agent) can see and use</li>
                    <li><span className="text-blue-400">Council</span>: All agents can see once approved</li>
                  </ul>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
