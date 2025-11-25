/**
 * Helper to fetch a Gmail refresh token and write it into .env.local.
 *
 * Prereqs:
 * - Download your Google OAuth client JSON (Desktop app recommended) as client_secret.json
 *   or set GMAIL_CLIENT_SECRET_PATH to the file path.
 * - Ensure the account is listed as a test user in the GCP OAuth consent screen.
 *
 * Usage:
 *   MAILBOX=james@jamesbrady.org npm run gmail:refresh
 *
 * On success: prints refresh token and saves as GMAIL_REFRESH_TOKEN_<slug> in .env.local.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'google-auth-library';

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

function loadClientCredentials(): any {
  const file =
    process.env.GMAIL_CLIENT_SECRET_PATH ||
    path.resolve(process.cwd(), 'client_secret.json');
  if (!fs.existsSync(file)) {
    throw new Error(`client secret JSON not found at ${file}. Set GMAIL_CLIENT_SECRET_PATH or place client_secret.json in repo root.`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw).installed || JSON.parse(raw).web || JSON.parse(raw);
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

function saveEnvVar(key: string, value: string) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  const filtered = lines.filter((l) => l && !l.startsWith(`${key}=`));
  filtered.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, filtered.join('\n') + '\n', 'utf8');
  console.log(`Saved ${key} to ${ENV_PATH}`);
}

async function main() {
  const mailbox = process.env.MAILBOX || (await prompt('Mailbox email: '));
  if (!mailbox) throw new Error('Mailbox email is required.');

  const creds = loadClientCredentials();
  const oAuth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uris?.[0] || creds.redirectUri || 'http://localhost'
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\nOpen this URL in a browser and sign in as:', mailbox);
  console.log(authUrl);
  const code = await prompt('\nPaste the authorization code here: ');

  const { tokens } = await oAuth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned; make sure you chose consent and used a test user.');
  }

  const slug = slugify(mailbox);
  saveEnvVar(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
  saveEnvVar(`GMAIL_CLIENT_ID_${slug}`, creds.client_id);
  saveEnvVar(`GMAIL_CLIENT_SECRET_${slug}`, creds.client_secret);

  console.log('\nRefresh token captured. You can re-run for the second mailbox.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
