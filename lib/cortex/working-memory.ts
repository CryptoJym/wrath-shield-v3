/**
 * Wrath Shield v3 - Working Memory Buffer System
 *
 * Ring buffer that stores incoming events before synthesis. Features:
 * - SQLite-backed persistence
 * - Content-based deduplication via SHA-256 hashing
 * - Automatic pruning of old processed events
 * - Efficient querying by processing status and time ranges
 */

import { createHash, randomUUID } from 'crypto';
import { Database as SqliteDatabase } from 'better-sqlite3';
import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import type { WorkingMemoryEvent, EventSource } from './types';
import { extractEntities } from './entity-extractor';
import {
  TemporalSearchPreprocessor,
  createTemporalSearchPreprocessor,
  type TemporalSearchOptions,
  type ParsedTemporalExpression,
} from './temporal-search';

// Ensure this module is only used server-side
ensureServerOnly('lib/cortex/working-memory');

/**
 * Working Memory Configuration
 */
export interface WorkingMemoryConfig {
  /** Maximum number of events to keep in buffer (default: 500) */
  maxBufferSize: number;

  /** Time window for deduplication in hours (default: 1) */
  dedupeWindowHours: number;

  /** Age in hours after which processed events are pruned (default: 168 = 1 week) */
  pruneAfterHours: number;

  /** Whether to automatically extract entities on event ingestion (default: true) */
  enableEntityExtraction: boolean;

  /** Use LLM for entity extraction (default: false for fast regex-only) */
  useLLMForEntities: boolean;
}

/**
 * Working Memory Statistics
 */
export interface WorkingMemoryStats {
  /** Total events in buffer */
  totalEvents: number;

  /** Events awaiting synthesis */
  unprocessedEvents: number;

  /** Events processed in last 24 hours */
  processedLast24h: number;

  /** Oldest event timestamp */
  oldestEventTimestamp: string | null;

  /** Newest event timestamp */
  newestEventTimestamp: string | null;

  /** Events by source */
  eventsBySource: Record<EventSource, number>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WorkingMemoryConfig = {
  maxBufferSize: 500,
  dedupeWindowHours: 1,
  pruneAfterHours: 168, // 1 week
  enableEntityExtraction: true, // Auto-extract entities on ingestion
  useLLMForEntities: false, // Use fast regex extraction by default
};

/**
 * Working Memory Buffer System
 *
 * Manages a ring buffer of events before they are synthesized into long-term memory.
 */
export class WorkingMemory {
  private db: SqliteDatabase;
  private config: WorkingMemoryConfig;
  private temporalPreprocessor: TemporalSearchPreprocessor | null = null;

  /**
   * Initialize Working Memory with optional configuration
   */
  constructor(config?: Partial<WorkingMemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = getDatabase().getRawDb();
    this.ensureTable();
  }

  /**
   * Get the temporal search preprocessor (lazy initialization)
   */
  public getTemporalPreprocessor(): TemporalSearchPreprocessor {
    if (!this.temporalPreprocessor) {
      this.temporalPreprocessor = createTemporalSearchPreprocessor(this);
    }
    return this.temporalPreprocessor;
  }

  /**
   * Create the working_memory_events table if it doesn't exist
   */
  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS working_memory_events (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        embedding_json TEXT,
        initial_classification_json TEXT,
        processed_by_synthesis INTEGER DEFAULT 0,
        synthesis_task_id TEXT,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_wm_timestamp ON working_memory_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_wm_processed ON working_memory_events(processed_by_synthesis, timestamp);
      CREATE INDEX IF NOT EXISTS idx_wm_content_hash ON working_memory_events(content_hash, timestamp);
      CREATE INDEX IF NOT EXISTS idx_wm_source ON working_memory_events(source);
      CREATE INDEX IF NOT EXISTS idx_wm_synthesis_task ON working_memory_events(synthesis_task_id);
    `);
  }

  /**
   * Generate SHA-256 hash of content for deduplication
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Check if content is duplicate within the deduplication window
   */
  private isDuplicate(contentHash: string): boolean {
    const windowStart = new Date(Date.now() - this.config.dedupeWindowHours * 3600 * 1000).toISOString();

    const existing = this.db
      .prepare(
        `SELECT id FROM working_memory_events
         WHERE content_hash = ? AND timestamp >= ?
         LIMIT 1`
      )
      .get(contentHash, windowStart);

    return !!existing;
  }

  /**
   * Add a new event to working memory
   *
   * @param event - Event data (without id and contentHash)
   * @returns ID of the created event, or null if duplicate
   * @throws Error if buffer is full and old events cannot be pruned
   */
  public async addEvent(
    event: Omit<WorkingMemoryEvent, 'id' | 'contentHash'>
  ): Promise<string | null> {
    const contentHash = this.hashContent(event.content);

    // Check for duplicates
    if (this.isDuplicate(contentHash)) {
      console.log(
        `[WorkingMemory] Duplicate event detected (hash: ${contentHash.slice(0, 8)}...), skipping`
      );
      return null;
    }

    // Check buffer size and prune if necessary
    const count = this.getEventCount();
    if (count >= this.config.maxBufferSize) {
      console.log(
        `[WorkingMemory] Buffer full (${count}/${this.config.maxBufferSize}), pruning old events`
      );
      const pruned = await this.prune(this.config.pruneAfterHours);
      console.log(`[WorkingMemory] Pruned ${pruned} old events`);

      // If still full, throw error
      const newCount = this.getEventCount();
      if (newCount >= this.config.maxBufferSize) {
        throw new Error(
          `Working memory buffer full (${newCount}/${this.config.maxBufferSize}) and cannot prune more events`
        );
      }
    }

    // Insert event
    const id = randomUUID();
    const timestamp = event.timestamp || new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO working_memory_events (
          id, source, timestamp, content, content_hash,
          embedding_json, initial_classification_json,
          processed_by_synthesis, synthesis_task_id, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`
      )
      .run(
        id,
        event.source,
        timestamp,
        event.content,
        contentHash,
        event.embedding ? JSON.stringify(event.embedding) : null,
        event.initialClassification ? JSON.stringify(event.initialClassification) : null,
        event.metadata ? JSON.stringify(event.metadata) : null
      );

