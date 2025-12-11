/**
 * HYRO FORGE: Multi-Agent Assessment Orchestrator
 *
 * @hyro-domain assessment_coordination
 * @hyro-manifold Multi-agent orchestration for adaptive assessment
 *
 * This orchestrator coordinates:
 * 1. Domain-specific agents for item generation across multiple stats
 * 2. Memory system for student context with session recovery
 * 3. IRT-based ability estimation with Bayesian updates
 * 4. Quality assurance pipeline for content validation
 * 5. Session management with checkpointing and interruption handling
 * 6. Cross-domain assessment for compound items (e.g., math word problems)
 * 7. Fatigue detection and adaptive termination
 * 8. Comprehensive diagnostic reporting
 *
 * Architecture:
 * ```
 * ForgeOrchestrator
 *   ├── DomainAgentPool (manages specialized agents per stat)
 *   │     ├── MathAgent (arithmetic, algebra, geometry, data)
 *   │     ├── ReadingAgent (decoding, comprehension, vocabulary)
 *   │     └── ...other domain agents
 *   ├── SessionManager (lifecycle, state, recovery)
 *   ├── AdaptiveRouter (ZPD-based routing decisions)
 *   ├── QualityPipeline (item validation, deduplication)
 *   ├── ConvergenceDetector (termination criteria)
 *   └── ReportGenerator (diagnostic results)
 * ```
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/db/Database';
import { StatName, STAT_NAMES } from './forge-types';
import { getBlueprint, StrandTier, ManifoldDimension, Strand } from './forge-blueprints';
import {
    GenerativeAssessmentEngine,
    GeneratedItem,
    ResponseEvaluation,
    AbilityEstimate,
    createInitialAbilityEstimate,
    getGenerativeEngine,
} from './forge-generative-engine';
import { getDomainAgent, buildAgentSystemPrompt, buildAgentEvaluationPrompt } from './forge-domain-agents';
import {
    getAssessmentContext,
    getStudentProfile,
    updateStatProfile,
    recordMisconception,
    recordLearningEvent,
    AssessmentContext,
} from './forge-memory-architecture';
import {
    getZPDState,
    getEnhancedZPDState,
    type ZPDState,
    type ManifoldZPDRecommendation,
} from './forge-zpd-engine';
import { getSkillProficiency } from './forge-proficiency';

// =============================================================================
// TYPES
// =============================================================================

export interface OrchestratorConfig {
    // Session limits
    maxItemsPerSession: number;
    maxTimeMinutes: number;
    convergenceThreshold: number;  // SE threshold for convergence
    minItemsForConvergence: number;  // Minimum items before allowing convergence

    // Quality settings
    validateItemsBeforePresentation: boolean;
    enableQualityChecks: boolean;
    qaStrictness: 'relaxed' | 'standard' | 'strict';

    // Adaptive settings
    initialDifficulty: number;
    difficultyStepUp: number;
    difficultyStepDown: number;
    ceilingThreshold: number;
    floorThreshold: number;

    // Multi-stat settings
    multiStatEnabled: boolean;
    statsToAssess: StatName[];
    crossDomainEnabled: boolean;  // Allow items that test multiple stats

    // Fatigue detection
    fatigueDetectionEnabled: boolean;
    fatigueThreshold: number;
    slowResponseThresholdMs: number;

    // Strand balancing
    strandWeights: Partial<Record<string, number>>;
    prioritizeGaps: boolean;

    // Session recovery
    enableCheckpoints: boolean;
    checkpointIntervalItems: number;
}

/**
 * Student context for session initialization
 */
export interface StudentContext {
    id: string;
    grade_level: number;
    prior_assessments?: string[];
    accommodations?: AssessmentAccommodation[];
    language?: string;
    time_zone?: string;
}

/**
 * Assessment accommodations
 */
export interface AssessmentAccommodation {
    type: 'extended_time' | 'read_aloud' | 'large_font' | 'reduced_distractions' | 'breaks_allowed';
    multiplier?: number;
    settings?: Record<string, unknown>;
}

/**
 * Domain agent state
 */
export interface DomainAgentState {
    stat_name: StatName;
    current_strand: string | null;
    current_tier: StrandTier;
    items_generated: number;
    last_generation_at: string | null;
    generation_errors: number;
}

/**
 * Session checkpoint for recovery
 */
export interface SessionCheckpoint {
    version: number;
    created_at: string;
    session_state: Omit<AssessmentSession, 'checkpoint_data'>;
    pending_item: GeneratedItem | null;
    item_fingerprints: string[];
}

/**
 * Quality validation result
 */
export interface QualityValidationResult {
    valid: boolean;
    issues: QualityIssue[];
    confidence: number;
    suggested_fixes?: string[];
}

/**
 * Quality issue
 */
export interface QualityIssue {
    type: 'content_policy' | 'mathematical_error' | 'factual_error' | 'repetition' | 'difficulty_mismatch' | 'format_error';
    severity: 'warning' | 'error' | 'critical';
    message: string;
    field?: string;
}

/**
 * Cross-domain item definition
 */
export interface CrossDomainItem extends GeneratedItem {
    primary_stat: StatName;
    secondary_stats: StatName[];
    secondary_difficulties: Record<StatName, number>;
}

/**
 * Convergence check result
 */
export interface ConvergenceResult {
    converged: boolean;
    stats_converged: StatName[];
    stats_pending: StatName[];
    overall_confidence: number;
    recommendation: 'continue' | 'complete' | 'extend';
    reason: string;
}

/**
 * Fatigue indicators
 */
export interface FatigueIndicators {
    score: number;
    consecutive_slow_responses: number;
    error_rate_trend: 'stable' | 'increasing' | 'decreasing';
    response_time_trend: 'stable' | 'increasing' | 'decreasing';
    should_intervene: boolean;
    suggested_action: 'continue' | 'break' | 'terminate';
}

export interface AssessmentSession {
    id: string;
    student_id: string;
    config: OrchestratorConfig;
    status: 'initializing' | 'active' | 'paused' | 'completing' | 'completed' | 'abandoned';

    // Assessment state
    current_stat: StatName;
    current_ability: AbilityEstimate;
    stat_abilities: Record<StatName, AbilityEstimate>;

    // Item tracking
    items_administered: GeneratedItem[];
    evaluations: ResponseEvaluation[];
    items_by_stat: Record<StatName, GeneratedItem[]>;
    pending_item: GeneratedItem | null;

    // Progress tracking
    strands_tested: Set<string>;
    strand_coverage: Record<string, Record<string, number>>;  // stat -> strand -> count
    misconceptions_found: string[];

    // Timing
    started_at: string;
    last_activity: string;
    total_time_seconds: number;

    // Fatigue tracking
    fatigue: FatigueIndicators;
    response_times: number[];

    // Quality tracking
    rejected_items: number;
    regeneration_count: number;

    // Domain agent states
    domain_agents: Record<StatName, DomainAgentState>;

    // Checkpoint data
    checkpoint_data: SessionCheckpoint | null;
    last_checkpoint_at: string | null;

    // Termination tracking
    termination_reason?: TerminationReason;
}

export type TerminationReason =
    | 'max_items_reached'
    | 'convergence_achieved'
    | 'time_limit_reached'
    | 'ceiling_effect'
    | 'floor_effect'
    | 'user_completed'
    | 'user_abandoned'
    | 'all_stats_complete'
    | 'student_fatigue'
    | 'ceiling_floor_all_stats'
    | 'error';

export interface NextItemRequest {
    session_id: string;
    force_stat?: StatName;
    force_strand?: string;
    force_difficulty?: number;
}

export interface SubmitResponseRequest {
    session_id: string;
    item_id: string;
    response: string;
    response_time_ms?: number;
}

export interface SessionProgress {
    session_id: string;
    student_id: string;
    status: AssessmentSession['status'];

    // Overall progress
    items_completed: number;
    max_items: number;
    time_elapsed_seconds: number;
    time_remaining_seconds: number;

    // Per-stat progress
    stat_progress: Record<StatName, {
        items: number;
        theta: number;
        se: number;
        converged: boolean;
    }>;

    // Current state
    current_stat: StatName;
    current_theta: number;
    current_se: number;

    // Termination status
    can_complete: boolean;
    termination_available: boolean;
    suggested_action: 'continue' | 'complete' | 'switch_stat';
}

export interface DiagnosticResult {
    session_id: string;
    student_id: string;
    completed_at: string;
    duration_seconds: number;
    termination_reason: TerminationReason;

    // Global results
    overall_theta: number;
    overall_se: number;
    overall_level: number;  // 0-100 scale
    overall_confidence_interval: [number, number];
    overall_percentile: number;
    estimated_grade_level: number;

    // Per-stat results
    stat_results: Record<StatName, StatDiagnosticResult>;

    // Strand-level breakdown
    strand_breakdown: StrandBreakdown[];

    // Skill gaps and strengths
    identified_gaps: IdentifiedGap[];
    strong_areas: StrongArea[];

    // Insights and recommendations
    strengths: string[];
    growth_areas: string[];
    misconceptions: string[];
    recommendations: Recommendation[];

    // Quality metrics
    quality_metrics: QualityMetrics;

    // Raw data
    items_administered: number;
    items_answered: number;
    average_response_time_ms: number;
    total_time_seconds: number;
}

/**
 * Per-stat diagnostic result
 */
