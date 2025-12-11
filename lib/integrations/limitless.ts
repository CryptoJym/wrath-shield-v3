/**
 * Limitless Integration Module
 *
 * Bridges the LimitlessClient with the Cortex synthesis system.
 * This module is called by the cron scheduler to sync lifelogs
 * and feed them into the cognitive processing pipeline.
 *
 * Flow:
 * 1. Fetch new lifelogs from Limitless API
 * 2. Ingest into Cortex Working Memory for synthesis
 * 3. Store raw data in database for historical queries
 * 4. Trigger pattern learning from processed lifelogs
 */

import { ensureServerOnly } from '../server-only-guard';
import { getLimitlessClient, type ParsedLifelog } from '../LimitlessClient';
import { ingestLimitless, type LimitlessInput } from '../cortex/event-ingestor';
import { getEventBus, createNotificationEvent } from '../agents/life-os-event-bus';

ensureServerOnly('lib/integrations/limitless');

export interface SyncResult {
  success: boolean;
  lifelogsIngested: number;
  cortexIngested: number;
  errors: string[];
  durationMs: number;
}

/**
 * Sync lifelogs from Limitless API into the system
 *
 * This is the main entry point called by the cron scheduler.
 * It orchestrates:
 * 1. Fetching new lifelogs since last sync
 * 2. Ingesting into Cortex working memory for LLM synthesis
 * 3. Storing in database for historical queries
 */
export async function syncLifelogs(): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let lifelogsIngested = 0;
  let cortexIngested = 0;

  console.log('[Limitless Integration] Starting lifelog sync...');

  try {
    const client = getLimitlessClient();

    // Sync new lifelogs (incremental since last pull)
    lifelogsIngested = await client.syncNewLifelogs();
    console.log(`[Limitless Integration] Synced ${lifelogsIngested} lifelogs from API`);

    if (lifelogsIngested > 0) {
      // Fetch the most recent lifelogs for Cortex ingestion
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const recentLifelogs = await client.fetchAndParseLifelogs({
        start_date: yesterday,
        end_date: today,
      });

      // Ingest each lifelog into Cortex working memory
      for (const lifelog of recentLifelogs) {
        try {
          const result = await ingestLifelogToCortex(lifelog);
          if (!result.duplicate) {
            cortexIngested++;
          }
        } catch (error) {
          const errorMsg = `Failed to ingest lifelog ${lifelog.id}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[Limitless Integration] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log(`[Limitless Integration] Ingested ${cortexIngested} lifelogs into Cortex`);

      // Publish notification event
      const eventBus = getEventBus();
      await eventBus.publish(createNotificationEvent({
        source: 'limitless-integration',
        domain: 'health',
        payload: {
          type: 'lifelog-sync-complete',
          lifelogsIngested,
          cortexIngested,
          timestamp: new Date().toISOString(),
        },
        priority: 'low',
      }));
    }

  } catch (error) {
    const errorMsg = `Lifelog sync failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Limitless Integration] ${errorMsg}`);
    errors.push(errorMsg);
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Limitless Integration] Sync completed in ${durationMs}ms`);

  return {
    success: errors.length === 0,
    lifelogsIngested,
    cortexIngested,
    errors,
    durationMs,
  };
}

/**
 * Ingest a single lifelog into Cortex working memory
 */
async function ingestLifelogToCortex(lifelog: ParsedLifelog): Promise<{ duplicate: boolean }> {
  return await ingestLifelog({
    lifelogId: lifelog.id,
    content: lifelog.transcript,
    summary: lifelog.summary || undefined,
    startTime: lifelog.start_time,
    endTime: lifelog.end_time,
    metadata: {
      date: lifelog.date,
      rawJson: lifelog.raw_json,
    },
  });
}

/**
 * Backfill lifelogs for a date range
 * Useful for initial setup or catching up after downtime
 */
export async function backfillLifelogs(
  startDate: string,
  endDate?: string
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let lifelogsIngested = 0;
  let cortexIngested = 0;

  console.log(`[Limitless Integration] Starting backfill from ${startDate} to ${endDate || 'today'}...`);

  try {
    const client = getLimitlessClient();

    // Backfill directly to database
    lifelogsIngested = await client.backfillRangeForDb(startDate, endDate);

    // Also ingest into Cortex
    const lifelogs = await client.fetchAndParseLifelogs({
      start_date: startDate,
      end_date: endDate,
    });

    for (const lifelog of lifelogs) {
      try {
        const result = await ingestLifelogToCortex(lifelog);
        if (!result.duplicate) {
          cortexIngested++;
        }
      } catch (error) {
        errors.push(`Failed to ingest lifelog ${lifelog.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

  } catch (error) {
    errors.push(`Backfill failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    success: errors.length === 0,
    lifelogsIngested,
    cortexIngested,
    errors,
    durationMs: Date.now() - startTime,
  };
}
