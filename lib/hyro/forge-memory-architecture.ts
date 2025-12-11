/**
 * HYRO FORGE: Memory Architecture System
 *
 * @hyro-domain learning_memory
 * @hyro-manifold Persistent student context for adaptive assessment
 *
 * PHILOSOPHY:
 * This system provides continuity across assessment sessions by:
 * 1. Maintaining long-term ability profiles (hyro_student_memory)
 * 2. Tracking per-strand progression over time (hyro_strand_history)
 * 3. Logging detected misconceptions and their resolution (hyro_misconception_log)
 * 4. Recording significant learning events (hyro_learning_events)
 * 5. Managing session context for real-time adaptation
 *
 * The memory system enables the AI to "remember" each student across sessions,
 * building a rich understanding of their learning journey.
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { ensureServerOnly } from '../server-only-guard';
import { StatName, STAT_NAMES } from './forge-types';
import { ManifoldDimension, StrandTier } from './forge-blueprints';

// Ensure this module is only used server-side
ensureServerOnly('lib/hyro/forge-memory-architecture');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Long-term student learning profile
 */
export interface StudentLearningProfile {
    student_id: string;
    created_at: string;
    updated_at: string;

    // Global ability estimates
    global_theta: number;           // Overall ability (-3 to +3)
    global_se: number;              // Overall standard error

    // Per-stat profiles
    stat_profiles: Record<StatName, StatProfile>;

    // Learning characteristics
    learning_velocity: number;       // How quickly they acquire new skills (0-1)
    consistency_index: number;       // How consistent their performance is (0-1)
    challenge_affinity: number;      // Preference for difficult vs. easy items (0-1)

    // Optimal assessment parameters
    optimal_session_length: number;  // Ideal number of items per session
    optimal_difficulty_band: [number, number];  // Sweet spot for engagement

    // Engagement patterns
    best_performance_time: string;   // Time of day when they perform best
    fatigue_threshold: number;       // Items before performance drops
}

/**
 * Per-stat ability profile
 */
export interface StatProfile {
    stat_name: StatName;
    theta: number;                   // Ability estimate for this stat
    se: number;                      // Standard error
    items_total: number;             // Total items ever answered
    last_assessed: string;           // ISO timestamp

    // Strand-level breakdown
    strand_profiles: Record<string, StrandProfile>;

    // Manifold profile for this stat
    manifold_profile: Record<ManifoldDimension, number>;

    // Performance trend
    theta_history: Array<{ date: string; theta: number; se: number }>;
}

/**
 * Per-strand ability profile
 */
export interface StrandProfile {
    strand: string;
    tier: StrandTier;
    theta: number;
    se: number;
    items_total: number;
    mastery_status: 'not_started' | 'developing' | 'proficient' | 'mastered';
    last_assessed: string;
}

/**
 * Detected misconception record
 */
export interface MisconceptionRecord {
    id: string;
    student_id: string;
    stat_name: StatName;
    strand: string;
    misconception: string;
    detection_count: number;
    first_detected: string;
    last_detected: string;
    resolved: boolean;
    resolved_at?: string;
    related_items: string[];         // Item IDs that revealed this
}

/**
 * Significant learning event
 */
export interface LearningEvent {
    id: string;
    student_id: string;
    event_type: LearningEventType;
    stat_name?: StatName;
    strand?: string;
    data: Record<string, any>;
    timestamp: string;
    session_id?: string;
}

export type LearningEventType =
    | 'breakthrough'        // Sudden improvement
    | 'plateau_detected'    // Learning stalled
    | 'misconception_resolved'
    | 'mastery_achieved'
    | 'tier_advancement'
    | 'struggle_detected'
    | 'engagement_drop'
    | 'optimal_challenge';

/**
 * Session context for assessment
 */
export interface AssessmentContext {
    student_id: string;
    profile: StudentLearningProfile;
    recent_performance: RecentPerformance;
    active_misconceptions: MisconceptionRecord[];
    recommended_focus: RecommendedFocus[];
    session_adjustments: SessionAdjustments;
}

export interface RecentPerformance {
    last_7_days: {
        items_attempted: number;
        accuracy: number;
        avg_difficulty: number;
        theta_change: number;
    };
    last_30_days: {
        items_attempted: number;
        accuracy: number;
        avg_difficulty: number;
        theta_change: number;
    };
}

export interface RecommendedFocus {
    stat_name: StatName;
    strand: string;
    reason: string;
    priority: number;  // 1-10
}

