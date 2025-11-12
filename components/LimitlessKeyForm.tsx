"use client";
import React, { useEffect, useState } from 'react';

export default function LimitlessKeyForm() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    try {
      const r = await fetch('/api/settings?provider=limitless', { cache: 'no-store' });
      const j = await r.json();
      setConfigured(!!j?.configured);
    } catch { setConfigured(null); }
  }

  useEffect(() => { reload(); }, []);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'limitless', key }) });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || 'Failed to save');
      setMsg('Saved ✓');
      setKey('');
      reload();
    } catch (e: any) { setMsg(`Error: ${String(e?.message || e)}`); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2 text-sm">
      <div className="mb-1">Limitless API key: {configured == null ? 'checking…' : (configured ? 'configured ✅' : 'not set ❌')}</div>
      <div className="flex items-center gap-2">
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Enter Limitless API key" className="input flex-1" />
        <button disabled={busy || key.length === 0} className="btn" onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {msg && <div className="text-secondary mt-1">{msg}</div>}
    </div>
  );
}

