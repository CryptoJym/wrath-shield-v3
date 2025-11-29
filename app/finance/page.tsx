"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { PlaidLink } from "@/components/finance/PlaidLink";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const startDay = parseInt(process.env.NEXT_PUBLIC_FINANCE_CYCLE_START_DAY || "8", 10);

function cycleWindow(ref: Date, day = startDay) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  // If current day is >= cycle start day, cycle started this month
  // Otherwise, cycle started last month
  const start = new Date(y, d >= day ? m : m - 1, day);
  // End is always start day of next month (exclusive)
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
    ref = new Date(start.getFullYear(), start.getMonth() - 1, startDay + 1);
  }
  // Convenience ranges
  const last30End = new Date();
  const last30Start = new Date(Date.now() - 29 * 24 * 3600 * 1000);
  const last180Start = new Date(Date.now() - 179 * 24 * 3600 * 1000);
  const allDataStart = new Date("2020-01-01");
  options.unshift(
    { label: "All data", start: iso(allDataStart), end: iso(last30End) },
    { label: "Last 6 months", start: iso(last180Start), end: iso(last30End) },
    { label: "Last 30 days", start: iso(last30Start), end: iso(last30End) },
  );
  return options;
}

export const dynamic = 'force-dynamic';

export default function FinancePage() {
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  // Stable cycle options - only compute on client after mount to avoid hydration mismatch
  const [cycles, setCycles] = useState<{ label: string; start: string; end: string }[]>([]);
  const [mounted, setMounted] = useState(false);

  // Build cycles only on client side after mount
  useEffect(() => {
    const options = buildCycleOptions();
    setCycles(options);
    setMounted(true);
  }, []);

  // Default to "Last 6 months" for richer data on load
  const defaultRange = useMemo(() => cycles.find((c) => c.label === "Last 6 months") ?? cycles[0], [cycles]);
  const effectiveRange = range ?? defaultRange;

  // Only construct URLs if we have valid ranges (prevents fetching with undefined values during hydration)
  const hasValidRange = mounted && cycles.length > 0 && effectiveRange?.start && effectiveRange?.end;
  const summaryUrl = hasValidRange ? `/api/finance/summary?start=${effectiveRange.start}&end=${effectiveRange.end}` : null;
  const txnsUrl = hasValidRange ? `/api/finance/txns?start=${effectiveRange.start}&end=${effectiveRange.end}` : null;

  // Previous cycle window (UI only, reuse summary API)
  const prevRange = useMemo(() => {
    if (!effectiveRange?.start) return null;
    const ref = new Date(effectiveRange.start);
    ref.setDate(ref.getDate() - 1);
    const { start, end } = cycleWindow(ref);
    return { start: iso(start), end: iso(end) };
  }, [effectiveRange?.start]);
  const prevSummaryUrl = prevRange ? `/api/finance/summary?start=${prevRange.start}&end=${prevRange.end}` : null;

  const { data: summarySWR, isLoading: summaryLoading, error: summaryError } = useSWR(summaryUrl, fetcher, { refreshInterval: 30000 });
  const { data: prev, isLoading: prevLoading } = useSWR(prevSummaryUrl, fetcher, { refreshInterval: 60000 });
  const { data: ctx, mutate: mutateCtx } = useSWR("/api/finance/context-requests", fetcher, { refreshInterval: 15000 });
  const { data: txns, mutate: mutateTxns } = useSWR(txnsUrl, fetcher, { refreshInterval: 45000 });
  const { data: opts } = useSWR("/api/finance/options", fetcher, { refreshInterval: 120000 });

  // Client-side fallback fetch to guarantee data binding even if SWR is stale or blocked
  const [summaryOverride, setSummaryOverride] = useState<any | null>(null);
  const [summaryOverrideLoading, setSummaryOverrideLoading] = useState(false);
  const [summaryOverrideError, setSummaryOverrideError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasValidRange || !summaryUrl) return;
    setSummaryOverrideLoading(true);
    fetch(summaryUrl, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        setSummaryOverride(json);
        setSummaryOverrideError(null);
      })
      .catch((err) => setSummaryOverrideError(err?.message || 'fetch failed'))
      .finally(() => setSummaryOverrideLoading(false));
  }, [hasValidRange, summaryUrl]);

  const summary = summaryOverride || summarySWR;
  const summaryLoadingFinal = summaryLoading || summaryOverrideLoading;
  const summaryErrorFinal = summaryError || (summaryOverrideError ? { message: summaryOverrideError } : undefined);
  const [bulkVendor, setBulkVendor] = useState("");
  const [bulkBucket, setBulkBucket] = useState("");
  const [bulkProject, setBulkProject] = useState("");
  const [bulkReimb, setBulkReimb] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [vendorWindow, setVendorWindow] = useState<"cycle" | "90d" | "all">("cycle");
  const vendorUrl = useMemo(() => {
    if (!hasValidRange) return null; // Don't fetch until we have valid ranges
    if (vendorWindow === "cycle" && summary?.window?.start && summary?.window?.end) {
      return `/api/finance/vendors?start=${summary.window.start}&end=${summary.window.end}`;
    }
    if (vendorWindow === "90d" && summary?.back90?.start && summary?.back90?.end) {
      return `/api/finance/vendors?start=${summary.back90.start}&end=${summary.back90.end}`;
    }
    return "/api/finance/vendors";
  }, [vendorWindow, summary, hasValidRange]);
  const { data: vendors } = useSWR(vendorUrl, fetcher, { refreshInterval: 60000 });

  const currentTotal = sumBuckets(summary?.buckets);
  const prevTotal = sumBuckets(prev?.buckets);
  const deltaTotal = currentTotal - prevTotal;

  const bucketDelta = useMemo(() => {
    const deltas: Record<string, number> = {};
    const cur = summary?.buckets || {};
    const prv = prev?.buckets || {};
    const keys = new Set([...Object.keys(cur), ...Object.keys(prv)]);
    keys.forEach((k) => {
      deltas[k] = (cur[k] || 0) - (prv[k] || 0);
    });
    return deltas;
  }, [summary, prev]);

  const applyBulk = async () => {
    if (!bulkVendor || !hasValidRange) return;
    setBulkSaving(true);
    await fetch("/api/finance/txns/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vendor: bulkVendor,
        start: effectiveRange!.start,
        end: effectiveRange!.end,
        bucket: bulkBucket || null,
        project: bulkProject || null,
        reimbursable: bulkReimb,
      }),
    });
    setBulkSaving(false);
    mutateTxns?.();
  };

  const classifyWindow = async (rows: Txn[]) => {
    const targets = rows
      .filter((r) => !r.bucket || r.bucket === 'unknown' || r.reimbursable === undefined || r.reimbursable === null || r.status !== 'classified')
      .map((r) => r.id);
    if (!targets.length) return;
    setClassifying(true);
    await fetch('/api/finance/classify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: targets.slice(0, 50) }),
    });
    setClassifying(false);
    mutateTxns?.();
  };


  // Show loading skeleton until client-side hydration completes AND we have valid cycles
  if (!mounted || cycles.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Finance</p>
            <h1 className="text-3xl font-semibold">Spend Snapshot & Clarifications</h1>
            <p className="text-slate-300">Loading...</p>
          </header>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-800 rounded w-64" />
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-slate-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="text-3xl font-semibold">Spend Snapshot & Clarifications</h1>
          <p className="text-slate-300">Cycle + 90d rollups and low-confidence transactions that need context.</p>
        </header>

        {/* Debug: Data status */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs bg-slate-800 rounded p-3 mb-2 space-y-1 border border-slate-700">
            <div className="text-slate-400 font-semibold">Debug: Finance API Status</div>
            <div className="text-slate-500">
              Cycles: {cycles.length} | hasValidRange: {hasValidRange ? 'yes' : 'no'} |
              window: {effectiveRange?.start ?? '?'} → {effectiveRange?.end ?? '?'}
            </div>
            <div className={summaryErrorFinal || summary?.error ? 'text-red-400' : 'text-slate-500'}>
              Summary: {summary ? `${summary.count} txns, ${Object.keys(summary.buckets || {}).length} buckets, total=$${sumBuckets(summary.buckets).toFixed(2)}` : summaryLoadingFinal ? 'loading...' : 'no data'}
              {summary?.error && <span className="text-red-400 ml-2">→ API Error: {summary.error}</span>}
              {summaryErrorFinal && <span className="text-red-400 ml-2">→ Fetch Error: {summaryErrorFinal.message || 'unknown'}</span>}
            </div>
            <div className={txns?.error ? 'text-red-400' : 'text-slate-500'}>
              Txns: {txns ? `${txns.txns?.length || 0} loaded` : 'loading...'}
              {txns?.error && <span className="text-red-400 ml-2">→ API Error: {txns.error}</span>}
            </div>
            <div className="text-slate-600 text-[10px]">URL: {summaryUrl || 'null'}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center text-sm">
          <span className="text-slate-400">Window:</span>
          <select
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
            value={effectiveRange ? `${effectiveRange.start}|${effectiveRange.end}` : ''}
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
          <PlaidLink onSuccess={() => mutateTxns?.()} />
          {hasValidRange && (
            <a
              className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-200"
              href={`/finance/print?start=${effectiveRange.start}&end=${effectiveRange.end}`}
              target="_blank"
              rel="noreferrer"
            >
              Printable report
            </a>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card
            title="Selected window"
            subtitle={`${summary?.window?.start ?? "?"} → ${summary?.window?.end ?? "?"}`}
          >
              <BucketGrid buckets={summary?.buckets} error={summary?.error} loading={summaryLoadingFinal} />
            <TotalsFooter label="Total" amount={sumBuckets(summary?.buckets)} count={summary?.count ?? 0} />
          </Card>

          <Card
            title="Previous cycle"
            subtitle={`${prev?.window?.start ?? (prevRange?.start || '?')} → ${prev?.window?.end ?? (prevRange?.end || '?')}`}
          >
            <BucketGrid buckets={prev?.buckets} error={prev?.error} loading={prevLoading} />
            <TotalsFooter label="Total" amount={sumBuckets(prev?.buckets)} count={prev?.count ?? 0} />
          </Card>

          <Card
            title="Last 90 Days"
            subtitle={`${summary?.back90?.start ?? "?"} → ${summary?.back90?.end ?? "?"}`}
          >
              <BucketGrid buckets={summary?.back90?.buckets} error={summary?.back90?.error} loading={summaryLoadingFinal} />
            <TotalsFooter
              label="Total"
              amount={sumBuckets(summary?.back90?.buckets)}
              count={summary?.back90?.count ?? 0}
            />
          </Card>
        </div>

        <Card title="Delta vs previous cycle" subtitle="Positive = increase vs prior 8→8 cycle">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
              <div className="text-sm text-slate-400">Total delta</div>
              <div className={`text-lg font-semibold ${deltaTotal >= 0 ? 'text-amber-200' : 'text-emerald-200'}`}>
                {deltaTotal >= 0 ? '+' : ''}${deltaTotal.toFixed(2)}
              </div>
            </div>
            {Object.entries(bucketDelta).map(([b, v]) => (
              <div key={b} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                <div className="text-sm text-slate-400">{formatBucketName(b)}</div>
                <div className={`text-lg font-semibold ${v >= 0 ? 'text-amber-200' : 'text-emerald-200'}`}>
                  {v >= 0 ? '+' : ''}${v.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </Card>

      <Card title="Transactions (selected window)" subtitle="Edit bucket/project/reimbursable inline; saves immediately">
        <TransactionTable
          rows={txns?.txns || []}
          mutate={mutateTxns}
          bucketOptions={opts?.buckets || []}
          projectOptions={opts?.projects || []}
          classify={() => classifyWindow(txns?.txns || [])}
        />
      </Card>

      <Card
        title="Pending Context Requests"
        subtitle="Low-confidence or unknown transactions. Add a brief summary or mark resolved."
      >
        <ContextList requests={ctx?.requests || []} mutate={mutateCtx} />
      </Card>

          <Card title="Top Vendors" subtitle="Helps validate classification and reimbursement decisions.">
            <div className="flex flex-wrap gap-3 items-center text-xs text-slate-300 mb-2">
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

              <span className="text-slate-400">Bulk apply to vendor (current window)</span>
              <select
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
                value={bulkVendor}
                onChange={(e) => setBulkVendor(e.target.value)}
              >
                <option value="">Select vendor…</option>
                {(vendors?.vendors || []).map((v: { vendor: string | null }) => (
                  <option key={v.vendor || '(unknown)'} value={v.vendor || ''}>
                    {v.vendor || '(unknown)'}
                  </option>
                ))}
              </select>
              <input
                list="bulk-bucket"
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
                placeholder="bucket"
                value={bulkBucket}
                onChange={(e) => setBulkBucket(e.target.value)}
              />
              <input
                list="bulk-project"
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
                placeholder="project"
                value={bulkProject}
                onChange={(e) => setBulkProject(e.target.value)}
              />
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={bulkReimb} onChange={() => setBulkReimb(!bulkReimb)} />
                Reimbursable
              </label>
              <button
                onClick={applyBulk}
                disabled={!bulkVendor || bulkSaving}
                className="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
              >
                {bulkSaving ? 'Applying…' : 'Apply to vendor'}
              </button>
              <datalist id="bulk-bucket">{(opts?.buckets || []).map((b: string) => <option key={b} value={b} />)}</datalist>
              <datalist id="bulk-project">{(opts?.projects || []).map((p: string) => <option key={p} value={p} />)}</datalist>
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

function BucketGrid({ buckets, error, loading }: { buckets?: Record<string, number>; error?: string; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-20 mb-2" />
            <div className="h-6 bg-slate-700 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-400">Error: {error}</p>;
  }
  if (!buckets || Object.keys(buckets).length === 0) {
    return <p className="text-sm text-slate-500">No data.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
      {Object.entries(buckets).map(([bucket, amt]) => (
        <div key={bucket} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
          <div className="text-sm text-slate-400">{formatBucketName(bucket)}</div>
          <div className="text-lg font-semibold text-slate-100">${(amt ?? 0).toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

function TotalsFooter({ label, amount, count }: { label: string; amount: number; count: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
      <span>
        {label}: <span className="text-slate-100 font-semibold">${amount.toFixed(2)}</span>
      </span>
      <span>{count ?? 0} transactions</span>
    </div>
  );
}

function sumBuckets(buckets?: Record<string, number>) {
  if (!buckets) return 0;
  return Object.values(buckets).reduce((acc, v) => acc + (v || 0), 0);
}

/** Format bucket/category names for display: work_reimbursable → Work Reimbursable */
function formatBucketName(bucket: string): string {
  return bucket
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
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

type Txn = {
  id: string;
  vendor?: string;
  raw_desc?: string;
  date: string;
  amount: number;
  bucket?: string;
  project?: string;
  reimbursable?: boolean;
  status?: string;
  meta?: any;
};

type TxnTableProps = {
  rows: Txn[];
  mutate?: () => void;
  bucketOptions?: string[];
  projectOptions?: string[];
  classify?: () => void;
};

function TransactionTable({ rows, mutate, bucketOptions, projectOptions, classify }: TxnTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkBucket, setBulkBucket] = useState("");
  const [bulkProject, setBulkProject] = useState("");
  const [bulkReimb, setBulkReimb] = useState<boolean | null>(null);

  const filtered = showAll
    ? rows
    : rows.filter((r) => !r.bucket || r.bucket === 'unknown' || r.reimbursable === undefined || r.reimbursable === null || r.status !== 'classified');

  if (!filtered.length) return <p className="text-sm text-slate-500">No transactions in this window.</p>;

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const applyBulkToSelected = async () => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);

    // Update each selected transaction
    const promises = Array.from(selectedIds).map(id =>
      fetch("/api/finance/txns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          bucket: bulkBucket || undefined,
          project: bulkProject || undefined,
          reimbursable: bulkReimb === null ? undefined : bulkReimb,
          status: 'classified',
        }),
      })
    );

    await Promise.all(promises);
    setBulkSaving(false);
    setSelectedIds(new Set());
    mutate?.();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={showAll} onChange={() => setShowAll(!showAll)} /> Show all (including classified)
        </label>
        <span className="text-slate-500">Default shows only items needing review.</span>
        {classify && (
          <button
            onClick={classify}
            className="px-3 py-1 rounded-full bg-indigo-700 hover:bg-indigo-600 text-white"
          >
            Classify unreviewed with Grok
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-800 border border-slate-700 rounded-lg p-3">
          <span className="text-slate-300 font-semibold">{selectedIds.size} selected</span>
          <span className="text-slate-500">|</span>
          <input
            list="bulk-bucket-selected"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
            placeholder="Set bucket"
            value={bulkBucket}
            onChange={(e) => setBulkBucket(e.target.value)}
          />
          <datalist id="bulk-bucket-selected">
            {(bucketOptions || []).map((b) => <option key={b} value={b} />)}
          </datalist>
          <input
            list="bulk-project-selected"
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
            placeholder="Set project"
            value={bulkProject}
            onChange={(e) => setBulkProject(e.target.value)}
          />
          <datalist id="bulk-project-selected">
            {(projectOptions || []).map((p) => <option key={p} value={p} />)}
          </datalist>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={bulkReimb === true}
              onChange={() => setBulkReimb(bulkReimb === true ? null : true)}
            />
            Reimbursable
          </label>
          <button
            onClick={applyBulkToSelected}
            disabled={bulkSaving}
            className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {bulkSaving ? 'Applying...' : 'Apply to selected'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-auto max-h-[520px] text-sm">
        <table className="min-w-full border border-slate-800">
          <thead className="bg-slate-900 text-slate-300 text-xs uppercase sticky top-0">
            <tr>
              <th className="p-2 border-r border-slate-800">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  title="Select all"
                />
              </th>
              <th className="p-2 border-r border-slate-800">Date</th>
              <th className="p-2 border-r border-slate-800">Vendor</th>
              <th className="p-2 border-r border-slate-800">Amount</th>
              <th className="p-2 border-r border-slate-800">Bucket</th>
              <th className="p-2 border-r border-slate-800">Project</th>
              <th className="p-2 border-r border-slate-800">Reimb?</th>
              <th className="p-2 border-r border-slate-800">Note / Rationale</th>
              <th className="p-2 border-r border-slate-800">Lookup</th>
              <th className="p-2">Save / History</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <TxnRow
                key={r.id}
                r={r}
                mutate={mutate}
                bucketOptions={bucketOptions}
                projectOptions={projectOptions}
                selected={selectedIds.has(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TxnRow({ r, mutate, bucketOptions, projectOptions, selected, onToggleSelect }: { r: Txn; mutate?: () => void; bucketOptions?: string[]; projectOptions?: string[]; selected?: boolean; onToggleSelect?: () => void }) {
  const [bucket, setBucket] = useState(r.bucket || "");
  const [project, setProject] = useState(r.project || "");
  const [reimb, setReimb] = useState(!!r.reimbursable);
  const [note, setNote] = useState(r.meta?.note || "");
  const [rationale, setRationale] = useState(r.meta?.rationale || "");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const [lookup, setLookup] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch("/api/finance/txns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: r.id,
        bucket: bucket || null,
        project: project || null,
        reimbursable: reimb,
        note: note || null,
        rationale: rationale || null,
        status: 'classified',
      }),
    });
    setSaving(false);
    mutate?.();
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const res = await fetch(`/api/finance/audit?txn=${encodeURIComponent(r.id)}`);
    const data = await res.json();
    setHistory(data.audit || []);
    setLoadingHistory(false);
  };

  const fetchLookup = async () => {
    setLoadingLookup(true);
    const res = await fetch(`/api/finance/vendor-lookup?q=${encodeURIComponent(r.vendor || '')}`);
    const data = await res.json();
    setLookup(data.heading || data.abstract || JSON.stringify(data));
    setLoadingLookup(false);
  };

  return (
    <tr className={`border-t border-slate-800 ${selected ? 'bg-indigo-900/30' : ''}`}>
      <td className="p-2 align-top text-center">
        <input
          type="checkbox"
          checked={selected || false}
          onChange={onToggleSelect}
        />
      </td>
      <td className="p-2 align-top text-slate-300 whitespace-nowrap">{r.date}</td>
      <td className="p-2 align-top text-slate-100 min-w-[220px] max-w-[260px]">
        <div className="font-semibold line-clamp-2">{r.vendor || "(unknown)"}</div>
        <div className="text-xs text-slate-500 line-clamp-2">{r.raw_desc}</div>
      </td>
      <td className="p-2 align-top text-emerald-200 whitespace-nowrap">${r.amount.toFixed(2)}</td>
      <td className="p-2 align-top">
        <input
          list={`bucket-${r.id}`}
          className="w-40 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          placeholder="bucket"
        />
        <datalist id={`bucket-${r.id}`}>
          {(bucketOptions || []).map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </td>
      <td className="p-2 align-top">
        <input
          list={`project-${r.id}`}
          className="w-36 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="project"
        />
        <datalist id={`project-${r.id}`}>
          {(projectOptions || []).map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </td>
      <td className="p-2 align-top text-center">
        <input type="checkbox" checked={reimb} onChange={() => setReimb(!reimb)} />
      </td>
      <td className="p-2 align-top">
        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
        />
        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs mt-1"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why reimbursable/not?"
        />
      </td>
      <td className="p-2 align-top text-xs text-slate-400">
        <button
          onClick={fetchLookup}
          className="text-indigo-400 hover:text-indigo-200"
        >
          {loadingLookup ? '...' : 'Lookup'}
        </button>
        {lookup && <div className="mt-1 text-[11px] text-slate-500 line-clamp-3">{lookup}</div>}
      </td>
      <td className="p-2 align-top">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={fetchHistory}
          className="text-[11px] mt-1 px-2 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700"
        >
          {loadingHistory ? 'History...' : 'History'}
        </button>
        {history && history.length > 0 && (
          <div className="mt-1 max-h-32 overflow-auto text-[10px] text-slate-400 space-y-1">
            {history.map((h:any)=> (
              <div key={h.id} className="border-b border-slate-800 pb-1">
                <div>{h.ts} — {h.source}</div>
                <div>bucket: {h.prev_bucket || '∅'} → {h.new_bucket || '∅'}</div>
                <div>project: {h.prev_project || '∅'} → {h.new_project || '∅'}</div>
                <div>reimb: {h.prev_reimbursable===null? '∅': h.prev_reimbursable? 'Y':'N'} → {h.new_reimbursable===null? '∅': h.new_reimbursable? 'Y':'N'}</div>
                {h.note && <div>note: {h.note}</div>}
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
