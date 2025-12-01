"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { PlaidLink } from "@/components/finance/PlaidLink";
import { CycleSelector, CycleOption } from "@/components/finance/CycleSelector";
import { ReportsArchive, ReportEntry } from "@/components/finance/ReportsArchive";
import { SummaryDashboard } from "@/components/finance/SummaryDashboard";
import { TopVendorsCard } from "@/components/finance/TopVendorsCard";
import { ChevronDown, ChevronUp, AlertCircle, Loader2, Briefcase, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export const dynamic = 'force-dynamic';

export default function FinancePage() {
  const [mounted, setMounted] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<CycleOption | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  // Fetch cycles and reports from API
  const { data: cyclesData, isLoading: cyclesLoading } = useSWR('/api/finance/cycles', fetcher, { refreshInterval: 60000 });
  const { data: reportsData, mutate: mutateReports, isLoading: reportsLoading } = useSWR('/api/finance/reports', fetcher, { refreshInterval: 60000 });

  const cycles: CycleOption[] = cyclesData?.cycles || [];
  const reports: ReportEntry[] = reportsData?.reports || [];

  // Set default cycle on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (cycles.length > 0 && !selectedCycle && !selectedRange) {
      const current = cycles.find(c => c.status === 'current') || cycles[0];
      setSelectedCycle(current);
    }
  }, [cycles, selectedCycle, selectedRange]);

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    if (selectedRange) {
      const now = new Date();
      const end = now.toISOString().split('T')[0];
      let start: string;
      switch (selectedRange) {
        case 'last30':
          start = new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().split('T')[0];
          break;
        case 'last90':
          start = new Date(Date.now() - 89 * 24 * 3600 * 1000).toISOString().split('T')[0];
          break;
        case 'all':
        default:
          start = '2020-01-01';
          break;
      }
      return { start, end };
    }
    if (selectedCycle) {
      return { start: selectedCycle.start, end: selectedCycle.end };
    }
    return null;
  }, [selectedCycle, selectedRange]);

  // Previous cycle for comparison
  const prevCycle = useMemo(() => {
    if (!selectedCycle || selectedRange) return null;
    const idx = cycles.findIndex(c => c.start === selectedCycle.start);
    return idx >= 0 && idx + 1 < cycles.length ? cycles[idx + 1] : null;
  }, [selectedCycle, selectedRange, cycles]);

  // API URLs
  const hasValidRange = mounted && dateRange !== null;
  const summaryUrl = hasValidRange ? `/api/finance/summary?start=${dateRange.start}&end=${dateRange.end}` : null;
  const txnsUrl = hasValidRange ? `/api/finance/txns?start=${dateRange.start}&end=${dateRange.end}` : null;
  const prevSummaryUrl = prevCycle ? `/api/finance/summary?start=${prevCycle.start}&end=${prevCycle.end}` : null;

  // SWR hooks
  const { data: summary, isLoading: summaryLoading } = useSWR(summaryUrl, fetcher, { refreshInterval: 30000 });
  const { data: prevSummary } = useSWR(prevSummaryUrl, fetcher, { refreshInterval: 60000 });
  const { data: txns, mutate: mutateTxns } = useSWR(txnsUrl, fetcher, { refreshInterval: 45000 });
  const { data: ctx, mutate: mutateCtx } = useSWR("/api/finance/context-requests", fetcher, { refreshInterval: 15000 });
  const { data: opts } = useSWR("/api/finance/options", fetcher, { refreshInterval: 120000 });

  // Vendor window for TopVendorsCard
  const [vendorCycleStart, setVendorCycleStart] = useState<string | null>(null);
  const [vendorCycleEnd, setVendorCycleEnd] = useState<string | null>(null);
  const [vendorAllTime, setVendorAllTime] = useState(false);

  useEffect(() => {
    if (selectedCycle && !vendorCycleStart) {
      setVendorCycleStart(selectedCycle.start);
      setVendorCycleEnd(selectedCycle.end);
    }
  }, [selectedCycle, vendorCycleStart]);

  const vendorUrl = useMemo(() => {
    if (vendorAllTime) return "/api/finance/vendors";
    if (vendorCycleStart && vendorCycleEnd) {
      return `/api/finance/vendors?start=${vendorCycleStart}&end=${vendorCycleEnd}`;
    }
    return null;
  }, [vendorAllTime, vendorCycleStart, vendorCycleEnd]);

  const { data: vendors } = useSWR(vendorUrl, fetcher, { refreshInterval: 60000 });

  // Calculate summary stats
  const bucketStats = useMemo(() => {
    const buckets = summary?.buckets || {};
    return Object.entries(buckets).map(([bucket, total]) => ({
      bucket,
      total: Math.abs(total as number),
      count: 0, // We don't have per-bucket counts from this API
    }));
  }, [summary]);

  const totalSpent = useMemo(() => {
    return bucketStats.reduce((acc, b) => acc + b.total, 0);
  }, [bucketStats]);

  const totalReimbursable = useMemo(() => {
    const buckets = summary?.buckets || {};
    return Math.abs(buckets['work_reimbursable'] || 0);
  }, [summary]);

  const prevTotalReimbursable = useMemo(() => {
    const buckets = prevSummary?.buckets || {};
    return Math.abs(buckets['work_reimbursable'] || 0);
  }, [prevSummary]);

  const prevTotalSpent = useMemo(() => {
    const buckets = prevSummary?.buckets || {};
    return Object.values(buckets).reduce((acc: number, v) => acc + Math.abs(v as number), 0);
  }, [prevSummary]);

  // Create report handler
  const handleCreateReport = async (cycleStart: string, cycleEnd: string) => {
    setIsCreatingReport(true);
    try {
      await fetch('/api/finance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_start: cycleStart, cycle_end: cycleEnd }),
      });
      mutateReports();
    } catch (err) {
      console.error('Failed to create report:', err);
    } finally {
      setIsCreatingReport(false);
    }
  };

  // Handlers
  const handleSelectCycle = (cycle: CycleOption) => {
    setSelectedCycle(cycle);
    setSelectedRange(null);
  };

  const handleSelectRange = (range: string) => {
    setSelectedRange(range);
    setSelectedCycle(null);
  };

  // Classify transactions
  const [classifying, setClassifying] = useState(false);
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

  // Loading state
  if (!mounted || cyclesLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Finance</p>
            <h1 className="text-3xl font-semibold">Expense Management</h1>
            <p className="text-slate-300">Loading...</p>
          </header>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const cycleLabel = selectedRange
    ? (selectedRange === 'last30' ? 'Last 30 Days' : selectedRange === 'last90' ? 'Last 90 Days' : 'All Data')
    : selectedCycle?.label || 'Select Cycle';

  const vendorCycleLabel = cycles.find(c => c.start === vendorCycleStart && c.end === vendorCycleEnd)?.label || 'Select Cycle';

  const pendingContextCount = (ctx?.requests || []).filter((r: any) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <header className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Finance</p>
            <h1 className="text-3xl font-semibold">Expense Management</h1>
            <p className="text-slate-400">Track expenses, generate reports, and manage reimbursements.</p>
          </div>
          <PlaidLink onSuccess={() => mutateTxns?.()} />
        </header>

        {/* Utlyze Expense Reimbursements Link */}
        <Link href="/finance/reimbursements">
          <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-2xl p-5 hover:border-emerald-500/50 hover:from-emerald-500/20 hover:to-blue-500/20 transition-all cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <Briefcase className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
                    Utlyze Expense Reimbursements
                  </h2>
                  <p className="text-sm text-slate-400">
                    Review AI/SaaS expenses, assign to team members, and export reports
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* Cycle Selector */}
        <CycleSelector
          cycles={cycles}
          selectedCycle={selectedCycle}
          selectedRange={selectedRange}
          onSelectCycle={handleSelectCycle}
          onSelectRange={handleSelectRange}
          isLoading={cyclesLoading}
        />

        {/* Reports Archive */}
        <ReportsArchive
          reports={reports}
          cycles={cycles}
          onCreateReport={handleCreateReport}
          isLoading={reportsLoading}
          isCreating={isCreatingReport}
        />

        {/* Summary Dashboard */}
        <SummaryDashboard
          cycleLabel={cycleLabel}
          totalReimbursable={totalReimbursable}
          totalSpent={totalSpent}
          transactionCount={summary?.count || 0}
          previousReimbursable={prevTotalReimbursable}
          previousSpent={prevTotalSpent}
          previousCount={prevSummary?.count}
          bucketStats={bucketStats}
          isLoading={summaryLoading}
        />

        {/* Top Vendors */}
        <TopVendorsCard
          vendors={(vendors?.vendors || []).map((v: any) => ({
            vendor: v.vendor || 'Unknown',
            total: v.total || 0,
            count: v.count || 0,
            reimbursable: v.bucket === 'work_reimbursable',
          }))}
          cycles={cycles}
          selectedCycleLabel={vendorCycleLabel}
          onSelectCycle={(start, end) => {
            setVendorCycleStart(start);
            setVendorCycleEnd(end);
            setVendorAllTime(false);
          }}
          onSelectAllTime={() => setVendorAllTime(true)}
          isAllTime={vendorAllTime}
        />

        {/* Context Requests (Collapsible) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setContextExpanded(!contextExpanded)}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 ${pendingContextCount > 0 ? 'bg-amber-500/10' : 'bg-slate-700/50'} rounded-lg`}>
                <AlertCircle className={`w-5 h-5 ${pendingContextCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-slate-50">Pending Context Requests</h2>
                <p className="text-sm text-slate-400">
                  {pendingContextCount > 0
                    ? `${pendingContextCount} items need clarification`
                    : 'No pending items'}
                </p>
              </div>
            </div>
            {contextExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          <AnimatePresence>
            {contextExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6">
                  <ContextList requests={ctx?.requests || []} mutate={mutateCtx} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Transactions Table */}
        <Card title="Transactions" subtitle={`${cycleLabel} - Edit bucket/project/reimbursable inline`}>
          <TransactionTable
            rows={txns?.txns || []}
            mutate={mutateTxns}
            bucketOptions={opts?.buckets || []}
            projectOptions={opts?.projects || []}
            classify={() => classifyWindow(txns?.txns || [])}
            classifying={classifying}
          />
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
      <div>
        <div className="text-lg font-semibold text-slate-50">{title}</div>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ContextList({ requests, mutate }: { requests: any[]; mutate?: any }) {
  const pending = requests.filter(r => r.status === 'pending');
  if (!pending.length) return <p className="text-sm text-slate-500">No pending items.</p>;
  return (
    <div className="space-y-2 max-h-[480px] overflow-auto pr-1">
      {pending.map((r) => (
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
    <div className="border border-slate-700/50 rounded-xl p-4 bg-slate-800/30 space-y-3 text-sm">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300 font-medium">{r.vendor || "(vendor unknown)"}</span>
        <span className="text-slate-500">{r.date || ""}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-emerald-400 font-semibold">${Math.abs(r.amount || 0).toFixed(2)}</span>
        <span className="text-xs text-slate-500">Confidence: {(r.confidence || 0).toFixed(2)}</span>
      </div>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Add context (e.g., what is this for?)"
        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-slate-100"
        rows={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-slate-100 text-xs"
          placeholder="Bucket"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
        />
        <input
          className="rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-slate-100 text-xs"
          placeholder="Project"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input type="checkbox" checked={reimbursable === true} onChange={() => setReimbursable(reimbursable === true ? null : true)} />
        Reimbursable
      </label>
      <div className="flex gap-2">
        <button
          onClick={resolve}
          disabled={saving}
          className="flex-1 text-xs px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Mark resolved"}
        </button>
        <button
          onClick={classify}
          disabled={saving}
          className="text-xs px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors"
        >
          {saving ? "..." : "AI Classify"}
        </button>
      </div>
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
  classifying?: boolean;
};

function TransactionTable({ rows, mutate, bucketOptions, projectOptions, classify, classifying }: TxnTableProps) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={showAll}
            onChange={() => setShowAll(!showAll)}
            className="rounded border-slate-600"
          />
          Show all
        </label>
        <span className="text-slate-500">|</span>
        <span className="text-slate-500">{filtered.length} items {showAll ? 'total' : 'need review'}</span>
        {classify && (
          <button
            onClick={classify}
            disabled={classifying}
            className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {classifying ? 'Classifying...' : 'Classify with AI'}
          </button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <span className="text-slate-200 font-medium">{selectedIds.size} selected</span>
          <input
            list="bulk-bucket-selected"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-sm"
            placeholder="Bucket"
            value={bulkBucket}
            onChange={(e) => setBulkBucket(e.target.value)}
          />
          <datalist id="bulk-bucket-selected">
            {(bucketOptions || []).map((b) => <option key={b} value={b} />)}
          </datalist>
          <input
            list="bulk-project-selected"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-sm"
            placeholder="Project"
            value={bulkProject}
            onChange={(e) => setBulkProject(e.target.value)}
          />
          <datalist id="bulk-project-selected">
            {(projectOptions || []).map((p) => <option key={p} value={p} />)}
          </datalist>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={bulkReimb === true}
              onChange={() => setBulkReimb(bulkReimb === true ? null : true)}
            />
            Reimb.
          </label>
          <button
            onClick={applyBulkToSelected}
            disabled={bulkSaving}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {bulkSaving ? 'Applying...' : 'Apply'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-auto max-h-[600px] rounded-xl border border-slate-700/50">
        <table className="min-w-full">
          <thead className="bg-slate-800/70 text-slate-300 text-xs uppercase sticky top-0">
            <tr>
              <th className="p-3 border-r border-slate-700/50 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-3 border-r border-slate-700/50 text-left">Date</th>
              <th className="p-3 border-r border-slate-700/50 text-left">Vendor</th>
              <th className="p-3 border-r border-slate-700/50 text-right">Amount</th>
              <th className="p-3 border-r border-slate-700/50 text-left">Bucket</th>
              <th className="p-3 border-r border-slate-700/50 text-left">Project</th>
              <th className="p-3 border-r border-slate-700/50 text-center w-16">Reimb</th>
              <th className="p-3 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
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

function TxnRow({ r, mutate, bucketOptions, projectOptions, selected, onToggleSelect }: {
  r: Txn;
  mutate?: () => void;
  bucketOptions?: string[];
  projectOptions?: string[];
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [bucket, setBucket] = useState(r.bucket || "");
  const [project, setProject] = useState(r.project || "");
  const [reimb, setReimb] = useState(!!r.reimbursable);
  const [saving, setSaving] = useState(false);

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
        status: 'classified',
      }),
    });
    setSaving(false);
    mutate?.();
  };

  return (
    <tr className={`${selected ? 'bg-blue-900/20' : 'hover:bg-slate-800/30'} transition-colors`}>
      <td className="p-3 text-center">
        <input
          type="checkbox"
          checked={selected || false}
          onChange={onToggleSelect}
        />
      </td>
      <td className="p-3 text-slate-300 whitespace-nowrap text-sm">{r.date}</td>
      <td className="p-3 min-w-[200px] max-w-[280px]">
        <div className="font-medium text-slate-100 line-clamp-1">{r.vendor || "(unknown)"}</div>
        <div className="text-xs text-slate-500 line-clamp-1">{r.raw_desc}</div>
      </td>
      <td className={`p-3 text-right whitespace-nowrap font-medium ${r.reimbursable ? 'text-emerald-400' : 'text-slate-300'}`}>
        ${Math.abs(r.amount).toFixed(2)}
      </td>
      <td className="p-3">
        <input
          list={`bucket-${r.id}`}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          placeholder="bucket"
        />
        <datalist id={`bucket-${r.id}`}>
          {(bucketOptions || []).map((b) => <option key={b} value={b} />)}
        </datalist>
      </td>
      <td className="p-3">
        <input
          list={`project-${r.id}`}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="project"
        />
        <datalist id={`project-${r.id}`}>
          {(projectOptions || []).map((p) => <option key={p} value={p} />)}
        </datalist>
      </td>
      <td className="p-3 text-center">
        <input
          type="checkbox"
          checked={reimb}
          onChange={() => setReimb(!reimb)}
          className="rounded"
        />
      </td>
      <td className="p-3 text-center">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? "..." : "Save"}
        </button>
      </td>
    </tr>
  );
}
