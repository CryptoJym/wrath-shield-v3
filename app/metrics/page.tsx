/**
 * Wrath Shield v3 - Metrics Page
 *
 * WHOOP metrics dashboard for recovery, strain, and sleep analysis.
 * This placeholder will be replaced with comprehensive biometric visualizations.
 */

import { getLatestPsychSignal, getPsychSignalsLastNDays } from '@/lib/db/queries';
import Link from 'next/link';
import PsychSparkline from '@/components/PsychSparkline';
import SyncControls from '@/components/SyncControls';
import LimitlessKeyForm from '@/components/LimitlessKeyForm';

function parseJson<T>(s?: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function sparkPath(values: number[], width = 300, height = 60, pad = 6): string {
  const n = values.length;
  if (n === 0) return '';
  let vmin = Math.min(...values.filter(v => Number.isFinite(v)));
  let vmax = Math.max(...values.filter(v => Number.isFinite(v)));
  if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) return '';
  if (vmax === vmin) { vmax = vmin + 1; }
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const norm = (v - vmin) / (vmax - vmin);
    const y = height - pad - norm * innerH;
    return [x, y] as const;
  });
  const [x0, y0] = pts[0];
  return 'M ' + x0 + ' ' + y0 + ' ' + pts.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ');
}

function compact(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n);
}

