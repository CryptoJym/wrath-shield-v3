import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
    const healthUrl = `${base}/api/agentic/health`;
    const dbUrl = `${base}/api/db/status`;
    let agentic: any = null; let db: any = null;
    try { const r = await fetch(healthUrl, { cache: 'no-store' }); agentic = await r.json(); } catch {}
    try { const r2 = await fetch(dbUrl, { cache: 'no-store' }); db = await r2.json(); } catch {}
    const tokens = db?.eeg_tokens?.row_count ?? null;
    const connected = !!db?.eeg_tokens?.has_data;
    return NextResponse.json({ ok: true, connected, tokens, agentic });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

