/**
 * PM Task Queue / Triage System
 *
 * Central nervous system for incoming signals from all agents.
 * Routes them to appropriate destinations:
 * - GitHub issues (for trackable work)
 * - Local tasks (for quick items)
 * - Deferred (for later review)
 * - Escalated (requires human decision)
 *
 * Determines escalation level:
 * - AUTO: System acts immediately
 * - PROPOSE: Queued for review, system suggests action
 * - CRITICAL: Immediate notification required
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { addPMMemory } from './pm-memory';
import crypto from 'crypto';

ensureServerOnly('lib/pm/task-queue');

// ============================================================================
// Types
// ============================================================================

export type SignalSource = 'comms' | 'inbox' | 'legal' | 'finance' | 'eeg' | 'github' | 'calendar';
export type SignalType = 'task' | 'deadline' | 'follow_up' | 'energy_window' | 'commit' | 'mention';
export type QueueAction = 'github_issue' | 'local_task' | 'defer' | 'ignore' | 'escalate';
export type EscalationLevel = 'auto' | 'propose' | 'critical';
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'deferred';

export interface IncomingSignal {
  id: string;
  source: SignalSource;
  signal_type: SignalType;
  payload: Record<string, unknown>;
  timestamp: number;
  confidence: number; // 0-1, how sure are we this is actionable
}

export interface TriageResult {
  action: QueueAction;
  rationale: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  assigned_project?: string;
  escalation_level: EscalationLevel;
  suggested_title?: string;
  suggested_labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface QueuedItem {
  id: string;
  signal: IncomingSignal;
  triage: TriageResult;
  status: QueueItemStatus;
  created_at: number;
  processed_at?: number;
  error?: string;
  retry_count: number;
  metadata?: Record<string, unknown>;
}

export interface QueueStatus {
  total_items: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deferred: number;
  avg_processing_time_ms: number;
  oldest_pending?: QueuedItem;
}

interface ProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  deferred: number;
}

// ============================================================================
// Database Schema
// ============================================================================

function ensureQueueTable(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_queue (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      signal_source TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      signal_payload TEXT NOT NULL,
      signal_timestamp INTEGER NOT NULL,
      signal_confidence REAL NOT NULL,

      triage_action TEXT NOT NULL,
      triage_rationale TEXT,
      triage_priority TEXT NOT NULL,
      triage_escalation_level TEXT NOT NULL,
      triage_due_date TEXT,
      triage_assigned_project TEXT,
      triage_suggested_title TEXT,
      triage_suggested_labels TEXT,
      triage_metadata TEXT,

      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      processed_at INTEGER,
      error TEXT,
      retry_count INTEGER DEFAULT 0,
      metadata TEXT,

      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'deferred'))
    );

    CREATE INDEX IF NOT EXISTS idx_pm_queue_status ON pm_queue(status);
    CREATE INDEX IF NOT EXISTS idx_pm_queue_created_at ON pm_queue(created_at);
    CREATE INDEX IF NOT EXISTS idx_pm_queue_source ON pm_queue(signal_source);
    CREATE INDEX IF NOT EXISTS idx_pm_queue_escalation ON pm_queue(triage_escalation_level);
  `);
}

// ============================================================================
// Triage Logic
// ============================================================================

interface TriageRule {
  id: string;
  description: string;
  condition: (signal: IncomingSignal) => boolean;
  action: QueueAction;
  escalation: EscalationLevel | ((signal: IncomingSignal) => EscalationLevel);
  priority: 'critical' | 'high' | 'medium' | 'low' | ((signal: IncomingSignal) => 'critical' | 'high' | 'medium' | 'low');
  generateTitle?: (signal: IncomingSignal) => string;
  generateLabels?: (signal: IncomingSignal) => string[];
  assignProject?: (signal: IncomingSignal) => string | undefined;
}

const TRIAGE_RULES: TriageRule[] = [
  // === CRITICAL ESCALATIONS ===
  {
    id: 'legal-deadlines',
    description: 'Legal deadlines are always critical and go to local tasks',
    condition: (s) => s.source === 'legal' && s.signal_type === 'deadline',
    action: 'local_task',
    escalation: 'critical',
    priority: 'critical',
    generateTitle: (s) => `[LEGAL DEADLINE] ${s.payload.deadline_type || 'Deadline'}: ${s.payload.case_name || 'Unknown'}`,
    generateLabels: (s) => ['legal', 'deadline', 'critical'],
  },

  {
    id: 'high-confidence-deadline',
    description: 'High-confidence deadlines from any source',
    condition: (s) => s.signal_type === 'deadline' && s.confidence > 0.9,
    action: 'local_task',
    escalation: 'critical',
    priority: 'critical',
    generateTitle: (s) => `[DEADLINE] ${s.payload.description || 'Important deadline'}`,
    generateLabels: (s) => [s.source, 'deadline'],
  },

  // === GITHUB SIGNALS ===
  {
    id: 'github-issue-opened',
    description: 'New GitHub issues should sync to local',
    condition: (s) => s.source === 'github' && s.signal_type === 'task' && s.payload.action === 'opened',
    action: 'local_task', // We already have the GitHub issue, just track it locally
    escalation: 'auto',
    priority: 'medium',
    generateTitle: (s) => {
      const issue = s.payload.issue as any;
      return `Sync: ${issue?.title || 'GitHub Issue'}`;
    },
    generateLabels: (s) => ['github-sync', 'auto'],
  },

  {
    id: 'github-commit-closes',
    description: 'Commits that close issues',
    condition: (s) => s.source === 'github' && s.signal_type === 'commit' && s.payload.action === 'closes_issue',
    action: 'local_task', // Update local tracking
    escalation: 'auto',
    priority: 'low',
    generateTitle: (s) => `Auto-close: Issue #${s.payload.issue_number}`,
    generateLabels: (s) => ['github', 'auto-close'],
  },

  {
    id: 'github-mention',
    description: 'High-confidence GitHub mentions create tasks',
    condition: (s) => s.source === 'github' && s.signal_type === 'mention' && s.confidence > 0.8,
    action: 'github_issue',
    escalation: 'propose',
    priority: 'high',
    generateTitle: (s) => `Action from mention: ${s.payload.context || 'GitHub mention'}`,
    generateLabels: (s) => ['from-mention', 'needs-review'],
  },

  // === COMMS SIGNALS ===
  {
    id: 'comms-follow-up-high',
    description: 'High-importance comms follow-ups',
    condition: (s) => s.source === 'comms' && s.signal_type === 'follow_up' && s.payload.importance === 'high',
    action: 'local_task',
    escalation: 'propose',
    priority: 'high',
    generateTitle: (s) => `Follow up: ${s.payload.contact_name || 'Contact'} - ${s.payload.reason || 'No reason'}`,
    generateLabels: (s) => ['comms', 'follow-up', 'high-importance'],
    assignProject: (s) => s.payload.project_name as string | undefined,
  },

  {
    id: 'comms-follow-up-normal',
    description: 'Normal comms follow-ups',
    condition: (s) => s.source === 'comms' && s.signal_type === 'follow_up',
    action: 'local_task',
    escalation: 'auto',
    priority: 'medium',
    generateTitle: (s) => `Follow up: ${s.payload.contact_name || 'Contact'}`,
    generateLabels: (s) => ['comms', 'follow-up'],
  },

  {
    id: 'comms-task',
    description: 'Tasks from comms (lifelog action items)',
    condition: (s) => s.source === 'comms' && s.signal_type === 'task',
    action: 'local_task',
    escalation: (s) => s.confidence > 0.8 ? 'auto' : 'propose',
    priority: 'medium',
    generateTitle: (s) => s.payload.title as string || 'Comms task',
    generateLabels: (s) => ['comms', 'action-item'],
  },

  // === INBOX SIGNALS ===
  {
    id: 'inbox-email-task',
    description: 'Tasks extracted from emails',
    condition: (s) => s.source === 'inbox' && s.signal_type === 'task',
    action: 'local_task',
    escalation: (s) => s.confidence > 0.7 ? 'auto' : 'propose',
    priority: (s) => {
      if (s.payload.urgent) return 'high';
      if (s.payload.deadline) return 'high';
      return 'medium';
    },
    generateTitle: (s) => s.payload.action_item as string || `Email task: ${s.payload.subject}`,
    generateLabels: (s) => ['inbox', 'email', s.payload.from as string || 'unknown'].filter(Boolean),
  },

  {
    id: 'inbox-meeting-action',
    description: 'Action items from meetings',
    condition: (s) => s.source === 'inbox' && s.signal_type === 'task' && !!s.payload.meeting_id,
    action: 'local_task',
    escalation: 'propose',
    priority: 'high',
    generateTitle: (s) => `Meeting action: ${s.payload.action_item || 'Action item'}`,
    generateLabels: (s) => ['inbox', 'meeting', 'action-item'],
  },

  // === FINANCE SIGNALS ===
  {
    id: 'finance-expense',
    description: 'Expense follow-ups from finance agent',
    condition: (s) => s.source === 'finance' && s.confidence > 0.7,
    action: 'local_task',
    escalation: 'propose',
    priority: 'medium',
    generateTitle: (s) => `Finance: ${s.payload.description || 'Expense item'}`,
    generateLabels: (s) => ['finance', 'expense'],
  },

  // === EEG SIGNALS ===
  {
    id: 'eeg-energy-window',
    description: 'Energy window notifications',
    condition: (s) => s.source === 'eeg' && s.signal_type === 'energy_window',
    action: 'defer', // Just record it, don't create task
    escalation: 'auto',
    priority: 'low',
  },

  // === LOW CONFIDENCE - DEFER ===
  {
    id: 'low-confidence',
    description: 'Low-confidence signals deferred for review',
    condition: (s) => s.confidence < 0.5,
    action: 'defer',
    escalation: 'propose',
    priority: 'low',
    generateTitle: (s) => `[Low confidence] ${s.source} - ${s.signal_type}`,
    generateLabels: (s) => ['low-confidence', s.source, s.signal_type],
  },

  // === DEFAULT FALLBACK ===
  {
    id: 'default',
    description: 'Default: create local task with propose escalation',
    condition: () => true,
    action: 'local_task',
    escalation: 'propose',
    priority: 'medium',
    generateTitle: (s) => `${s.source} - ${s.signal_type}: ${JSON.stringify(s.payload).slice(0, 50)}`,
    generateLabels: (s) => [s.source, s.signal_type],
  },
];

/**
 * Triage using static rules (fallback)
 */
