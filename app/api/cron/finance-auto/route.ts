import { NextResponse } from 'next/server';
import { listContextRequests } from '@/lib/finance/store';
import { autoClassifyOne } from '@/lib/finance/llm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }
  const hdr = req.headers.get('x-cron-secret');
  if (hdr !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 20);

  const pending = listContextRequests('pending').slice(0, limit);
  const results: any[] = [];
  for (const r of pending) {
    try {
      const updated = await autoClassifyOne(r.id);
      results.push({ id: r.id, ok: true, bucket: updated?.bucket, reimbursable: updated?.reimbursable });
    } catch (e: any) {
      results.push({ id: r.id, ok: false, error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
