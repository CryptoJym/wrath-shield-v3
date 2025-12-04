/**
 * HYRO FORGE: Connector Manager
 * Orchestrates all platform connectors for the education system
 */

import type { BaseConnector } from './base-connector';
import type {
  PlatformProgress,
  SyncResult,
  ConnectorStatus,
  ScreenshotInput,
} from './types';
import { zearnConnector } from './zearn';
import { manualConnector, type ManualEntry } from './manual';

// ============================================================================
// Connector Registry
// ============================================================================

class ConnectorManager {
  private connectors: Map<string, BaseConnector>;

  constructor() {
    this.connectors = new Map();
    this.registerDefaultConnectors();
  }

  /**
   * Register default platform connectors
   */
  private registerDefaultConnectors(): void {
    this.register(zearnConnector);
    this.register(manualConnector);

    // Future connectors:
    // this.register(boostConnector);
    // this.register(lexiaConnector);
    // this.register(canyonGroveConnector);
    // this.register(quillConnector);
    // this.register(noredinkConnector);
  }

  /**
   * Register a connector
   */
  register(connector: BaseConnector): void {
    this.connectors.set(connector.platformId, connector);
    console.log(`[ConnectorManager] Registered connector: ${connector.displayName}`);
  }

  /**
   * Unregister a connector
   */
  unregister(platformId: string): boolean {
    const removed = this.connectors.delete(platformId);
    if (removed) {
      console.log(`[ConnectorManager] Unregistered connector: ${platformId}`);
    }
    return removed;
  }

  /**
   * Get a specific connector
   */
  get(platformId: string): BaseConnector | undefined {
    return this.connectors.get(platformId);
  }

