/**
 * Context Requests Escalation Tests
 *
 * Tests for escalation enforcement in the context request system.
 */

import {
  getPendingEscalations,
  approveEscalatedRequest,
  dismissEscalatedRequest,
} from '@/lib/context_requests';

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    version: '1.0',
    updated_at: Math.floor(Date.now() / 1000),
    requests: [
      {
        id: 'req-critical-1',
        created_at: Math.floor(Date.now() / 1000) - 3600,
        updated_at: Math.floor(Date.now() / 1000) - 3600,
        event_id: 'evt-1',
        event_payload: { channel: 'email', subject: 'FCRA Lawsuit Notice' },
        target: 'orchestrator',
        status: 'pending',
        escalation_level: 'CRITICAL',
        detected_domain: 'vuplicity',
        dispatched_to: ['legal-agent'],
        bus_message_ids: [],
      },
      {
        id: 'req-propose-1',
        created_at: Math.floor(Date.now() / 1000) - 1800,
        updated_at: Math.floor(Date.now() / 1000) - 1800,
        event_id: 'evt-2',
        event_payload: { channel: 'chat', subject: 'New Project Proposal' },
        target: 'orchestrator',
        status: 'pending',
        escalation_level: 'PROPOSE',
        detected_domain: 'utlyze_core',
        dispatched_to: ['pm-agent'],
        bus_message_ids: [],
      },
      {
        id: 'req-auto-1',
        created_at: Math.floor(Date.now() / 1000) - 600,
        updated_at: Math.floor(Date.now() / 1000) - 600,
        event_id: 'evt-3',
        event_payload: { channel: 'email', subject: 'Daily Report' },
        target: 'orchestrator',
        status: 'dispatched',
        escalation_level: 'AUTO_EXECUTE',
        dispatched_to: ['pm-agent'],
        bus_message_ids: [],
      },
    ],
    stats: { total: 3, by_target: {}, by_status: {} },
  })),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('path', () => ({
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mockid123'),
  }),
}));

jest.mock('@/lib/agent_bus', () => ({
  emitMessage: jest.fn().mockReturnValue({ id: 'bus-msg-1' }),
}));

jest.mock('@/lib/life-os-config', () => ({
  getAgents: jest.fn().mockReturnValue({ agents: [] }),
  getDomains: jest.fn().mockReturnValue({ domains: [] }),
  getMappings: jest.fn().mockReturnValue({ project_mappings: [] }),
  determineEscalationLevel: jest.fn().mockReturnValue('AUTO_EXECUTE'),
  getAgentsForDomain: jest.fn().mockReturnValue([]),
}));

describe('Context Requests Escalation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingEscalations', () => {
    it('should return only pending CRITICAL and PROPOSE escalations', () => {
      const pending = getPendingEscalations();

      // Should include CRITICAL and PROPOSE that are pending
      expect(pending.length).toBe(2);
      expect(pending.some(r => r.escalation_level === 'CRITICAL')).toBe(true);
      expect(pending.some(r => r.escalation_level === 'PROPOSE')).toBe(true);

      // Should NOT include AUTO_EXECUTE or dispatched items
      expect(pending.some(r => r.escalation_level === 'AUTO_EXECUTE')).toBe(false);
      expect(pending.some(r => r.status === 'dispatched')).toBe(false);
    });

    it('should prioritize CRITICAL escalations', () => {
      const pending = getPendingEscalations();

      // CRITICAL should be identifiable
      const critical = pending.filter(r => r.escalation_level === 'CRITICAL');
      expect(critical.length).toBe(1);
      expect(critical[0].detected_domain).toBe('vuplicity');
    });
  });

  describe('approveEscalatedRequest', () => {
    it('should approve a pending escalation', () => {
      const result = approveEscalatedRequest('req-critical-1');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.status).toBe('dispatched');
      }
    });

    it('should return null for non-existent request', () => {
      const result = approveEscalatedRequest('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('dismissEscalatedRequest', () => {
    it('should dismiss a pending escalation with reason', () => {
      const result = dismissEscalatedRequest('req-propose-1', 'Not needed');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.status).toBe('failed');
        expect(result.resolution_summary).toBe('Not needed');
      }
    });

    it('should use default reason if none provided', () => {
      const result = dismissEscalatedRequest('req-critical-1');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.resolution_summary).toBe('User dismissed escalation');
      }
    });
  });

  describe('Escalation Level Behavior', () => {
    it('should identify CRITICAL items requiring immediate attention', () => {
      const pending = getPendingEscalations();
      const critical = pending.find(r => r.id === 'req-critical-1');

      expect(critical).toBeDefined();
      expect(critical?.escalation_level).toBe('CRITICAL');
      expect(critical?.event_payload.subject).toContain('FCRA');
    });

    it('should identify PROPOSE items requiring approval', () => {
      const pending = getPendingEscalations();
      const propose = pending.find(r => r.id === 'req-propose-1');

      expect(propose).toBeDefined();
      expect(propose?.escalation_level).toBe('PROPOSE');
      expect(propose?.event_payload.subject).toContain('Project');
    });
  });
});
