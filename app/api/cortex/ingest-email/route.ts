/**
 * Cortex Email Ingestion API
 *
 * POST /api/cortex/ingest-email
 * Ingests emails into Cortex Working Memory for synthesis.
 * Can process single emails or batch from the events database.
 */

import { NextResponse } from 'next/server';
import { ingestEmail } from '@/lib/cortex/event-ingestor';
import type { EmailInput } from '@/lib/cortex/event-ingestor';
import { listRecentEvents, type EventRow } from '@/lib/events';
import { currentUserOptional } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Ingest a single email or batch process from events database
 *
 * Request body options:
 * 1. Single email: { email: EmailInput }
 * 2. Batch from events: { batchFromEvents: true, limit?: number, since?: number }
 */
export async function POST(request: Request) {
  try {
    const userInfo = currentUserOptional();
    const user_id = userInfo?.userId || 'james@jamesbrady.org';
    const body = await request.json().catch(() => ({}));

    // Option 1: Single email ingestion
    if (body.email) {
      const emailData: EmailInput = body.email;

      console.log('[Cortex Email Ingest] Processing single email:', {
        from: emailData.from,
        subject: emailData.subject,
      });

      const result = await ingestEmail(emailData);

      return NextResponse.json({
        ok: true,
        mode: 'single',
        result: {
          eventId: result.eventId,
          classification: {
            urgency: result.classification.urgency,
            domain: result.classification.domain,
            keywords: result.classification.keywords,
          },
          fastPathed: result.fastPathed,
          duplicate: result.duplicate,
        },
      });
    }

    // Option 2: Batch process from events database
    if (body.batchFromEvents) {
      const limit = body.limit || 100;
      const sinceTs = body.since || Math.floor(Date.now() / 1000) - 24 * 60 * 60; // Default: last 24 hours

      console.log(`[Cortex Email Ingest] Batch processing emails (limit: ${limit}, since: ${new Date(sinceTs * 1000).toISOString()})`);

      // Get recent emails from events database
      const events = await listRecentEvents(limit, user_id);

      // Filter for emails
      const emails = events.filter(e =>
        e.channel === 'email' &&
        e.ts >= sinceTs &&
        e.junk !== 1
      );

      console.log(`[Cortex Email Ingest] Found ${emails.length} emails to process`);

      // Process each email
      let ingested = 0;
      let duplicates = 0;
      let fastPathed = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      for (const event of emails) {
        try {
          // Convert EventRow to EmailInput
          const metadata = typeof event.metadata === 'string'
            ? JSON.parse(event.metadata)
            : event.metadata || {};

          const emailInput: EmailInput = {
            from: event.contact || 'unknown',
            to: metadata.to,
            subject: event.subject || '(no subject)',
            body: event.preview || '',
            timestamp: new Date(event.ts * 1000).toISOString(),
            messageId: event.id,
            metadata: {
              cc: metadata.cc,
              attachments: metadata.attachments,
              labels: metadata.labels,
              classification: event.classification || undefined,
              confidence: event.confidence || undefined,
            },
          };

          const result = await ingestEmail(emailInput);

          if (result.duplicate) {
            duplicates++;
          } else {
            ingested++;
            if (result.fastPathed) {
              fastPathed++;
            }
          }
        } catch (error) {
          errors++;
          errorDetails.push(`${event.id}: ${error instanceof Error ? error.message : String(error)}`);
          console.error(`[Cortex Email Ingest] Error processing email ${event.id}:`, error);
        }
      }

      return NextResponse.json({
        ok: true,
        mode: 'batch',
        result: {
          total_emails: emails.length,
          ingested,
          duplicates,
          fastPathed,
          errors,
          errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 10) : undefined,
        },
      });
    }

    // Invalid request
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid request. Provide either { email: EmailInput } or { batchFromEvents: true }',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Cortex Email Ingest] Error:', error);
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
 * GET endpoint for health check and documentation
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Cortex Email Ingestion endpoint is active',
    endpoint: '/api/cortex/ingest-email',
    method: 'POST',
    modes: {
      single: {
        description: 'Ingest a single email',
        payload: {
          email: {
            from: 'string (required)',
            to: 'string (optional)',
            subject: 'string (required)',
            body: 'string (required)',
            timestamp: 'string ISO 8601 (required)',
            messageId: 'string (optional, for deduplication)',
            metadata: 'object (optional)',
          },
        },
      },
      batch: {
        description: 'Batch process emails from events database',
        payload: {
          batchFromEvents: 'boolean (true)',
          limit: 'number (optional, default: 100)',
          since: 'number (optional, unix timestamp, default: last 24 hours)',
        },
      },
    },
  });
}
