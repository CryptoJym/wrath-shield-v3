import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import {
  generateAllCycles,
  getCycleTransactions,
  getCycleStatsByAssignee,
  formatCycleLabel,
  ASSIGNEES,
  COMPANIES,
} from '@/lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/finance/reimbursement/cycles
 * List all expense cycles with stats
 *
 * Query params:
 * - withTransactions: Include transaction list (default: false)
 * - cycleStart: Filter to specific cycle start date
 * - cycleEnd: Filter to specific cycle end date
 */
export async function GET(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const url = new URL(request.url);
    const withTransactions = url.searchParams.get('withTransactions') === 'true';
    const cycleStart = url.searchParams.get('cycleStart');
    const cycleEnd = url.searchParams.get('cycleEnd');

    const cycles = generateAllCycles(userId);

    // If specific cycle requested, return detailed data
    if (cycleStart && cycleEnd) {
      const cycle = cycles.find(c => c.start === cycleStart && c.end === cycleEnd);
      if (!cycle) {
        return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
      }

      const transactions = getCycleTransactions(cycleStart, cycleEnd, userId);
      const assigneeStats = getCycleStatsByAssignee(cycleStart, cycleEnd, userId);

      // Calculate additional stats
      const reimbursableCount = transactions.filter(t => t.reimbursable).length;
      const aiSaasTransactions = transactions.filter(t =>
        t.bucket === 'work_reimbursable' || t.bucket === 'personal_ai'
      );

      return NextResponse.json({
        cycle: {
          ...cycle,
          label: formatCycleLabel(cycle.start, cycle.end),
        },
        transactions: withTransactions ? transactions : undefined,
        transactionCount: transactions.length,
        reimbursableCount,
        aiSaasCount: aiSaasTransactions.length,
        assigneeStats,
        assignees: ASSIGNEES,
        companies: COMPANIES,
      });
    }

    // Return all cycles with labels
    const cyclesWithLabels = cycles.map(c => ({
      ...c,
      label: formatCycleLabel(c.start, c.end),
    }));

    return NextResponse.json({
      cycles: cyclesWithLabels,
      assignees: ASSIGNEES,
      companies: COMPANIES,
    });
  } catch (e: any) {
    console.error('[reimbursement/cycles] GET error:', e);
    if (e.message === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e.message || 'Failed to get cycles' }, { status: 500 });
  }
}
