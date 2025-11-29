import { NextResponse } from 'next/server';
import { listAgenticActions } from '@/lib/db/queries';
import { currentUserOrThrow } from '@/lib/auth/user';

export const revalidate = 5;
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = currentUserOrThrow();
  const proposed = listAgenticActions({ status: 'proposed', limit: 200, userId });
  const queued = listAgenticActions({ status: 'queued', limit: 200, userId });
  const executed = listAgenticActions({ status: 'executed', limit: 200, userId });
  const failed = listAgenticActions({ status: 'failed', limit: 50, userId });

  return NextResponse.json({
    counts: {
      proposed: proposed.length,
      queued: queued.length,
      executed: executed.length,
      failed: failed.length,
    },
    samples: {
      proposed: proposed.slice(0, 5),
      queued: queued.slice(0, 5),
      executed: executed.slice(0, 5),
      failed: failed.slice(0, 5),
    },
  });
}
