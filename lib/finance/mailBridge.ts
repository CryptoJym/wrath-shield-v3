import { google } from 'googleapis';
import { listContextRequests, getTransaction } from './store';
import { applyCommsContext } from './enrich';
import fs from 'fs';
import path from 'path';

// Types
export type Mailbox = {
  slug: string;
  type?: string; // work_ai, legal_finance, personal, etc.
  email?: string;
  provider: 'gmail' | 'o365';
  refreshVar: string; // env var name containing refresh token
};

type GmailCreds = {
  email: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

// Registry loader
function loadMailboxRegistry(): Mailbox[] {
  const p = process.env.MAILBOX_REGISTRY || path.resolve('.data', 'mailboxes.json');
  const fromFile = fs.existsSync(p)
    ? (() => {
        try {
          return JSON.parse(fs.readFileSync(p, 'utf8')) as Mailbox[];
        } catch (_e) {
          return [];
        }
      })()
    : [];

  const derived: Mailbox[] = [];
  Object.entries(process.env)
    .filter(([k]) => k.startsWith('O365_REFRESH_TOKEN_'))
    .forEach(([key, refresh]) => {
      if (!refresh) return;
      const slug = key.replace('O365_REFRESH_TOKEN_', '').toLowerCase();
      derived.push({
        slug,
        provider: 'o365',
        refreshVar: key,
        email: process.env[`O365_EMAIL_${slug}`],
        type: slug.includes('utlyze') ? 'work_ai' : slug.includes('vuplicity') ? 'legal_finance' : undefined,
      });
    });
  Object.entries(process.env)
    .filter(([k]) => k.startsWith('GMAIL_REFRESH_TOKEN_'))
    .forEach(([key, refresh]) => {
      if (!refresh) return;
      const slug = key.replace('GMAIL_REFRESH_TOKEN_', '').toLowerCase();
      derived.push({
        slug,
        provider: 'gmail',
        refreshVar: key,
        email: slug.replace(/_/g, '@'),
        type: slug.includes('jamesbrady') ? 'personal' : undefined,
      });
    });

  const map = new Map<string, Mailbox>();
  [...derived, ...fromFile].forEach((mb) => {
    if (!mb.slug) return;
    map.set(mb.slug, { ...map.get(mb.slug), ...mb });
  });
  return Array.from(map.values());
}

// Gmail helpers
function loadGmailCreds(): GmailCreds[] {
  const base = process.env.GMAIL_ACCOUNTS_JSON || path.resolve('.data', 'gmail', 'accounts.json');
  if (!fs.existsSync(base)) return [];
  try {
    return JSON.parse(fs.readFileSync(base, 'utf8')) as GmailCreds[];
  } catch (_e) {
    return [];
  }
}

async function searchGmail(creds: GmailCreds, query: string) {
  const { clientId, clientSecret, refreshToken } = creds;
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 5 });
  const ids = (res.data.messages?.map((m) => m.id).filter((id): id is string => !!id)) || [];
  const out: { subject?: string; from?: string; snippet?: string; date?: string }[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
    const headers = msg.data.payload?.headers || [];
    const h = (n: string) => headers.find((hh) => hh.name?.toLowerCase() === n.toLowerCase())?.value ?? undefined;
    out.push({ subject: h('Subject'), from: h('From'), date: h('Date'), snippet: msg.data.snippet ?? undefined });
  }
  return out;
}

// Outlook helper (Graph)
let OutlookClient: any = null;
async function searchOutlook(query: string, mailbox?: Mailbox) {
  if (!OutlookClient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      OutlookClient = require('../outlook/client').OutlookClient;
    } catch (_e) {
      return [];
    }
  }
  const client = await OutlookClient.fromEnv(mailbox?.refreshVar);
  if (!client) return [];
  const res = await client.searchMessages(query, 5);
  return res.map((m: any) => ({ subject: m.subject, from: m.from, date: m.dateTimeReceived, snippet: m.preview }));
}

function buildQuery(req: any, txn: any | null) {
  const vendor = req.vendor || txn?.vendor || '';
  const amount = req.amount ?? txn?.amount;
  const date = req.date ?? txn?.date;
  const parts = [];
  if (vendor) parts.push(`"${vendor}"`);
  if (amount) parts.push(amount.toString());
  if (date) parts.push(date);
  return parts.join(' ');
}

function pickMailbox(req: any, txn: any | null, registry: Mailbox[]): Mailbox | null {
  const bucket = (req.bucket || txn?.bucket || '').toLowerCase();
  const project = (req.project || txn?.project || '').toLowerCase();
  const vendor = (req.vendor || txn?.vendor || '').toLowerCase();

  const isWork = bucket.includes('work') || project.includes('work') || vendor.includes('ai') || vendor.includes('openai') || vendor.includes('anthropic');
  const isLegal = bucket.includes('legal') || project.includes('legal') || vendor.includes('moody') || vendor.includes('legal');

  if (isWork) {
    const mb = registry.find((m) => m.type === 'work_ai');
    if (mb) return mb;
  }
  if (isLegal) {
    const mb = registry.find((m) => m.type === 'legal_finance');
    if (mb) return mb;
  }
  return (
    registry.find((m) => m.type === 'work_ai') ||
    registry.find((m) => m.type === 'legal_finance') ||
    registry.find((m) => m.type === 'personal') ||
    registry[0] ||
    null
  );
}

export async function resolveViaMail(limit = 5, userId?: string) {
  const pending = listContextRequests('pending', userId).slice(0, limit);
  const gmailCreds = loadGmailCreds();
  const registry = loadMailboxRegistry();
  const results: any[] = [];

  for (const req of pending) {
    const txn = req.txn_id ? getTransaction(req.txn_id) : null;
    const q = buildQuery(req, txn);
    const mailbox = pickMailbox(req, txn, registry);
    let hits: any[] = [];

    const tryGmail = async () => {
      for (const creds of gmailCreds) {
        try {
          hits = await searchGmail(creds, q);
          if (hits.length) break;
        } catch (_e) {
          // continue
        }
      }
    };
    const tryOutlook = async () => {
      try {
        hits = await searchOutlook(q, mailbox ?? undefined);
      } catch (_e) {
        // ignore
      }
    };

    if (mailbox?.provider === 'o365') {
      await tryOutlook();
      if (!hits.length) await tryGmail();
    } else {
      await tryGmail();
      if (!hits.length) await tryOutlook();
    }

    if (!hits.length) {
      results.push({ id: req.id, found: false });
      continue;
    }
    const top = hits[0];
    const summary = `Mail hit: ${top.subject || 'unknown'} / ${top.from || ''} / ${top.date || ''}`;
    const confidence = 0.65;
    const updated = applyCommsContext(req.id, {
      id: req.id,
      summary,
      confidence,
      bucket: req.bucket,
      project: req.project,
      reimbursable: req.reimbursable,
      note: top.snippet,
      rationale: req.rationale,
    });
    results.push({ id: req.id, found: true, summary: updated?.summary });
  }
  return results;
}
