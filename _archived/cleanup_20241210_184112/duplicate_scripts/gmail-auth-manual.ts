/**
 * Gmail OAuth - Manual code entry flow
 * Works with any OAuth client (no redirect URI needed)
 */
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const ENV_PATH = path.resolve(process.cwd(), '.env.local');
const ACCOUNTS_PATH = path.resolve(process.cwd(), '.data', 'gmail', 'accounts.json');

// Using environment-provided client credentials
const CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';

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

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

async function authorizeAccount(accountEmail: string) {
  // Use localhost redirect - common default for desktop apps
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'http://localhost'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    login_hint: accountEmail,
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`AUTHORIZE: ${accountEmail}`);
  console.log('='.repeat(60));
  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Sign in as:', accountEmail);
  console.log('3. Click "Allow" to grant access');
  console.log('4. After redirect, copy the "code" parameter from the URL');
  console.log('   (URL will look like: http://localhost/?code=4/0XXXXX&scope=...)');
  console.log('   Copy just the code part after "code=" and before "&"\n');

  const code = await prompt('Paste the code here: ');

  if (!code) {
    console.log('No code entered, skipping this account.');
    return false;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('ERROR: No refresh token returned. Make sure you clicked "Allow".');
      return false;
    }

    // Get user email to confirm
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || accountEmail;

    const slug = slugify(email);
    saveEnvVar(`GMAIL_REFRESH_TOKEN_${slug}`, tokens.refresh_token);
    updateAccountsJson(email, tokens.refresh_token);

    console.log(`\n✅ SUCCESS! Authorized: ${email}\n`);
    return true;
  } catch (err: any) {
    console.error('ERROR:', err.message);
    return false;
  }
}

async function main() {
  const accounts = ['james@jamesbrady.org', 'james@noticingmind.com'];

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           GMAIL OAUTH REFRESH TOKEN SETUP                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nWill authorize ${accounts.length} accounts:`);
  accounts.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

  for (const account of accounts) {
    await authorizeAccount(account);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE! All tokens saved to .env.local and accounts.json');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
