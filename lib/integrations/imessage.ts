/**
 * iMessage Integration Module
 *
 * Bridges the macOS Messages database with the Cortex synthesis system.
 * This module is called by the cron scheduler to sync new messages
 * and feed them into the cognitive processing pipeline.
 *
 * Requirements:
 * - Full Disk Access for the app/process (to read ~/Library/Messages/chat.db)
 * - macOS only - will gracefully skip on other platforms
 *
 * Flow:
 * 1. Query chat.db for new messages since last sync
 * 2. Ingest into Cortex Working Memory for synthesis
 * 3. Track sync state to avoid duplicates
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 * iMessage content is sensitive PII - handle accordingly.
 */

import { ensureServerOnly } from '../server-only-guard';
import { ingestIMessage, type IMessageInput } from '../cortex/event-ingestor';
import { getEventBus, createNotificationEvent, DOMAINS } from '../agents/life-os-event-bus';
import { getDatabase } from '../db/Database';

ensureServerOnly('lib/integrations/imessage');

export interface IMessageSyncResult {
  success: boolean;
  messagesIngested: number;
  cortexIngested: number;
  errors: string[];
  durationMs: number;
}

interface RawIMessage {
  ROWID: number;
  guid: string;
  text: string | null;
  handle_id: number;
  date: number;  // Apple's COCOA timestamp (seconds since 2001-01-01)
  is_from_me: number;
  cache_has_attachments: number;
  service: string;
}

interface RawHandle {
  ROWID: number;
  id: string;  // Phone number or email
}

// Apple's COCOA reference date offset (seconds between Unix epoch and 2001-01-01)
const COCOA_EPOCH_OFFSET = 978307200;

/**
 * Convert Apple COCOA timestamp to ISO 8601
 */
function cocoaToISO(cocoaTimestamp: number): string {
  // COCOA timestamps can be in seconds or nanoseconds depending on macOS version
  // If > 1e12, it's likely nanoseconds
  const seconds = cocoaTimestamp > 1e12 ? cocoaTimestamp / 1e9 : cocoaTimestamp;
  const unixMs = (seconds + COCOA_EPOCH_OFFSET) * 1000;
  return new Date(unixMs).toISOString();
}

/**
 * Get the path to the iMessage database
 */
function getIMessageDbPath(): string {
  const homeDir = process.env.HOME || '/Users';
  return `${homeDir}/Library/Messages/chat.db`;
}

/**
 * Get or create the sync state table for tracking last sync
 */
function ensureSyncStateTable(): void {
  const db = getDatabase().getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS imessage_sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_timestamp INTEGER NOT NULL DEFAULT 0,
      last_sync_at TEXT NOT NULL,
      messages_synced INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO imessage_sync_state (id, last_sync_timestamp, last_sync_at, messages_synced)
    VALUES (1, 0, '1970-01-01T00:00:00.000Z', 0);
  `);
}

/**
 * Get the last sync timestamp
 */
function getLastSyncTimestamp(): number {
  const db = getDatabase().getRawDb();
  ensureSyncStateTable();
  const row = db.prepare('SELECT last_sync_timestamp FROM imessage_sync_state WHERE id = 1').get() as any;
  return row?.last_sync_timestamp || 0;
}

/**
 * Update the sync state with new timestamp
 */
function updateSyncState(timestamp: number, messageCount: number): void {
  const db = getDatabase().getRawDb();
  db.prepare(`
    UPDATE imessage_sync_state
    SET last_sync_timestamp = ?,
        last_sync_at = ?,
        messages_synced = messages_synced + ?
    WHERE id = 1
  `).run(timestamp, new Date().toISOString(), messageCount);
}

/**
 * Sync new iMessages from macOS Messages database into Cortex
 *
 * This is the main entry point called by the cron scheduler.
 */
export async function syncIMessages(): Promise<IMessageSyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let messagesIngested = 0;
  let cortexIngested = 0;

  console.log('[iMessage Integration] Starting iMessage sync...');

  // Check if we're on macOS
  if (process.platform !== 'darwin') {
    console.log('[iMessage Integration] Skipping - not on macOS');
    return {
      success: true,
      messagesIngested: 0,
      cortexIngested: 0,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  try {
    // Dynamic import better-sqlite3 for iMessage DB access
    const Database = (await import('better-sqlite3')).default;

    const dbPath = getIMessageDbPath();

    // Try to open the iMessage database (requires Full Disk Access)
    let imessageDb;
    try {
      imessageDb = new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
      const errorMsg = `Cannot access iMessage database. Ensure Full Disk Access is granted. Error: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[iMessage Integration] ${errorMsg}`);
      errors.push(errorMsg);
      return {
        success: false,
        messagesIngested: 0,
        cortexIngested: 0,
        errors,
        durationMs: Date.now() - startTime,
      };
    }

    // Get last sync timestamp
    const lastSyncTimestamp = getLastSyncTimestamp();
    console.log(`[iMessage Integration] Last sync timestamp: ${lastSyncTimestamp} (${cocoaToISO(lastSyncTimestamp)})`);

    // Query new messages since last sync
    // Note: We select from `message` joined with `handle` to get contact info
    const messages = imessageDb.prepare(`
      SELECT
        m.ROWID,
        m.guid,
        m.text,
        m.handle_id,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        COALESCE(m.service, 'iMessage') as service,
        h.id as contact_id
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.date > ?
        AND m.text IS NOT NULL
        AND m.text != ''
      ORDER BY m.date ASC
      LIMIT 500
    `).all(lastSyncTimestamp) as (RawIMessage & { contact_id: string })[];

    console.log(`[iMessage Integration] Found ${messages.length} new messages`);

    if (messages.length === 0) {
      imessageDb.close();
      return {
        success: true,
        messagesIngested: 0,
        cortexIngested: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    let latestTimestamp = lastSyncTimestamp;

    // Process each message
    for (const msg of messages) {
      try {
        const imessageInput: IMessageInput = {
          contact: msg.contact_id || `unknown-${msg.handle_id}`,
          content: msg.text || '',
          timestamp: cocoaToISO(msg.date),
          messageId: msg.guid,
          direction: msg.is_from_me ? 'sent' : 'received',
          metadata: {
            handle: msg.contact_id,
            service: msg.service,
            has_attachments: msg.cache_has_attachments > 0,
            rowId: msg.ROWID,
          },
        };

        const result = await ingestIMessage(imessageInput);
        messagesIngested++;

        if (!result.duplicate) {
          cortexIngested++;
        }

        // Track latest timestamp for next sync
        if (msg.date > latestTimestamp) {
          latestTimestamp = msg.date;
        }
      } catch (error) {
        const errorMsg = `Failed to ingest message ${msg.guid}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[iMessage Integration] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Update sync state
    if (latestTimestamp > lastSyncTimestamp) {
      updateSyncState(latestTimestamp, messagesIngested);
    }

    imessageDb.close();

    console.log(`[iMessage Integration] Ingested ${cortexIngested} messages into Cortex`);

    // Publish notification event if we processed messages
    if (cortexIngested > 0) {
      const eventBus = getEventBus();
      await eventBus.publish(createNotificationEvent(
        'imessage-integration',
        {
          type: 'imessage-sync-complete',
          messagesIngested,
          cortexIngested,
          timestamp: new Date().toISOString(),
        },
        DOMAINS.FAMILY, // iMessages typically relate to personal/family domain
        'low'
      ));
    }

  } catch (error) {
    const errorMsg = `iMessage sync failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[iMessage Integration] ${errorMsg}`);
    errors.push(errorMsg);
  }

  const durationMs = Date.now() - startTime;
  console.log(`[iMessage Integration] Sync completed in ${durationMs}ms`);

  return {
    success: errors.length === 0,
    messagesIngested,
    cortexIngested,
    errors,
    durationMs,
  };
}

