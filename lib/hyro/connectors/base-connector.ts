/**
 * HYRO FORGE: Base Platform Connector
 * Abstract class that all platform connectors must extend
 */

import type {
  PlatformProgress,
  PlatformItem,
  SyncResult,
  SyncError,
  QuestInput,
} from './types';
import {
  recordProgress,
  recordAssignment,
  addEducationMemory,
} from '../education-memory';

export abstract class BaseConnector {
  // Platform identification
  abstract readonly platformId: string;
  abstract readonly displayName: string;

  // Optional configuration
  protected enabled: boolean = true;
  protected lastSyncTimestamp: number = 0;
  protected errorCount: number = 0;
  protected consecutiveFailures: number = 0;

  // ============================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ============================================================================

  /**
   * Sync platform data - main entry point for data synchronization
   */
  abstract sync(): Promise<SyncResult>;

  /**
   * Get current progress from the platform
   */
  abstract getProgress(): Promise<PlatformProgress>;

  /**
   * Map a platform item to Forge quest input format
   */
  abstract mapToQuest(item: PlatformItem): QuestInput;

  // ============================================================================
  // Protected Helper Methods (available to subclasses)
  // ============================================================================

  /**
   * Save progress to education memory
   */
  protected async saveProgress(
    subject: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await recordProgress(subject, description, {
        platform: this.platformId,
        synced_at: Date.now(),
        ...metadata,
      });
    } catch (error) {
      console.error(`[${this.platformId}] Failed to save progress:`, error);
      throw error;
    }
  }

  /**
   * Record assignment in education memory
   */
  protected async saveAssignment(params: {
    platform: string;
    subject: string;
    title: string;
    dueDate?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'overdue';
    notes?: string;
  }): Promise<void> {
    try {
      await recordAssignment(params);
    } catch (error) {
      console.error(`[${this.platformId}] Failed to save assignment:`, error);
      throw error;
    }
  }

  /**
   * Record general observation or note in education memory
   */
  protected async recordInMemory(
    text: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await addEducationMemory(text, 'note', {
        platform: this.platformId,
        timestamp: Date.now(),
        ...metadata,
      });
    } catch (error) {
      console.error(`[${this.platformId}] Failed to record memory:`, error);
      throw error;
    }
  }

  /**
   * Create a SyncResult with error handling
   */
  protected createSyncResult(params: {
    success: boolean;
    itemsSynced?: number;
    progressRecords?: number;
    assignmentRecords?: number;
    memoryRecords?: number;
    errors?: SyncError[];
    warnings?: string[];
    questsGenerated?: number;
    questsSkipped?: string[];
  }): SyncResult {
    const timestamp = Math.floor(Date.now() / 1000);

    if (params.success) {
      this.lastSyncTimestamp = timestamp;
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
      this.errorCount++;
    }

    return {
      success: params.success,
      platformId: this.platformId,
      timestamp,
      itemsSynced: params.itemsSynced || 0,
      progressRecords: params.progressRecords || 0,
      assignmentRecords: params.assignmentRecords || 0,
      memoryRecords: params.memoryRecords || 0,
      errors: params.errors || [],
      warnings: params.warnings,
      questsGenerated: params.questsGenerated,
      questsSkipped: params.questsSkipped,
    };
  }

  /**
   * Create a SyncError
   */
  protected createError(
    category: 'progress' | 'assignment' | 'quest' | 'memory' | 'other',
    message: string,
    context?: any
  ): SyncError {
    return { category, message, context };
  }

  /**
   * Safe execution wrapper that catches errors
   */
  protected async safeExecute<T>(
    fn: () => Promise<T>,
    errorMessage: string
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      console.error(`[${this.platformId}] ${errorMessage}:`, error);
      return { success: false, error: errorStr };
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Check if connector is healthy
   */
  isHealthy(): boolean {
    return this.enabled && this.consecutiveFailures < 3;
  }

  /**
   * Get connector status
   */
  getStatus(): {
    platformId: string;
    displayName: string;
    enabled: boolean;
    isHealthy: boolean;
    lastSync: number;
    errorCount: number;
    consecutiveFailures: number;
  } {
    return {
      platformId: this.platformId,
      displayName: this.displayName,
      enabled: this.enabled,
      isHealthy: this.isHealthy(),
      lastSync: this.lastSyncTimestamp,
      errorCount: this.errorCount,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * Reset error counters
   */
  resetErrors(): void {
    this.errorCount = 0;
    this.consecutiveFailures = 0;
  }

  /**
   * Enable/disable the connector
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
