/**
 * HYRO FORGE v4: Memory & Context API
 *
 * @hyro-domain learning_memory
 * @hyro-manifold Persistent student context and misconception tracking
 *
 * ENDPOINTS:
 * GET ?action=student-context - Get comprehensive student learning context
 * GET ?action=misconceptions - Get tracked misconceptions with remediation
 * POST action=record-event - Record significant learning events
 *
 * This API manages the long-term memory of student learning patterns,
 * misconceptions, and contextual information that informs adaptive assessment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest, getStudentById } from '@/lib/hyro/student-auth';
import { getBlueprint } from '@/lib/hyro/forge-blueprints';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';

// =============================================================================
// TYPES
// =============================================================================

interface StudentContext {
    profile: {
        student_id: string;
        display_name: string;
        grade_level: number;
        timezone: string;
        days_active: number;
        total_assessments: number;
    };
    ability_profile: Record<StatName, {
        level: number;
        theta: number;
        last_assessed: string | null;
        assessment_count: number;
    }>;
    learning_patterns: {
        preferred_session_length: number;
        strongest_time_of_day: string;
        average_accuracy: number;
        engagement_trend: 'increasing' | 'decreasing' | 'stable';
    };
    recent_activity: Array<{
        type: string;
        stat_name: StatName | null;
        timestamp: string;
        summary: string;
    }>;
}

interface Misconception {
    id: string;
    stat_name: StatName;
    strand: string;
    misconception: string;
    frequency: number;
    first_detected: string;
    last_detected: string;
    status: 'active' | 'addressed' | 'resolved';
    remediation_attempted: boolean;
    remediation_notes: string | null;
}

interface LearningEvent {
    id: string;
    student_id: string;
    event_type: string;
    stat_name: StatName | null;
    strand: string | null;
    event_data: Record<string, any>;
    created_at: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function thetaToLevel(theta: number): number {
    const normalized = (theta + 3) / 6;
    return Math.round(10 + normalized * 85);
}

function determineTimeOfDay(hour: number): string {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

function generateMisconceptionId(): string {
    return `misc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

        console.log(`[Forge v4 Memory GET] Action: ${action}, Student: ${studentId}`);

        const db = getDatabase();

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // STUDENT-CONTEXT: Comprehensive learning context
            // ─────────────────────────────────────────────────────────────────
            case 'student-context': {
                // Get student profile
                const student = getStudentById(studentId);
                const displayName = student?.display_name ?? 'Student';
                const gradeLevel = student?.grade_level ?? 6;
                const timezone = student?.timezone ?? 'America/New_York';

                // Get character data for activity tracking
                const character = db.prepare(`
                    SELECT created_at, total_xp, current_streak
                    FROM hyro_character
                    WHERE id = ?
                `).get(studentId) as { created_at: number; total_xp: number; current_streak: number } | undefined;

                const daysActive = character
                    ? Math.ceil((Date.now() - character.created_at * 1000) / (1000 * 60 * 60 * 24))
                    : 0;

                // Get ability profile across all stats
                const statLevels = db.prepare(`
                    SELECT stat_name, level, theta, last_assessed_at
                    FROM hyro_student_stats
                    WHERE student_id = ?
                `).all(studentId) as Array<{
                    stat_name: StatName;
                    level: number;
                    theta: number;
                    last_assessed_at: string | null;
                }>;

                // Get assessment counts per stat
                const assessmentCounts = db.prepare(`
                    SELECT stat_name, COUNT(*) as count
                    FROM hyro_generative_results
                    WHERE student_id = ?
                    GROUP BY stat_name
                `).all(studentId) as Array<{ stat_name: StatName; count: number }>;

                const countMap = new Map(assessmentCounts.map(a => [a.stat_name, a.count]));
                const totalAssessments = assessmentCounts.reduce((sum, a) => sum + a.count, 0);

                // Build ability profile
                const abilityProfile: Record<string, any> = {};
                for (const stat of STAT_NAMES) {
                    const level = statLevels.find(s => s.stat_name === stat);
                    abilityProfile[stat] = {
                        level: level?.level ?? null,
                        theta: level?.theta ?? null,
                        last_assessed: level?.last_assessed_at ?? null,
                        assessment_count: countMap.get(stat) ?? 0,
                    };
                }

                // Analyze learning patterns from session events
                const sessionEvents = db.prepare(`
                    SELECT event_type, event_data, created_at
                    FROM hyro_session_events
                    WHERE student_id = ?
                    ORDER BY created_at DESC
                    LIMIT 100
                `).all(studentId) as Array<{
                    event_type: string;
                    event_data: string;
                    created_at: string;
                }>;

                // Determine preferred session time
                const sessionHours = sessionEvents
                    .filter(e => e.event_type === 'session_started')
                    .map(e => new Date(e.created_at).getHours());

                const timeOfDayCounts: Record<string, number> = {
                    morning: 0, afternoon: 0, evening: 0, night: 0
                };
                for (const hour of sessionHours) {
                    timeOfDayCounts[determineTimeOfDay(hour)]++;
                }

                const strongestTimeOfDay = Object.entries(timeOfDayCounts)
                    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

                // Calculate average accuracy from recent assessments
                const recentResults = db.prepare(`
                    SELECT results_json
                    FROM hyro_generative_results
                    WHERE student_id = ?
                    ORDER BY created_at DESC
                    LIMIT 10
                `).all(studentId) as Array<{ results_json: string }>;

                let totalAccuracy = 0;
                let accuracyCount = 0;
                for (const result of recentResults) {
                    const data = JSON.parse(result.results_json);
                    if (data.overall?.overall_accuracy != null) {
                        totalAccuracy += data.overall.overall_accuracy;
                        accuracyCount++;
                    }
                }
                const averageAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : null;

                // Build recent activity
                const recentActivity = sessionEvents.slice(0, 10).map(e => {
                    const data = JSON.parse(e.event_data || '{}');
                    return {
                        type: e.event_type,
                        stat_name: data.stat_name ?? null,
                        timestamp: e.created_at,
                        summary: summarizeEvent(e.event_type, data),
                    };
                });

                const context: StudentContext = {
                    profile: {
                        student_id: studentId,
                        display_name: displayName,
                        grade_level: gradeLevel,
                        timezone,
                        days_active: daysActive,
                        total_assessments: totalAssessments,
                    },
                    ability_profile: abilityProfile as Record<StatName, any>,
                    learning_patterns: {
                        preferred_session_length: 15, // Would calculate from data
                        strongest_time_of_day: strongestTimeOfDay,
                        average_accuracy: averageAccuracy ?? 0,
                        engagement_trend: 'stable', // Would calculate from data
                    },
                    recent_activity: recentActivity,
                };

                return NextResponse.json({
                    success: true,
                    data: context,
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // MISCONCEPTIONS: Tracked misconceptions with remediation
            // ─────────────────────────────────────────────────────────────────
            case 'misconceptions': {
                const statName = searchParams.get('stat_name');
                const statusFilter = searchParams.get('status'); // active, addressed, resolved, all

                // Get misconceptions from assessment results
                let query = `
                    SELECT stat_name, results_json, created_at
                    FROM hyro_generative_results
                    WHERE student_id = ?
                `;
                const params: any[] = [studentId];

                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    query += ' AND stat_name = ?';
                    params.push(statName);
                }

                query += ' ORDER BY created_at DESC LIMIT 50';

                const results = db.prepare(query).all(...params) as Array<{
                    stat_name: StatName;
                    results_json: string;
                    created_at: string;
                }>;

                // Aggregate misconceptions across assessments
                const misconceptionMap = new Map<string, Misconception>();

                for (const result of results) {
                    const data = JSON.parse(result.results_json);
                    const detected = data.misconceptions_detected || [];

                    for (const misc of detected) {
                        const key = `${result.stat_name}:${misc}`;

                        if (misconceptionMap.has(key)) {
                            const existing = misconceptionMap.get(key)!;
                            existing.frequency++;
                            existing.last_detected = result.created_at;
                        } else {
                            misconceptionMap.set(key, {
                                id: generateMisconceptionId(),
                                stat_name: result.stat_name,
                                strand: extractStrandFromMisconception(misc, result.stat_name),
                                misconception: misc,
                                frequency: 1,
                                first_detected: result.created_at,
                                last_detected: result.created_at,
                                status: 'active',
                                remediation_attempted: false,
                                remediation_notes: null,
                            });
                        }
                    }
                }

                // Check for stored misconception states
                const storedMisconceptions = db.prepare(`
                    SELECT misconception_key, status, remediation_notes, updated_at
                    FROM hyro_misconceptions
                    WHERE student_id = ?
                `).all(studentId) as Array<{
                    misconception_key: string;
                    status: string;
                    remediation_notes: string | null;
                    updated_at: string;
                }>;

                const storedMap = new Map(storedMisconceptions.map(m => [m.misconception_key, m]));

                // Update with stored states
                for (const [key, misc] of misconceptionMap) {
                    const stored = storedMap.get(key);
                    if (stored) {
                        misc.status = stored.status as 'active' | 'addressed' | 'resolved';
                        misc.remediation_notes = stored.remediation_notes;
                        misc.remediation_attempted = stored.status !== 'active';
                    }
                }

                let misconceptions = Array.from(misconceptionMap.values());

                // Apply status filter
                if (statusFilter && statusFilter !== 'all') {
                    misconceptions = misconceptions.filter(m => m.status === statusFilter);
                }

                // Sort by frequency (most common first)
                misconceptions.sort((a, b) => b.frequency - a.frequency);

                // Generate remediation suggestions
                const withRemediation = misconceptions.map(m => ({
                    ...m,
                    suggested_remediation: generateRemediationSuggestion(m),
                }));

                // Group by stat
                const byStatName = withRemediation.reduce((acc, m) => {
                    acc[m.stat_name] = acc[m.stat_name] || [];
                    acc[m.stat_name].push(m);
                    return acc;
                }, {} as Record<StatName, typeof withRemediation>);

                return NextResponse.json({
                    success: true,
                    data: {
                        misconceptions: withRemediation,
                        by_stat: byStatName,
                        summary: {
                            total: misconceptions.length,
                            active: misconceptions.filter(m => m.status === 'active').length,
                            addressed: misconceptions.filter(m => m.status === 'addressed').length,
                            resolved: misconceptions.filter(m => m.status === 'resolved').length,
                            most_frequent: misconceptions[0]?.misconception ?? null,
                        },
                        priority_list: withRemediation
                            .filter(m => m.status === 'active')
                            .slice(0, 5)
                            .map(m => ({
                                misconception: m.misconception,
                                stat_name: m.stat_name,
                                frequency: m.frequency,
                                suggested_remediation: m.suggested_remediation,
                            })),
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // LEARNING-EVENTS: Get recorded learning events
            // ─────────────────────────────────────────────────────────────────
            case 'learning-events': {
                const eventType = searchParams.get('event_type');
                const statName = searchParams.get('stat_name');
                const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
                const offset = parseInt(searchParams.get('offset') || '0', 10);

                let query = `
                    SELECT id, event_type, stat_name, strand, event_data, created_at
                    FROM hyro_learning_events
                    WHERE student_id = ?
                `;
                const params: any[] = [studentId];

                if (eventType) {
                    query += ' AND event_type = ?';
                    params.push(eventType);
                }

                if (statName && STAT_NAMES.includes(statName as StatName)) {
                    query += ' AND stat_name = ?';
                    params.push(statName);
                }

                query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const events = db.prepare(query).all(...params) as Array<{
                    id: string;
                    event_type: string;
                    stat_name: StatName | null;
                    strand: string | null;
                    event_data: string;
                    created_at: string;
                }>;

                const parsedEvents = events.map(e => ({
                    ...e,
                    event_data: JSON.parse(e.event_data || '{}'),
                }));

                // Get event type counts
                const eventTypeCounts = db.prepare(`
                    SELECT event_type, COUNT(*) as count
                    FROM hyro_learning_events
                    WHERE student_id = ?
                    GROUP BY event_type
                `).all(studentId) as Array<{ event_type: string; count: number }>;

                return NextResponse.json({
                    success: true,
                    data: {
                        events: parsedEvents,
                        pagination: {
                            limit,
                            offset,
                            has_more: events.length === limit,
                        },
                        event_type_counts: Object.fromEntries(
                            eventTypeCounts.map(e => [e.event_type, e.count])
                        ),
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: ['student-context', 'misconceptions', 'learning-events'],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 Memory GET] Error:', error);
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

        console.log(`[Forge v4 Memory POST] Action: ${action}, Student: ${studentId}`);

        const db = getDatabase();

        switch (action) {
            // ─────────────────────────────────────────────────────────────────
            // RECORD-EVENT: Record significant learning event
            // ─────────────────────────────────────────────────────────────────
            case 'record-event': {
                const {
                    event_type,
                    stat_name,
                    strand,
                    event_data = {},
                    timestamp,
                } = body;

                if (!event_type) {
                    return NextResponse.json({
                        error: 'event_type required',
                        valid_types: [
                            'breakthrough',       // Major understanding gain
                            'struggle',          // Persistent difficulty
                            'misconception',     // New misconception identified
                            'mastery',           // Strand/skill mastery achieved
                            'engagement_peak',   // High engagement moment
                            'learning_style',    // Learning preference observed
                            'goal_set',          // Student set a goal
                            'goal_achieved',     // Student achieved a goal
                            'feedback_given',    // Explicit feedback provided
                            'custom',            // Custom event
                        ],
                    }, { status: 400 });
                }

                const eventId = generateEventId();
                const createdAt = timestamp || new Date().toISOString();

                // Validate stat_name if provided
                if (stat_name && !STAT_NAMES.includes(stat_name as StatName)) {
                    return NextResponse.json({
                        error: `Invalid stat_name: ${stat_name}`,
                        valid_stats: STAT_NAMES,
                    }, { status: 400 });
                }

                // Store the event
                try {
                    db.prepare(`
                        INSERT INTO hyro_learning_events
                        (id, student_id, event_type, stat_name, strand, event_data, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        eventId,
                        studentId,
                        event_type,
                        stat_name || null,
                        strand || null,
                        JSON.stringify(event_data),
                        createdAt
                    );
                } catch (dbError: any) {
                    // Table might not exist - try creating it
                    if (dbError.message?.includes('no such table')) {
                        db.exec(`
                            CREATE TABLE IF NOT EXISTS hyro_learning_events (
                                id TEXT PRIMARY KEY,
                                student_id TEXT NOT NULL,
                                event_type TEXT NOT NULL,
                                stat_name TEXT,
                                strand TEXT,
                                event_data TEXT,
                                created_at TEXT NOT NULL,
                                FOREIGN KEY(student_id) REFERENCES students(id)
                            );
                            CREATE INDEX IF NOT EXISTS idx_learning_events_student
                            ON hyro_learning_events(student_id, event_type);
                        `);

                        // Retry insert
                        db.prepare(`
                            INSERT INTO hyro_learning_events
                            (id, student_id, event_type, stat_name, strand, event_data, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).run(
                            eventId,
                            studentId,
                            event_type,
                            stat_name || null,
                            strand || null,
                            JSON.stringify(event_data),
                            createdAt
                        );
                    } else {
                        throw dbError;
                    }
                }

                // Handle special event types
                if (event_type === 'misconception' && event_data.misconception) {
                    await recordMisconception(db, studentId, stat_name, event_data.misconception);
                }

                console.log(`[Forge v4 Memory] Recorded event ${eventId}: ${event_type}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        event_id: eventId,
                        event_type,
                        stat_name: stat_name || null,
                        strand: strand || null,
                        recorded_at: createdAt,
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // UPDATE-MISCONCEPTION: Update misconception status
            // ─────────────────────────────────────────────────────────────────
            case 'update-misconception': {
                const {
                    stat_name,
                    misconception,
                    status,
                    remediation_notes,
                } = body;

                if (!stat_name || !misconception || !status) {
                    return NextResponse.json({
                        error: 'stat_name, misconception, and status required',
                        valid_statuses: ['active', 'addressed', 'resolved'],
                    }, { status: 400 });
                }

                if (!['active', 'addressed', 'resolved'].includes(status)) {
                    return NextResponse.json({
                        error: 'Invalid status',
                        valid_statuses: ['active', 'addressed', 'resolved'],
                    }, { status: 400 });
                }

                const misconceptionKey = `${stat_name}:${misconception}`;

                // Ensure table exists
                try {
                    db.exec(`
                        CREATE TABLE IF NOT EXISTS hyro_misconceptions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            student_id TEXT NOT NULL,
                            misconception_key TEXT NOT NULL,
                            status TEXT DEFAULT 'active',
                            remediation_notes TEXT,
                            created_at TEXT NOT NULL,
                            updated_at TEXT NOT NULL,
                            UNIQUE(student_id, misconception_key),
                            FOREIGN KEY(student_id) REFERENCES students(id)
                        );
                    `);
                } catch {
                    // Table exists
                }

                const now = new Date().toISOString();

                db.prepare(`
                    INSERT INTO hyro_misconceptions
                    (student_id, misconception_key, status, remediation_notes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(student_id, misconception_key) DO UPDATE SET
                        status = excluded.status,
                        remediation_notes = excluded.remediation_notes,
                        updated_at = excluded.updated_at
                `).run(
                    studentId,
                    misconceptionKey,
                    status,
                    remediation_notes || null,
                    now,
                    now
                );

                console.log(`[Forge v4 Memory] Updated misconception status: ${misconceptionKey} -> ${status}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        misconception_key: misconceptionKey,
                        status,
                        updated_at: now,
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // RECORD-CONTEXT: Record contextual information
            // ─────────────────────────────────────────────────────────────────
            case 'record-context': {
                const {
                    context_type,
                    context_data,
                } = body;

                if (!context_type || !context_data) {
                    return NextResponse.json({
                        error: 'context_type and context_data required',
                        valid_types: [
                            'learning_preference',
                            'schedule_preference',
                            'goal',
                            'interest',
                            'challenge_area',
                            'custom',
                        ],
                    }, { status: 400 });
                }

                const contextId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const now = new Date().toISOString();

                // Ensure table exists
                try {
                    db.exec(`
                        CREATE TABLE IF NOT EXISTS hyro_student_context (
                            id TEXT PRIMARY KEY,
                            student_id TEXT NOT NULL,
                            context_type TEXT NOT NULL,
                            context_data TEXT NOT NULL,
                            created_at TEXT NOT NULL,
                            expires_at TEXT,
                            FOREIGN KEY(student_id) REFERENCES students(id)
                        );
                        CREATE INDEX IF NOT EXISTS idx_student_context
                        ON hyro_student_context(student_id, context_type);
                    `);
                } catch {
                    // Table exists
                }

                db.prepare(`
                    INSERT INTO hyro_student_context
                    (id, student_id, context_type, context_data, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    contextId,
                    studentId,
                    context_type,
                    JSON.stringify(context_data),
                    now
                );

                console.log(`[Forge v4 Memory] Recorded context: ${context_type}`);

                return NextResponse.json({
                    success: true,
                    data: {
                        context_id: contextId,
                        context_type,
                        recorded_at: now,
                    },
                    timing_ms: Date.now() - startTime,
                });
            }

            default:
                return NextResponse.json({
                    error: `Unknown action: ${action}`,
                    available_actions: ['record-event', 'update-misconception', 'record-context'],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('[Forge v4 Memory POST] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, { status: 500 });
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function summarizeEvent(eventType: string, data: any): string {
    switch (eventType) {
        case 'session_started':
            return `Started ${data.stat_name || 'assessment'} session`;
        case 'session_completed':
            return `Completed session with level ${data.final_level || 'N/A'}`;
        case 'session_paused':
            return `Paused session after ${data.items_completed || 0} items`;
        case 'session_resumed':
            return `Resumed paused session`;
        case 'multi_stat_started':
            return `Started multi-stat assessment: ${data.stats?.join(', ') || 'multiple stats'}`;
        case 'multi_stat_completed':
            return `Completed multi-stat assessment`;
        default:
            return `${eventType.replace(/_/g, ' ')}`;
    }
}

function extractStrandFromMisconception(misconception: string, statName: StatName): string {
    // In production, use NLP or pattern matching to extract strand
    // For now, return a generic strand based on stat
    const blueprint = getBlueprint(statName);
    return blueprint.strands[0]?.strand ?? 'General';
}

function generateRemediationSuggestion(misconception: Misconception): string {
    // In production, use AI to generate personalized remediation
    const frequencyNote = misconception.frequency > 3
        ? 'This is a recurring issue - focus on foundational concepts.'
        : 'This was detected recently - review the specific topic.';

    return `${frequencyNote} Practice problems targeting "${misconception.misconception}" in ${misconception.strand}.`;
}

async function recordMisconception(
    db: any,
    studentId: string,
    statName: StatName | null,
    misconception: string
): Promise<void> {
    if (!statName) return;

    const misconceptionKey = `${statName}:${misconception}`;
    const now = new Date().toISOString();

    try {
        db.prepare(`
            INSERT INTO hyro_misconceptions
            (student_id, misconception_key, status, created_at, updated_at)
            VALUES (?, ?, 'active', ?, ?)
            ON CONFLICT(student_id, misconception_key) DO UPDATE SET
                updated_at = excluded.updated_at
        `).run(studentId, misconceptionKey, now, now);
    } catch {
        // Table might not exist yet - will be created on next access
    }
}
