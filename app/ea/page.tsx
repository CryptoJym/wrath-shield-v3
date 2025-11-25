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
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">James Visual Cortex</p>
          <h1 className="text-3xl font-semibold">Entropy ⇢ Coherence Control Room</h1>
          <p className="text-slate-300">
            Live narrative of agentic flows: lifelog ingestion → reasoning layers → action executors.
          </p>
        </header>

        <section className="flex flex-wrap gap-3">
          <Pill label="Proposed" value={counts?.proposed ?? 0} tone="blue" />
          <Pill label="Queued" value={counts?.queued ?? 0} tone="amber" />
          <Pill label="Executed" value={counts?.executed ?? 0} tone="green" />
          <Pill label="Failed" value={counts?.failed ?? 0} tone="red" />
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <Column title="Up Next (proposed)" items={samples?.proposed} tone="blue" onAction={handleAction(mutate, setBusy)} />
          <Column title="Queued / Needs Input" items={samples?.queued} tone="amber" onAction={handleAction(mutate, setBusy)} />
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
}: {
  title: string;
  items: any[];
  tone: "blue" | "green" | "amber" | "red";
  onAction?: (id: string, action: "execute" | "dismiss" | "queue") => void;
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
          items.map((item) => <Card key={item.id} item={item} onAction={onAction} />)
        ) : (
          <p className="text-sm text-slate-500">Nothing here right now.</p>
        )}
      </div>
    </div>
  );
}

function Card({ item, onAction }: { item: any; onAction?: (id: string, action: "execute" | "dismiss" | "queue") => void }) {
  return (
    <div className="rounded-xl bg-slate-800/80 p-3 space-y-1 border border-slate-700">
      <div className="text-sm font-semibold">{item.title || item.type}</div>
      <div className="text-sm text-slate-300 whitespace-pre-line line-clamp-4">{item.content}</div>
      <div className="text-xs text-slate-500 flex gap-3">
        <span>confidence: {item.confidence ?? "n/a"}</span>
        <span>target: {item.target ?? "n/a"}</span>
      </div>
      {onAction && (
        <div className="flex gap-2 pt-1">
          <ActionButton label="Execute" onClick={() => onAction(item.id, "execute")} tone="green" />
          <ActionButton label="Queue" onClick={() => onAction(item.id, "queue")} tone="blue" />
          <ActionButton label="Dismiss" onClick={() => onAction(item.id, "dismiss")} tone="red" />
        </div>
      )}
    </div>
  );
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
