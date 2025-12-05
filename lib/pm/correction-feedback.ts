/**
 * Correction Feedback Loop
 *
 * Learns from user corrections to improve future suggestions:
 * - Records when AI suggestions were wrong
 * - Analyzes patterns in corrections
 * - Adjusts pattern confidence weights
 * - Creates counter-patterns
 * - Tracks accuracy metrics
 *
 * This is the key to making the system smarter over time.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getDatabase } from '../db/Database';
import { recordFact, queryFacts, getCurrentState } from './temporal-memory';
import { getPattern, type Pattern } from './pattern-extraction';
import crypto from 'crypto';

ensureServerOnly('lib/pm/correction-feedback');

// ============================================================================
// Types
// ============================================================================

export interface Correction {
  id: string;
  correction_type: CorrectionType;

  // What was wrong
  original_entity_type: string;
  original_entity_id: string;
  original_value: string;  // JSON

  // What was correct
  corrected_value: string;  // JSON

  // Context (why was it wrong?)
  context: string;  // JSON: task state, patterns used, features, etc.
  reason?: string;  // Optional: user explanation

  recorded_at: number;
}

export type CorrectionType =
  | 'priority'
  | 'assignment'
  | 'routing'
  | 'suggestion'
  | 'pattern';

export interface AccuracyMetrics {
  total_suggestions: number;
  accepted_suggestions: number;
  corrected_suggestions: number;
  accuracy_rate: number;

  by_type: Record<string, {
    total: number;
    accepted: number;
    accuracy: number;
  }>;

  trend: {
    last_7_days: number;
    last_30_days: number;
    direction: 'improving' | 'declining' | 'stable';
  };
}

// ============================================================================
// Database Schema
// ============================================================================

function ensureCorrectionsTable(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      correction_type TEXT NOT NULL,

      original_entity_type TEXT NOT NULL,
      original_entity_id TEXT NOT NULL,
      original_value TEXT NOT NULL,

      corrected_value TEXT NOT NULL,

      context TEXT NOT NULL,
      reason TEXT,

      recorded_at INTEGER NOT NULL,

      CHECK (correction_type IN ('priority', 'assignment', 'routing', 'suggestion', 'pattern'))
    );

    CREATE INDEX IF NOT EXISTS idx_corrections_type
      ON corrections(correction_type);
    CREATE INDEX IF NOT EXISTS idx_corrections_entity
      ON corrections(original_entity_type, original_entity_id);
    CREATE INDEX IF NOT EXISTS idx_corrections_time
      ON corrections(recorded_at);
  `);

  // Feature weights table (for learning)
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_weights (
      feature_key TEXT NOT NULL,
      correction_type TEXT NOT NULL,
      target_value TEXT NOT NULL,
      weight INTEGER DEFAULT 1,

      PRIMARY KEY (feature_key, correction_type, target_value)
    );

    CREATE INDEX IF NOT EXISTS idx_feature_weights_type
      ON feature_weights(correction_type);
  `);
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Record a correction
 */
export async function recordCorrection(params: {
  correction_type: CorrectionType;
  original_entity_type: string;
  original_entity_id: string;
  original_value: any;
  corrected_value: any;
  context?: Record<string, unknown>;
  reason?: string;
}): Promise<Correction> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  const id = `corr_${now}_${crypto.randomBytes(4).toString('hex')}`;
  const correction: Correction = {
    id,
    correction_type: params.correction_type,
    original_entity_type: params.original_entity_type,
    original_entity_id: params.original_entity_id,
    original_value: JSON.stringify(params.original_value),
    corrected_value: JSON.stringify(params.corrected_value),
    context: JSON.stringify(params.context || {}),
    reason: params.reason,
    recorded_at: now
  };

  db.prepare(`
    INSERT INTO corrections (
      id, correction_type, original_entity_type, original_entity_id,
      original_value, corrected_value, context, reason, recorded_at
    ) VALUES (
      @id, @correction_type, @original_entity_type, @original_entity_id,
      @original_value, @corrected_value, @context, @reason, @recorded_at
    )
  `).run(correction);

  console.log(`[CorrectionFeedback] Recorded correction: ${params.correction_type} for ${params.original_entity_type}/${params.original_entity_id}`);

  return correction;
}

/**
 * Learn from corrections (main learning function)
 */
