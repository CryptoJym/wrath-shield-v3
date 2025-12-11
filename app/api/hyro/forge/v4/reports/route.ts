/**
 * HYRO FORGE v4: Diagnostic Reports API
 *
 * @hyro-domain assessment_analytics
 * @hyro-manifold Comprehensive diagnostic reporting and analysis
 *
 * ENDPOINTS:
 * GET ?action=diagnostic-report - Full diagnostic results for a session
 * GET ?action=strand-breakdown - Detailed strand-level analysis
 * GET ?action=recommendations - AI-generated learning path recommendations
 * GET ?action=history - Student's assessment history across time
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';
import { getBlueprint, type StrandTier } from '@/lib/hyro/forge-blueprints';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';

// =============================================================================
// TYPES
// =============================================================================

interface DiagnosticResult {
    id: string;
    student_id: string;
    stat_name: StatName;
    session_id: string;
    estimated_level: number;
    theta: number;
    standard_error: number;
    items_count: number;
    results_json: string;
    created_at: string;
}

interface StrandAnalysis {
    strand: string;
    tier: StrandTier;
    level: number | null;
    accuracy: number | null;
    items_count: number;
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    recommendation: string;
}

interface LearningPathStep {
    order: number;
    strand: string;
    tier: StrandTier;
    current_level: number | null;
    target_level: number;
    estimated_hours: number;
    resources: string[];
    prerequisite_strands: string[];
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function thetaToLevel(theta: number): number {
    const normalized = (theta + 3) / 6;
    return Math.round(10 + normalized * 85);
}

function calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
    if (values.length < 2) return 'insufficient_data';

    const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(values.length, 3);
    const olderAvg = values.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(values.length - 3, 1);

    const diff = recentAvg - olderAvg;
    if (Math.abs(diff) < 3) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
}

function generateStrandRecommendation(
    strand: string,
    level: number | null,
    tier: StrandTier,
    accuracy: number | null
): string {
    if (level === null) {
        return `Complete an assessment in ${strand} to establish baseline`;
    }

    if (level >= 85) {
        return `Excellent mastery! Ready for advanced ${tier === 'Horizon' ? 'research' : 'challenges'} in ${strand}`;
    }

    if (level >= 70) {
        return `Strong foundation. Focus on edge cases and complex applications in ${strand}`;
    }

    if (level >= 50) {
        return `Building proficiency. Practice more ${tier} level problems in ${strand}`;
    }

    if (accuracy !== null && accuracy < 0.4) {
        return `Review foundational concepts in ${strand} before advancing`;
    }

    return `Focus on core concepts and practice regularly in ${strand}`;
}

function estimateLearningHours(currentLevel: number | null, targetLevel: number, tier: StrandTier): number {
    const gap = targetLevel - (currentLevel ?? 30);
    const tierMultiplier: Record<StrandTier, number> = {
        'Foundation': 0.5,
        'Bridge': 0.8,
        'Power': 1.2,
        'Horizon': 2.0,
    };

    return Math.max(1, Math.round(gap * 0.3 * tierMultiplier[tier]));
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

        console.log(`[Forge v4 Reports GET] Action: ${action}, Student: ${studentId}`);

        const db = getDatabase();

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // DIAGNOSTIC-REPORT: Full diagnostic results for a session
            // ─────────────────────────────────────────────────────────────────
            case 'diagnostic-report': {
                const sessionId = searchParams.get('session_id');
                const resultId = searchParams.get('result_id');
                const statName = searchParams.get('stat_name');

                let result: DiagnosticResult | undefined;

                if (resultId) {
                    result = db.prepare(`
                        SELECT * FROM hyro_generative_results
                        WHERE id = ? AND student_id = ?
                    `).get(resultId, studentId) as DiagnosticResult | undefined;
                } else if (sessionId) {
                    result = db.prepare(`
                        SELECT * FROM hyro_generative_results
                        WHERE session_id = ? AND student_id = ?
                        ORDER BY created_at DESC LIMIT 1
                    `).get(sessionId, studentId) as DiagnosticResult | undefined;
                } else if (statName) {
                    result = db.prepare(`
                        SELECT * FROM hyro_generative_results
                        WHERE stat_name = ? AND student_id = ?
                        ORDER BY created_at DESC LIMIT 1
                    `).get(statName, studentId) as DiagnosticResult | undefined;
                } else {
                    return NextResponse.json({
                        error: 'session_id, result_id, or stat_name required',
                    }, { status: 400 });
                }

                if (!result) {
                    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
                }

                const resultsData = JSON.parse(result.results_json);
                const blueprint = getBlueprint(result.stat_name);

                // Calculate percentile (simplified - would use normative data in production)
                const percentile = Math.round(
                    (1 / (1 + Math.exp(-result.theta))) * 100
                );

                return NextResponse.json({
                    success: true,
                    data: {
                        report_id: result.id,
                        session_id: result.session_id,
                        stat_name: result.stat_name,
                        assessed_at: result.created_at,

                        summary: {
                            estimated_level: result.estimated_level,
                            theta: result.theta,
                            standard_error: result.standard_error,
                            confidence_interval: {
                                low: thetaToLevel(result.theta - 1.96 * result.standard_error),
                                high: thetaToLevel(result.theta + 1.96 * result.standard_error),
                            },
                            percentile,
                            items_completed: result.items_count,
                            overall_accuracy: resultsData.overall?.overall_accuracy ?? null,
                        },

                        strand_breakdown: resultsData.strand_breakdown ?? [],

                        performance_profile: {
                            strengths: resultsData.strengths ?? [],
                            skill_gaps: resultsData.skill_gaps ?? [],
                            manifold_profile: resultsData.manifold_profile ?? {},
                        },

                        learning_insights: {
                            misconceptions_detected: resultsData.misconceptions_detected ?? [],
                            recommendations: resultsData.recommendations ?? [],
                        },

                        blueprint_coverage: {
                            total_strands: blueprint.strands.length,
                            strands_assessed: resultsData.strand_breakdown?.filter(
                                (s: any) => s.items_administered > 0
                            ).length ?? 0,
                            coverage_by_tier: blueprint.strands.reduce((acc, s) => {
                                acc[s.tier] = acc[s.tier] || { total: 0, assessed: 0 };
                                acc[s.tier].total++;
                                const assessed = resultsData.strand_breakdown?.find(
                                    (sb: any) => sb.strand === s.strand && sb.items_administered > 0
                                );
                                if (assessed) acc[s.tier].assessed++;
                                return acc;
                            }, {} as Record<string, { total: number; assessed: number }>),
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // STRAND-BREAKDOWN: Detailed strand-level analysis
            // ─────────────────────────────────────────────────────────────────
            case 'strand-breakdown': {
                const statName = searchParams.get('stat_name');

                if (!statName || !STAT_NAMES.includes(statName as StatName)) {
                    return NextResponse.json({
                        error: 'Valid stat_name required',
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                const blueprint = getBlueprint(statName as StatName);

                // Get historical results for this stat
                const results = db.prepare(`
                    SELECT results_json, created_at
                    FROM hyro_generative_results
                    WHERE student_id = ? AND stat_name = ?
                    ORDER BY created_at DESC
                    LIMIT 10
                `).all(studentId, statName) as Array<{ results_json: string; created_at: string }>;

                // Aggregate strand data across assessments
                const strandHistory: Record<string, number[]> = {};
                const strandAccuracy: Record<string, number[]> = {};

                for (const result of results) {
                    const data = JSON.parse(result.results_json);
                    for (const strand of data.strand_breakdown || []) {
                        if (strand.estimated_level !== null) {
                            strandHistory[strand.strand] = strandHistory[strand.strand] || [];
                            strandHistory[strand.strand].push(strand.estimated_level);
                        }
                        if (strand.accuracy !== null) {
                            strandAccuracy[strand.strand] = strandAccuracy[strand.strand] || [];
                            strandAccuracy[strand.strand].push(strand.accuracy);
                        }
                    }
                }

                // Build detailed analysis for each strand
                const strandAnalysis: StrandAnalysis[] = blueprint.strands.map(strand => {
                    const levels = strandHistory[strand.strand] || [];
                    const accuracies = strandAccuracy[strand.strand] || [];

                    const currentLevel = levels.length > 0 ? levels[0] : null;
                    const avgAccuracy = accuracies.length > 0
                        ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
                        : null;

                    return {
                        strand: strand.strand,
                        tier: strand.tier,
                        manifold_focus: strand.manifold_focus,
                        weight: strand.weight,
                        level: currentLevel,
                        accuracy: avgAccuracy,
                        items_count: levels.length,
                        trend: calculateTrend(levels.reverse()), // Reverse to chronological
                        recommendation: generateStrandRecommendation(
                            strand.strand,
                            currentLevel,
                            strand.tier,
                            avgAccuracy
                        ),
                        historical_levels: levels.slice(0, 5),
                    };
                });

                // Group by tier
                const byTier = strandAnalysis.reduce((acc, s) => {
                    acc[s.tier] = acc[s.tier] || [];
                    acc[s.tier].push(s);
                    return acc;
                }, {} as Record<StrandTier, StrandAnalysis[]>);

                return NextResponse.json({
                    success: true,
                    data: {
                        stat_name: statName,
                        total_strands: blueprint.strands.length,
                        strands_with_data: strandAnalysis.filter(s => s.level !== null).length,

                        by_tier: byTier,
                        all_strands: strandAnalysis,

                        aggregate_stats: {
                            average_level: strandAnalysis
                                .filter(s => s.level !== null)
                                .reduce((sum, s) => sum + (s.level ?? 0), 0) /
                                Math.max(strandAnalysis.filter(s => s.level !== null).length, 1),
                            strongest_strand: strandAnalysis
                                .filter(s => s.level !== null)
                                .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0]?.strand ?? null,
                            weakest_strand: strandAnalysis
                                .filter(s => s.level !== null)
                                .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0]?.strand ?? null,
                            most_improved: strandAnalysis
                                .filter(s => s.trend === 'improving')[0]?.strand ?? null,
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // RECOMMENDATIONS: AI-generated learning path recommendations
            // ─────────────────────────────────────────────────────────────────
            case 'recommendations': {
                const statName = searchParams.get('stat_name');
                const targetLevel = parseInt(searchParams.get('target_level') || '80', 10);

                if (!statName || !STAT_NAMES.includes(statName as StatName)) {
                    return NextResponse.json({
                        error: 'Valid stat_name required',
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                const blueprint = getBlueprint(statName as StatName);

                // Get latest result
                const latestResult = db.prepare(`
                    SELECT results_json, estimated_level, created_at
                    FROM hyro_generative_results
                    WHERE student_id = ? AND stat_name = ?
                    ORDER BY created_at DESC LIMIT 1
                `).get(studentId, statName) as { results_json: string; estimated_level: number; created_at: string } | undefined;

                if (!latestResult) {
                    return NextResponse.json({
                        success: true,
                        data: {
                            stat_name: statName,
                            has_assessment: false,
                            recommendation: 'Complete a diagnostic assessment first to get personalized recommendations.',
                            suggested_action: {
                                type: 'start_assessment',
                                endpoint: '/api/hyro/forge/v4',
                                body: { action: 'start-diagnostic', stat_name: statName },
                            },
                        },
                    });
                }

                const resultsData = JSON.parse(latestResult.results_json);
                const strandBreakdown = resultsData.strand_breakdown || [];

                // Build learning path
                const learningPath: LearningPathStep[] = [];
                let stepOrder = 1;

                // Sort strands by tier (Foundation first) and then by gap to target
                const sortedStrands = strandBreakdown
                    .map((s: any) => ({
                        ...s,
                        blueprintStrand: blueprint.strands.find(bs => bs.strand === s.strand),
                    }))
                    .filter((s: any) => s.blueprintStrand)
                    .sort((a: any, b: any) => {
                        const tierOrder: Record<StrandTier, number> = {
                            'Foundation': 0, 'Bridge': 1, 'Power': 2, 'Horizon': 3
                        };
                        const tierDiff = tierOrder[a.blueprintStrand.tier] - tierOrder[b.blueprintStrand.tier];
                        if (tierDiff !== 0) return tierDiff;

                        // Within same tier, prioritize lower levels (bigger gaps)
                        return (a.estimated_level ?? 0) - (b.estimated_level ?? 0);
                    });

                for (const strand of sortedStrands) {
                    const currentLevel = strand.estimated_level ?? 30;
                    if (currentLevel >= targetLevel) continue;

                    const tier = strand.blueprintStrand.tier as StrandTier;

                    // Find prerequisites (Foundation strands for Bridge, etc.)
                    const prerequisites = tier !== 'Foundation'
                        ? blueprint.strands
                            .filter(s => {
                                const tierOrder: Record<StrandTier, number> = {
                                    'Foundation': 0, 'Bridge': 1, 'Power': 2, 'Horizon': 3
                                };
                                return tierOrder[s.tier] < tierOrder[tier];
                            })
                            .map(s => s.strand)
                            .slice(0, 2)
                        : [];

                    learningPath.push({
                        order: stepOrder++,
                        strand: strand.strand,
                        tier,
                        current_level: currentLevel,
                        target_level: targetLevel,
                        estimated_hours: estimateLearningHours(currentLevel, targetLevel, tier),
                        resources: generateResourceSuggestions(strand.strand, tier),
                        prerequisite_strands: prerequisites,
                    });

                    // Limit to top 10 priority items
                    if (stepOrder > 10) break;
                }

                // Calculate total estimated time
                const totalHours = learningPath.reduce((sum, step) => sum + step.estimated_hours, 0);

                return NextResponse.json({
                    success: true,
                    data: {
                        stat_name: statName,
                        current_level: latestResult.estimated_level,
                        target_level: targetLevel,
                        last_assessed: latestResult.created_at,

                        learning_path: learningPath,

                        summary: {
                            total_steps: learningPath.length,
                            estimated_total_hours: totalHours,
                            estimated_weeks: Math.ceil(totalHours / 5), // Assuming 5 hours/week
                            priority_focus: learningPath.slice(0, 3).map(s => s.strand),
                        },

                        quick_wins: learningPath
                            .filter(s => s.estimated_hours <= 2)
                            .slice(0, 3)
                            .map(s => ({
                                strand: s.strand,
                                gap: s.target_level - (s.current_level ?? 0),
                                hours: s.estimated_hours,
                            })),

                        challenges: learningPath
                            .filter(s => s.estimated_hours > 5)
                            .map(s => ({
                                strand: s.strand,
                                tier: s.tier,
                                hours: s.estimated_hours,
                            })),
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // HISTORY: Student's assessment history
            // ─────────────────────────────────────────────────────────────────
            case 'history': {
                const statName = searchParams.get('stat_name');
                const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
                const offset = parseInt(searchParams.get('offset') || '0', 10);

                let query = `
                    SELECT id, stat_name, session_id, estimated_level, theta, standard_error,
                           items_count, created_at
                    FROM hyro_generative_results
                    WHERE student_id = ?
                `;
                const params: any[] = [studentId];

                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    query += ' AND stat_name = ?';
                    params.push(statName);
                }

                query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const results = db.prepare(query).all(...params) as Array<{
                    id: string;
                    stat_name: StatName;
                    session_id: string;
                    estimated_level: number;
                    theta: number;
                    standard_error: number;
                    items_count: number;
                    created_at: string;
                }>;

                // Get total count
                let countQuery = `
                    SELECT COUNT(*) as count FROM hyro_generative_results
                    WHERE student_id = ?
                `;
                const countParams: any[] = [studentId];
                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    countQuery += ' AND stat_name = ?';
                    countParams.push(statName);
                }

                const totalCount = (db.prepare(countQuery).get(...countParams) as { count: number }).count;

                // Get stat-level aggregates
                const statAggregates = db.prepare(`
                    SELECT stat_name,
                           COUNT(*) as assessment_count,
                           MAX(estimated_level) as highest_level,
                           AVG(estimated_level) as avg_level,
                           MAX(created_at) as last_assessed
                    FROM hyro_generative_results
                    WHERE student_id = ?
                    GROUP BY stat_name
                `).all(studentId) as Array<{
                    stat_name: StatName;
                    assessment_count: number;
                    highest_level: number;
                    avg_level: number;
                    last_assessed: string;
                }>;

                // Calculate level progression for each result
                const resultsWithProgress = results.map((r, index) => {
                    // Find previous result for this stat
                    const previousSameStat = results
                        .slice(index + 1)
                        .find(pr => pr.stat_name === r.stat_name);

                    return {
                        ...r,
                        confidence_interval: {
                            low: thetaToLevel(r.theta - 1.96 * r.standard_error),
                            high: thetaToLevel(r.theta + 1.96 * r.standard_error),
                        },
                        level_change: previousSameStat
                            ? r.estimated_level - previousSameStat.estimated_level
                            : null,
                    };
                });

                return NextResponse.json({
                    success: true,
                    data: {
                        results: resultsWithProgress,
                        pagination: {
                            total: totalCount,
                            limit,
                            offset,
                            has_more: offset + results.length < totalCount,
                        },
                        stat_aggregates: statAggregates,
                        overall_stats: {
                            total_assessments: totalCount,
                            stats_assessed: statAggregates.length,
                            average_level_all_stats: statAggregates.length > 0
                                ? Math.round(
                                    statAggregates.reduce((sum, s) => sum + s.avg_level, 0) / statAggregates.length
                                )
                                : null,
                        },
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: ['diagnostic-report', 'strand-breakdown', 'recommendations', 'history'],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 Reports GET] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, { status: 500 });
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateResourceSuggestions(strand: string, tier: StrandTier): string[] {
    // In production, this would query a content database
    // For now, return generic suggestions based on tier

    const resources: string[] = [];

    switch (tier) {
        case 'Foundation':
            resources.push(`Khan Academy: ${strand} basics`);
            resources.push(`Practice problems: ${strand} fundamentals`);
            resources.push(`Video tutorials: Introduction to ${strand}`);
            break;
        case 'Bridge':
            resources.push(`Intermediate exercises: ${strand}`);
            resources.push(`Worked examples: ${strand} applications`);
            resources.push(`Problem sets: ${strand} connections`);
            break;
        case 'Power':
            resources.push(`Advanced problems: ${strand}`);
            resources.push(`Synthesis exercises: ${strand}`);
            resources.push(`Past exam questions: ${strand}`);
            break;
        case 'Horizon':
            resources.push(`Research papers: ${strand}`);
            resources.push(`Advanced textbooks: ${strand}`);
            resources.push(`Graduate-level problems: ${strand}`);
            break;
    }

    return resources;
}
