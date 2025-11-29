/**
 * Hyro Sync API
 *
 * POST /api/hyro/sync - Trigger manual sync of learning sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';
import { crawlSource, crawlAllSources, initializeDefaultCrawlers } from '@/lib/hyro/crawler';
import type { LearningSource } from '@/lib/hyro/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user_id = currentUserOptional()?.userId || 'default';
    const body = await req.json();

    const { source, initialize } = body;

    // Initialize default crawlers if requested
    if (initialize === true) {
      initializeDefaultCrawlers();
      return NextResponse.json({
        ok: true,
        message: 'Default crawlers initialized',
      });
    }

    // Sync specific source or all sources
    if (source) {
      // Validate source
      const validSources: LearningSource[] = [
        'arxiv', 'youtube', 'github', 'medium', 'rss',
        'coursera', 'podcast', 'book', 'newsletter', 'custom'
      ];

      if (!validSources.includes(source as LearningSource)) {
        return NextResponse.json(
          { error: `Invalid source: ${source}` },
          { status: 400 }
        );
      }

      // Crawl single source
      const result = await crawlSource(source as LearningSource, user_id);

      return NextResponse.json({
        ok: result.success,
        source: result.source,
        items_found: result.items_found,
        items_new: result.items_new,
        items_updated: result.items_updated,
        error: result.error,
        synced_at: new Date(result.synced_at * 1000).toISOString(),
      });
    } else {
      // Crawl all sources
      const results = await crawlAllSources(user_id);

      const summary = {
        total_sources: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        total_items_found: results.reduce((sum, r) => sum + r.items_found, 0),
        total_items_new: results.reduce((sum, r) => sum + r.items_new, 0),
        total_items_updated: results.reduce((sum, r) => sum + r.items_updated, 0),
        results: results.map(r => ({
          source: r.source,
          success: r.success,
          items_found: r.items_found,
          items_new: r.items_new,
          error: r.error,
        })),
      };

      return NextResponse.json({
        ok: summary.failed === 0,
        ...summary,
      });
    }
  } catch (error) {
    console.error('[Hyro Sync API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for sync status/history
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const source = searchParams.get('source') as LearningSource | null;

    // Return sync history for a source
    // In production, would query sync_history table
    return NextResponse.json({
      message: 'Sync history endpoint - not yet implemented',
      source: source || 'all',
    });
  } catch (error) {
    console.error('[Hyro Sync API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
