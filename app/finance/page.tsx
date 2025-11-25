"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const startDay = parseInt(process.env.NEXT_PUBLIC_FINANCE_CYCLE_START_DAY || "8", 10);

function cycleWindow(ref: Date, day = startDay) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  const start = new Date(y, d >= day ? m : m - 1, day);
  const end = new Date(y, d >= day ? m + 1 : m, day);
  return { start, end };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildCycleOptions(count = 6) {
  const options: { label: string; start: string; end: string }[] = [];
  let ref = new Date();
  for (let i = 0; i < count; i++) {
    const { start, end } = cycleWindow(ref);
    options.push({
      label: `Cycle ${iso(start)} → ${iso(end)}`,
      start: iso(start),
      end: iso(end),
    });
    // step back one month
    ref = new Date(start.getFullYear(), start.getMonth() - 1, startDay + 1);
  }
  // last 30d convenience
  const last30End = new Date();
  const last30Start = new Date(Date.now() - 29 * 24 * 3600 * 1000);
  options.unshift({ label: "Last 30 days", start: iso(last30Start), end: iso(last30End) });
  return options;
}

export default function FinancePage() {
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const cycles = useMemo(() => buildCycleOptions(), []);
  const effectiveRange = range ?? { start: cycles[0].start, end: cycles[0].end };
  const summaryUrl = `/api/finance/summary?start=${effectiveRange.start}&end=${effectiveRange.end}`;

  const { data: summary } = useSWR(summaryUrl, fetcher, { refreshInterval: 30000 });
  const { data: ctx, mutate: mutateCtx } = useSWR("/api/finance/context-requests", fetcher, { refreshInterval: 15000 });
  const [vendorWindow, setVendorWindow] = useState<"cycle" | "90d" | "all">("90d");
  const vendorUrl = useMemo(() => {
    if (vendorWindow === "cycle" && summary?.window?.start && summary?.window?.end) {
      return `/api/finance/vendors?start=${summary.window.start}&end=${summary.window.end}`;
    }
    if (vendorWindow === "90d" && summary?.back90?.start && summary?.back90?.end) {
      return `/api/finance/vendors?start=${summary.back90.start}&end=${summary.back90.end}`;
    }
    return "/api/finance/vendors";
  }, [vendorWindow, summary]);
  const { data: vendors } = useSWR(vendorUrl, fetcher, { refreshInterval: 60000 });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="text-3xl font-semibold">Spend Snapshot & Clarifications</h1>
          <p className="text-slate-300">Cycle + 90d rollups and low-confidence transactions that need context.</p>
        </header>

        <div className="flex flex-wrap gap-3 items-center text-sm">
          <span className="text-slate-400">Window:</span>
          <select
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
            value={`${effectiveRange.start}|${effectiveRange.end}`}
            onChange={(e) => {
              const [s, en] = e.target.value.split("|");
              setRange({ start: s, end: en });
            }}
          >
            {cycles.map((c) => (
              <option key={c.label} value={`${c.start}|${c.end}`}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Start day anchored to the 8th.</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card title="Current Cycle" subtitle={`${summary?.window?.start ?? "?"} → ${summary?.window?.end ?? "?"}`}>
            <BucketGrid buckets={summary?.buckets} />
            <p className="text-xs text-slate-500 mt-2">{summary?.count ?? 0} transactions</p>
          </Card>
          <Card
            title="Last 90 Days"
            subtitle={`${summary?.back90?.start ?? "?"} → ${summary?.back90?.end ?? "?"}`}
          >
            <BucketGrid buckets={summary?.back90?.buckets} />
            <p className="text-xs text-slate-500 mt-2">{summary?.back90?.count ?? 0} transactions</p>
          </Card>
        </div>

      <Card
        title="Pending Context Requests"
        subtitle="Low-confidence or unknown transactions. Add a brief summary or mark resolved."
      >
        <ContextList requests={ctx?.requests || []} mutate={mutateCtx} />
      </Card>

      <Card title="Top Vendors" subtitle="Helps validate classification and reimbursement decisions.">
        <div className="flex gap-3 items-center text-xs text-slate-300 mb-2">
          <span className="text-slate-400">Window:</span>
          <select
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
            value={vendorWindow}
            onChange={(e) => setVendorWindow(e.target.value as any)}
          >
            <option value="cycle">Current cycle</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <VendorList vendors={vendors?.vendors || []} />
      </Card>
    </div>
  </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function BucketGrid({ buckets }: { buckets?: Record<string, number> }) {
  if (!buckets || Object.keys(buckets).length === 0) {
    return <p className="text-sm text-slate-500">No data.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
      {Object.entries(buckets).map(([bucket, amt]) => (
        <div key={bucket} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
          <div className="text-sm text-slate-400">{bucket}</div>
          <div className="text-lg font-semibold text-slate-100">${amt.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

function ContextList({ requests, mutate }: { requests: any[]; mutate?: any }) {
  if (!requests.length) return <p className="text-sm text-slate-500">No pending items.</p>;
  return (
    <div className="space-y-2 max-h-[480px] overflow-auto pr-1">
      {requests.map((r) => (
        <ContextItem key={r.id} r={r} mutate={mutate} />
      ))}
    </div>
  );
}

function ContextItem({ r, mutate }: { r: any; mutate?: any }) {
  const [summary, setSummary] = useState(r.summary || "");
  const [bucket, setBucket] = useState(r.bucket || "");
  const [project, setProject] = useState(r.project || "");
  const [reimbursable, setReimbursable] = useState<boolean | null>(null);
  const [note, setNote] = useState(r.note || "");
  const [rationale, setRationale] = useState(r.rationale || "");
  const [saving, setSaving] = useState(false);

  const resolve = async () => {
    setSaving(true);
    await fetch("/api/finance/context-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: r.id,
        status: "resolved",
        summary,
        bucket: bucket || undefined,
        project: project || undefined,
        reimbursable: reimbursable === null ? undefined : reimbursable,
        note: note || undefined,
        rationale: rationale || undefined,
      }),
    });
    setSaving(false);
    mutate?.();
  };

  const classify = async () => {
    setSaving(true);
    await fetch("/api/finance/context-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: r.id, llm: true }),
    });
    setSaving(false);
    mutate?.();
  };

  return (
    <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60 space-y-2 text-sm">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{r.vendor || "(vendor unknown)"}</span>
        <span>{r.date || ""}</span>
      </div>
      <div className="text-slate-200">Amount: {r.amount ?? "n/a"}</div>
      <div className="text-xs text-slate-500">Confidence: {r.confidence ?? 0}</div>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Add a brief context summary (e.g., invoice, subscription, reimbursable?)"
        className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-xs text-slate-100"
        rows={2}
      />
      <input
        className="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100 text-xs"
        placeholder="What is this for? (note for future automation)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <input
        className="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100 text-xs"
        placeholder="Why reimbursable / not? (reason to teach agent)"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
      />
      <div className="flex gap-2 items-center text-xs text-slate-400">
        <input
          className="flex-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100"
          placeholder="Bucket (e.g., work_reimbursable)"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
        />
        <input
          className="flex-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100"
          placeholder="Project (optional)"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={reimbursable === true} onChange={() => setReimbursable(reimbursable === true ? null : true)} />
          Reimbursable
        </label>
      </div>
      <button
        onClick={resolve}
        disabled={saving}
        className="text-xs px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Mark resolved"}
      </button>
      <button
        onClick={classify}
        disabled={saving}
        className="text-xs px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Classify with AI"}
      </button>
      <button
        onClick={async () => {
          setSaving(true);
          await fetch("/api/finance/context-requests/resolve-mail", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ limit: 3 }),
          });
          setSaving(false);
          mutate?.();
        }}
        disabled={saving}
        className="text-xs px-3 py-1 rounded-full bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Try inbox lookup"}
      </button>
    </div>
  );
}

function VendorList({ vendors }: { vendors: { vendor: string; total: number; count: number }[] }) {
  if (!vendors.length) return <p className="text-sm text-slate-500">No vendor data.</p>;
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
      {vendors.map((v) => (
        <div key={v.vendor || "unknown"} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
          <div className="text-sm text-slate-300 line-clamp-1">{v.vendor || "(unknown)"}</div>
          <div className="text-lg font-semibold text-slate-100">${v.total.toFixed(2)}</div>
          <div className="text-xs text-slate-500">{v.count} tx</div>
        </div>
      ))}
    </div>
  );
}
