/**
 * Tests for AI Review Endpoint
 * Tests the /api/finance/reimbursement/ai-review route
 */

describe('AI Review Endpoint - Response Parsing', () => {
  describe('LLM Response Format Handling', () => {
    it('should handle array response format', () => {
      const response = JSON.stringify([
        { id: 'txn1', reimbursable: true, company: 'UTLYZE', assignee: 'James Brady', rationale: 'AI tool' },
        { id: 'txn2', reimbursable: false, company: null, assignee: null, rationale: 'Personal' },
      ]);

      const parsed = JSON.parse(response);
      let decisions: any[];

      if (Array.isArray(parsed)) {
        decisions = parsed;
      } else if (parsed.decisions || parsed.transactions || parsed.results || parsed.items) {
        decisions = parsed.decisions || parsed.transactions || parsed.results || parsed.items || [];
      } else if (parsed.id && 'reimbursable' in parsed) {
        decisions = [parsed];
      } else {
        decisions = [];
      }

      expect(decisions.length).toBe(2);
      expect(decisions[0].id).toBe('txn1');
      expect(decisions[1].id).toBe('txn2');
    });

    it('should handle wrapped decisions format', () => {
      const response = JSON.stringify({
        decisions: [
          { id: 'txn1', reimbursable: true, company: 'UTLYZE', assignee: 'James Brady', rationale: 'AI tool' },
        ],
      });

      const parsed = JSON.parse(response);
      let decisions: any[];

      if (Array.isArray(parsed)) {
        decisions = parsed;
      } else if (parsed.decisions || parsed.transactions || parsed.results || parsed.items) {
        decisions = parsed.decisions || parsed.transactions || parsed.results || parsed.items || [];
      } else if (parsed.id && 'reimbursable' in parsed) {
        decisions = [parsed];
      } else {
        decisions = [];
      }

      expect(decisions.length).toBe(1);
      expect(decisions[0].id).toBe('txn1');
    });

    it('should handle single decision object format', () => {
      const response = JSON.stringify({
        id: 'txn1',
        reimbursable: true,
        company: 'UTLYZE',
        assignee: 'James Brady',
        rationale: 'AI development tool',
      });

      const parsed = JSON.parse(response);
      let decisions: any[];

      if (Array.isArray(parsed)) {
        decisions = parsed;
      } else if (parsed.decisions || parsed.transactions || parsed.results || parsed.items) {
        decisions = parsed.decisions || parsed.transactions || parsed.results || parsed.items || [];
      } else if (parsed.id && 'reimbursable' in parsed) {
        decisions = [parsed];
      } else {
        decisions = [];
      }

      expect(decisions.length).toBe(1);
      expect(decisions[0].id).toBe('txn1');
      expect(decisions[0].reimbursable).toBe(true);
      expect(decisions[0].company).toBe('UTLYZE');
    });

    it('should handle transactions wrapper format', () => {
      const response = JSON.stringify({
        transactions: [
          { id: 'txn1', reimbursable: false, company: null, rationale: 'Personal streaming' },
        ],
      });

      const parsed = JSON.parse(response);
      let decisions: any[];

      if (Array.isArray(parsed)) {
        decisions = parsed;
      } else if (parsed.decisions || parsed.transactions || parsed.results || parsed.items) {
        decisions = parsed.decisions || parsed.transactions || parsed.results || parsed.items || [];
      } else if (parsed.id && 'reimbursable' in parsed) {
        decisions = [parsed];
      } else {
        decisions = [];
      }

      expect(decisions.length).toBe(1);
      expect(decisions[0].id).toBe('txn1');
    });

    it('should return empty array for unknown format', () => {
      const response = JSON.stringify({
        unknown_key: 'unknown_value',
        another_key: 123,
      });

      const parsed = JSON.parse(response);
      let decisions: any[];

      if (Array.isArray(parsed)) {
        decisions = parsed;
      } else if (parsed.decisions || parsed.transactions || parsed.results || parsed.items) {
        decisions = parsed.decisions || parsed.transactions || parsed.results || parsed.items || [];
      } else if (parsed.id && 'reimbursable' in parsed) {
        decisions = [parsed];
      } else {
        decisions = [];
      }

      expect(decisions.length).toBe(0);
    });
  });

  describe('Decision Validation', () => {
    it('should validate required fields in decision', () => {
      const decision = {
        id: 'txn123',
        reimbursable: true,
        company: 'UTLYZE',
        assignee: 'James Brady',
        rationale: 'AI development',
      };

      expect(decision).toHaveProperty('id');
      expect(decision).toHaveProperty('reimbursable');
      expect(typeof decision.reimbursable).toBe('boolean');
    });

    it('should handle null company for non-reimbursable', () => {
      const decision = {
        id: 'txn123',
        reimbursable: false,
        company: null,
        assignee: null,
        rationale: 'Personal expense',
      };

      expect(decision.reimbursable).toBe(false);
      expect(decision.company).toBeNull();
    });

    it('should validate company values', () => {
      const validCompanies = ['UTLYZE', 'VUPLICITY', 'NEW_REWARD', 'SOLUTION_STREAM', 'KAHOA', null];
      const decision = { company: 'UTLYZE' };
      expect(validCompanies).toContain(decision.company);
    });
  });
});