export interface SessionAdjustments {
    starting_difficulty: number;
    difficulty_step: number;
    max_items: number;
    focus_strands: string[];
    avoid_strands: string[];
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Get or create student learning profile
 */
export function getStudentProfile(studentId: string): StudentLearningProfile {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Check if profile exists
    const existing = db.prepare(`
        SELECT data_json FROM hyro_student_memory
        WHERE student_id = ?
    `).get(studentId) as { data_json: string } | undefined;

    if (existing) {
        return JSON.parse(existing.data_json);
    }

    // Create new profile
    const newProfile: StudentLearningProfile = {
        student_id: studentId,
        created_at: now,
        updated_at: now,
        global_theta: 0,
        global_se: 1.5,
        stat_profiles: {} as Record<StatName, StatProfile>,
        learning_velocity: 0.5,
        consistency_index: 0.5,
        challenge_affinity: 0.5,
        optimal_session_length: 15,
        optimal_difficulty_band: [0.3, 0.7],
        best_performance_time: 'morning',
        fatigue_threshold: 20,
    };

    // Initialize stat profiles
    for (const stat of STAT_NAMES) {
        newProfile.stat_profiles[stat] = {
            stat_name: stat,
            theta: 0,
            se: 1.5,
            items_total: 0,
            last_assessed: '',
            strand_profiles: {},
            manifold_profile: {
                coherence: 0.5,
                fluidity: 0.5,
                elasticity: 0.5,
                gradient_awareness: 0.5,
                entropy_intuition: 0.5,
                non_dual_resolution: 0.5,
                generativity: 0.5,
            },
            theta_history: [],
        };
    }

    // Save to database
    db.prepare(`
        INSERT INTO hyro_student_memory (student_id, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `).run(studentId, JSON.stringify(newProfile), now, now);

    return newProfile;
}

/**
 * Update student learning profile
 */
export function updateStudentProfile(profile: StudentLearningProfile): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    profile.updated_at = now;

    db.prepare(`
        UPDATE hyro_student_memory
        SET data_json = ?, updated_at = ?
        WHERE student_id = ?
    `).run(JSON.stringify(profile), now, profile.student_id);
}

/**
 * Update stat profile after assessment
 */
export function updateStatProfile(
    studentId: string,
    statName: StatName,
    update: {
        theta: number;
        se: number;
        items_added: number;
        strand_updates?: Record<string, { theta: number; se: number; items: number }>;
        manifold_updates?: Partial<Record<ManifoldDimension, number>>;
    }
): void {
    const profile = getStudentProfile(studentId);
    const statProfile = profile.stat_profiles[statName];
    const now = new Date().toISOString();

    // Update main stat profile
    statProfile.theta = update.theta;
    statProfile.se = update.se;
    statProfile.items_total += update.items_added;
    statProfile.last_assessed = now;

    // Add to history (keep last 30 entries)
    statProfile.theta_history.push({
        date: now.split('T')[0],
        theta: update.theta,
        se: update.se,
    });
    if (statProfile.theta_history.length > 30) {
        statProfile.theta_history = statProfile.theta_history.slice(-30);
    }

    // Update strand profiles
    if (update.strand_updates) {
        for (const [strand, strandUpdate] of Object.entries(update.strand_updates)) {
            if (!statProfile.strand_profiles[strand]) {
                statProfile.strand_profiles[strand] = {
                    strand,
                    tier: 'Foundation',
                    theta: 0,
                    se: 1.5,
                    items_total: 0,
                    mastery_status: 'not_started',
                    last_assessed: '',
                };
            }
            const sp = statProfile.strand_profiles[strand];
            sp.theta = strandUpdate.theta;
            sp.se = strandUpdate.se;
            sp.items_total += strandUpdate.items;
            sp.last_assessed = now;
            sp.mastery_status = getMasteryStatus(strandUpdate.theta, strandUpdate.se);
        }
    }

    // Update manifold profile
    if (update.manifold_updates) {
        for (const [dim, value] of Object.entries(update.manifold_updates)) {
            const key = dim as ManifoldDimension;
            // Exponential moving average
            statProfile.manifold_profile[key] =
                statProfile.manifold_profile[key] * 0.7 + value * 0.3;
        }
    }

    // Update global estimates
    updateGlobalEstimates(profile);

    // Save
    updateStudentProfile(profile);
}

/**
 * Derive mastery status from theta and SE
 */
function getMasteryStatus(theta: number, se: number): 'not_started' | 'developing' | 'proficient' | 'mastered' {
    if (theta > 1.5 && se < 0.5) return 'mastered';
    if (theta > 0.5 && se < 0.7) return 'proficient';
    if (theta > -0.5) return 'developing';
    return 'not_started';
}

/**
 * Update global estimates from stat profiles
 */
