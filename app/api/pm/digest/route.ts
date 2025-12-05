/**
 * PM Daily Digest API
 *
 * Endpoints for retrieving and generating PM council daily digests.
 *
 * GET /api/pm/digest - Get latest digest
 * GET /api/pm/digest/actionable - Get actionable items only
 * GET /api/pm/digest/stats - Get statistics only
 * POST /api/pm/digest/generate - Force generation of new digest
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateDailyDigest,
  getDigestStats,
  getActionableItems,
  formatDigestAsMarkdown,
  formatDigestAsHTML,
} from '@/lib/pm/daily-digest';

/**
 * GET /api/pm/digest
 *
 * Query params:
 * - since: ISO timestamp (optional, defaults to 24 hours ago)
 * - format: 'json' | 'markdown' | 'html' (optional, defaults to 'json')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const format = searchParams.get('format') || 'json';

    // Parse since parameter
    let since: Date | undefined;
    if (sinceParam) {
      since = new Date(sinceParam);
      if (isNaN(since.getTime())) {
        return NextResponse.json(
          { error: 'Invalid since parameter. Must be valid ISO timestamp.' },
          { status: 400 }
        );
      }
    }

    // Generate digest
    const digest = await generateDailyDigest(since);

    // Return in requested format
    switch (format) {
      case 'markdown':
        return new NextResponse(formatDigestAsMarkdown(digest), {
          headers: {
            'Content-Type': 'text/markdown',
          },
        });

      case 'html':
        return new NextResponse(formatDigestAsHTML(digest), {
          headers: {
            'Content-Type': 'text/html',
          },
        });

      case 'json':
      default:
        return NextResponse.json(digest);
    }
  } catch (error) {
    console.error('[Digest API] Error generating digest:', error);
    return NextResponse.json(
      { error: 'Failed to generate digest', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pm/digest/generate
 *
 * Force generation of new digest.
 * Body: { since?: string } (ISO timestamp)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { since: sinceParam } = body;

    // Parse since parameter
    let since: Date | undefined;
    if (sinceParam) {
      since = new Date(sinceParam);
      if (isNaN(since.getTime())) {
        return NextResponse.json(
          { error: 'Invalid since parameter. Must be valid ISO timestamp.' },
          { status: 400 }
        );
      }
    }

    // Generate digest
    const digest = await generateDailyDigest(since);

    return NextResponse.json({
      success: true,
      digest,
    });
  } catch (error) {
    console.error('[Digest API] Error generating digest:', error);
    return NextResponse.json(
      { error: 'Failed to generate digest', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
