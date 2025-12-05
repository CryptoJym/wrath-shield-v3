"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Pill({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "red" | "blue" }) {
  const toneMap = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
  } as const;
  return (
    <div className={`rounded-full px-3 py-1 text-sm font-semibold ${toneMap[tone]}`}>
      {label}: {value}
    </div>
  );
}

export default function EAStatusPage() {
  const { data, isLoading, mutate } = useSWR("/api/agentic/status", fetcher, { refreshInterval: 5000 });
  const [busy, setBusy] = useState(false);

  const samples = useMemo(() => data?.samples || {}, [data]);
  const counts = useMemo(() => data?.counts || {}, [data]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-400 font-bold mb-1">James Visual Cortex</p>
            <h1 className="text-3xl font-semibold text-white">Entropy ⇢ Coherence Control Room</h1>
          </div>

          {/* Continuity Narrative */}
          <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-xl backdrop-blur-sm">
            {data?.narrative ? (
              <>
                <p className="text-lg text-slate-200 leading-relaxed mb-4 font-light">
                  {data.narrative.summary}
                </p>
                {data.narrative.threads && data.narrative.threads.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-4 border-t border-slate-800 pt-4">
                    {data.narrative.threads.map((thread: any, idx: number) => (
                      <div key={idx} className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2
                                    ${thread.status === 'active' ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300' :
                          thread.status === 'stalled' ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' :
                            'bg-slate-800 border-slate-700 text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${thread.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="font-semibold">{thread.title}</span>
                        <span className="opacity-60 border-l border-white/10 pl-2 ml-1">{thread.last_update}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 text-slate-400 italic">
                <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                Synthesizing continuity narrative...
              </div>
            )}
          </div>
        </header>

        <section className="flex flex-wrap gap-3">
          <Pill label="Proposed" value={counts?.proposed ?? 0} tone="blue" />
          <Pill label="Queued" value={counts?.queued ?? 0} tone="amber" />
          <Pill label="Executed" value={counts?.executed ?? 0} tone="green" />
          <Pill label="Failed" value={counts?.failed ?? 0} tone="red" />
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <Column title="Up Next (proposed)" items={samples?.proposed} tone="blue" onAction={handleAction(mutate, setBusy)} onAdjudicate={handleAdjudicate(mutate, setBusy)} />
          <Column title="Queued / Needs Input" items={samples?.queued} tone="amber" onAction={handleAction(mutate, setBusy)} onAdjudicate={handleAdjudicate(mutate, setBusy)} />
          <Column title="Recently Executed" items={samples?.executed} tone="green" />
          <Column title="Failures" items={samples?.failed} tone="red" />
        </section>

        <footer className="text-xs text-slate-500">
          Updated every 5s. Executors auto-run for confidence ≥ threshold; low-confidence items trigger context-enricher
          outreach.
        </footer>
      </div>
      {(isLoading || busy) && <div className="fixed bottom-4 right-4 text-xs text-slate-400">Syncing…</div>}
    </div>
  );
}


function Column({
  title,
  items,
  tone,
  onAction,
  onAdjudicate,
}: {
  title: string;
  items: any[];
  tone: "blue" | "green" | "amber" | "red";
  onAction?: (id: string, action: "execute" | "dismiss" | "queue") => void;
  onAdjudicate?: (id: string, hint: string) => void;
}) {
  const border = {
    blue: "border-sky-500/50",
    green: "border-emerald-500/50",
    amber: "border-amber-500/50",
    red: "border-rose-500/50",
  }[tone];

  return (
    <div className={`rounded-2xl border ${border} bg-slate-900/70 p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {items?.length ? (
          items.map((item) => <Card key={item.id} item={item} onAction={onAction} onAdjudicate={onAdjudicate} />)
        ) : (
          <p className="text-sm text-slate-500">Nothing here right now.</p>
        )}
      </div>
    </div>
  );
}

function Card({ item, onAction, onAdjudicate }: {
  item: any;
  onAction?: (id: string, action: "execute" | "dismiss" | "queue") => void;
  onAdjudicate?: (id: string, hint: string) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-800/80 p-3 space-y-2 border border-slate-700 group hover:border-slate-500 transition-colors">
      <div className="text-sm font-semibold text-slate-200">{item.title || item.type}</div>
      <div className="text-xs text-slate-400 whitespace-pre-line line-clamp-3 leading-relaxed">{item.content}</div>
      <div className="text-[10px] text-slate-500 flex gap-3 uppercase tracking-wider font-medium">
        <span>conf: {Math.round((item.confidence || 0) * 100)}%</span>
        <span>target: {item.target || "tbd"}</span>
      </div>

      {/* Expanded Actions Grid */}
      {onAdjudicate && (
        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-700/50">
          <AdjudicateBtn label="Finance" onClick={() => onAdjudicate(item.id, "finance")} color="emerald" />
          <AdjudicateBtn label="Legal" onClick={() => onAdjudicate(item.id, "legal")} color="purple" />
          <AdjudicateBtn label="PM" onClick={() => onAdjudicate(item.id, "pm")} color="blue" />
          <AdjudicateBtn label="Work" onClick={() => onAdjudicate(item.id, "work")} color="indigo" />

          <AdjudicateBtn label="News" onClick={() => onAdjudicate(item.id, "news")} color="slate" />
          <AdjudicateBtn label="Deals" onClick={() => onAdjudicate(item.id, "deals")} color="amber" />
          <AdjudicateBtn label="Flag" onClick={() => onAdjudicate(item.id, "urgent")} color="rose" />
          <AdjudicateBtn label="Junk" onClick={() => onAdjudicate(item.id, "junk")} color="gray" />
        </div>
      )}

      {onAction && !onAdjudicate && (
        <div className="flex gap-2 pt-1">
          <ActionButton label="Execute" onClick={() => onAction(item.id, "execute")} tone="green" />
          <ActionButton label="Queue" onClick={() => onAction(item.id, "queue")} tone="blue" />
          <ActionButton label="Dismiss" onClick={() => onAction(item.id, "dismiss")} tone="red" />
        </div>
      )}
    </div>
  );
}

function AdjudicateBtn({ label, onClick, color }: { label: string, onClick: () => void, color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-800/50 border-emerald-800/50',
    purple: 'bg-purple-900/30 text-purple-300 hover:bg-purple-800/50 border-purple-800/50',
    blue: 'bg-blue-900/30 text-blue-300 hover:bg-blue-800/50 border-blue-800/50',
    indigo: 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-800/50 border-indigo-800/50',
    slate: 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700',
    amber: 'bg-amber-900/30 text-amber-300 hover:bg-amber-800/50 border-amber-800/50',
    rose: 'bg-rose-900/30 text-rose-300 hover:bg-rose-800/50 border-rose-800/50',
    gray: 'bg-slate-900 text-slate-500 hover:bg-slate-800 border-slate-700',
  }
  return (
    <button onClick={onClick} className={`text-[10px] py-1 px-1 rounded border transition-colors ${colors[color] || colors.slate}`}>
      {label}
    </button>
  )
}

function ActionButton({ label, onClick, tone }: { label: string; onClick: () => void; tone: "green" | "blue" | "red" }) {
  const toneMap = {
    green: "bg-emerald-600 hover:bg-emerald-500",
    blue: "bg-sky-600 hover:bg-sky-500",
    red: "bg-rose-600 hover:bg-rose-500",
  } as const;
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full text-white transition ${toneMap[tone]}`}
    >
      {label}
    </button>
  );
}


function handleAction(mutate: any, setBusy: any) {
  return async (id: string, action: "execute" | "dismiss" | "queue") => {
    setBusy(true);
    try {
      await fetch("/api/agentic/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      await mutate();
    } finally {
      setBusy(false);
    }
  };
}

function handleAdjudicate(mutate: any, setBusy: any) {
  return async (id: string, hint: string) => {
    setBusy(true);
    try {
      await fetch("/api/agentic/adjudicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, hint }),
      });
      await mutate();
    } finally {
      setBusy(false);
    }
  }
}