function updateGlobalEstimates(profile: StudentLearningProfile): void {
    let totalTheta = 0;
    let totalWeight = 0;
    let minSE = 1.5;

    for (const statProfile of Object.values(profile.stat_profiles)) {
        if (statProfile.items_total > 0) {
            const weight = 1 / (statProfile.se * statProfile.se);
            totalTheta += statProfile.theta * weight;
            totalWeight += weight;
            minSE = Math.min(minSE, statProfile.se);
        }
    }

    if (totalWeight > 0) {
        profile.global_theta = totalTheta / totalWeight;
        profile.global_se = Math.sqrt(1 / totalWeight);
    }
}

// =============================================================================
// MISCONCEPTION TRACKING
// =============================================================================

/**
 * Record a detected misconception
 */
export function recordMisconception(
    studentId: string,
    statName: StatName,
    strand: string,
    misconception: string,
    itemId: string
): MisconceptionRecord {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Check if this misconception already exists
    const existing = db.prepare(`
        SELECT * FROM hyro_misconception_log
        WHERE student_id = ? AND stat_name = ? AND misconception = ? AND resolved = 0
    `).get(studentId, statName, misconception) as any | undefined;

    if (existing) {
        // Update existing record
        const relatedItems = JSON.parse(existing.related_items || '[]');
        if (!relatedItems.includes(itemId)) {
            relatedItems.push(itemId);
        }

        db.prepare(`
            UPDATE hyro_misconception_log
            SET detection_count = detection_count + 1,
                last_detected = ?,
                related_items = ?
            WHERE id = ?
        `).run(now, JSON.stringify(relatedItems), existing.id);

        return {
            ...existing,
            detection_count: existing.detection_count + 1,
            last_detected: now,
            related_items: relatedItems,
        };
    }

    // Create new record
    const id = randomUUID();
    const record: MisconceptionRecord = {
        id,
        student_id: studentId,
        stat_name: statName,
        strand,
        misconception,
        detection_count: 1,
        first_detected: now,
        last_detected: now,
        resolved: false,
        related_items: [itemId],
    };

    db.prepare(`
        INSERT INTO hyro_misconception_log
        (id, student_id, stat_name, strand, misconception, detection_count,
         first_detected, last_detected, resolved, related_items)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id, studentId, statName, strand, misconception, 1,
        now, now, 0, JSON.stringify([itemId])
    );

    return record;
}

/**
 * Get active misconceptions for a student
 */
export function getActiveMisconceptions(
    studentId: string,
    statName?: StatName,
    strand?: string
): MisconceptionRecord[] {
    const db = getDatabase();

    let query = `
        SELECT * FROM hyro_misconception_log
        WHERE student_id = ? AND resolved = 0
    `;
    const params: any[] = [studentId];

    if (statName) {
        query += ` AND stat_name = ?`;
        params.push(statName);
    }

    if (strand) {
        query += ` AND strand = ?`;
        params.push(strand);
    }

    query += ` ORDER BY detection_count DESC, last_detected DESC`;

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
        ...row,
        resolved: row.resolved === 1,
        related_items: JSON.parse(row.related_items || '[]'),
    }));
}

/**
 * Mark a misconception as resolved
 */
export function resolveMisconception(misconceptionId: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
        UPDATE hyro_misconception_log
        SET resolved = 1, resolved_at = ?
        WHERE id = ?
    `).run(now, misconceptionId);
}

// =============================================================================
// LEARNING EVENTS
// =============================================================================

/**
 * Record a significant learning event
 */
