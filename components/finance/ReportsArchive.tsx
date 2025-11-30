'use client';

import { useState } from 'react';
import { FileText, Plus, Eye, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import type { CycleOption } from './CycleSelector';

export type ReportEntry = {
  id: string;
  cycle_start: string;
  cycle_end: string;
  label: string;
  employee: string;
  purpose?: string;
  total_reimbursable: number;
  total_spent: number;
  transaction_count: number;
  status: 'draft' | 'submitted' | 'approved';
  generated_at?: string;
  submitted_at?: string;
};

interface ReportsArchiveProps {
  reports: ReportEntry[];
  cycles: CycleOption[];
  onCreateReport: (cycleStart: string, cycleEnd: string) => Promise<void>;
  isLoading?: boolean;
  isCreating?: boolean;
}

export function ReportsArchive({
  reports,
  cycles,
  onCreateReport,
  isLoading,
  isCreating,
}: ReportsArchiveProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  // Find cycles that don't have reports yet
  const cyclesWithoutReports = cycles.filter(
    cycle => !reports.some(r => r.cycle_start === cycle.start && r.cycle_end === cycle.end)
  );

  const handleCreate = async (cycle: CycleOption) => {
    setShowCreateDropdown(false);
    await onCreateReport(cycle.start, cycle.end);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
            <Check className="w-3 h-3" />
            Submitted
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
            <Check className="w-3 h-3" />
            Approved
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-slate-50">Reimbursement Reports</h2>
            <p className="text-sm text-slate-400">{reports.length} reports generated</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateDropdown(!showCreateDropdown);
              }}
              disabled={isCreating || cyclesWithoutReports.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              New Report
            </button>

            <AnimatePresence>
              {showCreateDropdown && cyclesWithoutReports.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 border-b border-slate-800">
                    <p className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Generate Report For
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {cyclesWithoutReports.map(cycle => (
                      <button
                        key={`${cycle.start}-${cycle.end}`}
                        onClick={() => handleCreate(cycle)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{cycle.label}</span>
                          <span className="text-xs text-slate-500">
                            {cycle.count} transactions
                          </span>
                        </div>
                        <span className="text-sm font-medium text-emerald-400">
                          ${cycle.reimbursable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No reports generated yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Click &quot;New Report&quot; to generate your first expense report
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report, idx) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800/60 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-700 transition-colors">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200">{report.label}</span>
                            {getStatusBadge(report.status)}
                          </div>
                          <p className="text-sm text-slate-500">{report.transaction_count} reimbursable items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-emerald-400">
                            ${report.total_reimbursable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-slate-500">reimbursable</p>
                        </div>
                        <Link
                          href={`/finance/report/${report.id}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-slate-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
