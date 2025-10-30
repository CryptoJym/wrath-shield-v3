/**
 * Wrath Shield v3 - Chat Inline Flags Demo
 */
"use client";

import { useMemo, useState } from 'react';
import { analyzeText } from '@/lib/speechMiner';
import { buildHighlightSegments } from '@/lib/flagHighlighter';
import { replaceFirst } from '@/lib/textReplace';

type Flag = ReturnType<typeof analyzeText>['flags'][number];

export default function ChatInlineFlagsPage() {
  const [text, setText] = useState('I feel like this is probably wrong, but in my opinion it might work for me.');
  const [activePhrase, setActivePhrase] = useState<string | null>(null);
  const [chips, setChips] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const analysis = useMemo(() => analyzeText(text), [text]);
  const flags = analysis.flags as Flag[];

  const segments = useMemo(() => {
    return buildHighlightSegments(text, flags.map((f) => ({ position: f.position, phrase: f.phrase })));
  }, [text, flags]);

  async function fetchSuggestions(phrase: string) {
    try {
      setLoading(true);
      setError(null);
      setChips(null);
      setActivePhrase(phrase);
      const res = await fetch('/api/awe/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase }),
      });
      const fallback = ['I will', 'I can', 'I decide', "Let's proceed", 'Proceeding'];
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        // Provide graceful fallback suggestions
        setChips(fallback);
      } else {
        const options: string[] = Array.isArray(data.suggestion?.options)
          ? data.suggestion.options
          : [];
        setChips((options.length ? options : fallback).slice(0, 5));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-green mb-4">Chat — Inline Flags</h1>

        <div className="card mb-6">
          <label className="block text-secondary mb-2">Type a message to analyze</label>
          <textarea
            className="input w-full h-32"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="card mb-2">
          <div className="prose-sm leading-7">
            {segments.map((seg, i) => (
              <span
                key={i}
                style={seg.flagged ? { textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationColor: '#C92C2C' } : undefined}
                className={seg.flagged ? 'cursor-pointer' : ''}
                onClick={() => seg.flagged && fetchSuggestions(seg.text)}
                title={seg.flagged ? 'Click for rewrite suggestions' : undefined}
              >
                {seg.text}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 text-secondary">
          {flags.length} flags, avg severity {analysis.averageSeverity.toFixed(2)} · {Math.round(analysis.processingTime)}ms
        </div>

        {(loading || error || (chips && activePhrase)) && (
          <div className="card mt-4">
            <div className="flex items-center gap-2 mb-2">
              <strong>Rewrite</strong>
              {activePhrase && <code className="text-secondary">“{activePhrase}”</code>}
            </div>
            {loading && <div className="text-secondary">Loading suggestions…</div>}
            {error && <div className="text-danger">{error}</div>}
            {!loading && !error && chips && (
              <div className="flex flex-wrap gap-2">
                {chips.map((c, idx) => (
                  <button
                    key={idx}
                    className="chip"
                    type="button"
                    disabled={replacing}
                    aria-disabled={replacing}
                    onClick={() => {
                      if (!activePhrase) return;
                      setReplacing(true);
                      const next = replaceFirst(text, activePhrase, c);
                      setText(next);
                      setReplacing(false);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {process.env.NEXT_PUBLIC_SLASH_COMMANDS_ENABLED === 'true' && (
          <div className="card mt-6">
            <div className="mb-2 text-secondary">Slash commands enabled — try typing /help and press Enter</div>
            {/* Lazy import to avoid SSR chunk surprises not needed since this is a client page */}
            {(() => {
              const ChatSlashInput = require('@/components/ChatSlashInput').default as typeof import('@/components/ChatSlashInput').default;
              const [out, setOut] = [undefined as unknown as string | undefined, undefined] as any; // placeholder for TS within IIFE
              return (
                <div>
                  <ChatSlashInput onCommandOutput={(t: string) => {
                    const el = document.getElementById('slash-output');
                    if (el) el.textContent = t;
                  }} />
                  <div id="slash-output" className="mt-2 text-secondary" aria-live="polite" />
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
