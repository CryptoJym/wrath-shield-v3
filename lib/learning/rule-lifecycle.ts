/**
 * Rule Lifecycle Manager - Confidence Decay and Contradiction Detection
 *
 * This module manages the lifecycle of preference rules created by the Semantic Learning Bridge.
 * It implements:
 *
 * 1. Confidence Decay: Rules become less confident over time without reinforcement
 * 2. Provenance Tracking: Track which events/corrections led to each rule
 * 3. Contradiction Detection: Identify conflicting rules that need resolution
 * 4. Rule Status Management: Active, decayed, contradicted, archived states
 *
 * Purpose:
 * - Prevent stale rules from persisting forever
 * - Maintain data quality through contradiction resolution
 * - Provide transparency about rule origins and effectiveness
 * - Enable telemetry and observability for rule performance
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase, type Database as DatabaseClass } from '../db/Database';
import type { PatternRule } from '../ea/preference-model';

ensureServerOnly('lib/learning/rule-lifecycle');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Rule category classification
 */
export type RuleCategory = 'urgency_trigger' | 'auto_archive' | 'custom';

/**
 * Rule status in its lifecycle
 */
export type RuleStatus = 'active' | 'decayed' | 'contradicted' | 'archived';

/**
 * Type of contradiction between rules
 */
export type ContradictionType = 'direct_conflict' | 'overlapping_patterns' | 'behavior_conflict';

/**
 * Severity of a detected contradiction
 */
export type ContradictionSeverity = 'high' | 'medium' | 'low';

/**
 * Suggested resolution strategy for a contradiction
 */
export type ResolutionStrategy = 'keep_rule1' | 'keep_rule2' | 'merge' | 'human_review';

/**
 * Rule with full provenance and lifecycle tracking
 */
export interface RuleWithProvenance {
  rule: PatternRule;
  ruleId: string;
  category: RuleCategory;

  // Provenance tracking
  derivedFromEvents: string[];
  createdAt: string;
  lastReinforcedAt: string;
  reinforcementCount: number;

  // Decay tracking
  currentConfidence: number;
  originalConfidence: number;
  decayHistory: Array<{ timestamp: string; reason: string; newValue: number }>;

  // Status
  status: RuleStatus;
}

/**
 * Report of a detected contradiction between two rules
 */
export interface ContradictionReport {
  id: string;
  rule1Id: string;
  rule2Id: string;
  contradictionType: ContradictionType;
  description: string;
  severity: ContradictionSeverity;
  suggestedResolution: ResolutionStrategy;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: string;
}

/**
 * Configuration for decay behavior
 */
export interface DecayConfig {
  decayIntervalDays: number; // How often to run decay (default: 7)
  decayRatePerInterval: number; // How much to reduce (default: 0.1 = 10%)
  minConfidenceThreshold: number; // Below this, mark as 'decayed' (default: 0.3)
  reinforcementBoost: number; // How much to boost on reinforcement (default: 0.15)
  maxConfidence: number; // Cap (default: 1.0)
}

/**
 * Statistics about the rule lifecycle system
 */
export interface RuleLifecycleStats {
  totalRules: number;
  activeRules: number;
  decayedRules: number;
  contradictions: number;
  avgConfidence: number;
}

/**
 * Result of a decay cycle
 */
export interface DecayCycleResult {
  decayed: string[];
  archived: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  decayIntervalDays: 7,
  decayRatePerInterval: 0.1,
  minConfidenceThreshold: 0.3,
  reinforcementBoost: 0.15,
  maxConfidence: 1.0,
};

// ============================================================================
// Database Schema Initialization
// ============================================================================

/**
 * Initialize database tables for rule lifecycle tracking
 */
