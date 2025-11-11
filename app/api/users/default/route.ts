import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { getUser } from '@/lib/db/queries';
import { getDatabase } from '@/lib/db/Database';

ensureServerOnly('app/api/users/default/route');

export async function GET() {
  const db = getDatabase();
  const row = db.prepare<{ value_enc: string }>(`SELECT value_enc FROM settings WHERE key = 'default_user_id' LIMIT 1`).get();
  return NextResponse.json({ defaultUserId: row?.value_enc ?? 'default' });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = (body?.userId as string)?.trim();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }
    const u = getUser(userId);
    if (!u) {
      return NextResponse.json({ success: false, error: 'user not found' }, { status: 404 });
    }
    const db = getDatabase();
    const upsert = db.prepare(`
      INSERT INTO settings (key, value_enc, user_id)
      VALUES ('default_user_id', ?, 'default')
      ON CONFLICT(key, user_id) DO UPDATE SET value_enc = excluded.value_enc, updated_at = strftime('%s', 'now')
    `);
    upsert.run(userId);
    return NextResponse.json({ success: true, defaultUserId: userId });
  } catch (e) {
    console.error('[Users Default API] POST error:', e);
    return NextResponse.json({ success: false, error: 'failed to set default user' }, { status: 500 });
  }
}
