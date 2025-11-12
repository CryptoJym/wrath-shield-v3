import { NextResponse } from 'next/server';
import { getLatestPsychSignal, getPsychSignalsLastNDays } from '@/lib/db/queries';
import { getRecoveriesLastNDays } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const series = searchParams.get('series');
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '14', 10) || 14, 1), 90);

    const wantCsv = (searchParams.get('export') || '').toLowerCase() === 'csv';
    if (series === '1' || series === 'true') {
      const rows = getPsychSignalsLastNDays(days);
      if (wantCsv) {
        const recs = getRecoveriesLastNDays(days);
        const recMap = new Map<string, number>();
        for (const r of recs) if (typeof r.score === 'number') recMap.set(r.date, r.score);
        const header = ['date','records','words','vocab','ttr','sentiment_score','pos_terms','neg_terms','recovery_score'];
        const lines = [header.join(',')];
        for (const r of rows) {
          const rc = recMap.get(r.date);
          lines.push([
            r.date,
            r.records ?? 0,
            r.words ?? 0,
            r.vocab ?? 0,
            (r.ttr ?? 0).toFixed(6),
            (r.sentiment_score ?? 0).toFixed(6),
            r.pos_terms ?? 0,
            r.neg_terms ?? 0,
            rc != null ? rc.toFixed(3) : ''
          ].join(','));
        }
        const csv = lines.join('\n');
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="psych_signals_${days}d.csv"`,
          },
        });
      }
      return NextResponse.json({ ok: true, series: rows });
    }

    const latest = getLatestPsychSignal();
    if (!latest) return NextResponse.json({ ok: true, latest: null });

    // Parse JSON fields for convenience
    let emotions: any = null, top_terms: any = null, sources: any = null;
    try { emotions = latest.emotions_json ? JSON.parse(latest.emotions_json) : null; } catch {}
    try { top_terms = latest.top_terms_json ? JSON.parse(latest.top_terms_json) : null; } catch {}
    try { sources = latest.sources_json ? JSON.parse(latest.sources_json) : null; } catch {}

    return NextResponse.json({ ok: true, latest: { ...latest, emotions, top_terms, sources } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
