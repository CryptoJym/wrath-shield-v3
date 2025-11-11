import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
  try {
    const r = await fetch(`${base}/api/agentic/health`, { cache: 'no-store' });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ status: 'unavailable', error: String(e) }, { status: 503 });
  }
}