function initializeTables(db: DatabaseClass): void {
  // Rule provenance tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_provenance (
      rule_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      pattern TEXT NOT NULL,
      is_regex INTEGER NOT NULL DEFAULT 0,
      case_sensitive INTEGER NOT NULL DEFAULT 0,
      derived_from_events_json TEXT,
      created_at TEXT NOT NULL,
      last_reinforced_at TEXT,
      reinforcement_count INTEGER DEFAULT 0,
      current_confidence REAL NOT NULL,
      original_confidence REAL NOT NULL,
      decay_history_json TEXT,
      status TEXT DEFAULT 'active',
      weight REAL NOT NULL,
      learned_at TEXT NOT NULL,
      source TEXT NOT NULL,
      example_matches_json TEXT
    )
  `);

  // Contradiction reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contradiction_reports (
      id TEXT PRIMARY KEY,
      rule1_id TEXT NOT NULL,
      rule2_id TEXT NOT NULL,
      contradiction_type TEXT NOT NULL,
      description TEXT,
      severity TEXT,
      suggested_resolution TEXT,
      detected_at TEXT NOT NULL,
      resolved_at TEXT,
      resolution TEXT,
      FOREIGN KEY (rule1_id) REFERENCES rule_provenance(rule_id),
      FOREIGN KEY (rule2_id) REFERENCES rule_provenance(rule_id)
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rule_provenance_status
    ON rule_provenance(status);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rule_provenance_category
    ON rule_provenance(category);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contradiction_resolved
    ON contradiction_reports(resolved_at);
  `);

  console.log('[RuleLifecycle] Database tables initialized');
}

// ============================================================================
// Rule Lifecycle Manager
// ============================================================================

/**
 * Manages the complete lifecycle of preference rules including decay,
 * provenance tracking, and contradiction detection.
 */
export class RuleLifecycleManager {
  private db: DatabaseClass;
  private config: DecayConfig;

  constructor(config?: Partial<DecayConfig>) {
    this.db = getDatabase();
    this.config = { ...DEFAULT_DECAY_CONFIG, ...config };

    // Initialize database tables
    initializeTables(this.db);

    console.log('[RuleLifecycle] Initialized with config:', this.config);
  }

  // ==========================================================================
  // Rule Creation and Tracking
  // ==========================================================================

  /**
   * Add a new rule to the lifecycle tracking system
   */
  async addRule(
    rule: PatternRule,
    category: RuleCategory,
    derivedFromEvents: string[] = []
  ): Promise<string> {
    const ruleId = this.generateRuleId(rule);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO rule_provenance (
        rule_id, category, pattern, is_regex, case_sensitive,
        derived_from_events_json, created_at, last_reinforced_at,
        reinforcement_count, current_confidence, original_confidence,
        decay_history_json, status, weight, learned_at, source,
        example_matches_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      ruleId,
      category,
      rule.pattern,
      rule.isRegex ? 1 : 0,
      rule.caseSensitive ? 1 : 0,
      JSON.stringify(derivedFromEvents),
      now,
      now,
      0,
      rule.weight,
      rule.weight,
      JSON.stringify([]),
      'active',
      rule.weight,
      rule.learnedAt,
      rule.source,
      JSON.stringify(rule.exampleMatches || [])
    );

    console.log(`[RuleLifecycle] Added rule ${ruleId} (${category})`);
    return ruleId;
  }

  /**
   * Generate a unique ID for a rule based on its pattern and category
   */
  private generateRuleId(rule: PatternRule): string {
    const hash = this.simpleHash(rule.pattern);
    return `rule_${hash}_${Date.now()}`;
  }

