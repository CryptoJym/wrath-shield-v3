/**
 * Gmail + Calendar ingestor (read-only) for configured mailboxes.
 *
 * Uses refresh tokens and client credentials already stored in .env.local by gmail:refresh:inline.
 * Normalizes into JSONL files under .data/gmail/<slug>.jsonl and .data/gcalendar/<slug>.jsonl.
 *
 * Mailboxes covered: any env keys matching GMAIL_REFRESH_TOKEN_<slug>.
 *
 * Usage:
 *   nvm use system
 *   set -a && source .env.local && set +a
 *   npm run ingest:gmail
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

type MailboxCreds = { email: string; clientId: string; clientSecret: string; refreshToken: string; slug: string };

const MAILBOXES = loadMailboxCreds();
const MAX_EMAILS = parseInt(process.env.GMAIL_INGEST_MAX_EMAILS || '40', 10);
const DAYS_BACK = parseInt(process.env.GMAIL_INGEST_DAYS_BACK || '7', 10);
const GCAL_LOOKAHEAD_DAYS = parseInt(process.env.GCAL_LOOKAHEAD_DAYS || '14', 10);

async function main() {
  if (MAILBOXES.length === 0) {
    console.log('No Gmail mailboxes found in env (expected GMAIL_REFRESH_TOKEN_<slug>). Run gmail:refresh:inline first.');
    return;
  }
  for (const mb of MAILBOXES) {
    // Use the client_id/secret that issued this refresh token
    const auth = new google.auth.OAuth2(mb.clientId, mb.clientSecret, 'http://localhost');
    auth.setCredentials({ refresh_token: mb.refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });
    const calendar = google.calendar({ version: 'v3', auth });

    await ingestMail(mb, gmail);
    await ingestCalendar(mb, calendar);
  }
}

async function ingestMail(mb: MailboxCreds, gmail: any) {
  const newerThan = `newer_than:${DAYS_BACK}d`;
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `in:inbox ${newerThan}`,
    maxResults: MAX_EMAILS,
  });
  const ids = res.data.messages?.map((m: any) => m.id) || [];
  const out: any[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'To', 'Date'] });
    const headers = msg.data.payload?.headers || [];
    const h = keyBy(headers, 'name');
    out.push({
      id,
      subject: h['Subject']?.value || '',
      from: h['From']?.value || '',
      to: h['To']?.value || '',
      date: h['Date']?.value || msg.data.internalDate,
      snippet: msg.data.snippet || '',
    });
  }
  writeJsonl(path.resolve('.data/gmail', `${mb.slug}.jsonl`), out);
  console.log(`[gmail] ${mb.email}: wrote ${out.length} messages`);
}

async function ingestCalendar(mb: MailboxCreds, calendar: any) {
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + GCAL_LOOKAHEAD_DAYS * 86400000).toISOString();
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });
  const events = (res.data.items || []).map((e: any) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    attendees: e.attendees?.map((a: any) => a.email) || [],
    status: e.status,
  }));
  writeJsonl(path.resolve('.data/gcalendar', `${mb.slug}.jsonl`), events);
  console.log(`[gcal]  ${mb.email}: wrote ${events.length} events`);
}

function keyBy(arr: any[], key: string) {
  const out: any = {};
  for (const item of arr) out[item[key]] = item;
  return out;
}

function writeJsonl(file: string, rows: any[]) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

function loadMailboxCreds(): MailboxCreds[] {
  const env = process.env;
  const entries: MailboxCreds[] = [];
  for (const key of Object.keys(env)) {
    if (key.startsWith('GMAIL_REFRESH_TOKEN_')) {
      const slug = key.replace('GMAIL_REFRESH_TOKEN_', '');
      const email = slug.replace(/_/g, '.').replace(/\\.com$/, '.com'); // heuristic, but slug came from helper
      const clientId = env[`GMAIL_CLIENT_ID_${slug}`];
      const clientSecret = env[`GMAIL_CLIENT_SECRET_${slug}`];
      const refreshToken = env[key]!;
      if (clientId && clientSecret && refreshToken) {
        entries.push({ email, clientId, clientSecret, refreshToken, slug });
      }
    }
  }
  return entries;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
