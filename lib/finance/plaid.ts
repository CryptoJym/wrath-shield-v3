import fs from 'fs';
import path from 'path';
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsSyncRequest } from 'plaid';
import { TxnRow } from './store';
import { classify } from './rules';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

function getTokens(): Record<string, { access_token: string; cursor?: string }> {
  const file = path.resolve(process.cwd(), '.data', 'finance', 'plaid-tokens.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export async function fetchPlaidTransactions(): Promise<TxnRow[]> {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) return [];
  const tokens = getTokens();
  if (!Object.keys(tokens).length) return [];

  const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: { headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET } },
  });
  const client = new PlaidApi(config);

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
  const file = path.resolve(process.cwd(), '.data', 'finance', 'plaid-tokens.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(tokens, null, 2));

  return results;
}
