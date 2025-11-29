/**
 * Escalation API Route Tests
 */

import { GET, POST } from '@/app/api/agents/escalation/route';
import { NextRequest } from 'next/server';

// Mock context_requests
jest.mock('@/lib/context_requests', () => ({
  getPendingEscalations: jest.fn().mockReturnValue([
    {
      id: 'esc-1',
      created_at: Math.floor(Date.now() / 1000) - 3600,
      updated_at: Math.floor(Date.now() / 1000) - 3600,
      event_id: 'evt-1',
      event_payload: { channel: 'email', subject: 'FCRA Lawsuit' },
      target: 'orchestrator',
      status: 'pending',
      escalation_level: 'CRITICAL',
      detected_domain: 'vuplicity',
      dispatched_to: ['legal-agent'],
      bus_message_ids: [],
    },
    {
      id: 'esc-2',
      created_at: Math.floor(Date.now() / 1000) - 1800,
      updated_at: Math.floor(Date.now() / 1000) - 1800,
      event_id: 'evt-2',
      event_payload: { channel: 'chat', subject: 'New Project' },
      target: 'orchestrator',
      status: 'pending',
      escalation_level: 'PROPOSE',
      detected_domain: 'utlyze_core',
      dispatched_to: ['pm-agent'],
      bus_message_ids: [],
    },
  ]),
  approveEscalatedRequest: jest.fn().mockImplementation((id: string) => {
    if (id === 'esc-1' || id === 'esc-2') {
      return {
        id,
        status: 'dispatched',
        dispatched_to: ['legal-agent'],
      };
    }
    return null;
  }),
  dismissEscalatedRequest: jest.fn().mockImplementation((id: string, reason?: string) => {
    if (id === 'esc-1' || id === 'esc-2') {
      return {
        id,
        status: 'failed',
        resolution_summary: reason || 'User dismissed escalation',
      };
    }
    return null;
  }),
  getContextRequest: jest.fn().mockImplementation((id: string) => {
    if (id === 'esc-1' || id === 'esc-2') {
      return { id, status: 'pending' };
    }
    return null;
  }),
}));

function createRequest(url: string, method: string = 'GET', body?: any): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost:4242'), {
    method,
    ...(body && { body: JSON.stringify(body) }),
  });
  return req;
}

describe('Escalation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/agents/escalation', () => {
    it('should return pending escalations', async () => {
      const req = createRequest('http://localhost:4242/api/agents/escalation');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pending).toBeDefined();
      expect(data.pending.length).toBe(2);
      expect(data.counts.critical).toBe(1);
      expect(data.counts.propose).toBe(1);
      expect(data.counts.total).toBe(2);
    });

    it('should sort CRITICAL escalations first', async () => {
      const req = createRequest('http://localhost:4242/api/agents/escalation');
      const response = await GET(req);
      const data = await response.json();

      // CRITICAL should be first
      expect(data.pending[0].escalation_level).toBe('CRITICAL');
    });

    it('should enrich escalations with metadata', async () => {
      const req = createRequest('http://localhost:4242/api/agents/escalation');
      const response = await GET(req);
      const data = await response.json();

      expect(data.pending[0].escalation_type).toBeDefined();
      expect(data.pending[0].age_seconds).toBeDefined();
      expect(data.pending[0].proposed_agents).toBeDefined();
    });
  });

  describe('POST /api/agents/escalation - Approve', () => {
    it('should approve a pending escalation', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { action: 'approve', requestId: 'esc-1' }
      );
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('approved');
    });

    it('should return 404 for non-existent request', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { action: 'approve', requestId: 'non-existent' }
      );
      const response = await POST(req);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/agents/escalation - Reject', () => {
    it('should reject a pending escalation', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { action: 'reject', requestId: 'esc-2', reason: 'Not needed' }
      );
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('dismissed');
    });

    it('should use dismiss as alternative action name', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { action: 'dismiss', requestId: 'esc-1' }
      );
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/agents/escalation - Validation', () => {
    it('should return 400 for missing action', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { requestId: 'esc-1' }
      );
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing requestId', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { action: 'approve' }
      );
      const response = await POST(req);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid action', async () => {
      const req = createRequest(
        'http://localhost:4242/api/agents/escalation',
        'POST',
        { action: 'invalid', requestId: 'esc-1' }
      );
      const response = await POST(req);

      expect(response.status).toBe(400);
    });
  });
});
