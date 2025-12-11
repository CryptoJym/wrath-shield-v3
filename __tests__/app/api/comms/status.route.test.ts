/**
 * Comms Status API Route Tests
 * Tests for /api/comms/status endpoint - Communication Pipeline Status
 */

import { GET } from '@/app/api/comms/status/route';

// Mock dependencies
jest.mock('@/lib/auth/user', () => ({
  currentUserOrThrow: jest.fn(),
}));

jest.mock('@/lib/events', () => ({
  listRecentEvents: jest.fn(),
}));

jest.mock('@/lib/comms/pipeline', () => ({
  getPipelineMetrics: jest.fn(),
  getPipelineLogs: jest.fn(),
}));

jest.mock('@/lib/context_requests', () => ({
  getAllContextRequests: jest.fn(),
  getPendingCountByTarget: jest.fn(),
}));

jest.mock('@/lib/memory/zep', () => ({
  getMemoryTimeline: jest.fn(),
}));

const { currentUserOrThrow } = require('@/lib/auth/user');
const { listRecentEvents } = require('@/lib/events');
const { getPipelineMetrics, getPipelineLogs } = require('@/lib/comms/pipeline');
const { getPendingCountByTarget } = require('@/lib/context_requests');
const { getMemoryTimeline } = require('@/lib/memory/zep');