  /**
   * Get all registered connectors
   */
  getAll(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get all platform IDs
   */
  getPlatformIds(): string[] {
    return Array.from(this.connectors.keys());
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  /**
   * Sync all platforms
   * Resilient: continues even if individual platforms fail
   */
  async syncAll(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();

    console.log(
      `[ConnectorManager] Starting sync for ${this.connectors.size} platforms`
    );

    for (const [platformId, connector] of Array.from(this.connectors.entries())) {
      // Skip manual connector in auto-sync
      if (platformId === 'manual') continue;

      if (!connector.isHealthy()) {
        console.warn(
          `[ConnectorManager] Skipping unhealthy connector: ${platformId}`
        );
        continue;
      }

      try {
        console.log(`[ConnectorManager] Syncing ${platformId}...`);
        const result = await connector.sync();
        results.set(platformId, result);

        if (result.success) {
          console.log(
            `[ConnectorManager] ✓ ${platformId} synced (${result.itemsSynced} items)`
          );
        } else {
          console.error(
            `[ConnectorManager] ✗ ${platformId} sync failed (${result.errors.length} errors)`
          );
        }
      } catch (error) {
        console.error(`[ConnectorManager] ${platformId} sync error:`, error);
        results.set(platformId, {
          success: false,
          platformId,
          timestamp: Math.floor(Date.now() / 1000),
          itemsSynced: 0,
          progressRecords: 0,
          assignmentRecords: 0,
          memoryRecords: 0,
          errors: [
            {
              category: 'other',
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        });
      }
    }

    console.log(
      `[ConnectorManager] Sync complete: ${results.size} platforms processed`
    );
    return results;
  }

  /**
   * Sync a specific platform
   */
  async syncPlatform(
    platformId: string,
    options?: { screenshot?: ScreenshotInput }
  ): Promise<SyncResult> {
    const connector = this.connectors.get(platformId);

    if (!connector) {
      return {
        success: false,
        platformId,
        timestamp: Math.floor(Date.now() / 1000),
        itemsSynced: 0,
        progressRecords: 0,
        assignmentRecords: 0,
        memoryRecords: 0,
        errors: [{ category: 'other', message: `Connector not found: ${platformId}` }],
      };
    }

    if (!connector.isHealthy()) {
      return {
        success: false,
        platformId,
        timestamp: Math.floor(Date.now() / 1000),
        itemsSynced: 0,
        progressRecords: 0,
        assignmentRecords: 0,
        memoryRecords: 0,
        errors: [{ category: 'other', message: `Connector unhealthy: ${platformId}` }],
      };
    }

    console.log(`[ConnectorManager] Syncing ${platformId}...`);

    try {
      // Special handling for Zearn with screenshot
      if (platformId === 'zearn' && options?.screenshot) {
        return await zearnConnector.sync(options.screenshot);
      }

      return await connector.sync();
    } catch (error) {
      console.error(`[ConnectorManager] ${platformId} sync error:`, error);
      return {
        success: false,
        platformId,
        timestamp: Math.floor(Date.now() / 1000),
        itemsSynced: 0,
        progressRecords: 0,
        assignmentRecords: 0,
        memoryRecords: 0,
        errors: [
          {
            category: 'other',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  // ============================================================================
  // Progress Operations
  // ============================================================================

  /**
   * Get progress for a specific platform
   */
  async getProgress(platformId: string): Promise<PlatformProgress | null> {
    const connector = this.connectors.get(platformId);
    if (!connector) {
      console.warn(`[ConnectorManager] Connector not found: ${platformId}`);
      return null;
    }

    try {
      return await connector.getProgress();
    } catch (error) {
      console.error(`[ConnectorManager] Failed to get progress for ${platformId}:`, error);
      return null;
    }
  }

  /**
   * Get progress for all platforms
   */
  async getAllProgress(): Promise<Map<string, PlatformProgress>> {
    const progressMap = new Map<string, PlatformProgress>();

    for (const [platformId, connector] of Array.from(this.connectors.entries())) {
      // Skip manual connector
      if (platformId === 'manual') continue;

      try {
        const progress = await connector.getProgress();
        progressMap.set(platformId, progress);
      } catch (error) {
        console.error(
          `[ConnectorManager] Failed to get progress for ${platformId}:`,
          error
        );
      }
    }

    return progressMap;
  }

  // ============================================================================
  // Status Operations
  // ============================================================================

  /**
   * Get status for all connectors
   */
  getConnectorStatus(): ConnectorStatus[] {
    const statuses: ConnectorStatus[] = [];

    for (const connector of Array.from(this.connectors.values())) {
      const status = connector.getStatus();
      statuses.push({
        platformId: status.platformId,
        displayName: status.displayName,
        isHealthy: status.isHealthy,
        isEnabled: status.enabled,
        lastSync: status.lastSync,
        lastSuccessfulSync: status.lastSync,
        consecutiveFailures: status.consecutiveFailures,
        errorCount: status.errorCount,
        supportsAutoSync: status.platformId !== 'manual',
        supportsScreenshot: status.platformId === 'zearn',
        supportsManualEntry: status.platformId === 'manual',
      });
    }

    return statuses;
  }

  /**
   * Reset error counters for a platform
   */
  resetErrors(platformId: string): boolean {
    const connector = this.connectors.get(platformId);
    if (!connector) return false;

    connector.resetErrors();
    console.log(`[ConnectorManager] Reset errors for ${platformId}`);
    return true;
  }

  /**
   * Enable/disable a connector
   */
  setEnabled(platformId: string, enabled: boolean): boolean {
    const connector = this.connectors.get(platformId);
    if (!connector) return false;

    connector.setEnabled(enabled);
    console.log(`[ConnectorManager] ${enabled ? 'Enabled' : 'Disabled'} ${platformId}`);
    return true;
  }

  // ============================================================================
  // Manual Entry
  // ============================================================================

  /**
   * Process a manual entry
   */
  async processManualEntry(entry: ManualEntry): Promise<SyncResult> {
    return await manualConnector.processManualEntry(entry);
  }
}

// ============================================================================
// Exports
// ============================================================================

// Export singleton instance
export const connectorManager = new ConnectorManager();

// Export types and classes
export { ConnectorManager };
export { BaseConnector } from './base-connector';
export { ZearnConnector, zearnConnector } from './zearn';
export { ManualConnector, manualConnector, type ManualEntry } from './manual';
export type {
  PlatformProgress,
  PlatformItem,
  SyncResult,
  SyncError,
  QuestInput,
  ConnectorStatus,
  ScreenshotInput,
  OCRResult,
} from './types';
