/**
 * API Data Flow Integration Tests
 * Verifies that APIs return correct data shapes and can be consumed by UI
 */

import { NextRequest } from 'next/server';

// Mock all dependencies
jest.mock('@/lib/db/queries');
jest.mock('@/lib/events');
jest.mock('@/lib/auth/user');
jest.mock('@/lib/agents/registry');
jest.mock('@/lib/context_requests');
jest.mock('@/lib/pm/integration');
jest.mock('@/lib/finance/store');

const mockDb = require('@/lib/db/queries');
const mockEvents = require('@/lib/events');
const mockAuth = require('@/lib/auth/user');
const mockAgents = require('@/lib/agents/registry');
const mockContextRequests = require('@/lib/context_requests');
const mockPM = require('@/lib/pm/integration');
const mockFinance = require('@/lib/finance/store');

// Import after mocks are set up
const { GET: metricsGET, clearMetricsCache } = require('@/app/api/metrics/route');
const { GET: eventsGET } = require('@/app/api/events/route');
const { GET: agentsStatusGET } = require('@/app/api/agents/status/route');
const { GET: agentsGraphGET } = require('@/app/api/agents/graph/route');
const { GET: pmStatusGET } = require('@/app/api/pm/status/route');
const { GET: pmTasksGET } = require('@/app/api/pm/tasks/route');
const { GET: financeSummaryGET } = require('@/app/api/finance/summary/route');
const { GET: financeTxnsGET } = require('@/app/api/finance/txns/route');

