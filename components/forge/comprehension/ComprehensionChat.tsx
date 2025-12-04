'use client';

/**
 * ComprehensionChat Component
 * AI-powered discussion interface for reading comprehension
 * Socratic method dialog with guided questions and insights
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send, Bot, User, Lightbulb, BookOpen,
  MessageCircle, Loader2, Sparkles, ChevronDown
} from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  insight_type?: string;
  xp_earned?: number;
}

interface ComprehensionChatProps {
  bookId: string;
  bookTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  initialMessages?: Message[];
  suggestedTopics?: string[];
  onSendMessage: (message: string, context?: { chapterId?: string }) => Promise<{
    response: string;
    insight_type?: string;
    xp_earned?: number;
    follow_up_questions?: string[];
  }>;
  onClose?: () => void;
}

const insightColors: Record<string, { bg: string; text: string; label: string }> = {
  theme: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', label: 'Theme' },
  character: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'Character' },
  plot: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', label: 'Plot' },
  analysis: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Analysis' },
  connection: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Connection' },
  vocabulary: { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', label: 'Vocabulary' },
};

export function ComprehensionChat({
  bookId,
  bookTitle,
  chapterId,
  chapterTitle,
  initialMessages = [],
  suggestedTopics = [],
  onSendMessage,
  onClose,
}: ComprehensionChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if scroll down button should show
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setFollowUpQuestions([]);

    try {
      const result = await onSendMessage(text, { chapterId });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: Date.now(),
        insight_type: result.insight_type,
        xp_earned: result.xp_earned,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (result.follow_up_questions?.length) {
        setFollowUpQuestions(result.follow_up_questions);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, onSendMessage, chapterId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <BookOpen size={20} color="#f59e0b" />
          <div>
            <h3 style={styles.bookTitle}>{bookTitle}</h3>
            {chapterTitle && (
              <span style={styles.chapterLabel}>{chapterTitle}</span>
            )}
          </div>
        </div>
        <div style={styles.headerBadge}>
          <MessageCircle size={14} />
          Discussion
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        style={styles.messagesContainer}
        onScroll={handleScroll}
      >
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <Bot size={48} style={{ opacity: 0.3, color: '#f59e0b' }} />
            <h3 style={styles.emptyTitle}>Start a Discussion</h3>
            <p style={styles.emptyText}>
              Ask questions about the book, explore themes, or dive deeper into characters and plot.
            </p>
            {suggestedTopics.length > 0 && (
              <div style={styles.suggestedTopics}>
                <span style={styles.suggestedLabel}>Try asking about:</span>
                <div style={styles.topicsList}>
                  {suggestedTopics.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(topic)}
                      style={styles.topicButton}
                    >
                      <Sparkles size={12} />
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageRow,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                ...styles.messageBubble,
                ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  ...styles.avatar,
                  background: msg.role === 'user' ? '#3b82f6' : '#f59e0b',
                }}
              >
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>

              {/* Content */}
              <div style={styles.messageContent}>
                {msg.insight_type && insightColors[msg.insight_type] && (
                  <div
                    style={{
                      ...styles.insightBadge,
                      background: insightColors[msg.insight_type].bg,
                      color: insightColors[msg.insight_type].text,
                    }}
                  >
                    <Lightbulb size={12} />
                    {insightColors[msg.insight_type].label}
                  </div>
                )}
                <p style={styles.messageText}>{msg.content}</p>
                {msg.xp_earned && msg.xp_earned > 0 && (
                  <div style={styles.xpBadge}>
                    +{msg.xp_earned} XP
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={styles.messageRow}>
            <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
              <div style={{ ...styles.avatar, background: '#f59e0b' }}>
                <Bot size={14} />
              </div>
              <div style={styles.typingIndicator}>
                <span style={styles.typingDot} />
                <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
                <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <button onClick={scrollToBottom} style={styles.scrollDownButton}>
          <ChevronDown size={20} />
        </button>
      )}

      {/* Follow-up questions */}
      {followUpQuestions.length > 0 && !isLoading && (
        <div style={styles.followUpSection}>
          <span style={styles.followUpLabel}>Continue exploring:</span>
          <div style={styles.followUpButtons}>
            {followUpQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                style={styles.followUpButton}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={styles.inputContainer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or share your thoughts..."
          style={styles.input}
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          style={{
            ...styles.sendButton,
            opacity: (!input.trim() || isLoading) ? 0.5 : 1,
          }}
        >
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '700px',
    background: '#0f0f0f',
    borderRadius: '1rem',
    border: '1px solid #333',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #333',
    background: '#1a1a1a',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  bookTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  chapterLabel: {
    fontSize: '0.75rem',
    color: '#888',
  },
  headerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    background: 'rgba(139, 92, 246, 0.1)',
    color: '#a78bfa',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
    textAlign: 'center',
    gap: '0.75rem',
  },
  emptyTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
  },
  emptyText: {
    margin: 0,
    color: '#888',
    maxWidth: '300px',
    lineHeight: 1.5,
  },
  suggestedTopics: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  suggestedLabel: {
    fontSize: '0.75rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  topicsList: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  topicButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.875rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '999px',
    color: '#f59e0b',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    display: 'flex',
    gap: '0.75rem',
    maxWidth: '85%',
    padding: '0.875rem',
    borderRadius: '1rem',
  },
  userBubble: {
    background: 'linear-gradient(135deg, #1e3a5f, #1e293b)',
    borderTopRightRadius: '0.25rem',
  },
  assistantBubble: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderTopLeftRadius: '0.25rem',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messageContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  insightBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    width: 'fit-content',
  },
  messageText: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  xpBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.5rem',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    width: 'fit-content',
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.5rem 0',
  },
  typingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#888',
    animation: 'bounce 1s infinite',
  },
  scrollDownButton: {
    position: 'absolute',
    bottom: '120px',
    right: '1.5rem',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#333',
    border: '1px solid #444',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  followUpSection: {
    padding: '0.75rem 1rem',
    borderTop: '1px solid #333',
    background: '#1a1a1a',
  },
  followUpLabel: {
    display: 'block',
    fontSize: '0.6875rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  },
  followUpButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  followUpButton: {
    padding: '0.5rem 0.75rem',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '999px',
    color: '#ccc',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.75rem',
    padding: '1rem',
    borderTop: '1px solid #333',
    background: '#0f0f0f',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '1rem',
    color: '#fff',
    fontSize: '0.9375rem',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.4,
    minHeight: '44px',
    maxHeight: '120px',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    border: 'none',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
};

export default ComprehensionChat;
