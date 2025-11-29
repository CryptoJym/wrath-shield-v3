import { NextResponse } from 'next/server';
import { getBaselines, getTodaySnapshot } from '@/lib/db/queries';

export async function GET() {
  try {
    const b30 = getBaselines(30);
    const b90 = getBaselines(90);
    const today = getTodaySnapshot();
    return NextResponse.json({ ok: true, b30, b90, today });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

