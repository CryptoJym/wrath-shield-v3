import fs from 'fs';
import path from 'path';
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsSyncRequest, Products, CountryCode } from 'plaid';
import { TxnRow } from './store';
import { classify } from './rules';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

type PlaidTokenStore = Record<string, { access_token: string; cursor?: string; item_id?: string }>;

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
  });
  return response.data.link_token;
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

  for (const itemId of Object.keys(tokens)) {
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