export function recordLearningEvent(
    studentId: string,
    eventType: LearningEventType,
    data: Record<string, any>,
    statName?: StatName,
    strand?: string,
    sessionId?: string
): LearningEvent {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = randomUUID();

    const event: LearningEvent = {
        id,
        student_id: studentId,
        event_type: eventType,
        stat_name: statName,
        strand,
        data,
        timestamp: now,
        session_id: sessionId,
    };

    db.prepare(`
        INSERT INTO hyro_learning_events
        (id, student_id, event_type, stat_name, strand, data_json, timestamp, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, studentId, eventType, statName, strand, JSON.stringify(data), now, sessionId);

    return event;
}

/**
 * Get recent learning events
 */
export function getRecentLearningEvents(
    studentId: string,
    limit: number = 20,
    eventTypes?: LearningEventType[]
): LearningEvent[] {
    const db = getDatabase();

    let query = `
        SELECT * FROM hyro_learning_events
        WHERE student_id = ?
    `;
    const params: any[] = [studentId];

    if (eventTypes && eventTypes.length > 0) {
        query += ` AND event_type IN (${eventTypes.map(() => '?').join(',')})`;
        params.push(...eventTypes);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
        ...row,
        data: JSON.parse(row.data_json || '{}'),
    }));
}

// =============================================================================
// CONTEXT RETRIEVAL
// =============================================================================

/**
 * Get full assessment context for a student
 * This is the main entry point for the assessment engine
 */
export function getAssessmentContext(
    studentId: string,
    statName?: StatName
): AssessmentContext {
    const profile = getStudentProfile(studentId);
    const misconceptions = getActiveMisconceptions(studentId, statName);

    // Calculate recent performance
    const recentPerformance = calculateRecentPerformance(studentId);

    // Generate recommended focus areas
    const recommendedFocus = generateRecommendedFocus(profile, misconceptions, statName);

    // Calculate session adjustments
    const sessionAdjustments = calculateSessionAdjustments(profile, recentPerformance);

    return {
        student_id: studentId,
        profile,
        recent_performance: recentPerformance,
        active_misconceptions: misconceptions,
        recommended_focus: recommendedFocus,
        session_adjustments: sessionAdjustments,
    };
}

/**
 * Calculate recent performance metrics
 */
function calculateRecentPerformance(studentId: string): RecentPerformance {
    const db = getDatabase();
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Query recent items
    const query = (since: string) => db.prepare(`
        SELECT
            COUNT(*) as items,
            AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy,
            AVG(difficulty) as avg_difficulty
        FROM hyro_generated_items_log
        WHERE student_id = ? AND created_at > ?
    `).get(studentId, since) as any || { items: 0, accuracy: 0, avg_difficulty: 0.5 };

    const last7 = query(sevenDaysAgo);
    const last30 = query(thirtyDaysAgo);

    // Calculate theta change (would need to query theta history)
    // For now, estimate from recent sessions
    const profile = getStudentProfile(studentId);
    const history = profile.stat_profiles['math']?.theta_history || [];
    const thetaChange7 = history.length >= 2
        ? history[history.length - 1].theta - history[Math.max(0, history.length - 7)].theta
        : 0;

    return {
        last_7_days: {
            items_attempted: last7.items || 0,
            accuracy: last7.accuracy || 0,
            avg_difficulty: last7.avg_difficulty || 0.5,
            theta_change: thetaChange7,
        },
        last_30_days: {
            items_attempted: last30.items || 0,
            accuracy: last30.accuracy || 0,
            avg_difficulty: last30.avg_difficulty || 0.5,
            theta_change: 0, // Would calculate similarly
        },
    };
}

/**
 * Generate recommended focus areas
 */
function generateRecommendedFocus(
    profile: StudentLearningProfile,
    misconceptions: MisconceptionRecord[],
    statName?: StatName
): RecommendedFocus[] {
    const recommendations: RecommendedFocus[] = [];

    // Priority 1: Active misconceptions (focus on resolving)
    for (const misc of misconceptions.slice(0, 3)) {
        recommendations.push({
            stat_name: misc.stat_name,
            strand: misc.strand,
            reason: `Active misconception: "${misc.misconception}" (detected ${misc.detection_count} times)`,
            priority: 10 - Math.min(5, misconceptions.indexOf(misc)),
        });
    }

    // Priority 2: High uncertainty strands (need more data)
    const stats = statName ? [statName] : STAT_NAMES;
    for (const stat of stats) {
        const statProfile = profile.stat_profiles[stat];
        if (!statProfile) continue;

        for (const [strand, sp] of Object.entries(statProfile.strand_profiles)) {
            if (sp.se > 0.8 && sp.items_total > 0) {
                recommendations.push({
                    stat_name: stat,
                    strand,
                    reason: `High uncertainty (SE: ${sp.se.toFixed(2)}) - need more assessment data`,
                    priority: 7,
                });
            }
        }
    }

    // Priority 3: Near-mastery strands (push to completion)
    for (const stat of stats) {
        const statProfile = profile.stat_profiles[stat];
        if (!statProfile) continue;

        for (const [strand, sp] of Object.entries(statProfile.strand_profiles)) {
            if (sp.mastery_status === 'proficient' && sp.theta > 1.0) {
                recommendations.push({
                    stat_name: stat,
                    strand,
                    reason: `Near mastery - ${strand} is almost complete`,
                    priority: 6,
                });
            }
        }
    }

    // Sort by priority
    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

/**
 * Calculate optimal session parameters
 */
function calculateSessionAdjustments(
    profile: StudentLearningProfile,
    recentPerformance: RecentPerformance
): SessionAdjustments {
    // Base starting difficulty on recent performance
    let startingDifficulty = 0.5;
    if (recentPerformance.last_7_days.items_attempted > 5) {
        if (recentPerformance.last_7_days.accuracy > 0.8) {
            startingDifficulty = Math.min(0.7, recentPerformance.last_7_days.avg_difficulty + 0.1);
        } else if (recentPerformance.last_7_days.accuracy < 0.5) {
            startingDifficulty = Math.max(0.3, recentPerformance.last_7_days.avg_difficulty - 0.1);
        }
    }

    // Adjust step size based on consistency
    const difficultyStep = profile.consistency_index > 0.7 ? 0.15 : 0.1;

    // Max items based on profile
    const maxItems = Math.min(profile.optimal_session_length, profile.fatigue_threshold);

    return {
        starting_difficulty: startingDifficulty,
        difficulty_step: difficultyStep,
        max_items: maxItems,
        focus_strands: [], // Would be populated based on recommendations
        avoid_strands: [], // Strands recently tested or mastered
    };
}

// =============================================================================
// LEARNING PATTERN ANALYSIS
// =============================================================================

/**
 * Analyze learning patterns and update profile characteristics
 */
export function analyzeAndUpdateLearningPatterns(studentId: string): void {
    const profile = getStudentProfile(studentId);
    const db = getDatabase();

    // Get all items from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const items = db.prepare(`
        SELECT difficulty, is_correct, score, created_at
        FROM hyro_generated_items_log
        WHERE student_id = ? AND created_at > ?
        ORDER BY created_at ASC
    `).all(studentId, thirtyDaysAgo) as any[];

    if (items.length < 10) return; // Not enough data

    // Calculate learning velocity (improvement over time)
    const firstHalf = items.slice(0, Math.floor(items.length / 2));
    const secondHalf = items.slice(Math.floor(items.length / 2));
    const firstAccuracy = firstHalf.reduce((sum, i) => sum + (i.is_correct ? 1 : 0), 0) / firstHalf.length;
    const secondAccuracy = secondHalf.reduce((sum, i) => sum + (i.is_correct ? 1 : 0), 0) / secondHalf.length;
    profile.learning_velocity = Math.max(0, Math.min(1, 0.5 + (secondAccuracy - firstAccuracy)));

    // Calculate consistency index
    const accuracies = [];
    for (let i = 0; i < items.length - 5; i += 5) {
        const chunk = items.slice(i, i + 5);
        accuracies.push(chunk.reduce((sum, item) => sum + (item.is_correct ? 1 : 0), 0) / 5);
    }
    if (accuracies.length > 1) {
        const variance = calculateVariance(accuracies);
        profile.consistency_index = Math.max(0, 1 - variance * 2);
    }

    // Calculate challenge affinity
    const hardItems = items.filter(i => i.difficulty > 0.6);
    const easyItems = items.filter(i => i.difficulty < 0.4);
    const hardAccuracy = hardItems.length > 0
        ? hardItems.reduce((sum, i) => sum + (i.is_correct ? 1 : 0), 0) / hardItems.length
        : 0.5;
    const easyAccuracy = easyItems.length > 0
        ? easyItems.reduce((sum, i) => sum + (i.is_correct ? 1 : 0), 0) / easyItems.length
        : 0.5;
    profile.challenge_affinity = hardAccuracy > easyAccuracy * 0.7 ? 0.7 : 0.5;

    // Detect fatigue threshold
    if (items.length >= 20) {
        for (let i = 10; i < items.length; i++) {
            const recent = items.slice(i - 5, i);
            const recentAcc = recent.reduce((sum, item) => sum + (item.is_correct ? 1 : 0), 0) / 5;
            if (recentAcc < 0.4) {
                profile.fatigue_threshold = Math.min(profile.fatigue_threshold, i - 5);
                break;
            }
        }
    }

    updateStudentProfile(profile);
}

function calculateVariance(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

// =============================================================================
// SESSION CONTEXT MANAGEMENT
// =============================================================================

/**
 * Session state for tracking current assessment session
 */
export interface SessionState {
    id: string;
    student_id: string;
    stat_name: StatName;
    status: 'active' | 'completed' | 'abandoned';

    // Ability tracking within session
    initial_theta: number;
    current_theta: number;
    standard_error: number;

    // Items administered in this session
    items_administered: SessionItem[];

    // Time tracking
    started_at: number;
    last_activity_at: number;
    total_time_seconds: number;

    // Engagement metrics
    avg_response_time_ms: number;
    hesitation_count: number;      // Long pauses (>30s)
    quick_response_count: number;  // Fast responses (<3s)

    // Performance patterns
    current_streak: number;        // Positive for correct, negative for incorrect
    longest_correct_streak: number;
    difficulty_trend: 'increasing' | 'stable' | 'decreasing';
}

export interface SessionItem {
    item_id: string;
    strand: string;
    difficulty: number;
    score: number;
    is_correct: boolean;
    response_time_ms: number;
    misconception_detected?: string;
    timestamp: number;
}

/**
 * Start a new assessment session
 */
export function startSession(
    studentId: string,
    statName: StatName,
    initialTheta: number = 0
): SessionState {
    const db = getDatabase();
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Abandon any existing active sessions for this stat
    db.prepare(`
        UPDATE hyro_session_state
        SET status = 'abandoned', last_activity_at = ?
        WHERE student_id = ? AND stat_name = ? AND status = 'active'
    `).run(now, studentId, statName);

    const session: SessionState = {
        id,
        student_id: studentId,
        stat_name: statName,
        status: 'active',
        initial_theta: initialTheta,
        current_theta: initialTheta,
        standard_error: 1.5,
        items_administered: [],
        started_at: now,
        last_activity_at: now,
        total_time_seconds: 0,
        avg_response_time_ms: 0,
        hesitation_count: 0,
        quick_response_count: 0,
        current_streak: 0,
        longest_correct_streak: 0,
        difficulty_trend: 'stable',
    };

    db.prepare(`
        INSERT INTO hyro_session_state (
            id, student_id, stat_name, status, initial_theta, current_theta, standard_error,
            items_administered, started_at, last_activity_at, total_time_seconds,
            avg_response_time_ms, hesitation_count, quick_response_count,
            current_streak, longest_correct_streak, difficulty_trend
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id, studentId, statName, 'active', initialTheta, initialTheta, 1.5,
        JSON.stringify([]), now, now, 0, 0, 0, 0, 0, 0, 'stable'
    );

    return session;
}

/**
 * Get current active session
 */
export function getActiveSession(studentId: string, statName?: StatName): SessionState | null {
    const db = getDatabase();

    let query = `
        SELECT * FROM hyro_session_state
        WHERE student_id = ? AND status = 'active'
    `;
    const params: any[] = [studentId];

    if (statName) {
        query += ' AND stat_name = ?';
        params.push(statName);
    }

    query += ' ORDER BY started_at DESC LIMIT 1';

    const row = db.prepare(query).get(...params) as any;

    if (!row) return null;

    return {
        ...row,
        items_administered: JSON.parse(row.items_administered || '[]'),
    };
}

/**
 * Record an item response within a session
 */
export function recordSessionItem(
    sessionId: string,
    item: SessionItem
): void {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    const session = db.prepare(`
        SELECT * FROM hyro_session_state WHERE id = ?
    `).get(sessionId) as any;

    if (!session || session.status !== 'active') {
        throw new Error(`Session ${sessionId} not found or not active`);
    }

    const items: SessionItem[] = JSON.parse(session.items_administered || '[]');
    items.push(item);

    // Update metrics
    const totalResponseTime = items.reduce((sum, i) => sum + i.response_time_ms, 0);
    const avgResponseTime = totalResponseTime / items.length;

    // Update streaks
    let currentStreak = session.current_streak;
    if (item.is_correct) {
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
    } else {
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
    }
    const longestStreak = Math.max(session.longest_correct_streak, currentStreak > 0 ? currentStreak : 0);

    // Hesitation/quick response detection
    const hesitationCount = session.hesitation_count + (item.response_time_ms > 30000 ? 1 : 0);
    const quickResponseCount = session.quick_response_count + (item.response_time_ms < 3000 ? 1 : 0);

    // Calculate difficulty trend
    const recentDifficulties = items.slice(-5).map(i => i.difficulty);
    let difficultyTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (recentDifficulties.length >= 3) {
        const diff = recentDifficulties[recentDifficulties.length - 1] - recentDifficulties[0];
        if (diff > 0.1) difficultyTrend = 'increasing';
        else if (diff < -0.1) difficultyTrend = 'decreasing';
    }

    const totalTime = now - session.started_at;

    db.prepare(`
        UPDATE hyro_session_state
        SET items_administered = ?,
            last_activity_at = ?,
            total_time_seconds = ?,
            avg_response_time_ms = ?,
            hesitation_count = ?,
            quick_response_count = ?,
            current_streak = ?,
            longest_correct_streak = ?,
            difficulty_trend = ?
        WHERE id = ?
    `).run(
        JSON.stringify(items),
        now,
        totalTime,
        avgResponseTime,
        hesitationCount,
        quickResponseCount,
        currentStreak,
        longestStreak,
        difficultyTrend,
        sessionId
    );

    // Record misconception if detected
    if (item.misconception_detected) {
        recordMisconception(
            session.student_id,
            session.stat_name,
            item.strand,
            item.misconception_detected,
            item.item_id
        );
    }
}

/**
 * Update session ability estimate
 */
export function updateSessionAbility(
    sessionId: string,
    theta: number,
    se: number
): void {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
        UPDATE hyro_session_state
        SET current_theta = ?, standard_error = ?, last_activity_at = ?
        WHERE id = ?
    `).run(theta, se, now, sessionId);
}

/**
 * Complete a session
 */
export function completeSession(
    sessionId: string,
    finalTheta: number,
    finalSE: number
): SessionState {
    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    const session = db.prepare(`
        SELECT * FROM hyro_session_state WHERE id = ?
    `).get(sessionId) as any;

    if (!session) {
        throw new Error(`Session ${sessionId} not found`);
    }

    const totalTime = now - session.started_at;

    db.prepare(`
        UPDATE hyro_session_state
        SET status = 'completed',
            current_theta = ?,
            standard_error = ?,
            last_activity_at = ?,
            total_time_seconds = ?
        WHERE id = ?
    `).run(finalTheta, finalSE, now, totalTime, sessionId);

    const items: SessionItem[] = JSON.parse(session.items_administered || '[]');

    // Update long-term profile
    const thetaChange = finalTheta - session.initial_theta;
    if (Math.abs(thetaChange) > 0.5) {
        recordLearningEvent(
            session.student_id,
            thetaChange > 0 ? 'breakthrough' : 'struggle_detected',
            {
                theta_change: thetaChange,
                session_items: items.length,
                session_accuracy: items.filter(i => i.is_correct).length / items.length,
            },
            session.stat_name,
            undefined,
            sessionId
        );
    }

    return {
        ...session,
        status: 'completed',
        current_theta: finalTheta,
        standard_error: finalSE,
        items_administered: items,
        total_time_seconds: totalTime,
    };
}

// =============================================================================
// CROSS-SESSION CONTINUITY
// =============================================================================

/**
 * Get learning trajectory for a student over time
 */
export function getLearningTrajectory(
    studentId: string,
    statName?: StatName,
    days: number = 30
): Array<{
    date: string;
    stat_name: StatName;
    theta: number;
    se: number;
    items: number;
    accuracy: number;
}> {
    const db = getDatabase();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = `
        SELECT
            date(started_at, 'unixepoch') as date,
            stat_name,
            current_theta as theta,
            standard_error as se,
            json_array_length(items_administered) as items,
            items_administered
        FROM hyro_session_state
        WHERE student_id = ?
          AND status = 'completed'
          AND datetime(started_at, 'unixepoch') >= ?
    `;
    const params: any[] = [studentId, cutoff];

    if (statName) {
        query += ' AND stat_name = ?';
        params.push(statName);
    }

    query += ' ORDER BY started_at ASC';

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map(row => {
        const items: SessionItem[] = JSON.parse(row.items_administered || '[]');
        const correct = items.filter(i => i.is_correct).length;

        return {
            date: row.date,
            stat_name: row.stat_name,
            theta: row.theta,
            se: row.se,
            items: items.length,
            accuracy: items.length > 0 ? correct / items.length : 0,
        };
    });
}

/**
 * Get persistent learning gaps
 */
export function getPersistentGaps(studentId: string): Array<{
    stat_name: StatName;
    strand: string;
    misconception: string;
    first_detected: string;
    detection_count: number;
    days_persistent: number;
}> {
    const db = getDatabase();

    const rows = db.prepare(`
        SELECT
            stat_name,
            strand,
            misconception,
            first_detected,
            detection_count,
            julianday('now') - julianday(first_detected) as days_persistent
        FROM hyro_misconception_log
        WHERE student_id = ? AND resolved = 0
        ORDER BY detection_count DESC, days_persistent DESC
    `).all(studentId) as any[];

    return rows.map(row => ({
        stat_name: row.stat_name,
        strand: row.strand,
        misconception: row.misconception,
        first_detected: row.first_detected,
        detection_count: row.detection_count,
        days_persistent: Math.round(row.days_persistent),
    }));
}

/**
 * Get effective teaching approaches (based on what worked)
 */
export function getEffectiveApproaches(studentId: string): Array<{
    stat_name: StatName;
    strand: string;
    approach: string;
    success_rate: number;
}> {
    const db = getDatabase();

    // Get resolved misconceptions with their resolution data
    const resolved = db.prepare(`
        SELECT
            stat_name,
            strand,
            misconception,
            first_detected,
            resolved_at
        FROM hyro_misconception_log
        WHERE student_id = ? AND resolved = 1
        ORDER BY resolved_at DESC
        LIMIT 20
    `).all(studentId) as any[];

    // For now, return simplified approaches based on resolved misconceptions
    return resolved.map(row => ({
        stat_name: row.stat_name,
        strand: row.strand,
        approach: `Targeted practice on ${row.misconception}`,
        success_rate: 0.8, // Would calculate from actual data
    }));
}

/**
 * Get optimal difficulty calibration for student
 */
export function getOptimalDifficulty(
    studentId: string,
    statName: StatName
): { min: number; max: number; sweet_spot: number } {
    const db = getDatabase();

    // Get recent items with their success rates grouped by difficulty
    const rows = db.prepare(`
        SELECT
            ROUND(difficulty, 1) as diff_bucket,
            COUNT(*) as total,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM hyro_generated_items_log
        WHERE student_id = ? AND stat_name = ?
        GROUP BY diff_bucket
        HAVING total >= 3
        ORDER BY diff_bucket
    `).all(studentId, statName) as any[];

    if (rows.length === 0) {
        return { min: 0.3, max: 0.7, sweet_spot: 0.5 };
    }

    // Find the difficulty range where success rate is 60-80% (ZPD)
    let sweetSpot = 0.5;
    let zpdMin = 0.3;
    let zpdMax = 0.7;

    for (const row of rows) {
        const successRate = row.correct / row.total;
        if (successRate >= 0.6 && successRate <= 0.8) {
            sweetSpot = row.diff_bucket;
            break;
        }
    }

    // Find range where success > 50%
    const successfulBuckets = rows.filter(r => r.correct / r.total > 0.5);
    if (successfulBuckets.length > 0) {
        zpdMin = Math.min(...successfulBuckets.map(r => r.diff_bucket));
        zpdMax = Math.max(...successfulBuckets.map(r => r.diff_bucket));
    }

    return {
        min: zpdMin,
        max: zpdMax,
        sweet_spot: sweetSpot,
    };
}

// =============================================================================
// MEMORY RETRIEVAL API
// =============================================================================

/**
 * Get full student context for assessment generation
 * This is the primary API for the generative engine
 */
export function getStudentContext(
    studentId: string,
    statName: StatName
): AssessmentContext & {
    learning_trajectory: ReturnType<typeof getLearningTrajectory>;
    persistent_gaps: ReturnType<typeof getPersistentGaps>;
    effective_approaches: ReturnType<typeof getEffectiveApproaches>;
    optimal_difficulty: ReturnType<typeof getOptimalDifficulty>;
    current_session?: SessionState;
} {
    const baseContext = getAssessmentContext(studentId, statName);

    return {
        ...baseContext,
        learning_trajectory: getLearningTrajectory(studentId, statName, 30),
        persistent_gaps: getPersistentGaps(studentId),
        effective_approaches: getEffectiveApproaches(studentId),
        optimal_difficulty: getOptimalDifficulty(studentId, statName),
        current_session: getActiveSession(studentId, statName) || undefined,
    };
}

/**
 * Update ability profile after assessment (called at end of session)
 */
export function updateAbilityProfile(
    studentId: string,
    assessment: {
        stat_name: StatName;
        strand: string;
        tier: StrandTier;
        theta: number;
        se: number;
        items: number;
        accuracy: number;
        misconceptions: string[];
        manifold_signals: Partial<Record<ManifoldDimension, number>>;
        session_id?: string;
    }
): void {
    // Update stat profile
    updateStatProfile(studentId, assessment.stat_name, {
        theta: assessment.theta,
        se: assessment.se,
        items_added: assessment.items,
        strand_updates: {
            [assessment.strand]: {
                theta: assessment.theta,
                se: assessment.se,
                items: assessment.items,
            },
        },
        manifold_updates: assessment.manifold_signals,
    });

    // Record misconceptions
    for (const misconception of assessment.misconceptions) {
        recordMisconception(
            studentId,
            assessment.stat_name,
            assessment.strand,
            misconception,
            assessment.session_id || 'unknown'
        );
    }

    // Analyze patterns periodically
    const profile = getStudentProfile(studentId);
    const totalItems = Object.values(profile.stat_profiles)
        .reduce((sum, sp) => sum + sp.items_total, 0);

    if (totalItems % 20 === 0) {
        analyzeAndUpdateLearningPatterns(studentId);
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    // Profile management
    getStudentProfile,
    updateStudentProfile,
    updateStatProfile,
    updateAbilityProfile,

    // Misconception tracking
    recordMisconception,
    getActiveMisconceptions,
    resolveMisconception,

    // Learning events
    recordLearningEvent,
    getRecentLearningEvents,

    // Session management
    startSession,
    getActiveSession,
    recordSessionItem,
    updateSessionAbility,
    completeSession,

    // Cross-session continuity
    getLearningTrajectory,
    getPersistentGaps,
    getEffectiveApproaches,
    getOptimalDifficulty,

    // Main context API
    getAssessmentContext,
    getStudentContext,

    // Pattern analysis
    analyzeAndUpdateLearningPatterns,
};
