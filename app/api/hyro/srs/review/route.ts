/**
 * HYRO FORGE: SRS Review API
 * Card review and study session endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewCard, getReviewSessionSummary, QUALITY_RATINGS } from '@/lib/hyro/forge-srs';

export async function GET() {
  // Return quality rating reference
  return NextResponse.json({
    quality_ratings: QUALITY_RATINGS,
    description: 'SM-2 quality ratings for card review. 0-2 = incorrect, 3-5 = correct',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, card_id, quality, response_time_ms, session_start } = body;

    // Review a card
    if (action === 'review' || !action) {
      if (!card_id || quality === undefined) {
        return NextResponse.json(
          { error: 'card_id and quality (0-5) are required' },
          { status: 400 }
        );
      }

      if (quality < 0 || quality > 5) {
        return NextResponse.json(
          { error: 'Quality must be between 0 and 5' },
          { status: 400 }
        );
      }

      const result = reviewCard(card_id, quality, response_time_ms);

      return NextResponse.json({
        ...result,
        quality_label: QUALITY_RATINGS[quality as keyof typeof QUALITY_RATINGS]?.label,
        message: result.xp_earned > 0
          ? `Card reviewed! +${result.xp_earned} XP`
          : 'Card needs more practice',
      });
    }

    // Get session summary
    if (action === 'session-summary') {
      if (!session_start) {
        return NextResponse.json(
          { error: 'session_start timestamp is required' },
          { status: 400 }
        );
      }

      const summary = getReviewSessionSummary(session_start);
      return NextResponse.json({
        ...summary,
        message: `Session complete: ${summary.cards_reviewed} cards reviewed, ${summary.total_xp} XP earned`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('SRS Review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process review' },
      { status: 500 }
    );
  }
}
