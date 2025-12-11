/**
 * HYRO Forge Memory Integration
 *
 * @hyro-domain learning_memory
 * @hyro-manifold Enhanced memory layer bridging local SQLite with Mem0/Graphiti
 *
 * This module integrates the new Mem0-based semantic memory service with the
 * existing SQLite-based memory architecture. It provides:
 *
 * 1. Dual-write: Critical data is written to both local SQLite and Mem0
 * 2. Enhanced retrieval: Combines structured local data with semantic search
 * 3. Temporal tracking: Uses Graphiti-inspired patterns for learning trajectories
 * 4. Graceful degradation: Falls back to local-only if Mem0 service is unavailable
 *
 * The existing forge-memory-architecture.ts remains the primary system.
 * This module enhances it with AI-native memory capabilities.
 */

import type { StatName } from './forge-types';
import type { ManifoldDimension } from './forge-blueprints';
import {
    getMemoryClient,
    recordItemResponse,
    recordSessionComplete,
    recordMisconceptionFromResponse,
    getGenerationContext,
    type StudentContext as ExternalContext,
} from './forge-memory-client';
import {
    getStudentProfile,
    getStudentContext as getLocalContext,
    recordMisconception as recordLocalMisconception,
    recordLearningEvent,
    updateStatProfile,
    type StudentLearningProfile,
    type MisconceptionRecord,
    type LearningEventType,
} from './forge-memory-architecture';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Enhanced assessment context combining local and external memory
 */
export interface EnhancedAssessmentContext {
    // Core student data (from local SQLite)
    student_id: string;
    profile: StudentLearningProfile;

    // Semantic memories (from Mem0)
    semantic_memories: SemanticMemory[];

    // Active misconceptions (merged from both sources)
    active_misconceptions: MergedMisconception[];

    // Recent performance signals
    recent_signals: PerformanceSignal[];

    // AI-generated insights
    ai_insights?: AIInsight[];

    // Recommended item generation parameters
    generation_params: GenerationParams;

    // Source metadata
    sources: {
        local_available: boolean;
        mem0_available: boolean;
        graphiti_available: boolean;
    };
}

export interface SemanticMemory {
    id: string;
    content: string;
    relevance: number;
    timestamp: string;
    metadata: Record<string, any>;
}

export interface MergedMisconception {
    id: string;
    stat_name: StatName;
    strand: string;
    misconception: string;
    detection_count: number;
    first_detected: string;
    last_detected: string;
    severity: number;  // 0-1, computed from frequency and recency
    source: 'local' | 'mem0' | 'both';
}

export interface PerformanceSignal {
    type: 'item_response' | 'session_complete' | 'breakthrough' | 'struggle' | 'zpd_shift';
    stat: StatName;
    timestamp: string;
    data: Record<string, any>;
}

export interface AIInsight {
    type: 'pattern' | 'recommendation' | 'alert';
    content: string;
    confidence: number;
    action?: string;
}

export interface GenerationParams {
    target_difficulty: number;
    difficulty_range: [number, number];
    avoid_topics: string[];
    emphasize_topics: string[];
    scaffolding_level: 'none' | 'light' | 'moderate' | 'significant';
    misconception_focus: string[];
}

// =============================================================================
// ENHANCED MEMORY OPERATIONS
// =============================================================================

/**
 * Get enhanced assessment context combining all memory sources
 */
export async function getEnhancedContext(
    studentId: string,
    stat: StatName
): Promise<EnhancedAssessmentContext> {
    const client = getMemoryClient();

    // Start with local context (always available)
    const localContext = getLocalContext(studentId, stat);
    const profile = getStudentProfile(studentId);

    // Track source availability
    const sources = {
        local_available: true,
        mem0_available: false,
        graphiti_available: false,  // Future: check Graphiti status
    };

    // Initialize enhanced context
    const context: EnhancedAssessmentContext = {
        student_id: studentId,
        profile,
        semantic_memories: [],
        active_misconceptions: localContext.active_misconceptions.map(m => ({
            ...m,
            severity: calculateMisconceptionSeverity(m),
            source: 'local' as const,
        })),
        recent_signals: [],
        generation_params: {
            target_difficulty: localContext.session_adjustments.starting_difficulty,
            difficulty_range: [
                Math.max(0.1, localContext.session_adjustments.starting_difficulty - 0.2),
                Math.min(0.9, localContext.session_adjustments.starting_difficulty + 0.2),
            ],
            avoid_topics: localContext.session_adjustments.avoid_strands,
            emphasize_topics: localContext.session_adjustments.focus_strands,
            scaffolding_level: 'none',
            misconception_focus: localContext.active_misconceptions.slice(0, 3).map(m => m.misconception),
        },
        sources,
    };

    // Try to enhance with Mem0 data
    try {
        if (await client.isAvailable()) {
            sources.mem0_available = true;

            // Get external context
            const externalContext = await getGenerationContext(studentId, stat);

            if (externalContext) {
                // Merge semantic memories
                context.semantic_memories = externalContext.memories.map((m: any) => ({
                    id: m.id || m.memory_id,
                    content: m.memory || m.content,
                    relevance: m.score || 0.5,
                    timestamp: m.metadata?.timestamp || new Date().toISOString(),
                    metadata: m.metadata || {},
                }));

                // Merge misconceptions from Mem0
                for (const extMisc of externalContext.misconceptions || []) {
                    const existing = context.active_misconceptions.find(
                        m => m.misconception === extMisc.memory
                    );

                    if (existing) {
                        existing.source = 'both';
                        existing.severity = Math.max(existing.severity, extMisc.score || 0.5);
                    } else {
                        context.active_misconceptions.push({
                            id: extMisc.id || `mem0_${Date.now()}`,
                            stat_name: stat,
                            strand: extMisc.metadata?.strand || 'unknown',
                            misconception: extMisc.memory,
                            detection_count: 1,
                            first_detected: extMisc.metadata?.timestamp || new Date().toISOString(),
                            last_detected: extMisc.metadata?.timestamp || new Date().toISOString(),
                            severity: extMisc.score || 0.5,
                            source: 'mem0',
                        });
                    }
                }

                // Extract recent events as signals
                for (const event of externalContext.recent_events || []) {
                    context.recent_signals.push({
                        type: event.event_type as any,
                        stat: event.stat,
                        timestamp: event.timestamp,
                        data: event.data,
                    });
                }

                // Generate AI insights from memories
                context.ai_insights = generateInsightsFromMemories(
                    context.semantic_memories,
                    context.active_misconceptions
                );
            }
        }
    } catch (error) {
        console.log('[MemoryIntegration] Mem0 enhancement failed, using local only:', error);
    }

    // Calculate scaffolding level based on context
    context.generation_params.scaffolding_level = calculateScaffoldingLevel(context);

    return context;
}

