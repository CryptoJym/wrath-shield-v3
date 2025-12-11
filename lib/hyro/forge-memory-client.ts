/**
 * HYRO Forge Memory Client
 *
 * TypeScript client for the Python-based Memory Layer service.
 * Provides access to Mem0 semantic memory and temporal event tracking.
 *
 * The memory service runs on port 8789 by default.
 * Start it with: cd services/memory-layer && source venv/bin/activate && uvicorn main:app --port 8789
 */

import type { StatName } from './forge-types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MEMORY_SERVICE_URL = process.env.HYRO_MEMORY_SERVICE_URL || 'http://localhost:8789';
const MEMORY_SERVICE_ENABLED = process.env.HYRO_MEMORY_SERVICE_ENABLED !== 'false';

// =============================================================================
// TYPES
// =============================================================================

export interface MemoryAddRequest {
    student_id: string;
    content: string;
    metadata?: Record<string, any>;
    stat?: StatName;
    session_id?: string;
}

export interface MemorySearchRequest {
    student_id: string;
    query: string;
    stat?: StatName;
    limit?: number;
}

export interface MemoryResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface MisconceptionRecord {
    student_id: string;
    stat: StatName;
    strand: string;
    misconception: string;
    item_id?: string;
    severity?: number;
}

export interface PerformanceEvent {
    student_id: string;
    stat: StatName;
    event_type: 'item_response' | 'session_complete' | 'mastery_achieved' | 'struggle_detected' | 'zpd_updated' | string;
    data: Record<string, any>;
    timestamp?: string;
}

export interface StudentContext {
    student_id: string;
    stat: StatName | null;
    memories: any[];
    misconceptions: any[];
    recent_events: any[];
    generated_at: string;
}

export interface HealthStatus {
    status: string;
    mem0_available: boolean;
    mem0_initialized: boolean;
    timestamp: string;
}

// =============================================================================
// MEMORY CLIENT CLASS
// =============================================================================

class ForgeMemoryClient {
    private baseUrl: string;
    private enabled: boolean;
    private healthChecked: boolean = false;
    private serviceAvailable: boolean = false;

    constructor(baseUrl: string = MEMORY_SERVICE_URL, enabled: boolean = MEMORY_SERVICE_ENABLED) {
        this.baseUrl = baseUrl;
        this.enabled = enabled;
    }

