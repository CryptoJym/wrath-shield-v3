import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
  const healthUrl = `${base}/api/agentic/health`;
  const dbUrl = `${base}/api/db/status`;

  const out: any = { agentic: null, db: null };
  try {
    const r = await fetch(healthUrl, { cache: 'no-store' });
    out.agentic = await r.json();
  } catch (e: any) {
    out.agentic = { status: 'unavailable', error: String(e) };
  }

  try {
    const r2 = await fetch(dbUrl, { cache: 'no-store' });
    out.db = await r2.json();
  } catch (e: any) {
    out.db = { error: String(e) };
  }

  return NextResponse.json(out);
}