  /**
   * Simple hash function for rule patterns
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ==========================================================================
  // Decay Operations
  // ==========================================================================

  /**
   * Run a complete decay cycle on all active rules
   */
  async runDecayCycle(): Promise<DecayCycleResult> {
    const now = Date.now();
    const decayIntervalMs = this.config.decayIntervalDays * 24 * 60 * 60 * 1000;

    const rules = await this.getActiveRules();
    const decayed: string[] = [];
    const archived: string[] = [];

    for (const ruleWithProvenance of rules) {
      const lastReinforcedMs = new Date(ruleWithProvenance.lastReinforcedAt).getTime();
      const timeSinceReinforcement = now - lastReinforcedMs;

      // Check if enough time has passed to decay this rule
      if (timeSinceReinforcement < decayIntervalMs) {
        continue;
      }

      // Calculate number of intervals that have passed
      const intervalsPassed = Math.floor(timeSinceReinforcement / decayIntervalMs);

      // Apply decay
      const reason = `Natural decay: ${intervalsPassed} interval(s) passed without reinforcement`;
      await this.decayRule(ruleWithProvenance.ruleId, reason);

      // Check if rule should be archived
      if (ruleWithProvenance.currentConfidence <= this.config.minConfidenceThreshold) {
        await this.archiveRule(ruleWithProvenance.ruleId);
        archived.push(ruleWithProvenance.ruleId);
      } else {
        decayed.push(ruleWithProvenance.ruleId);
      }
    }

    console.log(
      `[RuleLifecycle] Decay cycle complete: ${decayed.length} decayed, ${archived.length} archived`
    );

    return { decayed, archived };
  }

  /**
   * Decay a specific rule's confidence
   */
  async decayRule(ruleId: string, reason: string): Promise<void> {
    const rule = await this.getProvenance(ruleId);
    if (!rule) {
      console.warn(`[RuleLifecycle] Rule ${ruleId} not found for decay`);
      return;
    }

    // Calculate new confidence
    const newConfidence = Math.max(
      0,
      rule.currentConfidence - this.config.decayRatePerInterval
    );

    // Update decay history
    const decayEntry = {
      timestamp: new Date().toISOString(),
      reason,
      newValue: newConfidence,
    };
    const updatedHistory = [...rule.decayHistory, decayEntry];

    // Determine new status
    const newStatus =
      newConfidence <= this.config.minConfidenceThreshold ? 'decayed' : rule.status;

    // Update database
    const stmt = this.db.prepare(`
      UPDATE rule_provenance
      SET current_confidence = ?,
          decay_history_json = ?,
          status = ?
      WHERE rule_id = ?
    `);

    stmt.run(newConfidence, JSON.stringify(updatedHistory), newStatus, ruleId);

    console.log(
      `[RuleLifecycle] Decayed rule ${ruleId}: ${rule.currentConfidence.toFixed(2)} -> ${newConfidence.toFixed(2)}`
    );
  }

  /**
   * Reinforce a rule when it's successfully used
   */
  async reinforceRule(ruleId: string, eventIds: string[] = []): Promise<void> {
    const rule = await this.getProvenance(ruleId);
    if (!rule) {
      console.warn(`[RuleLifecycle] Rule ${ruleId} not found for reinforcement`);
      return;
    }

    // Calculate new confidence (capped at max)
    const newConfidence = Math.min(
      this.config.maxConfidence,
      rule.currentConfidence + this.config.reinforcementBoost
    );

    // Update reinforcement tracking
    const now = new Date().toISOString();
    const newReinforcementCount = rule.reinforcementCount + 1;

    // Add to provenance
    const updatedEvents = [...rule.derivedFromEvents, ...eventIds];

    // Update database
    const stmt = this.db.prepare(`
      UPDATE rule_provenance
      SET current_confidence = ?,
          last_reinforced_at = ?,
          reinforcement_count = ?,
          derived_from_events_json = ?,
          status = 'active'
      WHERE rule_id = ?
    `);

    stmt.run(
      newConfidence,
      now,
      newReinforcementCount,
      JSON.stringify(updatedEvents),
      ruleId
    );

    console.log(
      `[RuleLifecycle] Reinforced rule ${ruleId}: ${rule.currentConfidence.toFixed(2)} -> ${newConfidence.toFixed(2)} (count: ${newReinforcementCount})`
    );
  }