function triageWithRules(signal: IncomingSignal): TriageResult {
  // Find first matching rule
  const rule = TRIAGE_RULES.find(r => r.condition(signal));

  if (!rule) {
    // Should never happen due to default rule, but type safety
    return {
      action: 'defer',
      rationale: 'No matching triage rule found',
      priority: 'low',
      escalation_level: 'propose',
    };
  }

  const escalation = typeof rule.escalation === 'function'
    ? rule.escalation(signal)
    : rule.escalation;

  const priority = typeof rule.priority === 'function'
    ? rule.priority(signal)
    : rule.priority;

  const result: TriageResult = {
    action: rule.action,
    rationale: rule.description,
    priority,
    escalation_level: escalation,
    suggested_title: rule.generateTitle?.(signal),
    suggested_labels: rule.generateLabels?.(signal),
    assigned_project: rule.assignProject?.(signal),
    metadata: {
      rule_id: rule.id,
      rule_description: rule.description,
      ai_powered: false,
    },
  };

  // Calculate due date for deadlines
  if (signal.signal_type === 'deadline' && signal.payload.deadline_date) {
    result.due_date = signal.payload.deadline_date as string;
  } else if (signal.payload.due_days) {
    const days = signal.payload.due_days as number;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    result.due_date = dueDate.toISOString().split('T')[0];
  }

  return result;
}

