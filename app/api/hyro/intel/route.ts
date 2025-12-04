/**
 * HYRO FORGE: Daily Intel Feed API
 * Curated educational content for daily engagement
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDailyFeed,
  getIntelItem,
  createIntelItem,
  viewIntelItem,
  completeIntelItem,
  skipIntelItem,
  getIntelHistory,
  generateSampleIntel,
} from '@/lib/hyro/forge-intel';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const itemId = searchParams.get('id');
    const action = searchParams.get('action');

    // Get single item
    if (itemId) {
      const item = getIntelItem(itemId);
      if (!item) {
        return NextResponse.json({ error: 'Intel item not found' }, { status: 404 });
      }
      return NextResponse.json({ item });
    }

    // Get history
    if (action === 'history') {
      const days = parseInt(searchParams.get('days') || '7');
      const history = getIntelHistory(days);
      return NextResponse.json({ history, days });
    }

    // Get daily feed (optionally for specific date)
    const feed = getDailyFeed(date || undefined);

    // If no items for today, generate sample content
    if (feed.items.length === 0) {
      generateSampleIntel(date || undefined);
      const updatedFeed = getDailyFeed(date || undefined);
      return NextResponse.json({
        ...updatedFeed,
        message: 'Generated fresh daily intel',
      });
    }

    return NextResponse.json(feed);
  } catch (error) {
    console.error('Intel GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch intel' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id } = body;

    // Create new intel item (for manual/admin use)
    if (action === 'create') {
      const {
        title,
        summary,
        content_type,
        subject,
        difficulty,
        source_url,
        source_name,
        thumbnail_url,
        estimated_time_minutes,
        xp_reward,
        intel_date,
      } = body;

      if (!title || !content_type) {
        return NextResponse.json(
          { error: 'title and content_type are required' },
          { status: 400 }
        );
      }

      const item = createIntelItem({
        title,
        summary,
        content_type,
        subject,
        difficulty,
        source_url,
        source_name,
        thumbnail_url,
        estimated_time_minutes,
        xp_reward,
        intel_date,
      });

      return NextResponse.json({ item, message: 'Intel item created' });
    }

    // Mark item as viewed
    if (action === 'view') {
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      const item = viewIntelItem(id);
      return NextResponse.json({ item, message: 'Marked as viewed' });
    }

    // Complete item
    if (action === 'complete') {
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      const result = completeIntelItem(id);
      return NextResponse.json({
        ...result,
        message: result.xp_earned > 0
          ? `Intel completed! +${result.xp_earned} XP`
          : 'Intel already completed',
      });
    }

    // Skip item
    if (action === 'skip') {
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      const item = skipIntelItem(id);
      return NextResponse.json({ item, message: 'Intel skipped' });
    }

    // Generate sample intel
    if (action === 'generate') {
      const date = body.date;
      const items = generateSampleIntel(date);
      return NextResponse.json({
        items,
        count: items.length,
        message: `Generated ${items.length} intel items`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Intel POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process intel action' },
      { status: 500 }
    );
  }
}
