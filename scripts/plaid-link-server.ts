#!/usr/bin/env tsx
/**
 * Local server for Plaid Link flow that captures public_token automatically
 */
import { Configuration, PlaidApi, PlaidEnvironments, LinkTokenCreateRequest } from 'plaid';
import http from 'http';
import open from 'open';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const PLAID_SECRET = process.env.PLAID_SECRET!;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments;

if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
  console.error('Set PLAID_CLIENT_ID and PLAID_SECRET in .env.local');
  process.exit(1);
}

async function createLinkToken() {
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
  };
  const resp = await client.linkTokenCreate(request);
  return resp.data.link_token;
}

async function main() {
  console.log('Creating Link token...');
  const linkToken = await createLinkToken();

  let publicToken: string | null = null;

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/callback')) {
      const url = new URL(req.url, 'http://localhost:8888');
      publicToken = url.searchParams.get('public_token');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Success</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>✅ Account Linked Successfully!</h1>
          <p>Public token received. You can close this window.</p>
          <pre style="background: #f5f5f5; padding: 20px; margin-top: 20px;">${publicToken}</pre>
        </body>
        </html>
      `);

      console.log('\n✅ Public token received:', publicToken);
      console.log('\nRun this command to exchange it:');
      console.log(`npm run plaid:exchange -- --public_token=${publicToken}\n`);

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 2000);
      return;
    }

    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Plaid Link</title>
          <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
        </head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Wrath Shield - Plaid Link</h1>
          <p>Click the button below to connect your bank account</p>
          <button id="link-button" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background: #000; color: white; border: none; border-radius: 6px;">
            Connect Bank Account
          </button>
          <script>
            const linkHandler = Plaid.create({
              token: '${linkToken}',
              onSuccess: (public_token, metadata) => {
                fetch('/callback?public_token=' + public_token)
                  .then(() => {
                    document.body.innerHTML = '<div style="font-family: sans-serif; padding: 40px; text-align: center;"><h1>✅ Success!</h1><p>Account linked. Public token captured!</p><pre style="background: #f5f5f5; padding: 20px; margin-top: 20px;">' + public_token + '</pre></div>';
                  });
              },
              onExit: (err, metadata) => {
                if (err) console.error(err);
              },
            });
            document.getElementById('link-button').onclick = () => linkHandler.open();
          </script>
        </body>
        </html>
      `);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(8888, () => {
    console.log('✅ Server running at http://localhost:8888');
    console.log('Opening browser...\n');
    open('http://localhost:8888');
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
