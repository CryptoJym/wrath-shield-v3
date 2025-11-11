import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
    const resp = await fetch(`${base}/api/agentic/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    console.error('[Next Agentic Chat] Error:', e);
    return NextResponse.json({ error: 'Agentic chat failed' }, { status: 500 });
  }
}