export interface StatDiagnosticResult {
    stat_name: StatName;
    theta: number;
    se: number;
    estimated_level: number;
    confidence_interval: [number, number];
    percentile: number;
    items_administered: number;
    accuracy: number;
    average_difficulty: number;
    confidence: 'high' | 'medium' | 'low';
    convergence_achieved: boolean;
    trend: 'improving' | 'stable' | 'declining';
    strand_breakdown: Record<string, {
        theta: number;
        se: number;
        items: number;
        accuracy: number;
    }>;
}

/**
 * Strand-level breakdown
 */
export interface StrandBreakdown {
    strand_key: string;
    strand_name: string;
    stat_name: StatName;
    items_presented: number;
    items_correct: number;
    accuracy: number;
    estimated_level: number;
    status: 'not_assessed' | 'insufficient_data' | 'below_grade' | 'at_grade' | 'above_grade';
}

/**
 * Identified skill gap
 */
export interface IdentifiedGap {
    strand_key: string;
    strand_name: string;
    stat_name: StatName;
    gap_severity: 'minor' | 'moderate' | 'significant' | 'critical';
    current_level: number;
    grade_level_expectation: number;
    priority: number;
    prerequisite_gaps?: string[];
}

/**
 * Strong area identification
 */
export interface StrongArea {
    strand_key: string;
    strand_name: string;
    stat_name: StatName;
    level: number;
    percentile: number;
    enrichment_ready: boolean;
}

/**
 * Recommendation for next steps
 */
export interface Recommendation {
    type: 'focus_area' | 'enrichment' | 'reassess' | 'intervention' | 'practice';
    priority: 'high' | 'medium' | 'low';
    stat_name?: StatName;
    strand_key?: string;
    description: string;
    suggested_activities?: string[];
    estimated_time_minutes?: number;
}

/**
 * Quality metrics for the session
 */
export interface QualityMetrics {
    items_validated: number;
    items_rejected: number;
    regeneration_rate: number;
    average_item_quality: number;
    content_policy_flags: number;
    deduplication_count: number;
}

// =============================================================================
// SESSION STORE
// =============================================================================

const activeSessions = new Map<string, AssessmentSession>();

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: OrchestratorConfig = {
    // Session limits
    maxItemsPerSession: 30,
    maxTimeMinutes: 45,
    convergenceThreshold: 0.35,
    minItemsForConvergence: 8,

    // Quality settings
    validateItemsBeforePresentation: true,
    enableQualityChecks: true,
    qaStrictness: 'standard',

    // Adaptive settings
    initialDifficulty: 0.5,
    difficultyStepUp: 0.1,
    difficultyStepDown: 0.15,
    ceilingThreshold: 0.9,
    floorThreshold: 0.1,

    // Multi-stat settings
    multiStatEnabled: false,
    statsToAssess: ['math'],
    crossDomainEnabled: true,

    // Fatigue detection
    fatigueDetectionEnabled: true,
    fatigueThreshold: 70,
    slowResponseThresholdMs: 45000,

    // Strand balancing
    strandWeights: {},
    prioritizeGaps: true,

    // Session recovery
    enableCheckpoints: true,
    checkpointIntervalItems: 5,
};

// =============================================================================
// CONSTANTS
// =============================================================================

const DIFFICULTY_STEP_UP = 0.12;
const DIFFICULTY_STEP_DOWN = 0.15;
const MIN_DIFFICULTY = 0.05;
const MAX_DIFFICULTY = 0.95;

const CEILING_THRESHOLD = 0.90;
const FLOOR_THRESHOLD = 0.30;
const CEILING_DIFFICULTY = 0.85;
const FLOOR_DIFFICULTY = 0.20;

const FATIGUE_THRESHOLD = 70;
const SLOW_RESPONSE_THRESHOLD_MS = 45000;

// Prohibited content patterns for quality checks
const PROHIBITED_PATTERNS = [
    /violence|violent|weapon/i,
    /drug|alcohol|tobacco/i,
    /explicit|sexual/i,
    /discriminat|racist|sexist/i,
];

// =============================================================================
// ORCHESTRATOR CLASS
// =============================================================================

export class ForgeOrchestrator {
    private engine: GenerativeAssessmentEngine;
    private itemFingerprints: Set<string> = new Set();
    private studentContext: StudentContext | null = null;

    constructor() {
        this.engine = getGenerativeEngine();
    }

    // =========================================================================
    // INITIALIZATION HELPERS
    // =========================================================================

    /**
     * Initialize fatigue indicators
     */
    private initializeFatigueIndicators(): FatigueIndicators {
        return {
            score: 0,
            consecutive_slow_responses: 0,
            error_rate_trend: 'stable',
            response_time_trend: 'stable',
            should_intervene: false,
            suggested_action: 'continue',
        };
    }

    /**
     * Initialize domain agent state
     */
    private initializeDomainAgent(stat: StatName): DomainAgentState {
        const blueprint = getBlueprint(stat);
        const firstStrand = blueprint.strands[0];

        return {
            stat_name: stat,
            current_strand: firstStrand?.strand || null,
            current_tier: 'Foundation',
            items_generated: 0,
            last_generation_at: null,
            generation_errors: 0,
        };
    }

    /**
     * Create a session checkpoint
     */
    private createCheckpoint(session: AssessmentSession): SessionCheckpoint {
        const sessionCopy = { ...session };
        delete (sessionCopy as any).checkpoint_data;

        return {
            version: 1,
            created_at: new Date().toISOString(),
            session_state: sessionCopy as Omit<AssessmentSession, 'checkpoint_data'>,
            pending_item: session.pending_item,
            item_fingerprints: Array.from(this.itemFingerprints.values()),
        };
    }

