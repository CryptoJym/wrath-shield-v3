/**
 * Decision Queue System
 *
 * Manages items that require human decision when LLM cannot determine action.
 * Follows the NEEDS_DECISION escalation level from the Life Charter.
 *
 * Features:
 * - SQLite-backed persistence
 * - Context accumulation for related decisions
 * - Batched presentation in daily digest
 * - Resolution tracking with learning feedback
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { randomUUID } from 'crypto';
import { Database as SqliteDatabase } from 'better-sqlite3';
import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import type { Domain } from '../life-os-config';

ensureServerOnly('lib/cortex/decision-queue');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Reason why a decision is needed
 */
export type DecisionReason =
  | 'ambiguous_intent'
  | 'conflicting_priorities'
  | 'missing_context'
  | 'multiple_options'
  | 'unclear_expectations'
  | 'no_precedent'
  | 'irreversible_action'
  | 'low_confidence'
  | 'other';

/**
 * Status of a pending decision
 */
export type DecisionStatus =
  | 'pending'
  | 'presented'
  | 'resolved'
  | 'expired'
  | 'auto_resolved';

/**
 * A decision option presented to the user
 */
export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  action: string; // Action to take if selected
  payload?: Record<string, unknown>;
  confidence: number; // LLM's confidence in this option (0-1)
  recommended?: boolean;
}

/**
 * A pending decision requiring human input
 */
export interface PendingDecision {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: DecisionStatus;

  // Classification
  domain: Domain['id'];
  reason: DecisionReason;
  priority: 'critical' | 'high' | 'medium' | 'low';

  // Content
  title: string;
  summary: string;
  context: string;
  sourceEventIds: string[];

  // Options
  options: DecisionOption[];
  llmAnalysis?: string; // LLM's analysis of the situation

  // Resolution
  resolvedAt?: string;
  resolvedBy?: 'user' | 'auto' | 'timeout';
  selectedOptionId?: string;
  userFeedback?: string;

  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new pending decision
 */
export interface CreateDecisionInput {
  domain: Domain['id'];
  reason: DecisionReason;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  context: string;
  sourceEventIds?: string[];
  options: Omit<DecisionOption, 'id'>[];
  llmAnalysis?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Decision resolution input
 */
export interface ResolveDecisionInput {
  decisionId: string;
  selectedOptionId: string;
  userFeedback?: string;
}

// ============================================================================
// Decision Queue Implementation
// ============================================================================

/**
 * Decision Queue - Manages pending decisions requiring human input
 */
export class DecisionQueue {
  private db: SqliteDatabase;

  constructor() {
    this.db = getDatabase().getRawDb();
    this.ensureTable();
  }

  /**
   * Create the pending_decisions table if it doesn't exist
   */
  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_decisions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        domain TEXT NOT NULL,
        reason TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        context TEXT NOT NULL,
        source_event_ids_json TEXT,
        options_json TEXT NOT NULL,
        llm_analysis TEXT,
        resolved_at TEXT,
        resolved_by TEXT,
        selected_option_id TEXT,
        user_feedback TEXT,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_pd_status ON pending_decisions(status);
      CREATE INDEX IF NOT EXISTS idx_pd_domain ON pending_decisions(domain);
      CREATE INDEX IF NOT EXISTS idx_pd_priority ON pending_decisions(priority);
      CREATE INDEX IF NOT EXISTS idx_pd_created ON pending_decisions(created_at DESC);
    `);
  }

  /**
   * Add a new pending decision to the queue
   */
  async addDecision(input: CreateDecisionInput): Promise<string> {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Generate IDs for options
    const options: DecisionOption[] = input.options.map((opt) => ({
      ...opt,
      id: randomUUID(),
    }));

    this.db
      .prepare(
        `INSERT INTO pending_decisions (
          id, created_at, updated_at, status, domain, reason, priority,
          title, summary, context, source_event_ids_json, options_json,
          llm_analysis, metadata_json
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        now,
        now,
        input.domain,
        input.reason,
        input.priority || 'medium',
        input.title,
        input.summary,
        input.context,
        input.sourceEventIds ? JSON.stringify(input.sourceEventIds) : null,
        JSON.stringify(options),
        input.llmAnalysis || null,
        input.metadata ? JSON.stringify(input.metadata) : null
      );

    console.log(`[DecisionQueue] Added pending decision ${id}: ${input.title}`);
    return id;
  }