describe('API Data Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear metrics cache to prevent test pollution
    clearMetricsCache();

    // Setup default auth
    mockAuth.currentUserOrThrow.mockReturnValue({ userId: 'test-user' });

    // Setup minimal valid responses
    mockDb.getLatestRecovery.mockResolvedValue(null);
    mockDb.getLatestCycle.mockResolvedValue(null);
    mockDb.getLatestSleep.mockResolvedValue(null);
    mockDb.getLifelogsForDate.mockResolvedValue([]);
    mockDb.getMetricsLastNDays.mockResolvedValue([]);
    mockDb.calculateUnbendingScore.mockResolvedValue(null);

    mockEvents.listRecentEvents.mockReturnValue([]);
    mockAgents.getAllAgentsStatus.mockResolvedValue([]);

    mockContextRequests.getRoutingStats.mockReturnValue({
      total: 0,
      by_status: { pending: 0, processing: 0, done: 0, failed: 0 },
    });
    mockContextRequests.getPendingCountByTarget.mockReturnValue({});
    mockContextRequests.getAllContextRequests.mockReturnValue([]);

    mockPM.getAllTasks.mockResolvedValue([]);
    mockFinance.listByDateRange.mockReturnValue([]);
  });

  describe('Dashboard Data Flow', () => {
    it('should provide complete metrics data shape for dashboard', async () => {
      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await metricsGET(request);
      const data = await response.json();

      // Verify shape that UI expects - values can be null when no data
      expect(data).toHaveProperty('today');
      expect(data).toHaveProperty('last7Days');
      expect(data).toHaveProperty('last30Days');
      expect(data.today).toHaveProperty('date');
      expect(data.today).toHaveProperty('lifelogs');
      expect(typeof data.today.date).toBe('string');
      expect(typeof data.today.lifelogs.count).toBe('number');
      expect(typeof data.today.lifelogs.total_manipulations).toBe('number');
      expect(typeof data.today.lifelogs.wrath_deployed).toBe('boolean');
    });

    it('should provide events array that can be mapped in UI', async () => {
      mockEvents.listRecentEvents.mockReturnValue([
        { id: '1', type: 'email', subject: 'Test', ts: 123456 },
      ]);

      const request = new NextRequest('http://localhost:3000/api/events');
      const response = await eventsGET(request);
      const data = await response.json();

      expect(Array.isArray(data.events)).toBe(true);
      data.events.forEach((event: any) => {
        expect(event).toHaveProperty('id');
        expect(typeof event.id).toBe('string');
      });
    });

    it('should provide agent status in renderable format', async () => {
      mockAgents.getAllAgentsStatus.mockResolvedValue([
        {
          id: 'test',
          name: 'Test Agent',
          icon: 'test-icon',
          status: 'green',
          last_sync: '2025-01-31T12:00:00Z',
          hp: 100,
          mp: 100,
          open_items: 0,
        },
      ]);

      const response = await agentsStatusGET();
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      data.forEach((agent: any) => {
        expect(agent.status).toMatch(/^(green|yellow|red)$/);
        expect(typeof agent.hp).toBe('number');
        expect(typeof agent.mp).toBe('number');
        expect(typeof agent.open_items).toBe('number');
      });
    });
  });

  describe('Agents Page Data Flow', () => {
    it('should provide graph data with nodes and edges', async () => {
      mockAgents.getAllAgentsStatus.mockResolvedValue([
        {
          id: 'agent1',
          name: 'Agent 1',
          icon: 'icon1',
          status: 'green',
          last_sync: '2025-01-31T12:00:00Z',
          hp: 100,
          mp: 100,
          open_items: 5,
        },
      ]);

      const response = await agentsGraphGET();
      const data = await response.json();

      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
      expect(data).toHaveProperty('timestamp');

      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);

      if (data.nodes.length > 0) {
        expect(data.nodes[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          status: expect.stringMatching(/^(green|yellow|red)$/),
          position: {
            x: expect.any(Number),
            y: expect.any(Number),
          },
        });
      }
    });
  });

  describe('PM Dashboard Data Flow', () => {
    it('should provide PM status with all required metrics', async () => {
      const response = await pmStatusGET();
      const data = await response.json();

      expect(data).toMatchObject({
        ok: true,
        agent: 'pm',
        status: expect.stringMatching(/^(green|yellow|red)$/),
        health_score: expect.any(Number),
        pending: expect.any(Number),
        processing: expect.any(Number),
        resolved: expect.any(Number),
        failed: expect.any(Number),
        total_routed: expect.any(Number),
        overdue: expect.any(Number),
        avg_pending_age_hours: expect.any(Number),
        resolution_rate: expect.any(Number),
        recent_items: expect.any(Array),
        routing_summary: expect.any(Object),
      });

      // Health score should be 0-100
      expect(data.health_score).toBeGreaterThanOrEqual(0);
      expect(data.health_score).toBeLessThanOrEqual(100);
    });

    it('should provide tasks data with source breakdown', async () => {
      // Note: Motion source was intentionally removed - only github and local
      mockPM.getAllTasks.mockResolvedValue([
        { id: '1', title: 'Task 1', source: 'github', status: 'pending' },
        { id: '2', title: 'Task 2', source: 'local', status: 'done' },
      ]);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks');
      const response = await pmTasksGET(request);
      const data = await response.json();

      expect(data).toMatchObject({
        ok: true,
        count: expect.any(Number),
        tasks: expect.any(Array),
        sources: {
          github: expect.any(Number),
          local: expect.any(Number),
        },
      });

      expect(data.count).toBe(data.tasks.length);
    });
  });

  describe('Finance Dashboard Data Flow', () => {
    it('should provide summary with buckets and counts', async () => {
      mockFinance.listByDateRange.mockReturnValue([
        { id: '1', amount: 100, bucket: 'food', date: '2025-01-15' },
        { id: '2', amount: 200, bucket: 'transport', date: '2025-01-16' },
      ]);

      const request = new NextRequest('http://localhost:3000/api/finance/summary');
      const response = await financeSummaryGET(request);
      const data = await response.json();

      expect(data).toMatchObject({
        window: {
          start: expect.any(String),
          end: expect.any(String),
        },
        buckets: expect.any(Object),
        count: expect.any(Number),
        back90: {
          start: expect.any(String),
          end: expect.any(String),
          buckets: expect.any(Object),
          count: expect.any(Number),
        },
      });

      // Bucket values should be numbers
      Object.values(data.buckets).forEach(value => {
        expect(typeof value).toBe('number');
      });
    });

    it('should provide transactions list for table rendering', async () => {
      mockFinance.listByDateRange.mockReturnValue([
        {
          id: 'txn-1',
          amount: 100,
          bucket: 'food',
          date: '2025-01-15',
          vendor: 'Store',
          status: 'classified',
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/finance/txns?start=2025-01-01&end=2025-01-31'
      );
      const response = await financeTxnsGET(request);
      const data = await response.json();

      expect(data).toHaveProperty('txns');
      expect(Array.isArray(data.txns)).toBe(true);

      if (data.txns.length > 0) {
        expect(data.txns[0]).toMatchObject({
          id: expect.any(String),
          amount: expect.any(Number),
          date: expect.any(String),
        });
      }
    });
  });

  describe('Error Handling Across APIs', () => {
    it('should return consistent error shape for 500 errors', async () => {
      // Mock to throw synchronously when called
      mockDb.getLatestRecovery.mockImplementation(() => {
        throw new Error('DB error');
      });

      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await metricsGET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });

    it('should return consistent error shape for 400 errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/finance/txns');
      const response = await financeTxnsGET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });

    it('should return consistent error shape for 401 errors', async () => {
      mockAuth.currentUserOrThrow.mockImplementation(() => {
        throw new Error('unauthorized');
      });

      const request = new NextRequest('http://localhost:3000/api/events');
      const response = await eventsGET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Data Type Safety', () => {
    it('should never return undefined for required numeric fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await metricsGET(request);
      const data = await response.json();

      expect(data.today.lifelogs.count).not.toBeUndefined();
      expect(data.today.lifelogs.total_manipulations).not.toBeUndefined();
      expect(data.last7Days.totals.manipulation_count).not.toBeUndefined();
      expect(data.last7Days.totals.wrath_deployed).not.toBeUndefined();
    });

    it('should never return undefined for required boolean fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await metricsGET(request);
      const data = await response.json();

      expect(data.today.lifelogs.wrath_deployed).not.toBeUndefined();
      expect(typeof data.today.lifelogs.wrath_deployed).toBe('boolean');
    });

    it('should return arrays, not null/undefined for list endpoints', async () => {
      mockEvents.listRecentEvents.mockReturnValue([]);
      const request = new NextRequest('http://localhost:3000/api/events');
      const response = await eventsGET(request);
      const data = await response.json();

      expect(Array.isArray(data.events)).toBe(true);
      expect(data.events).not.toBeNull();
      expect(data.events).not.toBeUndefined();
    });
  });

  describe('Date Formatting Consistency', () => {
    it('should return ISO 8601 dates where expected', async () => {
      const response = await agentsGraphGET();
      const data = await response.json();

      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return YYYY-MM-DD dates for date fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/metrics');
      const response = await metricsGET(request);
      const data = await response.json();

      expect(data.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
