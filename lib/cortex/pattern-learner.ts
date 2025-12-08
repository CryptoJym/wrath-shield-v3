/**
 * Wrath Shield v3 - Pattern Learner
 *
 * Extracts and stores patterns from synthesis results for continuous improvement.
 * This module learns from both successful synthesis and user corrections to improve
 * future task synthesis quality.
 *
 * Architecture:
 * - Stores patterns in synthesis_patterns table
 * - Also persists to Zep memory for long-term retention
 * - Tracks success rates and usage counts
 * - Learns from corrections to generate anti-patterns
 * - Integrates with EA preference model for feedback
 * - Runs daily meta-analysis to identify high-success patterns
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import { Database } from '../db/Database';
import {
  addAgentMemory,
  searchAgentMemory,
  type AgentId,
  type ZepSearchResult,
} from '../memory/zep';
import {
  recordCorrection as recordEAFeedback,
  type Domain,
  type UrgencyLevel,
} from '../ea/preference-model';
import type {
  SynthesisResult,
  SynthesisPattern,
  WorkingMemoryEvent,
  UnifiedTask,
  SynthesisPatternType,
} from './types';

// Prevent client-side imports
ensureServerOnly('lib/cortex/pattern-learner');

// ============================================================================
// Constants
// ============================================================================

const SYNTHESIS_AGENT_ID: AgentId = 'orchestrator-agent';
const MIN_USAGE_FOR_PRUNING = 10;
const PRUNE_SUCCESS_THRESHOLD = 0.3;
const EMA_ALPHA = 0.1; // Exponential moving average weight for new data

// ============================================================================
// Database Row Types
// ============================================================================

interface SynthesisPatternRow {
  id: string;
  pattern_type: string;
  description: string;
  trigger_conditions: string;
  suggested_behavior: string;
  success_rate: number;
  usage_count: number;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Pattern Learner Class
// ============================================================================

/**
 * PatternLearner - Extracts and manages synthesis patterns
 *
 * This class learns from synthesis results and user corrections to continuously
 * improve the quality of cognitive synthesis.
 */
