import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ensureServerOnly } from '@/lib/server-only-guard';

ensureServerOnly('app/api/users/route');

export async function GET(request: NextRequest) {
  const { listUsers } = await import('@/lib/db/queries');
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '50');
  const offset = Number(searchParams.get('offset') ?? '0');
  const users = listUsers(limit, offset);
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id: string = body?.id || uuidv4();
    const email: string | undefined = body?.email;
    const name: string | undefined = body?.name;
    const timezone: string | undefined = body?.timezone;

    const { createUser, getUser } = await import('@/lib/db/queries');
    createUser({ id, email, name, timezone });
    const user = getUser(id);
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error('[Users API] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}

