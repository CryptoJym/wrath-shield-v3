/**
 * AI Triage Observability Layer
 *
 * Tracks and analyzes AI vs rule-based triage decisions:
 * - Disagreement tracking and analysis
 * - Confidence distribution monitoring
 * - Human feedback incorporation
 * - Performance metrics over time
 *
 * This layer enables continuous improvement of the AI triage system
 * by capturing real-world outcomes and feeding them back into Zep memory.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { addPMMemory, searchPMMemories } from './pm-memory';
import type { IncomingSignal, TriageResult, QueueAction, EscalationLevel } from './task-queue';
import type { AITriageResult } from './ai-triage';

ensureServerOnly('lib/pm/ai-observability');

// ============================================================================
// Types
// ============================================================================

export interface TriageDecisionRecord {
  id: string;
  signal_id: string;
  signal_source: string;
  signal_type: string;
  timestamp: number;

  // AI decision
  ai_action: QueueAction | null;
  ai_escalation: EscalationLevel | null;
  ai_priority: string | null;
  ai_confidence: number | null;
  ai_rationale: string | null;
  ai_model: string | null;
  ai_processing_time_ms: number | null;
  ai_zep_context_used: boolean;

  // Rule decision
  rule_action: QueueAction | null;
  rule_escalation: EscalationLevel | null;
  rule_priority: string | null;
  rule_id: string | null;

  // Final decision (what was actually used)
  final_action: QueueAction;
  final_escalation: EscalationLevel;
  final_priority: string;
  decision_source: 'ai' | 'rules' | 'human' | 'merged';

  // Human feedback
  human_override: boolean;
  human_action?: QueueAction;
  human_escalation?: EscalationLevel;
  human_priority?: string;
  human_feedback?: string;
  feedback_timestamp?: number;

  // Analysis
  ai_rules_agreed: boolean;
  disagreement_type?: 'action' | 'escalation' | 'priority' | 'multiple';
}

export interface DisagreementSummary {
  total_decisions: number;
  ai_only: number;
  rules_only: number;
  both_available: number;
  agreements: number;
  disagreements: number;
  agreement_rate: number;
  disagreement_by_type: {
    action: number;
    escalation: number;
    priority: number;
    multiple: number;
  };
  human_overrides: number;
  ai_correct_after_override: number;
  rules_correct_after_override: number;
}

export interface ConfidenceDistribution {
  bucket: string;
  count: number;
  ai_accepted: number;
  fallback_to_rules: number;
  human_override: number;
}

export interface PerformanceMetrics {
  period_start: number;
  period_end: number;
  total_signals: number;
  ai_processed: number;
  ai_success_rate: number;
  avg_ai_confidence: number;
  avg_processing_time_ms: number;
  zep_context_usage_rate: number;
  human_override_rate: number;
}

// ============================================================================
// Database Schema
// ============================================================================

function ensureObservabilityTable(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_triage_decisions (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      signal_source TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,

      ai_action TEXT,
      ai_escalation TEXT,
      ai_priority TEXT,
      ai_confidence REAL,
      ai_rationale TEXT,
      ai_model TEXT,
      ai_processing_time_ms INTEGER,
      ai_zep_context_used INTEGER DEFAULT 0,

      rule_action TEXT,
      rule_escalation TEXT,
      rule_priority TEXT,
      rule_id TEXT,

      final_action TEXT NOT NULL,
      final_escalation TEXT NOT NULL,
      final_priority TEXT NOT NULL,
      decision_source TEXT NOT NULL,

      human_override INTEGER DEFAULT 0,
      human_action TEXT,
      human_escalation TEXT,
      human_priority TEXT,
      human_feedback TEXT,
      feedback_timestamp INTEGER,

      ai_rules_agreed INTEGER DEFAULT 0,
      disagreement_type TEXT,

      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_triage_decisions_timestamp ON pm_triage_decisions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_triage_decisions_source ON pm_triage_decisions(signal_source);
    CREATE INDEX IF NOT EXISTS idx_triage_decisions_disagreement ON pm_triage_decisions(ai_rules_agreed);
    CREATE INDEX IF NOT EXISTS idx_triage_decisions_confidence ON pm_triage_decisions(ai_confidence);
    CREATE INDEX IF NOT EXISTS idx_triage_decisions_override ON pm_triage_decisions(human_override);
  `);
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Record a triage decision with full observability data
 */
