'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  Filter,
  ChevronDown,
  ArrowLeft,
  Users,
  Briefcase,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import ReimbursementTable from '@/components/finance/ReimbursementTable';
import { FinanceChat } from '@/components/finance/FinanceChat';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Cycle = {
  start: string;
  end: string;
  label: string;
  status: 'current' | 'closed';
  reimbursable: number;
  total: number;
  count: number;
  report_id?: string;
  report_status?: string;
};

type Transaction = {
  id: string;
  date: string;
  vendor?: string;
  raw_desc?: string;
  amount: number;
  bucket?: string;
  reimbursable: boolean;
  assignee?: string;
  usage_note?: string;
  company?: string;
  status?: string;
  confidence?: number;
};

type AssigneeStat = {
  assignee: string;
  count: number;
  total: number;
  reimbursable: number;
};

type CompanyStat = {
  company: string;
  count: number;
  total: number;
};

export default function ReimbursementsPage() {
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [showCycleDropdown, setShowCycleDropdown] = useState(false);
  const [filter, setFilter] = useState<'all' | 'reimbursable' | 'ai_saas' | 'needs_review'>('all');

  // Fetch all cycles
  const { data: cyclesData, error: cyclesError } = useSWR<{
    cycles: Cycle[];
    assignees: string[];
    companies: string[];
  }>('/api/finance/reimbursement/cycles', fetcher, {
    refreshInterval: 60000,
  });

  // Fetch selected cycle data with transactions
  const { data: cycleData, error: cycleError, mutate: mutateCycle } = useSWR<{
    cycle: Cycle;
    transactions: Transaction[];
    transactionCount: number;
    reimbursableCount: number;
    aiSaasCount: number;
    assigneeStats: AssigneeStat[];
    assignees: string[];
    companies: string[];
  }>(
    selectedCycle
      ? `/api/finance/reimbursement/cycles?cycleStart=${selectedCycle.start}&cycleEnd=${selectedCycle.end}&withTransactions=true`
      : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Auto-select the most recent cycle (Oct 8 - Nov 8 for current report)
  useMemo(() => {
    if (cyclesData?.cycles?.length && !selectedCycle) {
      // Find Oct 8 - Nov 8 cycle (the one that needs filing)
      const oct8Cycle = cyclesData.cycles.find(
        (c) => c.start === '2025-10-08' && c.end === '2025-11-08'
      );
      if (oct8Cycle) {
        setSelectedCycle(oct8Cycle);
      } else {
        // Fall back to most recent
        setSelectedCycle(cyclesData.cycles[0]);
      }
    }
  }, [cyclesData, selectedCycle]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!cycleData?.transactions) return [];
    let txns = cycleData.transactions;

    switch (filter) {
      case 'reimbursable':
        return txns.filter((t) => t.reimbursable);
      case 'ai_saas':
        return txns.filter(
          (t) => t.bucket === 'work_reimbursable' || t.bucket === 'personal_ai'
        );
      case 'needs_review':
        return txns.filter(
          (t) =>
            (t.bucket === 'work_reimbursable' || t.bucket === 'personal_ai') &&
            !t.assignee
        );
      default:
        return txns;
    }
  }, [cycleData?.transactions, filter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!cycleData?.transactions) return null;
    const txns = cycleData.transactions;
    const reimbursable = txns.filter((t) => t.reimbursable);
    const aiSaas = txns.filter(
      (t) => t.bucket === 'work_reimbursable' || t.bucket === 'personal_ai'
    );

    return {
      totalCount: txns.length,
      reimbursableCount: reimbursable.length,
      reimbursableTotal: reimbursable.reduce((sum, t) => sum + t.amount, 0),
      nonReimbursableTotal: txns
        .filter((t) => !t.reimbursable)
        .reduce((sum, t) => sum + t.amount, 0),
      aiSaasCount: aiSaas.length,
      needsReviewCount: aiSaas.filter((t) => !t.assignee).length,
    };
  }, [cycleData?.transactions]);

  // Calculate company breakdown (Vuplicity, Solution Stream, etc.) for reimbursable items
  const companyStats = useMemo((): CompanyStat[] => {
    if (!cycleData?.transactions) return [];
    const reimbursable = cycleData.transactions.filter((t) => t.reimbursable);

    const companyMap = new Map<string, { count: number; total: number }>();
    reimbursable.forEach((t) => {
      const company = t.company || 'Unassigned';
      const existing = companyMap.get(company) || { count: 0, total: 0 };
      companyMap.set(company, {
        count: existing.count + 1,
        total: existing.total + t.amount,
      });
    });

    return Array.from(companyMap.entries())
      .map(([company, data]) => ({ company, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [cycleData?.transactions]);

  // Calculate assignee breakdown for reimbursable items (for export)
  const assigneeBreakdown = useMemo(() => {
    if (!cycleData?.transactions) return [];
    const reimbursable = cycleData.transactions.filter((t) => t.reimbursable);

    const assigneeMap = new Map<string, { count: number; total: number }>();
    reimbursable.forEach((t) => {
      const assignee = t.assignee || 'Unassigned';
      const existing = assigneeMap.get(assignee) || { count: 0, total: 0 };
      assigneeMap.set(assignee, {
        count: existing.count + 1,
        total: existing.total + t.amount,
      });
    });

    return Array.from(assigneeMap.entries())
      .map(([assignee, data]) => ({ assignee, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [cycleData?.transactions]);

  const handleTransactionUpdate = () => {
    mutateCycle();
  };

  const handleExportCSV = () => {
    if (!cycleData?.transactions || !selectedCycle) return;

    const reimbursable = cycleData.transactions.filter((t) => t.reimbursable);
    const total = reimbursable.reduce((sum, t) => sum + t.amount, 0);

    // Format dates nicely
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const csvRows: string[][] = [];

    // Header section with date range
    csvRows.push(['Utlyze Expense Reimbursement Report']);
    csvRows.push(['Period:', `${formatDate(selectedCycle.start)} - ${formatDate(selectedCycle.end)}`]);
    csvRows.push(['Generated:', new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })]);
    csvRows.push(['Total Reimbursable:', `$${total.toFixed(2)}`]);
    csvRows.push([]);

    // Summary by Company (Vuplicity, Solution Stream, etc.)
    csvRows.push(['SUMMARY BY COMPANY']);
    csvRows.push(['Company', 'Count', 'Amount']);
    companyStats.forEach((stat) => {
      csvRows.push([stat.company, stat.count.toString(), stat.total.toFixed(2)]);
    });
    csvRows.push([]);

    // Summary by Assignee
    csvRows.push(['SUMMARY BY ASSIGNEE']);
    csvRows.push(['Assignee', 'Count', 'Amount']);
    assigneeBreakdown.forEach((stat) => {
      csvRows.push([stat.assignee, stat.count.toString(), stat.total.toFixed(2)]);
    });
    csvRows.push([]);

    // Detail section
    csvRows.push(['TRANSACTION DETAILS']);
    csvRows.push(['Date', 'Description', 'Amount', 'Assignee', 'Usage Note']);
    reimbursable.forEach((t) => {
      csvRows.push([
        t.date,
        t.vendor || t.raw_desc || '',
        t.amount.toFixed(2),
        t.assignee || '',
        t.usage_note || '',
      ]);
    });

    const csv = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Utlyze_Expense_Report_${selectedCycle.start}_to_${selectedCycle.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (cyclesError) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="text-red-400">Error loading cycles: {cyclesError.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/finance"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-50 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                Utlyze Expense Reimbursements
              </h1>
              <p className="text-sm text-slate-400">
                Review and manage AI/SaaS expense reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={!stats?.reimbursableCount}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Cycle Selector */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">Expense Cycle</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowCycleDropdown(!showCycleDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium">
                  {selectedCycle?.label || 'Select Cycle'}
                </span>
                {selectedCycle?.status === 'current' && (
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                    Current
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              <AnimatePresence>
                {showCycleDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
                  >
                    {cyclesData?.cycles?.map((cycle) => (
                      <button
                        key={`${cycle.start}-${cycle.end}`}
                        onClick={() => {
                          setSelectedCycle(cycle);
                          setShowCycleDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center justify-between ${
                          selectedCycle?.start === cycle.start
                            ? 'bg-slate-700'
                            : ''
                        }`}
                      >
                        <div>
                          <div className="font-medium">{cycle.label}</div>
                          <div className="text-sm text-slate-400">
                            ${cycle.reimbursable.toFixed(2)} reimbursable
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {cycle.status === 'current' && (
                            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                              Current
                            </span>
                          )}
                          {cycle.report_status === 'submitted' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Reimbursable</span>
              </div>
              <div className="text-2xl font-semibold text-emerald-400">
                ${stats.reimbursableTotal.toFixed(2)}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {stats.reimbursableCount} items
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Non-Reimbursable</span>
              </div>
              <div className="text-2xl font-semibold text-slate-300">
                ${stats.nonReimbursableTotal.toFixed(2)}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {stats.totalCount - stats.reimbursableCount} items
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm">AI/SaaS Detected</span>
              </div>
              <div className="text-2xl font-semibold text-blue-400">
                {stats.aiSaasCount}
              </div>
              <div className="text-sm text-slate-400 mt-1">transactions</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">Needs Review</span>
              </div>
              <div className="text-2xl font-semibold text-amber-400">
                {stats.needsReviewCount}
              </div>
              <div className="text-sm text-slate-400 mt-1">missing assignee</div>
            </motion.div>
          </div>
        )}

        {/* Company Breakdown (Vuplicity, Solution Stream, etc.) */}
        {companyStats.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Reimbursable by Company
            </h3>
            <div className="flex flex-wrap gap-3">
              {companyStats.map((stat) => (
                <div
                  key={stat.company}
                  className="px-3 py-2 bg-slate-800 rounded-lg"
                >
                  <div className="font-medium text-slate-200">{stat.company}</div>
                  <div className={`text-sm ${stat.total < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {stat.total < 0 ? '-' : ''}${Math.abs(stat.total).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">{stat.count} items</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignee Breakdown */}
        {cycleData?.assigneeStats && cycleData.assigneeStats.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Reimbursable by Assignee
            </h3>
            <div className="flex flex-wrap gap-3">
              {cycleData.assigneeStats.map((stat) => (
                <div
                  key={stat.assignee}
                  className="px-3 py-2 bg-slate-800 rounded-lg"
                >
                  <div className="font-medium text-slate-200">{stat.assignee}</div>
                  <div className={`text-sm ${stat.reimbursable < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {stat.reimbursable < 0 ? '-' : ''}${Math.abs(stat.reimbursable).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">{stat.count} items</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All', count: stats?.totalCount },
              { key: 'reimbursable', label: 'Reimbursable', count: stats?.reimbursableCount },
              { key: 'ai_saas', label: 'AI/SaaS', count: stats?.aiSaasCount },
              { key: 'needs_review', label: 'Needs Review', count: stats?.needsReviewCount },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === tab.key
                    ? 'bg-slate-700 text-slate-50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          {cycleError ? (
            <div className="p-6 text-center text-red-400">
              Error loading transactions
            </div>
          ) : !cycleData ? (
            <div className="p-6 text-center text-slate-400">
              Loading transactions...
            </div>
          ) : (
            <ReimbursementTable
              transactions={filteredTransactions}
              assignees={cycleData.assignees || []}
              companies={cycleData.companies || []}
              onUpdate={handleTransactionUpdate}
            />
          )}
        </div>
      </main>

      {/* Finance Agent Chat */}
      <FinanceChat
        cycleStart={selectedCycle?.start}
        cycleEnd={selectedCycle?.end}
        transactions={cycleData?.transactions}
        companies={cycleData?.companies || cyclesData?.companies || []}
        assignees={cycleData?.assignees || cyclesData?.assignees || []}
        onUpdate={handleTransactionUpdate}
      />
    </div>
  );
}