describe('Comms Status API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    currentUserOrThrow.mockReturnValue({ userId: 'test-user-id' });
  });

  const now = Math.floor(Date.now() / 1000);

  const mockEvents = [
    {
      id: 'evt-1',
      source: 'email',
      channel: 'gmail',
      subject: 'Meeting Request',
      preview: 'Can we schedule a call?',
      ts: now - 1800, // 30 minutes ago
      classification: 'meeting',
      confidence: 0.85,
      routed_target: 'ea',
      needs_review: 0,
      junk: 0,
    },
    {
      id: 'evt-2',
      source: 'email',
      channel: 'outlook',
      subject: 'Invoice #1234',
      preview: 'Please review the attached invoice',
      ts: now - 3600, // 1 hour ago
      classification: 'finance',
      confidence: 0.92,
      routed_target: 'finance',
      needs_review: 0,
      junk: 0,
    },
    {
      id: 'evt-3',
      source: 'chat',
      channel: 'slack',
      subject: null,
      preview: 'PR review needed',
      ts: now - 7200, // 2 hours ago
      classification: 'task',
      confidence: 0.65,
      routed_target: 'pm',
      needs_review: 1,
      junk: 0,
    },
    {
      id: 'evt-4',
      source: 'email',
      channel: 'gmail',
      subject: 'Spam offer',
      preview: 'You won a million dollars!',
      ts: now - 10800, // 3 hours ago
      classification: 'junk',
      confidence: 0.99,
      routed_target: null,
      needs_review: 0,
      junk: 1,
    },
  ];

  const mockPipelineMetrics = {
    total_processed: 1500,
    by_category: { email: 1000, chat: 300, calendar: 200 },
    avg_confidence: 0.82,
    routed_count: 1200,
    dedupe_hits: 50,
    last_updated: now,
  };

  const mockPipelineLogs = [
    {
      id: 'log-1',
      timestamp: now - 60,
      event_id: 'evt-12345678',
      stage: 'classification',
      action: 'classify',
      success: true,
      details: { category: 'meeting' },
    },
    {
      id: 'log-2',
      timestamp: now - 120,
      event_id: 'evt-87654321',
      stage: 'routing',
      action: 'route',
      success: true,
      details: { target: 'ea' },
    },
  ];

  const mockPendingByTarget = {
    pm: 5,
    legal: 2,
    finance: 8,
    ea: 3,
  };

  const mockTemporalMap = [
    { date: '2025-01-31', count: 45 },
    { date: '2025-01-30', count: 38 },
    { date: '2025-01-29', count: 52 },
  ];

  describe('GET /api/comms/status', () => {
    beforeEach(() => {
      listRecentEvents.mockReturnValue(mockEvents);
      getPipelineMetrics.mockReturnValue(mockPipelineMetrics);
      getPipelineLogs.mockReturnValue(mockPipelineLogs);
      getPendingCountByTarget.mockReturnValue(mockPendingByTarget);
      getMemoryTimeline.mockResolvedValue(mockTemporalMap);
    });

    it('should return complete status structure', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('source_health');
      expect(data).toHaveProperty('recent_routed');
      expect(data).toHaveProperty('pending_by_target');
      expect(data).toHaveProperty('pipeline_metrics');
      expect(data).toHaveProperty('recent_logs');
      expect(data).toHaveProperty('temporal_map');
    });

    it('should calculate source health correctly', async () => {
      const response = await GET();
      const data = await response.json();

      expect(Array.isArray(data.source_health)).toBe(true);

      // Should have email and chat sources
      const emailHealth = data.source_health.find((s: any) => s.source === 'email');
      const chatHealth = data.source_health.find((s: any) => s.source === 'chat');

      expect(emailHealth).toBeDefined();
      expect(chatHealth).toBeDefined();

      // Recent events should be marked healthy
      expect(emailHealth.status).toBe('healthy');
      expect(emailHealth.event_count).toBe(3); // 3 email events
    });

    it('should mark stale sources correctly', async () => {
      const staleEvents = [
        {
          ...mockEvents[0],
          ts: now - 7200, // 2 hours ago (> 1 hour stale threshold)
        },
      ];
      listRecentEvents.mockReturnValue(staleEvents);

      const response = await GET();
      const data = await response.json();

      const emailHealth = data.source_health.find((s: any) => s.source === 'email');
      expect(emailHealth.status).toBe('stale');
    });

    it('should return recent routed items limited to 10', async () => {
      // Create 15 routed events
      const manyRoutedEvents = Array.from({ length: 15 }, (_, i) => ({
        id: `evt-${i}`,
        source: 'email',
        channel: 'gmail',
        subject: `Event ${i}`,
        preview: `Preview ${i}`,
        ts: now - i * 100,
        classification: 'task',
        confidence: 0.8,
        routed_target: 'pm',
      }));
      listRecentEvents.mockReturnValue(manyRoutedEvents);

      const response = await GET();
      const data = await response.json();

      expect(data.recent_routed).toHaveLength(10);
    });

    it('should structure recent_routed correctly', async () => {
      const response = await GET();
      const data = await response.json();

      if (data.recent_routed.length > 0) {
        expect(data.recent_routed[0]).toMatchObject({
          id: expect.any(String),
          source: expect.any(String),
          channel: expect.any(String),
          routed_to: expect.any(String),
          ts: expect.any(Number),
        });
      }
    });

    it('should include pending counts by target', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.pending_by_target).toEqual(mockPendingByTarget);
    });

    it('should calculate pipeline metrics correctly', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.pipeline_metrics.total_processed).toBe(1500);
      expect(data.pipeline_metrics.avg_confidence).toBe(0.82);
      expect(data.pipeline_metrics.routed_count).toBe(1200);
      expect(data.pipeline_metrics.dedupe_hits).toBe(50);
    });

    it('should calculate classification accuracy', async () => {
      const response = await GET();
      const data = await response.json();

      // 3 events have classification, 2 have confidence >= 0.7
      // Accuracy = 2/3 = 0.666...
      expect(data.pipeline_metrics.classification_accuracy).toBeCloseTo(0.67, 1);
    });

    it('should count needs_review items', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.pipeline_metrics.needs_review_count).toBe(1);
    });

    it('should count junk items', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.pipeline_metrics.junk_count).toBe(1);
    });

    it('should format recent logs correctly', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.recent_logs).toHaveLength(2);
      expect(data.recent_logs[0]).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Number),
        event_id: expect.any(String),
        stage: expect.any(String),
        action: expect.any(String),
        success: expect.any(Boolean),
      });

      // Event ID should be truncated to 8 chars
      expect(data.recent_logs[0].event_id).toHaveLength(8);
    });

    it('should include temporal map from Zep', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.temporal_map).toEqual(mockTemporalMap);
      expect(getMemoryTimeline).toHaveBeenCalledWith('comms-agent', 30);
    });

    it('should calculate source distribution', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.pipeline_metrics.by_source).toMatchObject({
        email: 3,
        chat: 1,
      });
    });

    it('should return 401 when unauthorized', async () => {
      currentUserOrThrow.mockImplementation(() => {
        throw new Error('unauthorized');
      });

      const response = await GET();

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Failed to get comms status');
    });

    it('should return 500 on internal error', async () => {
      listRecentEvents.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to get comms status');
    });

    it('should handle empty events gracefully', async () => {
      listRecentEvents.mockReturnValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source_health).toHaveLength(0);
      expect(data.recent_routed).toHaveLength(0);
      expect(data.pipeline_metrics.junk_count).toBe(0);
      expect(data.pipeline_metrics.needs_review_count).toBe(0);
    });

    it('should call getPipelineLogs with limit 20', async () => {
      await GET();

      expect(getPipelineLogs).toHaveBeenCalledWith(20);
    });
  });
});
