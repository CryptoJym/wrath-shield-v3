/**
 * Wrath Shield v3 - Memory Search API
 *
 * Provides a thin HTTP wrapper around Mem0 search so other
 * services (e.g., Agentic Grok) can retrieve memories via HTTP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchMemories } from '@/lib/MemoryWrapper';
import { currentUserOrThrow } from '@/lib/auth/user';

/**
 * GET /api/memory/search?q=...&limit=...&userId=...
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = currentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? '';
    const limit = Number(searchParams.get('limit') ?? '5');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'query (q) is required' },
        { status: 400 }
      );
    }

    const results = await searchMemories(query, userId, limit);
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (error) {
    console.error('[Memory Search API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search memories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory/search
 * Body: { query: string, limit?: number, userId?: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json();
    const query = (body?.query as string) ?? '';
    const limit = Number(body?.limit ?? 5);

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    const results = await searchMemories(query, userId, limit);
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (error) {
    console.error('[Memory Search API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search memories' },
      { status: 500 }
    );
  }
}
