/**
 * Tests for Council API Routes
 *
 * Tests the /api/memory/council endpoints:
 * - GET: List proposals, search, notifications
 * - POST: Create proposals, mark notifications read
 * - PUT: Approve/reject proposals
 */

import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '@/app/api/memory/council/route';

// Mock the zep module
jest.mock('@/lib/memory/zep', () => ({
  getPendingOrgProposals: jest.fn(() => [
    {
      id: 'proposal-1',
      proposedBy: 'legal-agent',
      text: 'Test proposal',
      timestamp: new Date().toISOString(),
      status: 'pending',
    },
  ]),
  getAllOrgProposals: jest.fn((status, limit) => {
    if (status === 'approved') {
      return [
        {
          id: 'approved-1',
          proposedBy: 'finance-agent',
          text: 'Approved proposal',
          timestamp: new Date().toISOString(),
          status: 'approved',
          reviewedBy: 'admin',
        },
      ];
    }
    return [];
  }),
  getProposalCounts: jest.fn(() => ({
    pending: 2,
    approved: 5,
    rejected: 1,
  })),
  approveOrgProposal: jest.fn((id) => id === 'existing-proposal'),
  rejectOrgProposal: jest.fn((id) => id === 'existing-proposal'),
  proposeOrgMemory: jest.fn((agentId, text, metadata) => ({
    id: `proposal_${Date.now()}`,
    proposedBy: agentId,
    text,
    metadata,
    timestamp: new Date().toISOString(),
    status: 'pending',
  })),
  searchOrgMemory: jest.fn(() => [
    {
      memory: { id: 'mem-1', text: 'Search result' },
      score: 0.95,
    },
  ]),
  getUnreadNotificationCount: jest.fn(() => 3),
  getUnreadNotifications: jest.fn(() => [
    {
      id: 1,
      proposal_id: 'proposal-1',
      notification_type: 'new_proposal',
      recipient: 'council',
    },
  ]),
  markNotificationsRead: jest.fn(() => 2),
}));

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock council db (needed by zep)
jest.mock('@/lib/db/council', () => ({
  createProposal: jest.fn(),
  getProposal: jest.fn(),
  getPendingProposals: jest.fn(() => []),
  approveProposal: jest.fn(() => true),
  rejectProposal: jest.fn(() => true),
  getProposalCounts: jest.fn(() => ({ pending: 0, approved: 0, rejected: 0 })),
  getUnreadNotifications: jest.fn(() => []),
  markNotificationsRead: jest.fn(() => 0),
  getUnreadNotificationCount: jest.fn(() => 0),
}));

describe('Council API Routes', () => {
  describe('GET /api/memory/council', () => {
    it('should return pending proposals by default', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=proposals');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('proposals');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('counts');
      expect(Array.isArray(data.proposals)).toBe(true);
    });

    it('should filter proposals by status', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=proposals&status=approved');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.proposals).toBeDefined();
    });

    it('should search org memory', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=search&query=test');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('query', 'test');
    });

    it('should return notification count', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=notifications');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('unreadCount');
      expect(typeof data.unreadCount).toBe('number');
    });

    it('should return notifications with details when requested', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=notifications&details=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('unreadCount');
      expect(data).toHaveProperty('notifications');
    });

    it('should return counts only', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=counts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('counts');
      expect(data.counts).toHaveProperty('pending');
      expect(data.counts).toHaveProperty('approved');
      expect(data.counts).toHaveProperty('rejected');
    });

    it('should return 400 for invalid action', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council?action=invalid');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/memory/council', () => {
    it('should create a new proposal', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'legal-agent',
          knowledge: 'All contracts require legal review',
          metadata: { category: 'policy' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.proposal).toBeDefined();
      expect(data.proposal.proposedBy).toBe('legal-agent');
      expect(data.proposal.status).toBe('pending');
    });

    it('should return 400 when missing required fields', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'legal-agent',
          // missing knowledge
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should mark notifications as read', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'POST',
        body: JSON.stringify({
          action: 'markRead',
          recipient: 'council',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('markedRead');
    });
  });

  describe('PUT /api/memory/council', () => {
    it('should approve a proposal', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'PUT',
        body: JSON.stringify({
          proposalId: 'existing-proposal',
          action: 'approve',
          reviewedBy: 'admin-user',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.action).toBe('approve');
    });

    it('should reject a proposal', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'PUT',
        body: JSON.stringify({
          proposalId: 'existing-proposal',
          action: 'reject',
          reviewedBy: 'admin-user',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.action).toBe('reject');
    });

    it('should return 400 when missing required fields', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'PUT',
        body: JSON.stringify({
          proposalId: 'test',
          // missing action and reviewedBy
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid action', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'PUT',
        body: JSON.stringify({
          proposalId: 'test',
          action: 'delete', // invalid
          reviewedBy: 'admin',
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent proposal', async () => {
      const request = new NextRequest('http://localhost:4242/api/memory/council', {
        method: 'PUT',
        body: JSON.stringify({
          proposalId: 'non-existent-proposal',
          action: 'approve',
          reviewedBy: 'admin',
        }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(404);
    });
  });
});