  /**
   * Get all pending decisions (optionally filtered by status/domain)
   */
  async getPendingDecisions(filters?: {
    status?: DecisionStatus;
    domain?: Domain['id'];
    priority?: 'critical' | 'high' | 'medium' | 'low';
    limit?: number;
  }): Promise<PendingDecision[]> {
    let query = 'SELECT * FROM pending_decisions WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.domain) {
      query += ' AND domain = ?';
      params.push(filters.domain);
    }

    if (filters?.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }

    query += ' ORDER BY CASE priority WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.rowToDecision);
  }

  /**
   * Get a single decision by ID
   */
  async getDecision(id: string): Promise<PendingDecision | null> {
    const row = this.db
      .prepare('SELECT * FROM pending_decisions WHERE id = ?')
      .get(id) as any;

    return row ? this.rowToDecision(row) : null;
  }

  /**
   * Resolve a pending decision
   */
  async resolveDecision(input: ResolveDecisionInput): Promise<void> {
    const now = new Date().toISOString();

    const result = this.db
      .prepare(
        `UPDATE pending_decisions
         SET status = 'resolved',
             updated_at = ?,
             resolved_at = ?,
             resolved_by = 'user',
             selected_option_id = ?,
             user_feedback = ?
         WHERE id = ? AND status IN ('pending', 'presented')`
      )
      .run(
        now,
        now,
        input.selectedOptionId,
        input.userFeedback || null,
        input.decisionId
      );

    if (result.changes === 0) {
      throw new Error(`Decision ${input.decisionId} not found or already resolved`);
    }

    console.log(`[DecisionQueue] Resolved decision ${input.decisionId}`);

    // Trigger learning from decision (feed back to preference model)
    await this.learnFromResolution(input.decisionId);
  }

  /**
   * Mark decisions as presented (shown to user)
   */
  async markAsPresented(decisionIds: string[]): Promise<void> {
    if (decisionIds.length === 0) return;

    const now = new Date().toISOString();
    const placeholders = decisionIds.map(() => '?').join(',');

    this.db
      .prepare(
        `UPDATE pending_decisions
         SET status = 'presented', updated_at = ?
         WHERE id IN (${placeholders}) AND status = 'pending'`
      )
      .run(now, ...decisionIds);

    console.log(`[DecisionQueue] Marked ${decisionIds.length} decisions as presented`);
  }

