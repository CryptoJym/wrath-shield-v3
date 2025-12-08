/**
 * Unified Inbox Ingestion Cron Endpoint
 *
 * This endpoint programmatically executes Gmail and Outlook ingestion,
 * normalizes messages into CommsEvents, and feeds them through the
 * communications pipeline for classification and routing.
 *
 * Authentication: Bearer token or Vercel cron secret verification
 *
 * Usage:
 *   POST /api/cron/ingest
 *   Headers:
 *     - Authorization: Bearer <CRON_SECRET>
 *     - x-cron-secret: <CRON_SECRET>
 *
 *   Query params:
 *     - fetchFresh: "true" | "false" - whether to fetch from APIs or read JSONL (default: true)
 *     - writeJsonl: "true" | "false" - whether to write JSONL files (default: false in prod)
 *     - skipPipeline: "true" | "false" - skip running through comms pipeline (default: false)
 *     - maxGmail: number - max emails to fetch per Gmail mailbox
 *     - maxOutlook: number - max messages to fetch per Outlook mailbox
 *     - daysBack: number - days of history to fetch
 */

import { NextResponse } from 'next/server';
import { unifiedIngest, type UnifiedIngestSummary } from '@/lib/inbox/unified-ingest';
import { runPipeline, getPipelineMetrics, type ClassificationResult } from '@/lib/comms/pipeline';
import { upsertEvents, type EventRow } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum execution time for Vercel serverless (in seconds)
// Pro plans allow up to 300s, Hobby is 60s
export const maxDuration = 60;

interface IngestResponse {
  success: boolean;
  timestamp: number;
  summary: UnifiedIngestSummary;
  pipeline?: {
    processed: number;
    byCategory: Record<string, number>;
    needsReview: number;
    junk: number;
    routed: number;
  };
  errors: string[];
  duration_ms: number;
}

/**
 * Verify authentication via CRON_SECRET
 * Supports both Bearer token and x-cron-secret header
 */
function verifyAuth(req: Request): { authorized: boolean; error?: string } {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return { authorized: false, error: 'CRON_SECRET not configured' };
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token === secret) {
      return { authorized: true };
    }
  }

  // Check x-cron-secret header (Vercel cron)
  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader === secret) {
    return { authorized: true };
  }

  // Check for Vercel's automatic cron authentication
  const vercelCronHeader = req.headers.get('x-vercel-cron');
  if (vercelCronHeader === '1') {
    // Vercel cron jobs are automatically authenticated
    return { authorized: true };
  }

  return { authorized: false, error: 'Invalid or missing authentication' };
}

export async function POST(req: Request): Promise<NextResponse<IngestResponse | { error: string }>> {
  const startTime = Date.now();

  // Verify authentication
  const auth = verifyAuth(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse query parameters
  const url = new URL(req.url);
  const fetchFresh = url.searchParams.get('fetchFresh') !== 'false';
  const writeJsonl = url.searchParams.get('writeJsonl') === 'true';
  const skipPipeline = url.searchParams.get('skipPipeline') === 'true';
  const maxGmail = url.searchParams.get('maxGmail')
    ? parseInt(url.searchParams.get('maxGmail')!, 10)
    : undefined;
  const maxOutlook = url.searchParams.get('maxOutlook')
    ? parseInt(url.searchParams.get('maxOutlook')!, 10)
    : undefined;
  const daysBack = url.searchParams.get('daysBack')
    ? parseInt(url.searchParams.get('daysBack')!, 10)
    : undefined;

  const errors: string[] = [];

  try {
    // Step 1: Run unified ingest (Gmail + Outlook)
    console.log('[cron/ingest] Starting unified ingest...');
    const { events, summary } = await unifiedIngest({
      fetchFresh,
      writeJsonl,
      gmailOptions: maxGmail || daysBack ? { maxEmails: maxGmail, daysBack } : undefined,
      outlookOptions: maxOutlook || daysBack ? { maxItems: maxOutlook, daysBack } : undefined,
    });

    console.log(`[cron/ingest] Ingested ${events.length} events from ${summary.gmail.length + summary.outlook.length} mailboxes`);

    // Collect any ingest errors
    errors.push(...summary.errors);

    // Step 2: Persist events to database
    if (events.length > 0) {
      try {
        upsertEvents(events);
        console.log(`[cron/ingest] Persisted ${events.length} events to database`);
      } catch (e: any) {
        const dbError = `Failed to persist events: ${e?.message || String(e)}`;
        console.error(`[cron/ingest] ${dbError}`);
        errors.push(dbError);
      }
    }

    // Step 3: Run through comms pipeline (unless skipped)
    let pipelineStats: IngestResponse['pipeline'];

    if (!skipPipeline && events.length > 0) {
      console.log('[cron/ingest] Running events through comms pipeline...');

      let processed = 0;
      const byCategory: Record<string, number> = {};
      let needsReview = 0;
      let junk = 0;
      let routed = 0;

      for (const event of events) {
        try {
          const result = runPipeline(event, { skip_dedupe: false });

          if (result.success) {
            processed++;

            // Track category
            const cat = result.classification.category;
            byCategory[cat] = (byCategory[cat] || 0) + 1;

            if (result.classification.needs_review) {
              needsReview++;
            }

            if (result.classification.category === 'junk') {
              junk++;
            }

            if (result.routing?.success && result.routing?.routed_to) {
              routed++;
            }
          } else if (result.error) {
            errors.push(`Pipeline error for ${event.id}: ${result.error}`);
          }
        } catch (e: any) {
          errors.push(`Pipeline exception for ${event.id}: ${e?.message || String(e)}`);
        }
      }

      pipelineStats = {
        processed,
        byCategory,
        needsReview,
        junk,
        routed,
      };

      console.log(`[cron/ingest] Pipeline processed ${processed} events`);
    }

    const duration_ms = Date.now() - startTime;

    const response: IngestResponse = {
      success: true,
      timestamp: Date.now(),
      summary,
      pipeline: pipelineStats,
      errors,
      duration_ms,
    };

    console.log(`[cron/ingest] Completed in ${duration_ms}ms`);

    return NextResponse.json(response);
  } catch (e: any) {
    const duration_ms = Date.now() - startTime;
    const errorMsg = e?.message || String(e);

    console.error(`[cron/ingest] Fatal error: ${errorMsg}`);

    return NextResponse.json(
      {
        success: false,
        timestamp: Date.now(),
        summary: {
          startedAt: startTime,
          completedAt: Date.now(),
          gmail: [],
          outlook: [],
          totalMessages: 0,
          totalEvents: 0,
          errors: [errorMsg],
        },
        errors: [errorMsg],
        duration_ms,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check / status
 */
export async function GET(req: Request): Promise<NextResponse> {
  // Allow unauthenticated GET for health checks
  const metrics = getPipelineMetrics();

  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/cron/ingest',
    method: 'POST',
    description: 'Unified inbox ingestion cron endpoint',
    authentication: 'Bearer token or x-cron-secret header required for POST',
    pipeline_metrics: metrics,
    env: {
      gmail_configured: !!process.env.GMAIL_CLIENT_ID_JAMESBRADY_UTLYZE_COM || !!Object.keys(process.env).find((k) => k.startsWith('GMAIL_REFRESH_TOKEN_')),
      outlook_configured: !!process.env.O365_CLIENT_ID,
      cron_secret_set: !!process.env.CRON_SECRET,
    },
  });
}
