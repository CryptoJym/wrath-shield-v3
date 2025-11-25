#!/usr/bin/env tsx
/**
 * Plaid link helper (dev/local):
 * Prints a Link token URL you can open in the browser to connect an institution.
 * After completing Link, capture the public_token from the terminal and exchange it for an access_token.
 */
import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const PLAID_SECRET = process.env.PLAID_SECRET!;
const PLAID_ENV = (process.env.PLAID_ENV || 'development') as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error('Set PLAID_CLIENT_ID and PLAID_SECRET in .env.local');
  process.exit(1);
}

async function main() {
  const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: { headers: { 'PLAID-CLIENT-ID': PLAID_CLIENT_ID, 'PLAID-SECRET': PLAID_SECRET } },
  });
  const client = new PlaidApi(config);

  const request: LinkTokenCreateRequest = {
    client_name: 'Wrath Shield Finance',
    country_codes: ['US'],
    language: 'en',
    user: { client_user_id: 'james' },
    products: ['transactions'],
    webhook: process.env.PLAID_WEBHOOK,
  };
  const resp = await client.linkTokenCreate(request);
  console.log('Open this URL:', resp.data.link_token);
  console.log('Use Plaid Sandbox/Dev flow; after linking, capture public_token and run:');
  console.log('  npm run plaid:exchange -- --public_token <token>');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