  /**
   * Archive a rule (mark as no longer active)
   */
  private async archiveRule(ruleId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE rule_provenance
      SET status = 'archived'
      WHERE rule_id = ?
    `);

    stmt.run(ruleId);
    console.log(`[RuleLifecycle] Archived rule ${ruleId}`);
  }

  // ==========================================================================
  // Provenance Operations
  // ==========================================================================

  /**
   * Add provenance (event tracking) to a rule
   */
  async addProvenance(ruleId: string, eventIds: string[]): Promise<void> {
    const rule = await this.getProvenance(ruleId);
    if (!rule) {
      console.warn(`[RuleLifecycle] Rule ${ruleId} not found for provenance addition`);
      return;
    }

    const updatedEvents = [...rule.derivedFromEvents, ...eventIds];

    const stmt = this.db.prepare(`
      UPDATE rule_provenance
      SET derived_from_events_json = ?
      WHERE rule_id = ?
    `);

    stmt.run(JSON.stringify(updatedEvents), ruleId);

    console.log(`[RuleLifecycle] Added provenance to rule ${ruleId}: ${eventIds.length} events`);
  }

  /**
   * Get full provenance information for a rule
   */
  async getProvenance(ruleId: string): Promise<RuleWithProvenance | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM rule_provenance WHERE rule_id = ?
    `);

    const row = stmt.get(ruleId) as any;
    if (!row) {
      return null;
    }

