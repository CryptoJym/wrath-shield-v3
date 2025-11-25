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
  const start = params.get("start") || "";
  const end = params.get("end") || "";
  const summaryUrl = start && end ? `/api/finance/summary?start=${start}&end=${end}` : null;
  const txnsUrl = start && end ? `/api/finance/txns?start=${start}&end=${end}` : null;
  const { data: summary } = useSWR(summaryUrl, fetcher);
  const { data: txns } = useSWR(txnsUrl, fetcher);

  return (
    <div className="bg-white text-black p-8 max-w-5xl mx-auto font-serif">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Cycle Report</h1>
          <p className="text-sm text-gray-600">{start} → {end}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white rounded"
        >
          Print / PDF
        </button>
      </div>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Totals</h2>
        <p>Total: ${sumBuckets(summary?.buckets).toFixed(2)} ({summary?.count ?? 0} transactions)</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          {summary?.buckets && Object.entries(summary.buckets).map(([k,v]) => (
            <div key={k} className="border border-gray-300 rounded p-3">
              <div className="text-sm text-gray-600">{k}</div>
              <div className="text-lg font-semibold">${v.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Line items</h2>
        <table className="w-full text-sm border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Vendor</th>
              <th className="p-2 border">Amount</th>
              <th className="p-2 border">Bucket</th>
              <th className="p-2 border">Project</th>
              <th className="p-2 border">Reimb?</th>
              <th className="p-2 border">Note / Rationale</th>
            </tr>
          </thead>
          <tbody>
            {(txns?.txns || []).map((t: any) => (
              <tr key={t.id} className="border">
                <td className="p-2 border">{t.date}</td>
                <td className="p-2 border">{t.vendor}</td>
                <td className="p-2 border">${t.amount.toFixed(2)}</td>
                <td className="p-2 border">{t.bucket || ''}</td>
                <td className="p-2 border">{t.project || ''}</td>
                <td className="p-2 border text-center">{t.reimbursable ? 'Yes' : 'No'}</td>
                <td className="p-2 border text-xs">{t.meta?.note || t.meta?.rationale || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Approval</h2>
        <p>Signature: ______________________________________</p>
        <p className="mt-2">Date: _____________</p>
      </section>
    </div>
  );
}