export class PatternLearner {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  /**
   * Learn patterns from a synthesis result
   *
   * Stores new patterns from LLM synthesis output in both database and Zep memory.
   * Also increments usage count for patterns that were successfully applied.
   */
  async learnFromSynthesis(result: SynthesisResult): Promise<void> {
    console.log(`[PatternLearner] Learning from synthesis result (${result.new_patterns.length} new patterns)`);

    const now = Math.floor(Date.now() / 1000);

    // Store each new pattern
    for (const patternData of result.new_patterns) {
      const patternId = `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const pattern: SynthesisPattern = {
        id: patternId,
        patternType: patternData.patternType,
        description: patternData.description,
        triggerConditions: patternData.triggerConditions,
        suggestedBehavior: patternData.suggestedBehavior,
        successRate: 0.5, // Start with neutral success rate
        usageCount: 0,
        learnedAt: new Date().toISOString(),
      };

      // Store in database
      await this.storePattern(pattern);

      // Store in Zep memory for long-term retention
      await this.storePatternInZep(pattern);

      console.log(`[PatternLearner] Learned new pattern: ${pattern.patternType} - "${pattern.description}"`);
    }

    // Update usage counts for patterns that were applied
    // (This would require tracking which patterns were actually used during synthesis)
    // For now, we'll increment on successful task creation
    if (result.unified_tasks.length > 0) {
      console.log(`[PatternLearner] ${result.unified_tasks.length} tasks created - patterns in use`);
    }
  }

  /**
   * Learn from user correction to generate anti-patterns
   *
   * When a user corrects a synthesized task, we learn what NOT to do
   * and feed this information to the EA preference model.
   */
  async learnFromCorrection(
    original: UnifiedTask,
    correction: {
      newTitle?: string;
      newAction?: string;
      newDomain?: Domain;
      dismissed?: boolean;
    }
  ): Promise<void> {
    console.log(`[PatternLearner] Learning from correction for task: ${original.id}`);

    const now = Math.floor(Date.now() / 1000);
    const timestamp = new Date().toISOString();

    // If task was dismissed, create a negative pattern
    if (correction.dismissed) {
      const antiPattern: Omit<SynthesisPattern, 'id' | 'learnedAt' | 'successRate' | 'usageCount'> = {
        patternType: 'consolidation',
        description: `Avoid: "${original.title}" (User dismissed)`,
        triggerConditions: {
          customCondition: `Task dismissed by user: ${original.description.substring(0, 100)}`,
        },
        suggestedBehavior: {
          customGuidance: 'Avoid synthesizing tasks with this pattern',
        },
      };

      const patternId = `anti_pattern_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fullPattern: SynthesisPattern = {
        ...antiPattern,
        id: patternId,
        successRate: 0.1, // Very low success rate for anti-patterns
        usageCount: 0,
        learnedAt: timestamp,
      };

      await this.storePattern(fullPattern);
      await this.storePatternInZep(fullPattern);

      console.log(`[PatternLearner] Created anti-pattern: ${fullPattern.description}`);
    }

    // Record correction in EA preference model
    if (correction.newDomain || correction.newTitle) {
      const originalDomain = original.domain as Domain;
      const correctedDomain = correction.newDomain || originalDomain;
      const originalUrgency = original.urgency as UrgencyLevel;

      await recordEAFeedback(
        original.id,
        {
          urgency: originalUrgency,
          domain: originalDomain,
          action: original.proposedAction?.type || 'unknown',
        },
        {
          urgency: originalUrgency, // Keep same unless specified
          domain: correctedDomain,
          action: correction.newAction || original.proposedAction?.type || 'unknown',
        },
        `User corrected synthesis${correction.newTitle ? `: ${correction.newTitle}` : ''}`,
        {
          type: 'task',
          summary: original.title,
          content: original.description,
        }
      );
    }

    // If specific attributes were changed, create improvement patterns
    if (correction.newTitle || correction.newAction) {
      const improvementPattern: Omit<SynthesisPattern, 'id' | 'learnedAt' | 'successRate' | 'usageCount'> = {
        patternType: 'action',
        description: `Prefer: ${correction.newTitle || correction.newAction}`,
        triggerConditions: {
          customCondition: `Similar to: ${original.description.substring(0, 100)}`,
        },
        suggestedBehavior: {
          customGuidance: correction.newTitle
            ? `Use title pattern: "${correction.newTitle}"`
            : `Use action: ${correction.newAction}`,
        },
      };

      const patternId = `improvement_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fullPattern: SynthesisPattern = {
        ...improvementPattern,
        id: patternId,
        successRate: 0.7, // Higher initial success for user-confirmed patterns
        usageCount: 0,
        learnedAt: timestamp,
      };

      await this.storePattern(fullPattern);
      await this.storePatternInZep(fullPattern);

      console.log(`[PatternLearner] Created improvement pattern: ${fullPattern.description}`);
    }
  }

  /**
   * Get relevant patterns for current event context
   *
   * Queries both database and Zep memory to find applicable patterns.
   */
  async getRelevantPatterns(events: WorkingMemoryEvent[]): Promise<SynthesisPattern[]> {
    console.log(`[PatternLearner] Finding relevant patterns for ${events.length} events`);

    const allPatterns: SynthesisPattern[] = [];

    // Extract event types and keywords for matching
    const eventSources = new Set(events.map(e => e.source));
    const eventTypes = events.map(e => e.initialClassification?.domain).filter(Boolean);

    // Query database for patterns matching event types
    const stmt = this.db.prepare(`
      SELECT * FROM synthesis_patterns
      WHERE pattern_type IN (${eventTypes.map(() => '?').join(',')})
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT 20
    `);

    try {
      const rows = eventTypes.length > 0
        ? stmt.all(...eventTypes) as SynthesisPatternRow[]
        : [];

      for (const row of rows) {
        allPatterns.push(this.rowToPattern(row));
      }
    } catch (error) {
      console.error('[PatternLearner] Database query failed:', error);
    }

    // Also search Zep memory for related patterns
    const eventKeywords = events
      .map(e => e.content.substring(0, 100))
      .join(' ')
      .split(/\s+/)
      .slice(0, 10)
      .join(' ');

    try {
      const zepResults = await searchAgentMemory(
        SYNTHESIS_AGENT_ID,
        `synthesis pattern ${eventKeywords}`,
        10
      );

      for (const result of zepResults) {
        if (result.memory.metadata?.type === 'synthesis_pattern') {
          const pattern = result.memory.metadata.pattern as SynthesisPattern;
          allPatterns.push(pattern);
        }
      }
    } catch (error) {
      console.error('[PatternLearner] Zep search failed:', error);
    }

    // Remove duplicates and sort by success rate
    const uniquePatterns = Array.from(
      new Map(allPatterns.map(p => [p.id, p])).values()
    ).sort((a, b) => b.successRate - a.successRate);

    console.log(`[PatternLearner] Found ${uniquePatterns.length} relevant patterns`);
    return uniquePatterns;
  }

  /**
   * Update pattern success rate based on outcome
   *
   * Uses exponential moving average to adjust success rate smoothly.
   */
  async updatePatternSuccess(patternId: string, success: boolean): Promise<void> {
    console.log(`[PatternLearner] Updating pattern ${patternId}: success=${success}`);

    const stmt = this.db.prepare(`
      SELECT success_rate, usage_count FROM synthesis_patterns WHERE id = ?
    `);

    const row = stmt.get(patternId) as { success_rate: number; usage_count: number } | undefined;

    if (!row) {
      console.warn(`[PatternLearner] Pattern not found: ${patternId}`);
      return;
    }

    // Calculate new success rate using exponential moving average
    const newRate = (1 - EMA_ALPHA) * row.success_rate + EMA_ALPHA * (success ? 1 : 0);
    const newUsageCount = row.usage_count + 1;

    const updateStmt = this.db.prepare(`
      UPDATE synthesis_patterns
      SET success_rate = ?,
          usage_count = ?,
          updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(newRate, newUsageCount, Math.floor(Date.now() / 1000), patternId);

    console.log(
      `[PatternLearner] Updated pattern ${patternId}: ` +
      `rate ${row.success_rate.toFixed(2)} → ${newRate.toFixed(2)}, ` +
      `usage ${row.usage_count} → ${newUsageCount}`
    );
  }

  /**
   * Prune low-performing patterns
   *
   * Removes patterns with low success rates and sufficient usage.
   * Patterns are archived (not deleted) for analysis.
   */
  async prunePatterns(): Promise<number> {
    console.log('[PatternLearner] Starting pattern pruning...');

    const stmt = this.db.prepare(`
      SELECT * FROM synthesis_patterns
      WHERE success_rate < ?
        AND usage_count > ?
    `);

    const rows = stmt.all(PRUNE_SUCCESS_THRESHOLD, MIN_USAGE_FOR_PRUNING) as SynthesisPatternRow[];

    if (rows.length === 0) {
      console.log('[PatternLearner] No patterns to prune');
      return 0;
    }

    // Archive patterns to Zep before removing
    for (const row of rows) {
      const pattern = this.rowToPattern(row);

      try {
        await addAgentMemory(
          SYNTHESIS_AGENT_ID,
          `[ARCHIVED PATTERN] ${pattern.description}`,
          {
            type: 'archived_pattern',
            pattern_type: pattern.patternType,
            success_rate: pattern.successRate,
            usage_count: pattern.usageCount,
            reason: 'Low success rate after significant usage',
            archived_at: new Date().toISOString(),
          }
        );
      } catch (error) {
        console.error(`[PatternLearner] Failed to archive pattern ${pattern.id}:`, error);
      }
    }

    // Remove from database
    const deleteStmt = this.db.prepare(`
      DELETE FROM synthesis_patterns
      WHERE success_rate < ?
        AND usage_count > ?
    `);

    const result = deleteStmt.run(PRUNE_SUCCESS_THRESHOLD, MIN_USAGE_FOR_PRUNING);

    console.log(`[PatternLearner] Pruned ${result.changes} low-performing patterns`);
    return result.changes || 0;
  }

  /**
   * Store pattern in database
   */
  private async storePattern(pattern: SynthesisPattern): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO synthesis_patterns (
        id, pattern_type, description, trigger_conditions, suggested_behavior,
        success_rate, usage_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Math.floor(Date.now() / 1000);

    stmt.run(
      pattern.id,
      pattern.patternType,
      pattern.description,
      JSON.stringify(pattern.triggerConditions),
      JSON.stringify(pattern.suggestedBehavior),
      pattern.successRate,
      pattern.usageCount,
      now,
      now
    );
  }

  /**
   * Store pattern in Zep memory
   */
  private async storePatternInZep(pattern: SynthesisPattern): Promise<void> {
    const text = `[SYNTHESIS PATTERN] ${pattern.patternType}: ${pattern.description}
Triggers: ${JSON.stringify(pattern.triggerConditions, null, 2)}
Behavior: ${JSON.stringify(pattern.suggestedBehavior, null, 2)}`;

    await addAgentMemory(SYNTHESIS_AGENT_ID, text, {
      type: 'synthesis_pattern',
      pattern_id: pattern.id,
      pattern_type: pattern.patternType,
      success_rate: pattern.successRate,
      usage_count: pattern.usageCount,
      learned_at: pattern.learnedAt,
    });
  }

  /**
   * Convert database row to SynthesisPattern
   */
  private rowToPattern(row: SynthesisPatternRow): SynthesisPattern {
    return {
      id: row.id,
      patternType: row.pattern_type as SynthesisPatternType,
      description: row.description,
      triggerConditions: JSON.parse(row.trigger_conditions),
      suggestedBehavior: JSON.parse(row.suggested_behavior),
      successRate: row.success_rate,
      usageCount: row.usage_count,
      learnedAt: new Date(row.created_at * 1000).toISOString(),
    };
  }
}

// ============================================================================
// Meta-Improver Class (Daily Meta-Synthesis)
// ============================================================================

/**
 * MetaImprover - Analyzes patterns at a meta level
 *
 * Runs daily to identify high-success patterns, generate synthesis style guides,
 * and create meta-patterns for improved synthesis.
 */
export class MetaImprover {
  private db: Database;
  private patternLearner: PatternLearner;

