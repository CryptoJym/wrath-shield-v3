/**
 * Gmail OAuth with local callback server
 */
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const ACCOUNTS_PATH = path.resolve(process.cwd(), '.data', 'gmail', 'accounts.json');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error('GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in the environment');
}

const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

function slugify(mailbox: string): string {
  return mailbox.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function saveEnvVar(key: string, value: string) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  const filtered = lines.filter((l) => l && !l.startsWith(`${key}=`));
  filtered.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, filtered.join('\n') + '\n', 'utf8');
  console.log(`  ✓ Saved ${key}`);
}

function updateAccountsJson(email: string, refreshToken: string) {
  let accounts: any[] = [];
  if (fs.existsSync(ACCOUNTS_PATH)) {
    accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
  }
  const existing = accounts.findIndex(a => a.email.toLowerCase() === email.toLowerCase());
  const entry = {
    email,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  };
  if (existing >= 0) {
    accounts[existing] = entry;
  } else {
    accounts.push(entry);
  }
  fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
  console.log(`  ✓ Updated accounts.json`);
}

async function main() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           GMAIL OAUTH - LOCAL SERVER MODE                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization callback on port', PORT, '...\n');

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '', REDIRECT_URI);
    const code = reqUrl.searchParams.get('code');
    const error = reqUrl.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error</h1><p>${error}</p>`);
      console.error('OAuth error:', error);
      server.close();
      process.exit(1);
    }

    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          throw new Error('No refresh token - make sure you clicked Allow');
        }

        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email || 'unknown';

        const slug = slugify(email);
        saveEnvVar(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
        updateAccountsJson(email, tokens.refresh_token);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: green;">✓ Success!</h1>
            <p>Authorized: <strong>${email}</strong></p>
            <p>You can close this window.</p>
            <p style="margin-top: 30px; color: #666;">To add another account, run the script again.</p>
          </body></html>
        `);

        console.log(`\n✅ SUCCESS! Authorized: ${email}`);
        console.log('Refresh token saved.\n');

        setTimeout(() => { server.close(); process.exit(0); }, 500);
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><p>${err.message}</p>`);
        console.error('Token error:', err.message);
      }
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Waiting for OAuth callback...');
    }
  });

  server.listen(PORT, () => {
    console.log(`Callback server listening on ${REDIRECT_URI}`);
  });
}

main().catch(console.error);
