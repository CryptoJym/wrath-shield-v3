import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const BASE = process.cwd();
const ACCOUNTS_PATH = process.env.GMAIL_ACCOUNTS_JSON || path.resolve(BASE, '.data', 'gmail', 'accounts.json');

type Mailbox = {
  email: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
};

async function main() {
  const limit = Number(process.env.LIMIT || 25);
  const query = process.env.LEGAL_QUERY || 'from:zstarr@moodybrown.com OR from:moodybrown.com newer_than:60d';
  if (!fs.existsSync(ACCOUNTS_PATH)) {
    throw new Error(
      `No Gmail accounts file at ${ACCOUNTS_PATH}. Run npm run gmail:refresh or set GMAIL_ACCOUNTS_JSON to a JSON file with [{email,client_id,client_secret,refresh_token}].`
    );
  }
  const accounts: Mailbox[] = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
  if (!accounts.length) throw new Error('No Gmail accounts configured');

  const results: any[] = [];
  for (const acct of accounts) {
    const oauth2Client = new google.auth.OAuth2(acct.client_id, acct.client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauth2Client.setCredentials({ refresh_token: acct.refresh_token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: limit });
    const ids = res.data.messages?.map((m) => m.id) || [];
    for (const id of ids) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: id!, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
      const headers = msg.data.payload?.headers || [];
      const getH = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
      const from = getH('From');
      const subject = getH('Subject');
      const date = getH('Date');
      const snippet = msg.data.snippet || '';
      results.push({ id, from, subject, date, snippet, account: acct.email });
    }
  }

  if (!results.length) {
    console.log('No legal mails found.');
    return;
  }

  // POST to legal context queue
const base = process.env.LEGAL_API_BASE || 'http://localhost:4242';
  for (const r of results) {
    const payload = {
      legal: true,
      contact: r.from,
      topic: 'Attorney email',
      source: `gmail:${r.account}`,
      summary: `${r.subject || '(no subject)'} — ${r.snippet || ''}`.slice(0, 500),
      due_date: null,
      confidence: 0.7,
      attachments: [],
    };
    try {
      const resp = await fetch(new URL('/api/legal/context-requests', base), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        console.error('[legal-ingest-mail] failed', await resp.text());
      }
    } catch (e) {
      console.error('[legal-ingest-mail] error posting', e);
    }
  }

  console.log(`Ingested ${results.length} legal emails into context queue.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
