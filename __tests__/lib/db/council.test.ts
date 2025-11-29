/**
 * Tests for Council Proposals Database Layer
 *
 * Tests SQLite persistence for org-council proposals and notifications.
 */

import {
  createProposal,
  getProposal,
  getPendingProposals,
  getProposalsByStatus,
  getAllProposals,
  approveProposal,
  rejectProposal,
  getProposalCounts,
  getUnreadNotifications,
  markNotificationsRead,
  getUnreadNotificationCount,
} from '@/lib/db/council';
import { Database } from '@/lib/db/Database';

// Mock the Database module
jest.mock('@/lib/db/Database', () => {
  const mockDb = {
    prepare: jest.fn(),
    exec: jest.fn(),
  };

  return {
    getDatabase: jest.fn(() => ({
      prepare: jest.fn((sql: string) => {
        // Return mock statement based on SQL
        if (sql.includes('INSERT INTO council_proposals')) {
          return { run: jest.fn() };
        }
        if (sql.includes('SELECT * FROM council_proposals WHERE id')) {
          return {
            get: jest.fn((id: string) => {
              if (id === 'existing-proposal') {
                return {
                  id: 'existing-proposal',
                  proposed_by: 'legal-agent',
                  text: 'Test proposal',
                  metadata: '{"category":"test"}',
                  status: 'pending',
                  created_at: Math.floor(Date.now() / 1000),
                  updated_at: Math.floor(Date.now() / 1000),
                };
              }
              return null;
            }),
          };
        }
        if (sql.includes('WHERE status = \'pending\'')) {
          return {
            all: jest.fn(() => [
              {
                id: 'proposal-1',
                proposed_by: 'legal-agent',
                text: 'Pending proposal',
                metadata: null,
                status: 'pending',
                created_at: Math.floor(Date.now() / 1000),
                updated_at: Math.floor(Date.now() / 1000),
              },
            ]),
          };
        }
        if (sql.includes('WHERE status = ?')) {
          return {
            all: jest.fn(() => []),
          };
        }
        if (sql.includes('SELECT * FROM council_proposals') && sql.includes('ORDER BY created_at')) {
          return {
            all: jest.fn(() => []),
          };
        }
        if (sql.includes('UPDATE council_proposals')) {
          return {
            run: jest.fn(() => ({ changes: 1 })),
          };
        }
        if (sql.includes('SELECT status, COUNT')) {
          return {
            all: jest.fn(() => [
              { status: 'pending', count: 2 },
              { status: 'approved', count: 5 },
              { status: 'rejected', count: 1 },
            ]),
          };
        }
        if (sql.includes('INSERT OR IGNORE INTO council_notifications')) {
          return { run: jest.fn() };
        }
        if (sql.includes('SELECT n.*, p.')) {
          return { all: jest.fn(() => []) };
        }
        if (sql.includes('SELECT COUNT(*) as count')) {
          return { get: jest.fn(() => ({ count: 3 })) };
        }
        if (sql.includes('UPDATE council_notifications')) {
          return { run: jest.fn(() => ({ changes: 2 })) };
        }
        return { run: jest.fn(), get: jest.fn(), all: jest.fn(() => []) };
      }),
    })),
    Database: {
      getInstance: jest.fn(),
      resetInstance: jest.fn(),
    },
  };
});

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('Council Database Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProposal', () => {
    it('should create a new proposal with correct fields', () => {
      const result = createProposal(
        'test-id-123',
        'legal-agent',
        'All contracts must be reviewed',
        { category: 'policy' }
      );

      expect(result).toMatchObject({
        id: 'test-id-123',
        proposed_by: 'legal-agent',
        text: 'All contracts must be reviewed',
        metadata: { category: 'policy' },
        status: 'pending',
      });
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should create a proposal without metadata', () => {
      const result = createProposal(
        'test-id-456',
        'finance-agent',
        'Budget limits apply'
      );

      expect(result.id).toBe('test-id-456');
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('getProposal', () => {
    it('should return proposal when found', () => {
      const result = getProposal('existing-proposal');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('existing-proposal');
      expect(result?.proposed_by).toBe('legal-agent');
      expect(result?.metadata).toEqual({ category: 'test' });
    });

    it('should return null when proposal not found', () => {
      const result = getProposal('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getPendingProposals', () => {
    it('should return array of pending proposals', () => {
      const result = getPendingProposals();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getProposalCounts', () => {
    it('should return counts for all statuses', () => {
      const result = getProposalCounts();

      expect(result).toHaveProperty('pending');
      expect(result).toHaveProperty('approved');
      expect(result).toHaveProperty('rejected');
      expect(typeof result.pending).toBe('number');
      expect(typeof result.approved).toBe('number');
      expect(typeof result.rejected).toBe('number');
    });
  });

  describe('approveProposal', () => {
    it('should return true when proposal approved successfully', () => {
      const result = approveProposal('existing-proposal', 'council-admin');

      expect(result).toBe(true);
    });
  });

  describe('rejectProposal', () => {
    it('should return true when proposal rejected successfully', () => {
      const result = rejectProposal('existing-proposal', 'council-admin');

      expect(result).toBe(true);
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return count of unread notifications', () => {
      const result = getUnreadNotificationCount('council');

      expect(typeof result).toBe('number');
      expect(result).toBe(3);
    });
  });

  describe('markNotificationsRead', () => {
    it('should mark notifications as read and return count', () => {
      const result = markNotificationsRead('council');

      expect(typeof result).toBe('number');
      expect(result).toBe(2);
    });

    it('should mark specific proposal notifications as read', () => {
      const result = markNotificationsRead('council', ['proposal-1', 'proposal-2']);

      expect(typeof result).toBe('number');
    });
  });
});
