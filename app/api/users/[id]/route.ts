import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';

ensureServerOnly('app/api/users/[id]/route');

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { getUser } = await import('@/lib/db/queries');
  const user = getUser(params.id);
  if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, user });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { updateUser, getUser } = await import('@/lib/db/queries');
    updateUser(params.id, {
      email: body?.email,
      name: body?.name,
      timezone: body?.timezone,
    });
    const user = getUser(params.id);
    if (!user) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('[Users API] PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