export async function learnFromCorrections(): Promise<{
  patterns_adjusted: number;
  features_learned: number;
  counter_patterns_created: number;
}> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  let patternsAdjusted = 0;
  let featuresLearned = 0;
  let counterPatternsCreated = 0;

  // Get recent corrections (last 30 days)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
  const corrections = db.prepare(`
    SELECT * FROM corrections
    WHERE recorded_at > ?
    ORDER BY recorded_at DESC
  `).all(thirtyDaysAgo) as any[];

  console.log(`[CorrectionFeedback] Learning from ${corrections.length} corrections...`);

  for (const correction of corrections) {
    const context = JSON.parse(correction.context);

    // Strategy 1: Adjust pattern confidence
    if (context.based_on_patterns && Array.isArray(context.based_on_patterns)) {
      for (const patternId of context.based_on_patterns) {
        const adjusted = await adjustPatternConfidence(patternId, 0.9);  // Reduce by 10%
        if (adjusted) patternsAdjusted++;
      }
    }

    // Strategy 2: Learn feature weights
    const features = extractFeatures(context);
    for (const [feature, value] of Object.entries(features)) {
      await updateFeatureWeight(
        correction.correction_type,
        `${feature}:${value}`,
        JSON.parse(correction.corrected_value)
      );
      featuresLearned++;
    }

    // Strategy 3: Create counter-pattern if repeated correction
    const repeated = await isRepeatedCorrection(correction);
    if (repeated) {
      await createCounterPattern(correction);
      counterPatternsCreated++;
    }
  }

  console.log(`[CorrectionFeedback] Learning complete: ${patternsAdjusted} patterns adjusted, ${featuresLearned} features learned, ${counterPatternsCreated} counter-patterns created`);

  return {
    patterns_adjusted: patternsAdjusted,
    features_learned: featuresLearned,
    counter_patterns_created: counterPatternsCreated
  };
}

/**
 * Adjust pattern confidence based on correction
 */
async function adjustPatternConfidence(
  pattern_id: string,
  multiplier: number
): Promise<boolean> {
  const pattern = await getPattern(pattern_id);
  if (!pattern) {
    return false;
  }

  const newConfidence = Math.max(pattern.confidence * multiplier, 0.1);  // Min 0.1

  // Update pattern fact
  await recordFact({
    entity_type: 'pattern',
    entity_id: pattern_id,
    attribute: 'confidence',
    value: newConfidence,
    source: 'system',
    metadata: {
      previous_confidence: pattern.confidence,
      reason: 'Adjusted due to correction',
      multiplier
    }
  });

  console.log(`[CorrectionFeedback] Adjusted pattern ${pattern_id} confidence: ${pattern.confidence.toFixed(2)} -> ${newConfidence.toFixed(2)}`);

  return true;
}

/**
 * Extract features from context
 */
function extractFeatures(context: Record<string, unknown>): Record<string, any> {
  const features: Record<string, any> = {};

  // Extract relevant features that might predict the correct value
  if (context.priority) features.priority = context.priority;
  if (context.project) features.project = context.project;
  if (context.labels && Array.isArray(context.labels)) {
    for (const label of context.labels) {
      features[`label_${label}`] = true;
    }
  }
  if (context.assignee) features.assignee = context.assignee;
  if (context.source) features.source = context.source;

  return features;
}

/**
 * Update feature weight for a correction type and target value
 */
async function updateFeatureWeight(
  correction_type: string,
  feature_key: string,
  target_value: any
): Promise<void> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  const targetValueStr = JSON.stringify(target_value);

  db.prepare(`
    INSERT INTO feature_weights (feature_key, correction_type, target_value, weight)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(feature_key, correction_type, target_value)
    DO UPDATE SET weight = weight + 1
  `).run(feature_key, correction_type, targetValueStr);
}

/**
 * Check if this is a repeated correction pattern
 */
async function isRepeatedCorrection(correction: Correction): Promise<boolean> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  // Count similar corrections
  const count = db.prepare(`
    SELECT COUNT(*) as count
    FROM corrections
    WHERE correction_type = ?
      AND original_value = ?
      AND corrected_value = ?
  `).get(
    correction.correction_type,
    correction.original_value,
    correction.corrected_value
  ) as any;

  return count.count >= 3;  // 3+ identical corrections = pattern
}

/**
 * Create a counter-pattern from repeated corrections
 */
async function createCounterPattern(correction: Correction): Promise<void> {
  const context = JSON.parse(correction.context);
  const features = extractFeatures(context);

  const pattern_id = `correction_rule_${correction.correction_type}_${crypto.randomBytes(4).toString('hex')}`;

  await recordFact({
    entity_type: 'pattern',
    entity_id: pattern_id,
    attribute: 'target_value',
    value: JSON.parse(correction.corrected_value),
    source: 'system',
    confidence: 0.7,  // Start with moderate confidence
    metadata: {
      pattern_type: 'correction_rule',
      correction_type: correction.correction_type,
      features,
      wrong_value: JSON.parse(correction.original_value),
      created_from_correction: correction.id,
      sample_size: 1
    }
  });

  console.log(`[CorrectionFeedback] Created counter-pattern: ${pattern_id}`);
}

/**
 * Get accuracy metrics
 */