  /**
   * Auto-resolve stale decisions (older than 7 days)
   */
  async autoResolveStale(maxAgeDays: number = 7): Promise<number> {
    const cutoff = new Date(
      Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const now = new Date().toISOString();

    const result = this.db
      .prepare(
        `UPDATE pending_decisions
         SET status = 'expired',
             updated_at = ?,
             resolved_at = ?,
             resolved_by = 'timeout'
         WHERE status IN ('pending', 'presented') AND created_at < ?`
      )
      .run(now, now, cutoff);

    if (result.changes > 0) {
      console.log(`[DecisionQueue] Auto-expired ${result.changes} stale decisions`);
    }

    return result.changes;
  }

  /**
   * Get decision statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    presented: number;
    resolved: number;
    expired: number;
    byDomain: Record<string, number>;
    byPriority: Record<string, number>;
    avgResolutionTimeMs: number | null;
  }> {
    // Total counts by status
    const statusCounts = this.db
      .prepare(
        `SELECT status, COUNT(*) as count FROM pending_decisions GROUP BY status`
      )
      .all() as any[];

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = row.count;
    }

    // Counts by domain
    const domainCounts = this.db
      .prepare(
        `SELECT domain, COUNT(*) as count FROM pending_decisions WHERE status = 'pending' GROUP BY domain`
      )
      .all() as any[];

    const byDomain: Record<string, number> = {};
    for (const row of domainCounts) {
      byDomain[row.domain] = row.count;
    }

    // Counts by priority
    const priorityCounts = this.db
      .prepare(
        `SELECT priority, COUNT(*) as count FROM pending_decisions WHERE status = 'pending' GROUP BY priority`
      )
      .all() as any[];

    const byPriority: Record<string, number> = {};
    for (const row of priorityCounts) {
      byPriority[row.priority] = row.count;
    }

    // Average resolution time
    const avgTime = this.db
      .prepare(
        `SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 86400000) as avg_ms
         FROM pending_decisions
         WHERE status = 'resolved' AND resolved_at IS NOT NULL`
      )
      .get() as any;

    return {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      pending: counts['pending'] || 0,
      presented: counts['presented'] || 0,
      resolved: counts['resolved'] || 0,
      expired: counts['expired'] || 0,
      byDomain,
      byPriority,
      avgResolutionTimeMs: avgTime?.avg_ms || null,
    };
  }

  /**
   * Get decisions for daily digest presentation
   */
  async getForDailyDigest(): Promise<PendingDecision[]> {
    // Get pending/presented decisions, prioritized
    return this.getPendingDecisions({
      status: 'pending',
      limit: 20, // Respect cognitive load limit
    });
  }

  /**
   * Get resolved decisions for visualization
   */
  async getResolvedDecisions(limit: number = 20): Promise<PendingDecision[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM pending_decisions
         WHERE status IN ('resolved', 'expired', 'auto_resolved')
         ORDER BY resolved_at DESC
         LIMIT ?`
      )
      .all(limit) as any[];

    return rows.map(this.rowToDecision);
  }

  /**
   * Learn from a resolved decision to improve future handling
   */
  private async learnFromResolution(decisionId: string): Promise<void> {
    const decision = await this.getDecision(decisionId);
    if (!decision || decision.status !== 'resolved') return;

    const selectedOption = decision.options.find(
      (o) => o.id === decision.selectedOptionId
    );

    if (!selectedOption) return;

    // If LLM's recommended option was NOT selected, record as correction
    const recommendedOption = decision.options.find((o) => o.recommended);

    if (recommendedOption && recommendedOption.id !== selectedOption.id) {
      console.log(
        `[DecisionQueue] Learning: User chose "${selectedOption.label}" over recommended "${recommendedOption.label}"`
      );

      // Record as correction in preference model for learning
      try {
        const { recordCorrection } = await import('../ea/preference-model');

        // Map decision to correction format
        const originalAction = recommendedOption.action || 'unknown';
        const correctedAction = selectedOption.action || 'unknown';

        // Infer urgency from priority
        const urgencyMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
          critical: 'critical',
          high: 'high',
          medium: 'medium',
          low: 'low',
        };

        await recordCorrection(
          decisionId,
          {
            urgency: urgencyMap[decision.priority] || 'medium',
            domain: decision.domain as any,
            action: originalAction,
          },
          {
            urgency: urgencyMap[decision.priority] || 'medium',
            domain: decision.domain as any,
            action: correctedAction,
          },
          decision.userFeedback || `User selected "${selectedOption.label}" instead of recommended "${recommendedOption.label}"`,
          {
            type: 'notification',
            summary: decision.title,
            content: decision.summary,
          }
        );

        console.log(`[DecisionQueue] Recorded correction for decision ${decisionId}`);
      } catch (error) {
        console.error('[DecisionQueue] Failed to record correction:', error);
      }
    }
  }

  /**
   * Convert database row to PendingDecision object
   */
  private rowToDecision(row: any): PendingDecision {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      domain: row.domain,
      reason: row.reason,
      priority: row.priority,
      title: row.title,
      summary: row.summary,
      context: row.context,
      sourceEventIds: row.source_event_ids_json
        ? JSON.parse(row.source_event_ids_json)
        : [],
      options: row.options_json ? JSON.parse(row.options_json) : [],
      llmAnalysis: row.llm_analysis || undefined,
      resolvedAt: row.resolved_at || undefined,
      resolvedBy: row.resolved_by || undefined,
      selectedOptionId: row.selected_option_id || undefined,
      userFeedback: row.user_feedback || undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: DecisionQueue | null = null;

export function getDecisionQueue(): DecisionQueue {
  if (!instance) {
    instance = new DecisionQueue();
  }
  return instance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetDecisionQueue(): void {
  instance = null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a decision from synthesis when confidence is too low
 */
export async function escalateToDecision(
  eventIds: string[],
  domain: Domain['id'],
  analysis: {
    title: string;
    summary: string;
    context: string;
    options: Omit<DecisionOption, 'id'>[];
    reason: DecisionReason;
    llmAnalysis?: string;
  }
): Promise<string> {
  const queue = getDecisionQueue();

  return queue.addDecision({
    domain,
    reason: analysis.reason,
    priority: 'medium',
    title: analysis.title,
    summary: analysis.summary,
    context: analysis.context,
    sourceEventIds: eventIds,
    options: analysis.options,
    llmAnalysis: analysis.llmAnalysis,
  });
}
