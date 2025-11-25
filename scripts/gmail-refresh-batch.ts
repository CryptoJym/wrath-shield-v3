/**
 * Minimal, human-friendly Gmail refresh token collector for multiple mailboxes.
 *
 * Prereq (one action, no editing):
 *   - Drop your Google OAuth client JSON into the repo root as client_secret.json
 *     (the file you downloaded from Google; no need to open or edit it).
 *
 * Usage (one command):
 *   nvm use system
 *   npm run gmail:refresh:batch
 *
 * What happens:
 *   - For each mailbox listed below, the script prints a URL.
 *   - You click the URL, sign in as that mailbox, copy the code, paste back.
 *   - It writes tokens into .env.local automatically (slugged per mailbox).
 *
 * Mailboxes covered:
 *   - james@jamesbrady.org
 *   - james@noticingmind.com
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'google-auth-library';

const MAILBOXES = ['james@jamesbrady.org', 'james@noticingmind.com'];
const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];
const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const CLIENT_PATH =
  process.env.GMAIL_CLIENT_SECRET_PATH || path.resolve(process.cwd(), 'client_secret.json');

function slugify(mailbox: string): string {
  return mailbox.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function loadClient() {
  if (!fs.existsSync(CLIENT_PATH)) {
    throw new Error(
      `client_secret.json not found at ${CLIENT_PATH}. Just drop your downloaded Google OAuth JSON into the repo root with that name.`
    );
  }
  const raw = fs.readFileSync(CLIENT_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const cfg = parsed.installed || parsed.web || parsed;
  return new google.auth.OAuth2(cfg.client_id, cfg.client_secret, cfg.redirect_uris?.[0] || 'http://localhost');
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
  console.log(`Saved ${key} to .env.local`);
}

async function runForMailbox(oAuth2Client: any, mailbox: string) {
  console.log(`\n=== ${mailbox} ===`);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  console.log('Open this URL in your browser, sign in as this mailbox, allow access:');
  console.log(authUrl);
  const code = await prompt('Paste the code here: ');
  const { tokens } = await oAuth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned. Make sure you clicked “Allow” and used a Test User.');
  }
  const slug = slugify(mailbox);
  saveEnvVar(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
  saveEnvVar(`GMAIL_CLIENT_ID_${slug}`, oAuth2Client._clientId);
  saveEnvVar(`GMAIL_CLIENT_SECRET_${slug}`, oAuth2Client._clientSecret);
  console.log(`Done for ${mailbox}.`);
}

async function main() {
  const client = loadClient();
  for (const mailbox of MAILBOXES) {
    await runForMailbox(client, mailbox);
  }
  console.log('\nAll mailboxes processed. Tokens are in .env.local.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
