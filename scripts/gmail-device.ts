/**
 * Google OAuth Device Flow helper for any number of Gmail accounts.
 * - No local redirect, no code-copy from URL; just enter short user_code in browser.
 * - Stores refresh tokens per mailbox into .env.local (slugged).
 *
 * Prereqs: GMAIL_CLIENT_ID_SHARED and GMAIL_CLIENT_SECRET_SHARED set in .env.local
 *
 * Usage:
 *   GMAIL_ACCOUNTS="acct1@example.com,acct2@example.com" npm run gmail:device
 *
 * If GMAIL_ACCOUNTS is not set, defaults to the two known accounts.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
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

async function deviceFlowForMailbox(mailbox: string, clientId: string, clientSecret: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES.join(' '),
  });
  const dcResp = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const dc = await dcResp.json();
  if (!dcResp.ok) throw new Error(`Device code error: ${JSON.stringify(dc)}`);

  console.log(`\n=== ${mailbox} ===`);
  console.log('1) Open this URL:', dc.verification_url || dc.verification_uri);
  console.log('2) Enter this code:', dc.user_code);
  console.log('3) Click Allow, then return here.');

  const pollParamsBase = {
    client_id: clientId,
    client_secret: clientSecret,
    device_code: dc.device_code,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  };

  while (true) {
    await new Promise((r) => setTimeout(r, (dc.interval || 5) * 1000));
    const pollParams = new URLSearchParams(pollParamsBase as any);
    const tokResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: pollParams.toString(),
    });
    const tok = await tokResp.json();
    if (tokResp.ok) {
      if (!tok.refresh_token) throw new Error('No refresh token returned; ensure you clicked Allow');
      const slug = slugify(mailbox);
      writeEnv(`GMAIL_REFRESH_TOKEN_${slug}`, tok.refresh_token);
      writeEnv(`GMAIL_CLIENT_ID_${slug}`, clientId);
      writeEnv(`GMAIL_CLIENT_SECRET_${slug}`, clientSecret);
      console.log(`Captured refresh token for ${mailbox}.`);
      return;
    }
    if (tok.error === 'authorization_pending') {
      process.stdout.write('.');
      continue;
    }
    if (tok.error === 'slow_down') {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    throw new Error(`Token error: ${JSON.stringify(tok)}`);
  }
}

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID_SHARED;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET_SHARED;
  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID_SHARED and GMAIL_CLIENT_SECRET_SHARED in .env.local first.');
    process.exit(1);
  }

  const list =
    process.env.GMAIL_ACCOUNTS ||
    'james@jamesbrady.org,james@noticingmind.com';
  const mailboxes = list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const mb of mailboxes) {
    await deviceFlowForMailbox(mb, clientId, clientSecret);
  }

  console.log('\nAll done. Tokens saved to .env.local');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
