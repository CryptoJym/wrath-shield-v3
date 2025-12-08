/**
 * Limitless Webhook API
 *
 * POST /api/limitless/webhook
 * Receives webhook notifications from Limitless when new lifelogs are created.
 * Ingests the lifelog data into Cortex Working Memory for synthesis.
 *
 * Webhook payload (expected from Limitless):
 * {
 *   "id": "lifelog-id",
 *   "startTime": "2025-12-07T10:00:00Z",
 *   "endTime": "2025-12-07T11:00:00Z",
 *   "markdown": "Full transcript...",
 *   "title": "Meeting summary",
 *   "isStarred": false
 * }
 */

import { NextResponse } from 'next/server';
import { ingestLimitless } from '@/lib/cortex/event-ingestor';
import type { LimitlessInput } from '@/lib/cortex/event-ingestor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface LimitlessWebhookPayload {
  id: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  markdown: string; // Transcript
  title: string; // Summary
  isStarred?: boolean;
  contents?: any[];
  updatedAt?: string;
}

export async function POST(request: Request) {
  try {
    console.log('[Limitless Webhook] Received webhook');

    // Parse webhook payload
    const payload: LimitlessWebhookPayload = await request.json();

    console.log('[Limitless Webhook] Payload:', {
      id: payload.id,
      title: payload.title,
      startTime: payload.startTime,
      endTime: payload.endTime,
    });

    // Validate payload
    if (!payload.id || !payload.startTime || !payload.title) {
      console.error('[Limitless Webhook] Invalid payload: missing required fields');
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid payload: missing id, startTime, or title',
        },
        { status: 400 }
      );
    }

    // Convert to LimitlessInput format
    const limitlessInput: LimitlessInput = {
      summary: payload.title,
      transcript: payload.markdown,
      timestamp: payload.startTime,
      lifelogId: payload.id,
      context: {
        startTime: payload.startTime,
        endTime: payload.endTime,
        isStarred: payload.isStarred,
        contents: payload.contents,
        updatedAt: payload.updatedAt,
      },
    };

    // Ingest into Cortex Working Memory
    const result = await ingestLimitless(limitlessInput);

    if (result.duplicate) {
      console.log('[Limitless Webhook] Lifelog is duplicate, skipped ingestion');
      return NextResponse.json({
        ok: true,
        message: 'Lifelog already processed (duplicate)',
        eventId: null,
        duplicate: true,
      });
    }

    console.log('[Limitless Webhook] Lifelog ingested successfully:', {
      eventId: result.eventId,
      urgency: result.classification.urgency,
      fastPathed: result.fastPathed,
    });

    return NextResponse.json({
      ok: true,
      message: 'Lifelog ingested into Cortex Working Memory',
      eventId: result.eventId,
      classification: {
        urgency: result.classification.urgency,
        keywords: result.classification.keywords,
      },
      fastPathed: result.fastPathed,
      duplicate: false,
    });
  } catch (error) {
    console.error('[Limitless Webhook] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for webhook health check
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Limitless webhook endpoint is active',
    endpoint: '/api/limitless/webhook',
    method: 'POST',
    expectedPayload: {
      id: 'string (required)',
      startTime: 'string ISO 8601 (required)',
      endTime: 'string ISO 8601 (required)',
      markdown: 'string (transcript)',
      title: 'string (summary, required)',
      isStarred: 'boolean (optional)',
    },
  });
}
