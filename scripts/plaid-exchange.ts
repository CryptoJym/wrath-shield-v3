#!/usr/bin/env tsx
/**
 * Exchange a Plaid public_token for an access_token; store locally in .data/finance/plaid-tokens.json
 * Usage: npm run plaid:exchange -- --public_token <token>
 */
import { Configuration, PlaidApi, PlaidEnvironments, ItemPublicTokenExchangeRequest } from 'plaid';
import fs from 'fs';
import path from 'path';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const PLAID_SECRET = process.env.PLAID_SECRET!;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

const argv = process.argv.slice(2);
const tokenArg = argv.find((a) => a.startsWith('--public_token'));
const public_token = tokenArg ? tokenArg.split('=')[1] : null;

if (!public_token) {
  console.error('Pass --public_token=<token>');
  process.exit(1);
}

async function main() {
  const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: { headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET } },
  });
  const client = new PlaidApi(config);

  const req: ItemPublicTokenExchangeRequest = { public_token };
  const resp = await client.itemPublicTokenExchange(req);

  const file = path.resolve(process.cwd(), '.data', 'finance', 'plaid-tokens.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data: any = {};
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data[resp.data.item_id] = {
    access_token: resp.data.access_token,
    item_id: resp.data.item_id,
    institution_id: resp.data.item_id,
    added_at: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('Stored access_token for item', resp.data.item_id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
