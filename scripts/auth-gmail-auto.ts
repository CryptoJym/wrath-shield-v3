/**
 * Google OAuth auto-capture for Gmail + Calendar (two accounts).
 * - Spins up a local HTTP listener on http://localhost:43110
 * - Opens browser for each mailbox
 * - Exchanges code for refresh token and stores in .env.local (slugged)
 *
 * Usage:
 *   nvm use system
 *   npm run auth:gmail:auto
 */

import http from 'http';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import readline from 'readline';

const MAILBOXES = ['james@jamesbrady.org', 'james@noticingmind.com'];
const PORT = 43110;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];
const ENV_PATH = path.resolve(process.cwd(), '.env.local');

function slugify(mailbox: string): string {
  return mailbox.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function writeEnv(key: string, value: string) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  const filtered = lines.filter((l) => l && !l.startsWith(`${key}=`));
  filtered.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, filtered.join('\n') + '\n', 'utf8');
  console.log(`Saved ${key} to .env.local`);
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function main() {
  const cid =
    process.env.GMAIL_CLIENT_ID_SHARED ||
    process.env.GMAIL_CLIENT_ID ||
    (await prompt('Client ID: '));
  const csec =
    process.env.GMAIL_CLIENT_SECRET_SHARED ||
    process.env.GMAIL_CLIENT_SECRET ||
    (await prompt('Client Secret: '));

  const oAuth2Client = new google.auth.OAuth2(cid, csec, REDIRECT);

  for (const mailbox of MAILBOXES) {
    console.log(`\n=== ${mailbox} ===`);
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      login_hint: mailbox,
    });

    const code = await listenForCode(authUrl);
    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) throw new Error('No refresh token returned; ensure you clicked Allow.');

    const slug = slugify(mailbox);
    writeEnv(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
    writeEnv(`GMAIL_CLIENT_ID_${slug}`, cid);
    writeEnv(`GMAIL_CLIENT_SECRET_${slug}`, csec);
    console.log(`Captured refresh token for ${mailbox}.`);
  }

  console.log('\nAll done. Tokens saved to .env.local');
}

async function listenForCode(authUrl: string): Promise<string> {
  await open(authUrl);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      const code = url.searchParams.get('code');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>You may close this window.</body></html>');
        server.close(() => resolve(code));
      } else {
        res.writeHead(400);
        res.end('No code.');
      }
  });
    server.listen(PORT, () => console.log(`Waiting for Google redirect on ${REDIRECT} ...`));
    server.on('error', reject);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
