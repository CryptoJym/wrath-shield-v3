import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import { listLegalContextRequests } from '../../../../../lib/legal/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lightweight endpoint for the legal agent to pull the next pending legal context requests.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 10);
  const { userId } = currentUserOrThrow();
  const requests = listLegalContextRequests('pending', userId).slice(0, limit);
  return NextResponse.json({ requests });
}
