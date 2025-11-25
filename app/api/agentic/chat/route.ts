import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.json();
    const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';

    // Normalize payload: support both {query,...} and {messages:[...]} shapes
    let query: string | undefined = typeof incoming?.query === 'string' ? incoming.query : undefined;
    let conversation_history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined = incoming?.conversation_history;
    const user_id: string | undefined = incoming?.user_id || 'default';

    if (!query && Array.isArray(incoming?.messages)) {
      const msgs = incoming.messages as Array<{ role: string; content: string }>;
      // Take last user message as the query; pass the rest as history
      const lastUser = [...msgs].reverse().find((m) => m?.role === 'user' && typeof m?.content === 'string');
      query = lastUser?.content || '';
      conversation_history = msgs
        .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    }

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const payload = { query, conversation_history, user_id };

    const resp = await fetch(`${base}/api/agentic/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    console.error('[Next Agentic Chat] Error:', e);
    return NextResponse.json({ error: 'Agentic chat failed' }, { status: 500 });
  }
}