  constructor() {
    this.db = Database.getInstance();
    this.patternLearner = new PatternLearner();
  }

  /**
   * Run daily meta-analysis of all patterns
   *
   * Identifies high-success patterns to promote and generates synthesis guidelines.
   */
  async runMetaAnalysis(): Promise<void> {
    console.log('[MetaImprover] Starting daily meta-analysis...');

    const analysisTimestamp = new Date().toISOString();

    // Get all patterns with statistics
    const patterns = await this.getAllPatternStats();

    // Identify high-success patterns (success rate > 0.7, usage > 5)
    const highSuccessPatterns = patterns.filter(
      p => p.success_rate > 0.7 && p.usage_count > 5
    );

    // Identify low-success patterns for review
    const lowSuccessPatterns = patterns.filter(
      p => p.success_rate < 0.4 && p.usage_count > 3
    );

    // Generate meta-patterns from high-success patterns
    await this.generateMetaPatterns(highSuccessPatterns);

    // Generate synthesis style guide
    await this.generateStyleGuide(highSuccessPatterns, lowSuccessPatterns);

    // Store meta-analysis summary in Zep
    await this.storeMetaAnalysisSummary({
      timestamp: analysisTimestamp,
      totalPatterns: patterns.length,
      highSuccessCount: highSuccessPatterns.length,
      lowSuccessCount: lowSuccessPatterns.length,
      avgSuccessRate: patterns.reduce((sum, p) => sum + p.success_rate, 0) / patterns.length,
      avgUsageCount: patterns.reduce((sum, p) => sum + p.usage_count, 0) / patterns.length,
    });

    console.log('[MetaImprover] Meta-analysis complete');
  }

