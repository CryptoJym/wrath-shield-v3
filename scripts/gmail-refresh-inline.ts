/**
 * Zero-file Gmail token helper (no JSON handling by you).
 *
 * You only paste Client ID, Client Secret once, then click two URLs and paste two codes.
 * Tokens + client credentials are written into .env.local automatically per mailbox.
 *
 * Usage:
 *   nvm use system
 *   npm run gmail:refresh:inline
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'googleapis';

const MAILBOXES = ['james@jamesbrady.org', 'james@noticingmind.com'];
const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];
const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const TMP_JSON = path.resolve(process.cwd(), '.tmp_client_secret.json');

function slugify(mailbox: string): string {
  return mailbox.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function prompt(question: string, silent = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: silent ? undefined : process.stdout });
  return new Promise((resolve) => {
    if (silent) {
      process.stdout.write(question);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', (data) => {
        rl.close();
        resolve(data.trim());
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function writeEnv(key: string, value: string) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  const filtered = lines.filter((l) => l && !l.startsWith(`${key}=`));
  filtered.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, filtered.join('\n') + '\n', 'utf8');
  console.log(`Saved ${key} to .env.local`);
}

async function promptJsonOrIds() {
  const raw = await prompt('Paste entire client_secret.json (or press Enter to paste ID/Secret separately):\n');
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw.trim());
      const cfg = parsed.installed || parsed.web || parsed;
      return {
        cid: cfg.client_id,
        csec: cfg.client_secret,
        redirect: (cfg.redirect_uris && cfg.redirect_uris[0]) || 'http://localhost',
      };
    } catch {
      console.log('Could not parse JSON, falling back to manual ID/Secret prompts.');
    }
  }
  const cid = await prompt('Paste Google CLIENT_ID: ');
  const csec = await prompt('Paste Google CLIENT_SECRET: ');
  return { cid, csec, redirect: 'http://localhost' };
}

async function main() {
  const { cid, csec, redirect } = await promptJsonOrIds();

  const oAuth2Client = new google.auth.OAuth2(cid, csec, redirect);

  for (const mailbox of MAILBOXES) {
    console.log(`\n=== ${mailbox} ===`);
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
    console.log('Open this URL, sign in as this mailbox, click Allow:');
    console.log(authUrl);
    const code = await prompt('Paste the code here: ');
    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) throw new Error('No refresh token returned. Make sure you clicked Allow.');
    const slug = slugify(mailbox);
    writeEnv(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
    writeEnv(`GMAIL_CLIENT_ID_${slug}`, cid);
    writeEnv(`GMAIL_CLIENT_SECRET_${slug}`, csec);
    console.log(`Done for ${mailbox}.`);
  }

  if (fs.existsSync(TMP_JSON)) fs.unlinkSync(TMP_JSON);
  console.log('\nAll done. Tokens and creds are in .env.local.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
