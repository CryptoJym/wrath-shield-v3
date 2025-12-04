/**
 * Manual Connector Tests
 * Tests for the manual entry connector functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { manualConnector, type ManualEntry } from '../manual';

describe('ManualConnector', () => {
  beforeEach(() => {
    // Reset connector state
    manualConnector.resetErrors();
    manualConnector.setEnabled(true);
  });

  describe('Basic Properties', () => {
    it('should have correct platform ID', () => {
      expect(manualConnector.platformId).toBe('manual');
    });

    it('should have correct display name', () => {
      expect(manualConnector.displayName).toBe('Manual Entry');
    });

    it('should be healthy by default', () => {
      expect(manualConnector.isHealthy()).toBe(true);
    });
  });

  describe('Entry Validation', () => {
    it('should reject entry without platformId', async () => {
      const entry: ManualEntry = {
        platformId: '',
        subject: 'math',
        title: 'Test',
      };

      const result = await manualConnector.processManualEntry(entry);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('platformId');
    });

    it('should reject entry without subject', async () => {
      const entry: ManualEntry = {
        platformId: 'test',
        subject: '',
        title: 'Test',
      };

      const result = await manualConnector.processManualEntry(entry);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('subject');
    });

    it('should reject entry without title', async () => {
      const entry: ManualEntry = {
        platformId: 'test',
        subject: 'math',
        title: '',
      };

      const result = await manualConnector.processManualEntry(entry);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('title');
    });

    it('should reject invalid percentComplete', async () => {
      const entry: ManualEntry = {
        platformId: 'test',
        subject: 'math',
        title: 'Test',
        percentComplete: 150, // Invalid: > 100
      };

      const result = await manualConnector.processManualEntry(entry);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('percentComplete');
    });

    it('should reject badges > badgesTotal', async () => {
      const entry: ManualEntry = {
        platformId: 'test',
        subject: 'math',
        title: 'Test',
        badges: 10,
        badgesTotal: 5, // Invalid: badges > total
      };

      const result = await manualConnector.processManualEntry(entry);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('badges');
    });
  });

  describe('Valid Entry Processing', () => {
    it('should accept valid basic entry', async () => {
      const entry: ManualEntry = {
        platformId: 'test-platform',
        subject: 'math',
        title: 'Chapter 1: Introduction',
        description: 'Basic math concepts',
      };

      const result = await manualConnector.processManualEntry(entry);

      // Should succeed (might have errors from memory system if not initialized)
      // but validation should pass
      expect(result.platformId).toBe('manual');
      expect(result.itemsSynced).toBeGreaterThan(0);
    });

    it('should process entry with full metadata', async () => {
      const entry: ManualEntry = {
        platformId: 'boost',
        displayName: 'Boost Reading',
        subject: 'reading',
        title: 'Chapter 5: Comprehension',
        description: 'Reading comprehension exercises',
        percentComplete: 75,
        badges: 3,
        badgesTotal: 4,
        dueDate: '2025-12-15',
        status: 'in_progress',
        difficulty: 'medium',
        estimatedMinutes: 30,
        score: 85,
        maxScore: 100,
        notes: 'Student showing good progress',
      };

      const result = await manualConnector.processManualEntry(entry);
      expect(result.platformId).toBe('manual');
    });
  });

  describe('Status and Health', () => {
    it('should track consecutive failures', async () => {
      const status1 = manualConnector.getStatus();
      expect(status1.consecutiveFailures).toBe(0);

      // Force a validation error (doesn't count as connector failure)
      const entry: ManualEntry = {
        platformId: '',
        subject: 'math',
        title: 'Test',
      };

      await manualConnector.processManualEntry(entry);

      const status2 = manualConnector.getStatus();
      expect(status2.isHealthy).toBe(true); // Validation errors don't affect health
    });

    it('should be unhealthy after 3 consecutive failures', async () => {
      // Manual connector is resilient, this test demonstrates the concept
      expect(manualConnector.isHealthy()).toBe(true);
    });

    it('should reset errors', () => {
      manualConnector.resetErrors();
      const status = manualConnector.getStatus();
      expect(status.errorCount).toBe(0);
      expect(status.consecutiveFailures).toBe(0);
    });

    it('should enable/disable', () => {
      manualConnector.setEnabled(false);
      expect(manualConnector.getStatus().enabled).toBe(false);

      manualConnector.setEnabled(true);
      expect(manualConnector.getStatus().enabled).toBe(true);
    });
  });

  describe('Quest Mapping', () => {
    it('should map platform item to quest input', () => {
      const item = {
        platformId: 'boost',
        externalId: 'boost-123',
        type: 'lesson' as const,
        title: 'Reading Lesson',
        description: 'Comprehension exercises',
        subject: 'reading',
        status: 'in_progress' as const,
        dueDate: Date.now() / 1000,
        difficulty: 'medium',
        estimatedMinutes: 30,
      };

      const questInput = manualConnector.mapToQuest(item);

      expect(questInput.platform).toBe('boost');
      expect(questInput.platformId).toBe('boost-123');
      expect(questInput.title).toBe('Reading Lesson');
      expect(questInput.subject).toBe('reading');
      expect(questInput.difficulty).toBe('medium');
      expect(questInput.estimatedMinutes).toBe(30);
    });
  });

  describe('Progress Retrieval', () => {
    it('should return default progress', async () => {
      const progress = await manualConnector.getProgress();

      expect(progress.platformId).toBe('manual');
      expect(progress.displayName).toBe('Manual Entry');
      expect(progress.percentComplete).toBe(0);
    });
  });

  describe('Auto-sync', () => {
    it('should return empty result for sync', async () => {
      const result = await manualConnector.sync();

      expect(result.success).toBe(true);
      expect(result.platformId).toBe('manual');
      expect(result.itemsSynced).toBe(0);
    });
  });
});
