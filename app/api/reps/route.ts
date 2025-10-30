import { NextResponse } from 'next/server';
import { getPlans, completeRep } from '@/lib/phraseReps';

export async function GET() {
  const plans = getPlans(Date.now());
  return NextResponse.json({ success: true, plans });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const phrase = String(body?.phrase || '');
    const at = Number(body?.at || 0);
    if (!phrase) return NextResponse.json({ success: false, error: 'phrase required' }, { status: 400 });
    const ok = completeRep(phrase, at);
    return NextResponse.json({ success: ok });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 });
  }
}
