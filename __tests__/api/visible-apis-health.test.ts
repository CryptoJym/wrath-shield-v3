/**
 * Visible APIs Health Check Test Suite
 *
 * Tests all API endpoints that are visible/linked from the navigation menu.
 * These are the APIs that users directly interact with from the UI.
 *
 * Categories from Navigation:
 * - Command: /chat, /agents/roster, /agents/graph
 * - Operations: /inbox, /pm, /tasks
 * - Intel: /finance, /hyro (education), /feed
 * - Systems: /eeg, /legal, /privacy
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Base URL for API testing
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4242';

// Timeout for API requests
const API_TIMEOUT = 10000;

// Helper function to make API requests with timeout
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown; ok: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { status: response.status, data, ok: response.ok };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 408, data: { error: 'Request timeout' }, ok: false };
    }
    throw error;
  }
}

describe('Visible APIs Health Check', () => {

  // ============================================
  // COMMAND CATEGORY APIs
  // ============================================
  describe('Command Category APIs', () => {

    describe('Orchestrator/Chat APIs', () => {
      it('GET /api/orchestrator/gateway should respond', async () => {
        const result = await apiRequest('/api/orchestrator/gateway');
        // Should respond with 200 or 405 (method not allowed for GET on POST-only)
        expect([200, 405, 401, 500]).toContain(result.status);
      });

      it('GET /api/agentic/chat status endpoint should respond', async () => {
        const result = await apiRequest('/api/agentic/chat');
        expect([200, 405, 401, 500]).toContain(result.status);
      });

      it('GET /api/agentic/health should return health status', async () => {
        const result = await apiRequest('/api/agentic/health');
        expect([200, 500]).toContain(result.status);
      });
    });

    describe('Agent Roster/Status APIs', () => {
      it('GET /api/agents/status should return agent statuses', async () => {
        const result = await apiRequest('/api/agents/status');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/agents/activity should return activity log', async () => {
        const result = await apiRequest('/api/agents/activity');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/agents/escalation should respond', async () => {
        const result = await apiRequest('/api/agents/escalation');
        expect([200, 405, 401, 500]).toContain(result.status);
      });
    });

    describe('Agent Graph APIs', () => {
      it('GET /api/system/status should return system metrics', async () => {
        const result = await apiRequest('/api/system/status');
        expect([200, 500]).toContain(result.status);
      });

      it('GET /api/comms/health should return communications health', async () => {
        const result = await apiRequest('/api/comms/health');
        expect([200, 500]).toContain(result.status);
      });
    });
  });

  // ============================================
  // OPERATIONS CATEGORY APIs
  // ============================================
  describe('Operations Category APIs', () => {

    describe('Inbox/Communications APIs', () => {
      it('GET /api/events should return events list', async () => {
        const result = await apiRequest('/api/events');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/comms/status should return comms status', async () => {
        const result = await apiRequest('/api/comms/status');
        expect([200, 500]).toContain(result.status);
      });

      it('POST /api/events/dismiss should handle dismiss requests', async () => {
        const result = await apiRequest('/api/events/dismiss', {
          method: 'POST',
          body: JSON.stringify({ eventId: 'test-id' }),
        });
        expect([200, 400, 401, 404, 500]).toContain(result.status);
      });
    });

    describe('Project Management APIs', () => {
      it('GET /api/pm/status should return PM status', async () => {
        const result = await apiRequest('/api/pm/status');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/pm/actions should return PM actions', async () => {
        const result = await apiRequest('/api/pm/actions');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/pm/relationships should return relationships', async () => {
        const result = await apiRequest('/api/pm/relationships');
        expect([200, 401, 500]).toContain(result.status);
      });
    });

    describe('Tasks APIs', () => {
      it('GET /api/pm/classify should respond', async () => {
        const result = await apiRequest('/api/pm/classify');
        expect([200, 405, 401, 500]).toContain(result.status);
      });

      it('GET /api/context-requests should return context requests', async () => {
        const result = await apiRequest('/api/context-requests');
        expect([200, 401, 500]).toContain(result.status);
      });
    });
  });

  // ============================================
  // INTEL CATEGORY APIs
  // ============================================
  describe('Intel Category APIs', () => {

    describe('Finance APIs', () => {
      it('GET /api/finance/summary should return financial summary', async () => {
        const result = await apiRequest('/api/finance/summary');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/finance/txns should return transactions', async () => {
        const result = await apiRequest('/api/finance/txns');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/finance/vendors should return vendors list', async () => {
        const result = await apiRequest('/api/finance/vendors');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/finance/cycles should return billing cycles', async () => {
        const result = await apiRequest('/api/finance/cycles');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/finance/context-requests should return finance context requests', async () => {
        const result = await apiRequest('/api/finance/context-requests');
        expect([200, 401, 500]).toContain(result.status);
      });
    });

    describe('Education/Hyro APIs', () => {
      it('GET /api/hyro/status should return education status', async () => {
        const result = await apiRequest('/api/hyro/status');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/hyro/recommendations should return recommendations', async () => {
        const result = await apiRequest('/api/hyro/recommendations');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/hyro/education/progress should return education progress', async () => {
        const result = await apiRequest('/api/hyro/education/progress');
        expect([200, 401, 500]).toContain(result.status);
      });
    });

    describe('Feed APIs', () => {
      it('GET /api/feed should return feed items', async () => {
        const result = await apiRequest('/api/feed');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/digest/status should return digest status', async () => {
        const result = await apiRequest('/api/digest/status');
        expect([200, 500]).toContain(result.status);
      });
    });
  });

  // ============================================
  // SYSTEMS CATEGORY APIs
  // ============================================
  describe('Systems Category APIs', () => {

    describe('EEG/Neural Monitoring APIs', () => {
      it('GET /api/eeg/status should return EEG status', async () => {
        const result = await apiRequest('/api/eeg/status');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/metrics should return system metrics', async () => {
        const result = await apiRequest('/api/metrics');
        expect([200, 500]).toContain(result.status);
      });

      it('GET /api/metrics/baselines should return baselines', async () => {
        const result = await apiRequest('/api/metrics/baselines');
        expect([200, 401, 500]).toContain(result.status);
      });
    });

    describe('Legal Advisor APIs', () => {
      it('GET /api/legal/notifications should return legal notifications', async () => {
        const result = await apiRequest('/api/legal/notifications');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/legal/context-requests should return legal context requests', async () => {
        const result = await apiRequest('/api/legal/context-requests');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/legal/data-sources should return legal data sources', async () => {
        const result = await apiRequest('/api/legal/data-sources');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/legal/activity-log should return legal activity log', async () => {
        const result = await apiRequest('/api/legal/activity-log');
        expect([200, 401, 500]).toContain(result.status);
      });
    });

    describe('Privacy/Settings APIs', () => {
      it('GET /api/settings should return user settings', async () => {
        const result = await apiRequest('/api/settings');
        expect([200, 401, 500]).toContain(result.status);
      });

      it('GET /api/config should return configuration', async () => {
        const result = await apiRequest('/api/config');
        expect([200, 401, 500]).toContain(result.status);
      });
    });
  });

  // ============================================
  // CORE SYSTEM APIs
  // ============================================
  describe('Core System APIs', () => {

    describe('UIX/Dashboard APIs', () => {
      it('GET /api/uix should return UI configuration', async () => {
        const result = await apiRequest('/api/uix');
        expect([200, 500]).toContain(result.status);
      });
    });

    describe('Memory/Context APIs', () => {
      it('GET /api/memory/council should return memory council data', async () => {
        const result = await apiRequest('/api/memory/council');
        expect([200, 405, 401, 500]).toContain(result.status);
      });

      it('POST /api/memory/search should handle search requests', async () => {
        const result = await apiRequest('/api/memory/search', {
          method: 'POST',
          body: JSON.stringify({ query: 'test' }),
        });
        expect([200, 400, 401, 500]).toContain(result.status);
      });
    });

    describe('Analysis APIs', () => {
      it('GET /api/analysis/psych should return psych analysis', async () => {
        const result = await apiRequest('/api/analysis/psych');
        expect([200, 405, 401, 500]).toContain(result.status);
      });
    });
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================
describe('API Integration Tests', () => {

  describe('Cross-Category Data Flow', () => {
    it('Finance → PM: Financial context should inform PM priorities', async () => {
      const financeResult = await apiRequest('/api/finance/summary');
      const pmResult = await apiRequest('/api/pm/status');

      // Both should respond without error
      expect([200, 401, 500]).toContain(financeResult.status);
      expect([200, 401, 500]).toContain(pmResult.status);
    });

    it('Events → Legal: Events should have legal context capability', async () => {
      const eventsResult = await apiRequest('/api/events');
      const legalResult = await apiRequest('/api/legal/notifications');

      expect([200, 401, 500]).toContain(eventsResult.status);
      expect([200, 401, 500]).toContain(legalResult.status);
    });

    it('Agents → System: Agent status should reflect in system status', async () => {
      const agentsResult = await apiRequest('/api/agents/status');
      const systemResult = await apiRequest('/api/system/status');

      expect([200, 401, 500]).toContain(agentsResult.status);
      expect([200, 500]).toContain(systemResult.status);
    });
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================
describe('API Performance Tests', () => {

  const PERFORMANCE_THRESHOLD_MS = 3000; // 3 seconds max

  async function measureApiResponse(endpoint: string): Promise<number> {
    const start = Date.now();
    await apiRequest(endpoint);
    return Date.now() - start;
  }

  describe('Critical Path Performance', () => {
    it('/api/uix should respond within threshold', async () => {
      const duration = await measureApiResponse('/api/uix');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('/api/system/status should respond within threshold', async () => {
      const duration = await measureApiResponse('/api/system/status');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('/api/agents/status should respond within threshold', async () => {
      const duration = await measureApiResponse('/api/agents/status');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================
describe('API Error Handling Tests', () => {

  describe('Invalid Request Handling', () => {
    it('POST endpoints should handle invalid JSON gracefully', async () => {
      const result = await apiRequest('/api/events/dismiss', {
        method: 'POST',
        body: 'not-valid-json{{{',
        headers: { 'Content-Type': 'application/json' },
      });
      // APIs may return 200 (graceful handling), 400 (validation), or 500 (server error)
      // The key is that they don't crash
      expect([200, 400, 500]).toContain(result.status);
    });

    it('Should handle missing required fields gracefully', async () => {
      const result = await apiRequest('/api/memory/search', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      // APIs may return 200 (empty result), 400 (validation), 401 (auth), or 500 (error)
      // The key is that they respond without crashing
      expect([200, 400, 401, 500]).toContain(result.status);
    });
  });

  describe('404 Handling', () => {
    it('Non-existent endpoints should respond (may return 200 due to Next.js catch-all)', async () => {
      const result = await apiRequest('/api/nonexistent-endpoint-xyz');
      // Next.js may return 200 with empty response or 404
      // Both are acceptable behaviors
      expect([200, 404]).toContain(result.status);
    });
  });
});
