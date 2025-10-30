/**
 * Wrath Shield v3 - Anchors API Route
 *
 * Provides access to anchor memories (grounding truths and affirmations) from Mem0.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAnchors, addAnchor } from '@/lib/MemoryWrapper';

const USER_ID = 'default-user'; // Single-user app for now

/**
 * GET /api/anchors
 * Returns all anchor memories
 *
 * Query parameters:
 * - since: YYYY-MM-DD (optional) - only return anchors from this date onwards
 * - category: string (optional) - filter by category
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since') || undefined;
    const category = searchParams.get('category') || undefined;

    const anchors = await getAnchors(USER_ID, {
      since,
      category,
    });

    return NextResponse.json(
      { anchors },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=0' },
      }
    );
  } catch (error) {
    console.error('[Anchors API] GET Error:', error);
    return NextResponse.json(
      { anchors: [], error: 'Failed to fetch anchors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/anchors
 * Creates a new anchor memory
 *
 * Body:
 * - text: string (required)
 * - category: string (required)
 * - date: string (required, YYYY-MM-DD format)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'text is required and must be a string' },
        { status: 400 }
      );
    }

    if (!body.category || typeof body.category !== 'string') {
      return NextResponse.json(
        { success: false, error: 'category is required and must be a string' },
        { status: 400 }
      );
    }

    if (!body.date || typeof body.date !== 'string') {
      return NextResponse.json(
        { success: false, error: 'date is required and must be a string (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      return NextResponse.json(
        { success: false, error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Add anchor to Mem0
    await addAnchor(body.text, body.category, body.date, USER_ID);

    return NextResponse.json(
      {
        success: true,
        message: 'Anchor added successfully',
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'private, max-age=0' },
      }
    );
  } catch (error) {
    console.error('[Anchors API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add anchor' },
      { status: 500 }
    );
  }
}