    /**
     * Generate item fingerprint for deduplication
     */
    private generateItemFingerprint(item: GeneratedItem): string {
        const stem = item.prompt.toLowerCase().replace(/\s+/g, ' ').trim();
        const answer = item.correct_answer.toLowerCase().replace(/\s+/g, ' ').trim();
        return `${item.stat_name}::${item.strand}::${stem.slice(0, 100)}::${answer}`;
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    /**
     * Start a new assessment session
     */
    async startSession(
        studentId: string,
        statName: StatName,
        configOverrides?: Partial<OrchestratorConfig>
    ): Promise<AssessmentSession> {
        const config = { ...DEFAULT_CONFIG, ...configOverrides };
        const now = new Date().toISOString();

        // Get student context from memory
        const context = getAssessmentContext(studentId, statName);

        // Initialize ability estimate from profile or fresh
        const profile = context.profile;
        const existingAbility = profile.stat_profiles[statName];
        const initialAbility: AbilityEstimate = existingAbility.items_total > 0
            ? {
                theta: existingAbility.theta,
                standard_error: Math.min(1.5, existingAbility.se * 1.2), // Add uncertainty for new session
                items_administered: 0,
                strand_estimates: Object.fromEntries(
                    Object.entries(existingAbility.strand_profiles).map(([strand, sp]) => [
                        strand,
                        { theta: sp.theta, se: Math.min(1.5, sp.se * 1.2), items: 0 }
                    ])
                ),
                manifold_profile: existingAbility.manifold_profile,
            }
            : createInitialAbilityEstimate();

        // Initialize strand coverage tracking
        const blueprint = getBlueprint(statName);
        const strandCoverage: Record<string, Record<string, number>> = {
            [statName]: Object.fromEntries(
                blueprint.strands.map(s => [s.strand, 0])
            )
        };

        // Create session with all enhanced fields
        const session: AssessmentSession = {
            id: randomUUID(),
            student_id: studentId,
            config,
            status: 'active',
            current_stat: statName,
            current_ability: initialAbility,
            stat_abilities: { [statName]: initialAbility } as Record<StatName, AbilityEstimate>,
            items_administered: [],
            evaluations: [],
            items_by_stat: { [statName]: [] } as Record<StatName, GeneratedItem[]>,
            pending_item: null,
            strands_tested: new Set(),
            strand_coverage: strandCoverage,
            misconceptions_found: [],
            started_at: now,
            last_activity: now,
            total_time_seconds: 0,
            fatigue: this.initializeFatigueIndicators(),
            response_times: [],
            rejected_items: 0,
            regeneration_count: 0,
            domain_agents: { [statName]: this.initializeDomainAgent(statName) } as Record<StatName, DomainAgentState>,
            checkpoint_data: null,
            last_checkpoint_at: null,
        };

        // Store session
        activeSessions.set(session.id, session);
        this.persistSession(session);

        // Record session start event
        recordLearningEvent(
            studentId,
            'optimal_challenge',
            {
                session_id: session.id,
                starting_theta: initialAbility.theta,
                starting_se: initialAbility.standard_error,
            },
            statName,
            undefined,
            session.id
        );

        return session;
    }

    /**
     * Start multi-stat diagnostic battery
     */
    async startMultiStatSession(
        studentId: string,
        stats: StatName[],
        configOverrides?: Partial<OrchestratorConfig>
    ): Promise<AssessmentSession> {
        const config = {
            ...DEFAULT_CONFIG,
            ...configOverrides,
            multiStatEnabled: true,
            statsToAssess: stats,
            maxItemsPerSession: Math.min(60, stats.length * 15),
        };

        // Start with first stat
        const session = await this.startSession(studentId, stats[0], config);

        // Initialize abilities, domain agents, and strand coverage for all stats
        const profile = getStudentProfile(studentId);
        for (const stat of stats) {
            if (stat === stats[0]) continue; // Already initialized

            const existing = profile.stat_profiles[stat];
            session.stat_abilities[stat] = existing.items_total > 0
                ? {
                    theta: existing.theta,
                    standard_error: Math.min(1.5, existing.se * 1.2),
                    items_administered: 0,
                    strand_estimates: {},
                    manifold_profile: existing.manifold_profile,
                }
                : createInitialAbilityEstimate();

            session.items_by_stat[stat] = [];

            // Initialize domain agent for this stat
            session.domain_agents[stat] = this.initializeDomainAgent(stat);

            // Initialize strand coverage for this stat
            const statBlueprint = getBlueprint(stat);
            session.strand_coverage[stat] = Object.fromEntries(
                statBlueprint.strands.map(s => [s.strand, 0])
            );
        }

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): AssessmentSession | undefined {
        return activeSessions.get(sessionId);
    }

    /**
     * Pause a session for later resumption
     */
    pauseSession(sessionId: string): void {
        const session = activeSessions.get(sessionId);
        if (session) {
            session.status = 'paused';
            session.last_activity = new Date().toISOString();
            this.persistSession(session);
        }
    }

    /**
     * Resume a paused session
     */
    resumeSession(sessionId: string): AssessmentSession | undefined {
        const session = activeSessions.get(sessionId);
        if (session && session.status === 'paused') {
            session.status = 'active';
            session.last_activity = new Date().toISOString();
            this.persistSession(session);
        }
        return session;
    }

    /**
     * Recover session from checkpoint
     */
    async recoverFromCheckpoint(sessionId: string): Promise<AssessmentSession | null> {
        // Try to load from database
        const db = getDatabase();
        const row = db.prepare(`
            SELECT data_json, status FROM hyro_generative_sessions
            WHERE id = ? ORDER BY updated_at DESC LIMIT 1
        `).get(sessionId) as { data_json: string; status: string } | undefined;

        if (!row) {
            return null;
        }

        try {
            const data = JSON.parse(row.data_json);
            if (data.checkpoint_data) {
                const checkpoint: SessionCheckpoint = data.checkpoint_data;

                // Restore session from checkpoint
                const restoredSession: AssessmentSession = {
                    ...checkpoint.session_state,
                    status: 'active',
                    last_activity: new Date().toISOString(),
                    checkpoint_data: checkpoint,
                    strands_tested: new Set(checkpoint.session_state.strands_tested as unknown as string[]),
                };

                // Restore item fingerprints
                this.itemFingerprints = new Set(checkpoint.item_fingerprints);

                // Re-add to active sessions
                activeSessions.set(sessionId, restoredSession);

                // Record recovery event
                recordLearningEvent(
                    restoredSession.student_id,
                    'optimal_challenge',  // Use valid event type
                    {
                        session_id: sessionId,
                        recovered_from_checkpoint: true,
                        items_at_recovery: restoredSession.items_administered.length,
                    },
                    restoredSession.current_stat,
                    undefined,
                    sessionId
                );

                return restoredSession;
            }
        } catch (error) {
            console.error(`[Orchestrator] Failed to recover session ${sessionId}:`, error);
        }

        return null;
    }

    /**
     * Save checkpoint if interval reached
     */
    private maybeCreateCheckpoint(session: AssessmentSession): void {
        if (!session.config.enableCheckpoints) return;

        const itemsSinceLastCheckpoint = session.last_checkpoint_at
            ? session.items_administered.filter(
                i => new Date((i as any).created_at || '').getTime() > new Date(session.last_checkpoint_at!).getTime()
            ).length
            : session.items_administered.length;

        if (itemsSinceLastCheckpoint >= session.config.checkpointIntervalItems) {
            session.checkpoint_data = this.createCheckpoint(session);
            session.last_checkpoint_at = new Date().toISOString();
            this.persistSession(session);
        }
    }

    // =========================================================================
    // ITEM SELECTION AND GENERATION
    // =========================================================================

    /**
     * Get the next item for the session
     */
    async getNextItem(request: NextItemRequest): Promise<GeneratedItem | null> {
        const session = activeSessions.get(request.session_id);
        if (!session || session.status !== 'active') {
            return null;
        }

        // Check termination conditions
        const termination = this.checkTermination(session);
        if (termination) {
            session.termination_reason = termination;
            return null;
        }

        // Determine which stat to assess
        const targetStat = request.force_stat || this.selectNextStat(session);
        session.current_stat = targetStat;
        session.current_ability = session.stat_abilities[targetStat];

        // Get item parameters from adaptive algorithm
        // ZPD INTEGRATION: Use ZPD-aware strand selection for optimal difficulty targeting
        const targetParams = request.force_strand && request.force_difficulty
            ? {
                strand: request.force_strand,
                tier: this.getTierForStrand(targetStat, request.force_strand),
                difficulty: request.force_difficulty,
                manifold: this.getManifoldForStrand(targetStat, request.force_strand),
            }
            : await this.selectNextStrandWithZPD(session, targetStat)
                .then(zpdResult => ({
                    strand: zpdResult.strand,
                    tier: zpdResult.tier,
                    difficulty: zpdResult.difficulty,
                    manifold: this.getManifoldForStrand(targetStat, zpdResult.strand),
                }));

        // Generate the item
        const avoidTopics = session.items_administered
            .filter(i => i.stat_name === targetStat)
            .map(i => i.strand)
            .slice(-5); // Avoid recent strands

        const item = await this.engine.generateItem(
            targetStat,
            targetParams.strand,
            targetParams.tier,
            targetParams.difficulty,
            targetParams.manifold,
            'multiple_choice',
            avoidTopics
        );

        // Quality check
        if (session.config.enableQualityChecks && !this.validateItem(item)) {
            // Try regenerating once
            return this.engine.generateItem(
                targetStat,
                targetParams.strand,
                targetParams.tier,
                targetParams.difficulty,
                targetParams.manifold,
                'multiple_choice',
                avoidTopics
            );
        }

        // Track the item
        session.items_administered.push(item);
        if (!session.items_by_stat[targetStat]) {
            session.items_by_stat[targetStat] = [];
        }
        session.items_by_stat[targetStat].push(item);
        session.strands_tested.add(item.strand);
        session.last_activity = new Date().toISOString();

        this.persistSession(session);

        return item;
    }

    /**
     * Select which stat to assess next in multi-stat mode
     */
    private selectNextStat(session: AssessmentSession): StatName {
        if (!session.config.multiStatEnabled) {
            return session.current_stat;
        }

        const stats = session.config.statsToAssess;

        // Find stat with highest uncertainty (SE) that hasn't converged
        let bestStat = session.current_stat;
        let maxSE = 0;

        for (const stat of stats) {
            const ability = session.stat_abilities[stat];
            if (!ability) continue;

            // Skip if converged
            if (ability.standard_error < session.config.convergenceThreshold) {
                continue;
            }

            // Prefer higher uncertainty
            if (ability.standard_error > maxSE) {
                maxSE = ability.standard_error;
                bestStat = stat;
            }
        }

        return bestStat;
    }

    /**
     * Select next strand using ZPD-based adaptive routing
     * Considers uncertainty, strand coverage, and identified gaps
     *
     * ZPD INTEGRATION: Uses getEnhancedZPDState to determine optimal difficulty
     * that falls within the student's Zone of Proximal Development.
     *
     * Key ZPD principles applied:
     * - Content should be slightly above current ability (10-20%)
     * - Too easy = boredom, too hard = frustration
     * - Adjust dynamically based on recent performance
     * - Use manifold state vectors for scaffolding decisions
     */
    private async selectNextStrandWithZPD(
        session: AssessmentSession,
        stat: StatName
    ): Promise<{ strand: string; difficulty: number; tier: StrandTier; priority: number }> {
        const blueprint = getBlueprint(stat);
        const ability = session.stat_abilities[stat];

        // Get enhanced ZPD state for optimal difficulty targeting
        // This includes manifold state vectors and scaffolding recommendations
        const zpdState = getEnhancedZPDState(stat, session.student_id);

        // Convert ZPD optimal_difficulty from 0-100 scale to 0-1 scale for item generation
        // ZPD engine uses level-based 0-100 scale, generative engine uses 0-1 difficulty scale
        const zpdOptimalDifficulty01 = zpdState.optimal_difficulty / 100;

        // Log ZPD context for debugging/auditing
        console.log(`[ZPD] stat=${stat} student=${session.student_id} ` +
            `zpd_lower=${zpdState.zpd_lower.toFixed(1)} ` +
            `zpd_upper=${zpdState.zpd_upper.toFixed(1)} ` +
            `optimal=${zpdState.optimal_difficulty.toFixed(1)} (${zpdOptimalDifficulty01.toFixed(2)} scaled) ` +
            `trend=${zpdState.trend} ` +
            `scaffolding=${zpdState.scaffolding_recommended}`);

        // If manifold state vector recommends significant scaffolding, reduce difficulty
        let difficultyModifier = 0;
        if (zpdState.manifold_recommendation?.scaffolding_level === 'significant') {
            difficultyModifier = -0.10; // Reduce difficulty by 10%
            console.log(`[ZPD] Applying scaffolding reduction: -0.10`);
        } else if (zpdState.manifold_recommendation?.scaffolding_level === 'moderate') {
            difficultyModifier = -0.05; // Reduce difficulty by 5%
        }

        // Build strand candidates with scoring
        const candidates: Array<{
            strand: Strand;
            score: number;
            difficulty: number;
            reason: string;
        }> = [];

        for (const strandInfo of blueprint.strands) {
            const strandKey = strandInfo.strand;
            const coverage = session.strand_coverage[stat]?.[strandKey] || 0;
            const strandEstimate = ability.strand_estimates?.[strandKey];

            // Calculate uncertainty-based score
            const strandSE = strandEstimate?.se ?? 1.5; // High uncertainty if not tested
            let score = strandSE; // Base score on uncertainty

            // Apply strand weight if configured
            const customWeight = session.config.strandWeights[strandKey];
            if (customWeight !== undefined) {
                score *= customWeight;
            }

            // Boost score for untested or under-tested strands
            if (coverage === 0) {
                score *= 2.0;
            } else if (coverage < 2) {
                score *= 1.5;
            }

            // Gap prioritization: boost strands where student is struggling
            if (session.config.prioritizeGaps && strandEstimate) {
                if (strandEstimate.theta < ability.theta - 0.5) {
                    score *= 1.8; // This strand is weaker than overall ability
                }
            }

            // Avoid recent strands (recency penalty)
            const recentStrands = session.items_administered
                .slice(-5)
                .map(i => i.strand);
            if (recentStrands.includes(strandKey)) {
                score *= 0.3; // Strong penalty for very recent
            }

            // Calculate target difficulty using ZPD (0-1 scale)
            let targetDifficulty = zpdOptimalDifficulty01 + difficultyModifier;

            // Adjust based on strand-specific performance
            if (strandEstimate && strandEstimate.items > 0) {
                // If doing well in this strand, push harder
                if (strandEstimate.theta > ability.theta + 0.3) {
                    targetDifficulty = Math.min(MAX_DIFFICULTY, targetDifficulty + DIFFICULTY_STEP_UP);
                }
                // If struggling, ease up
                else if (strandEstimate.theta < ability.theta - 0.3) {
                    targetDifficulty = Math.max(MIN_DIFFICULTY, targetDifficulty - DIFFICULTY_STEP_DOWN);
                }
            }

            // Clamp to valid range
            targetDifficulty = Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, targetDifficulty));

            candidates.push({
                strand: strandInfo,
                score,
                difficulty: targetDifficulty,
                reason: coverage === 0 ? 'untested' :
                    strandSE > 1.0 ? 'high_uncertainty' :
                        'coverage_balance',
            });
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);