/**
 * Triage an incoming signal to determine routing and escalation
 *
 * ENHANCED (Phase 5): Now uses AI-powered triage with Zep memory context
 * Falls back to static rules if AI fails or confidence is too low
 *
 * ENHANCED (Phase 5.1): Full observability tracking for AI/rules decisions
 */
export async function triageSignal(signal: IncomingSignal): Promise<TriageResult> {
  // Check if AI triage is enabled
  const useAI = process.env.USE_AI_TRIAGE !== 'false';
  const confidenceThreshold = parseFloat(process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD || '0.6');

  // Import observability module for tracking
  let recordTriageDecision: typeof import('./ai-observability').recordTriageDecision | null = null;
  try {
    const observability = await import('./ai-observability');
    recordTriageDecision = observability.recordTriageDecision;
  } catch (error) {
    console.warn('[Task Queue] Observability module not available:', error);
  }

  let aiResult: import('./ai-triage').AITriageResult | null = null;
  let ruleResult: TriageResult | null = null;
  let finalResult: TriageResult;
  let decisionSource: 'ai' | 'rules' | 'merged' = 'rules';

  if (useAI) {
    try {
      // Dynamic import to avoid circular dependencies
      const { triageSignalWithAI } = await import('./ai-triage');

      aiResult = await triageSignalWithAI(signal);

      if (aiResult && aiResult.confidence >= confidenceThreshold) {
        console.log(
          `[Task Queue] AI Triaged signal ${signal.id}: ` +
          `${aiResult.action} (${aiResult.escalation_level}) ` +
          `confidence=${aiResult.confidence.toFixed(2)}`
        );
        finalResult = aiResult;
        decisionSource = 'ai';

        // Record to observability
        if (recordTriageDecision) {
          await recordTriageDecision({
            signal,
            aiResult,
            ruleResult: null,
            finalResult,
            decisionSource,
          }).catch(err => console.warn('[Task Queue] Failed to record decision:', err));
        }

        return finalResult;
      }

      // AI result exists but confidence too low - compare with rules
      if (aiResult) {
        ruleResult = triageWithRules(signal);

        // If AI and rules agree, use AI's richer rationale
        if (aiResult.action === ruleResult.action &&
            aiResult.escalation_level === ruleResult.escalation_level) {
          console.log(
            `[Task Queue] AI+Rules agree for ${signal.id}: ${aiResult.action}`
          );
          finalResult = {
            ...aiResult,
            metadata: {
              ...aiResult.metadata,
              rule_confirmed: true,
            },
          };
          decisionSource = 'merged';

          // Record to observability
          if (recordTriageDecision) {
            await recordTriageDecision({
              signal,
              aiResult,
              ruleResult,
              finalResult,
              decisionSource,
            }).catch(err => console.warn('[Task Queue] Failed to record decision:', err));
          }

          return finalResult;
        }

        // If they disagree, escalate for review
        console.log(
          `[Task Queue] AI/Rules disagree for ${signal.id}: ` +
          `AI=${aiResult.action}/${aiResult.escalation_level}, ` +
          `Rules=${ruleResult.action}/${ruleResult.escalation_level}`
        );

        finalResult = {
          action: 'defer',
          rationale: `AI (${aiResult.action}) and rules (${ruleResult.action}) disagree. Needs review.`,
          priority: 'medium',
          escalation_level: 'propose',
          suggested_title: aiResult.suggested_title || ruleResult.suggested_title,
          suggested_labels: aiResult.suggested_labels || ruleResult.suggested_labels,
          metadata: {
            ai_result: {
              action: aiResult.action,
              escalation: aiResult.escalation_level,
              confidence: aiResult.confidence,
              rationale: aiResult.ai_rationale,
            },
            rule_result: {
              action: ruleResult.action,
              escalation: ruleResult.escalation_level,
              rule_id: ruleResult.metadata?.rule_id,
            },
            needs_review: true,
          },
        };
        decisionSource = 'merged';

        // Record disagreement to observability
        if (recordTriageDecision) {
          await recordTriageDecision({
            signal,
            aiResult,
            ruleResult,
            finalResult,
            decisionSource,
          }).catch(err => console.warn('[Task Queue] Failed to record decision:', err));
        }

        return finalResult;
      }
    } catch (error) {
      console.warn('[Task Queue] AI triage failed, falling back to rules:', error);
      // Fall through to rule-based triage
    }
  }

  // Fallback to rule-based triage
  ruleResult = triageWithRules(signal);
  finalResult = ruleResult;
  decisionSource = 'rules';

  console.log(
    `[Task Queue] Rule-based triaged signal ${signal.id}: ` +
    `${ruleResult.metadata?.rule_id} -> ${ruleResult.action} (${ruleResult.escalation_level})`
  );

  // Record to observability
  if (recordTriageDecision) {
    await recordTriageDecision({
      signal,
      aiResult,
      ruleResult,
      finalResult,
      decisionSource,
    }).catch(err => console.warn('[Task Queue] Failed to record decision:', err));
  }

  return finalResult;
}

