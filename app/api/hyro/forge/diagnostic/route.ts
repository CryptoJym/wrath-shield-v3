/**
 * HYRO FORGE: Diagnostic v2 API - Manifold-Integrated Assessment
 *
 * This endpoint uses the v2 schema with:
 * - LLM-powered evaluation (Opus 4.5)
 * - State vector updates (C, E, G manifold)
 * - Meta-generative dimension tracking
 * - Multi-signal triangulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';
import {
  evaluateResponse,
  saveEvaluationResult,
  aggregateEvaluations,
  type EvaluationResult
} from '@/lib/hyro/forge-evaluator';

// ============================================================================
// GET: Retrieve diagnostic items, sessions, and progress
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const sessionId = searchParams.get('session_id');
    const stat = searchParams.get('stat');

    const db = getDatabase();

    // Get available diagnostic items
    if (action === 'items') {
      let query = `
        SELECT id, stat_name, item_type, difficulty, constructs_measured,
               prompt_text, media_url, options_json, rubric_json
        FROM hyro_diagnostic_items_v2
        WHERE is_active = 1
      `;
      const params: any[] = [];

      if (stat) {
        query += ` AND stat_name = ?`;
        params.push(stat);
      }

      query += ` ORDER BY difficulty ASC, RANDOM() LIMIT 20`;

      const items = db.prepare(query).all(...params);

      return NextResponse.json({
        student_id: studentId,
        items,
        count: items.length,
      });
    }

    // Get meta probes
    if (action === 'meta-probes') {
      const probes = db.prepare(`
        SELECT * FROM hyro_meta_probes
        WHERE is_active = 1
        ORDER BY probe_type, RANDOM()
        LIMIT 6
      `).all();

      return NextResponse.json({
        student_id: studentId,
        probes,
        count: probes.length,
      });
    }

    // Get current session
    if (action === 'session' && sessionId) {
      const session = db.prepare(`
        SELECT * FROM hyro_diagnostic_sessions_v2
        WHERE id = ? AND student_id = ?
      `).get(sessionId, studentId);

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Get responses in this session
      const responses = db.prepare(`
        SELECT r.*, i.prompt_text, i.item_type
        FROM hyro_diagnostic_responses_v2 r
        LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
        WHERE r.session_id = ? AND r.student_id = ?
        ORDER BY r.created_at ASC
      `).all(sessionId, studentId);

      return NextResponse.json({
        session,
        responses,
        progress: {
          completed: responses.length,
          target: (session as any).target_items || 10,
        },
      });
    }

    // Get active session for a stat
    if (action === 'active-session') {
      const session = db.prepare(`
        SELECT * FROM hyro_diagnostic_sessions_v2
        WHERE student_id = ? AND status = 'active'
        ${stat ? 'AND focus_stat = ?' : ''}
        ORDER BY created_at DESC
        LIMIT 1
      `).get(stat ? [studentId, stat] : studentId);

      return NextResponse.json({
        student_id: studentId,
        session: session || null,
      });
    }

    // Get next item to answer (adaptive selection)
    if (action === 'next-item' && sessionId) {
      const session = db.prepare(`
        SELECT * FROM hyro_diagnostic_sessions_v2
        WHERE id = ? AND student_id = ?
      `).get(sessionId, studentId) as any;

      if (!session || session.status !== 'active') {
        return NextResponse.json({ error: 'No active session' }, { status: 400 });
      }

      // Get already answered item IDs
      const answeredItems = db.prepare(`
        SELECT item_id FROM hyro_diagnostic_responses_v2
        WHERE session_id = ?
      `).all(sessionId) as any[];
      const answeredIds = answeredItems.map((r: any) => r.item_id);

      // Count meta probes already answered
      const metaProbesAnswered = answeredIds.filter(id => id.startsWith('probe_')).length;
      const domainItemsAnswered = answeredIds.length - metaProbesAnswered;

      // Rule 3: Inject meta probe at strategic points
      // - After 3 domain items (mid-session)
      // - After 7 domain items (late-session)
      // - This ensures at least 1-2 meta probes per session
      const shouldInjectMetaProbe =
        (domainItemsAnswered === 3 && metaProbesAnswered === 0) ||
        (domainItemsAnswered === 7 && metaProbesAnswered === 1);

      if (shouldInjectMetaProbe) {
        const metaProbe = db.prepare(`
          SELECT * FROM hyro_meta_probes
          WHERE is_active = 1 AND id NOT IN (${answeredIds.length > 0 ? answeredIds.map(() => '?').join(',') : "''"})
          ORDER BY RANDOM()
          LIMIT 1
        `).get(...(answeredIds.length > 0 ? answeredIds : [])) as any;

        if (metaProbe) {
          return NextResponse.json({
            item: metaProbe,
            is_meta_probe: true,
            meta_probe_type: metaProbe.probe_type,
            target_dimensions: metaProbe.target_dimensions ? JSON.parse(metaProbe.target_dimensions) : [],
            progress: {
              completed: answeredIds.length,
              target: session.target_items || 10,
              domain_items: domainItemsAnswered,
              meta_probes: metaProbesAnswered,
            },
          });
        }
      }

      // Get current performance to adapt difficulty
      const recentScores = db.prepare(`
        SELECT AVG(score_validity) as avg_validity
        FROM hyro_diagnostic_responses_v2
        WHERE session_id = ? AND score_validity IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 3
      `).get(sessionId) as any;

      let targetDifficulty = 0.5;
      if (recentScores?.avg_validity) {
        // Adapt: if doing well, increase difficulty
        targetDifficulty = recentScores.avg_validity > 0.7 ? 0.7 :
                          recentScores.avg_validity < 0.4 ? 0.3 : 0.5;
      }

      // Select next item adaptively
      let query = `
        SELECT id, stat_name, item_type, difficulty, constructs_measured,
               prompt_text, media_url, options_json, rubric_json
        FROM hyro_diagnostic_items_v2
        WHERE is_active = 1
      `;
      const params: any[] = [];

      if (session.focus_stat) {
        query += ` AND stat_name = ?`;
        params.push(session.focus_stat);
      }

      if (answeredIds.length > 0) {
        query += ` AND id NOT IN (${answeredIds.map(() => '?').join(',')})`;
        params.push(...answeredIds);
      }

      // Order by proximity to target difficulty
      query += ` ORDER BY ABS(difficulty - ?) ASC, RANDOM() LIMIT 1`;
      params.push(targetDifficulty);

      const item = db.prepare(query).get(...params);

      if (!item) {
        // No more domain items - check if we need a final meta probe
        if (metaProbesAnswered === 0) {
          // Rule 3 enforcement: Session MUST have at least one meta probe
          const finalMetaProbe = db.prepare(`
            SELECT * FROM hyro_meta_probes
            WHERE is_active = 1 AND id NOT IN (${answeredIds.length > 0 ? answeredIds.map(() => '?').join(',') : "''"})
            ORDER BY RANDOM()
            LIMIT 1
          `).get(...(answeredIds.length > 0 ? answeredIds : [])) as any;

          if (finalMetaProbe) {
            return NextResponse.json({
              item: finalMetaProbe,
              is_meta_probe: true,
              meta_probe_type: finalMetaProbe.probe_type,
              target_dimensions: finalMetaProbe.target_dimensions ? JSON.parse(finalMetaProbe.target_dimensions) : [],
              required_for_completion: true,
              progress: {
                completed: answeredIds.length,
                target: session.target_items || 10,
                domain_items: domainItemsAnswered,
                meta_probes: metaProbesAnswered,
              },
            });
          }
        }

        return NextResponse.json({
          item: null,
          session_complete: true,
          progress: {
            completed: answeredIds.length,
            target: session.target_items || 10,
            domain_items: domainItemsAnswered,
            meta_probes: metaProbesAnswered,
          },
        });
      }

      return NextResponse.json({
        item,
        is_meta_probe: false,
        progress: {
          completed: answeredIds.length,
          target: session.target_items || 10,
          domain_items: domainItemsAnswered,
          meta_probes: metaProbesAnswered,
          current_difficulty: targetDifficulty,
        },
      });
    }

    // Get evaluation history
    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const responses = db.prepare(`
        SELECT r.*, i.prompt_text, i.stat_name
        FROM hyro_diagnostic_responses_v2 r
        LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
        WHERE r.student_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?
      `).all(studentId, limit);

      return NextResponse.json({
        student_id: studentId,
        responses,
        count: responses.length,
      });
    }

    // Default: return overview
    const sessions = db.prepare(`
      SELECT * FROM hyro_diagnostic_sessions_v2
      WHERE student_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(studentId);

    const statsSummary = db.prepare(`
      SELECT
        i.stat_name,
        COUNT(r.id) as total_responses,
        AVG(r.score_validity) as avg_validity,
        AVG(r.score_coherence) as avg_coherence,
        AVG(r.score_transfer) as avg_transfer
      FROM hyro_diagnostic_responses_v2 r
      LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
      WHERE r.student_id = ?
      GROUP BY i.stat_name
    `).all(studentId);

    return NextResponse.json({
      student_id: studentId,
      recent_sessions: sessions,
      stats_summary: statsSummary,
    });

  } catch (error) {
    console.error('Diagnostic v2 GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch diagnostic data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Start session, submit response, complete session
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const body = await request.json();
    const { action } = body;

    const db = getDatabase();

    // Start a new diagnostic session
    if (action === 'start') {
      const { focus_stat, target_items } = body;

      const sessionId = `ds2_${studentId}_${Date.now()}`;

      db.prepare(`
        INSERT INTO hyro_diagnostic_sessions_v2 (
          id, student_id, focus_stat, status, target_items
        ) VALUES (?, ?, ?, 'active', ?)
      `).run(sessionId, studentId, focus_stat || null, target_items || 10);

      const session = db.prepare(`
        SELECT * FROM hyro_diagnostic_sessions_v2 WHERE id = ?
      `).get(sessionId);

      // Get first item
      let query = `
        SELECT id, stat_name, item_type, difficulty, constructs_measured,
               prompt_text, media_url, options_json, rubric_json
        FROM hyro_diagnostic_items_v2
        WHERE is_active = 1
      `;
      const params: any[] = [];

      if (focus_stat) {
        query += ` AND stat_name = ?`;
        params.push(focus_stat);
      }

      query += ` ORDER BY difficulty ASC, RANDOM() LIMIT 1`;
      const firstItem = db.prepare(query).get(...params);

      return NextResponse.json({
        session,
        first_item: firstItem,
        message: `Diagnostic session started${focus_stat ? ` for ${focus_stat}` : ''}`,
      });
    }

    // Submit a response for LLM evaluation
    if (action === 'submit') {
      const {
        session_id,
        item_id,
        response_text,
        response_json,
        time_spent_ms,
        confidence_before,
      } = body;

      if (!session_id || !item_id) {
        return NextResponse.json(
          { error: 'session_id and item_id are required' },
          { status: 400 }
        );
      }

      // Get the item details for evaluation context
      const item = db.prepare(`
        SELECT * FROM hyro_diagnostic_items_v2 WHERE id = ?
      `).get(item_id) as any;

      if (!item) {
        // Check if it's a meta probe
        const metaProbe = db.prepare(`
          SELECT * FROM hyro_meta_probes WHERE id = ?
        `).get(item_id) as any;

        if (!metaProbe) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        // Handle meta probe response with full LLM evaluation
        // Rule 2: LLM Evaluation for Extended Responses (meta probes are always extended)
        const responseId = `dr2_${studentId}_${item_id}_${Date.now()}`;

        db.prepare(`
          INSERT INTO hyro_diagnostic_responses_v2 (
            id, student_id, session_id, item_id,
            response_text, response_json, time_spent_ms,
            confidence_before
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          responseId,
          studentId,
          session_id,
          item_id,
          response_text || null,
          response_json ? JSON.stringify(response_json) : null,
          time_spent_ms || null,
          confidence_before || null
        );

        // Perform LLM evaluation for meta probe
        // Meta probes are critical for meta dimension scores
        let evaluation: EvaluationResult | null = null;
        try {
          evaluation = await evaluateResponse({
            itemId: item_id,
            itemType: 'meta_probe',
            prompt: metaProbe.prompt,
            studentResponse: response_text || JSON.stringify(response_json),
            scoringGuidance: metaProbe.scoring_guidance,
            targetDimensions: metaProbe.target_dimensions ? JSON.parse(metaProbe.target_dimensions) : undefined,
          });

          // Save evaluation result
          saveEvaluationResult(responseId, evaluation, 'anthropic/claude-opus-4-5-20250929', JSON.stringify(evaluation));

          // Update meta dimension estimates based on probe response
          if (evaluation.meta) {
            const targetDims = metaProbe.target_dimensions ? JSON.parse(metaProbe.target_dimensions) : [];
            for (const dim of targetDims) {
              const dimScore = evaluation.meta[dim as keyof typeof evaluation.meta];
              if (dimScore !== undefined && dimScore > 0) {
                const dimId = `mde_${studentId}_${dim}`;
                const existing = db.prepare(`SELECT * FROM hyro_meta_dimension_estimates WHERE id = ?`).get(dimId) as any;

                if (existing) {
                  // Running average update
                  const newScore = (existing.score * existing.n_observations + dimScore * 100) / (existing.n_observations + 1);
                  db.prepare(`
                    UPDATE hyro_meta_dimension_estimates SET
                      score = ?,
                      n_observations = n_observations + 1,
                      evidence_json = ?,
                      updated_at = unixepoch()
                    WHERE id = ?
                  `).run(
                    newScore,
                    JSON.stringify({
                      probe_ids: [...(existing.evidence_json ? JSON.parse(existing.evidence_json).probe_ids || [] : []), item_id],
                      observations: evaluation.evidence.observations,
                      quotes: evaluation.evidence.quotes,
                    }),
                    dimId
                  );
                } else {
                  db.prepare(`
                    INSERT INTO hyro_meta_dimension_estimates (
                      id, student_id, dimension_name, score, n_observations, evidence_json
                    ) VALUES (?, ?, ?, ?, 1, ?)
                  `).run(
                    dimId,
                    studentId,
                    dim,
                    dimScore * 100,
                    JSON.stringify({
                      probe_ids: [item_id],
                      observations: evaluation.evidence.observations,
                      quotes: evaluation.evidence.quotes,
                    })
                  );
                }
              }
            }
          }

        } catch (evalError) {
          console.error('Meta probe LLM evaluation failed:', evalError);
        }

        return NextResponse.json({
          response_id: responseId,
          is_meta_probe: true,
          evaluation: evaluation ? {
            scores: evaluation.scores,
            meta: evaluation.meta,
            flags: evaluation.flags,
            evidence: evaluation.evidence,
          } : null,
          message: 'Meta probe response evaluated',
        });
      }

      // Create response record
      const responseId = `dr2_${studentId}_${item_id}_${Date.now()}`;

      db.prepare(`
        INSERT INTO hyro_diagnostic_responses_v2 (
          id, student_id, session_id, item_id,
          response_text, response_json, time_spent_ms,
          confidence_before
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        responseId,
        studentId,
        session_id,
        item_id,
        response_text || null,
        response_json ? JSON.stringify(response_json) : null,
        time_spent_ms || null,
        confidence_before || null
      );

      // Perform LLM evaluation asynchronously
      let evaluation: EvaluationResult | null = null;
      try {
        evaluation = await evaluateResponse({
          itemId: item_id,
          itemType: item.item_type,
          prompt: item.prompt_text,
          studentResponse: response_text || JSON.stringify(response_json),
          scoringGuidance: item.rubric_json ? JSON.stringify(item.rubric_json) : undefined,
          targetDimensions: item.constructs_measured ? item.constructs_measured.split(',').map((c: string) => c.trim()) : undefined,
        });

        // Save evaluation result
        saveEvaluationResult(responseId, evaluation, 'anthropic/claude-opus-4-5-20250929', JSON.stringify(evaluation));

      } catch (evalError) {
        console.error('LLM evaluation failed:', evalError);
        // Continue without evaluation - can retry later
      }

      // Get next item
      const answeredIds = db.prepare(`
        SELECT item_id FROM hyro_diagnostic_responses_v2
        WHERE session_id = ?
      `).all(session_id).map((r: any) => r.item_id);

      const session = db.prepare(`
        SELECT * FROM hyro_diagnostic_sessions_v2 WHERE id = ?
      `).get(session_id) as any;

      // Check if session should be complete
      const targetItems = session?.target_items || 10;
      if (answeredIds.length >= targetItems) {
        return NextResponse.json({
          response_id: responseId,
          evaluation: evaluation ? {
            scores: evaluation.scores,
            meta: evaluation.meta,
            flags: evaluation.flags,
          } : null,
          session_complete: true,
          progress: {
            completed: answeredIds.length,
            target: targetItems,
          },
          message: 'Session complete! All items answered.',
        });
      }

      // Get next item adaptively
      const recentScores = db.prepare(`
        SELECT AVG(score_validity) as avg_validity
        FROM hyro_diagnostic_responses_v2
        WHERE session_id = ? AND score_validity IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 3
      `).get(session_id) as any;

      let targetDifficulty = 0.5;
      if (recentScores?.avg_validity) {
        targetDifficulty = recentScores.avg_validity > 0.7 ? 0.7 :
                          recentScores.avg_validity < 0.4 ? 0.3 : 0.5;
      }

      let nextQuery = `
        SELECT id, stat_name, item_type, difficulty, constructs_measured,
               prompt_text, media_url, options_json, rubric_json
        FROM hyro_diagnostic_items_v2
        WHERE is_active = 1
      `;
      const nextParams: any[] = [];

      if (session?.focus_stat) {
        nextQuery += ` AND stat_name = ?`;
        nextParams.push(session.focus_stat);
      }

      if (answeredIds.length > 0) {
        nextQuery += ` AND id NOT IN (${answeredIds.map(() => '?').join(',')})`;
        nextParams.push(...answeredIds);
      }

      nextQuery += ` ORDER BY ABS(difficulty - ?) ASC, RANDOM() LIMIT 1`;
      nextParams.push(targetDifficulty);

      const nextItem = db.prepare(nextQuery).get(...nextParams);

      return NextResponse.json({
        response_id: responseId,
        evaluation: evaluation ? {
          scores: evaluation.scores,
          meta: evaluation.meta,
          flags: evaluation.flags,
        } : null,
        next_item: nextItem,
        progress: {
          completed: answeredIds.length,
          target: targetItems,
          current_difficulty: targetDifficulty,
        },
      });
    }

    // Complete a session and update state vectors
    if (action === 'complete') {
      const { session_id } = body;

      if (!session_id) {
        return NextResponse.json(
          { error: 'session_id is required' },
          { status: 400 }
        );
      }

      // Get all evaluations for this session
      const responses = db.prepare(`
        SELECT r.llm_evaluation, i.stat_name
        FROM hyro_diagnostic_responses_v2 r
        LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
        WHERE r.session_id = ? AND r.llm_evaluation IS NOT NULL
      `).all(session_id) as any[];

      // Parse evaluations and group by stat
      const evaluationsByStat: Record<string, EvaluationResult[]> = {};
      for (const r of responses) {
        if (!r.llm_evaluation) continue;
        const statName = r.stat_name || 'general';
        if (!evaluationsByStat[statName]) {
          evaluationsByStat[statName] = [];
        }
        try {
          evaluationsByStat[statName].push(JSON.parse(r.llm_evaluation));
        } catch (e) {
          // Skip invalid JSON
        }
      }

      // Update state vectors for each stat
      const updatedStats: string[] = [];
      for (const [statName, evaluations] of Object.entries(evaluationsByStat)) {
        if (evaluations.length === 0) continue;

        const aggregated = aggregateEvaluations(evaluations);

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
              n_items_used = n_items_used + ?,
              signal_agreement = ?,
              updated_at = unixepoch()
            WHERE id = ?
          `).run(
            aggregated.coherence,
            aggregated.entropy,
            aggregated.generativity,
            aggregated.ci_low,
            aggregated.ci_high,
            aggregated.n_items,
            aggregated.signal_agreement,
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
            aggregated.coherence,
            aggregated.entropy,
            aggregated.generativity,
            '{}',
            aggregated.ci_low,
            aggregated.ci_high,
            aggregated.n_items,
            aggregated.signal_agreement
          );
        }

        updatedStats.push(statName);
      }

      // Mark session as complete
      db.prepare(`
        UPDATE hyro_diagnostic_sessions_v2
        SET status = 'completed', completed_at = unixepoch()
        WHERE id = ?
      `).run(session_id);

      // Get final state vectors
      const stateVectors = db.prepare(`
        SELECT * FROM hyro_state_vectors
        WHERE student_id = ?
        ORDER BY updated_at DESC
      `).all(studentId);

      return NextResponse.json({
        message: 'Session completed and state vectors updated',
        updated_stats: updatedStats,
        state_vectors: stateVectors,
        total_responses: responses.length,
      });
    }

    // Retry evaluation for a response (if initial failed)
    if (action === 'retry-evaluation') {
      const { response_id } = body;

      if (!response_id) {
        return NextResponse.json(
          { error: 'response_id is required' },
          { status: 400 }
        );
      }

      const response = db.prepare(`
        SELECT r.*, i.stat_name, i.item_type, i.prompt_text, i.rubric_json, i.constructs_measured
        FROM hyro_diagnostic_responses_v2 r
        LEFT JOIN hyro_diagnostic_items_v2 i ON r.item_id = i.id
        WHERE r.id = ? AND r.student_id = ?
      `).get(response_id, studentId) as any;

      if (!response) {
        return NextResponse.json({ error: 'Response not found' }, { status: 404 });
      }

      if (response.llm_evaluation) {
        return NextResponse.json({
          message: 'Response already has evaluation',
          evaluation: JSON.parse(response.llm_evaluation),
        });
      }

      // Retry evaluation
      const evaluation = await evaluateResponse({
        itemId: response.item_id,
        itemType: response.item_type,
        prompt: response.prompt_text,
        studentResponse: response.response_text || response.response_json,
        scoringGuidance: response.rubric_json ? JSON.stringify(response.rubric_json) : undefined,
        targetDimensions: response.constructs_measured ? response.constructs_measured.split(',').map((c: string) => c.trim()) : undefined,
      });

      saveEvaluationResult(response_id, evaluation, 'anthropic/claude-opus-4-5-20250929', JSON.stringify(evaluation));

      return NextResponse.json({
        message: 'Evaluation completed',
        evaluation: {
          scores: evaluation.scores,
          meta: evaluation.meta,
          flags: evaluation.flags,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Diagnostic v2 POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process diagnostic action' },
      { status: 500 }
    );
  }
}
