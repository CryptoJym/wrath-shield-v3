import { NextResponse } from 'next/server';
import { listContextRequests } from '../../../../../lib/finance/store';
import { currentUserOrThrow } from '../../../../../lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lightweight endpoint for the comms agent to pull the next pending finance context requests.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 10);
  const { userId } = currentUserOrThrow();
  const requests = listContextRequests('pending', userId).slice(0, limit);
  return NextResponse.json({ requests });
}
