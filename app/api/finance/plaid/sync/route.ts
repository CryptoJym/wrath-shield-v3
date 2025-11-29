import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import { fetchPlaidTransactions } from '../../../../../lib/finance/plaid';
import { upsertTransactionsFromRows } from '../../../../../lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();

    // Fetch transactions from Plaid with user_id
    const transactions = await fetchPlaidTransactions(userId);

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'No new transactions to sync'
      });
    }

    // Store transactions in database with user_id
    await upsertTransactionsFromRows(transactions, userId);

    return NextResponse.json({
      success: true,
      count: transactions.length,
      message: `Synced ${transactions.length} transactions`,
      transactions: transactions.slice(0, 5) // Return first 5 for debugging
    });
  } catch (e: any) {
    console.error('[plaid/sync] Error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to sync transactions' },
      { status: 500 }
    );
  }
}
