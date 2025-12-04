/**
 * Quick Gmail OAuth helper - generates auth URL and captures token
 */
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const ACCOUNTS_PATH = path.resolve(process.cwd(), '.data', 'gmail', 'accounts.json');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3847/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables');
  process.exit(1);
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
  console.log(`Saved ${key}`);
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
  console.log(`Updated ${ACCOUNTS_PATH}`);
}

async function main() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n========================================');
  console.log('GMAIL OAUTH SETUP');
  console.log('========================================\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Sign in and authorize access');
  console.log('3. You will be redirected - the token will be captured automatically\n');
  console.log('Waiting for authorization...\n');

  // Start local server to capture redirect
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '', `http://localhost:3847`);

    if (reqUrl.pathname === '/oauth2callback') {
      const code = reqUrl.searchParams.get('code');

      if (code) {
        try {
          const { tokens } = await oauth2Client.getToken(code);

          if (tokens.refresh_token) {
            // Get user email
            oauth2Client.setCredentials(tokens);
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            const email = userInfo.data.email || 'unknown';

            const slug = slugify(email);
            saveEnvVar(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
            updateAccountsJson(email, tokens.refresh_token);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h1>Success!</h1>
                <p>Gmail account <strong>${email}</strong> has been authorized.</p>
                <p>You can close this window and return to the terminal.</p>
                <p>To add another account, run the script again.</p>
              </body></html>
            `);

            console.log(`\n✅ SUCCESS! Authorized: ${email}`);
            console.log('Refresh token saved to .env.local and accounts.json\n');

            setTimeout(() => {
              server.close();
              process.exit(0);
            }, 1000);
          } else {
            throw new Error('No refresh token in response');
          }
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Error</h1><p>${err.message}</p></body></html>`);
          console.error('Error:', err.message);
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Error</h1><p>No code received</p></body></html>');
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(3847, () => {
    console.log('OAuth callback server running on http://localhost:3847');
  });
}

main().catch(console.error);