    /**
     * Check if the memory service is available.
     */
    async checkHealth(): Promise<HealthStatus | null> {
        if (!this.enabled) return null;

        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                this.serviceAvailable = true;
                this.healthChecked = true;
                return await response.json();
            }
        } catch (error) {
            console.log('[MemoryClient] Memory service not available:', (error as Error).message);
            this.serviceAvailable = false;
            this.healthChecked = true;
        }
        return null;
    }

    /**
     * Check if service is available (cached).
     */
    async isAvailable(): Promise<boolean> {
        if (!this.enabled) return false;
        if (!this.healthChecked) {
            await this.checkHealth();
        }
        return this.serviceAvailable;
    }

    /**
     * Generic fetch wrapper with error handling.
     */
    private async fetch<T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        body?: any
    ): Promise<MemoryResponse<T>> {
        if (!this.enabled) {
            return { success: false, error: 'Memory service disabled' };
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }

            return await response.json();
        } catch (error) {
            console.log(`[MemoryClient] Error calling ${endpoint}:`, (error as Error).message);
            return { success: false, error: (error as Error).message };
        }
    }

    // =========================================================================
    // MEMORY OPERATIONS
    // =========================================================================

    /**
     * Add a memory for a student.
     */
    async addMemory(request: MemoryAddRequest): Promise<MemoryResponse> {
        return this.fetch('/memory/add', 'POST', request);
    }

    /**
     * Search memories for a student.
     */
    async searchMemory(request: MemorySearchRequest): Promise<MemoryResponse<any[]>> {
        return this.fetch('/memory/search', 'POST', request);
    }

    /**
     * Get all memories for a student.
     */
    async getMemoryHistory(studentId: string): Promise<MemoryResponse<any[]>> {
        return this.fetch(`/memory/history/${studentId}`);
    }

    // =========================================================================
    // MISCONCEPTION TRACKING
    // =========================================================================

    /**
     * Record a student misconception.
     */
    async recordMisconception(record: MisconceptionRecord): Promise<MemoryResponse> {
        return this.fetch('/misconception/record', 'POST', record);
    }

    /**
     * Get misconceptions for a student.
     */
    async getMisconceptions(studentId: string, stat?: StatName): Promise<MemoryResponse<any[]>> {
        const url = stat
            ? `/misconception/get/${studentId}?stat=${stat}`
            : `/misconception/get/${studentId}`;
        return this.fetch(url);
    }

    // =========================================================================
    // PERFORMANCE EVENTS
    // =========================================================================

    /**
     * Record a performance event.
     */
    async recordEvent(event: PerformanceEvent): Promise<MemoryResponse> {
        return this.fetch('/event/record', 'POST', event);
    }

    /**
     * Get event timeline for a student.
     */
    async getEventTimeline(
        studentId: string,
        stat?: StatName,
        eventType?: string,
        limit?: number
    ): Promise<MemoryResponse<any[]>> {
        const params = new URLSearchParams();
        if (stat) params.append('stat', stat);
        if (eventType) params.append('event_type', eventType);
        if (limit) params.append('limit', String(limit));

        const queryString = params.toString();
        const url = `/event/timeline/${studentId}${queryString ? '?' + queryString : ''}`;
        return this.fetch(url);
    }

    // =========================================================================
    // STUDENT CONTEXT
    // =========================================================================

    /**
     * Get aggregated context for item generation.
     */
    async getStudentContext(studentId: string, stat?: StatName): Promise<MemoryResponse<StudentContext>> {
        return this.fetch('/profile/context', 'POST', {
            student_id: studentId,
            stat: stat || null,
        });
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let memoryClientInstance: ForgeMemoryClient | null = null;

/**
 * Get the memory client singleton.
 */
export function getMemoryClient(): ForgeMemoryClient {
    if (!memoryClientInstance) {
        memoryClientInstance = new ForgeMemoryClient();
    }
    return memoryClientInstance;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Record a learning event from an item response.
 */
export async function recordItemResponse(
    studentId: string,
    stat: StatName,
    itemId: string,
    correct: boolean,
    responseTime: number,
    theta: number,
    difficulty: number
): Promise<void> {
    const client = getMemoryClient();
    if (!(await client.isAvailable())) return;

    await client.recordEvent({
        student_id: studentId,
        stat,
        event_type: 'item_response',
        data: {
            item_id: itemId,
            correct,
            response_time: responseTime,
            theta_after: theta,
            item_difficulty: difficulty,
        },
    });
}

/**
 * Record a session completion event.
 */
export async function recordSessionComplete(
    studentId: string,
    stat: StatName,
    sessionId: string,
    itemsCompleted: number,
    accuracy: number,
    finalTheta: number,
    finalSE: number
): Promise<void> {
    const client = getMemoryClient();
    if (!(await client.isAvailable())) return;

    await client.recordEvent({
        student_id: studentId,
        stat,
        event_type: 'session_complete',
        data: {
            session_id: sessionId,
            items_completed: itemsCompleted,
            accuracy,
            final_theta: finalTheta,
            final_se: finalSE,
        },
    });

    // Also add a searchable memory
    await client.addMemory({
        student_id: studentId,
        stat,
        session_id: sessionId,
        content: `Completed ${stat} assessment: ${itemsCompleted} items, ${(accuracy * 100).toFixed(1)}% accuracy, ability level ${finalTheta.toFixed(2)}`,
        metadata: {
            type: 'session_summary',
            items_completed: itemsCompleted,
            accuracy,
            theta: finalTheta,
            se: finalSE,
        },
    });
}

/**
 * Record a misconception from an incorrect response.
 */
export async function recordMisconceptionFromResponse(
    studentId: string,
    stat: StatName,
    strand: string,
    misconception: string,
    itemId: string,
    severity: number = 0.5
): Promise<void> {
    const client = getMemoryClient();
    if (!(await client.isAvailable())) return;

    await client.recordMisconception({
        student_id: studentId,
        stat,
        strand,
        misconception,
        item_id: itemId,
        severity,
    });
}

/**
 * Get context for item generation.
 */
export async function getGenerationContext(
    studentId: string,
    stat: StatName
): Promise<StudentContext | null> {
    const client = getMemoryClient();
    if (!(await client.isAvailable())) return null;

    const result = await client.getStudentContext(studentId, stat);
    if (result.success && result.data) {
        return result.data;
    }
    return null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { ForgeMemoryClient };