/**
 * Backfill iMessages from a specific date range
 * Useful for initial setup or catching up after downtime
 */
export async function backfillIMessages(
  startDate: string,
  endDate?: string
): Promise<IMessageSyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let messagesIngested = 0;
  let cortexIngested = 0;

  console.log(`[iMessage Integration] Starting backfill from ${startDate} to ${endDate || 'now'}...`);

  if (process.platform !== 'darwin') {
    console.log('[iMessage Integration] Skipping backfill - not on macOS');
    return {
      success: true,
      messagesIngested: 0,
      cortexIngested: 0,
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const Database = (await import('better-sqlite3')).default;
    const dbPath = getIMessageDbPath();

    let imessageDb;
    try {
      imessageDb = new Database(dbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
      errors.push(`Cannot access iMessage database: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        messagesIngested: 0,
        cortexIngested: 0,
        errors,
        durationMs: Date.now() - startTime,
      };
    }

    // Convert dates to COCOA timestamps
    const startCocoaTs = (new Date(startDate).getTime() / 1000) - COCOA_EPOCH_OFFSET;
    const endCocoaTs = endDate
      ? (new Date(endDate).getTime() / 1000) - COCOA_EPOCH_OFFSET
      : (Date.now() / 1000) - COCOA_EPOCH_OFFSET;

    const messages = imessageDb.prepare(`
      SELECT
        m.ROWID,
        m.guid,
        m.text,
        m.handle_id,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        COALESCE(m.service, 'iMessage') as service,
        h.id as contact_id
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      WHERE m.date >= ? AND m.date <= ?
        AND m.text IS NOT NULL
        AND m.text != ''
      ORDER BY m.date ASC
    `).all(startCocoaTs, endCocoaTs) as (RawIMessage & { contact_id: string })[];

    console.log(`[iMessage Integration] Found ${messages.length} messages in date range`);

    for (const msg of messages) {
      try {
        const imessageInput: IMessageInput = {
          contact: msg.contact_id || `unknown-${msg.handle_id}`,
          content: msg.text || '',
          timestamp: cocoaToISO(msg.date),
          messageId: msg.guid,
          direction: msg.is_from_me ? 'sent' : 'received',
          metadata: {
            handle: msg.contact_id,
            service: msg.service,
            has_attachments: msg.cache_has_attachments > 0,
            rowId: msg.ROWID,
          },
        };

        const result = await ingestIMessage(imessageInput);
        messagesIngested++;

        if (!result.duplicate) {
          cortexIngested++;
        }
      } catch (error) {
        errors.push(`Failed to ingest message ${msg.guid}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    imessageDb.close();

  } catch (error) {
    errors.push(`Backfill failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    success: errors.length === 0,
    messagesIngested,
    cortexIngested,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Get sync status for monitoring
 */
export function getIMessageSyncStatus(): {
  lastSyncTimestamp: number;
  lastSyncAt: string;
  totalMessagesSynced: number;
} {
  const db = getDatabase().getRawDb();
  ensureSyncStateTable();
  const row = db.prepare('SELECT * FROM imessage_sync_state WHERE id = 1').get() as any;

  return {
    lastSyncTimestamp: row?.last_sync_timestamp || 0,
    lastSyncAt: row?.last_sync_at || 'never',
    totalMessagesSynced: row?.messages_synced || 0,
  };
}
