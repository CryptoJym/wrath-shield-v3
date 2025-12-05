/**
 * HYRO FORGE: Manual Entry Connector
 * Fallback connector for manually entering platform progress
 */

import { BaseConnector } from './base-connector';
import type {
  PlatformProgress,
  PlatformItem,
  SyncResult,
  QuestInput,
} from './types';
import { generateQuestFromAssignment } from '../forge-quest-generator';

export interface ManualEntry {
  platformId: string;
  displayName?: string;
  subject: string;

  // Progress data
  title: string;
  description?: string;
  percentComplete?: number;
  badges?: number;
  badgesTotal?: number;

  // Assignment data
  dueDate?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  difficulty?: string;
  estimatedMinutes?: number;
  score?: number;
  maxScore?: number;
  url?: string;

  // Additional metadata
  notes?: string;
  metadata?: Record<string, any>;

  // Quest generation
  generateQuest?: boolean;
}

export class ManualConnector extends BaseConnector {
  readonly platformId = 'manual';
  readonly displayName = 'Manual Entry';

  // ============================================================================
  // Main Sync Method
  // ============================================================================

  async sync(): Promise<SyncResult> {
    // Manual connector doesn't auto-sync
    return this.createSyncResult({
      success: true,
      itemsSynced: 0,
      progressRecords: 0,
      assignmentRecords: 0,
      memoryRecords: 0,
    });
  }

  /**
   * Process a manual entry
   */
  async processManualEntry(entry: ManualEntry): Promise<SyncResult> {
    const errors: any[] = [];
    let progressRecords = 0;
    let assignmentRecords = 0;
    let memoryRecords = 0;
    let questsGenerated = 0;

    try {
      // Validate entry
      const validation = this.validateEntry(entry);
      if (!validation.valid) {
        errors.push(
          this.createError('other', `Invalid entry: ${validation.error}`)
        );
        return this.createSyncResult({ success: false, errors });
      }

      // Step 1: Record progress
      const progressResult = await this.safeExecute(
        () => this.recordProgressEntry(entry),
        'Failed to record progress'
      );
      if (progressResult.success) progressRecords++;
      else
        errors.push(
          this.createError('progress', progressResult.error || 'Unknown error')
        );

      // Step 2: Record assignment if applicable
      if (entry.dueDate || entry.status) {
        const assignmentResult = await this.safeExecute(
          () => this.recordAssignmentEntry(entry),
          'Failed to record assignment'
        );
        if (assignmentResult.success) assignmentRecords++;
        else
          errors.push(
            this.createError('assignment', assignmentResult.error || 'Unknown error')
          );
      }

      // Step 3: Add to memory
      const memoryResult = await this.safeExecute(
        () => this.recordMemoryEntry(entry),
        'Failed to record memory'
      );
      if (memoryResult.success) memoryRecords++;
      else
        errors.push(
          this.createError('memory', memoryResult.error || 'Unknown error')
        );

      // Step 4: Generate quest if requested
      if (entry.generateQuest && entry.dueDate) {
        const questResult = await this.safeExecute(
          () => this.generateQuestFromEntry(entry),
          'Failed to generate quest'
        );
        if (questResult.success && questResult.result) {
          questsGenerated++;
        } else if (!questResult.success) {
          errors.push(
            this.createError('quest', questResult.error || 'Unknown error')
          );
        }
      }

      const itemsSynced =
        progressRecords + assignmentRecords + memoryRecords + questsGenerated;

      return this.createSyncResult({
        success: errors.length === 0,
        itemsSynced,
        progressRecords,
        assignmentRecords,
        memoryRecords,
        questsGenerated,
        errors,
      });
    } catch (error) {
      console.error('[ManualConnector] Process entry failed:', error);
      errors.push(
        this.createError('other', error instanceof Error ? error.message : String(error))
      );
      return this.createSyncResult({ success: false, errors });
    }
  }

  // ============================================================================
  // Progress Methods
  // ============================================================================

  async getProgress(): Promise<PlatformProgress> {
    // Manual connector doesn't track progress independently
    return {
      platformId: this.platformId,
      displayName: this.displayName,
      percentComplete: 0,
      lastSynced: this.lastSyncTimestamp,
    };
  }

  // ============================================================================
  // Entry Validation
  // ============================================================================

