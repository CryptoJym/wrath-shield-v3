/**
 * iMessage Ingest API
 *
 * POST /api/events/ingest-imessage
 * Reads .data/imessage.jsonl and upserts into events database
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { upsertEvents, type EventRow } from '@/lib/events';
import { currentUserOptional } from '@/lib/auth/user';
import { ingestIMessage } from '@/lib/cortex/event-ingestor';
import type { IMessageInput } from '@/lib/cortex/event-ingestor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface IMessageRecord {
  id: string;
  handle: string;
  text: string;
  ts: number;
  direction?: 'sent' | 'received';
  service?: string;
  has_attachments?: boolean;
}

export async function POST(request: Request) {
  try {
    const userInfo = currentUserOptional();
    const user_id = userInfo?.userId || 'james@jamesbrady.org';
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 5000; // Default to 5000 records
    const enableCortex = body.enableCortex ?? true; // Enable Cortex by default

    const dataDir = path.resolve(process.cwd(), '.data');
    const imessagePath = path.join(dataDir, 'imessage.jsonl');

    if (!fs.existsSync(imessagePath)) {
      return NextResponse.json(
        { ok: false, error: 'imessage.jsonl not found' },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(imessagePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);

    const events: EventRow[] = [];
    let skipped = 0;
    let cortexIngested = 0;
    let cortexSkipped = 0;

    for (const line of lines.slice(0, limit)) {
      try {
        const record: IMessageRecord = JSON.parse(line);

        // Skip empty messages
        if (!record.text || record.text.trim() === '') {
          skipped++;
          continue;
        }

        // Add to legacy events database
        events.push({
          id: `imessage:${record.id}`,
          user_id,
          source: 'imessage',
          channel: 'imessage',
          direction: record.direction || null,
          contact: record.handle,
          ts: Math.floor(record.ts),
          subject: null,
          preview: record.text.slice(0, 500),
          metadata: {
            handle: record.handle,
            full_text: record.text,
            original_ts: record.ts,
            service: record.service,
            has_attachments: record.has_attachments,
          },
        });

        // Ingest into Cortex Working Memory (if enabled)
        if (enableCortex) {
          try {
            const iMessageInput: IMessageInput = {
              contact: record.handle,
              content: record.text,
              timestamp: new Date(record.ts * 1000).toISOString(),
              messageId: record.id,
              direction: record.direction,
              metadata: {
                handle: record.handle,
                service: record.service,
                has_attachments: record.has_attachments,
              },
            };

            const result = await ingestIMessage(iMessageInput);

            if (result.duplicate) {
              cortexSkipped++;
            } else {
              cortexIngested++;
            }
          } catch (cortexError) {
            console.error('[iMessage Ingest] Cortex ingestion error:', cortexError);
            // Don't fail the entire operation if Cortex ingestion fails
          }
        }
      } catch (e) {
        skipped++;
      }
    }

    if (events.length > 0) {
      upsertEvents(events, user_id);
    }

    return NextResponse.json({
      ok: true,
      ingested: events.length,
      skipped,
      total_lines: lines.length,
      cortex: enableCortex
        ? {
            enabled: true,
            ingested: cortexIngested,
            skipped: cortexSkipped,
          }
        : { enabled: false },
    });
  } catch (error) {
    console.error('[iMessage Ingest] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return status of iMessage data
  const dataDir = path.resolve(process.cwd(), '.data');
  const imessagePath = path.join(dataDir, 'imessage.jsonl');

  if (!fs.existsSync(imessagePath)) {
    return NextResponse.json({
      ok: false,
      exists: false,
      message: 'imessage.jsonl not found',
    });
  }

  const content = fs.readFileSync(imessagePath, 'utf8');
  const lines = content.split('\n').filter(Boolean);

  // Count non-empty messages and find newest timestamp
  let nonEmpty = 0;
  let newestTs = 0;
  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      if (record.text && record.text.trim()) {
        nonEmpty++;
        if (record.ts > newestTs) newestTs = record.ts;
      }
    } catch {}
  }

  // Check file age
  const stats = fs.statSync(imessagePath);
  const fileAgeHours = Math.floor((Date.now() - stats.mtimeMs) / (1000 * 60 * 60));

  // Check data age (newest message)
  const dataAgeDays = newestTs > 0
    ? Math.floor((Date.now() / 1000 - newestTs) / (24 * 60 * 60))
    : null;

  // Determine warnings
  const warnings: string[] = [];
  if (fileAgeHours > 48) {
    warnings.push(`File not updated in ${fileAgeHours} hours`);
  }
  if (dataAgeDays !== null && dataAgeDays > 7) {
    warnings.push(`Newest message is ${dataAgeDays} days old`);
  }

  return NextResponse.json({
    ok: warnings.length === 0,
    exists: true,
    total_records: lines.length,
    non_empty: nonEmpty,
    file_age_hours: fileAgeHours,
    data_age_days: dataAgeDays,
    warnings: warnings.length > 0 ? warnings : undefined,
    message: warnings.length > 0
      ? `⚠️ ${warnings.join('; ')}. Run export script to update.`
      : `Found ${lines.length} iMessage records (${nonEmpty} with text). POST to ingest.`,
  });
}
