import fs from 'fs';
import path from 'path';
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsSyncRequest, Products, CountryCode } from 'plaid';
import { TxnRow } from './store';
import { classify } from './rules';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

type PlaidTokenStore = Record<string, { access_token: string; cursor?: string; item_id?: string; user_id?: string }>;

function getTokens(): PlaidTokenStore {
  const file = path.resolve(process.cwd(), '.data', 'finance', 'plaid-tokens.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveTokens(tokens: PlaidTokenStore): void {
  const file = path.resolve(process.cwd(), '.data', 'finance', 'plaid-tokens.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(tokens, null, 2));
}

export function getPlaidClient(): PlaidApi {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    throw new Error('Plaid credentials not configured');
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: { headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET } },
  });
  return new PlaidApi(config);
}

export async function createLinkToken(userId: string): Promise<string> {
  const client = getPlaidClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Wrath Shield Finance',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    transactions: {
      days_requested: 730, // Request 2 years of transaction history
    },
  });
  return response.data.link_token;
}

/**
 * List all connected Plaid Items with their metadata
 */
export async function listPlaidItems(): Promise<Array<{
  item_id: string;
  institution_id?: string;
  added_at?: string;
  user_id?: string;
  has_cursor: boolean;
}>> {
  const tokens = getTokens();
  return Object.entries(tokens).map(([itemId, data]) => ({
    item_id: itemId,
    institution_id: (data as any).institution_id,
    added_at: (data as any).added_at,
    user_id: data.user_id,
    has_cursor: !!data.cursor,
  }));
}

/**
 * Remove a Plaid Item (unlink an account)
 * This deletes the Item from Plaid and removes it from local storage
 */
export async function removePlaidItem(itemId: string): Promise<{ success: boolean; error?: string }> {
  const tokens = getTokens();

  if (!tokens[itemId]) {
    return { success: false, error: `Item ${itemId} not found` };
  }

  const client = getPlaidClient();

  try {
    // Call Plaid API to remove the Item
    await client.itemRemove({
      access_token: tokens[itemId].access_token,
    });

    // Remove from local storage
    delete tokens[itemId];
    saveTokens(tokens);

    return { success: true };
  } catch (e: any) {
    console.error(`[Plaid] Error removing item ${itemId}:`, e?.message);
    return { success: false, error: e?.message || 'Failed to remove item' };
  }
}

/**
 * Remove ALL Plaid Items (for fresh start)
 */
export async function removeAllPlaidItems(): Promise<{ removed: string[]; errors: string[] }> {
  const tokens = getTokens();
  const removed: string[] = [];
  const errors: string[] = [];

  for (const itemId of Object.keys(tokens)) {
    const result = await removePlaidItem(itemId);
    if (result.success) {
      removed.push(itemId);
    } else {
      errors.push(`${itemId}: ${result.error}`);
    }
  }

  return { removed, errors };
}

export async function exchangePublicToken(publicToken: string, userId?: string): Promise<{ access_token: string; item_id: string }> {
  const client = getPlaidClient();
  const response = await client.itemPublicTokenExchange({ public_token: publicToken });
  const { access_token, item_id } = response.data;

  // Store access token securely
  const tokens = getTokens();
  tokens[item_id] = { access_token, item_id };
  saveTokens(tokens);

  return { access_token, item_id };
}

export async function fetchPlaidTransactions(userId?: string): Promise<TxnRow[]> {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) return [];
  const tokens = getTokens();
  if (!Object.keys(tokens).length) return [];

  const client = getPlaidClient();
  const results: TxnRow[] = [];

  // Filter tokens by user_id for security - only sync accounts belonging to this user
  // Also include tokens with no user_id (legacy) or 'default' (single-user mode)
  const userItemIds = Object.keys(tokens).filter(itemId => {
    const tokenUserId = tokens[itemId].user_id;
    if (!userId) return true; // No user specified, sync all (dev mode)
    if (!tokenUserId || tokenUserId === 'default') return true; // Legacy/default tokens
    return tokenUserId === userId; // Match user
  });

  for (const itemId of userItemIds) {
    let cursor = tokens[itemId].cursor;
    let hasMore = true;
    while (hasMore) {
      const req: TransactionsSyncRequest = {
        access_token: tokens[itemId].access_token,
        cursor,
        count: 100,
      };
      const resp = await client.transactionsSync(req);
      const added = resp.data.added || [];

      for (const t of added) {
        const row: TxnRow = {
          id: t.transaction_id,
          user_id: userId,
          account: t.account_id,
          amount: t.amount,
          iso_currency_code: t.iso_currency_code || 'USD',
          date: t.date,
          vendor: t.merchant_name || t.name,
          raw_desc: JSON.stringify(t),
          bucket: undefined,
          project: undefined,
          reimbursable: false,
          source: 'plaid',
        };
        results.push(classify(row));
      }

      cursor = resp.data.next_cursor;
      hasMore = resp.data.has_more;
      tokens[itemId].cursor = cursor;
    }
  }

  // persist cursors
  saveTokens(tokens);

  return results;
}

export async function syncPlaidTransactions(userId?: string): Promise<{ count: number; transactions: TxnRow[] }> {
  const transactions = await fetchPlaidTransactions(userId);
  return { count: transactions.length, transactions };
}

/**
 * Fetch historical transactions using transactionsGet (date-based, not cursor-based)
 * Use this for initial data load or to get transactions before the cursor was set
 */
export async function fetchHistoricalTransactions(userId: string, startDate: string, endDate: string): Promise<TxnRow[]> {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) return [];
  const tokens = getTokens();
  if (!Object.keys(tokens).length) return [];

  const client = getPlaidClient();
  const results: TxnRow[] = [];

  // Filter tokens by user_id
  const userItemIds = Object.keys(tokens).filter(itemId => {
    const tokenUserId = tokens[itemId].user_id;
    if (!userId) return true;
    if (!tokenUserId || tokenUserId === 'default') return true;
    return tokenUserId === userId;
  });

  for (const itemId of userItemIds) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const resp = await client.transactionsGet({
          access_token: tokens[itemId].access_token,
          start_date: startDate,
          end_date: endDate,
          options: {
            count: 500,
            offset: offset,
          },
        });

        const transactions = resp.data.transactions || [];
        const accounts = resp.data.accounts || [];

        // Build account name lookup
        const accountNames: Record<string, string> = {};
        for (const acct of accounts) {
          accountNames[acct.account_id] = `${acct.name} (${acct.mask || acct.account_id.slice(-4)})`;
        }

        for (const t of transactions) {
          const row: TxnRow = {
            id: t.transaction_id,
            user_id: userId,
            account: t.account_id,
            amount: t.amount,
            iso_currency_code: t.iso_currency_code || 'USD',
            date: t.date,
            vendor: t.merchant_name || t.name,
            raw_desc: JSON.stringify({
              ...t,
              account_name: accountNames[t.account_id] || t.account_id,
            }),
            bucket: undefined,
            project: undefined,
            reimbursable: false,
            source: 'plaid',
          };
          results.push(classify(row));
        }

        offset += transactions.length;
        hasMore = offset < resp.data.total_transactions;

        console.log(`[Plaid] Fetched ${offset}/${resp.data.total_transactions} transactions for item ${itemId}`);
      } catch (e: any) {
        console.error(`[Plaid] Error fetching transactions for item ${itemId}:`, e?.message);
        hasMore = false;
      }
    }
  }

  return results;
}
