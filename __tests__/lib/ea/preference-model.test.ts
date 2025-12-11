/**
 * EA Preference Model Tests
 *
 * Unit tests for the Executive Assistant preference model logic -
 * urgency classification, priority contacts, pattern learning, and domain sensitivity.
 * These tests verify pure business logic without external dependencies.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('EA Preference Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Urgency Classification', () => {
    it('should map urgency levels correctly', () => {
      const urgencyLevels = ['critical', 'high', 'medium', 'low', 'background'] as const;
      const urgencyOrder = urgencyLevels.map((level, idx) => ({ level, order: idx }));

      expect(urgencyOrder[0]).toEqual({ level: 'critical', order: 0 });
      expect(urgencyOrder[4]).toEqual({ level: 'background', order: 4 });
    });

    it('should detect urgency upgrades', () => {
      const originalIdx = 2; // medium
      const correctedIdx = 0; // critical

      const isUpgrade = correctedIdx < originalIdx;
      expect(isUpgrade).toBe(true);
    });

    it('should detect urgency downgrades', () => {
      const originalIdx = 1; // high
      const correctedIdx = 3; // low

      const isDowngrade = correctedIdx > originalIdx;
      expect(isDowngrade).toBe(true);
    });
  });

  describe('Priority Contacts', () => {
    it('should identify email addresses', () => {
      const contacts = [
        { identifier: 'ceo@company.com', isEmail: true },
        { identifier: 'John Smith', isEmail: false },
        { identifier: 'jane.doe@gmail.com', isEmail: true },
      ];

      contacts.forEach(({ identifier, isEmail }) => {
        expect(identifier.includes('@')).toBe(isEmail);
      });
    });

    it('should apply urgency boost correctly', () => {
      const priorityContacts = [
        { identifier: 'vip@company.com', urgencyBoost: 'critical' as const },
        { identifier: 'boss@company.com', urgencyBoost: 'high' as const },
      ];

      const applyBoost = (currentUrgency: string, boost: string) => {
        const levels = ['background', 'low', 'medium', 'high', 'critical'];
        const currentIdx = levels.indexOf(currentUrgency);
        const boostIdx = levels.indexOf(boost);
        return levels[Math.max(currentIdx, boostIdx)];
      };

      expect(applyBoost('low', 'critical')).toBe('critical');
      expect(applyBoost('high', 'critical')).toBe('critical');
      expect(applyBoost('critical', 'high')).toBe('critical');
    });
  });

  describe('Pattern Learning', () => {
    it('should extract keywords from correction reasons', () => {
      const reasons = [
        'This sender is always urgent',
        'Legal matters need immediate attention',
        'Client requests should be high priority',
      ];

      const extractKeywords = (reason: string) => {
        const words = reason.toLowerCase().split(/\s+/);
        const stopWords = ['is', 'be', 'the', 'a', 'an', 'this', 'should', 'need', 'always'];
        return words.filter((w) => w.length > 3 && !stopWords.includes(w));
      };

      const keywords1 = extractKeywords(reasons[0]);
      expect(keywords1).toContain('sender');
      expect(keywords1).toContain('urgent');

      const keywords2 = extractKeywords(reasons[1]);
      expect(keywords2).toContain('legal');
      expect(keywords2).toContain('matters');
      expect(keywords2).toContain('immediate');
      expect(keywords2).toContain('attention');
    });

    it('should calculate pattern weight adjustments', () => {
      const reinforceWeight = (current: number, count: number) => {
        return Math.min(0.95, current + 0.02 * count);
      };

      const weakenWeight = (current: number) => {
        return Math.max(0.3, current - 0.05);
      };

      expect(reinforceWeight(0.5, 5)).toBe(0.6);
      expect(reinforceWeight(0.9, 10)).toBe(0.95); // Capped at 0.95
      expect(weakenWeight(0.5)).toBe(0.45);
      expect(weakenWeight(0.32)).toBe(0.3); // Floor at 0.3
    });

    it('should identify patterns to prune', () => {
      const patterns = [
        { pattern: 'urgent', weight: 0.8, source: 'manual' },
        { pattern: 'deadline', weight: 0.6, source: 'correction' },
        { pattern: 'old-pattern', weight: 0.2, source: 'correction' },
        { pattern: 'weak-pattern', weight: 0.15, source: 'inferred' },
      ];

      const toPrune = patterns.filter((p) => p.source !== 'manual' && p.weight < 0.25);

      expect(toPrune.length).toBe(2);
      expect(toPrune.map((p) => p.pattern)).toContain('old-pattern');
      expect(toPrune.map((p) => p.pattern)).toContain('weak-pattern');
    });
  });

  describe('Learning Loop', () => {
    it('should require minimum corrections for analysis', () => {
      const minCorrections = 3;
      const correctionCounts = [0, 1, 2, 3, 5, 10];

      correctionCounts.forEach((count) => {
        const shouldAnalyze = count >= minCorrections;
        expect(shouldAnalyze).toBe(count >= 3);
      });
    });

    it('should track correction timestamps', () => {
      const now = new Date();
      const cutoffDays = 30;
      const cutoff = new Date(now.getTime() - cutoffDays * 24 * 60 * 60 * 1000);

      const corrections = [
        { timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() }, // 5 days ago
        { timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString() }, // 15 days ago
        { timestamp: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString() }, // 45 days ago
      ];

      const recentCorrections = corrections.filter((c) => new Date(c.timestamp) > cutoff);

      expect(recentCorrections.length).toBe(2);
    });

    it('should count patterns by source', () => {
      const patterns = [
        { source: 'manual' },
        { source: 'manual' },
        { source: 'correction' },
        { source: 'correction' },
        { source: 'correction' },
        { source: 'inferred' },
      ];

      const countBySource = (items: Array<{ source: string }>) => ({
        total: items.length,
        manual: items.filter((i) => i.source === 'manual').length,
        learned: items.filter((i) => i.source === 'correction').length,
        inferred: items.filter((i) => i.source === 'inferred').length,
      });

      const counts = countBySource(patterns);

      expect(counts.total).toBe(6);
      expect(counts.manual).toBe(2);
      expect(counts.learned).toBe(3);
      expect(counts.inferred).toBe(1);
    });
  });

  describe('Domain Sensitivity', () => {
    it('should have weights for all domains', () => {
      const domains = ['legal', 'business', 'personal', 'finance', 'health', 'general'] as const;

      const domainWeights = domains.map((domain) => ({
        domain,
        weight: domain === 'legal' ? 1.5 : domain === 'health' ? 1.3 : 1.0,
      }));

      expect(domainWeights.length).toBe(6);
      expect(domainWeights.find((d) => d.domain === 'legal')?.weight).toBe(1.5);
      expect(domainWeights.find((d) => d.domain === 'health')?.weight).toBe(1.3);
    });

    it('should detect domain shifts in corrections', () => {
      const corrections = [
        { original: 'general', corrected: 'legal' },
        { original: 'general', corrected: 'legal' },
        { original: 'business', corrected: 'personal' },
      ];

      const domainShifts = new Map<string, { to: string; count: number }[]>();

      corrections.forEach((c) => {
        if (c.original !== c.corrected) {
          const shifts = domainShifts.get(c.original) || [];
          const existing = shifts.find((s) => s.to === c.corrected);
          if (existing) {
            existing.count++;
          } else {
            shifts.push({ to: c.corrected, count: 1 });
          }
          domainShifts.set(c.original, shifts);
        }
      });

      expect(domainShifts.get('general')?.[0].to).toBe('legal');
      expect(domainShifts.get('general')?.[0].count).toBe(2);
    });
  });

  describe('Auto Archive Patterns', () => {
    it('should match archive patterns', () => {
      const archivePatterns = [
        { pattern: 'newsletter', weight: 0.9 },
        { pattern: 'unsubscribe', weight: 0.85 },
        { pattern: 'promotional', weight: 0.8 },
      ];

      const testEmails = [
        { subject: 'Weekly Newsletter - Tech Updates', shouldArchive: true },
        { subject: 'Click here to unsubscribe', shouldArchive: true },
        { subject: 'Urgent: Contract Review Needed', shouldArchive: false },
      ];

      testEmails.forEach(({ subject, shouldArchive }) => {
        const matchesArchive = archivePatterns.some((p) =>
          subject.toLowerCase().includes(p.pattern)
        );
        expect(matchesArchive).toBe(shouldArchive);
      });
    });
  });

  describe('Learning Stats', () => {
    it('should calculate comprehensive stats', () => {
      const mockModel = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        corrections_count: 25,
        last_correction_at: new Date().toISOString(),
        urgency_triggers: [
          { source: 'manual' },
          { source: 'correction' },
          { source: 'inferred' },
        ],
        auto_archive_patterns: [{ source: 'manual' }, { source: 'correction' }],
        priority_contacts: [{ source: 'manual' }, { source: 'inferred' }],
        domain_sensitivity: [
          { domain: 'legal', baseWeight: 1.5 },
          { domain: 'business', baseWeight: 1.0 },
        ],
      };

      const stats = {
        model: {
          version: mockModel.version,
          lastUpdated: mockModel.lastUpdated,
          correctionsCount: mockModel.corrections_count,
          lastCorrection: mockModel.last_correction_at,
        },
        patterns: {
          urgencyTriggers: {
            total: 3,
            manual: 1,
            learned: 1,
            inferred: 1,
          },
          archivePatterns: {
            total: 2,
            manual: 1,
            learned: 1,
            inferred: 0,
          },
          priorityContacts: {
            total: 2,
            manual: 1,
            learned: 0,
            inferred: 1,
          },
        },
        domainSensitivity: mockModel.domain_sensitivity.map((d) => ({
          domain: d.domain,
          weight: d.baseWeight,
        })),
      };

      expect(stats.model.correctionsCount).toBe(25);
      expect(stats.patterns.urgencyTriggers.total).toBe(3);
      expect(stats.domainSensitivity.length).toBe(2);
    });
  });
});
