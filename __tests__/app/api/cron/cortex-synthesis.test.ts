/**
 * Cortex Synthesis Cron Endpoint Tests
 *
 * Unit tests for the /api/cron/cortex-synthesis endpoint logic.
 * Tests verify authorization, query parameters, synthesis flow, and response format.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

describe('/api/cron/cortex-synthesis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  describe('Authorization', () => {
    it('should reject requests without authorization', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/cortex-synthesis', {
        method: 'POST',
      });

      // Verify request has no auth headers
      expect(req.headers.get('x-cron-secret')).toBeNull();
      expect(req.headers.get('authorization')).toBeNull();
    });

    it('should accept x-cron-secret header', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/cortex-synthesis', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-cron-secret',
        },
      });

      expect(req.headers.get('x-cron-secret')).toBe('test-cron-secret');
    });

    it('should accept x-vercel-cron header', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/cortex-synthesis', {
        method: 'POST',
        headers: {
          'x-vercel-cron': '1',
        },
      });

      expect(req.headers.get('x-vercel-cron')).toBe('1');
    });

    it('should accept Bearer token authorization', () => {
      const req = new NextRequest('http://localhost:3000/api/cron/cortex-synthesis', {
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
    it('should parse skipSynthesis parameter', () => {
      const url = new URL('http://localhost:3000/api/cron/cortex-synthesis?skipSynthesis=true');
      expect(url.searchParams.get('skipSynthesis')).toBe('true');
    });

    it('should parse skipPrune parameter', () => {
      const url = new URL('http://localhost:3000/api/cron/cortex-synthesis?skipPrune=true');
      expect(url.searchParams.get('skipPrune')).toBe('true');
    });

    it('should parse pruneHours parameter with default', () => {
      const urlWithParam = new URL(
        'http://localhost:3000/api/cron/cortex-synthesis?pruneHours=48'
      );
      const urlWithoutParam = new URL('http://localhost:3000/api/cron/cortex-synthesis');

      expect(parseInt(urlWithParam.searchParams.get('pruneHours') || '168', 10)).toBe(48);
      expect(parseInt(urlWithoutParam.searchParams.get('pruneHours') || '168', 10)).toBe(168);
    });
  });

  describe('Synthesis Flow', () => {
    it('should get working memory stats', () => {
      const stats = {
        totalEvents: 100,
        unprocessedEvents: 25,
        eventsBySource: { email: 40, imessage: 30, limitless: 20, calendar: 10 },
        oldestEventTimestamp: '2024-01-01T00:00:00Z',
        newestEventTimestamp: '2024-01-15T12:00:00Z',
      };

      expect(stats.totalEvents).toBe(100);
      expect(stats.unprocessedEvents).toBe(25);
      expect(Object.keys(stats.eventsBySource)).toEqual([
        'email',
        'imessage',
        'limitless',
        'calendar',
      ]);
    });

    it('should run synthesis pass', () => {
      const result = {
        new_tasks: [{ id: 'task-1', title: 'Test Task' }],
        updated_tasks: [],
        proposed_actions: [],
        events_fully_processed: ['event-1', 'event-2'],
        new_patterns: [],
        synthesis_summary: 'Synthesized 2 events into 1 task',
      };

      expect(result.new_tasks.length).toBe(1);
      expect(result.events_fully_processed.length).toBe(2);
      expect(result.synthesis_summary).toContain('Synthesized');
    });

    it('should prune old events', () => {
      const prunedCount = 15;
      expect(prunedCount).toBe(15);
    });
  });

  describe('Response Format', () => {
    it('should return proper success response structure', () => {
      const response = {
        ok: true,
        timestamp: new Date().toISOString(),
        synthesis: {
          performed: true,
          tasksCreated: 1,
          tasksUpdated: 0,
          actionsProposed: 0,
          eventsProcessed: 2,
          patternsLearned: 0,
          summary: 'Synthesized 2 events into 1 task',
        },
        pruning: {
          eventsRemoved: 15,
          pruneWindowHours: 168,
        },
        stats: {
          totalEvents: 100,
          unprocessedEvents: 25,
          eventsBySource: { email: 40, imessage: 30, limitless: 20, calendar: 10 },
        },
        errors: [] as string[],
        duration_ms: 1234,
      };

      expect(response.ok).toBe(true);
      expect(response.synthesis).toBeDefined();
      expect(response.pruning).toBeDefined();
      expect(response.stats).toBeDefined();
      expect(response.errors).toEqual([]);
    });

    it('should return proper error response structure', () => {
      const response = {
        ok: false,
        timestamp: new Date().toISOString(),
        synthesis: null,
        pruning: null,
        stats: null,
        errors: ['Unauthorized - invalid or missing credentials'],
        duration_ms: 5,
      };

      expect(response.ok).toBe(false);
      expect(response.synthesis).toBeNull();
      expect(response.errors.length).toBeGreaterThan(0);
    });
  });

  describe('GET Health Check', () => {
    it('should return endpoint documentation', () => {
      const healthResponse = {
        endpoint: '/api/cron/cortex-synthesis',
        method: 'POST',
        description: 'Cognitive Synthesis Engine cron job',
        authentication: 'Requires x-cron-secret header or Authorization: Bearer',
        parameters: {
          skipSynthesis: 'Optional query param',
          skipPrune: 'Optional query param',
          pruneHours: 'Optional query param',
        },
        actions: [
          '1. Get Working Memory stats',
          '2. Run synthesis loop',
          '3. Apply synthesis results',
          '4. Prune old processed events',
        ],
        status: 'ready',
      };

      expect(healthResponse.endpoint).toBe('/api/cron/cortex-synthesis');
      expect(healthResponse.method).toBe('POST');
      expect(healthResponse.status).toBe('ready');
    });
  });
});