export async function recordTriageDecision(params: {
  signal: IncomingSignal;
  aiResult: AITriageResult | null;
  ruleResult: TriageResult | null;
  finalResult: TriageResult;
  decisionSource: 'ai' | 'rules' | 'human' | 'merged';
}): Promise<string> {
  ensureObservabilityTable();

  const { signal, aiResult, ruleResult, finalResult, decisionSource } = params;
  const db = getDatabase().getRawDb();
  const id = `td_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Determine agreement
  let aiRulesAgreed = false;
  let disagreementType: string | null = null;

  if (aiResult && ruleResult) {
    const actionAgrees = aiResult.action === ruleResult.action;
    const escalationAgrees = aiResult.escalation_level === ruleResult.escalation_level;
    const priorityAgrees = aiResult.priority === ruleResult.priority;

    aiRulesAgreed = actionAgrees && escalationAgrees && priorityAgrees;

    if (!aiRulesAgreed) {
      const disagreements: string[] = [];
      if (!actionAgrees) disagreements.push('action');
      if (!escalationAgrees) disagreements.push('escalation');
      if (!priorityAgrees) disagreements.push('priority');
      disagreementType = disagreements.length > 1 ? 'multiple' : disagreements[0];
    }
  }

  db.prepare(`
    INSERT INTO pm_triage_decisions (
      id, signal_id, signal_source, signal_type, timestamp,
      ai_action, ai_escalation, ai_priority, ai_confidence, ai_rationale,
      ai_model, ai_processing_time_ms, ai_zep_context_used,
      rule_action, rule_escalation, rule_priority, rule_id,
      final_action, final_escalation, final_priority, decision_source,
      ai_rules_agreed, disagreement_type
    ) VALUES (
      @id, @signal_id, @signal_source, @signal_type, @timestamp,
      @ai_action, @ai_escalation, @ai_priority, @ai_confidence, @ai_rationale,
      @ai_model, @ai_processing_time_ms, @ai_zep_context_used,
      @rule_action, @rule_escalation, @rule_priority, @rule_id,
      @final_action, @final_escalation, @final_priority, @decision_source,
      @ai_rules_agreed, @disagreement_type
    )
  `).run({
    id,
    signal_id: signal.id,
    signal_source: signal.source,
    signal_type: signal.signal_type,
    timestamp: signal.timestamp,

    ai_action: aiResult?.action ?? null,
    ai_escalation: aiResult?.escalation_level ?? null,
    ai_priority: aiResult?.priority ?? null,
    ai_confidence: aiResult?.confidence ?? null,
    ai_rationale: aiResult?.ai_rationale ?? null,
    ai_model: aiResult?.model_used ?? null,
    ai_processing_time_ms: (aiResult?.metadata?.processing_time_ms as number) ?? null,
    ai_zep_context_used: aiResult?.zep_context_used ? 1 : 0,

    rule_action: ruleResult?.action ?? null,
    rule_escalation: ruleResult?.escalation_level ?? null,
    rule_priority: ruleResult?.priority ?? null,
    rule_id: (ruleResult?.metadata?.rule_id as string) ?? null,

    final_action: finalResult.action,
    final_escalation: finalResult.escalation_level,
    final_priority: finalResult.priority,
    decision_source: decisionSource,

    ai_rules_agreed: aiRulesAgreed ? 1 : 0,
    disagreement_type: disagreementType,
  });

  // Log disagreements to Zep for learning
  if (!aiRulesAgreed && aiResult && ruleResult) {
    try {
      await addPMMemory(
        `Triage disagreement for ${signal.source}/${signal.signal_type}: ` +
        `AI suggested ${aiResult.action}/${aiResult.escalation_level} (conf=${aiResult.confidence?.toFixed(2)}), ` +
        `Rules suggested ${ruleResult.action}/${ruleResult.escalation_level}. ` +
        `Final: ${finalResult.action} via ${decisionSource}`,
        'pattern',
        {
          type: 'disagreement',
          signal_source: signal.source,
          signal_type: signal.signal_type,
          ai_action: aiResult.action,
          rule_action: ruleResult.action,
          final_action: finalResult.action,
          decision_source: decisionSource,
        }
      );
    } catch (error) {
      console.warn('[Observability] Failed to log disagreement to Zep:', error);
    }
  }

  return id;
}

/**
 * Record human feedback/override for a triage decision
 */
export async function recordHumanFeedback(params: {
  decisionId: string;
  humanAction?: QueueAction;
  humanEscalation?: EscalationLevel;
  humanPriority?: string;
  feedback?: string;
}): Promise<boolean> {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  // Get the original decision
  const original = db.prepare('SELECT * FROM pm_triage_decisions WHERE id = ?').get(params.decisionId) as any;

  if (!original) {
    console.warn(`[Observability] Decision not found: ${params.decisionId}`);
    return false;
  }

  const result = db.prepare(`
    UPDATE pm_triage_decisions
    SET human_override = 1,
        human_action = @human_action,
        human_escalation = @human_escalation,
        human_priority = @human_priority,
        human_feedback = @feedback,
        feedback_timestamp = @timestamp
    WHERE id = @id
  `).run({
    id: params.decisionId,
    human_action: params.humanAction ?? null,
    human_escalation: params.humanEscalation ?? null,
    human_priority: params.humanPriority ?? null,
    feedback: params.feedback ?? null,
    timestamp: now,
  });

  // Persist to Zep for learning
  if (result.changes > 0) {
    try {
      const wasAICorrect = params.humanAction === original.ai_action;
      const wasRulesCorrect = params.humanAction === original.rule_action;

      await addPMMemory(
        `Human override for ${original.signal_source}/${original.signal_type}: ` +
        `Changed to ${params.humanAction}/${params.humanEscalation}. ` +
        `AI was ${wasAICorrect ? 'correct' : 'wrong'} (suggested ${original.ai_action}), ` +
        `Rules were ${wasRulesCorrect ? 'correct' : 'wrong'} (suggested ${original.rule_action}). ` +
        (params.feedback ? `Feedback: ${params.feedback}` : ''),
        'pattern',
        {
          type: 'human_override',
          signal_source: original.signal_source,
          signal_type: original.signal_type,
          original_action: original.final_action,
          human_action: params.humanAction,
          ai_was_correct: wasAICorrect,
          rules_were_correct: wasRulesCorrect,
          feedback: params.feedback,
        }
      );
    } catch (error) {
      console.warn('[Observability] Failed to log human feedback to Zep:', error);
    }
  }

  return result.changes > 0;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Get disagreement summary for a time period
 */
export function getDisagreementSummary(
  startTime?: number,
  endTime?: number
): DisagreementSummary {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();
  const start = startTime ?? 0;
  const end = endTime ?? Math.floor(Date.now() / 1000);

  // Total decisions
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(start, end) as { count: number };

  // Decisions with both AI and rules
  const bothAvailable = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND ai_action IS NOT NULL AND rule_action IS NOT NULL
  `).get(start, end) as { count: number };

  // AI only
  const aiOnly = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND ai_action IS NOT NULL AND rule_action IS NULL
  `).get(start, end) as { count: number };

  // Rules only
  const rulesOnly = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND ai_action IS NULL AND rule_action IS NOT NULL
  `).get(start, end) as { count: number };

  // Agreements
  const agreements = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND ai_rules_agreed = 1
  `).get(start, end) as { count: number };

  // Disagreement types
  const disagreementTypes = db.prepare(`
    SELECT disagreement_type, COUNT(*) as count
    FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND ai_rules_agreed = 0 AND disagreement_type IS NOT NULL
    GROUP BY disagreement_type
  `).all(start, end) as Array<{ disagreement_type: string; count: number }>;

  const byType = {
    action: 0,
    escalation: 0,
    priority: 0,
    multiple: 0,
  };
  for (const row of disagreementTypes) {
    if (row.disagreement_type in byType) {
      byType[row.disagreement_type as keyof typeof byType] = row.count;
    }
  }

  // Human overrides
  const overrides = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND human_override = 1
  `).get(start, end) as { count: number };

  // AI correct after override
  const aiCorrect = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND human_override = 1 AND human_action = ai_action
  `).get(start, end) as { count: number };

  // Rules correct after override
  const rulesCorrect = db.prepare(`
    SELECT COUNT(*) as count FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
    AND human_override = 1 AND human_action = rule_action
  `).get(start, end) as { count: number };

  const disagreements = bothAvailable.count - agreements.count;

  return {
    total_decisions: total.count,
    ai_only: aiOnly.count,
    rules_only: rulesOnly.count,
    both_available: bothAvailable.count,
    agreements: agreements.count,
    disagreements,
    agreement_rate: bothAvailable.count > 0 ? agreements.count / bothAvailable.count : 0,
    disagreement_by_type: byType,
    human_overrides: overrides.count,
    ai_correct_after_override: aiCorrect.count,
    rules_correct_after_override: rulesCorrect.count,
  };
}

/**
 * Get confidence distribution for AI decisions
 */
export function getConfidenceDistribution(
  startTime?: number,
  endTime?: number
): ConfidenceDistribution[] {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();
  const start = startTime ?? 0;
  const end = endTime ?? Math.floor(Date.now() / 1000);

  const buckets = [
    { min: 0, max: 0.2, label: '0-20%' },
    { min: 0.2, max: 0.4, label: '20-40%' },
    { min: 0.4, max: 0.6, label: '40-60%' },
    { min: 0.6, max: 0.8, label: '60-80%' },
    { min: 0.8, max: 1.01, label: '80-100%' },
  ];

  const results: ConfidenceDistribution[] = [];

  for (const bucket of buckets) {
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE timestamp >= ? AND timestamp <= ?
      AND ai_confidence >= ? AND ai_confidence < ?
    `).get(start, end, bucket.min, bucket.max) as { count: number };

    const accepted = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE timestamp >= ? AND timestamp <= ?
      AND ai_confidence >= ? AND ai_confidence < ?
      AND decision_source = 'ai'
    `).get(start, end, bucket.min, bucket.max) as { count: number };

    const fallback = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE timestamp >= ? AND timestamp <= ?
      AND ai_confidence >= ? AND ai_confidence < ?
      AND decision_source = 'rules'
    `).get(start, end, bucket.min, bucket.max) as { count: number };

    const override = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE timestamp >= ? AND timestamp <= ?
      AND ai_confidence >= ? AND ai_confidence < ?
      AND human_override = 1
    `).get(start, end, bucket.min, bucket.max) as { count: number };

    results.push({
      bucket: bucket.label,
      count: total.count,
      ai_accepted: accepted.count,
      fallback_to_rules: fallback.count,
      human_override: override.count,
    });
  }

  return results;
}

/**
 * Get performance metrics for a time period
 */
export function getPerformanceMetrics(
  startTime?: number,
  endTime?: number
): PerformanceMetrics {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();
  const start = startTime ?? Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Last 24h
  const end = endTime ?? Math.floor(Date.now() / 1000);

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ai_action IS NOT NULL THEN 1 ELSE 0 END) as ai_processed,
      AVG(CASE WHEN ai_confidence IS NOT NULL THEN ai_confidence ELSE NULL END) as avg_confidence,
      AVG(ai_processing_time_ms) as avg_time,
      SUM(CASE WHEN ai_zep_context_used = 1 THEN 1 ELSE 0 END) as zep_used,
      SUM(CASE WHEN human_override = 1 THEN 1 ELSE 0 END) as overrides
    FROM pm_triage_decisions
    WHERE timestamp >= ? AND timestamp <= ?
  `).get(start, end) as {
    total: number;
    ai_processed: number;
    avg_confidence: number | null;
    avg_time: number | null;
    zep_used: number;
    overrides: number;
  };

  return {
    period_start: start,
    period_end: end,
    total_signals: stats.total,
    ai_processed: stats.ai_processed,
    ai_success_rate: stats.total > 0 ? stats.ai_processed / stats.total : 0,
    avg_ai_confidence: stats.avg_confidence ?? 0,
    avg_processing_time_ms: stats.avg_time ?? 0,
    zep_context_usage_rate: stats.ai_processed > 0 ? stats.zep_used / stats.ai_processed : 0,
    human_override_rate: stats.total > 0 ? stats.overrides / stats.total : 0,
  };
}

