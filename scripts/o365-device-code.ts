/**
 * One-shot helper to fetch a refresh token for an O365 mailbox via Device Code flow.
 *
 * Usage:
 *   MAILBOX=james@utlyze.com npx tsx scripts/o365-device-code.ts
 *   (or set O365_EMAIL env; falls back to prompt)
 *
 * On success, prints the refresh token and appends it to .env.local as
 * O365_REFRESH_TOKEN_<slug> (slugged from the mailbox, e.g. O365_REFRESH_TOKEN_james_utlyze_com).
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');

// Load environment variables from .env.local
dotenv.config({ path: ENV_PATH });

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

function slugify(mailbox: string): string {
  return mailbox.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function saveToken(mailbox: string, refreshToken: string) {
  const key = `O365_REFRESH_TOKEN_${slugify(mailbox)}`;
  const env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  const filtered = env.filter((line) => !line.startsWith(`${key}=`));
  filtered.push(`${key}=${refreshToken}`);
  fs.writeFileSync(ENV_PATH, filtered.join('\n') + '\n', 'utf8');
  console.log(`Saved to ${ENV_PATH} as ${key}`);
}

async function main() {
  const clientId = process.env.O365_CLIENT_ID;
  if (!clientId) throw new Error('O365_CLIENT_ID not set in env');
  const clientSecret = process.env.O365_CLIENT_SECRET;
  if (!clientSecret) throw new Error('O365_CLIENT_SECRET not set in env');
  const mailbox = process.env.MAILBOX || process.env.O365_EMAIL || (await prompt('Mailbox email: '));
  if (!mailbox) throw new Error('Mailbox email required');

  const scope =
    'offline_access IMAP.AccessAsUser.All SMTP.Send Mail.Read Calendars.ReadWrite openid email profile';

  // Step 1: request device code
  const dcResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope }).toString(),
  });
  const dc = await dcResp.json();
  if (!dcResp.ok) throw new Error(`Device code error: ${JSON.stringify(dc)}`);

  console.log('\n=== DEVICE CODE ===');
  console.log('Mailbox:', mailbox);
  console.log('Go to:', dc.verification_uri);
  console.log('Enter code:', dc.user_code);
  console.log('Expires in (sec):', dc.expires_in);
  console.log('Polling…\n');

  const interval = dc.interval || 5;
  while (true) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const tokResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        client_secret: clientSecret,
        device_code: dc.device_code,
      }).toString(),
    });
    const tok = await tokResp.json();
    if (tokResp.ok) {
      console.log('\n=== SUCCESS ===');
      console.log('Refresh token:', tok.refresh_token);
      saveToken(mailbox, tok.refresh_token);
      return;
    }
    if (tok.error === 'authorization_pending') {
      process.stdout.write('.');
      continue;
    }
    if (tok.error === 'authorization_declined') throw new Error('Authorization declined');
    if (tok.error === 'expired_token') throw new Error('Device code expired');
    throw new Error(`Token error: ${JSON.stringify(tok)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
