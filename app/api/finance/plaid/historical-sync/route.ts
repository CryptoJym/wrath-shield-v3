import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import { fetchHistoricalTransactions } from '../../../../../lib/finance/plaid';
import { upsertTransactionsFromRows } from '../../../../../lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minute timeout for large historical pulls

/**
 * POST /api/finance/plaid/historical-sync
 * Body: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 *
 * Fetches all transactions from Plaid within the date range
 * This uses transactionsGet instead of transactionsSync for historical data
 */
export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json().catch(() => ({}));

    const startDate = body.startDate || '2025-04-01';
    const endDate = body.endDate || new Date().toISOString().split('T')[0];

    console.log(`[Historical Sync] Fetching transactions from ${startDate} to ${endDate} for user ${userId}`);

    // Fetch historical transactions from Plaid
    const transactions = await fetchHistoricalTransactions(userId, startDate, endDate);

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No transactions found in date range'
      });
    }

    // Store transactions in database
    await upsertTransactionsFromRows(transactions, userId);

    // Get account breakdown
    const accountCounts: Record<string, number> = {};
    for (const t of transactions) {
      // Try to extract account name from raw_desc
      try {
        const raw = JSON.parse(t.raw_desc || '{}');
        const acctName = raw.account_name || t.account || 'unknown';
        accountCounts[acctName] = (accountCounts[acctName] || 0) + 1;
      } catch {
        accountCounts[t.account || 'unknown'] = (accountCounts[t.account || 'unknown'] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      count: transactions.length,
      dateRange: { startDate, endDate },
      accountBreakdown: accountCounts,
      message: `Synced ${transactions.length} transactions from ${startDate} to ${endDate}`,
      sample: transactions.slice(0, 3).map(t => ({
        date: t.date,
        vendor: t.vendor,
        amount: t.amount,
        account: t.account
      }))
    });
  } catch (e: any) {
    console.error('[historical-sync] Error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to sync historical transactions' },
      { status: 500 }
    );
  }
}
