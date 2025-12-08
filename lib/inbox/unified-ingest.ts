/**
 * Unified Ingest Module
 *
 * Provides programmatic access to Gmail and Outlook ingestion logic.
 * Can be used from API routes (serverless) or scripts.
 *
 * In development: reads/writes to .data/ directory
 * In production: uses streaming or temp directories (Vercel has /tmp)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import type { EventRow } from '@/lib/events';

// ============================================================================
// Types
// ============================================================================

export interface GmailMailboxCreds {
  email: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  slug: string;
}

export interface OutlookMailboxCreds {
  slug: string;
  email: string;
  refreshToken: string;
}

export interface RawGmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
}

export interface RawOutlookMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  received: string;
  snippet: string;
}

export interface IngestResult {
  source: 'gmail' | 'outlook';
  mailbox: string;
  messagesIngested: number;
  eventsCreated: number;
  errors: string[];
}

export interface UnifiedIngestSummary {
  startedAt: number;
  completedAt: number;
  gmail: IngestResult[];
  outlook: IngestResult[];
  totalMessages: number;
  totalEvents: number;
  errors: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const MAX_EMAILS = parseInt(process.env.GMAIL_INGEST_MAX_EMAILS || '40', 10);
const DAYS_BACK = parseInt(process.env.GMAIL_INGEST_DAYS_BACK || '7', 10);
const O365_DAYS_BACK = parseInt(process.env.O365_INGEST_DAYS_BACK || '7', 10);
const O365_MAX_ITEMS = parseInt(process.env.O365_INGEST_MAX || '50', 10);

// Use tmp directory in production (Vercel), .data in dev
function getDataDir(): string {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), 'wrath-shield-ingest');
  }
  return path.resolve(process.cwd(), '.data');
}

// ============================================================================
// Gmail Ingestion
// ============================================================================

/**
 * Load Gmail mailbox credentials from environment variables
 */
