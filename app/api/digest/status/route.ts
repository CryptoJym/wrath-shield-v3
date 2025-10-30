/**
 * GET /api/digest/status
 * Returns the current digestion job status.
 */

import { NextResponse } from 'next/server';
import { getCurrentDigestStatus } from '@/lib/digestLimitless';

export async function GET() {
  try {
    const status = getCurrentDigestStatus();
    return NextResponse.json({ success: true, status }, { status: 200 });
  } catch (error) {
    console.error('[digest/status] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get status' }, { status: 500 });
  }
}

