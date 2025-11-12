"use client";
import React, { useState } from 'react';

export default function SyncControls() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(path: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(path, { method: 'GET' });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Sync failed');
      setMsg(`Synced: WHOOP ${j.whoopPulled}, Limitless ${j.limitlessPulled}. New counts: lifelogs ${j.after?.lifelogs}, recoveries ${j.after?.recoveries}`);
    } catch (e: any) {
      setMsg(`Error: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 mt-2">
      <button disabled={busy} className="btn" onClick={() => call('/api/sync?days=3')}>{busy ? 'Syncing…' : 'Sync last 3 days'}</button>
      <button disabled={busy} className="btn" onClick={() => call('/api/sync?days=14')}>{busy ? 'Syncing…' : 'Sync last 14 days'}</button>
      <button disabled={busy} className="btn" onClick={() => call(`/api/sync?start_date=${new Date(Date.now()-14*864e5).toISOString().slice(0,10)}&end_date=${new Date().toISOString().slice(0,10)}`)}>{busy ? 'Backfilling…' : 'Backfill Limitless 14d'}</button>
      {msg && <span className="text-secondary text-sm">{msg}</span>}
    </div>
  );
}

