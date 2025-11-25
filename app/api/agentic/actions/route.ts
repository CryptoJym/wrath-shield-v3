import { NextRequest, NextResponse } from 'next/server';
import { executeSingleAction } from '@/lib/executors';
import { listAgenticActions, updateAgenticActionStatusWithMeta } from '@/lib/db/queries';

export async function GET() {
  const proposed = listAgenticActions({ status: 'proposed', limit: 200 });
  const queued = listAgenticActions({ status: 'queued', limit: 200 });
  return NextResponse.json({ proposed, queued });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id;
    const action = body?.action as 'execute' | 'dismiss' | 'queue';
    const meta = body?.metadata;
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });

    if (action === 'execute') {
      if (meta && typeof meta === 'object') {
        updateAgenticActionStatusWithMeta(id, 'proposed', meta); // attach metadata hint (e.g., smtp_profile)
      }
      const res = await executeSingleAction(id);
      return NextResponse.json({ ok: true, result: res });
    }

    if (action === 'dismiss') {
      updateAgenticActionStatusWithMeta(id, 'dismissed', { reason: 'manual' });
      return NextResponse.json({ ok: true });
    }

    if (action === 'queue') {
      updateAgenticActionStatusWithMeta(id, 'queued', { reason: 'manual' });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
