"use client";

import { useSearchParams } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function sumBuckets(b: Record<string, number> | undefined) {
  if (!b) return 0;
  return Object.values(b).reduce((a, v) => a + (v || 0), 0);
}

export default function PrintPage() {
  const params = useSearchParams();
  const start = params?.get("start") || "";
  const end = params?.get("end") || "";
  const summaryUrl = start && end ? `/api/finance/summary?start=${start}&end=${end}` : null;
  const txnsUrl = start && end ? `/api/finance/txns?start=${start}&end=${end}` : null;
  const { data: summary } = useSWR(summaryUrl, fetcher);
  const { data: txns } = useSWR(txnsUrl, fetcher);

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
      <div className="bg-white text-black p-8 max-w-5xl mx-auto font-serif">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Finance Cycle Report</h1>
            <p className="text-sm text-gray-600">Period: {start} → {end}</p>
            <p className="text-xs text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            Print / Save PDF
          </button>
        </div>

      <section className="mb-6 border-b pb-4">
        <h2 className="text-xl font-semibold mb-3">Summary</h2>
        <div className="bg-gray-50 p-4 rounded mb-3">
          <div className="text-2xl font-bold">
            Total: ${sumBuckets(summary?.buckets).toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">
            {summary?.count ?? 0} transactions
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2">Breakdown by Category</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {summary?.buckets && Object.entries(summary.buckets).map(([k, v]) => (
            <div key={k} className="border border-gray-300 rounded p-3 bg-gray-50">
              <div className="text-sm text-gray-600 capitalize">{k.replace(/_/g, ' ')}</div>
              <div className="text-lg font-semibold">${(v as number).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Transaction Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border border-gray-300 text-left">Date</th>
                <th className="p-2 border border-gray-300 text-left">Vendor</th>
                <th className="p-2 border border-gray-300 text-right">Amount</th>
                <th className="p-2 border border-gray-300 text-left">Category</th>
                <th className="p-2 border border-gray-300 text-left">Project</th>
                <th className="p-2 border border-gray-300 text-center">Reimbursable</th>
                <th className="p-2 border border-gray-300 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(txns?.txns || []).map((t: any, idx: number) => (
                <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 border border-gray-300 whitespace-nowrap">{t.date}</td>
                  <td className="p-2 border border-gray-300">{t.vendor || '(unknown)'}</td>
                  <td className="p-2 border border-gray-300 text-right font-mono">${t.amount.toFixed(2)}</td>
                  <td className="p-2 border border-gray-300 capitalize">{(t.bucket || '').replace(/_/g, ' ')}</td>
                  <td className="p-2 border border-gray-300">{t.project || ''}</td>
                  <td className="p-2 border border-gray-300 text-center">
                    {t.reimbursable ? '✓' : '—'}
                  </td>
                  <td className="p-2 border border-gray-300 text-xs max-w-xs">
                    {t.meta?.note || t.meta?.rationale || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 pt-6 border-t border-gray-300">
        <h2 className="text-xl font-semibold mb-4">Approval & Sign-off</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Prepared by:</p>
            <p className="border-b border-gray-400 pb-1 mb-4">_______________________________</p>
            <p className="text-sm text-gray-600 mb-1">Date:</p>
            <p className="border-b border-gray-400 pb-1">______________</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Approved by:</p>
            <p className="border-b border-gray-400 pb-1 mb-4">_______________________________</p>
            <p className="text-sm text-gray-600 mb-1">Date:</p>
            <p className="border-b border-gray-400 pb-1">______________</p>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