// ============================================================================
// Queue Operations
// ============================================================================

/**
 * Generate unique queue ID
 */
function generateQueueId(): string {
  return `queue_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Enqueue an incoming signal
 */
export async function enqueueSignal(signal: IncomingSignal): Promise<string> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const queueId = generateQueueId();
  const now = Math.floor(Date.now() / 1000);

  // Triage the signal
  const triage = await triageSignal(signal);

  // Insert into queue
  db.prepare(`
    INSERT INTO pm_queue (
      id, signal_id, signal_source, signal_type, signal_payload,
      signal_timestamp, signal_confidence,
      triage_action, triage_rationale, triage_priority,
      triage_escalation_level, triage_due_date, triage_assigned_project,
      triage_suggested_title, triage_suggested_labels, triage_metadata,
      status, created_at, retry_count
    ) VALUES (
      @id, @signal_id, @signal_source, @signal_type, @signal_payload,
      @signal_timestamp, @signal_confidence,
      @triage_action, @triage_rationale, @triage_priority,
      @triage_escalation_level, @triage_due_date, @triage_assigned_project,
      @triage_suggested_title, @triage_suggested_labels, @triage_metadata,
      'pending', @created_at, 0
    )
  `).run({
    id: queueId,
    signal_id: signal.id,
    signal_source: signal.source,
    signal_type: signal.signal_type,
    signal_payload: JSON.stringify(signal.payload),
    signal_timestamp: signal.timestamp,
    signal_confidence: signal.confidence,
    triage_action: triage.action,
    triage_rationale: triage.rationale,
    triage_priority: triage.priority,
    triage_escalation_level: triage.escalation_level,
    triage_due_date: triage.due_date || null,
    triage_assigned_project: triage.assigned_project || null,
    triage_suggested_title: triage.suggested_title || null,
    triage_suggested_labels: triage.suggested_labels ? JSON.stringify(triage.suggested_labels) : null,
    triage_metadata: triage.metadata ? JSON.stringify(triage.metadata) : null,
    created_at: now,
  });

  // Record to PM memory
  try {
    await addPMMemory(
      `Signal enqueued: ${signal.source}/${signal.signal_type} -> ${triage.action} (${triage.escalation_level})`,
      'decision',
      {
        signal_id: signal.id,
        queue_id: queueId,
        source: signal.source,
        signal_type: signal.signal_type,
        action: triage.action,
        escalation: triage.escalation_level,
        confidence: signal.confidence,
      }
    );
  } catch (memoryError) {
    console.warn('[Task Queue] Failed to record to memory:', memoryError);
    // Don't fail the enqueue if memory fails
  }

  console.log(`[Task Queue] Enqueued ${queueId}: ${signal.source}/${signal.signal_type} -> ${triage.action}`);

  return queueId;
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<QueueStatus> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();

  // Get counts by status
  const counts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM pm_queue
    GROUP BY status
  `).all() as Array<{ status: QueueItemStatus; count: number }>;

  const status: QueueStatus = {
    total_items: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    deferred: 0,
    avg_processing_time_ms: 0,
  };

  for (const row of counts) {
    status.total_items += row.count;
    status[row.status] = row.count;
  }

  // Get average processing time
  const avgTime = db.prepare(`
    SELECT AVG(processed_at - created_at) as avg_time
    FROM pm_queue
    WHERE processed_at IS NOT NULL
  `).get() as { avg_time: number | null };

  if (avgTime.avg_time) {
    status.avg_processing_time_ms = avgTime.avg_time * 1000; // Convert seconds to ms
  }

  // Get oldest pending item
  const oldestRow = db.prepare(`
    SELECT * FROM pm_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
  `).get() as any;

  if (oldestRow) {
    status.oldest_pending = rowToQueuedItem(oldestRow);
  }

  return status;
}

