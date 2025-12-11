/**
 * HYRO FORGE v4: Administration API
 *
 * @hyro-domain system_admin
 * @hyro-manifold Audit logging, statistics, and system calibration
 *
 * ENDPOINTS:
 * GET ?action=item-log - Generated items audit log
 * GET ?action=session-stats - Session and usage statistics
 * GET ?action=system-health - System health and performance metrics
 * POST action=calibrate - Recalibrate difficulty parameters
 *
 * This API provides administrative and monitoring capabilities
 * for the HYRO Forge assessment system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest, getCurrentStudent } from '@/lib/hyro/student-auth';
import { getBlueprint, type StrandTier } from '@/lib/hyro/forge-blueprints';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';

// =============================================================================
// TYPES
// =============================================================================

interface ItemLogEntry {
    id: string;
    session_id: string;
    stat_name: StatName;
    strand: string;
    tier: StrandTier;
    difficulty: number;
    format: string;
    correct: boolean;
    response_time_ms: number | null;
    generated_at: string;
}

interface SessionStats {
    total_sessions: number;
    completed_sessions: number;
    abandoned_sessions: number;
    average_items_per_session: number;
    average_session_duration_minutes: number;
    total_items_generated: number;
    average_accuracy: number;
}

interface CalibrationResult {
    stat_name: StatName;
    strand: string;
    original_difficulty: number;
    observed_accuracy: number;
    calibrated_difficulty: number;
    sample_size: number;
    confidence: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function thetaToLevel(theta: number): number {
    const normalized = (theta + 3) / 6;
    return Math.round(10 + normalized * 85);
}

function calculateAccuracyFromTheta(theta: number, difficulty: number): number {
    // IRT 1PL model: P(correct) = 1 / (1 + e^-(theta - difficulty))
    const difficultyTheta = (difficulty - 0.5) * 4; // Map difficulty to theta scale
    return 1 / (1 + Math.exp(-(theta - difficultyTheta)));
}

function calculateCalibratedDifficulty(
    originalDifficulty: number,
    observedAccuracy: number,
    expectedAccuracy: number = 0.5
): number {
    // If students are getting it right more often than expected, it's easier than rated
    const accuracyDiff = observedAccuracy - expectedAccuracy;

    // Adjust difficulty based on accuracy deviation
    // More accurate = lower difficulty, less accurate = higher difficulty
    const adjustment = -accuracyDiff * 0.3; // Damping factor

    return Math.max(0.05, Math.min(0.95, originalDifficulty + adjustment));
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

        console.log(`[Forge v4 Admin GET] Action: ${action}, Student: ${studentId}`);

        const db = getDatabase();

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // ITEM-LOG: Generated items audit log
            // ─────────────────────────────────────────────────────────────────
            case 'item-log': {
                const sessionId = searchParams.get('session_id');
                const statName = searchParams.get('stat_name');
                const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
                const offset = parseInt(searchParams.get('offset') || '0', 10);
                const includeContent = searchParams.get('include_content') === 'true';

                // Get items from session data
                let query = `
                    SELECT
                        s.id as session_id,
                        s.stat_name,
                        s.data_json,
                        s.created_at as session_created,
                        r.results_json
                    FROM hyro_generative_sessions s
                    LEFT JOIN hyro_generative_results r ON s.id = r.session_id
                    WHERE s.student_id = ?
                `;
                const params: any[] = [studentId];

                if (sessionId) {
                    query += ' AND s.id = ?';
                    params.push(sessionId);
                }

                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    query += ' AND s.stat_name = ?';
                    params.push(statName);
                }

                query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const sessions = db.prepare(query).all(...params) as Array<{
                    session_id: string;
                    stat_name: StatName;
                    data_json: string;
                    session_created: string;
                    results_json: string | null;
                }>;

                // Extract item-level data
                const itemLog: ItemLogEntry[] = [];

                for (const session of sessions) {
                    try {
                        const sessionData = JSON.parse(session.data_json || '{}');
                        const resultsData = session.results_json ? JSON.parse(session.results_json) : null;

                        const items = sessionData.items_history || [];
                        const evaluations = sessionData.evaluations_summary || [];

                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const evaluation = evaluations[i];

                            itemLog.push({
                                id: item.id || `item_${i}`,
                                session_id: session.session_id,
                                stat_name: session.stat_name,
                                strand: item.strand || 'Unknown',
                                tier: item.tier || 'Foundation',
                                difficulty: item.difficulty || 0.5,
                                format: item.format || 'multiple_choice',
                                correct: evaluation?.correct ?? false,
                                response_time_ms: null, // Not stored in summary
                                generated_at: session.session_created,
                            });
                        }
                    } catch (parseError) {
                        console.warn(`Failed to parse session ${session.session_id}:`, parseError);
                    }
                }

                // Calculate aggregate stats
                const totalItems = itemLog.length;
                const correctItems = itemLog.filter(i => i.correct).length;
                const avgDifficulty = itemLog.length > 0
                    ? itemLog.reduce((sum, i) => sum + i.difficulty, 0) / itemLog.length
                    : 0;

                // Group by strand
                const byStrand = itemLog.reduce((acc, item) => {
                    acc[item.strand] = acc[item.strand] || { count: 0, correct: 0, totalDifficulty: 0 };
                    acc[item.strand].count++;
                    if (item.correct) acc[item.strand].correct++;
                    acc[item.strand].totalDifficulty += item.difficulty;
                    return acc;
                }, {} as Record<string, { count: number; correct: number; totalDifficulty: number }>);

                const strandStats = Object.entries(byStrand).map(([strand, data]) => ({
                    strand,
                    items_count: data.count,
                    accuracy: data.correct / data.count,
                    avg_difficulty: data.totalDifficulty / data.count,
                }));

                return NextResponse.json({
                    success: true,
                    data: {
                        items: includeContent ? itemLog : itemLog.map(({ ...item }) => item),
                        pagination: {
                            total: totalItems,
                            limit,
                            offset,
                            has_more: sessions.length === limit,
                        },
                        aggregate: {
                            total_items: totalItems,
                            correct_items: correctItems,
                            overall_accuracy: totalItems > 0 ? correctItems / totalItems : 0,
                            average_difficulty: avgDifficulty,
                        },
                        by_strand: strandStats.sort((a, b) => b.items_count - a.items_count),
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // SESSION-STATS: Session and usage statistics
            // ─────────────────────────────────────────────────────────────────
            case 'session-stats': {
                const statName = searchParams.get('stat_name');
                const periodDays = parseInt(searchParams.get('period_days') || '30', 10);
                const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

                // Base query for sessions
                let sessionQuery = `
                    SELECT
                        stat_name,
                        status,
                        items_count,
                        ability_theta,
                        ability_se,
                        created_at,
                        updated_at
                    FROM hyro_generative_sessions
                    WHERE student_id = ? AND created_at >= ?
                `;
                const sessionParams: any[] = [studentId, cutoffDate];

                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    sessionQuery += ' AND stat_name = ?';
                    sessionParams.push(statName);
                }

                const sessions = db.prepare(sessionQuery).all(...sessionParams) as Array<{
                    stat_name: StatName;
                    status: string;
                    items_count: number;
                    ability_theta: number;
                    ability_se: number;
                    created_at: string;
                    updated_at: string;
                }>;

                // Calculate statistics
                const totalSessions = sessions.length;
                const completedSessions = sessions.filter(s => s.status === 'completed').length;
                const abandonedSessions = sessions.filter(s => s.status === 'abandoned').length;
                const pausedSessions = sessions.filter(s => s.status === 'paused').length;

                const totalItems = sessions.reduce((sum, s) => sum + (s.items_count || 0), 0);
                const avgItemsPerSession = totalSessions > 0 ? totalItems / totalSessions : 0;

                // Calculate session durations
                const sessionDurations = sessions.map(s => {
                    const start = new Date(s.created_at).getTime();
                    const end = new Date(s.updated_at).getTime();
                    return (end - start) / 60000; // Minutes
                });
                const avgDuration = sessionDurations.length > 0
                    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
                    : 0;

                // Get results for accuracy calculation
                let resultsQuery = `
                    SELECT results_json
                    FROM hyro_generative_results
                    WHERE student_id = ? AND created_at >= ?
                `;
                const resultsParams: any[] = [studentId, cutoffDate];

                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    resultsQuery += ' AND stat_name = ?';
                    resultsParams.push(statName);
                }

                const results = db.prepare(resultsQuery).all(...resultsParams) as Array<{ results_json: string }>;

                let totalAccuracySum = 0;
                let accuracyCount = 0;
                for (const result of results) {
                    const data = JSON.parse(result.results_json);
                    if (data.overall?.overall_accuracy != null) {
                        totalAccuracySum += data.overall.overall_accuracy;
                        accuracyCount++;
                    }
                }

                // Stats by stat name
                const statNameCounts = sessions.reduce((acc, s) => {
                    acc[s.stat_name] = acc[s.stat_name] || { sessions: 0, items: 0 };
                    acc[s.stat_name].sessions++;
                    acc[s.stat_name].items += s.items_count || 0;
                    return acc;
                }, {} as Record<StatName, { sessions: number; items: number }>);

                // Daily activity
                const dailyActivity = sessions.reduce((acc, s) => {
                    const date = s.created_at.split('T')[0];
                    acc[date] = acc[date] || { sessions: 0, items: 0 };
                    acc[date].sessions++;
                    acc[date].items += s.items_count || 0;
                    return acc;
                }, {} as Record<string, { sessions: number; items: number }>);

                const stats: SessionStats = {
                    total_sessions: totalSessions,
                    completed_sessions: completedSessions,
                    abandoned_sessions: abandonedSessions,
                    average_items_per_session: Math.round(avgItemsPerSession * 10) / 10,
                    average_session_duration_minutes: Math.round(avgDuration * 10) / 10,
                    total_items_generated: totalItems,
                    average_accuracy: accuracyCount > 0 ? totalAccuracySum / accuracyCount : 0,
                };

                return NextResponse.json({
                    success: true,
                    data: {
                        period_days: periodDays,
                        stats,
                        by_status: {
                            active: sessions.filter(s => s.status === 'active').length,
                            completed: completedSessions,
                            paused: pausedSessions,
                            abandoned: abandonedSessions,
                        },
                        by_stat: Object.entries(statNameCounts).map(([stat, data]) => ({
                            stat_name: stat,
                            ...data,
                            avg_items: data.sessions > 0 ? Math.round(data.items / data.sessions * 10) / 10 : 0,
                        })),
                        daily_activity: Object.entries(dailyActivity)
                            .map(([date, data]) => ({ date, ...data }))
                            .sort((a, b) => a.date.localeCompare(b.date)),
                        trends: {
                            sessions_trend: calculateTrend(
                                Object.entries(dailyActivity).map(([_, d]) => d.sessions)
                            ),
                            items_trend: calculateTrend(
                                Object.entries(dailyActivity).map(([_, d]) => d.items)
                            ),
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // SYSTEM-HEALTH: System health and performance metrics
            // ─────────────────────────────────────────────────────────────────
            case 'system-health': {
                // Get recent session events for timing analysis
                const recentEvents = db.prepare(`
                    SELECT event_type, event_data, created_at
                    FROM hyro_session_events
                    WHERE created_at >= ?
                    ORDER BY created_at DESC
                    LIMIT 1000
                `).all(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as Array<{
                    event_type: string;
                    event_data: string;
                    created_at: string;
                }>;

                // Count events by type
                const eventCounts = recentEvents.reduce((acc, e) => {
                    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                // Get database stats
                const tableStats = db.prepare(`
                    SELECT
                        (SELECT COUNT(*) FROM hyro_generative_sessions) as sessions,
                        (SELECT COUNT(*) FROM hyro_generative_results) as results,
                        (SELECT COUNT(*) FROM hyro_student_stats) as student_stats
                `).get() as { sessions: number; results: number; student_stats: number };

                // Check for any stuck sessions (active for > 2 hours)
                const stuckSessions = db.prepare(`
                    SELECT COUNT(*) as count
                    FROM hyro_generative_sessions
                    WHERE status = 'active'
                    AND datetime(updated_at) < datetime('now', '-2 hours')
                `).get() as { count: number };

                // Calculate item generation rate (items per hour)
                const recentSessions = db.prepare(`
                    SELECT SUM(items_count) as total_items
                    FROM hyro_generative_sessions
                    WHERE created_at >= ?
                `).get(new Date(Date.now() - 60 * 60 * 1000).toISOString()) as { total_items: number | null };

                const itemsPerHour = recentSessions.total_items || 0;

                return NextResponse.json({
                    success: true,
                    data: {
                        status: stuckSessions.count > 5 ? 'degraded' : 'healthy',
                        timestamp: new Date().toISOString(),
                        database: {
                            total_sessions: tableStats.sessions,
                            total_results: tableStats.results,
                            total_student_stats: tableStats.student_stats,
                        },
                        activity_24h: {
                            events_by_type: eventCounts,
                            total_events: recentEvents.length,
                        },
                        performance: {
                            items_per_hour: itemsPerHour,
                            stuck_sessions: stuckSessions.count,
                        },
                        alerts: [
                            ...(stuckSessions.count > 0 ? [{
                                level: stuckSessions.count > 5 ? 'warning' : 'info',
                                message: `${stuckSessions.count} sessions stuck in active state`,
                            }] : []),
                        ],
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // DIFFICULTY-ANALYSIS: Analyze item difficulty calibration
            // ─────────────────────────────────────────────────────────────────
            case 'difficulty-analysis': {
                const statName = searchParams.get('stat_name');

                if (!statName || !STAT_NAMES.includes(statName as StatName)) {
                    return NextResponse.json({
                        error: 'Valid stat_name required',
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                // Get all session data for analysis
                const sessions = db.prepare(`
                    SELECT data_json
                    FROM hyro_generative_sessions
                    WHERE stat_name = ? AND status = 'completed'
                    ORDER BY created_at DESC
                    LIMIT 100
                `).all(statName) as Array<{ data_json: string }>;

                // Aggregate item performance by strand and difficulty band
                const strandPerformance: Record<string, {
                    items: number;
                    correct: number;
                    difficulties: number[];
                }> = {};

                for (const session of sessions) {
                    try {
                        const data = JSON.parse(session.data_json || '{}');
                        const items = data.items_history || [];
                        const evaluations = data.evaluations_summary || [];

                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const evaluation = evaluations[i];
                            if (!item.strand) continue;

                            strandPerformance[item.strand] = strandPerformance[item.strand] || {
                                items: 0,
                                correct: 0,
                                difficulties: [],
                            };

                            strandPerformance[item.strand].items++;
                            if (evaluation?.correct) strandPerformance[item.strand].correct++;
                            strandPerformance[item.strand].difficulties.push(item.difficulty || 0.5);
                        }
                    } catch {
                        // Skip invalid sessions
                    }
                }

                // Calculate calibration suggestions
                const calibrationAnalysis = Object.entries(strandPerformance).map(([strand, data]) => {
                    const accuracy = data.items > 0 ? data.correct / data.items : 0;
                    const avgDifficulty = data.difficulties.length > 0
                        ? data.difficulties.reduce((a, b) => a + b, 0) / data.difficulties.length
                        : 0.5;

                    // Expected accuracy at difficulty should be ~50% for well-calibrated items
                    const expectedAccuracy = 0.5;
                    const calibrationError = Math.abs(accuracy - expectedAccuracy);

                    return {
                        strand,
                        items_analyzed: data.items,
                        observed_accuracy: accuracy,
                        average_difficulty: avgDifficulty,
                        calibration_error: calibrationError,
                        suggested_adjustment: accuracy > expectedAccuracy
                            ? 'increase_difficulty'
                            : accuracy < expectedAccuracy
                                ? 'decrease_difficulty'
                                : 'well_calibrated',
                        confidence: data.items >= 20 ? 'high' : data.items >= 10 ? 'medium' : 'low',
                    };
                });

                return NextResponse.json({
                    success: true,
                    data: {
                        stat_name: statName,
                        sessions_analyzed: sessions.length,
                        strand_analysis: calibrationAnalysis.sort((a, b) => b.items_analyzed - a.items_analyzed),
                        summary: {
                            total_strands: calibrationAnalysis.length,
                            well_calibrated: calibrationAnalysis.filter(s => s.suggested_adjustment === 'well_calibrated').length,
                            needs_increase: calibrationAnalysis.filter(s => s.suggested_adjustment === 'increase_difficulty').length,
                            needs_decrease: calibrationAnalysis.filter(s => s.suggested_adjustment === 'decrease_difficulty').length,
                            high_confidence_count: calibrationAnalysis.filter(s => s.confidence === 'high').length,
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: ['item-log', 'session-stats', 'system-health', 'difficulty-analysis'],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 Admin GET] Error:', error);
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

        console.log(`[Forge v4 Admin POST] Action: ${action}, Student: ${studentId}`);

        const db = getDatabase();

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // CALIBRATE: Recalibrate difficulty parameters
            // ─────────────────────────────────────────────────────────────────
            case 'calibrate': {
                const { stat_name, strand, apply_changes = false } = body;

                if (!stat_name || !STAT_NAMES.includes(stat_name as StatName)) {
                    return NextResponse.json({
                        error: 'Valid stat_name required',
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                // Get performance data
                const sessions = db.prepare(`
                    SELECT data_json
                    FROM hyro_generative_sessions
                    WHERE stat_name = ? AND status = 'completed'
                    ORDER BY created_at DESC
                    LIMIT 200
                `).all(stat_name) as Array<{ data_json: string }>;

                // Analyze by strand
                const strandData: Record<string, {
                    difficulties: number[];
                    accuracies: number[];
                    count: number;
                }> = {};

                for (const session of sessions) {
                    try {
                        const data = JSON.parse(session.data_json || '{}');
                        const items = data.items_history || [];
                        const evaluations = data.evaluations_summary || [];

                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const evaluation = evaluations[i];
                            if (!item.strand) continue;

                            // Skip if filtering by strand
                            if (strand && item.strand !== strand) continue;

                            strandData[item.strand] = strandData[item.strand] || {
                                difficulties: [],
                                accuracies: [],
                                count: 0,
                            };

                            strandData[item.strand].difficulties.push(item.difficulty || 0.5);
                            strandData[item.strand].accuracies.push(evaluation?.correct ? 1 : 0);
                            strandData[item.strand].count++;
                        }
                    } catch {
                        // Skip invalid sessions
                    }
                }

                // Calculate calibration for each strand
                const calibrationResults: CalibrationResult[] = [];

                for (const [strandName, data] of Object.entries(strandData)) {
                    if (data.count < 10) continue; // Need minimum sample

                    const avgDifficulty = data.difficulties.reduce((a, b) => a + b, 0) / data.difficulties.length;
                    const avgAccuracy = data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length;

                    const calibratedDifficulty = calculateCalibratedDifficulty(avgDifficulty, avgAccuracy);

                    calibrationResults.push({
                        stat_name: stat_name as StatName,
                        strand: strandName,
                        original_difficulty: avgDifficulty,
                        observed_accuracy: avgAccuracy,
                        calibrated_difficulty: calibratedDifficulty,
                        sample_size: data.count,
                        confidence: data.count >= 50 ? 0.9 : data.count >= 20 ? 0.7 : 0.5,
                    });
                }

                // Store calibration results if apply_changes is true
                if (apply_changes && calibrationResults.length > 0) {
                    const calibrationId = `cal_${Date.now()}`;
                    const now = new Date().toISOString();

                    // Ensure calibration table exists
                    try {
                        db.exec(`
                            CREATE TABLE IF NOT EXISTS hyro_calibration_history (
                                id TEXT PRIMARY KEY,
                                stat_name TEXT NOT NULL,
                                calibration_data TEXT NOT NULL,
                                applied_by TEXT NOT NULL,
                                created_at TEXT NOT NULL
                            );
                        `);
                    } catch {
                        // Table exists
                    }

                    db.prepare(`
                        INSERT INTO hyro_calibration_history
                        (id, stat_name, calibration_data, applied_by, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).run(
                        calibrationId,
                        stat_name,
                        JSON.stringify(calibrationResults),
                        studentId,
                        now
                    );

                    console.log(`[Forge v4 Admin] Applied calibration ${calibrationId} for ${stat_name}`);
                }

                return NextResponse.json({
                    success: true,
                    data: {
                        stat_name,
                        strand_filter: strand || null,
                        sessions_analyzed: sessions.length,
                        calibration_results: calibrationResults.sort((a, b) => b.sample_size - a.sample_size),
                        changes_applied: apply_changes,
                        summary: {
                            strands_calibrated: calibrationResults.length,
                            average_adjustment: calibrationResults.length > 0
                                ? calibrationResults.reduce(
                                    (sum, r) => sum + Math.abs(r.calibrated_difficulty - r.original_difficulty), 0
                                ) / calibrationResults.length
                                : 0,
                            strands_needing_adjustment: calibrationResults.filter(
                                r => Math.abs(r.calibrated_difficulty - r.original_difficulty) > 0.05
                            ).length,
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // CLEANUP-SESSIONS: Clean up stuck or abandoned sessions
            // ─────────────────────────────────────────────────────────────────
            case 'cleanup-sessions': {
                const { max_age_hours = 24, dry_run = true } = body;

                const cutoffDate = new Date(Date.now() - max_age_hours * 60 * 60 * 1000).toISOString();

                // Find sessions to clean up
                const stuckSessions = db.prepare(`
                    SELECT id, stat_name, status, items_count, created_at, updated_at
                    FROM hyro_generative_sessions
                    WHERE student_id = ?
                    AND status IN ('active', 'paused')
                    AND datetime(updated_at) < datetime(?)
                `).all(studentId, cutoffDate) as Array<{
                    id: string;
                    stat_name: StatName;
                    status: string;
                    items_count: number;
                    created_at: string;
                    updated_at: string;
                }>;

                let cleaned = 0;

                if (!dry_run && stuckSessions.length > 0) {
                    // Mark sessions as abandoned
                    const updateStmt = db.prepare(`
                        UPDATE hyro_generative_sessions
                        SET status = 'abandoned', updated_at = ?
                        WHERE id = ?
                    `);

                    const now = new Date().toISOString();
                    for (const session of stuckSessions) {
                        updateStmt.run(now, session.id);
                        cleaned++;
                    }

                    console.log(`[Forge v4 Admin] Cleaned up ${cleaned} stuck sessions`);
                }

                return NextResponse.json({
                    success: true,
                    data: {
                        dry_run,
                        max_age_hours,
                        sessions_found: stuckSessions.length,
                        sessions_cleaned: cleaned,
                        affected_sessions: stuckSessions.map(s => ({
                            id: s.id,
                            stat_name: s.stat_name,
                            status: s.status,
                            items_count: s.items_count,
                            age_hours: Math.round(
                                (Date.now() - new Date(s.updated_at).getTime()) / (60 * 60 * 1000)
                            ),
                        })),
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // EXPORT-DATA: Export assessment data
            // ─────────────────────────────────────────────────────────────────
            case 'export-data': {
                const { format = 'json', include_items = false } = body;

                // Get all results
                const results = db.prepare(`
                    SELECT r.*, s.data_json as session_data
                    FROM hyro_generative_results r
                    LEFT JOIN hyro_generative_sessions s ON r.session_id = s.id
                    WHERE r.student_id = ?
                    ORDER BY r.created_at DESC
                `).all(studentId) as Array<{
                    id: string;
                    stat_name: StatName;
                    session_id: string;
                    estimated_level: number;
                    theta: number;
                    standard_error: number;
                    items_count: number;
                    results_json: string;
                    session_data: string | null;
                    created_at: string;
                }>;

                const exportData = results.map(r => {
                    const resultsData = JSON.parse(r.results_json);
                    const sessionData = r.session_data ? JSON.parse(r.session_data) : null;

                    return {
                        result_id: r.id,
                        stat_name: r.stat_name,
                        session_id: r.session_id,
                        assessed_at: r.created_at,
                        estimated_level: r.estimated_level,
                        theta: r.theta,
                        standard_error: r.standard_error,
                        items_count: r.items_count,
                        overall_accuracy: resultsData.overall?.overall_accuracy,
                        strand_breakdown: resultsData.strand_breakdown,
                        strengths: resultsData.strengths,
                        skill_gaps: resultsData.skill_gaps,
                        misconceptions: resultsData.misconceptions_detected,
                        ...(include_items && sessionData ? {
                            items: sessionData.items_history,
                            evaluations: sessionData.evaluations_summary,
                        } : {}),
                    };
                });

                // Get student stats
                const statLevels = db.prepare(`
                    SELECT stat_name, level, theta, last_assessed_at
                    FROM hyro_student_stats
                    WHERE student_id = ?
                `).all(studentId);

                return NextResponse.json({
                    success: true,
                    data: {
                        export_format: format,
                        exported_at: new Date().toISOString(),
                        student_id: studentId,
                        current_levels: statLevels,
                        assessment_history: exportData,
                        total_assessments: results.length,
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: ['calibrate', 'cleanup-sessions', 'export-data'],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 Admin POST] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, { status: 500 });
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' | 'insufficient_data' {
    if (values.length < 3) return 'insufficient_data';

    const recentHalf = values.slice(0, Math.ceil(values.length / 2));
    const olderHalf = values.slice(Math.ceil(values.length / 2));

    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

    const diff = recentAvg - olderAvg;
    const threshold = olderAvg * 0.1; // 10% threshold

    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
}