    return this.rowToRuleWithProvenance(row);
  }

  /**
   * Convert database row to RuleWithProvenance
   */
  private rowToRuleWithProvenance(row: any): RuleWithProvenance {
    const derivedFromEvents = row.derived_from_events_json
      ? JSON.parse(row.derived_from_events_json)
      : [];
    const decayHistory = row.decay_history_json ? JSON.parse(row.decay_history_json) : [];
    const exampleMatches = row.example_matches_json
      ? JSON.parse(row.example_matches_json)
      : [];

    const rule: PatternRule = {
      pattern: row.pattern,
      isRegex: row.is_regex === 1,
      caseSensitive: row.case_sensitive === 1,
      weight: row.weight,
      learnedAt: row.learned_at,
      source: row.source,
      exampleMatches,
    };

    return {
      rule,
      ruleId: row.rule_id,
      category: row.category,
      derivedFromEvents,
      createdAt: row.created_at,
      lastReinforcedAt: row.last_reinforced_at,
      reinforcementCount: row.reinforcement_count,
      currentConfidence: row.current_confidence,
      originalConfidence: row.original_confidence,
      decayHistory,
      status: row.status,
    };
  }

  // ==========================================================================
  // Contradiction Detection
  // ==========================================================================

  /**
   * Detect contradictions between rules
   */
  async detectContradictions(): Promise<ContradictionReport[]> {
    const activeRules = await this.getActiveRules();
    const reports: ContradictionReport[] = [];

    // Compare each pair of rules
    for (let i = 0; i < activeRules.length; i++) {
      for (let j = i + 1; j < activeRules.length; j++) {
        const rule1 = activeRules[i];
        const rule2 = activeRules[j];

        const contradiction = this.checkContradiction(rule1, rule2);
        if (contradiction) {
          // Check if this contradiction already exists in the database
          const existing = await this.getExistingContradiction(rule1.ruleId, rule2.ruleId);
          if (!existing) {
            const report = await this.createContradictionReport(rule1, rule2, contradiction);
            reports.push(report);
          }
        }
      }
    }

    console.log(`[RuleLifecycle] Detected ${reports.length} new contradictions`);
    return reports;
  }

  /**
   * Check if two rules contradict each other
   */
  private checkContradiction(
    rule1: RuleWithProvenance,
    rule2: RuleWithProvenance
  ): { type: ContradictionType; severity: ContradictionSeverity; description: string } | null {
    // Direct conflict: Same category with opposite behaviors
    if (rule1.category !== rule2.category) {
      // Check if one is urgency trigger and other is auto-archive
      if (
        (rule1.category === 'urgency_trigger' && rule2.category === 'auto_archive') ||
        (rule1.category === 'auto_archive' && rule2.category === 'urgency_trigger')
      ) {
        // Check if patterns overlap
        if (this.patternsOverlap(rule1.rule.pattern, rule2.rule.pattern)) {
          return {
            type: 'direct_conflict',
            severity: 'high',
            description: `Rule promotes urgency while other archives same pattern`,
          };
        }
      }
    }

    // Overlapping patterns within same category
    if (rule1.category === rule2.category) {
      if (this.patternsOverlap(rule1.rule.pattern, rule2.rule.pattern)) {
        // Check if weights are significantly different
        const weightDiff = Math.abs(rule1.rule.weight - rule2.rule.weight);
        if (weightDiff > 0.3) {
          return {
            type: 'overlapping_patterns',
            severity: 'medium',
            description: `Similar patterns with conflicting weights (${rule1.rule.weight.toFixed(2)} vs ${rule2.rule.weight.toFixed(2)})`,
          };
        }
      }
    }

    // Behavior conflict: Rules that would cause conflicting actions
    if (this.hasBehaviorConflict(rule1, rule2)) {
      return {
        type: 'behavior_conflict',
        severity: 'low',
        description: `Rules may cause conflicting classification behaviors`,
      };
    }

    return null;
  }

  /**
   * Check if two patterns overlap (would match the same content)
   */
  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    const p1Lower = pattern1.toLowerCase();
    const p2Lower = pattern2.toLowerCase();

    // Simple substring check
    if (p1Lower.includes(p2Lower) || p2Lower.includes(p1Lower)) {
      return true;
    }

    // Check for common keywords in regex patterns
    const keywords1 = p1Lower.split('|');
    const keywords2 = p2Lower.split('|');

    for (const kw1 of keywords1) {
      for (const kw2 of keywords2) {
        if (kw1 === kw2 || kw1.includes(kw2) || kw2.includes(kw1)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if rules have conflicting behaviors
   */
  private hasBehaviorConflict(rule1: RuleWithProvenance, rule2: RuleWithProvenance): boolean {
    // High-weight urgency trigger vs high-weight archive pattern
    if (
      rule1.category === 'urgency_trigger' &&
      rule2.category === 'auto_archive' &&
      rule1.rule.weight > 0.7 &&
      rule2.rule.weight > 0.7
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get existing contradiction report between two rules
   */
  private async getExistingContradiction(
    rule1Id: string,
    rule2Id: string
  ): Promise<ContradictionReport | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM contradiction_reports
      WHERE (rule1_id = ? AND rule2_id = ?)
         OR (rule1_id = ? AND rule2_id = ?)
      AND resolved_at IS NULL
    `);

    const row = stmt.get(rule1Id, rule2Id, rule2Id, rule1Id) as any;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      rule1Id: row.rule1_id,
      rule2Id: row.rule2_id,
      contradictionType: row.contradiction_type,
      description: row.description,
      severity: row.severity,
      suggestedResolution: row.suggested_resolution,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at,
      resolution: row.resolution,
    };
  }

  /**
   * Create a new contradiction report
   */
  private async createContradictionReport(
    rule1: RuleWithProvenance,
    rule2: RuleWithProvenance,
    contradiction: { type: ContradictionType; severity: ContradictionSeverity; description: string }
  ): Promise<ContradictionReport> {
    const reportId = `contradiction_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Determine suggested resolution
    const suggestedResolution = this.suggestResolution(rule1, rule2, contradiction);

    const report: ContradictionReport = {
      id: reportId,
      rule1Id: rule1.ruleId,
      rule2Id: rule2.ruleId,
      contradictionType: contradiction.type,
      description: contradiction.description,
      severity: contradiction.severity,
      suggestedResolution,
      detectedAt: now,
    };

    // Save to database
    const stmt = this.db.prepare(`
      INSERT INTO contradiction_reports (
        id, rule1_id, rule2_id, contradiction_type,
        description, severity, suggested_resolution, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      report.id,
      report.rule1Id,
      report.rule2Id,
      report.contradictionType,
      report.description,
      report.severity,
      report.suggestedResolution,
      report.detectedAt
    );

    console.log(`[RuleLifecycle] Created contradiction report ${reportId}`);
    return report;
  }

  /**
   * Suggest a resolution strategy for a contradiction
   */
  private suggestResolution(
    rule1: RuleWithProvenance,
    rule2: RuleWithProvenance,
    contradiction: { type: ContradictionType; severity: ContradictionSeverity }
  ): ResolutionStrategy {
    // High severity: needs human review
    if (contradiction.severity === 'high') {
      return 'human_review';
    }

    // Keep the rule with higher confidence
    if (rule1.currentConfidence > rule2.currentConfidence) {
      return 'keep_rule1';
    } else if (rule2.currentConfidence > rule1.currentConfidence) {
      return 'keep_rule2';
    }

    // Keep the rule with more reinforcements
    if (rule1.reinforcementCount > rule2.reinforcementCount) {
      return 'keep_rule1';
    } else if (rule2.reinforcementCount > rule1.reinforcementCount) {
      return 'keep_rule2';
    }

    // Keep the older rule (more established)
    if (new Date(rule1.createdAt) < new Date(rule2.createdAt)) {
      return 'keep_rule1';
    }

    return 'keep_rule2';
  }

  /**
   * Resolve a contradiction
   */
  async resolveContradiction(
    reportId: string,
    resolution: 'keep_rule1' | 'keep_rule2' | 'merge' | 'archive_both'
  ): Promise<void> {
    const stmt = this.db.prepare(`
      SELECT * FROM contradiction_reports WHERE id = ?
    `);

    const report = stmt.get(reportId) as any;
    if (!report) {
      console.warn(`[RuleLifecycle] Contradiction report ${reportId} not found`);
      return;
    }

    // Apply resolution
    switch (resolution) {
      case 'keep_rule1':
        await this.archiveRule(report.rule2_id);
        break;
      case 'keep_rule2':
        await this.archiveRule(report.rule1_id);
        break;
      case 'archive_both':
        await this.archiveRule(report.rule1_id);
        await this.archiveRule(report.rule2_id);
        break;
      case 'merge':
        // For now, keep the rule with higher confidence
        const rule1 = await this.getProvenance(report.rule1_id);
        const rule2 = await this.getProvenance(report.rule2_id);
        if (rule1 && rule2) {
          if (rule1.currentConfidence >= rule2.currentConfidence) {
            await this.archiveRule(report.rule2_id);
          } else {
            await this.archiveRule(report.rule1_id);
          }
        }
        break;
    }

    // Mark contradiction as resolved
    const updateStmt = this.db.prepare(`
      UPDATE contradiction_reports
      SET resolved_at = ?, resolution = ?
      WHERE id = ?
    `);

    updateStmt.run(new Date().toISOString(), resolution, reportId);

    console.log(`[RuleLifecycle] Resolved contradiction ${reportId}: ${resolution}`);
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Get all active rules
   */
  async getActiveRules(): Promise<RuleWithProvenance[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM rule_provenance WHERE status = 'active'
    `);

    const rows = stmt.all();
    return rows.map((row) => this.rowToRuleWithProvenance(row));
  }

  /**
   * Get all decayed rules
   */
  async getDecayedRules(): Promise<RuleWithProvenance[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM rule_provenance WHERE status = 'decayed'
    `);

    const rows = stmt.all();
    return rows.map((row) => this.rowToRuleWithProvenance(row));
  }

  /**
   * Get rules that need human review
   */
  async getRulesNeedingReview(): Promise<RuleWithProvenance[]> {
    // Rules that are contradicted or have very low confidence
    const stmt = this.db.prepare(`
      SELECT * FROM rule_provenance
      WHERE status = 'contradicted'
         OR (status = 'decayed' AND current_confidence < ?)
    `);

    const rows = stmt.all(this.config.minConfidenceThreshold);
    return rows.map((row) => this.rowToRuleWithProvenance(row));
  }

  /**
   * Get statistics about the rule lifecycle system
   */
  async getStats(): Promise<RuleLifecycleStats> {
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM rule_provenance`);
    const activeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM rule_provenance WHERE status = 'active'`);
    const decayedStmt = this.db.prepare(`SELECT COUNT(*) as count FROM rule_provenance WHERE status = 'decayed'`);
    const contradictionsStmt = this.db.prepare(`SELECT COUNT(*) as count FROM contradiction_reports WHERE resolved_at IS NULL`);
    const avgConfidenceStmt = this.db.prepare(`SELECT AVG(current_confidence) as avg FROM rule_provenance WHERE status = 'active'`);

    const totalCount = (totalStmt.get() as any).count;
    const activeCount = (activeStmt.get() as any).count;
    const decayedCount = (decayedStmt.get() as any).count;
    const contradictionsCount = (contradictionsStmt.get() as any).count;
    const avgConfidence = (avgConfidenceStmt.get() as any).avg || 0;

    return {
      totalRules: totalCount,
      activeRules: activeCount,
      decayedRules: decayedCount,
      contradictions: contradictionsCount,
      avgConfidence: parseFloat(avgConfidence.toFixed(2)),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: RuleLifecycleManager | null = null;

/**
 * Get the singleton RuleLifecycleManager instance
 */
export function getRuleLifecycleManager(config?: Partial<DecayConfig>): RuleLifecycleManager {
  if (!instance) {
    instance = new RuleLifecycleManager(config);
  }
  return instance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetRuleLifecycleManager(): void {
  instance = null;
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Import existing rules from preference model into lifecycle tracking
 *
 * This should be called once to migrate existing rules into the system.
 */
export async function importExistingRules(
  urgencyTriggers: PatternRule[],
  autoArchivePatterns: PatternRule[]
): Promise<{ imported: number; skipped: number }> {
  const manager = getRuleLifecycleManager();
  let imported = 0;
  let skipped = 0;

  for (const rule of urgencyTriggers) {
    try {
      await manager.addRule(rule, 'urgency_trigger', []);
      imported++;
    } catch (error) {
      console.warn('[RuleLifecycle] Failed to import urgency trigger:', error);
      skipped++;
    }
  }

  for (const rule of autoArchivePatterns) {
    try {
      await manager.addRule(rule, 'auto_archive', []);
      imported++;
    } catch (error) {
      console.warn('[RuleLifecycle] Failed to import auto-archive pattern:', error);
      skipped++;
    }
  }

  console.log(`[RuleLifecycle] Import complete: ${imported} imported, ${skipped} skipped`);
  return { imported, skipped };
}

/**
 * Sync preference model rules with lifecycle tracking
 *
 * This ensures the preference model stays in sync with lifecycle data.
 */
export async function syncWithPreferenceModel(
  model: {
    urgency_triggers: PatternRule[];
    auto_archive_patterns: PatternRule[];
  }
): Promise<void> {
  const manager = getRuleLifecycleManager();

  // Get all active rules from lifecycle system
  const activeRules = await manager.getActiveRules();

  // Filter model rules to only include active ones
  const activeUrgencyTriggers = activeRules
    .filter((r) => r.category === 'urgency_trigger')
    .map((r) => r.rule);

  const activeAutoArchive = activeRules
    .filter((r) => r.category === 'auto_archive')
    .map((r) => r.rule);

  // Update model
  model.urgency_triggers = activeUrgencyTriggers;
  model.auto_archive_patterns = activeAutoArchive;

  console.log(
    `[RuleLifecycle] Synced with preference model: ${activeUrgencyTriggers.length} urgency triggers, ${activeAutoArchive.length} auto-archive patterns`
  );
}
