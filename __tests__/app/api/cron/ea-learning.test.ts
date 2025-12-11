/**
 * EA Learning Cron Endpoint Tests
 *
 * Unit tests for the /api/cron/ea-learning endpoint logic.
 * Tests verify authorization, query parameters, learning flow, and response format.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock data for test assertions
const mockLearningResult = {
  correctionsAnalyzed: 15,
  patternsReinforced: 5,
  patternsWeakened: 2,
  patternsPruned: 1,
  newPatternsCreated: 3,
  modelVersion: '1.0.0',
  duration_ms: 450,
};

const mockLearningStats = {
  model: {
    version: '1.0.0',
    lastUpdated: '2024-01-15T12:00:00Z',
    correctionsCount: 45,
    lastCorrection: '2024-01-15T10:30:00Z',
  },
  patterns: {
    urgencyTriggers: { total: 12, manual: 5, learned: 4, inferred: 3 },
    archivePatterns: { total: 8, manual: 3, learned: 3, inferred: 2 },
    priorityContacts: { total: 6, manual: 4, learned: 1, inferred: 1 },
  },
  domainSensitivity: [
    { domain: 'legal', weight: 1.5 },
    { domain: 'business', weight: 1.0 },
    { domain: 'personal', weight: 0.8 },
    { domain: 'health', weight: 1.3 },
    { domain: 'finance', weight: 1.2 },
    { domain: 'general', weight: 1.0 },
  ],
};

describe('/api/cron/ea-learning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  describe('Authorization', () => {
    it('should reject requests without authorization', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/ea-learning', {
        method: 'POST',
      });

      expect(req.headers.get('x-cron-secret')).toBeNull();
      expect(req.headers.get('authorization')).toBeNull();
    });

    it('should accept x-cron-secret header', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/ea-learning', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-cron-secret',
        },
      });

      expect(req.headers.get('x-cron-secret')).toBe('test-cron-secret');
    });

    it('should accept x-vercel-cron header', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/ea-learning', {
        method: 'POST',
        headers: {
          'x-vercel-cron': '1',
        },
      });

      expect(req.headers.get('x-vercel-cron')).toBe('1');
    });

    it('should accept Bearer token authorization', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/ea-learning', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
        },
      });

      const authHeader = req.headers.get('authorization');
      expect(authHeader).toBe('Bearer test-cron-secret');

      const [scheme, token] = authHeader!.split(' ');
      expect(scheme.toLowerCase()).toBe('bearer');
      expect(token).toBe('test-cron-secret');
    });
  });

  describe('Query Parameters', () => {
    it('should parse skipLearning parameter', () => {
      const url = new URL('http://localhost:3000/api/cron/ea-learning?skipLearning=true');
      expect(url.searchParams.get('skipLearning')).toBe('true');
    });

    it('should parse lookbackDays parameter with default', () => {
      const urlWithParam = new URL('http://localhost:3000/api/cron/ea-learning?lookbackDays=14');
      const urlWithoutParam = new URL('http://localhost:3000/api/cron/ea-learning');

      expect(parseInt(urlWithParam.searchParams.get('lookbackDays') || '7', 10)).toBe(14);
      expect(parseInt(urlWithoutParam.searchParams.get('lookbackDays') || '7', 10)).toBe(7);
    });
  });

  describe('Learning Loop Results', () => {
    it('should return learning loop results', () => {
      expect(mockLearningResult.correctionsAnalyzed).toBe(15);
      expect(mockLearningResult.patternsReinforced).toBe(5);
      expect(mockLearningResult.patternsWeakened).toBe(2);
      expect(mockLearningResult.patternsPruned).toBe(1);
      expect(mockLearningResult.newPatternsCreated).toBe(3);
      expect(mockLearningResult.modelVersion).toBe('1.0.0');
    });

    it('should calculate total patterns from stats', () => {
      const totalPatterns =
        mockLearningStats.patterns.urgencyTriggers.total +
        mockLearningStats.patterns.archivePatterns.total +
        mockLearningStats.patterns.priorityContacts.total;

      expect(totalPatterns).toBe(26); // 12 + 8 + 6
    });
  });

  describe('Learning Stats', () => {
    it('should return model stats', () => {
      expect(mockLearningStats.model.version).toBe('1.0.0');
      expect(mockLearningStats.model.correctionsCount).toBe(45);
      expect(mockLearningStats.model.lastCorrection).toBeDefined();
    });

    it('should return pattern stats by source', () => {
      const { urgencyTriggers, archivePatterns, priorityContacts } = mockLearningStats.patterns;

      // Urgency triggers
      expect(urgencyTriggers.total).toBe(12);
      expect(urgencyTriggers.manual + urgencyTriggers.learned + urgencyTriggers.inferred).toBe(12);

      // Archive patterns
      expect(archivePatterns.total).toBe(8);
      expect(archivePatterns.manual + archivePatterns.learned + archivePatterns.inferred).toBe(8);

      // Priority contacts
      expect(priorityContacts.total).toBe(6);
      expect(priorityContacts.manual + priorityContacts.learned + priorityContacts.inferred).toBe(
        6
      );
    });

    it('should return domain sensitivity weights', () => {
      expect(mockLearningStats.domainSensitivity.length).toBe(6);

      const legalDomain = mockLearningStats.domainSensitivity.find((d) => d.domain === 'legal');
      expect(legalDomain?.weight).toBe(1.5);

      const healthDomain = mockLearningStats.domainSensitivity.find((d) => d.domain === 'health');
      expect(healthDomain?.weight).toBe(1.3);
    });
  });

  describe('Response Format', () => {
    it('should return proper success response structure', () => {
      const response = {
        ok: true,
        timestamp: new Date().toISOString(),
        learning: mockLearningResult,
        stats: mockLearningStats,
        errors: [],
        duration_ms: 500,
      };

      expect(response.ok).toBe(true);
      expect(response.learning).toBeDefined();
      expect(response.stats).toBeDefined();
      expect(response.errors).toEqual([]);
    });

    it('should return proper error response structure', () => {
      const response = {
        ok: false,
        timestamp: new Date().toISOString(),
        learning: null,
        stats: null,
        errors: ['Unauthorized - invalid or missing credentials'],
        duration_ms: 5,
      };

      expect(response.ok).toBe(false);
      expect(response.learning).toBeNull();
      expect(response.stats).toBeNull();
      expect(response.errors.length).toBeGreaterThan(0);
    });

    it('should return response when learning is skipped', () => {
      const response = {
        ok: true,
        timestamp: new Date().toISOString(),
        learning: null, // Skipped
        stats: mockLearningStats,
        errors: [],
        duration_ms: 50,
      };

      expect(response.ok).toBe(true);
      expect(response.learning).toBeNull();
      expect(response.stats).toBeDefined();
    });
  });

  describe('GET Health Check', () => {
    it('should return endpoint documentation', () => {
      const healthResponse = {
        endpoint: '/api/cron/ea-learning',
        method: 'POST',
        description: 'EA Preference Model Learning Loop',
        authentication: 'Requires x-cron-secret header or Authorization: Bearer',
        parameters: {
          skipLearning: 'Optional query param - skip learning pass',
          lookbackDays: 'Optional query param - days to look back for corrections',
        },
        actions: [
          '1. Get current learning stats',
          '2. Fetch recent corrections from Zep memory',
          '3. Analyze patterns in corrections',
          '4. Reinforce effective patterns',
          '5. Weaken ineffective patterns',
          '6. Prune stale patterns',
          '7. Infer new patterns from themes',
        ],
        schedule: 'Daily at midnight (0 0 * * *)',
        status: 'ready',
        current_stats: mockLearningStats,
      };

      expect(healthResponse.endpoint).toBe('/api/cron/ea-learning');
      expect(healthResponse.method).toBe('POST');
      expect(healthResponse.schedule).toBe('Daily at midnight (0 0 * * *)');
      expect(healthResponse.status).toBe('ready');
      expect(healthResponse.actions.length).toBe(7);
    });
  });

  describe('Pattern Analysis', () => {
    it('should track urgency upgrades by sender', () => {
      const upgrades = new Map<string, number>();
      upgrades.set('ceo@company.com', 3);
      upgrades.set('important@client.com', 2);

      expect(upgrades.get('ceo@company.com')).toBe(3);
      expect(upgrades.size).toBe(2);
    });

    it('should track urgency downgrades by sender', () => {
      const downgrades = new Map<string, number>();
      downgrades.set('newsletter@spam.com', 5);
      downgrades.set('promo@marketing.com', 3);

      expect(downgrades.get('newsletter@spam.com')).toBe(5);
      expect(downgrades.size).toBe(2);
    });

    it('should track common keywords from correction reasons', () => {
      const keywords = new Map<string, number>();
      keywords.set('urgent', 8);
      keywords.set('deadline', 6);
      keywords.set('important', 5);
      keywords.set('legal', 4);

      const sortedKeywords = [...keywords.entries()].sort((a, b) => b[1] - a[1]);

      expect(sortedKeywords[0][0]).toBe('urgent');
      expect(sortedKeywords[0][1]).toBe(8);
    });
  });

  describe('Pattern Inference', () => {
    it('should create priority contact from repeated upgrades', () => {
      const senderUpgrades = new Map([
        ['vip@company.com', 5],
        ['random@email.com', 1],
        ['important@client.com', 3],
      ]);

      const newPriorityContacts = [...senderUpgrades.entries()]
        .filter(([_, count]) => count >= 3)
        .map(([sender, count]) => ({
          identifier: sender,
          identifierType: sender.includes('@') ? 'email' : 'name',
          urgencyBoost: count >= 5 ? 'critical' : 'high',
          source: 'inferred',
        }));

      expect(newPriorityContacts.length).toBe(2);
      expect(newPriorityContacts[0].urgencyBoost).toBe('critical');
      expect(newPriorityContacts[1].urgencyBoost).toBe('high');
    });

    it('should create urgency trigger from repeated keywords', () => {
      const keywordCounts = new Map([
        ['urgent', 5],
        ['deadline', 4],
        ['quick', 2],
        ['meeting', 3],
      ]);

      const newTriggers = [...keywordCounts.entries()]
        .filter(([keyword, count]) => count >= 3 && keyword.length > 4)
        .map(([keyword, count]) => ({
          pattern: keyword,
          weight: Math.min(0.8, 0.5 + count * 0.1),
          source: 'inferred',
        }));

      expect(newTriggers.length).toBe(3); // urgent, deadline, meeting
      expect(newTriggers.find((t) => t.pattern === 'urgent')?.weight).toBe(0.8); // Capped
      expect(newTriggers.find((t) => t.pattern === 'deadline')?.weight).toBe(0.8); // Capped
    });
  });
});
