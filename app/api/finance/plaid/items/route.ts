import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import { listPlaidItems, removePlaidItem, removeAllPlaidItems } from '../../../../../lib/finance/plaid';
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/finance/plaid/items
 * List all connected Plaid Items
 */
export async function GET() {
  try {
    currentUserOrThrow();
    const items = await listPlaidItems();

    return NextResponse.json({
      success: true,
      count: items.length,
      items,
      message: items.length > 0
        ? `Found ${items.length} connected account(s). To get extended history, remove all items and re-link.`
        : 'No accounts connected. Link accounts to start syncing transactions.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/finance/plaid/items
 * Remove Plaid Items
 *
 * Body: { itemId?: string, all?: boolean, clearTransactions?: boolean }
 * - itemId: Remove a specific item
 * - all: Remove all items
 * - clearTransactions: Also clear all transaction data (default: false)
 */
export async function DELETE(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json().catch(() => ({}));

    const { itemId, all, clearTransactions } = body;

    let result: { removed: string[]; errors: string[] };

    if (all) {
      // Remove all Plaid items
      result = await removeAllPlaidItems();
    } else if (itemId) {
      // Remove specific item
      const res = await removePlaidItem(itemId);
      result = {
        removed: res.success ? [itemId] : [],
        errors: res.error ? [`${itemId}: ${res.error}`] : [],
      };
    } else {
      return NextResponse.json(
        { error: 'Must specify itemId or all: true' },
        { status: 400 }
      );
    }

    // Optionally clear transaction data
    let transactionsCleared = 0;
    if (clearTransactions) {
      const dbPath = path.resolve(process.cwd(), '.data', 'finance', 'finance.db');
      const db = new BetterSqlite3(dbPath);
      const info = db.prepare('DELETE FROM finance_transactions WHERE source = ?').run('plaid');
      transactionsCleared = info.changes;
      db.close();
    }

    return NextResponse.json({
      success: result.errors.length === 0,
      removed: result.removed,
      errors: result.errors,
      transactionsCleared,
      message: result.removed.length > 0
        ? `Removed ${result.removed.length} Plaid item(s). ${clearTransactions ? `Cleared ${transactionsCleared} transactions.` : ''} You can now re-link accounts with extended history.`
        : 'No items were removed.',
      nextSteps: result.removed.length > 0 ? [
        '1. Go to /finance and click "Link Account"',
        '2. Re-authenticate with each bank',
        '3. Transactions will sync with full history (up to 2 years)',
        '4. Run historical sync from Jan 1, 2025',
      ] : [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
