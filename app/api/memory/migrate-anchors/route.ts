/**
 * Migration endpoint to copy anchor memories from one user to another.
 *
 * POST /api/memory/migrate-anchors
 * Body: { from?: string, to?: string }
 * Defaults: from='default-user', to='default'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllMemories, addAnchor } from '@/lib/MemoryWrapper';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const fromUser: string = (body?.from as string) || 'default-user';
    const toUser: string = (body?.to as string) || 'default';

    if (fromUser === toUser) {
      return NextResponse.json(
        { success: false, error: 'from and to user must differ' },
        { status: 400 }
      );
    }

    const fromAll = await getAllMemories(fromUser);
    const toAll = await getAllMemories(toUser);

    const fromAnchors = (fromAll || []).filter((m: any) => m?.metadata?.type === 'anchor');
    const toAnchors = (toAll || []).filter((m: any) => m?.metadata?.type === 'anchor');

    // Build a simple dedupe set for the target based on (text|memory, date, category)
    const key = (m: any) => `${(m.text ?? m.memory ?? '').trim()}|${m?.metadata?.date ?? ''}|${m?.metadata?.category ?? ''}`;
    const toKeys = new Set(toAnchors.map(key));

    let copied = 0;
    for (const m of fromAnchors) {
      const k = key(m);
      if (toKeys.has(k)) continue;
      const text: string = (m.text ?? m.memory ?? '').trim();
      if (!text) continue;
      const category: string = m?.metadata?.category ?? 'general';
      const date: string = m?.metadata?.date ?? new Date().toISOString().slice(0, 10);
      await addAnchor(text, category, date, toUser);
      toKeys.add(k);
      copied += 1;
    }

    return NextResponse.json({ success: true, from: fromUser, to: toUser, copied });
  } catch (error) {
    console.error('[Migrate Anchors API] Error:', error);
    return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 });
  }
}