export function loadGmailMailboxCreds(): GmailMailboxCreds[] {
  const env = process.env;
  const entries: GmailMailboxCreds[] = [];

  for (const key of Object.keys(env)) {
    if (key.startsWith('GMAIL_REFRESH_TOKEN_')) {
      const slug = key.replace('GMAIL_REFRESH_TOKEN_', '');
      const email = slug.replace(/_/g, '.').replace(/\.com$/, '.com');
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

/**
 * Ingest messages from a single Gmail mailbox
 * Returns raw messages (not yet normalized to EventRow)
 */
export async function ingestGmailMailbox(
  mb: GmailMailboxCreds,
  options?: { maxEmails?: number; daysBack?: number }
): Promise<{ messages: RawGmailMessage[]; error?: string }> {
  const maxEmails = options?.maxEmails ?? MAX_EMAILS;
  const daysBack = options?.daysBack ?? DAYS_BACK;

  try {
    const auth = new google.auth.OAuth2(mb.clientId, mb.clientSecret, 'http://localhost');
    auth.setCredentials({ refresh_token: mb.refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const newerThan = `newer_than:${daysBack}d`;
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox ${newerThan}`,
      maxResults: maxEmails,
    });

    const ids = res.data.messages?.map((m: any) => m.id) || [];
    const messages: RawGmailMessage[] = [];

    for (const id of ids) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'To', 'Date'],
      });

      const headers = msg.data.payload?.headers || [];
      const h = keyBy(headers, 'name');

      messages.push({
        id: id!,
        subject: h['Subject']?.value || '',
        from: h['From']?.value || '',
        to: h['To']?.value || '',
        date: h['Date']?.value || String(msg.data.internalDate),
        snippet: msg.data.snippet || '',
      });
    }

    return { messages };
  } catch (error: any) {
    return {
      messages: [],
      error: `Gmail ingest error for ${mb.email}: ${error?.message || String(error)}`,
    };
  }
}

/**
 * Ingest all Gmail mailboxes configured in environment
 */
export async function ingestAllGmail(options?: {
  maxEmails?: number;
  daysBack?: number;
  writeJsonl?: boolean;
}): Promise<{ results: IngestResult[]; allMessages: RawGmailMessage[] }> {
  const mailboxes = loadGmailMailboxCreds();
  const results: IngestResult[] = [];
  const allMessages: RawGmailMessage[] = [];

  for (const mb of mailboxes) {
    const result: IngestResult = {
      source: 'gmail',
      mailbox: mb.email,
      messagesIngested: 0,
      eventsCreated: 0,
      errors: [],
    };

    const { messages, error } = await ingestGmailMailbox(mb, options);

    if (error) {
      result.errors.push(error);
    } else {
      result.messagesIngested = messages.length;
      allMessages.push(...messages);

      // Optionally write JSONL for debugging/persistence
      if (options?.writeJsonl !== false) {
        try {
          writeJsonl(path.join(getDataDir(), 'gmail', `${mb.slug}.jsonl`), messages);
        } catch (e: any) {
          result.errors.push(`Failed to write JSONL: ${e?.message || String(e)}`);
        }
      }
    }

    results.push(result);
  }

  return { results, allMessages };
}

// ============================================================================
// Outlook Ingestion
// ============================================================================

const O365_CLIENT_ID = process.env.O365_CLIENT_ID;
const O365_CLIENT_SECRET = process.env.O365_CLIENT_SECRET;
const O365_TENANT = process.env.O365_TENANT_ID || 'common';

/**
 * Load Outlook mailbox credentials from environment variables
 */
export function loadOutlookMailboxCreds(): OutlookMailboxCreds[] {
  const entries: OutlookMailboxCreds[] = [];

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('O365_REFRESH_TOKEN_')) {
      const slug = key.replace('O365_REFRESH_TOKEN_', '');
      const email =
        process.env[`O365_EMAIL_${slug}`] || slug.replace(/_/g, '.').replace(/\.com$/, '.com');
      const refreshToken = process.env[key]!;
      entries.push({ slug, email, refreshToken });
    }
  }

  return entries;
}

/**
 * Refresh Outlook access token
 */
async function refreshOutlookToken(refreshToken: string): Promise<string> {
  if (!O365_CLIENT_ID || !O365_CLIENT_SECRET) {
    throw new Error('Missing O365_CLIENT_ID or O365_CLIENT_SECRET');
  }

  const params = new URLSearchParams({
    client_id: O365_CLIENT_ID,
    client_secret: O365_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope:
      'offline_access IMAP.AccessAsUser.All SMTP.Send Mail.Read Calendars.ReadWrite openid profile email',
  });

  const resp = await fetch(
    `https://login.microsoftonline.com/${O365_TENANT}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  const data: any = await resp.json();

  if (!resp.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${resp.status} ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

/**
 * Fetch JSON from Microsoft Graph API
 */
async function fetchGraphJson(url: string, token: string, select?: string): Promise<any> {
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

  if (!resp.ok) {
    throw new Error(`Graph error ${resp.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Ingest messages from a single Outlook mailbox
 */
export async function ingestOutlookMailbox(
  mb: OutlookMailboxCreds,
  options?: { maxItems?: number; daysBack?: number }
): Promise<{ messages: RawOutlookMessage[]; error?: string }> {
  const maxItems = options?.maxItems ?? O365_MAX_ITEMS;
  const daysBack = options?.daysBack ?? O365_DAYS_BACK;

  try {
    const token = await refreshOutlookToken(mb.refreshToken);

    const since = new Date(Date.now() - daysBack * 86400000).toISOString();
    const msgUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${since}&$top=${maxItems}&$orderby=receivedDateTime desc`;

    const msgData = await fetchGraphJson(
      msgUrl,
      token,
      'id,subject,from,toRecipients,receivedDateTime,bodyPreview'
    );

    const messages: RawOutlookMessage[] =
      msgData.value?.map((m: any) => ({
        id: m.id,
        subject: m.subject,
        from: m.from?.emailAddress?.address || '',
        to: (m.toRecipients || []).map((r: any) => r.emailAddress?.address),
        received: m.receivedDateTime,
        snippet: m.bodyPreview,
      })) || [];

    return { messages };
  } catch (error: any) {
    return {
      messages: [],
      error: `Outlook ingest error for ${mb.email}: ${error?.message || String(error)}`,
    };
  }
}

/**
 * Ingest all Outlook mailboxes configured in environment
 */
export async function ingestAllOutlook(options?: {
  maxItems?: number;
  daysBack?: number;
  writeJsonl?: boolean;
}): Promise<{ results: IngestResult[]; allMessages: RawOutlookMessage[] }> {
  const mailboxes = loadOutlookMailboxCreds();
  const results: IngestResult[] = [];
  const allMessages: RawOutlookMessage[] = [];

  // Skip if O365 credentials are not configured
  if (!O365_CLIENT_ID || !O365_CLIENT_SECRET) {
    return { results, allMessages };
  }

  for (const mb of mailboxes) {
    const result: IngestResult = {
      source: 'outlook',
      mailbox: mb.email,
      messagesIngested: 0,
      eventsCreated: 0,
      errors: [],
    };

    const { messages, error } = await ingestOutlookMailbox(mb, options);

    if (error) {
      result.errors.push(error);
    } else {
      result.messagesIngested = messages.length;
      allMessages.push(...messages);

      // Optionally write JSONL for debugging/persistence
      if (options?.writeJsonl !== false) {
        try {
          writeJsonl(path.join(getDataDir(), 'outlook', `${mb.slug}.jsonl`), messages);
        } catch (e: any) {
          result.errors.push(`Failed to write JSONL: ${e?.message || String(e)}`);
        }
      }
    }

    results.push(result);
  }

  return { results, allMessages };
}

// ============================================================================
// Normalization to EventRow
// ============================================================================

/**
 * Convert a raw Gmail message to an EventRow (CommsEvent)
 */
export function normalizeGmailToEvent(msg: RawGmailMessage, mailbox: string): EventRow {
  // Parse date - Gmail dates are typically RFC 2822 format
  let ts: number;
  try {
    ts = Math.floor(new Date(msg.date).getTime() / 1000);
    if (isNaN(ts)) {
      ts = Math.floor(Date.now() / 1000);
    }
  } catch {
    ts = Math.floor(Date.now() / 1000);
  }

  // Extract sender email from "Name <email@domain.com>" format
  const fromMatch = msg.from.match(/<([^>]+)>/) || [null, msg.from];
  const senderEmail = fromMatch[1] || msg.from;

  return {
    id: `gmail_${msg.id}`,
    source: 'gmail',
    channel: 'email',
    direction: 'inbound',
    contact: senderEmail,
    ts,
    subject: msg.subject,
    preview: msg.snippet,
    metadata: {
      raw_id: msg.id,
      mailbox,
      from_full: msg.from,
      to: msg.to,
    },
  };
}

/**
 * Convert a raw Outlook message to an EventRow (CommsEvent)
 */
export function normalizeOutlookToEvent(msg: RawOutlookMessage, mailbox: string): EventRow {
  let ts: number;
  try {
    ts = Math.floor(new Date(msg.received).getTime() / 1000);
    if (isNaN(ts)) {
      ts = Math.floor(Date.now() / 1000);
    }
  } catch {
    ts = Math.floor(Date.now() / 1000);
  }

  return {
    id: `outlook_${msg.id}`,
    source: 'outlook',
    channel: 'email',
    direction: 'inbound',
    contact: msg.from,
    ts,
    subject: msg.subject,
    preview: msg.snippet,
    metadata: {
      raw_id: msg.id,
      mailbox,
      to: msg.to,
    },
  };
}

// ============================================================================
// Read from existing JSONL files (for dev mode or re-processing)
// ============================================================================

/**
 * Read all Gmail JSONL files from .data/gmail/
 */
export function readGmailJsonlFiles(): { messages: RawGmailMessage[]; mailboxes: string[] } {
  const gmailDir = path.join(getDataDir(), 'gmail');
  const messages: RawGmailMessage[] = [];
  const mailboxes: string[] = [];

  if (!fs.existsSync(gmailDir)) {
    return { messages, mailboxes };
  }

  const files = fs.readdirSync(gmailDir).filter((f) => f.endsWith('.jsonl'));

  for (const file of files) {
    const slug = file.replace('.jsonl', '');
    mailboxes.push(slug);

    const content = fs.readFileSync(path.join(gmailDir, file), 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line) as RawGmailMessage);
      } catch {
        // Skip malformed lines
      }
    }
  }

  return { messages, mailboxes };
}

/**
 * Read all Outlook JSONL files from .data/outlook/
 */
export function readOutlookJsonlFiles(): { messages: RawOutlookMessage[]; mailboxes: string[] } {
  const outlookDir = path.join(getDataDir(), 'outlook');
  const messages: RawOutlookMessage[] = [];
  const mailboxes: string[] = [];

  if (!fs.existsSync(outlookDir)) {
    return { messages, mailboxes };
  }

  const files = fs.readdirSync(outlookDir).filter((f) => f.endsWith('.jsonl'));

  for (const file of files) {
    const slug = file.replace('.jsonl', '');
    mailboxes.push(slug);

    const content = fs.readFileSync(path.join(outlookDir, file), 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line) as RawOutlookMessage);
      } catch {
        // Skip malformed lines
      }
    }
  }

  return { messages, mailboxes };
}

// ============================================================================
// Unified Ingest Flow
// ============================================================================

/**
 * Full unified ingest: fetch from all sources, normalize, return EventRows
 *
 * @param options.fetchFresh - If true, fetches new data from APIs. If false, reads from JSONL files.
 * @param options.writeJsonl - If true, writes fetched data to JSONL files (dev mode)
 */
export async function unifiedIngest(options?: {
  fetchFresh?: boolean;
  writeJsonl?: boolean;
  gmailOptions?: { maxEmails?: number; daysBack?: number };
  outlookOptions?: { maxItems?: number; daysBack?: number };
}): Promise<{ events: EventRow[]; summary: UnifiedIngestSummary }> {
  const startedAt = Date.now();
  const events: EventRow[] = [];
  const summary: UnifiedIngestSummary = {
    startedAt,
    completedAt: 0,
    gmail: [],
    outlook: [],
    totalMessages: 0,
    totalEvents: 0,
    errors: [],
  };

  const fetchFresh = options?.fetchFresh ?? true;
  const writeJsonl = options?.writeJsonl ?? (process.env.NODE_ENV !== 'production');

  if (fetchFresh) {
    // Fetch fresh data from APIs
    const gmailResult = await ingestAllGmail({
      ...options?.gmailOptions,
      writeJsonl,
    });
    summary.gmail = gmailResult.results;

    // Normalize Gmail messages
    for (const result of gmailResult.results) {
      for (const msg of gmailResult.allMessages) {
        const event = normalizeGmailToEvent(msg, result.mailbox);
        events.push(event);
        result.eventsCreated++;
      }
    }

    const outlookResult = await ingestAllOutlook({
      ...options?.outlookOptions,
      writeJsonl,
    });
    summary.outlook = outlookResult.results;

    // Normalize Outlook messages
    for (const result of outlookResult.results) {
      for (const msg of outlookResult.allMessages) {
        const event = normalizeOutlookToEvent(msg, result.mailbox);
        events.push(event);
        result.eventsCreated++;
      }
    }
  } else {
    // Read from existing JSONL files
    const { messages: gmailMessages, mailboxes: gmailMailboxes } = readGmailJsonlFiles();
    for (let i = 0; i < gmailMailboxes.length; i++) {
      const mailbox = gmailMailboxes[i];
      summary.gmail.push({
        source: 'gmail',
        mailbox,
        messagesIngested: 0,
        eventsCreated: 0,
        errors: [],
      });
    }

    for (const msg of gmailMessages) {
      const event = normalizeGmailToEvent(msg, 'unknown');
      events.push(event);
    }

    if (summary.gmail.length > 0) {
      summary.gmail[0].messagesIngested = gmailMessages.length;
      summary.gmail[0].eventsCreated = gmailMessages.length;
    }

    const { messages: outlookMessages, mailboxes: outlookMailboxes } = readOutlookJsonlFiles();
    for (let i = 0; i < outlookMailboxes.length; i++) {
      const mailbox = outlookMailboxes[i];
      summary.outlook.push({
        source: 'outlook',
        mailbox,
        messagesIngested: 0,
        eventsCreated: 0,
        errors: [],
      });
    }

    for (const msg of outlookMessages) {
      const event = normalizeOutlookToEvent(msg, 'unknown');
      events.push(event);
    }

    if (summary.outlook.length > 0) {
      summary.outlook[0].messagesIngested = outlookMessages.length;
      summary.outlook[0].eventsCreated = outlookMessages.length;
    }
  }

  // Aggregate totals
  summary.totalMessages =
    summary.gmail.reduce((sum, r) => sum + r.messagesIngested, 0) +
    summary.outlook.reduce((sum, r) => sum + r.messagesIngested, 0);
  summary.totalEvents = events.length;
  summary.completedAt = Date.now();

  // Collect all errors
  for (const r of [...summary.gmail, ...summary.outlook]) {
    summary.errors.push(...r.errors);
  }

  return { events, summary };
}

// ============================================================================
// Helpers
// ============================================================================

function keyBy(arr: any[], key: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const item of arr) {
    out[item[key]] = item;
  }
  return out;
}

function writeJsonl(file: string, rows: any[]): void {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}
