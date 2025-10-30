/**
 * AWE Suggestions API Endpoint
 *
 * POST /api/awe/suggestions
 * Returns assured word suggestions for flagged phrases
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSuggestion } from '@/lib/assuredWordEngine';

/**
 * POST /api/awe/suggestions
 *
 * Request body:
 * {
 *   "phrase": "maybe"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "suggestion": {
 *     "original_phrase": "maybe",
 *     "assured_alt": "I will",
 *     "options": ["I will", "I decide", "I'm proceeding"],
 *     "lift_score": 0.18,
 *     "category": "hedges",
 *     "context_tags": ["work", "co-parent", "planning"]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { phrase } = body;

    // Validate phrase exists and is a string
    if (phrase === undefined || phrase === null || typeof phrase !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid "phrase" field',
          message: 'Request body must include a "phrase" string'
        },
        { status: 400 }
      );
    }

    // Trim whitespace
    const trimmedPhrase = phrase.trim();

    // Check for empty phrase (after type validation)
    if (!trimmedPhrase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Empty phrase',
          message: 'Phrase cannot be empty or whitespace only'
        },
        { status: 400 }
      );
    }

    // Query AWE for suggestions
    const suggestion = getSuggestion(trimmedPhrase);

    // Handle no suggestion found
    if (!suggestion) {
      return NextResponse.json(
        {
          success: false,
          error: 'No suggestion found',
          message: `No assured word suggestion available for phrase: "${trimmedPhrase}"`
        },
        { status: 404 }
      );
    }

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        suggestion
      },
      { status: 200 }
    );

  } catch (error) {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      );
    }

    // Handle server errors
    console.error('AWE suggestions API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing the request'
      },
      { status: 500 }
    );
  }
}