export async function getAccuracyMetrics(): Promise<AccuracyMetrics> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  // Get total suggestions (from temporal_facts where source = 'ai_suggestion')
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

  const totalSuggestions = db.prepare(`
    SELECT COUNT(*) as count
    FROM temporal_facts
    WHERE source = 'ai_suggestion'
      AND recorded_at > ?
  `).get(thirtyDaysAgo) as any;

  const totalCorrections = db.prepare(`
    SELECT COUNT(*) as count
    FROM corrections
    WHERE recorded_at > ?
  `).get(thirtyDaysAgo) as any;

  const total = totalSuggestions.count;
  const corrected = totalCorrections.count;
  const accepted = total - corrected;
  const accuracyRate = total > 0 ? accepted / total : 0;

  // Get by type
  const byTypeData = db.prepare(`
    SELECT
      correction_type,
      COUNT(*) as count
    FROM corrections
    WHERE recorded_at > ?
    GROUP BY correction_type
  `).all(thirtyDaysAgo) as any[];

  const byType: Record<string, { total: number; accepted: number; accuracy: number }> = {};

  for (const row of byTypeData) {
    const typeTotal = db.prepare(`
      SELECT COUNT(*) as count
      FROM temporal_facts
      WHERE source = 'ai_suggestion'
        AND recorded_at > ?
        AND json_extract(metadata, '$.suggestion_type') = ?
    `).get(thirtyDaysAgo, row.correction_type) as any;

    const typeAccepted = typeTotal.count - row.count;
    const typeAccuracy = typeTotal.count > 0 ? typeAccepted / typeTotal.count : 0;

    byType[row.correction_type] = {
      total: typeTotal.count,
      accepted: typeAccepted,
      accuracy: typeAccuracy
    };
  }

  // Calculate trend
  const last7days = await calculateAccuracyForPeriod(7);
  const last30days = await calculateAccuracyForPeriod(30);

  const direction = last7days > last30days + 0.05 ? 'improving'
    : last7days < last30days - 0.05 ? 'declining'
    : 'stable';

  return {
    total_suggestions: total,
    accepted_suggestions: accepted,
    corrected_suggestions: corrected,
    accuracy_rate: accuracyRate,
    by_type: byType,
    trend: {
      last_7_days: last7days,
      last_30_days: last30days,
      direction
    }
  };
}

/**
 * Calculate accuracy for a specific period
 */
async function calculateAccuracyForPeriod(days: number): Promise<number> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);

  const suggestions = db.prepare(`
    SELECT COUNT(*) as count
    FROM temporal_facts
    WHERE source = 'ai_suggestion'
      AND recorded_at > ?
  `).get(cutoff) as any;

  const corrections = db.prepare(`
    SELECT COUNT(*) as count
    FROM corrections
    WHERE recorded_at > ?
  `).get(cutoff) as any;

  const total = suggestions.count;
  const corrected = corrections.count;
  const accepted = total - corrected;

  return total > 0 ? accepted / total : 0;
}

/**
 * Get feature weights for prediction
 */
export function getFeatureWeights(
  correction_type: CorrectionType,
  features: Record<string, any>
): Record<string, number> {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  const weights: Record<string, number> = {};

  for (const [feature, value] of Object.entries(features)) {
    const featureKey = `${feature}:${value}`;

    const rows = db.prepare(`
      SELECT target_value, weight
      FROM feature_weights
      WHERE correction_type = ? AND feature_key = ?
      ORDER BY weight DESC
    `).all(correction_type, featureKey) as any[];

    for (const row of rows) {
      const targetValue = row.target_value;
      weights[targetValue] = (weights[targetValue] || 0) + row.weight;
    }
  }

  return weights;
}

/**
 * Apply feature-based prediction
 */
export async function predictWithFeatures(
  correction_type: CorrectionType,
  context: Record<string, unknown>
): Promise<{ value: any; confidence: number } | null> {
  const features = extractFeatures(context);
  const weights = getFeatureWeights(correction_type, features);

  if (Object.keys(weights).length === 0) {
    return null;  // No learned features
  }

  // Find most weighted value
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const topValue = entries[0][0];
  const topWeight = entries[0][1];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);

  const confidence = topWeight / totalWeight;

  return {
    value: JSON.parse(topValue),
    confidence
  };
}

/**
 * Get corrections for an entity
 */
export function getEntityCorrections(
  entity_type: string,
  entity_id: string
): Correction[] {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  const rows = db.prepare(`
    SELECT * FROM corrections
    WHERE original_entity_type = ? AND original_entity_id = ?
    ORDER BY recorded_at DESC
  `).all(entity_type, entity_id) as any[];

  return rows;
}

/**
 * Get recent corrections
 */
export function getRecentCorrections(
  limit: number = 20,
  correction_type?: CorrectionType
): Correction[] {
  ensureCorrectionsTable();
  const db = getDatabase().getRawDb();

  let sql = 'SELECT * FROM corrections WHERE 1=1';
  const params: any[] = [];

  if (correction_type) {
    sql += ' AND correction_type = ?';
    params.push(correction_type);
  }

  sql += ' ORDER BY recorded_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as any[];

  return rows;
}