        // Select top candidate
        const selected = candidates[0];

        console.log(`[ZPD] Selected strand=${selected.strand.strand} ` +
            `difficulty=${selected.difficulty.toFixed(2)} ` +
            `tier=${selected.strand.tier} ` +
            `reason=${selected.reason}`);

        return {
            strand: selected.strand.strand,
            difficulty: selected.difficulty,
            tier: selected.strand.tier,
            priority: selected.score,
        };
    }

    /**
     * Get ZPD-based routing recommendation
     */
    private getZPDRoutingRecommendation(
        session: AssessmentSession,
        stat: StatName,
        lastEvaluation?: ResponseEvaluation
    ): { difficulty_change: number; strand_switch: boolean; reason: string } {
        const ability = session.stat_abilities[stat];
        const recentEvals = session.evaluations.slice(-5);

        if (recentEvals.length < 3) {
            return {
                difficulty_change: 0,
                strand_switch: false,
                reason: 'insufficient_data',
            };
        }

        const recentAccuracy = recentEvals.filter(e => e.is_correct).length / recentEvals.length;
        const recentItems = session.items_administered.slice(-5);
        const avgDifficulty = recentItems.reduce((sum, i) => sum + i.difficulty, 0) / recentItems.length;

        // Ceiling detection: high accuracy at high difficulty
        if (recentAccuracy >= CEILING_THRESHOLD && avgDifficulty >= CEILING_DIFFICULTY) {
            return {
                difficulty_change: DIFFICULTY_STEP_UP,
                strand_switch: true, // Try a different strand at ceiling
                reason: 'ceiling_detected',
            };
        }

        // Floor detection: low accuracy at low difficulty
        if (recentAccuracy <= FLOOR_THRESHOLD && avgDifficulty <= FLOOR_DIFFICULTY) {
            return {
                difficulty_change: -DIFFICULTY_STEP_DOWN,
                strand_switch: true, // Try an easier strand
                reason: 'floor_detected',
            };
        }

        // Optimal zone: 50-80% accuracy
        if (recentAccuracy >= 0.5 && recentAccuracy <= 0.8) {
            // In ZPD - maintain or slight increase
            return {
                difficulty_change: recentAccuracy >= 0.7 ? DIFFICULTY_STEP_UP * 0.5 : 0,
                strand_switch: false,
                reason: 'in_zpd',
            };
        }

        // Adjust difficulty based on performance
        if (recentAccuracy > 0.8) {
            return {
                difficulty_change: DIFFICULTY_STEP_UP,
                strand_switch: false,
                reason: 'increase_challenge',
            };
        } else {
            return {
                difficulty_change: -DIFFICULTY_STEP_DOWN,
                strand_switch: false,
                reason: 'reduce_difficulty',
            };
        }
    }

    // =========================================================================
    // RESPONSE HANDLING
    // =========================================================================

    /**
     * Submit and evaluate a response
     */
    async submitResponse(request: SubmitResponseRequest): Promise<ResponseEvaluation | null> {
        const session = activeSessions.get(request.session_id);
        if (!session || session.status !== 'active') {
            return null;
        }

        // Find the item
        const item = session.items_administered.find(i => i.id === request.item_id);
        if (!item) {
            return null;
        }

        // Evaluate the response
        const evaluation = await this.engine.evaluateResponse(
            item,
            request.response,
            request.response_time_ms ? request.response_time_ms / 1000 : undefined
        );

        // Store evaluation
        session.evaluations.push(evaluation);

        // Update ability estimate
        const stat = item.stat_name;
        session.stat_abilities[stat] = this.engine.updateAbilityEstimate(
            session.stat_abilities[stat],
            item,
            evaluation
        );
        session.current_ability = session.stat_abilities[stat];

        // Track misconceptions
        if (evaluation.misconception_detected) {
            session.misconceptions_found.push(evaluation.misconception_detected);

            // Record in memory system
            recordMisconception(
                session.student_id,
                stat,
                item.strand,
                evaluation.misconception_detected,
                item.id
            );
        }

        // Update timing
        session.last_activity = new Date().toISOString();
        const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 1000;
        session.total_time_seconds = Math.round(elapsed);

        // Track response time and update fatigue indicators
        if (request.response_time_ms) {
            session.response_times.push(request.response_time_ms);
            this.updateFatigueIndicators(session, request.response_time_ms, evaluation.is_correct);
        }

        // Update strand coverage
        if (session.strand_coverage[stat]) {
            session.strand_coverage[stat][item.strand] =
                (session.strand_coverage[stat][item.strand] || 0) + 1;
        }

        // Update domain agent state
        if (session.domain_agents[stat]) {
            session.domain_agents[stat].current_strand = item.strand;
            session.domain_agents[stat].items_generated++;
        }

        // Maybe create checkpoint
        this.maybeCreateCheckpoint(session);

        // Persist to database
        this.persistItemLog(session, item, request.response, evaluation);
        this.persistSession(session);

        return evaluation;
    }

    /**
     * Update fatigue indicators based on response
     */
    private updateFatigueIndicators(
        session: AssessmentSession,
        responseTimeMs: number,
        isCorrect: boolean
    ): void {
        const fatigue = session.fatigue;
        const config = session.config;

        // Track slow responses
        if (responseTimeMs > config.slowResponseThresholdMs) {
            fatigue.consecutive_slow_responses++;
        } else {
            fatigue.consecutive_slow_responses = Math.max(0, fatigue.consecutive_slow_responses - 1);
        }

        // Calculate response time trend
        if (session.response_times.length >= 5) {
            const recent = session.response_times.slice(-5);
            const earlier = session.response_times.slice(-10, -5);

            if (earlier.length >= 3) {
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

                if (recentAvg > earlierAvg * 1.3) {
                    fatigue.response_time_trend = 'increasing';
                } else if (recentAvg < earlierAvg * 0.8) {
                    fatigue.response_time_trend = 'decreasing';
                } else {
                    fatigue.response_time_trend = 'stable';
                }
            }
        }

        // Calculate error rate trend
        if (session.evaluations.length >= 5) {
            const recentEvals = session.evaluations.slice(-5);
            const earlierEvals = session.evaluations.slice(-10, -5);

            if (earlierEvals.length >= 3) {
                const recentErrorRate = recentEvals.filter(e => !e.is_correct).length / recentEvals.length;
                const earlierErrorRate = earlierEvals.filter(e => !e.is_correct).length / earlierEvals.length;

                if (recentErrorRate > earlierErrorRate + 0.2) {
                    fatigue.error_rate_trend = 'increasing';
                } else if (recentErrorRate < earlierErrorRate - 0.2) {
                    fatigue.error_rate_trend = 'decreasing';
                } else {
                    fatigue.error_rate_trend = 'stable';
                }
            }
        }

        // Calculate overall fatigue score (0-100)
        let score = 0;

        // Slow response contribution (0-40 points)
        score += Math.min(40, fatigue.consecutive_slow_responses * 10);

        // Response time trend contribution (0-20 points)
        if (fatigue.response_time_trend === 'increasing') score += 20;

        // Error rate trend contribution (0-20 points)
        if (fatigue.error_rate_trend === 'increasing') score += 20;

        // Time-based fatigue (0-20 points)
        const sessionMinutes = session.total_time_seconds / 60;
        score += Math.min(20, sessionMinutes * 0.5);

        fatigue.score = Math.min(100, score);

        // Determine intervention
        if (fatigue.score >= config.fatigueThreshold) {
            fatigue.should_intervene = true;
            fatigue.suggested_action = fatigue.score >= 85 ? 'terminate' : 'break';
        } else if (fatigue.score >= config.fatigueThreshold * 0.7) {
            fatigue.should_intervene = true;
            fatigue.suggested_action = 'break';
        } else {
            fatigue.should_intervene = false;
            fatigue.suggested_action = 'continue';
        }
    }

    // =========================================================================
    // SESSION COMPLETION
    // =========================================================================

    /**
     * Complete the session and generate results
     */
    async completeSession(sessionId: string): Promise<DiagnosticResult | null> {
        const session = activeSessions.get(sessionId);
        if (!session) {
            return null;
        }

        session.status = 'completed';
        session.termination_reason = session.termination_reason || 'user_completed';

        // Generate diagnostic result
        const result = this.generateDiagnosticResult(session);

        // Update student profile in memory
        for (const [stat, ability] of Object.entries(session.stat_abilities)) {
            if (ability.items_administered > 0) {
                updateStatProfile(session.student_id, stat as StatName, {
                    theta: ability.theta,
                    se: ability.standard_error,
                    items_added: ability.items_administered,
                    strand_updates: ability.strand_estimates as any,
                    manifold_updates: ability.manifold_profile,
                });
            }
        }

        // Record completion event
        recordLearningEvent(
            session.student_id,
            'mastery_achieved',
            {
                session_id: sessionId,
                result_summary: {
                    overall_theta: result.overall_theta,
                    items: result.items_administered,
                },
            },
            undefined,
            undefined,
            sessionId
        );

        // Persist final result
        this.persistResult(result);
        this.persistSession(session);

        // Clean up active session (but keep for potential review)
        // activeSessions.delete(sessionId);

        return result;
    }

    /**
     * Generate the diagnostic result from session data
     */
    private generateDiagnosticResult(session: AssessmentSession): DiagnosticResult {
        const now = new Date().toISOString();

        // Calculate overall theta (weighted by items per stat)
        let totalTheta = 0;
        let totalWeight = 0;

        const statResults: DiagnosticResult['stat_results'] = {} as any;

        for (const [stat, ability] of Object.entries(session.stat_abilities)) {
            if (ability.items_administered === 0) continue;

            const items = session.items_by_stat[stat as StatName] || [];
            const evals = session.evaluations.filter((_, i) =>
                session.items_administered[i]?.stat_name === stat
            );

            const correct = evals.filter(e => e.is_correct).length;
            const accuracy = items.length > 0 ? correct / items.length : 0;
            const avgDifficulty = items.length > 0
                ? items.reduce((sum, i) => sum + i.difficulty, 0) / items.length
                : 0.5;

            const weight = 1 / (ability.standard_error * ability.standard_error);
            totalTheta += ability.theta * weight;
            totalWeight += weight;

            // Calculate trend from recent performance
            const trend = this.calculatePerformanceTrend(evals);

            // Build strand breakdown for this stat
            const strandBreakdown: StatDiagnosticResult['strand_breakdown'] = {};
            for (const [strand, estimate] of Object.entries(ability.strand_estimates || {})) {
                const strandItems = items.filter(i => i.strand === strand);
                const strandEvals = evals.filter((_, i) => {
                    const itemIndex = session.items_administered.findIndex(
                        item => item.id === strandItems[i]?.id
                    );
                    return itemIndex >= 0;
                });
                const strandCorrect = strandEvals.filter(e => e.is_correct).length;

                strandBreakdown[strand] = {
                    theta: estimate.theta,
                    se: estimate.se,
                    items: estimate.items,
                    accuracy: strandItems.length > 0 ? strandCorrect / strandItems.length : 0,
                };
            }

            statResults[stat as StatName] = {
                stat_name: stat as StatName,
                theta: ability.theta,
                se: ability.standard_error,
                items_administered: ability.items_administered,
                accuracy,
                average_difficulty: avgDifficulty,
                estimated_level: this.thetaToLevel(ability.theta),
                confidence_interval: [
                    ability.theta - 1.96 * ability.standard_error,
                    ability.theta + 1.96 * ability.standard_error,
                ],
                percentile: this.thetaToPercentile(ability.theta),
                confidence: ability.standard_error < 0.35 ? 'high' :
                    ability.standard_error < 0.5 ? 'medium' : 'low',
                convergence_achieved: ability.standard_error < session.config.convergenceThreshold,
                trend,
                strand_breakdown: strandBreakdown,
            };
        }

        const overallTheta = totalWeight > 0 ? totalTheta / totalWeight : 0;
        const overallSE = totalWeight > 0 ? Math.sqrt(1 / totalWeight) : 1.5;

        // Generate strand-level breakdown
        const strandBreakdown = this.generateStrandBreakdown(session, statResults);

        // Identify gaps and strengths
        const identifiedGaps = this.identifyGaps(session, statResults, strandBreakdown);
        const strongAreas = this.identifyStrengths(session, statResults, strandBreakdown);

        // Generate insights and recommendations
        const insights = this.generateInsights(session, statResults);
        const recommendations = this.generateRecommendations(session, statResults, identifiedGaps, strongAreas);

        // Calculate quality metrics
        const qualityMetrics = this.calculateQualityMetrics(session);

        // Calculate average response time
        const avgResponseTime = session.response_times.length > 0
            ? session.response_times.reduce((a, b) => a + b, 0) / session.response_times.length
            : 0;

        return {
            session_id: session.id,
            student_id: session.student_id,
            completed_at: now,
            duration_seconds: session.total_time_seconds,
            termination_reason: session.termination_reason || 'user_completed',
            overall_theta: overallTheta,
            overall_se: overallSE,
            overall_level: this.thetaToLevel(overallTheta),
            overall_confidence_interval: [
                overallTheta - 1.96 * overallSE,
                overallTheta + 1.96 * overallSE,
            ],
            overall_percentile: this.thetaToPercentile(overallTheta),
            estimated_grade_level: this.thetaToGradeLevel(overallTheta),
            stat_results: statResults,
            strand_breakdown: strandBreakdown,
            identified_gaps: identifiedGaps,
            strong_areas: strongAreas,
            strengths: insights.strengths,
            growth_areas: insights.growth_areas,
            misconceptions: session.misconceptions_found,
            recommendations,
            quality_metrics: qualityMetrics,
            items_administered: session.items_administered.length,
            items_answered: session.evaluations.length,
            average_response_time_ms: avgResponseTime,
            total_time_seconds: session.total_time_seconds,
        };
    }

    /**
     * Calculate performance trend from evaluations
     */
    private calculatePerformanceTrend(
        evals: ResponseEvaluation[]
    ): 'improving' | 'stable' | 'declining' {
        if (evals.length < 6) return 'stable';

        const firstHalf = evals.slice(0, Math.floor(evals.length / 2));
        const secondHalf = evals.slice(Math.floor(evals.length / 2));

        const firstAccuracy = firstHalf.filter(e => e.is_correct).length / firstHalf.length;
        const secondAccuracy = secondHalf.filter(e => e.is_correct).length / secondHalf.length;

        const diff = secondAccuracy - firstAccuracy;

        if (diff > 0.15) return 'improving';
        if (diff < -0.15) return 'declining';
        return 'stable';
    }

    /**
     * Generate strand-level breakdown
     */
    private generateStrandBreakdown(
        session: AssessmentSession,
        statResults: Record<StatName, StatDiagnosticResult>
    ): StrandBreakdown[] {
        const breakdowns: StrandBreakdown[] = [];

        for (const [stat, result] of Object.entries(statResults)) {
            const blueprint = getBlueprint(stat as StatName);

            for (const strandInfo of blueprint.strands) {
                const strandKey = strandInfo.strand;
                const strandData = result.strand_breakdown[strandKey];
                const coverage = session.strand_coverage[stat]?.[strandKey] || 0;

                let status: StrandBreakdown['status'];
                if (coverage === 0) {
                    status = 'not_assessed';
                } else if (coverage < 3) {
                    status = 'insufficient_data';
                } else if (strandData && strandData.theta < -0.5) {
                    status = 'below_grade';
                } else if (strandData && strandData.theta > 0.5) {
                    status = 'above_grade';
                } else {
                    status = 'at_grade';
                }

                breakdowns.push({
                    strand_key: strandKey,
                    strand_name: strandInfo.strand.replace(/_/g, ' '),
                    stat_name: stat as StatName,
                    items_presented: coverage,
                    items_correct: strandData
                        ? Math.round(strandData.accuracy * coverage)
                        : 0,
                    accuracy: strandData?.accuracy || 0,
                    estimated_level: strandData
                        ? this.thetaToLevel(strandData.theta)
                        : 50,
                    status,
                });
            }
        }

        return breakdowns;
    }

    /**
     * Identify skill gaps
     */
    private identifyGaps(
        session: AssessmentSession,
        statResults: Record<StatName, StatDiagnosticResult>,
        strandBreakdown: StrandBreakdown[]
    ): IdentifiedGap[] {
        const gaps: IdentifiedGap[] = [];

        for (const strand of strandBreakdown) {
            if (strand.status === 'below_grade' || strand.status === 'insufficient_data') {
                const statResult = statResults[strand.stat_name];
                const strandData = statResult?.strand_breakdown[strand.strand_key];

                if (!strandData) continue;

                // Calculate gap severity
                let severity: IdentifiedGap['gap_severity'];
                const delta = strandData.theta - statResult.theta;

                if (delta < -1.0 || strandData.theta < -1.5) {
                    severity = 'critical';
                } else if (delta < -0.5 || strandData.theta < -0.5) {
                    severity = 'significant';
                } else if (delta < -0.25) {
                    severity = 'moderate';
                } else {
                    severity = 'minor';
                }

                // Calculate priority (higher = more urgent)
                const priority = severity === 'critical' ? 4 :
                    severity === 'significant' ? 3 :
                        severity === 'moderate' ? 2 : 1;

                gaps.push({
                    strand_key: strand.strand_key,
                    strand_name: strand.strand_name,
                    stat_name: strand.stat_name,
                    gap_severity: severity,
                    current_level: strand.estimated_level,
                    grade_level_expectation: this.thetaToLevel(0), // 0 = grade level
                    priority,
                });
            }
        }

        // Sort by priority descending
        return gaps.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Identify strong areas
     */
    private identifyStrengths(
        session: AssessmentSession,
        statResults: Record<StatName, StatDiagnosticResult>,
        strandBreakdown: StrandBreakdown[]
    ): StrongArea[] {
        const strengths: StrongArea[] = [];

        for (const strand of strandBreakdown) {
            if (strand.status === 'above_grade' && strand.items_presented >= 3) {
                const statResult = statResults[strand.stat_name];
                const strandData = statResult?.strand_breakdown[strand.strand_key];

                if (!strandData) continue;

                strengths.push({
                    strand_key: strand.strand_key,
                    strand_name: strand.strand_name,
                    stat_name: strand.stat_name,
                    level: strand.estimated_level,
                    percentile: this.thetaToPercentile(strandData.theta),
                    enrichment_ready: strandData.theta > 1.0 && strandData.se < 0.5,
                });
            }
        }

        return strengths.sort((a, b) => b.level - a.level);
    }

    /**
     * Generate recommendations
     */
    private generateRecommendations(
        session: AssessmentSession,
        statResults: Record<StatName, StatDiagnosticResult>,
        gaps: IdentifiedGap[],
        strengths: StrongArea[]
    ): Recommendation[] {
        const recommendations: Recommendation[] = [];

        // Recommendations for critical gaps
        for (const gap of gaps.filter(g => g.gap_severity === 'critical').slice(0, 3)) {
            recommendations.push({
                type: 'intervention',
                priority: 'high',
                stat_name: gap.stat_name,
                strand_key: gap.strand_key,
                description: `Intensive support needed for ${gap.strand_name}. Student is significantly below grade level.`,
                suggested_activities: [
                    'One-on-one tutoring',
                    'Targeted skill building exercises',
                    'Review prerequisite concepts',
                ],
                estimated_time_minutes: 30,
            });
        }

        // Recommendations for significant gaps
        for (const gap of gaps.filter(g => g.gap_severity === 'significant').slice(0, 2)) {
            recommendations.push({
                type: 'focus_area',
                priority: 'high',
                stat_name: gap.stat_name,
                strand_key: gap.strand_key,
                description: `Focus practice on ${gap.strand_name} to build proficiency.`,
                suggested_activities: [
                    'Guided practice problems',
                    'Video lessons on key concepts',
                    'Practice with immediate feedback',
                ],
                estimated_time_minutes: 20,
            });
        }

        // Practice recommendations for moderate gaps
        for (const gap of gaps.filter(g => g.gap_severity === 'moderate').slice(0, 2)) {
            recommendations.push({
                type: 'practice',
                priority: 'medium',
                stat_name: gap.stat_name,
                strand_key: gap.strand_key,
                description: `Additional practice recommended for ${gap.strand_name}.`,
                suggested_activities: [
                    'Daily practice problems',
                    'Review worked examples',
                ],
                estimated_time_minutes: 15,
            });
        }

        // Enrichment for strong areas
        for (const strength of strengths.filter(s => s.enrichment_ready).slice(0, 2)) {
            recommendations.push({
                type: 'enrichment',
                priority: 'low',
                stat_name: strength.stat_name,
                strand_key: strength.strand_key,
                description: `Student excels in ${strength.strand_name}. Consider enrichment opportunities.`,
                suggested_activities: [
                    'Challenge problems',
                    'Peer tutoring opportunities',
                    'Advanced topic exploration',
                ],
                estimated_time_minutes: 20,
            });
        }

        // Reassessment recommendations for insufficient data
        const insufficientStrands = Object.entries(session.strand_coverage)
            .flatMap(([stat, strands]) =>
                Object.entries(strands)
                    .filter(([_, count]) => count > 0 && count < 3)
                    .map(([strand]) => ({ stat: stat as StatName, strand }))
            );

        if (insufficientStrands.length > 3) {
            recommendations.push({
                type: 'reassess',
                priority: 'medium',
                description: 'Some skills had insufficient data for accurate assessment. Consider a follow-up diagnostic.',
                estimated_time_minutes: 15,
            });
        }

        return recommendations;
    }

    /**
     * Calculate quality metrics for the session
     */
    private calculateQualityMetrics(session: AssessmentSession): QualityMetrics {
        const totalGenerated = session.items_administered.length + session.rejected_items;

        return {
            items_validated: session.items_administered.length,
            items_rejected: session.rejected_items,
            regeneration_rate: totalGenerated > 0
                ? session.regeneration_count / totalGenerated
                : 0,
            average_item_quality: 1 - (session.rejected_items / Math.max(1, totalGenerated)),
            content_policy_flags: 0, // Would be tracked if we added that field
            deduplication_count: 0,  // Would be tracked if we added that field
        };
    }

    /**
     * Convert theta to percentile
     */
    private thetaToPercentile(theta: number): number {
        // Using normal distribution approximation
        // theta 0 = 50th percentile, +1 = ~84th, +2 = ~98th
        const z = theta;
        const p = 0.5 * (1 + Math.tanh(z * 0.7978845608)); // Approximation of CDF
        return Math.round(Math.max(1, Math.min(99, p * 100)));
    }

    /**
     * Generate insights from session data
     */
    private generateInsights(
        session: AssessmentSession,
        statResults: DiagnosticResult['stat_results']
    ): { strengths: string[]; growth_areas: string[]; recommendations: string[] } {
        const strengths: string[] = [];
        const growth_areas: string[] = [];
        const recommendations: string[] = [];

        for (const [stat, result] of Object.entries(statResults)) {
            if (result.theta > 1.0) {
                strengths.push(`Strong performance in ${stat} (above grade level)`);
            } else if (result.theta < -0.5) {
                growth_areas.push(`Developing skills in ${stat}`);
                recommendations.push(`Focus on foundational ${stat} concepts`);
            }

            // Strand-level insights
            for (const [strand, sp] of Object.entries(result.strand_breakdown)) {
                if (sp.theta > 1.5 && sp.items > 2) {
                    strengths.push(`Excellent ${strand} skills`);
                } else if (sp.theta < -0.5 && sp.items > 2) {
                    growth_areas.push(`${strand} needs practice`);
                }
            }
        }

        // Misconception-based recommendations
        if (session.misconceptions_found.length > 0) {
            const unique = Array.from(new Set(session.misconceptions_found).values());
            for (const misc of unique.slice(0, 3)) {
                recommendations.push(`Review: ${misc}`);
            }
        }

        return { strengths, growth_areas, recommendations };
    }

    // =========================================================================
    // PROGRESS & STATUS
    // =========================================================================

    /**
     * Get current session progress
     */
    getProgress(sessionId: string): SessionProgress | null {
        const session = activeSessions.get(sessionId);
        if (!session) return null;

        const now = Date.now();
        const elapsed = (now - new Date(session.started_at).getTime()) / 1000;
        const maxTime = session.config.maxTimeMinutes * 60;

        const statProgress: SessionProgress['stat_progress'] = {} as any;

        for (const stat of session.config.statsToAssess) {
            const ability = session.stat_abilities[stat];
            if (!ability) continue;

            statProgress[stat] = {
                items: ability.items_administered,
                theta: ability.theta,
                se: ability.standard_error,
                converged: ability.standard_error < session.config.convergenceThreshold,
            };
        }

        const canComplete = session.items_administered.length >= 5;
        const allConverged = Object.values(statProgress).every(s => s.converged);

        return {
            session_id: session.id,
            student_id: session.student_id,
            status: session.status,
            items_completed: session.items_administered.length,
            max_items: session.config.maxItemsPerSession,
            time_elapsed_seconds: Math.round(elapsed),
            time_remaining_seconds: Math.max(0, Math.round(maxTime - elapsed)),
            stat_progress: statProgress,
            current_stat: session.current_stat,
            current_theta: session.current_ability.theta,
            current_se: session.current_ability.standard_error,
            can_complete: canComplete,
            termination_available: canComplete || allConverged,
            suggested_action: allConverged ? 'complete' :
                session.items_administered.length >= session.config.maxItemsPerSession * 0.8 ? 'complete' : 'continue',
        };
    }

    // =========================================================================
    // TERMINATION LOGIC
    // =========================================================================

    /**
     * Check if session should terminate
     */
    private checkTermination(session: AssessmentSession): TerminationReason | null {
        // Max items
        if (session.items_administered.length >= session.config.maxItemsPerSession) {
            return 'max_items_reached';
        }

        // Time limit
        const elapsed = (Date.now() - new Date(session.started_at).getTime()) / 1000;
        if (elapsed >= session.config.maxTimeMinutes * 60) {
            return 'time_limit_reached';
        }

        // Fatigue detection
        if (session.config.fatigueDetectionEnabled &&
            session.fatigue.should_intervene &&
            session.fatigue.suggested_action === 'terminate') {
            return 'student_fatigue';
        }

        // Convergence (all stats converged) - only if minimum items met
        if (session.items_administered.length >= session.config.minItemsForConvergence) {
            if (session.config.multiStatEnabled) {
                const allConverged = session.config.statsToAssess.every(stat => {
                    const ability = session.stat_abilities[stat];
                    return ability && ability.standard_error < session.config.convergenceThreshold;
                });
                if (allConverged) {
                    return 'all_stats_complete';
                }
            } else {
                if (session.current_ability.standard_error < session.config.convergenceThreshold) {
                    return 'convergence_achieved';
                }
            }
        }

        // Ceiling/floor effects
        const ceilingFloor = this.checkCeilingFloorEffects(session);
        if (ceilingFloor) {
            return ceilingFloor;
        }

        return null;
    }

    /**
     * Check for ceiling/floor effects across stats
     */
    private checkCeilingFloorEffects(session: AssessmentSession): TerminationReason | null {
        const stats = session.config.multiStatEnabled
            ? session.config.statsToAssess
            : [session.current_stat];

        let ceilingCount = 0;
        let floorCount = 0;

        for (const stat of stats) {
            const statItems = session.items_by_stat[stat] || [];
            if (statItems.length < 5) continue;

            const recentItems = statItems.slice(-5);
            const recentEvals = session.evaluations
                .filter((_, i) => {
                    const item = session.items_administered[i];
                    return item?.stat_name === stat;
                })
                .slice(-5);

            if (recentEvals.length < 5) continue;

            const accuracy = recentEvals.filter(e => e.is_correct).length / 5;
            const avgDifficulty = recentItems.reduce((sum, i) => sum + i.difficulty, 0) / 5;

            if (accuracy >= CEILING_THRESHOLD && avgDifficulty >= CEILING_DIFFICULTY) {
                ceilingCount++;
            }
            if (accuracy <= FLOOR_THRESHOLD && avgDifficulty <= FLOOR_DIFFICULTY) {
                floorCount++;
            }
        }

        // If all stats are at ceiling or floor
        if (session.config.multiStatEnabled) {
            if (ceilingCount === stats.length || floorCount === stats.length) {
                return 'ceiling_floor_all_stats';
            }
        } else {
            if (ceilingCount > 0) return 'ceiling_effect';
            if (floorCount > 0) return 'floor_effect';
        }

        return null;
    }

    /**
     * Comprehensive convergence check with detailed status
     */
    checkConvergence(sessionId: string): ConvergenceResult {
        const session = activeSessions.get(sessionId);
        if (!session) {
            return {
                converged: false,
                stats_converged: [],
                stats_pending: [],
                overall_confidence: 0,
                recommendation: 'continue',
                reason: 'session_not_found',
            };
        }

        const stats = session.config.multiStatEnabled
            ? session.config.statsToAssess
            : [session.current_stat];

        const convergedStats: StatName[] = [];
        const pendingStats: StatName[] = [];
        let totalWeight = 0;
        let weightedConfidence = 0;

        for (const stat of stats) {
            const ability = session.stat_abilities[stat];
            if (!ability) {
                pendingStats.push(stat);
                continue;
            }

            // Check minimum items
            if (ability.items_administered < session.config.minItemsForConvergence) {
                pendingStats.push(stat);
                continue;
            }

            // Check SE threshold
            if (ability.standard_error < session.config.convergenceThreshold) {
                convergedStats.push(stat);
            } else {
                pendingStats.push(stat);
            }

            // Calculate weighted confidence
            const weight = ability.items_administered;
            totalWeight += weight;
            const statConfidence = Math.max(0, 1 - ability.standard_error / 1.5);
            weightedConfidence += statConfidence * weight;
        }

        const overallConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
        const allConverged = pendingStats.length === 0 && convergedStats.length > 0;

        // Determine recommendation
        let recommendation: ConvergenceResult['recommendation'];
        let reason: string;

        if (allConverged) {
            recommendation = 'complete';
            reason = 'All stats have converged';
        } else if (session.items_administered.length >= session.config.maxItemsPerSession * 0.9) {
            recommendation = 'complete';
            reason = 'Approaching item limit with acceptable precision';
        } else if (overallConfidence >= 0.8 && session.items_administered.length >= session.config.minItemsForConvergence) {
            recommendation = 'complete';
            reason = 'High confidence achieved';
        } else if (pendingStats.length > 0 && session.items_administered.length < session.config.maxItemsPerSession * 0.5) {
            recommendation = 'extend';
            reason = 'More items needed for convergence';
        } else {
            recommendation = 'continue';
            reason = `${pendingStats.length} stats pending convergence`;
        }

        return {
            converged: allConverged,
            stats_converged: convergedStats,
            stats_pending: pendingStats,
            overall_confidence: overallConfidence,
            recommendation,
            reason,
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    // =========================================================================
    // QUALITY ASSURANCE PIPELINE
    // =========================================================================

    /**
     * Comprehensive item validation
     */
    private validateItem(item: GeneratedItem): boolean {
        const result = this.validateItemComprehensive(item, 'standard');
        return result.valid;
    }

    /**
     * Full quality validation with detailed results
     */
    private validateItemComprehensive(
        item: GeneratedItem,
        strictness: 'relaxed' | 'standard' | 'strict'
    ): QualityValidationResult {
        const issues: QualityIssue[] = [];
        let confidence = 1.0;

        // Basic structure validation
        if (!item.prompt || item.prompt.length < 10) {
            issues.push({
                type: 'format_error',
                severity: 'critical',
                message: 'Item prompt is missing or too short',
                field: 'prompt',
            });
        }

        if (!item.correct_answer) {
            issues.push({
                type: 'format_error',
                severity: 'critical',
                message: 'Correct answer is missing',
                field: 'correct_answer',
            });
        }

        if (item.format === 'multiple_choice' && !item.options) {
            issues.push({
                type: 'format_error',
                severity: 'critical',
                message: 'Multiple choice item missing options',
                field: 'options',
            });
        }

        // Check options uniqueness
        if (item.options) {
            const values = Object.values(item.options);
            const unique = new Set(values.map(v => v.toLowerCase().trim()));
            if (unique.size !== values.length) {
                issues.push({
                    type: 'format_error',
                    severity: 'error',
                    message: 'Duplicate answer options detected',
                    field: 'options',
                });
            }

            // Check that correct answer is in options
            if (!Object.values(item.options).some(v =>
                v.toLowerCase().trim() === item.correct_answer.toLowerCase().trim()
            )) {
                issues.push({
                    type: 'mathematical_error',
                    severity: 'critical',
                    message: 'Correct answer not found in options',
                });
            }
        }

        // Content policy check
        const policyResult = this.checkContentPolicy(item, strictness);
        issues.push(...policyResult.issues);
        confidence *= policyResult.confidence;

        // Mathematical accuracy check (for math items)
        if (item.stat_name === 'math') {
            const mathResult = this.checkMathematicalAccuracy(item);
            issues.push(...mathResult.issues);
            confidence *= mathResult.confidence;
        }

        // Deduplication check
        const fingerprint = this.generateItemFingerprint(item);
        if (this.itemFingerprints.has(fingerprint)) {
            issues.push({
                type: 'repetition',
                severity: 'error',
                message: 'Item appears to be a duplicate',
            });
        }

        // Difficulty reasonableness check
        if (item.difficulty < MIN_DIFFICULTY || item.difficulty > MAX_DIFFICULTY) {
            issues.push({
                type: 'difficulty_mismatch',
                severity: 'warning',
                message: `Item difficulty ${item.difficulty} outside expected range`,
            });
        }

        // Calculate overall validity
        const criticalIssues = issues.filter(i => i.severity === 'critical').length;
        const errorIssues = issues.filter(i => i.severity === 'error').length;

        let valid = criticalIssues === 0;
        if (strictness === 'strict') {
            valid = valid && errorIssues === 0;
        }

        return {
            valid,
            issues,
            confidence,
            suggested_fixes: issues
                .filter(i => i.severity !== 'critical')
                .map(i => `Fix: ${i.message}`),
        };
    }

    /**
     * Content policy compliance check
     */
    private checkContentPolicy(
        item: GeneratedItem,
        strictness: 'relaxed' | 'standard' | 'strict'
    ): { issues: QualityIssue[]; confidence: number } {
        const issues: QualityIssue[] = [];
        let confidence = 1.0;

        const textToCheck = [
            item.prompt,
            item.correct_answer,
            ...(item.options ? Object.values(item.options) : []),
            (item as any).explanation || '',
        ].join(' ');

        // Check prohibited patterns
        for (const pattern of PROHIBITED_PATTERNS) {
            if (pattern.test(textToCheck)) {
                const severity = strictness === 'relaxed' ? 'warning' : 'error';
                issues.push({
                    type: 'content_policy',
                    severity,
                    message: `Content may contain inappropriate material: ${pattern.source}`,
                });
                confidence *= 0.5;
            }
        }

        // Check for excessive complexity in wording (readability)
        const words = item.prompt.split(/\s+/);
        const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        if (avgWordLength > 8 && strictness !== 'relaxed') {
            issues.push({
                type: 'content_policy',
                severity: 'warning',
                message: 'Item text may be too complex for target audience',
            });
            confidence *= 0.9;
        }

        // Check for cultural/regional bias indicators
        const biasPatterns = [
            /\$\d+(?:\.\d{2})?/g,  // Dollar amounts (US bias)
            /\b(football|soccer)\b/i,  // Sport naming varies by region
        ];

        for (const pattern of biasPatterns) {
            if (pattern.test(textToCheck) && strictness === 'strict') {
                issues.push({
                    type: 'content_policy',
                    severity: 'warning',
                    message: 'Item may contain regional/cultural bias',
                });
            }
        }

        return { issues, confidence };
    }

    /**
     * Mathematical accuracy validation
     */
    private checkMathematicalAccuracy(item: GeneratedItem): { issues: QualityIssue[]; confidence: number } {
        const issues: QualityIssue[] = [];
        let confidence = 1.0;

        // Extract numbers from prompt
        const numberPattern = /\d+(?:\.\d+)?/g;
        const promptNumbers = item.prompt.match(numberPattern)?.map(Number) || [];

        // Simple arithmetic check for basic operations
        const operationPatterns = {
            addition: /(\d+)\s*\+\s*(\d+)/,
            subtraction: /(\d+)\s*[-−]\s*(\d+)/,
            multiplication: /(\d+)\s*[×x*]\s*(\d+)/i,
            division: /(\d+)\s*[÷/]\s*(\d+)/,
        };

        for (const [op, pattern] of Object.entries(operationPatterns)) {
            const match = item.prompt.match(pattern);
            if (match) {
                const a = parseFloat(match[1]);
                const b = parseFloat(match[2]);
                let expected: number;

                switch (op) {
                    case 'addition': expected = a + b; break;
                    case 'subtraction': expected = a - b; break;
                    case 'multiplication': expected = a * b; break;
                    case 'division': expected = b !== 0 ? a / b : NaN; break;
                    default: expected = NaN;
                }

                // Check if correct answer matches expected result
                const answerNum = parseFloat(item.correct_answer.replace(/[^0-9.-]/g, ''));
                if (!isNaN(expected) && !isNaN(answerNum)) {
                    const tolerance = Math.abs(expected) * 0.001; // 0.1% tolerance
                    if (Math.abs(answerNum - expected) > tolerance) {
                        issues.push({
                            type: 'mathematical_error',
                            severity: 'critical',
                            message: `Arithmetic check failed: expected ${expected}, got ${answerNum}`,
                        });
                        confidence *= 0.1;
                    }
                }
            }
        }

        // Check for division by zero scenarios
        if (/[÷/]\s*0\b/.test(item.prompt)) {
            issues.push({
                type: 'mathematical_error',
                severity: 'critical',
                message: 'Division by zero detected in problem',
            });
            confidence *= 0.1;
        }

        // Check for negative results in contexts where they don't make sense
        const answerNum = parseFloat(item.correct_answer.replace(/[^0-9.-]/g, ''));
        if (answerNum < 0) {
            const contextPatterns = [
                /how many/i,
                /number of/i,
                /count/i,
                /total.*items/i,
                /age/i,
            ];
            for (const pattern of contextPatterns) {
                if (pattern.test(item.prompt)) {
                    issues.push({
                        type: 'mathematical_error',
                        severity: 'warning',
                        message: 'Negative answer in context expecting positive value',
                    });
                    confidence *= 0.7;
                    break;
                }
            }
        }

        return { issues, confidence };
    }

    /**
     * Check if item is a duplicate
     */
    private isDuplicateItem(item: GeneratedItem): boolean {
        const fingerprint = this.generateItemFingerprint(item);
        return this.itemFingerprints.has(fingerprint);
    }

    /**
     * Register item fingerprint to prevent duplicates
     */
    private registerItemFingerprint(item: GeneratedItem): void {
        const fingerprint = this.generateItemFingerprint(item);
        this.itemFingerprints.add(fingerprint);
    }

    /**
     * Validate and potentially regenerate item
     */
    private async validateAndRegenerateIfNeeded(
        item: GeneratedItem,
        session: AssessmentSession,
        targetParams: { strand: string; tier: StrandTier; difficulty: number; manifold: ManifoldDimension },
        maxAttempts: number = 3
    ): Promise<GeneratedItem | null> {
        let currentItem = item;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const validation = this.validateItemComprehensive(currentItem, session.config.qaStrictness);

            if (validation.valid) {
                // Register fingerprint and return
                this.registerItemFingerprint(currentItem);
                return currentItem;
            }

            // Track rejection
            session.rejected_items++;
            session.regeneration_count++;
            attempts++;

            if (attempts >= maxAttempts) {
                console.warn(`[Orchestrator] Item failed validation after ${maxAttempts} attempts`);
                return null;
            }

            // Regenerate with different parameters
            const avoidTopics = session.items_administered
                .slice(-5)
                .map(i => i.prompt.slice(0, 50)); // Avoid similar prompts

            currentItem = await this.engine.generateItem(
                session.current_stat,
                targetParams.strand,
                targetParams.tier,
                targetParams.difficulty,
                targetParams.manifold,
                'multiple_choice',
                avoidTopics
            );
        }

        return null;
    }

    private getTierForStrand(stat: StatName, strand: string): StrandTier {
        const blueprint = getBlueprint(stat);
        const strandInfo = blueprint.strands.find(s => s.strand === strand);
        return strandInfo?.tier || 'Foundation';
    }

    private getManifoldForStrand(stat: StatName, strand: string): ManifoldDimension {
        const blueprint = getBlueprint(stat);
        const strandInfo = blueprint.strands.find(s => s.strand === strand);
        return strandInfo?.manifold_focus || 'coherence';
    }

    private thetaToLevel(theta: number): number {
        // Map theta (-3 to +3) to level (0-100)
        return Math.round(Math.max(0, Math.min(100, (theta + 3) / 6 * 100)));
    }

    private thetaToGradeLevel(theta: number): number {
        // Map theta to approximate grade level
        // theta 0 = 6th grade, +1 = 9th grade, -1 = 3rd grade
        return Math.round(Math.max(1, Math.min(12, 6 + theta * 3)));
    }

    // =========================================================================
    // PERSISTENCE
    // =========================================================================

    private persistSession(session: AssessmentSession): void {
        const db = getDatabase();

        db.prepare(`
            INSERT OR REPLACE INTO hyro_generative_sessions
            (id, student_id, stat_name, status, ability_theta, ability_se,
             items_count, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            session.id,
            session.student_id,
            session.current_stat,
            session.status,
            session.current_ability.theta,
            session.current_ability.standard_error,
            session.items_administered.length,
            JSON.stringify({
                config: session.config,
                stat_abilities: session.stat_abilities,
                strands_tested: Array.from(session.strands_tested),
                misconceptions_found: session.misconceptions_found,
                termination_reason: session.termination_reason,
            }),
            session.started_at,
            session.last_activity
        );
    }

    private persistItemLog(
        session: AssessmentSession,
        item: GeneratedItem,
        response: string,
        evaluation: ResponseEvaluation
    ): void {
        const db = getDatabase();

        db.prepare(`
            INSERT INTO hyro_generated_items_log
            (id, session_id, student_id, stat_name, strand, tier, difficulty,
             prompt, correct_answer, student_response, is_correct, score,
             evaluation_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            item.id,
            session.id,
            session.student_id,
            item.stat_name,
            item.strand,
            item.tier,
            item.difficulty,
            item.prompt,
            item.correct_answer,
            response,
            evaluation.is_correct ? 1 : 0,
            evaluation.score,
            JSON.stringify(evaluation),
            new Date().toISOString()
        );
    }

    private persistResult(result: DiagnosticResult): void {
        const db = getDatabase();

        db.prepare(`
            INSERT INTO hyro_generative_results
            (id, student_id, stat_name, session_id, estimated_level,
             theta, standard_error, items_count, results_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            randomUUID(),
            result.student_id,
            Object.keys(result.stat_results)[0] || 'multi',
            result.session_id,
            result.estimated_grade_level,
            result.overall_theta,
            result.overall_se,
            result.items_administered,
            JSON.stringify(result),
            result.completed_at
        );
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let orchestratorInstance: ForgeOrchestrator | null = null;

export function getOrchestrator(): ForgeOrchestrator {
    if (!orchestratorInstance) {
        orchestratorInstance = new ForgeOrchestrator();
    }
    return orchestratorInstance;
}

/**
 * Reset the orchestrator instance (for testing)
 */
export function resetOrchestrator(): void {
    orchestratorInstance = null;
    activeSessions.clear();
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): Map<string, AssessmentSession> {
    return new Map(activeSessions);
}

/**
 * Get session count
 */
export function getActiveSessionCount(): number {
    return activeSessions.size;
}

export default {
    ForgeOrchestrator,
    getOrchestrator,
    resetOrchestrator,
    getActiveSessions,
    getActiveSessionCount,
    DEFAULT_CONFIG,
};
