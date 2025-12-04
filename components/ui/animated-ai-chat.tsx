"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Image as ImageIcon,
    Figma,
    Monitor as MonitorIcon,
    Send as SendIcon,
    Loader as LoaderIcon,
    Sparkles,
    Command,
    Copy as CopyIcon,
    Check as CheckIcon,
    Paperclip,
    X as XIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from 'react-dom';
import * as React from "react"

const Markdown = ({ children }: { children: string }) => (
  <div className="whitespace-pre-wrap leading-relaxed text-slate-200 text-sm">{children}</div>
);

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <div className={cn(
        "relative",
        containerClassName
      )}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {showRing && isFocused && (
          <motion.span 
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-violet-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div 
            className="absolute bottom-2 right-2 opacity-0 w-2 h-2 bg-violet-500 rounded-full"
            style={{
              animation: 'none',
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const commandPaletteRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const copiedRef = useRef<number | null>(null);
    const sendingRef = useRef(false);
    const [showToast, setShowToast] = useState<{ msg: string; kind?: 'error' | 'info' } | null>(null);
    // attachments restored (full 21st UI)
    const [attachments, setAttachments] = useState<string[]>([]);
    const handleAttachFile = () => {
        const mock = `file-${Math.floor(Math.random()*1000)}.pdf`;
        setAttachments(prev => [...prev, mock]);
    };
    const removeAttachment = (i: number) => {
        setAttachments(prev => prev.filter((_, idx) => idx !== i));
    };
    const grokBase = process.env.NEXT_PUBLIC_AGENTIC_GROK_URL || '';
    const useStreaming = !!grokBase;
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const commandSuggestions: CommandSuggestion[] = [
        { 
            icon: <ImageIcon className="w-4 h-4" />, 
            label: "Clone UI", 
            description: "Generate a UI from a screenshot", 
            prefix: "/clone" 
        },
        { 
            icon: <Figma className="w-4 h-4" />, 
            label: "Import Figma", 
            description: "Import a design from Figma", 
            prefix: "/figma" 
        },
        { 
            icon: <MonitorIcon className="w-4 h-4" />, 
            label: "Create Page", 
            description: "Generate a new web page", 
            prefix: "/page" 
        },
        { 
            icon: <Sparkles className="w-4 h-4" />, 
            label: "Improve", 
            description: "Improve existing UI design", 
            prefix: "/improve" 
        },
    ];

    useEffect(() => {
        if (value.startsWith('/') && !value.includes(' ')) {
            setShowCommandPalette(true);
            
            const matchingSuggestionIndex = commandSuggestions.findIndex(
                (cmd) => cmd.prefix.startsWith(value)
            );
            
            if (matchingSuggestionIndex >= 0) {
                setActiveSuggestion(matchingSuggestionIndex);
            } else {
                setActiveSuggestion(-1);
            }
        } else {
            setShowCommandPalette(false);
        }
    }, [value]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const commandButton = document.querySelector('[data-command-button]');
            
            if (commandPaletteRef.current && 
                !commandPaletteRef.current.contains(target) && 
                !commandButton?.contains(target)) {
                setShowCommandPalette(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    const selectedCommand = commandSuggestions[activeSuggestion];
                    setValue(selectedCommand.prefix + ' ');
                    setShowCommandPalette(false);
                    
                    setRecentCommand(selectedCommand.label);
                    setTimeout(() => setRecentCommand(null), 3500);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                handleSendMessage();
            }
        }
    };

    // smooth scroll to bottom
    const firstMountRef = useRef(true);
    useEffect(() => {
        const el = listRef.current as any;
        if (!el) return;
        const top = el.scrollHeight;
        if (typeof el.scrollTo === 'function') {
            const behavior = firstMountRef.current ? 'auto' : 'smooth';
            el.scrollTo({ top, behavior });
        } else {
            el.scrollTop = top;
        }
        firstMountRef.current = false;
    }, [messages]);

    async function postChat(prompt: string) {
        const body = { query: prompt, user_id: 'default', conversation_history: messages };
        const r = await fetch('/api/agentic/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`Chat failed: ${r.status}`);
        const data = await r.json();
        const reply = data?.message || data?.reply || data?.content || JSON.stringify(data);
        return String(reply);
    }

    async function postChatStream(prompt: string, onDelta: (text: string) => void) {
        const req = { query: prompt, user_id: 'default' } as any;
        const resp = await fetch(`${grokBase}/api/agentic/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
        if (!resp.ok || !resp.body) throw new Error(`Stream failed: ${resp.status}`);
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split(/\r?\n/); buf = lines.pop() || '';
            for (const ln of lines) {
                if (!ln.startsWith('data:')) continue;
                try {
                    const evt = JSON.parse(ln.slice(5).trim());
                    if (evt?.type === 'content' && typeof evt?.text === 'string') onDelta(evt.text);
                } catch {}
            }
        }
    }

    const handleSendMessage = () => {
        const prompt = value.trim();
        if (!prompt || isTyping || sendingRef.current) return;
        sendingRef.current = true;
        setIsTyping(true);
        startTransition(() => {
            setMessages(prev => [...prev, { role: 'user', content: prompt }]);
        });
        setValue(""); adjustHeight(true);

        if (useStreaming) {
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
            let acc = '';
            setIsStreaming(true);
            postChatStream(prompt, (delta) => {
                acc += delta;
                setMessages(prev => {
                    const next = [...prev]; const i = next.length - 1;
                    if (i >= 0 && next[i].role === 'assistant') next[i] = { role: 'assistant', content: acc };
                    return next;
                });
            }).catch(err => {
                setShowToast({ msg: `Network error: ${err?.message || String(err)}`, kind: 'error' });
                setTimeout(() => setShowToast(null), 2500);
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err?.message || String(err)}` }]);
            }).finally(() => { setIsStreaming(false); setIsTyping(false); sendingRef.current = false; });
        } else {
            postChat(prompt).then(ans => {
                setMessages(prev => [...prev, { role: 'assistant', content: ans }]);
            }).catch(err => {
                setShowToast({ msg: `Network error: ${err?.message || String(err)}`, kind: 'error' });
                setTimeout(() => setShowToast(null), 2500);
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err?.message || String(err)}` }]);
            }).finally(() => { setIsTyping(false); sendingRef.current = false; });
        }
    };
    
    const selectCommandSuggestion = (index: number) => {
        const selectedCommand = commandSuggestions[index];
        setValue(selectedCommand.prefix + ' ');
        setShowCommandPalette(false);
        
        setRecentCommand(selectedCommand.label);
        setTimeout(() => setRecentCommand(null), 2000);
    };

    return (
        <div className="min-h-screen flex flex-col w-full items-center justify-center bg-transparent text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 w-full h-full overflow-hidden">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
            </div>
            <div className="w-full max-w-2xl mx-auto relative">
                <motion.div 
                    className="relative z-10 space-y-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <div className="text-center space-y-3">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="inline-block"
                        >
                            <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1">
                                Orchestrator
                            </h1>
                            <motion.div 
                                className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "100%", opacity: 1 }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                            />
                        </motion.div>
                        <motion.p
                            className="text-sm text-white/50 max-w-md mx-auto"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Hello! I'm Conductor, the orchestrator for James Brady's Life OS. I can help coordinate activities and delegate tasks across your various domains. How can I assist you today?
                        </motion.p>
                    </div>

                    <motion.div 
                        className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl"
                        initial={{ scale: 0.98 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AnimatePresence>
                            {showCommandPalette && (
                                <motion.div 
                                    ref={commandPaletteRef}
                                    className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div className="py-1 bg-black/95">
                                        {commandSuggestions.map((suggestion, index) => (
                                            <motion.div
                                                key={suggestion.prefix}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                                                    activeSuggestion === index 
                                                        ? "bg-white/10 text-white" 
                                                        : "text-white/70 hover:bg-white/5"
                                                )}
                                                onClick={() => selectCommandSuggestion(index)}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.03 }}
                                            >
                                                <div className="w-5 h-5 flex items-center justify-center text-white/60">
                                                    {suggestion.icon}
                                                </div>
                                                <div className="font-medium">{suggestion.label}</div>
                                                <div className="text-white/40 text-xs ml-1">
                                                    {suggestion.prefix}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="p-4">
                            <div ref={listRef} className="p-0 max-h-[480px] overflow-auto space-y-3">
                                {messages.length === 0 && (
                                    <div className="text-white/40 text-sm">Ready to coordinate. Ask me anything about your Life OS domains.</div>
                                )}
                                {messages.map((m, idx) => (
                                    <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className={cn("w-full flex", m.role === 'user' ? 'justify-end' : 'justify-start')}>
                                        <div className={cn('rounded-2xl px-3 py-2 text-sm max-w-[85%] sm:max-w-[600px] lg:max-w-[720px] break-words relative shadow-sm border', m.role === 'user' ? 'bg-white text-[#0A0A0B] border-black/10' : 'bg-[#16161a] text-white/90 border-violet-500/20')} style={{ lineHeight: 1.55, overflowWrap: 'anywhere' }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wide font-semibold', m.role === 'user' ? 'bg-black/10 text-black/70' : 'bg-violet-500/15 text-violet-300')}>{m.role === 'user' ? 'You' : 'Orchestrator'}</span>
                                                {m.role === 'assistant' && isStreaming && idx === messages.length - 1 && (
                                                    <span className="text-[10px] text-white/70 flex items-center gap-1">Thinking<TypingDots /></span>
                                                )}
                                            </div>
                                            {m.role === 'assistant' && isStreaming && idx === messages.length - 1 && (
                                                <div className="absolute left-0 right-0 top-0 h-[2px] overflow-hidden rounded-t-2xl">
                                                    <div className="w-full h-full bg-gradient-to-r from-violet-500/40 via-fuchsia-400/40 to-indigo-400/40 animate-[pulse_1.8s_ease_infinite]" />
                                                </div>
                                            )}
                                            {m.role === 'assistant' ? (
                                                <>
                                                    <div style={{ position: 'absolute', top: 6, right: 8 }}>
                                                        <button aria-label="Copy message" onClick={() => { navigator.clipboard.writeText(m.content); copiedRef.current = idx; setTimeout(() => { if (copiedRef.current === idx) copiedRef.current = null; }, 1200); }} className="text-white/60 hover:text-white" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                                            {copiedRef.current === idx ? (
                                                                <CheckIcon className="w-4 h-4" />
                                                            ) : (
                                                                <CopyIcon className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <Markdown>{m.content}</Markdown>
                                                </>
                                            ) : (
                                                <div>{m.content}</div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            <Textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => {
                                    setValue(e.target.value);
                                    adjustHeight();
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                placeholder="Ask the Orchestrator..."
                                containerClassName="w-full"
                                className={cn(
                                    "w-full px-4 py-3",
                                    "resize-none",
                                    "bg-transparent",
                                    "border-none",
                                    "text-white/90 text-sm",
                                    "focus:outline-none",
                                    "placeholder:text-white/20",
                                    "min-h-[60px]"
                                )}
                                style={{
                                    overflow: "hidden",
                                }}
                                showRing={false}
                            />
                        </div>

                        <AnimatePresence>
                            {attachments.length > 0 && (
                                <motion.div 
                                    className="px-4 pb-3 flex gap-2 flex-wrap"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    {attachments.map((file, index) => (
                                        <motion.div
                                            key={index}
                                            className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                        >
                                            <span>{file}</span>
                                            <button 
                                                onClick={() => removeAttachment(index)}
                                                className="text-white/40 hover:text-white transition-colors"
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="p-4 border-t border-white/[0.05] flex items-center justify-end gap-4">
                            <div className="text-xs text-white/40 mr-auto">Enter to send • Shift+Enter newline • Type "/" for commands</div>
                            <motion.button
                                type="button"
                                onClick={handleSendMessage}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={isTyping || !value.trim()}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                    "flex items-center gap-2",
                                    value.trim()
                                        ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10"
                                        : "bg-white/[0.05] text-white/40"
                                )}
                            >
                                {isTyping ? (
                                    <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                                ) : (
                                    <SendIcon className="w-4 h-4" />
                                )}
                                <span>Send</span>
                            </motion.button>
                        </div>
                    </motion.div>
                    {/* Suggestion chips removed to avoid footer clutter */}
                </motion.div>
            </div>

            {isMounted && createPortal(
                <AnimatePresence>
                    {isTyping && (
                        <motion.div className="pointer-events-none fixed left-[50vw] bottom-6 -translate-x-1/2 backdrop-blur-2xl bg-white/[0.06] rounded-full px-3 py-1.5 shadow-lg border border-white/[0.08]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-white/[0.1] flex items-center justify-center text-center">
                                    <span className="text-[11px] font-medium text-white/90">O</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-white/80">
                                    <span>Thinking</span>
                                    <TypingDots />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>, document.body)}

            {inputFocused && (
                <div className="absolute inset-0 -z-10 pointer-events-none">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] rounded-full opacity-[0.02] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[96px]" />
                </div>
            )}
            {isMounted && createPortal(
                <AnimatePresence>
                    {showToast && (
                        <motion.div className={cn('fixed bottom-4 left-4 z-[1000] rounded-md px-3 py-2 text-sm shadow', showToast.kind === 'error' ? 'bg-red-600/90 text-white' : 'bg-black/80 text-white')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                            {showToast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>, document.body)}
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{ 
                        opacity: [0.3, 0.9, 0.3],
                        scale: [0.85, 1.1, 0.85]
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{
                        boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)"
                    }}
                />
            ))}
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
}

function ActionButton({ icon, label }: ActionButtonProps) {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
        <motion.button
            type="button"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-full border border-neutral-800 text-neutral-400 hover:text-white transition-all relative overflow-hidden group"
        >
            <div className="relative z-10 flex items-center gap-2">
                {icon}
                <span className="text-xs relative z-10">{label}</span>
            </div>
            
            <AnimatePresence>
                {isHovered && (
                    <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-indigo-500/10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />
                )}
            </AnimatePresence>
            
            <motion.span 
                className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500"
                initial={{ width: 0 }}
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.3 }}
            />
        </motion.button>
    );
}

const rippleKeyframes = `
@keyframes ripple {
  0% { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}
`;

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = rippleKeyframes;
    document.head.appendChild(style);
}