/**
 * Get recent disagreements for review
 */
export function getRecentDisagreements(
  limit: number = 20
): TriageDecisionRecord[] {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM pm_triage_decisions
    WHERE ai_rules_agreed = 0 AND ai_action IS NOT NULL AND rule_action IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(rowToDecisionRecord);
}

/**
 * Get decisions pending human review (AI/rules disagreed, no human feedback yet)
 */
export function getPendingReviewDecisions(
  limit: number = 50
): TriageDecisionRecord[] {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM pm_triage_decisions
    WHERE ai_rules_agreed = 0
    AND human_override = 0
    AND ai_action IS NOT NULL
    AND rule_action IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(rowToDecisionRecord);
}

// ============================================================================
// Confidence Threshold Analysis
// ============================================================================

/**
 * Analyze what threshold would yield best results based on human feedback
 */
export function analyzeOptimalThreshold(): {
  current_threshold: number;
  recommended_threshold: number;
  analysis: Array<{
    threshold: number;
    ai_acceptance_rate: number;
    human_agreement_rate: number;
    disagreement_rate: number;
  }>;
} {
  ensureObservabilityTable();

  const db = getDatabase().getRawDb();
  const currentThreshold = parseFloat(process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD || '0.6');

  const thresholds = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const analysis: Array<{
    threshold: number;
    ai_acceptance_rate: number;
    human_agreement_rate: number;
    disagreement_rate: number;
  }> = [];

  for (const threshold of thresholds) {
    // How many AI decisions would be accepted at this threshold
    const aboveThreshold = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE ai_confidence IS NOT NULL AND ai_confidence >= ?
    `).get(threshold) as { count: number };

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE ai_confidence IS NOT NULL
    `).get() as { count: number };

    // Of those accepted, how many did humans agree with
    const humanAgreed = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE ai_confidence >= ?
      AND human_override = 1
      AND human_action = ai_action
    `).get(threshold) as { count: number };

    const humanReviewed = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE ai_confidence >= ? AND human_override = 1
    `).get(threshold) as { count: number };

    // Disagreement rate at this threshold
    const disagreed = db.prepare(`
      SELECT COUNT(*) as count FROM pm_triage_decisions
      WHERE ai_confidence >= ?
      AND ai_rules_agreed = 0
    `).get(threshold) as { count: number };

    analysis.push({
      threshold,
      ai_acceptance_rate: total.count > 0 ? aboveThreshold.count / total.count : 0,
      human_agreement_rate: humanReviewed.count > 0 ? humanAgreed.count / humanReviewed.count : 1,
      disagreement_rate: aboveThreshold.count > 0 ? disagreed.count / aboveThreshold.count : 0,
    });
  }

  // Find optimal threshold (maximize human agreement, minimize disagreement)
  let bestThreshold = currentThreshold;
  let bestScore = -Infinity;

  for (const a of analysis) {
    // Score: human agreement - disagreement rate (weighted)
    const score = a.human_agreement_rate - (a.disagreement_rate * 0.5);
    if (score > bestScore && a.ai_acceptance_rate > 0.3) { // Must accept at least 30%
      bestScore = score;
      bestThreshold = a.threshold;
    }
  }

  return {
    current_threshold: currentThreshold,
    recommended_threshold: bestThreshold,
    analysis,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function rowToDecisionRecord(row: any): TriageDecisionRecord {
  return {
    id: row.id,
    signal_id: row.signal_id,
    signal_source: row.signal_source,
    signal_type: row.signal_type,
    timestamp: row.timestamp,

    ai_action: row.ai_action,
    ai_escalation: row.ai_escalation,
    ai_priority: row.ai_priority,
    ai_confidence: row.ai_confidence,
    ai_rationale: row.ai_rationale,
    ai_model: row.ai_model,
    ai_processing_time_ms: row.ai_processing_time_ms,
    ai_zep_context_used: !!row.ai_zep_context_used,

    rule_action: row.rule_action,
    rule_escalation: row.rule_escalation,
    rule_priority: row.rule_priority,
    rule_id: row.rule_id,

    final_action: row.final_action,
    final_escalation: row.final_escalation,
    final_priority: row.final_priority,
    decision_source: row.decision_source,

    human_override: !!row.human_override,
    human_action: row.human_action,
    human_escalation: row.human_escalation,
    human_priority: row.human_priority,
    human_feedback: row.human_feedback,
    feedback_timestamp: row.feedback_timestamp,

    ai_rules_agreed: !!row.ai_rules_agreed,
    disagreement_type: row.disagreement_type,
  };
}
