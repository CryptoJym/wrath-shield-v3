"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RelationshipsPage() {
  const { data, isLoading } = useSWR("/api/relationships", fetcher, { refreshInterval: 10000 });
  const contacts = data?.contacts || [];
  const summaries = data?.summaries || [];
  const summaryMap = Object.fromEntries(summaries.map((s: any) => [s.contact_id, s]));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Relationship Grok</p>
          <h1 className="text-3xl font-semibold">People Graph</h1>
          <p className="text-slate-300">Recent interactions from Messages; per-contact cadence and last snippets.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          {contacts.map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{c.display_name || c.handle}</div>
                  <div className="text-xs text-slate-500">{c.handle}</div>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <div>{formatTs(c.last_ts)}</div>
                  <div className="text-slate-500">msgs: {c.message_count}</div>
                </div>
              </div>
              <div className="text-sm text-slate-300 line-clamp-3">{c.last_text}</div>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>sent: {c.sent_count}</span>
                <span>recv: {c.recv_count}</span>
              </div>
              {summaryMap[c.id] && (
                <div className="rounded-lg bg-slate-800/80 border border-slate-700 p-2 space-y-1">
                  <div className="text-xs uppercase tracking-[0.1em] text-slate-400">Summary</div>
                  <div className="text-sm text-slate-200 whitespace-pre-line">{summaryMap[c.id].summary}</div>
                  {summaryMap[c.id].suggested_follow_up && (
                    <div className="text-xs text-emerald-300">
                      ➜ {summaryMap[c.id].suggested_follow_up}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!contacts.length && !isLoading && <p className="text-slate-500">No contacts ingested yet.</p>}
        </div>
      </div>
    </div>
  );
}

function formatTs(ts?: number | null) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}