/**
 * Get a specific queued item
 */
export async function getQueuedItem(queueId: string): Promise<QueuedItem | null> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM pm_queue WHERE id = ?').get(queueId) as any;

  return row ? rowToQueuedItem(row) : null;
}

/**
 * Get queued items by status
 */
export async function getQueuedItemsByStatus(
  status: QueueItemStatus,
  limit: number = 50,
  offset: number = 0
): Promise<QueuedItem[]> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const rows = db.prepare(`
    SELECT * FROM pm_queue
    WHERE status = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(status, limit, offset) as any[];

  return rows.map(rowToQueuedItem);
}

/**
 * Process the queue (execute pending items)
 */
export async function processQueue(limit: number = 10): Promise<ProcessingResult> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();

  // Get pending items
  const pendingItems = await getQueuedItemsByStatus('pending', limit);

  const result: ProcessingResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deferred: 0,
  };

  for (const item of pendingItems) {
    result.processed++;

    try {
      // Mark as processing
      db.prepare('UPDATE pm_queue SET status = ? WHERE id = ?')
        .run('processing', item.id);

      // Execute based on triage action
      await executeQueuedItem(item);

      // Mark as completed
      db.prepare('UPDATE pm_queue SET status = ?, processed_at = ? WHERE id = ?')
        .run('completed', Math.floor(Date.now() / 1000), item.id);

      result.succeeded++;
      console.log(`[Task Queue] Processed ${item.id} successfully`);
    } catch (error) {
      console.error(`[Task Queue] Failed to process ${item.id}:`, error);

      // Increment retry count
      const newRetryCount = item.retry_count + 1;
      const maxRetries = 3;

      if (newRetryCount >= maxRetries) {
        // Max retries reached, mark as failed
        db.prepare('UPDATE pm_queue SET status = ?, error = ?, retry_count = ? WHERE id = ?')
          .run('failed', error instanceof Error ? error.message : String(error), newRetryCount, item.id);
        result.failed++;
      } else {
        // Reset to pending for retry
        db.prepare('UPDATE pm_queue SET status = ?, error = ?, retry_count = ? WHERE id = ?')
          .run('pending', error instanceof Error ? error.message : String(error), newRetryCount, item.id);
      }
    }
  }

  console.log(`[Task Queue] Processed ${result.processed} items: ${result.succeeded} succeeded, ${result.failed} failed`);

  return result;
}

/**
 * Execute a single queued item (imported on demand to avoid circular dependencies)
 */
async function executeQueuedItem(item: QueuedItem): Promise<void> {
  const { createTaskFromSignal } = await import('./integration');

  switch (item.triage.action) {
    case 'github_issue':
    case 'local_task':
      // Create task in appropriate system
      await createTaskFromSignal(item.signal, item.triage);
      break;

    case 'defer':
      // Mark as deferred, no action taken
      const db = getDatabase().getRawDb();
      db.prepare('UPDATE pm_queue SET status = ? WHERE id = ?')
        .run('deferred', item.id);
      break;

    case 'escalate':
      // For now, just log it
      // In the future, this could send notifications
      console.log(`[Task Queue] ESCALATED: ${item.signal.id} - ${item.triage.rationale}`);
      break;

    case 'ignore':
      // Do nothing, mark as completed
      break;
  }
}

/**
 * Retry a failed queue item
 */
export async function retryQueuedItem(queueId: string): Promise<boolean> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const result = db.prepare(`
    UPDATE pm_queue
    SET status = 'pending', error = NULL
    WHERE id = ? AND status = 'failed'
  `).run(queueId);

  return result.changes > 0;
}

/**
 * Update queue item status
 */
export async function updateQueuedItemStatus(
  queueId: string,
  status: QueueItemStatus
): Promise<boolean> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const result = db.prepare('UPDATE pm_queue SET status = ? WHERE id = ?')
    .run(status, queueId);

  return result.changes > 0;
}

/**
 * Delete a queued item
 */
export async function deleteQueuedItem(queueId: string): Promise<boolean> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const result = db.prepare('DELETE FROM pm_queue WHERE id = ?').run(queueId);

  return result.changes > 0;
}

/**
 * Clean up old completed items
 */
export async function cleanupQueue(daysOld: number): Promise<number> {
  ensureQueueTable();

  const db = getDatabase().getRawDb();
  const cutoffTime = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);

  const result = db.prepare(`
    DELETE FROM pm_queue
    WHERE status = 'completed'
    AND created_at < ?
  `).run(cutoffTime);

  console.log(`[Task Queue] Cleaned up ${result.changes} old items`);

  return result.changes;
}

// ============================================================================
// Helpers
// ============================================================================

function rowToQueuedItem(row: any): QueuedItem {
  return {
    id: row.id,
    signal: {
      id: row.signal_id,
      source: row.signal_source as SignalSource,
      signal_type: row.signal_type as SignalType,
      payload: JSON.parse(row.signal_payload),
      timestamp: row.signal_timestamp,
      confidence: row.signal_confidence,
    },
    triage: {
      action: row.triage_action as QueueAction,
      rationale: row.triage_rationale,
      priority: row.triage_priority,
      escalation_level: row.triage_escalation_level as EscalationLevel,
      due_date: row.triage_due_date,
      assigned_project: row.triage_assigned_project,
      suggested_title: row.triage_suggested_title,
      suggested_labels: row.triage_suggested_labels ? JSON.parse(row.triage_suggested_labels) : undefined,
      metadata: row.triage_metadata ? JSON.parse(row.triage_metadata) : undefined,
    },
    status: row.status as QueueItemStatus,
    created_at: row.created_at,
    processed_at: row.processed_at,
    error: row.error,
    retry_count: row.retry_count,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}
