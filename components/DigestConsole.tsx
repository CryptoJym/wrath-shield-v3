"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type DigestStatus = {
  success: boolean;
  status?: {
    jobId?: string;
    startedAt?: string;
    date?: string;
    total?: number;
    processed?: number;
    errors?: string[];
    done?: boolean;
  } | { status: 'idle' };
};

type PhraseItem = {
  canonical: string;
  phrase: string;
  category: string;
  assured_alt: string;
  options: string[];
  lift_score: number;
  enabled: boolean;
  context_tags: string[];
};

export default function DigestConsole() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<DigestStatus['status']>({ status: 'idle' });
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [loadingPhrases, setLoadingPhrases] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadPhrases = useCallback(async () => {
    try {
      setLoadingPhrases(true);
      const res = await fetch('/api/digest/phrases');
      if (!res.ok) throw new Error('phrases load failed');
      const data = await res.json();
      setPhrases(data.phrases || []);
      setSensitivity(typeof data.sensitivity === 'number' ? data.sensitivity : 0.5);
    } catch (e) {
      console.error(e);
      setPhrases([]);
    } finally {
      setLoadingPhrases(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/digest/status');
      if (!res.ok) throw new Error('status load failed');
      const data = (await res.json()) as DigestStatus;
      setStatus(data.status);
      if ('status' in (data.status as any) && (data.status as any).status === 'idle') return;
      if ((data.status as any)?.done) {
        if (pollRef.current) clearInterval(pollRef.current);
        await loadPhrases();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  }, [loadPhrases]);

  useEffect(() => {
    loadPhrases();
    loadStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadPhrases, loadStatus]);

  const progress = useMemo(() => {
    if (!status || (status as any).status === 'idle') return 0;
    const s = status as any;
    const total = s.total || 0;
    const processed = s.processed || 0;
    if (total === 0) return s.done ? 100 : 0;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [status]);

  async function startImportAndDigest() {
    try {
      setBusy(true);
      const res = await fetch('/api/import/limitless', { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Import failed');
      await loadStatus();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(loadStatus, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function togglePhrase(canonical: string, enabled: boolean) {
    const prev = phrases;
    setPhrases((ps) => ps.map((p) => (p.canonical === canonical ? { ...p, enabled } : p)));
    try {
      const res = await fetch('/api/digest/phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical, enabled }),
      });
      if (!res.ok) throw new Error('Toggle failed');
    } catch {
      setPhrases(prev);
    }
  }

  function updateSensitivity(value: number) {
    setSensitivity(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await fetch('/api/digest/phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensitivity: value }),
      });
    }, 250);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-green">Digest Console</h2>
        <button className="btn" onClick={startImportAndDigest} disabled={busy} aria-busy={busy}>
          {busy ? 'Starting…' : 'Import & Digest Today'}
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="text-secondary text-sm mb-1">Progress</div>
        <div className="w-full h-2 bg-surface rounded">
          <div
            className="h-2 bg-green rounded"
            style={{ width: `${progress}%`, transition: 'width 200ms linear' }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            role="progressbar"
          />
        </div>
        {/* Details */}
        <div className="text-secondary text-xs mt-1">
          {loadingStatus ? 'Loading status…' : (
            (status as any)?.status === 'idle' ? 'Idle' : `${(status as any)?.processed ?? 0} / ${(status as any)?.total ?? 0} processed`
          )}
        </div>
        {status && (status as any).errors && (status as any).errors.length > 0 && (
          <div className="mt-2 text-danger text-sm">
            Errors: {(status as any).errors.join('; ')}
          </div>
        )}
      </div>

      {/* Sensitivity */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-secondary text-sm">Sensitivity</span>
          <span className="text-secondary text-sm">{Math.round(sensitivity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={sensitivity}
          onChange={(e) => updateSensitivity(Number(e.target.value))}
          className="w-full"
          aria-label="Sensitivity"
        />
      </div>

      {/* Phrases */}
      <div>
        <div className="text-secondary text-sm mb-2">Phrases ({phrases.length})</div>
        {loadingPhrases && <div className="text-secondary text-sm">Loading phrases…</div>}
        {!loadingPhrases && phrases.length === 0 && (
          <div className="text-secondary text-sm">No phrases available yet — run Import & Digest to extract phrases.</div>
        )}
        <ul className="space-y-2">
          {phrases.map((p) => (
            <li key={p.canonical} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{p.phrase}</div>
                <div className="text-xs text-secondary">
                  {p.category} · {p.assured_alt} · Lift {Math.round(p.lift_score * 100)}%
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-secondary">Enabled</span>
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => togglePhrase(p.canonical, e.target.checked)}
                  aria-label={`Toggle ${p.phrase}`}
                />
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
