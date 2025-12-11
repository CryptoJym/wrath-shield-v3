/**
 * Cortex Decisions API Route Tests
 * Tests for /api/cortex/decisions endpoint - Decision Queue Management
 */

import { GET, POST } from '@/app/api/cortex/decisions/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/cortex/decision-queue', () => ({
  getDecisionQueue: jest.fn(),
}));

const { getDecisionQueue } = require('@/lib/cortex/decision-queue');

describe('Cortex Decisions API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDecisionQueue = {
    getPendingDecisions: jest.fn(),
    resolveDecision: jest.fn(),
  };

  const mockDecisions = [
    {
      id: 'decision-1',
      title: 'Approve meeting reschedule',
      domain: 'work',
      priority: 'high',
      status: 'pending',
      createdAt: '2025-01-31T10:00:00Z',
      options: [
        { id: 'opt-1', label: 'Approve', action: 'approve' },
        { id: 'opt-2', label: 'Decline', action: 'decline' },
      ],
    },
    {
      id: 'decision-2',
      title: 'Review expense report',
      domain: 'finance',
      priority: 'medium',
      status: 'pending',
      createdAt: '2025-01-31T09:00:00Z',
      options: [
        { id: 'opt-1', label: 'Approve', action: 'approve' },
        { id: 'opt-2', label: 'Request changes', action: 'request_changes' },
        { id: 'opt-3', label: 'Reject', action: 'reject' },
      ],
    },
    {
      id: 'decision-3',
      title: 'Critical security update',
      domain: 'system',
      priority: 'critical',
      status: 'pending',
      createdAt: '2025-01-31T11:00:00Z',
      options: [
        { id: 'opt-1', label: 'Apply now', action: 'apply' },
        { id: 'opt-2', label: 'Schedule for later', action: 'schedule' },
      ],
    },
  ];

  describe('GET /api/cortex/decisions', () => {
    beforeEach(() => {
      getDecisionQueue.mockReturnValue(mockDecisionQueue);
    });

    it('should return all pending decisions', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue(mockDecisions);

      const request = new NextRequest('http://localhost/api/cortex/decisions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.decisions).toEqual(mockDecisions);
      expect(data.count).toBe(3);
    });

    it('should filter by status', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue([mockDecisions[0]]);

      const request = new NextRequest('http://localhost/api/cortex/decisions?status=pending');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDecisionQueue.getPendingDecisions).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('should filter by domain', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue([mockDecisions[1]]);

      const request = new NextRequest('http://localhost/api/cortex/decisions?domain=finance');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDecisionQueue.getPendingDecisions).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'finance' })
      );
    });

    it('should filter by priority', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue([mockDecisions[2]]);

      const request = new NextRequest('http://localhost/api/cortex/decisions?priority=critical');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDecisionQueue.getPendingDecisions).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'critical' })
      );
    });

    it('should respect limit parameter', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue([mockDecisions[0]]);

      const request = new NextRequest('http://localhost/api/cortex/decisions?limit=1');
      const response = await GET(request);

      expect(mockDecisionQueue.getPendingDecisions).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 })
      );
    });

    it('should combine multiple filters', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/cortex/decisions?status=pending&domain=work&priority=high&limit=10'
      );
      const response = await GET(request);

      expect(mockDecisionQueue.getPendingDecisions).toHaveBeenCalledWith({
        status: 'pending',
        domain: 'work',
        priority: 'high',
        limit: 10,
      });
    });

    it('should return empty array when no decisions', async () => {
      mockDecisionQueue.getPendingDecisions.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/cortex/decisions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.decisions).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should return 500 on error', async () => {
      mockDecisionQueue.getPendingDecisions.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/cortex/decisions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database error');
    });
  });

  describe('POST /api/cortex/decisions - Resolve Decision', () => {
    beforeEach(() => {
      getDecisionQueue.mockReturnValue(mockDecisionQueue);
    });

    it('should resolve a decision successfully', async () => {
      mockDecisionQueue.resolveDecision.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({
          decisionId: 'decision-1',
          selectedOptionId: 'opt-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('decision-1');
      expect(data.message).toContain('resolved');
    });

    it('should pass user feedback if provided', async () => {
      mockDecisionQueue.resolveDecision.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({
          decisionId: 'decision-1',
          selectedOptionId: 'opt-2',
          userFeedback: 'Declined due to scheduling conflict',
        }),
      });

      const response = await POST(request);

      expect(mockDecisionQueue.resolveDecision).toHaveBeenCalledWith({
        decisionId: 'decision-1',
        selectedOptionId: 'opt-2',
        userFeedback: 'Declined due to scheduling conflict',
      });
    });

    it('should return 400 when decisionId is missing', async () => {
      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({
          selectedOptionId: 'opt-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('decisionId');
    });

    it('should return 400 when selectedOptionId is missing', async () => {
      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({
          decisionId: 'decision-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('selectedOptionId');
    });

    it('should return 400 when both required fields are missing', async () => {
      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 500 when resolution fails', async () => {
      mockDecisionQueue.resolveDecision.mockRejectedValue(new Error('Decision not found'));

      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({
          decisionId: 'invalid-id',
          selectedOptionId: 'opt-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Decision not found');
    });

    it('should call resolveDecision exactly once', async () => {
      mockDecisionQueue.resolveDecision.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/cortex/decisions', {
        method: 'POST',
        body: JSON.stringify({
          decisionId: 'decision-1',
          selectedOptionId: 'opt-1',
        }),
      });

      await POST(request);

      expect(mockDecisionQueue.resolveDecision).toHaveBeenCalledTimes(1);
    });
  });
});