  /**
   * Get statistics for all patterns
   */
  private async getAllPatternStats(): Promise<SynthesisPatternRow[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM synthesis_patterns
      ORDER BY success_rate DESC, usage_count DESC
    `);

    return stmt.all() as SynthesisPatternRow[];
  }

  /**
   * Generate meta-patterns from high-success patterns
   *
   * Meta-patterns are generalizations of successful specific patterns.
   */
  private async generateMetaPatterns(highSuccessPatterns: SynthesisPatternRow[]): Promise<void> {
    if (highSuccessPatterns.length === 0) {
      console.log('[MetaImprover] No high-success patterns to promote');
      return;
    }

    // Group by pattern type
    const byType = new Map<string, SynthesisPatternRow[]>();
    for (const pattern of highSuccessPatterns) {
      const existing = byType.get(pattern.pattern_type) || [];
      existing.push(pattern);
      byType.set(pattern.pattern_type, existing);
    }

    // For each type, create a meta-pattern summarizing the successful approach
    for (const [patternType, patterns] of Array.from(byType.entries())) {
      const avgSuccessRate = patterns.reduce((sum, p) => sum + p.success_rate, 0) / patterns.length;
      const totalUsage = patterns.reduce((sum, p) => sum + p.usage_count, 0);

      const metaPattern: Omit<SynthesisPattern, 'id' | 'learnedAt' | 'successRate' | 'usageCount'> = {
        patternType: patternType as SynthesisPatternType,
        description: `Meta-pattern: High-success ${patternType} strategies (${patterns.length} patterns)`,
        triggerConditions: {
          customCondition: `Generalized from ${patterns.length} successful ${patternType} patterns`,
        },
        suggestedBehavior: {
          customGuidance: patterns.map(p => p.description).join('; '),
        },
      };

      const patternId = `meta_${patternType}_${Date.now()}`;
      const fullPattern: SynthesisPattern = {
        ...metaPattern,
        id: patternId,
        successRate: avgSuccessRate,
        usageCount: Math.floor(totalUsage / patterns.length),
        learnedAt: new Date().toISOString(),
      };

      await this.patternLearner.learnFromSynthesis({
        synthesis_summary: `Meta-pattern promotion for ${patternType}`,
        unified_tasks: [],
        task_updates: [],
        proposed_actions: [],
        new_patterns: [fullPattern],
        events_fully_processed: [],
        needs_more_context: [],
      });

      console.log(`[MetaImprover] Created meta-pattern for ${patternType}: ${avgSuccessRate.toFixed(2)} success rate`);
    }
  }

  /**
   * Generate synthesis style guide from pattern analysis
   */
  private async generateStyleGuide(
    highSuccess: SynthesisPatternRow[],
    lowSuccess: SynthesisPatternRow[]
  ): Promise<void> {
    const styleGuide = {
      generated_at: new Date().toISOString(),
      high_success_strategies: highSuccess.slice(0, 10).map(p => ({
        type: p.pattern_type,
        description: p.description,
        success_rate: p.success_rate,
      })),
      patterns_to_avoid: lowSuccess.slice(0, 5).map(p => ({
        type: p.pattern_type,
        description: p.description,
        success_rate: p.success_rate,
      })),
      recommendations: this.generateRecommendations(highSuccess, lowSuccess),
    };

    // Store in Zep as synthesis guidance
    await addAgentMemory(
      SYNTHESIS_AGENT_ID,
      `[SYNTHESIS STYLE GUIDE] Generated ${styleGuide.generated_at}
High-Success Strategies: ${JSON.stringify(styleGuide.high_success_strategies, null, 2)}
Avoid: ${JSON.stringify(styleGuide.patterns_to_avoid, null, 2)}
Recommendations: ${styleGuide.recommendations.join('; ')}`,
      {
        type: 'style_guide',
        generated_at: styleGuide.generated_at,
        high_success_count: styleGuide.high_success_strategies.length,
        avoid_count: styleGuide.patterns_to_avoid.length,
      }
    );

    console.log('[MetaImprover] Generated synthesis style guide');
  }

  /**
   * Generate recommendations based on pattern analysis
   */
  private generateRecommendations(
    highSuccess: SynthesisPatternRow[],
    lowSuccess: SynthesisPatternRow[]
  ): string[] {
    const recommendations: string[] = [];

    // Recommendation based on high-success patterns
    if (highSuccess.length > 0) {
      const topType = highSuccess[0].pattern_type;
      recommendations.push(
        `Focus on ${topType} patterns - consistently high success rate`
      );
    }

    // Recommendation based on low-success patterns
    if (lowSuccess.length > 0) {
      const worstType = lowSuccess[0].pattern_type;
      recommendations.push(
        `Review ${worstType} patterns - may need refinement or removal`
      );
    }

    // General recommendations
    if (highSuccess.length > 10) {
      recommendations.push(
        'Strong pattern library established - consider more aggressive synthesis'
      );
    } else {
      recommendations.push(
        'Pattern library still developing - maintain conservative synthesis approach'
      );
    }

    return recommendations;
  }

  /**
   * Store meta-analysis summary
   */
  private async storeMetaAnalysisSummary(summary: {
    timestamp: string;
    totalPatterns: number;
    highSuccessCount: number;
    lowSuccessCount: number;
    avgSuccessRate: number;
    avgUsageCount: number;
  }): Promise<void> {
    await addAgentMemory(
      SYNTHESIS_AGENT_ID,
      `[META-ANALYSIS] ${summary.timestamp}
Total Patterns: ${summary.totalPatterns}
High Success: ${summary.highSuccessCount}
Low Success: ${summary.lowSuccessCount}
Avg Success Rate: ${summary.avgSuccessRate.toFixed(2)}
Avg Usage Count: ${summary.avgUsageCount.toFixed(0)}`,
      {
        type: 'meta_analysis',
        timestamp: summary.timestamp,
        total_patterns: summary.totalPatterns,
        high_success_count: summary.highSuccessCount,
        low_success_count: summary.lowSuccessCount,
        avg_success_rate: summary.avgSuccessRate,
        avg_usage_count: summary.avgUsageCount,
      }
    );
  }
}

// ============================================================================
// Singleton Exports
// ============================================================================

/**
 * Singleton PatternLearner instance
 */
const patternLearner = new PatternLearner();

export default patternLearner;

// Named exports for convenience
export const learnFromSynthesis = (result: SynthesisResult) =>
  patternLearner.learnFromSynthesis(result);

export const learnFromCorrection = (
  original: UnifiedTask,
  correction: {
    newTitle?: string;
    newAction?: string;
    newDomain?: Domain;
    dismissed?: boolean;
  }
) => patternLearner.learnFromCorrection(original, correction);

export const getRelevantPatterns = (events: WorkingMemoryEvent[]) =>
  patternLearner.getRelevantPatterns(events);

export const updatePatternSuccess = (patternId: string, success: boolean) =>
  patternLearner.updatePatternSuccess(patternId, success);

export const prunePatterns = () => patternLearner.prunePatterns();
