/**
 * Outlook/M365 OAuth auto-capture (auth code with PKCE) for two mailboxes.
 * Starts local listener on http://localhost:43111, opens browser, captures code, exchanges for refresh tokens.
 *
 * Mailboxes: james@utlyze.com, james@vuplicity.com
 *
 * Env needed: O365_CLIENT_ID, O365_CLIENT_SECRET (confidential app), O365_TENANT_ID (use 'common' if multi-tenant)
 */

import crypto from 'crypto';
import http from 'http';
import open from 'open';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const MAILBOXES = ['james@vuplicity.com'];
const PORT = 43111;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const SCOPES = [
  'offline_access',
  'IMAP.AccessAsUser.All',
  'SMTP.Send',
  'Mail.Read',
  'Calendars.ReadWrite',
  'openid',
  'profile',
  'email',
];

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

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function main() {
  const cid = process.env.O365_CLIENT_ID || (await prompt('O365 CLIENT_ID: '));
  const csec = process.env.O365_CLIENT_SECRET || (await prompt('O365 CLIENT_SECRET: '));
  const tenant = process.env.O365_TENANT_ID || 'common';

  for (const mailbox of MAILBOXES) {
    console.log(`\n=== ${mailbox} ===`);
    const { verifier, challenge } = pkcePair();
    const params = new URLSearchParams({
      client_id: cid,
      response_type: 'code',
      redirect_uri: REDIRECT,
      response_mode: 'query',
      scope: SCOPES.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      login_hint: mailbox,
    });
    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
    const code = await listenForCode(authUrl);

    const tokenParams = new URLSearchParams({
      client_id: cid,
      scope: SCOPES.join(' '),
      code,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
      code_verifier: verifier,
      client_secret: csec,
    });

    const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });
    const tok = await resp.json();
    if (!resp.ok || !tok.refresh_token) {
      throw new Error(`Token error: ${resp.status} ${JSON.stringify(tok)}`);
    }

    const slug = slugify(mailbox);
    writeEnv(`O365_REFRESH_TOKEN_${slug}`, tok.refresh_token);
    writeEnv(`O365_EMAIL_${slug}`, mailbox);
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
    server.listen(PORT, () => console.log(`Waiting for Microsoft redirect on ${REDIRECT} ...`));
    server.on('error', reject);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
