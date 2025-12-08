import { NextResponse } from 'next/server';
import { listAgenticActions } from '@/lib/db/queries';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ea/pending
 * Returns pending items that need James's review for EA learning.
 */
export async function GET() {
  try {
    const { userId } = currentUserOrThrow();

    // Get proposed and queued items that haven't been reviewed
    const proposed = listAgenticActions({ status: 'proposed', limit: 20, userId });
    const queued = listAgenticActions({ status: 'queued', limit: 20, userId });

    // Combine and format for the learning interface
    const items = [...proposed, ...queued].map((action) => {
      // Parse metadata if it's a string
      let parsedMetadata: Record<string, unknown> = {};
      if (action.metadata) {
        try {
          parsedMetadata = typeof action.metadata === 'string'
            ? JSON.parse(action.metadata)
            : action.metadata;
        } catch {
          parsedMetadata = {};
        }
      }

      return {
        id: action.id,
        title: action.title || action.type || 'Untitled',
        content: action.content?.substring(0, 500) || '',
        source: (parsedMetadata.source as string) || action.source || 'unknown',
        eaClassification: {
          domain: (parsedMetadata.domain as string) || 'general',
          priority: (parsedMetadata.priority as string) || 'medium',
          action: (parsedMetadata.action as string) || 'review',
          reasoning: (parsedMetadata.reasoning as string) || 'No reasoning provided',
        },
        confidence: action.confidence || 0.5,
        created_at: action.created_at,
      };
    });

    // Sort by confidence (low confidence = needs review first)
    items.sort((a, b) => a.confidence - b.confidence);

    return NextResponse.json({
      items: items.slice(0, 10), // Top 10 items needing review
      total: items.length,
    });
  } catch (error) {
    console.error('[EA Pending] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending items', items: [] },
      { status: 500 }
    );
  }
}
