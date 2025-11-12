import { getPsychSignalsLastNDays, getRecoveriesLastNDays } from '@/lib/db/queries';
import PsychSparkline from '@/components/PsychSparkline';
import Link from 'next/link';

function parseJson<T>(s?: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length === 0) return null;
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx; const vy = y[i] - my;
    num += vx * vy; dx += vx * vx; dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

function rangeLinks(current: number) {
  const opts = [14, 30, 90];
  return (
    <div className="space-x-3 text-sm">
      {opts.map(d => (
        <Link key={d} href={`?days=${d}`} className={d === current ? 'underline' : 'text-secondary underline'}>{d}d</Link>
      ))}
    </div>
  );
}

export default async function PsychDetailPage({ searchParams }: { searchParams: { days?: string } }) {
  const days = Math.max(1, Math.min(90, parseInt(searchParams?.days ?? '14', 10) || 14));
  const psy = getPsychSignalsLastNDays(days);
  const chronological = [...psy].reverse();
  const dates = chronological.map(r => r.date);
  const sentiments = chronological.map(r => (typeof r.sentiment_score === 'number' ? r.sentiment_score : 0));
  const records = chronological.map(r => r.records ?? 0);

  const recs = getRecoveriesLastNDays(days);
  const recMap = new Map<string, number>();
  for (const r of recs) {
    if (typeof r.score === 'number') recMap.set(r.date, r.score);
  }
  const recoveries: number[] = dates.map(d => (recMap.has(d) ? (recMap.get(d) as number) : NaN));
  const corr = (() => {
    const xs: number[] = []; const ys: number[] = [];
    for (let i = 0; i < sentiments.length; i++) {
      if (Number.isFinite(recoveries[i]) && Number.isFinite(sentiments[i])) { xs.push(sentiments[i]); ys.push(recoveries[i]); }
    }
    return xs.length > 2 ? pearson(xs, ys) : null;
  })();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-green">Psych Signals</h1>
          {rangeLinks(days)}
        </div>

        <div className="card">
          <div className="grid md:grid-cols-2 gap-4">
            <PsychSparkline title={`Sentiment (${days}d)`} values={sentiments} labels={dates} color="#22c55e" decimals={3} />
            <PsychSparkline title={`Recovery (${days}d)`} values={recoveries.map(v => (Number.isFinite(v) ? v : 0))} labels={dates} color="#f59e0b" decimals={1} suffix="%" />
          </div>
          <div className="text-secondary text-xs mt-1">Legend: <span style={{color:'#22c55e'}}>●</span> Sentiment, <span style={{color:'#f59e0b'}}>●</span> Recovery</div>
          <div className="text-secondary text-sm mt-3">
            Correlation (sentiment vs recovery): {corr == null ? 'n/a' : corr.toFixed(3)}
          </div>
        </div>

        <div className="card">
          <strong>Recent {Math.min(14, days)} days</strong>
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
              {psy.slice(0, Math.min(14, days)).map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td className="text-right">{row.records}</td>
                  <td className="text-right">{Number(row.ttr).toFixed(3)}</td>
                  <td className="text-right">{Number(row.sentiment_score).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <Link href="/metrics" className="underline text-secondary">← Back to Metrics</Link>
        </div>
      </div>
    </div>
  );
}
