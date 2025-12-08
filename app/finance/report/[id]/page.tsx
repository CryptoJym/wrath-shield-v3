'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle,
  FileText,
  Loader2,
  Calendar,
  User,
  DollarSign,
} from 'lucide-react';
import { motion } from 'framer-motion';

type Transaction = {
  id: string;
  date: string;
  vendor?: string;
  raw_desc?: string;
  amount: number;
  project?: string;
  bucket?: string;
  reimbursable?: number;
  usage_note?: string; // Narrative field
  meta?: { note?: string; rationale?: string };
};

type Report = {
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

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingTxnId, setSavingTxnId] = useState<string | null>(null);

  const reportId = params.id as string;

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/finance/reports/${reportId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch report');
        }
        const data = await res.json();
        setReport(data.report);
        setTransactions(data.transactions || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!transactions.length || !report) return;

    const csvDate = (d: string) => new Date(d).toLocaleDateString('en-US');

    // Filter for CSV: Only reimbursable items
    const reimbursableTxns = transactions.filter(t => t.reimbursable);

    // 1. Metadata Section
    const metadata = [
      [`REIMBURSEMENT FOR UTLYZE - ${report.label.toUpperCase()}`],
      [],
      ['Report Type', 'Reimbursement for Utlyze'],
      ['Date Range', report.label],
      ['Employee', report.employee],
      ['Purpose', report.purpose || ''],
      ['Status', report.status.toUpperCase()],
      ['Generated', report.generated_at ? csvDate(report.generated_at) : ''],
      [],
      ['SUMMARY'],
      ['Total Reimbursable', report.total_reimbursable.toFixed(2)],
      // 'Total Spent' removed as requested
      ['Transaction Count', reimbursableTxns.length.toString()],
      []
    ];

    // 2. Transactions Header
    const headers = ['Date', 'Vendor/Description', 'Category', 'Project', 'Amount', 'Reimbursable', 'Rationale/Notes'];

    // 3. Transaction Data
    const rows = reimbursableTxns.map(txn => [
      txn.date,
      (txn.vendor || txn.raw_desc || '').replace(/"/g, '""'),
      txn.bucket || '',
      txn.project || '',
      Math.abs(txn.amount).toFixed(2),
      'Yes',
      (txn.usage_note || txn.meta?.note || '').replace(/"/g, '""')
    ]);

    // Combine all
    const csvContent = [
      ...metadata.map(row => row.map(cell => `"${cell}"`).join(',')),
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use raw dates for robust filename: "Reimbursement_for_Utlyze_2025-10-08_to_2025-11-08.csv"
    const filename = `Reimbursement_for_Utlyze_${report.cycle_start}_to_${report.cycle_end}.csv`;

    // DEBUG: Alert removed
    a.download = filename;
    document.body.appendChild(a); // Required for Firefox and some other browsers
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleMarkSubmitted = async () => {
    if (!report) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/finance/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted' }),
      });
      if (!res.ok) throw new Error('Failed to update report');
      const data = await res.json();
      setReport(data.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (txnId: string, note: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === txnId ? { ...t, usage_note: note } : t
    ));

    setSavingTxnId(txnId);
    try {
      const res = await fetch(`/api/finance/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usage_note: note }),
      });
      if (!res.ok) throw new Error('Failed to save note');
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setTimeout(() => setSavingTxnId(null), 500);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <FileText className="w-16 h-16 text-slate-600 mb-4" />
        <p className="text-slate-400 text-lg">{error || 'Report not found'}</p>
        <Link
          href="/finance"
          className="mt-4 text-blue-400 hover:text-blue-300 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Finance
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <div className="print:hidden bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/finance"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Finance</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            {report.status === 'draft' && (
              <button
                onClick={handleMarkSubmitted}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Mark as Submitted
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-5xl mx-auto px-6 py-8 print:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8 print:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Utlyze Expense Report</h1>
                <p className="text-slate-300 text-lg">{report.purpose || 'AI Tools and Services'}</p>
              </div>
              <div className="text-right">
                {report.status === 'submitted' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Submitted
                  </span>
                )}
                {report.status === 'draft' && (
                  <span className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                    Draft
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 border-b print:bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg print:bg-blue-50">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Employee</p>
                <p className="font-semibold text-slate-900">{report.employee}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg print:bg-purple-50">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Period</p>
                <p className="font-semibold text-slate-900">{report.label}</p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Reimbursable Expenses</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="w-24 text-left py-3 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wider print:w-20">
                      Date
                    </th>
                    <th className="w-48 text-left py-3 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wider print:w-40">
                      Description
                    </th>
                    <th className="w-28 text-right py-3 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wider print:w-24">
                      Amount
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.filter(t => t.reimbursable).map((txn, idx) => (
                    <tr
                      key={txn.id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                    >
                      <td className="py-2 px-2 text-sm text-slate-600 font-mono align-top">
                        {formatDate(txn.date)}
                      </td>
                      <td className="py-2 px-2 align-top">
                        <span className="font-medium text-slate-900 block break-words text-sm">
                          {txn.vendor || txn.raw_desc || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right align-top">
                        <span className="font-semibold text-slate-900 text-sm">
                          ${Math.abs(txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-sm text-slate-500 align-top">
                        {report?.status === 'draft' ? (
                          <>
                            {/* Screen View: Editable Textarea */}
                            <div className="relative print:hidden">
                              <textarea
                                defaultValue={txn.usage_note || txn.meta?.note || ''}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  if (val !== (txn.usage_note || txn.meta?.note)) {
                                    handleUpdateNote(txn.id, val);
                                  }
                                }}
                                placeholder="Add rationale..."
                                rows={1}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:outline-none px-1 py-0.5 transition-colors placeholder:text-slate-300 resize-y whitespace-pre-wrap"
                                style={{ minHeight: '1.5em' }}
                              />
                              {savingTxnId === txn.id && (
                                <div className="absolute right-0 top-0">
                                  <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                                </div>
                              )}
                            </div>
                            {/* Print View: Full Text Display */}
                            <div className="hidden print:block break-words whitespace-pre-wrap text-sm">
                              {txn.usage_note || txn.meta?.note || ''}
                            </div>
                          </>
                        ) : (
                          <span className="block break-words whitespace-pre-wrap max-w-full">
                            {txn.usage_note || txn.meta?.note || txn.project || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totals Section outside of table for print positioning */}
              <div className="border-t-2 border-slate-300 bg-slate-100 p-4 flex justify-end items-center gap-8 mt-4 print:mt-8 print:break-inside-avoid">
                <div className="text-sm text-slate-500">
                  {transactions.filter(t => t.reimbursable).length} items
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-700 uppercase">Total Reimbursable</span>
                  <span className="text-xl font-bold text-emerald-600">
                    ${report?.total_reimbursable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t text-center print:bg-white">
            <p className="text-sm text-slate-500">
              Generated on {report?.generated_at ? new Date(report.generated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }) : ''}
              {report?.submitted_at && (
                <span>
                  {' '}| Submitted on {new Date(report.submitted_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          header {
            display: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:bg-white {
            background: white !important;
          }
          .print\\:bg-slate-900 {
            background: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:p-8 {
            padding: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
}
