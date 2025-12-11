/**
 * Tests for Systems Telemetry Types and Utilities
 */

import {
  calculateOverallHealth,
  calculateNextRun,
  formatTimeUntil,
  DEFAULT_CRON_JOBS,
  type HealthStatus,
} from '@/lib/types/systems-telemetry';

describe('Systems Telemetry Utilities', () => {
  // =============================================================================
  // calculateOverallHealth Tests
  // =============================================================================
  describe('calculateOverallHealth', () => {
    it('returns healthy when all systems are online', () => {
      const result = calculateOverallHealth(true, true, true, true);
      expect(result).toBe('healthy');
    });

    it('returns degraded when 3 systems are online', () => {
      expect(calculateOverallHealth(true, true, true, false)).toBe('degraded');
      expect(calculateOverallHealth(true, true, false, true)).toBe('degraded');
      expect(calculateOverallHealth(true, false, true, true)).toBe('degraded');
      expect(calculateOverallHealth(false, true, true, true)).toBe('degraded');
    });

    it('returns degraded when 2 systems are online', () => {
      expect(calculateOverallHealth(true, true, false, false)).toBe('degraded');
      expect(calculateOverallHealth(true, false, true, false)).toBe('degraded');
      expect(calculateOverallHealth(false, false, true, true)).toBe('degraded');
    });

    it('returns critical when only 1 system is online', () => {
      expect(calculateOverallHealth(true, false, false, false)).toBe('critical');
      expect(calculateOverallHealth(false, true, false, false)).toBe('critical');
      expect(calculateOverallHealth(false, false, true, false)).toBe('critical');
      expect(calculateOverallHealth(false, false, false, true)).toBe('critical');
    });

    it('returns critical when no systems are online', () => {
      const result = calculateOverallHealth(false, false, false, false);
      expect(result).toBe('critical');
    });
  });

  // =============================================================================
  // calculateNextRun Tests
  // =============================================================================
  describe('calculateNextRun', () => {
    // Use a fixed date for predictable tests
    const fixedDate = new Date('2024-03-15T10:30:00Z');

    it('handles "every minute" pattern (* * * * *)', () => {
      const result = calculateNextRun('* * * * *', fixedDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCMinutes()).toBe(31);
      expect(nextRun.getUTCSeconds()).toBe(0);
    });

    it('handles "every 5 minutes" pattern (*/5 * * * *)', () => {
      const result = calculateNextRun('*/5 * * * *', fixedDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCMinutes()).toBe(35);
    });

    it('handles "every 15 minutes" pattern (*/15 * * * *)', () => {
      const result = calculateNextRun('*/15 * * * *', fixedDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCMinutes()).toBe(45);
    });

    it('handles specific minute pattern (20 * * * *)', () => {
      const result = calculateNextRun('20 * * * *', fixedDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCMinutes()).toBe(20);
      // Since current minute (30) > 20, should be next hour
      expect(nextRun.getUTCHours()).toBe(11);
    });

    it('handles specific minute when current minute is less', () => {
      const earlyDate = new Date('2024-03-15T10:15:00Z');
      const result = calculateNextRun('20 * * * *', earlyDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCMinutes()).toBe(20);
      expect(nextRun.getUTCHours()).toBe(10);
    });

    it('returns null for invalid cron expression (wrong number of parts)', () => {
      expect(calculateNextRun('* * *', fixedDate)).toBeNull();
      expect(calculateNextRun('* * * * * *', fixedDate)).toBeNull();
      expect(calculateNextRun('invalid', fixedDate)).toBeNull();
    });

    it('returns null for invalid interval (*/0)', () => {
      const result = calculateNextRun('*/0 * * * *', fixedDate);
      expect(result).toBeNull();
    });

    it('handles edge case: minute 59 rolling to next hour', () => {
      const lateDate = new Date('2024-03-15T10:59:00Z');
      const result = calculateNextRun('* * * * *', lateDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCHours()).toBe(11);
      expect(nextRun.getUTCMinutes()).toBe(0);
    });

    it('handles edge case: interval rolling to next hour', () => {
      const lateDate = new Date('2024-03-15T10:58:00Z');
      const result = calculateNextRun('*/5 * * * *', lateDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCHours()).toBe(11);
      expect(nextRun.getUTCMinutes()).toBe(0);
    });

    it('handles complex patterns with fallback to next hour', () => {
      // Day-of-week patterns fall back to approximate calculation
      const result = calculateNextRun('0 6 * * 1', fixedDate);
      expect(result).not.toBeNull();

      const nextRun = new Date(result!);
      expect(nextRun.getUTCHours()).toBe(11);
      expect(nextRun.getUTCMinutes()).toBe(0);
    });
  });

  // =============================================================================
  // formatTimeUntil Tests
  // =============================================================================
  describe('formatTimeUntil', () => {
    it('formats seconds (< 60)', () => {
      expect(formatTimeUntil(0)).toBe('0s');
      expect(formatTimeUntil(30)).toBe('30s');
      expect(formatTimeUntil(59)).toBe('59s');
    });

    it('formats minutes (60-3599)', () => {
      expect(formatTimeUntil(60)).toBe('1m');
      expect(formatTimeUntil(120)).toBe('2m');
      expect(formatTimeUntil(300)).toBe('5m');
      expect(formatTimeUntil(3599)).toBe('60m');
    });

    it('formats hours (>= 3600)', () => {
      expect(formatTimeUntil(3600)).toBe('1h');
      expect(formatTimeUntil(7200)).toBe('2h');
      expect(formatTimeUntil(86400)).toBe('24h');
    });

    it('rounds correctly', () => {
      expect(formatTimeUntil(45)).toBe('45s');
      expect(formatTimeUntil(90)).toBe('2m'); // 1.5 rounds to 2
      expect(formatTimeUntil(5400)).toBe('2h'); // 1.5 hours rounds to 2
    });
  });

  // =============================================================================
  // DEFAULT_CRON_JOBS Tests
  // =============================================================================
  describe('DEFAULT_CRON_JOBS', () => {
    it('has all expected jobs defined', () => {
      const jobNames = DEFAULT_CRON_JOBS.map((job) => job.name);

      expect(jobNames).toContain('proactive-tick');
      expect(jobNames).toContain('legal-hourly');
      expect(jobNames).toContain('lifelog-hourly');
      expect(jobNames).toContain('digest-morning');
      expect(jobNames).toContain('finance-daily');
      expect(jobNames).toContain('cortex-synthesis');
      expect(jobNames).toContain('decision-queue-maintenance');
      expect(jobNames).toContain('imessage-sync');
      expect(jobNames).toContain('semantic-learning');
    });

    it('has valid cron expressions', () => {
      // Basic validation: 5 parts separated by spaces
      for (const job of DEFAULT_CRON_JOBS) {
        const parts = job.schedule.split(' ');
        expect(parts).toHaveLength(5);
        expect(job.description.length).toBeGreaterThan(0);
      }
    });

    it('has descriptions for all jobs', () => {
      for (const job of DEFAULT_CRON_JOBS) {
        expect(job.description).toBeDefined();
        expect(job.description.length).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================================
// Type Tests (compile-time checks)
// =============================================================================
describe('Type Definitions', () => {
  it('HealthStatus type has correct values', () => {
    const validStatuses: HealthStatus[] = ['healthy', 'degraded', 'critical'];
    expect(validStatuses).toHaveLength(3);
  });
});
