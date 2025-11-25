import { NextResponse } from 'next/server';
import { listAgenticActions } from '@/lib/db/queries';

export const revalidate = 5;

export async function GET() {
  const proposed = listAgenticActions({ status: 'proposed', limit: 200 });
  const queued = listAgenticActions({ status: 'queued', limit: 200 });
  const executed = listAgenticActions({ status: 'executed', limit: 200 });
  const failed = listAgenticActions({ status: 'failed', limit: 50 });

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