    console.log(`[WorkingMemory] Added event ${id} from source: ${event.source}`);

    // Trigger entity extraction in background if enabled
    if (this.config.enableEntityExtraction) {
      this.extractEntitiesForEvent(id, event.content).catch((err) => {
        console.error(`[WorkingMemory] Entity extraction failed for event ${id}:`, err);
      });
    }

    return id;
  }

  /**
   * Extract entities from event content (internal helper)
   * Runs asynchronously to not block event ingestion
   */
  private async extractEntitiesForEvent(eventId: string, content: string): Promise<void> {
    try {
      const result = await extractEntities(content, eventId);
      console.log(
        `[WorkingMemory] Extracted ${result.entities.length} entities for event ${eventId}`
      );
    } catch (error) {
      // Log but don't throw - entity extraction is non-critical
      console.warn(`[WorkingMemory] Entity extraction warning for ${eventId}:`, error);
    }
  }

  /**
   * Get unprocessed events (not yet synthesized)
   *
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of unprocessed events, ordered by timestamp (oldest first)
   */
  public async getUnprocessed(limit = 100): Promise<WorkingMemoryEvent[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM working_memory_events
         WHERE processed_by_synthesis = 0
         ORDER BY timestamp ASC
         LIMIT ?`
      )
      .all(limit) as any[];

    return rows.map(this.rowToEvent);
  }

  /**
   * Get events from the last N hours
   *
   * @param hours - Number of hours to look back
   * @returns Array of events within the time window, ordered by timestamp (newest first)
   */
  public async getRecent(hours: number): Promise<WorkingMemoryEvent[]> {
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const rows = this.db
      .prepare(
        `SELECT * FROM working_memory_events
         WHERE timestamp >= ?
         ORDER BY timestamp DESC`
      )
      .all(cutoff) as any[];

    return rows.map(this.rowToEvent);
  }

  /**
   * Mark events as processed by a synthesis task
   *
   * @param eventIds - Array of event IDs to mark as processed
   * @param synthesisTaskId - ID of the synthesis task that processed these events
   */
  public async markProcessed(eventIds: string[], synthesisTaskId: string): Promise<void> {
    if (eventIds.length === 0) return;

    const stmt = this.db.prepare(
      `UPDATE working_memory_events
       SET processed_by_synthesis = 1, synthesis_task_id = ?
       WHERE id = ?`
    );

    const transaction = this.db.transaction((ids: string[], taskId: string) => {
      for (const id of ids) {
        stmt.run(taskId, id);
      }
    });

    transaction(eventIds, synthesisTaskId);
    console.log(`[WorkingMemory] Marked ${eventIds.length} events as processed by task ${synthesisTaskId}`);
  }

  /**
   * Get specific events by their IDs
   *
   * @param ids - Array of event IDs to retrieve
   * @returns Array of events (may be fewer than requested if some IDs don't exist)
   */
  public async getByIds(ids: string[]): Promise<WorkingMemoryEvent[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM working_memory_events WHERE id IN (${placeholders})`)
      .all(...ids) as any[];

