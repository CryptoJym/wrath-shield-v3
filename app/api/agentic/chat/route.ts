import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
  const payload = await req.json();
  try {
    const r = await fetch(`${base}/api/agentic/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

