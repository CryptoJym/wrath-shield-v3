/**
 * HYRO FORGE v4: Unified Assessment API
 *
 * @hyro-domain adaptive_assessment
 * @hyro-manifold AI-powered multi-stat diagnostic engine
 *
 * ARCHITECTURE:
 * This is the main entry point for all assessment operations. It provides:
 * - Single-stat diagnostic assessments
 * - Multi-stat battery assessments
 * - Real-time response submission and evaluation
 * - Session lifecycle management (start, pause, resume, complete)
 *
 * The engine uses IRT (Item Response Theory) with AI-generated items
 * for truly adaptive assessment at any ability level.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest, getCurrentStudent } from '@/lib/hyro/student-auth';
import {
    getGenerativeEngine,
    createInitialAbilityEstimate,
    type GeneratedItem,
    type AbilityEstimate,
    type ResponseEvaluation,
} from '@/lib/hyro/forge-generative-engine';
import { getBlueprint, type StrandTier, type ManifoldDimension } from '@/lib/hyro/forge-blueprints';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';
import {
    getStudentProfile,
    getStudentContext,
    updateStatProfile,
    recordMisconception,
    recordLearningEvent,
    type StudentLearningProfile,
    type AssessmentContext,
} from '@/lib/hyro/forge-memory-architecture';
import { getStatBenchmark, getStudentGradeProfile, type GradeLevel } from '@/lib/hyro/forge-grade-benchmarks';
import { getDomainAgent, buildAgentSystemPrompt } from '@/lib/hyro/forge-domain-agents';

// =============================================================================
// TYPES
// =============================================================================

export interface DiagnosticSession {
    id: string;
    student_id: string;
    session_type: 'diagnostic' | 'multi_stat' | 'quick_check';
    stat_name: StatName;
    status: 'active' | 'paused' | 'completed' | 'abandoned';
    ability_estimate: AbilityEstimate;
    items_history: GeneratedItem[];
    evaluations: ResponseEvaluation[];
    pending_item?: GeneratedItem;
    target_items: number;
    convergence_threshold: number;
    pause_data?: {
        paused_at: string;
        resume_token: string;
    };
    created_at: string;
    updated_at: string;
}

export interface MultiStatSession {
    id: string;
    student_id: string;
    status: 'active' | 'paused' | 'completed';
    stats_queue: StatName[];
    current_stat_index: number;
    stat_sessions: Record<StatName, DiagnosticSession>;
    items_per_stat: number;
    created_at: string;
    updated_at: string;
}

interface SessionProgress {
    items_completed: number;
    target_items: number;
    current_se: number;
    converged: boolean;
    current_level: number;
    elapsed_minutes: number;
}

// =============================================================================
// SESSION STORAGE (In production, use Redis)
// =============================================================================

const activeDiagnosticSessions = new Map<string, DiagnosticSession>();
const activeMultiStatSessions = new Map<string, MultiStatSession>();

// Session ID generators
function generateSessionId(prefix: string = 'forge'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateResumeToken(): string {
    return `resume_${Math.random().toString(36).slice(2, 12)}`;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function thetaToLevel(theta: number): number {
    // Map theta (-3 to +3) to level (10 to 95)
    const normalized = (theta + 3) / 6;
    return Math.round(10 + normalized * 85);
}

function calculateConfidenceInterval(estimate: AbilityEstimate): { low: number; high: number } {
    const se = estimate.standard_error;
    return {
        low: thetaToLevel(estimate.theta - 1.96 * se),
        high: thetaToLevel(estimate.theta + 1.96 * se),
    };
}

function checkTerminationCriteria(session: DiagnosticSession): { terminate: boolean; reason?: string } {
    // Max items reached
    if (session.items_history.length >= session.target_items) {
        return { terminate: true, reason: 'max_items_reached' };
    }

    // Convergence achieved (low SE) - minimum 8 items required
    if (session.ability_estimate.standard_error < session.convergence_threshold &&
        session.items_history.length >= 8) {
        return { terminate: true, reason: 'convergence_achieved' };
    }

    // Ceiling/floor detection after sufficient items
    if (session.items_history.length >= 10) {
        const recentEvals = session.evaluations.slice(-6);
        const allCorrect = recentEvals.every(e => e.is_correct);
        const allWrong = recentEvals.every(e => !e.is_correct);

        if (allCorrect && session.ability_estimate.theta > 2.5) {
            return { terminate: true, reason: 'ceiling_effect' };
        }
        if (allWrong && session.ability_estimate.theta < -2.5) {
            return { terminate: true, reason: 'floor_effect' };
        }
    }

    return { terminate: false };
}

function calculateSessionProgress(session: DiagnosticSession): SessionProgress {
    const elapsedMs = Date.now() - new Date(session.created_at).getTime();
    return {
        items_completed: session.items_history.length,
        target_items: session.target_items,
        current_se: session.ability_estimate.standard_error,
        converged: session.ability_estimate.standard_error < session.convergence_threshold,
        current_level: thetaToLevel(session.ability_estimate.theta),
        elapsed_minutes: Math.round(elapsedMs / 60000),
    };
}

// =============================================================================
// GET HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    try {
        const studentId = await getStudentIdFromRequest();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        console.log(`[Forge v4 GET] Action: ${action}, Student: ${studentId}`);

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // SESSION: Get current session state
            // ─────────────────────────────────────────────────────────────────
            case 'session': {
                const sessionId = searchParams.get('session_id');
                if (!sessionId) {
                    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
                }

                // Check diagnostic sessions first
                let session = activeDiagnosticSessions.get(sessionId);
                if (session && session.student_id === studentId) {
                    return NextResponse.json({
                        success: true,
                        data: {
                            session_id: session.id,
                            session_type: session.session_type,
                            stat_name: session.stat_name,
                            status: session.status,
                            progress: calculateSessionProgress(session),
                            current_estimate: {
                                theta: session.ability_estimate.theta,
                                level: thetaToLevel(session.ability_estimate.theta),
                                confidence_interval: calculateConfidenceInterval(session.ability_estimate),
                            },
                            strand_breakdown: Object.entries(session.ability_estimate.strand_estimates).map(
                                ([strand, est]) => ({
                                    strand,
                                    theta: est.theta,
                                    level: thetaToLevel(est.theta),
                                    items: est.items,
                                })
                            ),
                            manifold_profile: session.ability_estimate.manifold_profile,
                            created_at: session.created_at,
                            updated_at: session.updated_at,
                        },
                    });
                }

                // Check multi-stat sessions
                const multiSession = activeMultiStatSessions.get(sessionId);
                if (multiSession && multiSession.student_id === studentId) {
                    const currentStat = multiSession.stats_queue[multiSession.current_stat_index];
                    const currentStatSession = multiSession.stat_sessions[currentStat];

                    return NextResponse.json({
                        success: true,
                        data: {
                            session_id: multiSession.id,
                            session_type: 'multi_stat',
                            status: multiSession.status,
                            stats_queue: multiSession.stats_queue,
                            current_stat: currentStat,
                            current_stat_index: multiSession.current_stat_index,
                            stats_completed: multiSession.current_stat_index,
                            stats_total: multiSession.stats_queue.length,
                            current_progress: currentStatSession ? calculateSessionProgress(currentStatSession) : null,
                            completed_stats: Object.entries(multiSession.stat_sessions)
                                .filter(([_, s]) => s.status === 'completed')
                                .map(([stat, s]) => ({
                                    stat_name: stat,
                                    level: thetaToLevel(s.ability_estimate.theta),
                                    items: s.items_history.length,
                                })),
                            created_at: multiSession.created_at,
                        },
                    });
                }

                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            // ─────────────────────────────────────────────────────────────────
            // NEXT-ITEM: Get next assessment item
            // ─────────────────────────────────────────────────────────────────
            case 'next-item': {
                const sessionId = searchParams.get('session_id');
                if (!sessionId) {
                    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
                }

                // Try diagnostic session
                let session = activeDiagnosticSessions.get(sessionId);

                // Try multi-stat - get current stat's session
                if (!session) {
                    const multiSession = activeMultiStatSessions.get(sessionId);
                    if (multiSession && multiSession.student_id === studentId) {
                        const currentStat = multiSession.stats_queue[multiSession.current_stat_index];
                        session = multiSession.stat_sessions[currentStat];
                    }
                }

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
                const termination = checkTerminationCriteria(session);
                if (termination.terminate) {
                    return NextResponse.json({
                        success: true,
                        complete: true,
                        reason: termination.reason,
                        final_level: thetaToLevel(session.ability_estimate.theta),
                        message: 'Assessment complete. Call POST with action=complete-session to finalize.',
                    });
                }

                // Generate next item
                const engine = getGenerativeEngine();
                const nextTarget = await engine.selectNextItem(
                    session.stat_name,
                    session.ability_estimate,
                    session.items_history
                );

                // Collect topics already tested for diversity
                const avoidTopics = session.items_history
                    .slice(-5)
                    .map(item => item.prompt.slice(0, 50));

                const newItem = await engine.generateItem(
                    session.stat_name,
                    nextTarget.strand,
                    nextTarget.tier,
                    nextTarget.difficulty,
                    nextTarget.manifold,
                    'multiple_choice',
                    avoidTopics
                );

                // Store pending item
                session.pending_item = newItem;
                session.updated_at = new Date().toISOString();

                console.log(`[Forge v4] Generated item ${newItem.id} for ${session.stat_name} at difficulty ${nextTarget.difficulty.toFixed(2)}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        item: {
                            id: newItem.id,
                            prompt: newItem.prompt,
                            options: newItem.options,
                            format: newItem.format,
                            strand: newItem.strand,
                            tier: newItem.tier,
                            manifold_focus: newItem.manifold_focus,
                        },
                        progress: calculateSessionProgress(session),
                        targeting: {
                            strand: nextTarget.strand,
                            tier: nextTarget.tier,
                            target_difficulty: nextTarget.difficulty,
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // PROGRESS: Get real-time progress
            // ─────────────────────────────────────────────────────────────────
            case 'progress': {
                const sessionId = searchParams.get('session_id');
                if (!sessionId) {
                    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
                }

                const session = activeDiagnosticSessions.get(sessionId);
                if (!session || session.student_id !== studentId) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                const progress = calculateSessionProgress(session);
                const recentItems = session.items_history.slice(-5);
                const recentEvals = session.evaluations.slice(-5);

                return NextResponse.json({
                    success: true,
                    data: {
                        progress,
                        ability_trajectory: session.items_history.map((_, i) => ({
                            item_number: i + 1,
                            correct: session.evaluations[i]?.is_correct,
                            theta_after: i === 0 ? 0 : session.ability_estimate.theta, // Simplified
                        })),
                        recent_performance: recentEvals.map((e, i) => ({
                            strand: recentItems[i]?.strand,
                            correct: e.is_correct,
                            score: e.score,
                        })),
                        termination_check: checkTerminationCriteria(session),
                    },
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // AVAILABLE-STATS: List stats available for assessment
            // ─────────────────────────────────────────────────────────────────
            case 'available-stats': {
                const db = getDatabase();

                // Get student's current stat levels
                const currentLevels = db.prepare(`
                    SELECT stat_name, level, theta, last_assessed_at
                    FROM hyro_student_stats
                    WHERE student_id = ?
                `).all(studentId) as Array<{
                    stat_name: StatName;
                    level: number;
                    theta: number;
                    last_assessed_at: string | null;
                }>;

                const levelMap = new Map(currentLevels.map(s => [s.stat_name, s]));

                const stats = STAT_NAMES.map(stat => {
                    const blueprint = getBlueprint(stat);
                    const current = levelMap.get(stat);

                    return {
                        stat_name: stat,
                        display_name: stat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        current_level: current?.level ?? null,
                        last_assessed: current?.last_assessed_at ?? null,
                        strands_count: blueprint.strands.length,
                        tiers: [...new Set(blueprint.strands.map(s => s.tier))],
                        assessment_ready: true,
                    };
                });

                return NextResponse.json({
                    success: true,
                    data: {
                        stats,
                        recommended: stats
                            .filter(s => !s.last_assessed || s.current_level === null)
                            .slice(0, 3)
                            .map(s => s.stat_name),
                    },
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: ['session', 'next-item', 'progress', 'available-stats'],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 GET] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, { status: 500 });
    }
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const studentId = await getStudentIdFromRequest();
        const body = await request.json();
        const { action } = body;

        console.log(`[Forge v4 POST] Action: ${action}, Student: ${studentId}`);

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // START-DIAGNOSTIC: Start a single-stat diagnostic
            // ─────────────────────────────────────────────────────────────────
            case 'start-diagnostic': {
                const { stat_name, target_items = 15, convergence_threshold = 0.35 } = body;

                if (!stat_name) {
                    return NextResponse.json({ error: 'stat_name required' }, { status: 400 });
                }

                if (!STAT_NAMES.includes(stat_name)) {
                    return NextResponse.json({
                        error: `Invalid stat_name: ${stat_name}`,
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                const blueprint = getBlueprint(stat_name as StatName);
                const sessionId = generateSessionId('diag');

                // ─────────────────────────────────────────────────────────────────
                // MEMORY INTEGRATION: Load student context and prior ability
                // ─────────────────────────────────────────────────────────────────
                const studentProfile = getStudentProfile(studentId);
                const statProfile = studentProfile.stat_profiles[stat_name as StatName];

                // Use prior ability estimate if available, otherwise start fresh
                const priorTheta = statProfile?.theta ?? 0;
                const priorSe = statProfile?.se ?? 1.5;

                // Get student's grade context for difficulty calibration
                let gradeContext: { grade: GradeLevel; benchmark_50th: number } | null = null;
                try {
                    const gradeProfile = getStudentGradeProfile(studentId);
                    if (gradeProfile?.enrolled_grade) {
                        const benchmark = getStatBenchmark(gradeProfile.enrolled_grade, stat_name as StatName);
                        gradeContext = {
                            grade: gradeProfile.enrolled_grade,
                            benchmark_50th: benchmark.benchmark_50th,
                        };
                    }
                } catch {
                    // Grade profile not available - continue with defaults
                }

                // Create ability estimate with prior knowledge
                const initialAbility = createInitialAbilityEstimate();
                initialAbility.theta = priorTheta;
                initialAbility.standard_error = Math.min(priorSe, 1.5); // Cap SE for returning students

                const session: DiagnosticSession = {
                    id: sessionId,
                    student_id: studentId,
                    session_type: 'diagnostic',
                    stat_name: stat_name as StatName,
                    status: 'active',
                    ability_estimate: initialAbility,
                    items_history: [],
                    evaluations: [],
                    target_items: Math.min(Math.max(target_items, 5), 50),
                    convergence_threshold: Math.min(Math.max(convergence_threshold, 0.2), 0.5),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                activeDiagnosticSessions.set(sessionId, session);

                // Log session start with context
                logSessionEvent(sessionId, studentId, 'session_started', {
                    stat_name,
                    target_items: session.target_items,
                    prior_theta: priorTheta,
                    prior_se: priorSe,
                    grade_context: gradeContext,
                    has_learning_history: statProfile?.items_administered > 0,
                });

                console.log(`[Forge v4] Started diagnostic session ${sessionId} for ${stat_name}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        session_id: sessionId,
                        stat_name,
                        session_type: 'diagnostic',
                        target_items: session.target_items,
                        blueprint_strands: blueprint.strands.map(s => ({
                            strand: s.strand,
                            tier: s.tier,
                            weight: s.weight,
                            manifold_focus: s.manifold_focus,
                        })),
                        message: 'Session started. Call GET with action=next-item to begin assessment.',
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // START-MULTI-STAT: Start multi-stat battery assessment
            // ─────────────────────────────────────────────────────────────────
            case 'start-multi-stat': {
                const { stats, items_per_stat = 10 } = body;

                if (!stats || !Array.isArray(stats) || stats.length === 0) {
                    return NextResponse.json({
                        error: 'stats array required',
                        example: { stats: ['math', 'reading', 'science'] },
                    }, { status: 400 });
                }

                // Validate all stats
                const invalidStats = stats.filter((s: string) => !STAT_NAMES.includes(s as StatName));
                if (invalidStats.length > 0) {
                    return NextResponse.json({
                        error: `Invalid stats: ${invalidStats.join(', ')}`,
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                const sessionId = generateSessionId('multi');
                const normalizedItems = Math.min(Math.max(items_per_stat, 5), 20);

                // Create the multi-stat session
                const multiSession: MultiStatSession = {
                    id: sessionId,
                    student_id: studentId,
                    status: 'active',
                    stats_queue: stats as StatName[],
                    current_stat_index: 0,
                    stat_sessions: {} as Record<StatName, DiagnosticSession>,
                    items_per_stat: normalizedItems,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                // Initialize first stat session
                const firstStat = stats[0] as StatName;
                const firstStatSession: DiagnosticSession = {
                    id: `${sessionId}_${firstStat}`,
                    student_id: studentId,
                    session_type: 'multi_stat',
                    stat_name: firstStat,
                    status: 'active',
                    ability_estimate: createInitialAbilityEstimate(),
                    items_history: [],
                    evaluations: [],
                    target_items: normalizedItems,
                    convergence_threshold: 0.4, // Slightly looser for battery
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                multiSession.stat_sessions[firstStat] = firstStatSession;
                activeMultiStatSessions.set(sessionId, multiSession);
                activeDiagnosticSessions.set(firstStatSession.id, firstStatSession);

                logSessionEvent(sessionId, studentId, 'multi_stat_started', {
                    stats,
                    items_per_stat: normalizedItems,
                });

                console.log(`[Forge v4] Started multi-stat session ${sessionId} for ${stats.join(', ')}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        session_id: sessionId,
                        session_type: 'multi_stat',
                        stats_queue: stats,
                        items_per_stat: normalizedItems,
                        estimated_duration_minutes: stats.length * normalizedItems * 1.5, // ~1.5 min per item
                        current_stat: firstStat,
                        current_stat_session_id: firstStatSession.id,
                        message: 'Multi-stat assessment started. Call GET with action=next-item to begin.',
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // SUBMIT-RESPONSE: Submit answer and get evaluation
            // ─────────────────────────────────────────────────────────────────
            case 'submit-response': {
                const { session_id, response, response_time_ms } = body;

                if (!session_id || response === undefined) {
                    return NextResponse.json({
                        error: 'session_id and response required',
                    }, { status: 400 });
                }

                // Find the session
                let session = activeDiagnosticSessions.get(session_id);
                let multiSession: MultiStatSession | undefined;

                // Check if this is a multi-stat session
                if (!session) {
                    multiSession = activeMultiStatSessions.get(session_id);
                    if (multiSession && multiSession.student_id === studentId) {
                        const currentStat = multiSession.stats_queue[multiSession.current_stat_index];
                        session = multiSession.stat_sessions[currentStat];
                    }
                }

                if (!session || session.student_id !== studentId) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                if (!session.pending_item) {
                    return NextResponse.json({
                        error: 'No pending item. Call GET with action=next-item first.',
                    }, { status: 400 });
                }

                const pendingItem = session.pending_item;

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
                delete session.pending_item;
                session.updated_at = new Date().toISOString();

                // Save snapshot
                await saveSessionSnapshot(session);

                // Check termination
                const termination = checkTerminationCriteria(session);

                // Handle multi-stat progression
                let multiStatUpdate = null;
                if (multiSession && termination.terminate) {
                    session.status = 'completed';
                    multiSession.current_stat_index++;

                    if (multiSession.current_stat_index < multiSession.stats_queue.length) {
                        // Start next stat
                        const nextStat = multiSession.stats_queue[multiSession.current_stat_index];
                        const nextStatSession: DiagnosticSession = {
                            id: `${multiSession.id}_${nextStat}`,
                            student_id: studentId,
                            session_type: 'multi_stat',
                            stat_name: nextStat,
                            status: 'active',
                            ability_estimate: createInitialAbilityEstimate(),
                            items_history: [],
                            evaluations: [],
                            target_items: multiSession.items_per_stat,
                            convergence_threshold: 0.4,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        };

                        multiSession.stat_sessions[nextStat] = nextStatSession;
                        activeDiagnosticSessions.set(nextStatSession.id, nextStatSession);

                        multiStatUpdate = {
                            previous_stat_completed: session.stat_name,
                            next_stat: nextStat,
                            stats_remaining: multiSession.stats_queue.length - multiSession.current_stat_index,
                        };
                    } else {
                        // All stats complete
                        multiSession.status = 'completed';
                        multiStatUpdate = {
                            all_stats_completed: true,
                            message: 'All stats assessed. Call POST with action=complete-session to finalize.',
                        };
                    }
                    multiSession.updated_at = new Date().toISOString();
                }

                console.log(`[Forge v4] Response evaluated for item ${pendingItem.id}: correct=${evaluation.is_correct}, score=${evaluation.score.toFixed(2)}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        evaluation: {
                            is_correct: evaluation.is_correct,
                            score: evaluation.score,
                            feedback: evaluation.feedback,
                            misconception_detected: evaluation.misconception_detected,
                            error_type: evaluation.error_type,
                            suggested_remediation: evaluation.suggested_remediation,
                        },
                        correct_answer: pendingItem.correct_answer,
                        solution_path: evaluation.is_correct ? undefined : pendingItem.solution_path,
                        updated_estimate: {
                            theta: newEstimate.theta,
                            level: thetaToLevel(newEstimate.theta),
                            standard_error: newEstimate.standard_error,
                            confidence_interval: calculateConfidenceInterval(newEstimate),
                        },
                        progress: calculateSessionProgress(session),
                        manifold_signals: {
                            coherence: evaluation.coherence_signal,
                            fluidity: evaluation.fluidity_signal,
                            elasticity: evaluation.elasticity_signal,
                        },
                        session_status: termination.terminate ? 'completing' : 'active',
                        termination_reason: termination.reason,
                        multi_stat_update: multiStatUpdate,
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // PAUSE-SESSION: Pause session for later resumption
            // ─────────────────────────────────────────────────────────────────
            case 'pause-session': {
                const { session_id } = body;

                if (!session_id) {
                    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
                }

                const session = activeDiagnosticSessions.get(session_id);
                if (!session || session.student_id !== studentId) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                if (session.status !== 'active') {
                    return NextResponse.json({
                        error: `Cannot pause session in ${session.status} status`,
                    }, { status: 400 });
                }

                const resumeToken = generateResumeToken();
                session.status = 'paused';
                session.pause_data = {
                    paused_at: new Date().toISOString(),
                    resume_token: resumeToken,
                };
                session.updated_at = new Date().toISOString();

                // Save to DB for persistence
                await saveSessionSnapshot(session);

                logSessionEvent(session_id, studentId, 'session_paused', {
                    items_completed: session.items_history.length,
                });

                console.log(`[Forge v4] Session ${session_id} paused`);

                return NextResponse.json({
                    success: true,
                    data: {
                        session_id,
                        status: 'paused',
                        resume_token: resumeToken,
                        progress: calculateSessionProgress(session),
                        message: 'Session paused. Use resume_token to continue later.',
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                    },
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // RESUME-SESSION: Resume a paused session
            // ─────────────────────────────────────────────────────────────────
            case 'resume-session': {
                const { session_id, resume_token } = body;

                if (!session_id || !resume_token) {
                    return NextResponse.json({
                        error: 'session_id and resume_token required',
                    }, { status: 400 });
                }

                let session = activeDiagnosticSessions.get(session_id);

                // If not in memory, try to restore from DB
                if (!session) {
                    session = await restoreSessionFromDb(session_id, studentId);
                    if (session) {
                        activeDiagnosticSessions.set(session_id, session);
                    }
                }

                if (!session || session.student_id !== studentId) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                if (session.status !== 'paused') {
                    return NextResponse.json({
                        error: `Cannot resume session in ${session.status} status`,
                    }, { status: 400 });
                }

                if (session.pause_data?.resume_token !== resume_token) {
                    return NextResponse.json({ error: 'Invalid resume token' }, { status: 401 });
                }

                session.status = 'active';
                delete session.pause_data;
                session.updated_at = new Date().toISOString();

                logSessionEvent(session_id, studentId, 'session_resumed', {
                    items_completed: session.items_history.length,
                });

                console.log(`[Forge v4] Session ${session_id} resumed`);

                return NextResponse.json({
                    success: true,
                    data: {
                        session_id,
                        status: 'active',
                        progress: calculateSessionProgress(session),
                        current_estimate: {
                            theta: session.ability_estimate.theta,
                            level: thetaToLevel(session.ability_estimate.theta),
                        },
                        message: 'Session resumed. Call GET with action=next-item to continue.',
                    },
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // COMPLETE-SESSION: End and finalize results
            // ─────────────────────────────────────────────────────────────────
            case 'complete-session': {
                const { session_id, force = false } = body;

                if (!session_id) {
                    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
                }

                // Check for multi-stat session
                const multiSession = activeMultiStatSessions.get(session_id);
                if (multiSession && multiSession.student_id === studentId) {
                    return await completeMultiStatSession(multiSession, studentId, startTime);
                }

                // Regular diagnostic session
                const session = activeDiagnosticSessions.get(session_id);
                if (!session || session.student_id !== studentId) {
                    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
                }

                // Check if enough items were completed
                if (session.items_history.length < 5 && !force) {
                    return NextResponse.json({
                        error: 'Minimum 5 items required for valid assessment',
                        items_completed: session.items_history.length,
                        hint: 'Use force=true to complete anyway',
                    }, { status: 400 });
                }

                session.status = 'completed';
                session.updated_at = new Date().toISOString();

                const finalResults = formatFinalResults(session);
                await saveFinalResults(session, finalResults);

                // Cleanup after delay
                setTimeout(() => {
                    activeDiagnosticSessions.delete(session_id);
                }, 10 * 60 * 1000); // 10 minutes

                logSessionEvent(session_id, studentId, 'session_completed', {
                    items: session.items_history.length,
                    final_level: finalResults.overall.estimated_level,
                });

                console.log(`[Forge v4] Session ${session_id} completed with level ${finalResults.overall.estimated_level}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        status: 'completed',
                        results: finalResults,
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: [
                        'start-diagnostic',
                        'start-multi-stat',
                        'submit-response',
                        'pause-session',
                        'resume-session',
                        'complete-session',
                    ],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 POST] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, { status: 500 });
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function completeMultiStatSession(
    multiSession: MultiStatSession,
    studentId: string,
    startTime: number
): Promise<NextResponse> {
    multiSession.status = 'completed';
    multiSession.updated_at = new Date().toISOString();

    const statResults: Record<string, any> = {};

    for (const [stat, session] of Object.entries(multiSession.stat_sessions)) {
        if (session.items_history.length > 0) {
            const results = formatFinalResults(session);
            statResults[stat] = results;
            await saveFinalResults(session, results);
        }
    }

    // Cleanup
    setTimeout(() => {
        activeMultiStatSessions.delete(multiSession.id);
        for (const stat of multiSession.stats_queue) {
            const sessionId = `${multiSession.id}_${stat}`;
            activeDiagnosticSessions.delete(sessionId);
        }
    }, 10 * 60 * 1000);

    logSessionEvent(multiSession.id, studentId, 'multi_stat_completed', {
        stats_assessed: Object.keys(statResults),
    });

    return NextResponse.json({
        success: true,
        data: {
            status: 'completed',
            session_type: 'multi_stat',
            stats_assessed: multiSession.stats_queue,
            results_by_stat: statResults,
            summary: {
                strongest_stat: Object.entries(statResults)
                    .sort((a, b) => b[1].overall.estimated_level - a[1].overall.estimated_level)[0]?.[0],
                weakest_stat: Object.entries(statResults)
                    .sort((a, b) => a[1].overall.estimated_level - b[1].overall.estimated_level)[0]?.[0],
                average_level: Math.round(
                    Object.values(statResults).reduce((sum: number, r: any) => sum + r.overall.estimated_level, 0) /
                    Object.keys(statResults).length
                ),
            },
        },
        timing_ms: Date.now() - startTime,
    });
}

function formatFinalResults(session: DiagnosticSession) {
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
            overall_accuracy: session.evaluations.length > 0
                ? session.evaluations.filter(e => e.is_correct).length / session.evaluations.length
                : 0,
            assessment_duration_minutes: Math.round(
                (Date.now() - new Date(session.created_at).getTime()) / 60000
            ),
        },
        strand_breakdown: strandResults,
        strengths: strengths.map(s => ({
            strand: s.strand,
            level: s.estimated_level,
            tier: s.tier,
        })),
        skill_gaps: gaps.map(s => ({
            strand: s.strand,
            level: s.estimated_level,
            tier: s.tier,
        })),
        manifold_profile: session.ability_estimate.manifold_profile,
        misconceptions_detected: [...new Set(misconceptions)],
        recommendations: generateRecommendations(session, strandResults, gaps, misconceptions),
    };
}

function generateRecommendations(
    session: DiagnosticSession,
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
        recommendations.push(`Address common misconceptions: ${misconceptions.slice(0, 2).join('; ')}`);
    }

    // Tier-based recommendations
    const highestTier = strandResults
        .filter(s => s.accuracy && s.accuracy > 0.7)
        .sort((a, b) => {
            const tierOrder = { 'Foundation': 0, 'Bridge': 1, 'Power': 2, 'Horizon': 3 };
            return tierOrder[b.tier as StrandTier] - tierOrder[a.tier as StrandTier];
        })[0];

    if (highestTier) {
        const nextTier: Record<StrandTier, string> = {
            'Foundation': 'Bridge',
            'Bridge': 'Power',
            'Power': 'Horizon',
            'Horizon': 'research-level challenges',
        };
        recommendations.push(`Ready to advance to ${nextTier[highestTier.tier as StrandTier]} tier content`);
    }

    return recommendations;
}

async function saveSessionSnapshot(session: DiagnosticSession): Promise<void> {
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
                items_history: session.items_history.map(i => ({
                    id: i.id,
                    strand: i.strand,
                    tier: i.tier,
                    difficulty: i.difficulty,
                })),
                evaluations_summary: session.evaluations.map(e => ({
                    correct: e.is_correct,
                    score: e.score,
                    misconception: e.misconception_detected,
                })),
                pause_data: session.pause_data,
            }),
            session.updated_at
        );
    } catch (error) {
        console.error('[Forge v4] Failed to save session snapshot:', error);
    }
}

async function restoreSessionFromDb(sessionId: string, studentId: string): Promise<DiagnosticSession | null> {
    try {
        const db = getDatabase();
        const row = db.prepare(`
            SELECT * FROM hyro_generative_sessions
            WHERE id = ? AND student_id = ?
        `).get(sessionId, studentId) as any;

        if (!row) return null;

        const data = JSON.parse(row.data_json);

        return {
            id: row.id,
            student_id: row.student_id,
            session_type: 'diagnostic',
            stat_name: row.stat_name as StatName,
            status: row.status,
            ability_estimate: data.ability_estimate,
            items_history: data.items_history || [],
            evaluations: data.evaluations_summary || [],
            target_items: 15,
            convergence_threshold: 0.35,
            pause_data: data.pause_data,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at,
        };
    } catch (error) {
        console.error('[Forge v4] Failed to restore session:', error);
        return null;
    }
}

async function saveFinalResults(session: DiagnosticSession, results: any): Promise<void> {
    try {
        const db = getDatabase();

        // Save to results table
        db.prepare(`
            INSERT INTO hyro_generative_results
            (id, student_id, stat_name, session_id, estimated_level, theta, standard_error, items_count, results_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            `result_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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

        // ─────────────────────────────────────────────────────────────────
        // MEMORY ARCHITECTURE INTEGRATION
        // Update long-term learning profile with session results
        // ─────────────────────────────────────────────────────────────────

        // 1. Update stat profile with new ability estimate
        updateStatProfile(session.student_id, session.stat_name, {
            theta: results.overall.theta,
            se: results.overall.standard_error,
            items: session.items_history.length,
            accuracy: results.overall.overall_accuracy,
            manifold_updates: results.manifold_profile,
        });

        // 2. Record detected misconceptions for long-term tracking
        if (results.misconceptions_detected && results.misconceptions_detected.length > 0) {
            for (const misconception of results.misconceptions_detected) {
                // Find the strand this misconception came from
                const relatedEval = session.evaluations.find(e => e.misconception_detected === misconception);
                const relatedItem = relatedEval
                    ? session.items_history.find(i => i.id === relatedEval.item_id)
                    : null;

                recordMisconception(
                    session.student_id,
                    session.stat_name,
                    relatedItem?.strand || 'general',
                    misconception,
                    relatedItem?.id
                );
            }
        }

        // 3. Record learning event for this assessment
        recordLearningEvent(
            session.student_id,
            'assessment_completed',
            {
                final_theta: results.overall.theta,
                final_level: results.overall.estimated_level,
                items_count: session.items_history.length,
                accuracy: results.overall.overall_accuracy,
                strengths: results.strengths?.map((s: any) => s.strand) || [],
                gaps: results.skill_gaps?.map((g: any) => g.strand) || [],
            },
            session.stat_name,      // statName
            undefined,               // strand
            session.id              // sessionId
        );

        console.log(`[Forge v4] Memory updated for student ${session.student_id}, stat ${session.stat_name}`);

    } catch (error) {
        console.error('[Forge v4] Failed to save final results:', error);
    }
}

function logSessionEvent(sessionId: string, studentId: string, event: string, data: any): void {
    try {
        const db = getDatabase();
        db.prepare(`
            INSERT INTO hyro_session_events
            (session_id, student_id, event_type, event_data, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(sessionId, studentId, event, JSON.stringify(data), new Date().toISOString());
    } catch (error) {
        // Non-critical - log and continue
        console.warn('[Forge v4] Failed to log event:', error);
    }
}