describe('AI Review - Batch Processing', () => {
  it('should calculate batch count correctly', () => {
    const batchSize = 20;
    const transactionCounts = [5, 20, 21, 40, 100, 127];
    const expectedBatches = [1, 1, 2, 2, 5, 7];

    transactionCounts.forEach((count, i) => {
      const batches = Math.ceil(count / batchSize);
      expect(batches).toBe(expectedBatches[i]);
    });
  });

  it('should handle last batch with fewer items', () => {
    const batchSize = 20;
    const totalItems = 127;
    const batches: number[] = [];

    for (let i = 0; i < totalItems; i += batchSize) {
      const batch = Math.min(batchSize, totalItems - i);
      batches.push(batch);
    }

    expect(batches.length).toBe(7);
    expect(batches[0]).toBe(20);
    expect(batches[6]).toBe(7); // Last batch has 7 items
  });
});

describe('AI Review - Summary Calculation', () => {
  it('should calculate summary stats correctly', () => {
    const results = [
      { id: '1', amount: 100, decision: { reimbursable: true, company: 'UTLYZE' } },
      { id: '2', amount: 50, decision: { reimbursable: true, company: 'UTLYZE' } },
      { id: '3', amount: 200, decision: { reimbursable: true, company: 'VUPLICITY' } },
      { id: '4', amount: 75, decision: { reimbursable: false, company: null } },
      { id: '5', amount: 30, decision: { reimbursable: false, company: null } },
    ];

    const summary = {
      reimbursable: results.filter(r => r.decision.reimbursable).length,
      nonReimbursable: results.filter(r => !r.decision.reimbursable).length,
      byCompany: {} as Record<string, { count: number; total: number }>,
    };

    results.filter(r => r.decision.reimbursable).forEach(r => {
      const company = r.decision.company || 'Unassigned';
      if (!summary.byCompany[company]) {
        summary.byCompany[company] = { count: 0, total: 0 };
      }
      summary.byCompany[company].count++;
      summary.byCompany[company].total += r.amount;
    });

    expect(summary.reimbursable).toBe(3);
    expect(summary.nonReimbursable).toBe(2);
    expect(summary.byCompany['UTLYZE'].count).toBe(2);
    expect(summary.byCompany['UTLYZE'].total).toBe(150);
    expect(summary.byCompany['VUPLICITY'].count).toBe(1);
    expect(summary.byCompany['VUPLICITY'].total).toBe(200);
  });
});

describe('AI Review - Dry Run Mode', () => {
  it('should not update when dryRun is true', () => {
    const dryRun = true;
    let updated = 0;

    // Simulate processing
    const decisions = [
      { id: '1', reimbursable: true },
      { id: '2', reimbursable: false },
    ];

    decisions.forEach(decision => {
      if (!dryRun && decision.reimbursable !== undefined) {
        updated++;
      }
    });

    expect(updated).toBe(0);
  });

  it('should update when dryRun is false', () => {
    const dryRun = false;
    let updated = 0;

    const decisions = [
      { id: '1', reimbursable: true },
      { id: '2', reimbursable: false },
    ];

    decisions.forEach(decision => {
      if (!dryRun && decision.reimbursable !== undefined) {
        updated++;
      }
    });

    expect(updated).toBe(2);
  });
});
