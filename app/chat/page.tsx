"use client";

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user'|'assistant'; content: string };

export default function ChatPage() {
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setBusy(true);
    const nextHistory = [...history, { role:'user', content: text }];
    setHistory(nextHistory);

    try {
      const r = await fetch('/api/agentic/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, conversation_history: nextHistory }),
      });
      const data = await r.json();
      const content = data?.content || 'No response';
      setHistory(h => [...h, { role:'assistant', content }]);
    } catch (e:any) {
      setHistory(h => [...h, { role:'assistant', content: `⚠️ Error: ${String(e)}` }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="mb-4">Agentic Grok Chat</h1>
        <p className="text-secondary mb-4">Backed by the local Agentic Grok service with server-side tools.</p>

        <div className="card" style={{ minHeight: 300 }}>
          {history.length === 0 && (
            <div className="text-secondary">Start a conversation…</div>
          )}
          {history.map((m, i) => (
            <div key={i} style={{
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--color-border)'
            }}>
              <strong>{m.role === 'user' ? 'You' : 'Assistant'}</strong>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>

        <div className="flex mt-4" style={{ display:'flex', gap:8 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' ? send() : undefined}
            placeholder={busy ? 'Thinking…' : 'Type your message'}
            className="input"
            disabled={busy}
            aria-label="Chat message"
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={send} disabled={busy}>Send</button>
        </div>
      </div>
    </div>
  );
}
