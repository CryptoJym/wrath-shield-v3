/**
 * HYRO FORGE: Diagnostic v3 API - Generative Assessment Engine
 *
 * This endpoint uses AI-generated items for truly adaptive assessment.
 * No fixed item bank - each question is generated in real-time at the
 * precise difficulty level needed for maximum information.
 *
 * FLOW:
 * 1. Start session → Initialize ability estimate
 * 2. Get next item → AI generates question at target difficulty
 * 3. Submit response → AI evaluates, updates ability estimate
 * 4. Repeat until convergence or max items
 * 5. Complete → Return final profile with strand breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';
import {
    getGenerativeEngine,
    createInitialAbilityEstimate,
    type GeneratedItem,
    type AbilityEstimate,
    type ResponseEvaluation,
} from '@/lib/hyro/forge-generative-engine';
import { getBlueprint } from '@/lib/hyro/forge-blueprints';
import { StatName } from '@/lib/hyro/forge-types';

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

interface GenerativeSession {
    id: string;
    student_id: string;
    stat_name: StatName;
    status: 'active' | 'completed' | 'abandoned';
    ability_estimate: AbilityEstimate;
    items_history: GeneratedItem[];
    evaluations: ResponseEvaluation[];
    target_items: number;
    convergence_threshold: number;
    created_at: string;
    updated_at: string;
}

// In-memory session store (in production, use Redis or DB)
const activeSessions = new Map<string, GenerativeSession>();

function generateSessionId(): string {
    return `gensess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// GET: Get next item or session status
// =============================================================================

export async function GET(request: NextRequest) {
    try {
        const studentId = await getStudentIdFromRequest();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const sessionId = searchParams.get('session_id');

        // Get session status
        if (action === 'session' && sessionId) {
            const session = activeSessions.get(sessionId);
            if (!session || session.student_id !== studentId) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            return NextResponse.json({
                session_id: session.id,
                stat_name: session.stat_name,
                status: session.status,
                progress: {
                    items_completed: session.items_history.length,
                    target_items: session.target_items,
                    current_se: session.ability_estimate.standard_error,
                    converged: session.ability_estimate.standard_error < session.convergence_threshold,
                },
                current_estimate: {
                    theta: session.ability_estimate.theta,
                    level: thetaToLevel(session.ability_estimate.theta),
                    confidence_interval: calculateConfidenceInterval(session.ability_estimate),
                },
            });
        }

        // Get next item
        if (action === 'next-item' && sessionId) {
            const session = activeSessions.get(sessionId);
            if (!session || session.student_id !== studentId) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            if (session.status !== 'active') {
                return NextResponse.json({
                    error: 'Session not active',
                    status: session.status,
                }, { status: 400 });
            }

            // Check termination criteria
            const shouldTerminate = checkTerminationCriteria(session);
            if (shouldTerminate.terminate) {
                return NextResponse.json({
                    complete: true,
                    reason: shouldTerminate.reason,
                    final_estimate: formatFinalEstimate(session),
                });
            }

            // Generate next item
            const engine = getGenerativeEngine();
            const nextTarget = await engine.selectNextItem(
                session.stat_name,
                session.ability_estimate,
                session.items_history
            );

            // Collect topics already tested
            const avoidTopics = session.items_history
                .slice(-5)  // Last 5 items
                .map(item => item.prompt.slice(0, 50));  // Rough dedup

            const newItem = await engine.generateItem(
                session.stat_name,
                nextTarget.strand,
                nextTarget.tier,
                nextTarget.difficulty,
                nextTarget.manifold,
                'multiple_choice',
                avoidTopics
            );

            // Store item in session (don't add to history until answered)
            (session as any).pending_item = newItem;
            session.updated_at = new Date().toISOString();

            return NextResponse.json({
                item: {
                    id: newItem.id,
                    prompt: newItem.prompt,
                    options: newItem.options,
                    format: newItem.format,
                    strand: newItem.strand,
                    tier: newItem.tier,
                    manifold_focus: newItem.manifold_focus,
                },
                progress: {
                    items_completed: session.items_history.length,
                    target_items: session.target_items,
                    current_level: thetaToLevel(session.ability_estimate.theta),
                },
                targeting: {
                    strand: nextTarget.strand,
                    tier: nextTarget.tier,
                    target_difficulty: nextTarget.difficulty,
                },
            });
        }

        // List active sessions
        if (action === 'list-sessions') {
            const userSessions = Array.from(activeSessions.values())
                .filter(s => s.student_id === studentId)
                .map(s => ({
                    id: s.id,
                    stat_name: s.stat_name,
                    status: s.status,
                    items_completed: s.items_history.length,
                    created_at: s.created_at,
                }));

            return NextResponse.json({ sessions: userSessions });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Generative diagnostic GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}

// =============================================================================
// POST: Start session or submit response
// =============================================================================

export async function POST(request: NextRequest) {
    try {
        const studentId = await getStudentIdFromRequest();
        const body = await request.json();
        const { action } = body;

        // Start new session
        if (action === 'start') {
            const { stat_name, target_items = 20 } = body;

            if (!stat_name) {
                return NextResponse.json({ error: 'stat_name required' }, { status: 400 });
            }

            // Verify stat has a blueprint
            const blueprint = getBlueprint(stat_name as StatName);
            if (!blueprint) {
                return NextResponse.json({ error: 'Invalid stat_name' }, { status: 400 });
            }

            const sessionId = generateSessionId();
            const session: GenerativeSession = {
                id: sessionId,
                student_id: studentId,
                stat_name: stat_name as StatName,
                status: 'active',
                ability_estimate: createInitialAbilityEstimate(),
                items_history: [],
                evaluations: [],
                target_items: Math.min(target_items, 50),  // Cap at 50
                convergence_threshold: 0.35,  // SE threshold for "converged"
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            activeSessions.set(sessionId, session);

            return NextResponse.json({
                session_id: sessionId,
                stat_name,
                message: 'Session started. Call GET with action=next-item to get first question.',
                blueprint_strands: blueprint.strands.map(s => ({
                    strand: s.strand,
                    tier: s.tier,
                    weight: s.weight,
                })),
            });
        }

        // Submit response
        if (action === 'respond') {
            const { session_id, response, response_time_ms } = body;

            if (!session_id || response === undefined) {
                return NextResponse.json({ error: 'session_id and response required' }, { status: 400 });
            }

            const session = activeSessions.get(session_id);
            if (!session || session.student_id !== studentId) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            const pendingItem = (session as any).pending_item as GeneratedItem | undefined;
            if (!pendingItem) {
                return NextResponse.json({ error: 'No pending item. Call next-item first.' }, { status: 400 });
            }

            // Evaluate response
            const engine = getGenerativeEngine();
            const evaluation = await engine.evaluateResponse(
                pendingItem,
                String(response),
                response_time_ms ? response_time_ms / 1000 : undefined
            );

            // Update ability estimate
            const newEstimate = engine.updateAbilityEstimate(
                session.ability_estimate,
                pendingItem,
                evaluation
            );

            // Update session
            session.ability_estimate = newEstimate;
            session.items_history.push(pendingItem);
            session.evaluations.push(evaluation);
            delete (session as any).pending_item;
            session.updated_at = new Date().toISOString();

            // Check if session should complete
            const termination = checkTerminationCriteria(session);

            // Save to database for persistence
            await saveSessionSnapshot(session);

            return NextResponse.json({
                evaluation: {
                    is_correct: evaluation.is_correct,
                    score: evaluation.score,
                    feedback: evaluation.feedback,
                    misconception_detected: evaluation.misconception_detected,
                },
                updated_estimate: {
                    theta: newEstimate.theta,
                    level: thetaToLevel(newEstimate.theta),
                    standard_error: newEstimate.standard_error,
                    items_completed: session.items_history.length,
                },
                session_status: termination.terminate ? 'completing' : 'active',
                termination_reason: termination.reason,
                manifold_signals: {
                    coherence: evaluation.coherence_signal,
                    fluidity: evaluation.fluidity_signal,
                    elasticity: evaluation.elasticity_signal,
                },
            });
        }

        // Complete session
        if (action === 'complete') {
            const { session_id } = body;

            const session = activeSessions.get(session_id);
            if (!session || session.student_id !== studentId) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            session.status = 'completed';
            session.updated_at = new Date().toISOString();

            const finalResults = formatFinalEstimate(session);

            // Save final results to database
            await saveFinalResults(session, finalResults);

            // Clean up in-memory session after some time
            setTimeout(() => activeSessions.delete(session_id), 5 * 60 * 1000);

            return NextResponse.json({
                status: 'completed',
                results: finalResults,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Generative diagnostic POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function thetaToLevel(theta: number): number {
    // Map theta (-3 to +3) to level (10 to 95)
    const normalized = (theta + 3) / 6;  // 0 to 1
    return Math.round(10 + normalized * 85);
}

function calculateConfidenceInterval(estimate: AbilityEstimate): { low: number; high: number } {
    const se = estimate.standard_error;
    const thetaLow = estimate.theta - 1.96 * se;
    const thetaHigh = estimate.theta + 1.96 * se;

    return {
        low: thetaToLevel(thetaLow),
        high: thetaToLevel(thetaHigh),
    };
}

function checkTerminationCriteria(session: GenerativeSession): { terminate: boolean; reason?: string } {
    // Max items reached
    if (session.items_history.length >= session.target_items) {
        return { terminate: true, reason: 'max_items_reached' };
    }

    // Convergence achieved (low SE)
    if (session.ability_estimate.standard_error < session.convergence_threshold &&
        session.items_history.length >= 10) {  // Minimum items for convergence
        return { terminate: true, reason: 'convergence_achieved' };
    }

    // Extreme ability detected (ceiling/floor)
    if (session.items_history.length >= 8) {
        const recentEvals = session.evaluations.slice(-5);
        const allCorrect = recentEvals.every(e => e.is_correct);
        const allWrong = recentEvals.every(e => !e.is_correct);

        if ((allCorrect || allWrong) && session.ability_estimate.theta > 2.5) {
            return { terminate: true, reason: 'ceiling_effect' };
        }
        if ((allCorrect || allWrong) && session.ability_estimate.theta < -2.5) {
            return { terminate: true, reason: 'floor_effect' };
        }
    }

    return { terminate: false };
}

function formatFinalEstimate(session: GenerativeSession) {
    const blueprint = getBlueprint(session.stat_name);

    // Calculate strand-level results
    const strandResults = blueprint.strands.map(strand => {
        const strandEst = session.ability_estimate.strand_estimates[strand.strand];
        const strandItems = session.items_history.filter(i => i.strand === strand.strand);
        const strandEvals = session.evaluations.filter((_, i) =>
            session.items_history[i]?.strand === strand.strand
        );

        const accuracy = strandEvals.length > 0
            ? strandEvals.filter(e => e.is_correct).length / strandEvals.length
            : null;

        return {
            strand: strand.strand,
            tier: strand.tier,
            manifold_focus: strand.manifold_focus,
            items_administered: strandItems.length,
            accuracy,
            estimated_level: strandEst ? thetaToLevel(strandEst.theta) : null,
            standard_error: strandEst?.se ?? null,
        };
    });

    // Identify strengths and gaps
    const strengths = strandResults
        .filter(s => s.estimated_level && s.estimated_level >= 70)
        .sort((a, b) => (b.estimated_level ?? 0) - (a.estimated_level ?? 0))
        .slice(0, 3);

    const gaps = strandResults
        .filter(s => s.estimated_level && s.estimated_level < 50)
        .sort((a, b) => (a.estimated_level ?? 100) - (b.estimated_level ?? 100))
        .slice(0, 3);

    // Aggregate misconceptions
    const misconceptions = session.evaluations
        .filter(e => e.misconception_detected)
        .map(e => e.misconception_detected!);

    return {
        overall: {
            stat_name: session.stat_name,
            estimated_level: thetaToLevel(session.ability_estimate.theta),
            theta: session.ability_estimate.theta,
            standard_error: session.ability_estimate.standard_error,
            confidence_interval: calculateConfidenceInterval(session.ability_estimate),
            items_administered: session.items_history.length,
            overall_accuracy: session.evaluations.filter(e => e.is_correct).length / session.evaluations.length,
        },
        strand_breakdown: strandResults,
        strengths: strengths.map(s => s.strand),
        skill_gaps: gaps.map(s => s.strand),
        manifold_profile: session.ability_estimate.manifold_profile,
        misconceptions_detected: [...new Set(misconceptions)],
        recommendations: generateRecommendations(strandResults, gaps, misconceptions),
    };
}

function generateRecommendations(
    strandResults: any[],
    gaps: any[],
    misconceptions: string[]
): string[] {
    const recommendations: string[] = [];

    if (gaps.length > 0) {
        recommendations.push(`Focus on strengthening: ${gaps.map(g => g.strand).join(', ')}`);
    }

    const untested = strandResults.filter(s => s.items_administered === 0);
    if (untested.length > 3) {
        recommendations.push(`Consider additional assessment to cover: ${untested.slice(0, 3).map(s => s.strand).join(', ')}`);
    }

    if (misconceptions.length > 0) {
        recommendations.push(`Address common misconceptions in: ${misconceptions.slice(0, 2).join('; ')}`);
    }

    return recommendations;
}

async function saveSessionSnapshot(session: GenerativeSession): Promise<void> {
    try {
        const db = getDatabase();

        db.prepare(`
            INSERT OR REPLACE INTO hyro_generative_sessions
            (id, student_id, stat_name, status, ability_theta, ability_se, items_count, data_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            session.id,
            session.student_id,
            session.stat_name,
            session.status,
            session.ability_estimate.theta,
            session.ability_estimate.standard_error,
            session.items_history.length,
            JSON.stringify({
                ability_estimate: session.ability_estimate,
                items_history: session.items_history.map(i => i.id),  // Just IDs for space
                evaluations_summary: session.evaluations.map(e => ({
                    correct: e.is_correct,
                    score: e.score,
                })),
            }),
            session.updated_at
        );
    } catch (error) {
        console.error('Failed to save session snapshot:', error);
        // Non-fatal - continue with in-memory
    }
}

async function saveFinalResults(session: GenerativeSession, results: any): Promise<void> {
    try {
        const db = getDatabase();

        // Save to generative results table
        db.prepare(`
            INSERT INTO hyro_generative_results
            (id, student_id, stat_name, session_id, estimated_level, theta, standard_error, items_count, results_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            `result_${Date.now()}`,
            session.student_id,
            session.stat_name,
            session.id,
            results.overall.estimated_level,
            results.overall.theta,
            results.overall.standard_error,
            session.items_history.length,
            JSON.stringify(results),
            new Date().toISOString()
        );

        // Update student's stat level
        db.prepare(`
            INSERT OR REPLACE INTO hyro_student_stats
            (student_id, stat_name, level, theta, last_assessed_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            session.student_id,
            session.stat_name,
            results.overall.estimated_level,
            results.overall.theta,
            new Date().toISOString()
        );

    } catch (error) {
        console.error('Failed to save final results:', error);
    }
}