  private validateEntry(entry: ManualEntry): { valid: boolean; error?: string } {
    if (!entry.platformId || entry.platformId.trim() === '') {
      return { valid: false, error: 'platformId is required' };
    }
    if (!entry.subject || entry.subject.trim() === '') {
      return { valid: false, error: 'subject is required' };
    }
    if (!entry.title || entry.title.trim() === '') {
      return { valid: false, error: 'title is required' };
    }
    if (entry.percentComplete && (entry.percentComplete < 0 || entry.percentComplete > 100)) {
      return { valid: false, error: 'percentComplete must be between 0 and 100' };
    }
    if (entry.badges && entry.badgesTotal && entry.badges > entry.badgesTotal) {
      return { valid: false, error: 'badges cannot exceed badgesTotal' };
    }

    return { valid: true };
  }

  // ============================================================================
  // Recording Methods
  // ============================================================================

  private async recordProgressEntry(entry: ManualEntry): Promise<void> {
    const displayName = entry.displayName || entry.platformId;
    const description = this.buildProgressDescription(entry);

    await this.saveProgress(`${entry.subject} (${displayName})`, description, {
      platform: entry.platformId,
      percentComplete: entry.percentComplete,
      badges: entry.badges,
      badgesTotal: entry.badgesTotal,
      ...entry.metadata,
    });
  }

  private async recordAssignmentEntry(entry: ManualEntry): Promise<void> {
    const displayName = entry.displayName || entry.platformId;

    await this.saveAssignment({
      platform: displayName,
      subject: entry.subject,
      title: entry.title,
      dueDate: entry.dueDate,
      status: entry.status || 'pending',
      notes: this.buildAssignmentNotes(entry),
    });
  }

  private async recordMemoryEntry(entry: ManualEntry): Promise<void> {
    const displayName = entry.displayName || entry.platformId;
    const text = `Manual entry for ${displayName}: ${entry.title}. ${entry.description || ''}${entry.notes ? ` Notes: ${entry.notes}` : ''}`;

    await this.recordInMemory(text, {
      platform: entry.platformId,
      subject: entry.subject,
      entry_type: 'manual',
      ...entry.metadata,
    });
  }

  // ============================================================================
  // Quest Generation
  // ============================================================================

  mapToQuest(item: PlatformItem): QuestInput {
    return {
      platform: item.platformId,
      platformId: item.externalId,
      title: item.title,
      description: item.description,
      subject: item.subject,
      url: item.url,
      dueDate: item.dueDate,
      assignedDate: item.assignedDate,
      difficulty: item.difficulty,
      estimatedMinutes: item.estimatedMinutes,
      score: item.score,
      maxScore: item.maxScore,
    };
  }

  private async generateQuestFromEntry(entry: ManualEntry): Promise<boolean> {
    const dueDate = entry.dueDate
      ? new Date(entry.dueDate).getTime() / 1000
      : undefined;

    const questInput = {
      platform: entry.platformId,
      platform_id: `manual-${Date.now()}`,
      title: entry.title,
      description: entry.description,
      subject: entry.subject,
      url: entry.url,
      due_date: dueDate,
      difficulty: entry.difficulty || 'medium',
      estimated_minutes: entry.estimatedMinutes,
      score: entry.score,
      max_score: entry.maxScore,
    };

    // TODO: Pass actual studentId when connectors are fully multi-tenant
    const result = generateQuestFromAssignment('hyro', questInput);
    return !!result;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private buildProgressDescription(entry: ManualEntry): string {
    const parts: string[] = [entry.title];

    if (entry.description) {
      parts.push(entry.description);
    }

    if (entry.percentComplete !== undefined) {
      parts.push(`${entry.percentComplete}% complete`);
    }

    if (entry.badges !== undefined && entry.badgesTotal !== undefined) {
      parts.push(`${entry.badges}/${entry.badgesTotal} badges`);
    }

    if (entry.score !== undefined && entry.maxScore !== undefined) {
      parts.push(`Score: ${entry.score}/${entry.maxScore}`);
    }

    return parts.join('. ');
  }

  private buildAssignmentNotes(entry: ManualEntry): string {
    const parts: string[] = [];

    if (entry.description) {
      parts.push(entry.description);
    }

    if (entry.estimatedMinutes) {
      parts.push(`Est. time: ${entry.estimatedMinutes} min`);
    }

    if (entry.difficulty) {
      parts.push(`Difficulty: ${entry.difficulty}`);
    }

    if (entry.notes) {
      parts.push(entry.notes);
    }

    return parts.join('. ');
  }
}

// Export singleton instance
export const manualConnector = new ManualConnector();
