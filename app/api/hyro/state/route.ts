/**
 * HYRO FORGE: State Vector API
 * Get and update student state vectors (C, E, G manifold positions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';
import { aggregateEvaluations, type EvaluationResult } from '@/lib/hyro/forge-evaluator';

// ============================================================================
// GET: Retrieve state vectors and meta dimensions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const { searchParams } = new URL(request.url);
    const stat = searchParams.get('stat');
    const action = searchParams.get('action');

    const db = getDatabase();

    // Get meta dimension estimates
    if (action === 'meta') {
      const dimensions = db.prepare(`
        SELECT * FROM hyro_meta_dimension_estimates
        WHERE student_id = ?
        ORDER BY dimension_name
      `).all(studentId);

      return NextResponse.json({
        student_id: studentId,
        dimensions: dimensions.length > 0 ? dimensions : getDefaultMetaDimensions(studentId),
        message: dimensions.length > 0 ? 'Meta dimensions retrieved' : 'Returning defaults - no assessments yet',
      });
    }

    // Get state vector for specific stat
    if (stat) {
      const vector = db.prepare(`
        SELECT * FROM hyro_state_vectors
        WHERE student_id = ? AND stat_name = ?
      `).get(studentId, stat);

      if (!vector) {
        return NextResponse.json({
          student_id: studentId,
          stat_name: stat,
          vector: getDefaultStateVector(studentId, stat),
          message: 'Returning default - no assessment data yet',
        });
      }

      return NextResponse.json({
        student_id: studentId,
        stat_name: stat,
        vector,
      });
    }

    // Get full manifold (all state vectors)
    if (action === 'manifold') {
      const vectors = db.prepare(`
        SELECT * FROM hyro_state_vectors
        WHERE student_id = ?
        ORDER BY stat_name
      `).all(studentId);

      const metaDimensions = db.prepare(`
        SELECT * FROM hyro_meta_dimension_estimates
        WHERE student_id = ?
        ORDER BY dimension_name
      `).all(studentId);

      // Calculate aggregate position in manifold
      const aggregateVector = calculateAggregateVector(vectors);

      // Calculate predicted aggregate from reflections (Calibration)
      const recentReflections = db.prepare(`
        SELECT confidence_rating, actual_performance, created_at
        FROM hyro_reflections
        WHERE student_id = ? AND confidence_rating IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      `).all(studentId);

      const predictedVector = calculatePredictedVector(recentReflections);

      return NextResponse.json({
        student_id: studentId,
        domain_vectors: vectors.length > 0 ? vectors : getDefaultVectors(studentId),
        meta_dimensions: metaDimensions.length > 0 ? metaDimensions : getDefaultMetaDimensions(studentId),
        aggregate: aggregateVector,
        predicted_aggregate: predictedVector,
        domains_assessed: vectors.length,
        message: vectors.length > 0 ? 'Full manifold retrieved' : 'Returning defaults - complete diagnostic to populate',
      });
    }

    // Get recent evaluation history
    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const responses = db.prepare(`
        SELECT
          r.id,
          r.item_id,
          r.score_validity,
          r.score_coherence,
          r.score_transfer,
          r.score_utility,
          r.score_efficiency,
          r.meta_manifold_fluidity,
          r.meta_multi_model_coherence,
          r.meta_identity_elasticity,
          r.created_at,
          i.stat_name,
          i.item_type
        FROM hyro_diagnostic_responses_v2 r
        LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
        WHERE r.student_id = ? AND r.llm_evaluation IS NOT NULL
        ORDER BY r.created_at DESC
        LIMIT ?
      `).all(studentId, limit);

      return NextResponse.json({
        student_id: studentId,
        evaluations: responses,
        count: responses.length,
      });
    }

    // Default: return all state vectors
    const vectors = db.prepare(`
      SELECT * FROM hyro_state_vectors
      WHERE student_id = ?
      ORDER BY updated_at DESC
    `).all(studentId);

    return NextResponse.json({
      student_id: studentId,
      vectors: vectors.length > 0 ? vectors : getDefaultVectors(studentId),
      count: vectors.length,
    });
  } catch (error) {
    console.error('State GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch state' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Update state vectors from evaluations
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const body = await request.json();
    const { action } = body;

    const db = getDatabase();

    // Recalculate state vectors from all evaluations
    if (action === 'recalculate') {
      const stat = body.stat;

      // Get all evaluations for this student (and optionally stat)
      let query = `
        SELECT r.llm_evaluation, i.stat_name
        FROM hyro_diagnostic_responses_v2 r
        LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
        WHERE r.student_id = ? AND r.llm_evaluation IS NOT NULL
      `;
      const params: any[] = [studentId];

      if (stat) {
        query += ` AND i.stat_name = ?`;
        params.push(stat);
      }

      const responses = db.prepare(query).all(...params) as any[];

      // Group by stat
      const evaluationsBystat: Record<string, EvaluationResult[]> = {};
      for (const r of responses) {
        if (!r.llm_evaluation) continue;
        const statName = r.stat_name || 'general';
        if (!evaluationsBystat[statName]) {
          evaluationsBystat[statName] = [];
        }
        try {
          evaluationsBystat[statName].push(JSON.parse(r.llm_evaluation));
        } catch (e) {
          // Skip invalid JSON
        }
      }

      // Calculate and upsert state vectors
      const updatedStats: string[] = [];
      for (const [statName, evaluations] of Object.entries(evaluationsBystat)) {
        if (evaluations.length === 0) continue;

        const aggregated = aggregateEvaluations(evaluations);
        upsertStateVector(db, studentId, statName, aggregated);
        updatedStats.push(statName);
      }

      // Also update meta dimensions from all evaluations
      const allEvaluations: EvaluationResult[] = Object.values(evaluationsBystat).flat();
      updateMetaDimensions(db, studentId, allEvaluations);

      return NextResponse.json({
        message: 'State vectors recalculated',
        updated_stats: updatedStats,
        total_evaluations: responses.length,
      });
    }

    // Update single state vector manually (admin use)
    if (action === 'set') {
      const { stat_name, coherence, entropy, generativity } = body;

      if (!stat_name) {
        return NextResponse.json({ error: 'stat_name is required' }, { status: 400 });
      }

      upsertStateVector(db, studentId, stat_name, {
        coherence: coherence ?? 50,
        entropy: entropy ?? 50,
        generativity: generativity ?? 50,
        ci_low: 0,
        ci_high: 100,
        n_items: 0,
        signal_agreement: 0,
      });

      return NextResponse.json({
        message: `State vector set for ${stat_name}`,
        stat_name,
        coherence,
        entropy,
        generativity,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('State POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update state' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultStateVector(studentId: string, statName: string) {
  return {
    id: `sv_${studentId}_${statName}_default`,
    student_id: studentId,
    stat_name: statName,
    coherence: 50,
    entropy: 50,
    generativity: 50,
    components_json: '{}',
    ci_low: 0,
    ci_high: 100,
    n_items_used: 0,
    signal_agreement: 0,
  };
}

function getDefaultVectors(studentId: string) {
  const stats = ['math', 'reading', 'science', 'coding', 'study_skills', 'critical_thinking', 'technology', 'problem_solving'];
  return stats.map(stat => getDefaultStateVector(studentId, stat));
}

function getDefaultMetaDimensions(studentId: string) {
  const dimensions = [
    'manifold_fluidity',
    'multi_model_coherence',
    'identity_elasticity',
    'gradient_awareness',
    'entropy_intuition',
    'non_dual_resolution',
    'cooperative_generativity',
  ];

  return dimensions.map(dim => ({
    id: `meta_${studentId}_${dim}_default`,
    student_id: studentId,
    dimension_name: dim,
    score: 50,
    ci_low: 0,
    ci_high: 100,
    evidence_json: null,
    n_observations: 0,
    confidence_level: 'low',
  }));
}

function calculateAggregateVector(vectors: any[]) {
  if (vectors.length === 0) {
    return { coherence: 50, entropy: 50, generativity: 50, ci_width: 100 };
  }

  const sumC = vectors.reduce((s, v) => s + (v.coherence || 50), 0);
  const sumE = vectors.reduce((s, v) => s + (v.entropy || 50), 0);
  const sumG = vectors.reduce((s, v) => s + (v.generativity || 50), 0);
  const sumCI = vectors.reduce((s, v) => s + ((v.ci_high || 100) - (v.ci_low || 0)), 0);

  return {
    coherence: Math.round(sumC / vectors.length * 10) / 10,
    entropy: Math.round(sumE / vectors.length * 10) / 10,
    generativity: Math.round(sumG / vectors.length * 10) / 10,
    ci_width: Math.round(sumCI / vectors.length * 10) / 10,
  };
}

function calculatePredictedVector(reflections: any[]) {
  if (reflections.length === 0) {
    // Default to balanced state if no data
    return { coherence: 60, entropy: 60, generativity: 60 };
  }

  // Map confidence (0-100) to state vector components
  // High confidence -> High Coherence
  // Medium confidence -> Balanced
  // Low confidence -> High Entropy (uncertainty/openness)

  const sumConfidence = reflections.reduce((s, r) => s + (r.confidence_rating || 50), 0);
  const avgConfidence = sumConfidence / reflections.length;

  // Calculate variance in confidence for Entropy
  const variance = reflections.reduce((s, r) => s + Math.pow((r.confidence_rating || 50) - avgConfidence, 2), 0) / reflections.length;
  const stdDev = Math.sqrt(variance);

  return {
    // Coherence tracks with raw confidence
    coherence: Math.round(avgConfidence),

    // Entropy is higher when confidence is lower OR when confidence varies wildly (uncertainty)
    entropy: Math.round(100 - avgConfidence + (stdDev * 0.5)),

    // Generativity tracks with actual performance if available, or slightly lags confidence
    generativity: Math.round(avgConfidence * 0.9 + 10),
  };
}

function upsertStateVector(
  db: any,
  studentId: string,
  statName: string,
  data: {
    coherence: number;
    entropy: number;
    generativity: number;
    ci_low: number;
    ci_high: number;
    n_items: number;
    signal_agreement: number;
  }
) {
  const id = `sv_${studentId}_${statName}`;
  const existing = db.prepare(`SELECT id FROM hyro_state_vectors WHERE id = ?`).get(id);

  if (existing) {
    db.prepare(`
      UPDATE hyro_state_vectors SET
        coherence = ?,
        entropy = ?,
        generativity = ?,
        ci_low = ?,
        ci_high = ?,
        n_items_used = ?,
        signal_agreement = ?,
        updated_at = unixepoch()
      WHERE id = ?
    `).run(
      data.coherence,
      data.entropy,
      data.generativity,
      data.ci_low,
      data.ci_high,
      data.n_items,
      data.signal_agreement,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO hyro_state_vectors (
        id, student_id, stat_name, coherence, entropy, generativity,
        components_json, ci_low, ci_high, n_items_used, signal_agreement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      studentId,
      statName,
      data.coherence,
      data.entropy,
      data.generativity,
      '{}',
      data.ci_low,
      data.ci_high,
      data.n_items,
      data.signal_agreement
    );
  }
}

function updateMetaDimensions(db: any, studentId: string, evaluations: EvaluationResult[]) {
  if (evaluations.length === 0) return;

  const dimensions = [
    'manifold_fluidity',
    'multi_model_coherence',
    'identity_elasticity',
    'gradient_awareness',
    'entropy_intuition',
    'non_dual_resolution',
    'cooperative_generativity',
  ];

  for (const dim of dimensions) {
    // Collect all non-zero scores for this dimension
    const scores = evaluations
      .map(e => (e.meta as any)[dim])
      .filter(s => typeof s === 'number' && s > 0);

    if (scores.length === 0) continue;

    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const std = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length);
    const ci = 1.96 * std / Math.sqrt(scores.length);

    const id = `meta_${studentId}_${dim}`;
    const existing = db.prepare(`SELECT id FROM hyro_meta_dimension_estimates WHERE id = ?`).get(id);

    const score = Math.round(mean * 100);
    const ciLow = Math.max(0, Math.round((mean - ci) * 100));
    const ciHigh = Math.min(100, Math.round((mean + ci) * 100));
    const confidenceLevel = scores.length >= 5 ? 'high' : scores.length >= 2 ? 'medium' : 'low';

    if (existing) {
      db.prepare(`
        UPDATE hyro_meta_dimension_estimates SET
          score = ?,
          ci_low = ?,
          ci_high = ?,
          n_observations = ?,
          confidence_level = ?,
          updated_at = unixepoch()
        WHERE id = ?
      `).run(score, ciLow, ciHigh, scores.length, confidenceLevel, id);
    } else {
      db.prepare(`
        INSERT INTO hyro_meta_dimension_estimates (
          id, student_id, dimension_name, score, ci_low, ci_high, n_observations, confidence_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, studentId, dim, score, ciLow, ciHigh, scores.length, confidenceLevel);
    }
  }
}