    return rows.map(this.rowToEvent);
  }

  /**
   * Prune old processed events
   *
   * @param olderThanHours - Remove events older than this many hours (default: from config)
   * @returns Number of events removed
   */
  public async prune(olderThanHours?: number): Promise<number> {
    const hours = olderThanHours ?? this.config.pruneAfterHours;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const result = this.db
      .prepare(
        `DELETE FROM working_memory_events
         WHERE processed_by_synthesis = 1 AND timestamp < ?`
      )
      .run(cutoff);

    const deleted = result.changes;
    if (deleted > 0) {
      console.log(`[WorkingMemory] Pruned ${deleted} events older than ${hours} hours`);
    }

    return deleted;
  }

  /**
   * Get statistics about the working memory buffer
   */
  public async getStats(): Promise<WorkingMemoryStats> {
    // Total events
    const totalRow = this.db.prepare('SELECT COUNT(*) as count FROM working_memory_events').get() as any;
    const totalEvents = totalRow.count;

    // Unprocessed events
    const unprocessedRow = this.db
      .prepare('SELECT COUNT(*) as count FROM working_memory_events WHERE processed_by_synthesis = 0')
      .get() as any;
    const unprocessedEvents = unprocessedRow.count;

    // Processed in last 24 hours
    const last24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const processedLast24hRow = this.db
      .prepare(
        'SELECT COUNT(*) as count FROM working_memory_events WHERE processed_by_synthesis = 1 AND timestamp >= ?'
      )
      .get(last24h) as any;
    const processedLast24h = processedLast24hRow.count;

    // Oldest and newest timestamps
    const timestampsRow = this.db
      .prepare('SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM working_memory_events')
      .get() as any;

    // Events by source
    const sourceRows = this.db
      .prepare('SELECT source, COUNT(*) as count FROM working_memory_events GROUP BY source')
      .all() as any[];

    const eventsBySource: Record<string, number> = {};
    for (const row of sourceRows) {
      eventsBySource[row.source] = row.count;
    }

    return {
      totalEvents,
      unprocessedEvents,
      processedLast24h,
      oldestEventTimestamp: timestampsRow.oldest || null,
      newestEventTimestamp: timestampsRow.newest || null,
      eventsBySource: eventsBySource as any,
    };
  }

  /**
   * Get total event count
   */
  private getEventCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM working_memory_events').get() as any;
    return row.count;
  }

  /**
   * Convert database row to WorkingMemoryEvent
   */
  private rowToEvent(row: any): WorkingMemoryEvent {
    return {
      id: row.id,
      source: row.source,
      timestamp: row.timestamp,
      content: row.content,
      contentHash: row.content_hash,
      embedding: row.embedding_json ? JSON.parse(row.embedding_json) : undefined,
      initialClassification: row.initial_classification_json
        ? JSON.parse(row.initial_classification_json)
        : undefined,
      processedBySynthesis: row.processed_by_synthesis === 1,
      synthesisTaskId: row.synthesis_task_id || undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  /**
   * Search events with natural language temporal queries
   *
   * Supports queries like:
   * - "what did I discuss last week"
   * - "meetings from yesterday"
   * - "tasks mentioned 3 days ago"
   *
   * @param query - Natural language query (may include temporal expressions)
   * @param options - Optional temporal search options
   * @returns Array of matching events with temporal relevance scoring
   */
  public async searchTemporal(
    query: string,
    options?: TemporalSearchOptions
  ): Promise<WorkingMemoryEvent[]> {
    const preprocessor = this.getTemporalPreprocessor();
    return preprocessor.search(query, options);
  }

  /**
   * Extract temporal context from a query without searching
   *
   * @param query - Natural language query
   * @returns Cleaned query (temporal parts removed) and temporal specification
   */
  public extractTemporalFromQuery(query: string): {
    cleanedQuery: string;
    temporal: ParsedTemporalExpression | null;
  } {
    const preprocessor = this.getTemporalPreprocessor();
    const { cleanedQuery, temporal } = preprocessor.extractTemporalContext(query);

    // Also parse the expression for more detail
    const parsed = temporal ? preprocessor.parseExpression(query) : null;

    return { cleanedQuery, temporal: parsed };
  }

  /**
   * Find all overdue items in working memory
   *
   * @param referenceDate - Optional reference date (default: now)
   * @returns Array of events with past deadlines
   */
  public async findOverdue(referenceDate?: Date): Promise<WorkingMemoryEvent[]> {
    const preprocessor = this.getTemporalPreprocessor();
    return preprocessor.findOverdue(referenceDate);
  }

  /**
   * Clear all events (useful for testing)
   */
  public async clearAll(): Promise<void> {
    this.db.prepare('DELETE FROM working_memory_events').run();
    console.log('[WorkingMemory] Cleared all events');
  }
}

/**
 * Get a singleton instance of WorkingMemory
 */
let instance: WorkingMemory | null = null;

export function getWorkingMemory(config?: Partial<WorkingMemoryConfig>): WorkingMemory {
  if (!instance) {
    instance = new WorkingMemory(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetWorkingMemory(): void {
  instance = null;
}
