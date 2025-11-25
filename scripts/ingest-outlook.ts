/**
 * Outlook (Microsoft 365) mail + calendar ingestor.
 *
 * Reads refresh tokens from .env.local with keys:
 *   O365_REFRESH_TOKEN_<slug>
 *   O365_EMAIL_<slug> (optional; inferred from slug)
 *
 * Uses tenant/client from:
 *   O365_CLIENT_ID
 *   O365_CLIENT_SECRET
 *   O365_TENANT_ID (default: common)
 *
 * Output:
 *   .data/outlook/<slug>.jsonl   (messages last N days)
 *   .data/ocal/<slug>.jsonl      (events next M days)
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

type Mailbox = {
  slug: string;
  email: string;
  refreshToken: string;
};

const CLIENT_ID = process.env.O365_CLIENT_ID;
const CLIENT_SECRET = process.env.O365_CLIENT_SECRET;
const TENANT = process.env.O365_TENANT_ID || 'common';

const DAYS_BACK = parseInt(process.env.O365_INGEST_DAYS_BACK || '7', 10);
const DAYS_FWD = parseInt(process.env.O365_INGEST_DAYS_FWD || '14', 10);
const MAX_ITEMS = parseInt(process.env.O365_INGEST_MAX || '50', 10);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing O365_CLIENT_ID or O365_CLIENT_SECRET');
  process.exit(1);
}

function findMailboxes(): Mailbox[] {
  const entries: Mailbox[] = [];
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('O365_REFRESH_TOKEN_')) {
      const slug = key.replace('O365_REFRESH_TOKEN_', '');
      const email =
        process.env[`O365_EMAIL_${slug}`] ||
        slug.replace(/_/g, '.').replace(/\.com$/, '.com');
      const refreshToken = process.env[key]!;
      entries.push({ slug, email, refreshToken });
    }
  }
  return entries;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope:
      'offline_access IMAP.AccessAsUser.All SMTP.Send Mail.Read Calendars.ReadWrite openid profile email',
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );
  const data: any = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(
      `Token refresh failed: ${resp.status} ${JSON.stringify(data)}`
    );
  }
  return data.access_token as string;
}

async function fetchJson(url: string, token: string, select?: string) {
  const full =
    select && url.includes('?')
      ? `${url}&$select=${encodeURIComponent(select)}`
      : select
      ? `${url}?$select=${encodeURIComponent(select)}`
      : url;
  const resp = await fetch(full, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  if (!resp.ok)
    throw new Error(`Graph error ${resp.status}: ${JSON.stringify(data)}`);
  return data;
}

async function ingestMailbox(mb: Mailbox) {
  console.log(`\n[outlook] ${mb.email}`);
  const token = await refreshAccessToken(mb.refreshToken);

  // Messages
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString();
  const msgUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${since}&$top=${MAX_ITEMS}&$orderby=receivedDateTime desc`;
  const msgData = await fetchJson(
    msgUrl,
    token,
    'id,subject,from,toRecipients,receivedDateTime,bodyPreview'
  );
  const msgs =
    msgData.value?.map((m: any) => ({
      id: m.id,
      subject: m.subject,
      from: m.from?.emailAddress?.address,
      to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address),
      received: m.receivedDateTime,
      snippet: m.bodyPreview,
    })) || [];
  writeJsonl(path.resolve('.data/outlook', `${mb.slug}.jsonl`), msgs);
  console.log(`  messages: ${msgs.length}`);

  // Events
  const start = new Date().toISOString();
  const end = new Date(Date.now() + DAYS_FWD * 86400000).toISOString();
  const evUrl = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${encodeURIComponent(
    start
  )}&endDateTime=${encodeURIComponent(end)}&$top=${MAX_ITEMS}&$orderby=start/dateTime`;
  const evData = await fetchJson(
    evUrl,
    token,
    'id,subject,start,end,attendees,organizer'
  );
  const events =
    evData.value?.map((e: any) => ({
      id: e.id,
      summary: e.subject,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      attendees: (e.attendees || []).map((a: any) => a.emailAddress?.address),
      organizer: e.organizer?.emailAddress?.address,
    })) || [];
  writeJsonl(path.resolve('.data/ocal', `${mb.slug}.jsonl`), events);
  console.log(`  events: ${events.length}`);
}

function writeJsonl(file: string, rows: any[]) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

async function main() {
  const mbs = findMailboxes();
  if (mbs.length === 0) {
    console.log('No O365 mailboxes found (O365_REFRESH_TOKEN_*).');
    return;
  }
  for (const mb of mbs) {
    try {
      await ingestMailbox(mb);
    } catch (e: any) {
      console.error(`  failed: ${mb.email}: ${e.message || e}`);
    }
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
