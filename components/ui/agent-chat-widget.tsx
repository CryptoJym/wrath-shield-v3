'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { MessageCircle, X, Send, Minimize2, Maximize2, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentChatWidgetProps {
  /**
   * The agent ID for local memory context
   * This determines which agent's memory is searched for context
   */
  agentId: string;

  /**
   * Display name for the agent
   */
  agentName?: string;

  /**
   * Custom placeholder for input
   */
  placeholder?: string;

  /**
   * Position of the widget
   */
  position?: 'bottom-right' | 'bottom-left';

  /**
   * Whether to show as a floating widget (true) or inline (false)
   */
  floating?: boolean;

  /**
   * Initial collapsed state
   */
  defaultCollapsed?: boolean;

  /**
   * Custom CSS class for the container
   */
  className?: string;

  /**
   * Domain context to include in queries (e.g., "finance", "education", "pm")
   */
  domain?: string;

  /**
   * Whether to include orchestrator context in responses
   */
  includeOrchestratorContext?: boolean;

  /**
   * For PM agent: auto-execute parsed actions
   */
  autoExecuteActions?: boolean;

  /**
   * Callback when an action is executed (for dashboard refresh)
   */
  onActionExecuted?: (action: { type: string; repo: string; success: boolean }) => void;
}

export function AgentChatWidget({
  agentId,
  agentName,
  placeholder,
  position = 'bottom-right',
  floating = true,
  defaultCollapsed = true,
  className = '',
  domain,
  includeOrchestratorContext = true,
  autoExecuteActions = false,
  onActionExecuted,
}: AgentChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = agentName || agentId.replace('agent.', '').split('.').map(
    s => s.charAt(0).toUpperCase() + s.slice(1)
  ).join(' ');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the agent chat API
      const response = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          agentId,
          domain,
          includeOrchestratorContext,
          autoExecuteActions,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Check if an action was executed
      if (data.action?.executed && data.action?.result && onActionExecuted) {
        onActionExecuted({
          type: data.action.parsed.action,
          repo: data.action.parsed.repo_full_name,
          success: data.action.result.success,
        });
      }

      // Build response content with action status if applicable
      let responseContent = data.response || 'I apologize, but I could not generate a response.';
      if (data.action?.executed && data.action?.result) {
        const actionStatus = data.action.result.success
          ? `\n\n✅ Action executed: ${data.action.result.message}`
          : `\n\n❌ Action failed: ${data.action.result.message}`;
        responseContent += actionStatus;
      } else if (data.action?.parsed && !data.action.executed) {
        responseContent += `\n\n💡 Suggested action: ${data.action.parsed.action}(${data.action.parsed.repo_full_name})`;
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[AgentChatWidget] Error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Floating widget styles
  const containerClasses = floating
    ? `fixed ${position === 'bottom-right' ? 'right-4' : 'left-4'} bottom-4 z-50`
    : className;

  if (!isOpen) {
    return (
      <div className={containerClasses}>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
          title={`Chat with ${displayName}`}
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div
        className={`bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isMinimized ? 'w-72 h-12' : 'w-96 h-[500px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white">{displayName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4 text-gray-400" />
              ) : (
                <Minimize2 className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[380px]">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <p>Start a conversation with {displayName}</p>
                  {domain && (
                    <p className="text-xs mt-1 text-gray-600">
                      Context: {domain}
                    </p>
                  )}
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-200 border border-gray-700/50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-[10px] opacity-50 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-lg px-3 py-2 border border-gray-700/50">
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-gray-700/50">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder || `Ask ${displayName}...`}
                  className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Pre-configured chat widgets for specific agents
 */

export function OrchestratorChat(props: Omit<AgentChatWidgetProps, 'agentId'>) {
  return (
    <AgentChatWidget
      agentId="agent.orchestrator.interface"
      agentName="Orchestrator"
      placeholder="Ask the Orchestrator..."
      includeOrchestratorContext={true}
      {...props}
    />
  );
}

export function FinanceChat(props: Omit<AgentChatWidgetProps, 'agentId' | 'domain'>) {
  return (
    <AgentChatWidget
      agentId="agent.finance"
      agentName="Finance Analyst"
      placeholder="Ask about finances..."
      domain="finance"
      {...props}
    />
  );
}

interface PMChatProps extends Omit<AgentChatWidgetProps, 'agentId' | 'domain'> {
  /**
   * SWR mutate function to refresh data after action
   */
  onRefresh?: () => void;
}

export function PMChat({ onRefresh, ...props }: PMChatProps) {
  const handleActionExecuted = useCallback(
    (action: { type: string; repo: string; success: boolean }) => {
      console.log('[PMChat] Action executed:', action);
      if (action.success && onRefresh) {
        // Trigger dashboard refresh after successful action
        setTimeout(() => onRefresh(), 500);
      }
    },
    [onRefresh]
  );

  return (
    <AgentChatWidget
      agentId="agent.pm"
      agentName="Project Maestro"
      placeholder="Classify repos, set domains, manage hierarchy..."
      domain="pm"
      autoExecuteActions={true}
      onActionExecuted={handleActionExecuted}
      {...props}
    />
  );
}

export function EducationChat(props: Omit<AgentChatWidgetProps, 'agentId' | 'domain'>) {
  return (
    <AgentChatWidget
      agentId="agent.hyro"
      agentName="Hyro Education"
      placeholder="Ask about education..."
      domain="education"
      {...props}
    />
  );
}

export function LegalChat(props: Omit<AgentChatWidgetProps, 'agentId' | 'domain'>) {
  return (
    <AgentChatWidget
      agentId="agent.legal"
      agentName="Legal Advocate"
      placeholder="Ask about legal matters..."
      domain="legal"
      {...props}
    />
  );
}

export function CommsChat(props: Omit<AgentChatWidgetProps, 'agentId' | 'domain'>) {
  return (
    <AgentChatWidget
      agentId="agent.comms"
      agentName="Inbox Steward"
      placeholder="Ask about communications..."
      domain="comms"
      {...props}
    />
  );
}

export default AgentChatWidget;
