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
    if (!transactions.length) return;

    const headers = ['Date', 'Description', 'Amount', 'Notes'];
    const rows = transactions.map(txn => [
      txn.date,
      txn.vendor || txn.raw_desc || '',
      Math.abs(txn.amount).toFixed(2),
      txn.meta?.note || '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense_report_${report?.cycle_start}_${report?.cycle_end}.csv`;
    a.click();
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
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / PDF
            </button>
            <button
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
          <div className="grid grid-cols-3 gap-6 p-6 bg-slate-50 border-b print:bg-white">
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
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg print:bg-emerald-50">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Reimbursable</p>
                <p className="font-bold text-emerald-600 text-lg">
                  ${report.total_reimbursable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Expense Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((txn, idx) => (
                    <tr
                      key={txn.id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                    >
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">
                        {formatDate(txn.date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900">
                          {txn.vendor || txn.raw_desc || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-slate-900">
                          ${Math.abs(txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {txn.meta?.note || txn.project || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100">
                    <td colSpan={2} className="py-4 px-4 text-right font-bold text-slate-700 uppercase">
                      Total
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-xl font-bold text-emerald-600">
                        ${report.total_reimbursable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500">
                      {transactions.length} items
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t text-center print:bg-white">
            <p className="text-sm text-slate-500">
              Generated on {new Date(report.generated_at || '').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {report.submitted_at && (
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