export default async function MetricsPage() {
  const latest = getLatestPsychSignal();
  const series = getPsychSignalsLastNDays(14);
  const emotions = parseJson<Record<string, number>>(latest?.emotions_json, {});
  const topTerms = parseJson<Array<[string, number]>>(latest?.top_terms_json, []);
  const sources = parseJson<Record<string, number>>(latest?.sources_json, {});
  const chronological = [...series].reverse();
  const sentimentValues = chronological.map(s => (typeof s.sentiment_score === 'number' ? s.sentiment_score : 0));
  const recordValues = chronological.map(s => s.records ?? 0);
  // System status (feeds)
  async function fetchSystemStatus() {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4242';
      const r = await fetch(`${base}/api/system/status`, { cache: 'no-store' });
      if (!r.ok) return null;
      return r.json();
    } catch {
      return null;
    }
  }
  const sys = await fetchSystemStatus();

  // Baselines
  async function fetchBaselines() {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4242';
      const r = await fetch(`${base}/api/metrics/baselines`, { cache: 'no-store' });
      if (!r.ok) return null;
      return r.json();
    } catch { return null; }
  }
  const bl = await fetchBaselines();

  function deltaBadge(current: number | null | undefined, baseline: number | null | undefined, opts: { higherIsBetter: boolean }) {
    if (current == null || baseline == null) return null;
    const d = current - baseline;
    const better = opts.higherIsBetter ? d >= 0 : d <= 0;
    const sign = d >= 0 ? '+' : '';
    const color = better ? 'text-green' : 'text-red-500';
    const fmt = Math.abs(d) < 1 ? d.toFixed(2) : d.toFixed(1);
    return <span className={`ml-2 text-xs ${color}`}>({sign}{fmt})</span>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-green mb-4">Metrics</h1>

        <div className="card">
          <p className="text-secondary mb-4">
            WHOOP metrics dashboard coming soon. This will display:
          </p>
          <ul className="list-disc list-inside text-secondary space-y-2">
            <li>Recovery percentage and trends</li>
            <li>Strain levels and activity analysis</li>
            <li>Sleep performance and stage breakdowns</li>
            <li>Heart rate variability (HRV) tracking</li>
            <li>Historical comparisons and insights</li>
          </ul>
        </div>

        <div className="card">
          <h2 className="text-green mb-2">Psych Signals</h2>
          {!latest ? (
            <p className="text-secondary">No analysis summary found. Run the collector and analyzer to generate one.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-secondary">
                <strong>Date:</strong> {latest.date}
                <span className="ml-4"><strong>Records:</strong> {latest.records}</span>
                <span className="ml-4"><strong>Words:</strong> {latest.words}</span>
                <span className="ml-4"><strong>TTR:</strong> {Number(latest.ttr).toFixed(3)}</span>
                <span className="ml-4"><strong>Sentiment:</strong> {Number(latest.sentiment_score).toFixed(3)}</span>
              </div>
              <div>
                <strong>Emotions:</strong>
                <div className="text-secondary mt-1">
                  {Object.keys(emotions).length === 0 ? '—' : (
                    Object.entries(emotions).map(([k, v]) => (
                      <span key={k} className="mr-3">{k}: {v as any}</span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <strong>Top Terms:</strong>
                <div className="text-secondary mt-1">
                  {topTerms.length === 0 ? '—' : topTerms.slice(0, 10).map(([w, c]: any, i: number) => (
                    <span key={`${w}-${i}`} className="mr-3">{w}: {c}</span>
                  ))}
                </div>
              </div>
              <div>
                <strong>Sources:</strong>
                <div className="text-secondary mt-1">
                  {Object.keys(sources).length === 0 ? '—' : (
                    Object.entries(sources).map(([k, v]) => (
                      <span key={k} className="mr-3">{k}: {v as any}</span>
                    ))
                  )}
                </div>
              </div>
              {series.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4">
                  <PsychSparkline title="Sentiment (14d)" values={sentimentValues} labels={chronological.map(s => s.date)} color="#22c55e" decimals={3} />
                  <PsychSparkline title="Records (14d)" values={recordValues} labels={chronological.map(s => s.date)} color="#60a5fa" decimals={0} />
                </div>
              )}
              {series.length > 0 && (
                <div className="text-secondary text-xs mt-1">Legend: <span style={{color:'#22c55e'}}>●</span> Sentiment, <span style={{color:'#60a5fa'}}>●</span> Records</div>
              )}
              {series.length > 0 && (
                <div>
                  <strong>Recent Trend</strong>
                  <table className="w-full text-sm text-secondary mt-2">
                    <thead>
                      <tr>
                        <th className="text-left">Date</th>
                        <th className="text-right">Records</th>
                        <th className="text-right">TTR</th>
                        <th className="text-right">Sentiment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.slice(0, 7).map((row) => (
                        <tr key={row.id}>
                          <td>{row.date}</td>
                          <td className="text-right">{compact(row.records)}</td>
                          <td className="text-right">{Number(row.ttr).toFixed(3)}</td>
                          <td className="text-right">{Number(row.sentiment_score).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end mt-2">
                <Link className="underline text-secondary" href="/metrics/psych?days=14">View details →</Link>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-green mb-2">WHOOP Baselines</h2>
          {!bl?.ok ? (
            <p className="text-secondary">Baselines unavailable.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 text-secondary">
              <div>
                <strong>30 days</strong>
                <div className="mt-1">HRV: {bl.b30.avg_hrv?.toFixed(1) ?? '—'} ms</div>
                <div className="mt-1">RHR: {bl.b30.avg_rhr?.toFixed(1) ?? '—'} bpm</div>
                <div className="mt-1">Recovery: {bl.b30.avg_recovery?.toFixed(1) ?? '—'}%</div>
                <div className="mt-1">Sleep perf: {bl.b30.avg_sleep_performance?.toFixed(1) ?? '—'}%</div>
              </div>
              <div>
                <strong>90 days</strong>
                <div className="mt-1">HRV: {bl.b90.avg_hrv?.toFixed(1) ?? '—'} ms</div>
                <div className="mt-1">RHR: {bl.b90.avg_rhr?.toFixed(1) ?? '—'} bpm</div>
                <div className="mt-1">Recovery: {bl.b90.avg_recovery?.toFixed(1) ?? '—'}%</div>
                <div className="mt-1">Sleep perf: {bl.b90.avg_sleep_performance?.toFixed(1) ?? '—'}%</div>
              </div>
              <div>
                <strong>Today</strong>
                <div className="mt-1">
                  Recovery: {bl.today?.recovery?.score ?? '—'}%
                  {deltaBadge(bl.today?.recovery?.score, bl.b30.avg_recovery, { higherIsBetter: true })}
                </div>
                <div className="mt-1">
                  HRV: {bl.today?.recovery?.hrv ?? '—'} ms
                  {deltaBadge(bl.today?.recovery?.hrv, bl.b30.avg_hrv, { higherIsBetter: true })}
                </div>
                <div className="mt-1">
                  RHR: {bl.today?.recovery?.rhr ?? '—'} bpm
                  {deltaBadge(bl.today?.recovery?.rhr, bl.b30.avg_rhr, { higherIsBetter: false })}
                </div>
                <div className="mt-1">
                  Sleep perf: {bl.today?.sleep?.performance ?? '—'}%
                  {deltaBadge(bl.today?.sleep?.performance, bl.b30.avg_sleep_performance, { higherIsBetter: true })}
                </div>
              </div>
              <div>
                <strong>Recovery bands (90d)</strong>
                <div className="mt-1">High (≥70): {bl.b90.recovery_distribution.high}</div>
                <div className="mt-1">Medium (40–69): {bl.b90.recovery_distribution.medium}</div>
                <div className="mt-1">Low (&lt;40): {bl.b90.recovery_distribution.low}</div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-green mb-2">Datafeed Health</h2>
          {!sys?.local?.ok ? (
            <p className="text-secondary">Feed status unavailable.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 text-secondary">
              <div>
                <strong>EEG</strong>
                <div className="mt-1">tokens: {sys?.db?.eeg_tokens?.row_count ?? '—'}</div>
                <div className="mt-1">status: {sys?.db?.eeg_tokens?.has_data ? '✅ Connected' : '❌ No data'}</div>
              </div>
              <div>
                <strong>WHOOP</strong>
                <div className="mt-1">cycles: {sys.local.counts?.cycles ?? 0}, recoveries: {sys.local.counts?.recoveries ?? 0}, sleeps: {sys.local.counts?.sleeps ?? 0}</div>
                <div className="mt-1">token days left: {sys.local.whoop?.token?.days_left ?? '—'}</div>
                <div className="mt-1 text-xs">redirect_uri: {process.env.WHOOP_REDIRECT_URI || 'not set'}</div>
              </div>
              <div>
                <strong>Limitless</strong>
                <div className="mt-1">lifelogs: {sys.local.counts?.lifelogs ?? 0}</div>
                <div className="mt-1">last pull: {sys.local.limitless?.last_pull_date ?? '—'}</div>
                <LimitlessKeyForm />
              </div>
              <div>
                <strong>Memory</strong>
                <div className="mt-1">provider: {sys.local.memory?.vectorStore ?? 'unknown'}</div>
                <div className="mt-1">memories: {sys.local.counts?.memories ?? 0}</div>
              </div>
              <div>
                <strong>WHOOP OAuth</strong>
                <div className="mt-1">To connect WHOOP, <a className="underline" href="/api/whoop/oauth/initiate">start OAuth here</a>.</div>
              </div>
              <div>
                <strong>Psych</strong>
                <div className="mt-1">rows: {sys.local.counts?.psych_signals ?? 0}</div>
                <div className="mt-1">latest: {sys.local.psych?.latest_date ?? '—'}</div>
              </div>
            </div>
          )}
          <SyncControls />
        </div>
      </div>
    </div>
  );
}