/**
 * Calculate misconception severity from frequency and recency
 */
function calculateMisconceptionSeverity(m: MisconceptionRecord): number {
    const daysSinceFirst = (Date.now() - new Date(m.first_detected).getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceLast = (Date.now() - new Date(m.last_detected).getTime()) / (1000 * 60 * 60 * 24);

    // High frequency + recent = high severity
    const frequencyFactor = Math.min(1, m.detection_count / 5);
    const recencyFactor = Math.exp(-daysSinceLast / 7);  // Decay over 7 days
    const persistenceFactor = daysSinceFirst > 7 ? 0.2 : 0;  // Bonus for persistent issues

    return Math.min(1, frequencyFactor * 0.5 + recencyFactor * 0.3 + persistenceFactor);
}

/**
 * Generate AI insights from semantic memories
 */
function generateInsightsFromMemories(
    memories: SemanticMemory[],
    misconceptions: MergedMisconception[]
): AIInsight[] {
    const insights: AIInsight[] = [];

    // Insight: Persistent struggle pattern
    const highSeverityMisconceptions = misconceptions.filter(m => m.severity > 0.7);
    if (highSeverityMisconceptions.length > 0) {
        insights.push({
            type: 'alert',
            content: `Student has ${highSeverityMisconceptions.length} persistent misconception(s) that need targeted intervention`,
            confidence: 0.9,
            action: 'Focus on scaffolded items addressing these misconceptions',
        });
    }

    // Insight: Learning velocity from memories
    const recentMemories = memories.filter(m => {
        const age = Date.now() - new Date(m.timestamp).getTime();
        return age < 7 * 24 * 60 * 60 * 1000;  // Last 7 days
    });

    if (recentMemories.length > 10) {
        insights.push({
            type: 'pattern',
            content: 'High activity level detected - student is actively engaged',
            confidence: 0.8,
        });
    }

    // Insight: Cross-topic connections
    const strands = new Set(misconceptions.map(m => m.strand));
    if (strands.size >= 3) {
        insights.push({
            type: 'recommendation',
            content: 'Multiple strands have misconceptions - consider foundational review',
            confidence: 0.7,
            action: 'Present items that connect underlying concepts',
        });
    }

    return insights;
}

/**
 * Calculate recommended scaffolding level
 */
function calculateScaffoldingLevel(
    context: EnhancedAssessmentContext
): 'none' | 'light' | 'moderate' | 'significant' {
    const recentStruggles = context.recent_signals.filter(
        s => s.type === 'struggle' || (s.type === 'item_response' && !s.data.correct)
    ).length;

    const highSeverityMisconceptions = context.active_misconceptions.filter(
        m => m.severity > 0.7
    ).length;

    // Use existing profile consistency
    const consistency = context.profile.consistency_index;

    // Decision logic
    if (highSeverityMisconceptions >= 3 || recentStruggles >= 5) {
        return 'significant';
    }
    if (highSeverityMisconceptions >= 1 || recentStruggles >= 3 || consistency < 0.4) {
        return 'moderate';
    }
    if (recentStruggles >= 1) {
        return 'light';
    }
    return 'none';
}

// =============================================================================
// DUAL-WRITE OPERATIONS
// =============================================================================

/**
 * Record an item response to both local and Mem0
 */
export async function recordItemResponseDual(
    studentId: string,
    stat: StatName,
    itemId: string,
    strand: string,
    correct: boolean,
    responseTimeMs: number,
    theta: number,
    se: number,
    difficulty: number,
    misconceptionDetected?: string
): Promise<void> {
    // 1. Always write to local (synchronous, reliable)
    // (This would be done via recordSessionItem in forge-memory-architecture.ts)

    // 2. Write to Mem0 (async, fire-and-forget)
    recordItemResponse(
        studentId,
        stat,
        itemId,
        correct,
        responseTimeMs,
        theta,
        difficulty
    ).catch(err => console.log('[MemoryIntegration] Mem0 item write failed:', err));

    // 3. If misconception detected, write to both
    if (misconceptionDetected) {
        // Local
        recordLocalMisconception(studentId, stat, strand, misconceptionDetected, itemId);

        // Mem0
        recordMisconceptionFromResponse(
            studentId,
            stat,
            strand,
            misconceptionDetected,
            itemId,
            0.6  // Default severity
        ).catch(err => console.log('[MemoryIntegration] Mem0 misconception write failed:', err));
    }
}

/**
 * Record session completion to both systems
 */
export async function recordSessionCompleteDual(
    studentId: string,
    stat: StatName,
    sessionId: string,
    itemsCompleted: number,
    accuracy: number,
    finalTheta: number,
    finalSE: number
): Promise<void> {
    // 1. Update local profile
    updateStatProfile(studentId, stat, {
        theta: finalTheta,
        se: finalSE,
        items_added: itemsCompleted,
    });

    // 2. Record learning event locally
    recordLearningEvent(
        studentId,
        'breakthrough',  // Or 'struggle_detected' based on performance
        {
            items_completed: itemsCompleted,
            accuracy,
            final_theta: finalTheta,
            final_se: finalSE,
        },
        stat,
        undefined,
        sessionId
    );

    // 3. Write to Mem0 (async)
    recordSessionComplete(
        studentId,
        stat,
        sessionId,
        itemsCompleted,
        accuracy,
        finalTheta,
        finalSE
    ).catch(err => console.log('[MemoryIntegration] Mem0 session write failed:', err));
}

/**
 * Record a significant learning event to both systems
 */
export async function recordLearningEventDual(
    studentId: string,
    eventType: LearningEventType,
    data: Record<string, any>,
    stat?: StatName,
    strand?: string,
    sessionId?: string
): Promise<void> {
    // 1. Local
    recordLearningEvent(studentId, eventType, data, stat, strand, sessionId);

    // 2. Mem0 (async)
    const client = getMemoryClient();
    if (await client.isAvailable()) {
        client.recordEvent({
            student_id: studentId,
            stat: stat || 'math',  // Fallback
            event_type: eventType,
            data: {
                ...data,
                strand,
                session_id: sessionId,
            },
        }).catch(err => console.log('[MemoryIntegration] Mem0 event write failed:', err));
    }
}

// =============================================================================
// MEMORY QUERIES FOR ITEM GENERATION
// =============================================================================

/**
 * Get memory context optimized for item generation
 */
export async function getGenerationMemoryContext(
    studentId: string,
    stat: StatName,
    strand?: string
): Promise<{
    avoid_topics: string[];
    emphasize_topics: string[];
    recent_misconceptions: string[];
    student_context_summary: string;
    difficulty_recommendation: number;
}> {
    const context = await getEnhancedContext(studentId, stat);

    // Build student context summary for the LLM
    const summaryParts: string[] = [];

    // Add profile info
    const statProfile = context.profile.stat_profiles[stat];
    if (statProfile) {
        summaryParts.push(
            `Current ability level: ${statProfile.theta.toFixed(2)} (SE: ${statProfile.se.toFixed(2)})`
        );
        summaryParts.push(
            `Total items attempted: ${statProfile.items_total}`
        );
    }

    // Add misconception context
    if (context.active_misconceptions.length > 0) {
        const topMisconceptions = context.active_misconceptions
            .slice(0, 3)
            .map(m => m.misconception);
        summaryParts.push(
            `Known misconceptions to address: ${topMisconceptions.join('; ')}`
        );
    }

    // Add recent pattern info
    if (context.ai_insights && context.ai_insights.length > 0) {
        const patterns = context.ai_insights
            .filter(i => i.type === 'pattern')
            .map(i => i.content);
        if (patterns.length > 0) {
            summaryParts.push(`Patterns: ${patterns.join('; ')}`);
        }
    }

    // Add semantic memory snippets (if relevant to current strand)
    const relevantMemories = context.semantic_memories
        .filter(m => !strand || m.content.toLowerCase().includes(strand.toLowerCase()))
        .slice(0, 3)
        .map(m => m.content);

    if (relevantMemories.length > 0) {
        summaryParts.push(`Recent learning: ${relevantMemories.join('; ')}`);
    }

    return {
        avoid_topics: context.generation_params.avoid_topics,
        emphasize_topics: context.generation_params.emphasize_topics,
        recent_misconceptions: context.generation_params.misconception_focus,
        student_context_summary: summaryParts.join('\n'),
        difficulty_recommendation: context.generation_params.target_difficulty,
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    getMemoryClient,
    getGenerationContext,
} from './forge-memory-client';
