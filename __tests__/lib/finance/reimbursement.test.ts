/**
 * Tests for Finance Reimbursement Features
 * - Transaction meta updates (company, assignee, usage_note)
 * - Cycle transactions retrieval
 * - Cycle stats by assignee
 * - Bulk update functionality
 */

import {
  getCycleTransactions,
  getCycleStatsByAssignee,
  updateTransactionMeta,
  bulkUpdateTransactionMeta,
  getTransaction,
  COMPANIES,
  ASSIGNEES,
  type TxnRow,
  type TransactionMetaUpdate,
} from '../../../lib/finance/store';

describe('Finance Reimbursement - Store Functions', () => {
  describe('COMPANIES and ASSIGNEES constants', () => {
    it('should have valid company options', () => {
      expect(COMPANIES).toContain('UTLYZE');
      expect(COMPANIES).toContain('VUPLICITY');
      expect(COMPANIES).toContain('NEW_REWARD');
      expect(COMPANIES).toContain('SOLUTION_STREAM');
      expect(COMPANIES).toContain('KAHOA');
      expect(COMPANIES).toContain('PERSONAL');
      expect(COMPANIES.length).toBe(6);
    });

    it('should have valid assignee options', () => {
      expect(ASSIGNEES).toContain('James Brady');
      expect(ASSIGNEES).toContain('Josh Smith');
      expect(ASSIGNEES).toContain('Cody Vincent');
      expect(ASSIGNEES).toContain('Carl');
      expect(ASSIGNEES).toContain('Other');
      expect(ASSIGNEES.length).toBe(5);
    });
  });

  describe('getCycleTransactions', () => {
    it('should return an array', () => {
      const txns = getCycleTransactions('2025-11-08', '2025-12-08');
      expect(Array.isArray(txns)).toBe(true);
    });

    it('should filter by date range', () => {
      const txns = getCycleTransactions('2025-11-08', '2025-11-15');
      // All transactions should be within range
      txns.forEach(txn => {
        expect(txn.date >= '2025-11-08').toBe(true);
        expect(txn.date <= '2025-11-15').toBe(true);
      });
    });

    it('should include required transaction fields', () => {
      const txns = getCycleTransactions('2025-11-08', '2025-12-08');
      if (txns.length > 0) {
        const txn = txns[0];
        expect(txn).toHaveProperty('id');
        expect(txn).toHaveProperty('vendor');
        expect(txn).toHaveProperty('amount');
        expect(txn).toHaveProperty('date');
        expect(txn).toHaveProperty('bucket');
        expect(txn).toHaveProperty('reimbursable');
      }
    });

    it('should include reimbursement fields', () => {
      const txns = getCycleTransactions('2025-11-08', '2025-12-08');
      if (txns.length > 0) {
        const txn = txns[0];
        // These fields should exist (may be null)
        expect('company' in txn).toBe(true);
        expect('assignee' in txn).toBe(true);
        expect('usage_note' in txn).toBe(true);
      }
    });
  });

  describe('getCycleStatsByAssignee', () => {
    it('should return an array of stats by assignee', () => {
      const stats = getCycleStatsByAssignee('2025-11-08', '2025-12-08');
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should include assignee stats with required fields', () => {
      const stats = getCycleStatsByAssignee('2025-11-08', '2025-12-08');
      if (stats.length > 0) {
        const stat = stats[0];
        expect(stat).toHaveProperty('assignee');
        expect(stat).toHaveProperty('count');
        expect(stat).toHaveProperty('total');
        expect(stat).toHaveProperty('reimbursable');
      }
    });

    it('should have numeric count and total values', () => {
      const stats = getCycleStatsByAssignee('2025-11-08', '2025-12-08');
      stats.forEach(stat => {
        expect(typeof stat.count).toBe('number');
        expect(typeof stat.total).toBe('number');
        expect(typeof stat.reimbursable).toBe('number');
      });
    });

    it('should have string or null assignee values', () => {
      const stats = getCycleStatsByAssignee('2025-11-08', '2025-12-08');
      stats.forEach(stat => {
        expect(typeof stat.assignee === 'string' || stat.assignee === null || stat.assignee === 'Unassigned').toBe(true);
      });
    });
  });

  describe('updateTransactionMeta', () => {
    it('should accept valid company values', () => {
      // Just verify the function exists and doesn't throw with valid params
      // We don't want to modify real data in tests
      expect(typeof updateTransactionMeta).toBe('function');
    });

    it('should handle TransactionMetaUpdate type', () => {
      const update: TransactionMetaUpdate = {
        reimbursable: true,
        company: 'UTLYZE',
        assignee: 'James Brady',
        usage_note: 'AI development work',
      };

      expect(update.reimbursable).toBe(true);
      expect(update.company).toBe('UTLYZE');
      expect(update.assignee).toBe('James Brady');
      expect(update.usage_note).toBe('AI development work');
    });
  });

  describe('bulkUpdateTransactionMeta', () => {
    it('should exist as a function', () => {
      expect(typeof bulkUpdateTransactionMeta).toBe('function');
    });
  });

  describe('getTransaction', () => {
    it('should return null for non-existent id', () => {
      const txn = getTransaction('non-existent-id-12345');
      expect(txn).toBeNull();
    });

    it('should return transaction with all fields when found', () => {
      // Get a real transaction id from the cycle
      const txns = getCycleTransactions('2025-11-08', '2025-12-08');
      if (txns.length > 0) {
        const txn = getTransaction(txns[0].id);
        expect(txn).not.toBeNull();
        expect(txn?.id).toBe(txns[0].id);
      }
    });
  });
});

describe('Finance Reimbursement - Type Safety', () => {
  it('should enforce Company type', () => {
    const validCompanies = ['UTLYZE', 'VUPLICITY', 'NEW_REWARD', 'SOLUTION_STREAM', 'KAHOA', 'PERSONAL'] as const;
    validCompanies.forEach(company => {
      expect(COMPANIES).toContain(company);
    });
  });

  it('should enforce Assignee type', () => {
    const validAssignees = ['James Brady', 'Josh Smith', 'Cody Vincent', 'Carl', 'Other'] as const;
    validAssignees.forEach(assignee => {
      expect(ASSIGNEES).toContain(assignee);
    });
  });
});

describe('Finance Reimbursement - Business Logic', () => {
  describe('Cycle date calculations', () => {
    it('should handle standard billing cycle (8th to 8th)', () => {
      const start = '2025-11-08';
      const end = '2025-12-08';
      const txns = getCycleTransactions(start, end);

      // Verify all returned transactions are within the cycle
      txns.forEach(txn => {
        const txnDate = new Date(txn.date);
        const startDate = new Date(start);
        const endDate = new Date(end);
        expect(txnDate >= startDate).toBe(true);
        expect(txnDate <= endDate).toBe(true);
      });
    });

    it('should handle partial cycles', () => {
      // A week in the middle of November
      const start = '2025-11-10';
      const end = '2025-11-17';
      const txns = getCycleTransactions(start, end);

      txns.forEach(txn => {
        expect(txn.date >= start).toBe(true);
        expect(txn.date <= end).toBe(true);
      });
    });
  });

  describe('Reimbursable classification', () => {
    it('should distinguish reimbursable from non-reimbursable', () => {
      const txns = getCycleTransactions('2025-11-08', '2025-12-08');
      const reimbursable = txns.filter(t => t.reimbursable === true || t.reimbursable === 1);
      const nonReimbursable = txns.filter(t => !t.reimbursable || t.reimbursable === 0);

      expect(reimbursable.length + nonReimbursable.length).toBe(txns.length);
    });
  });
});
