#!/usr/bin/env npx tsx
/**
 * Sync attorney emails with FULL body content
 * Extracts actual email text, not just snippets
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ACCOUNTS_PATH = path.resolve(process.cwd(), '.data', 'gmail', 'accounts.json');
const OUTPUT_DIR = path.resolve(process.cwd(), '.data', 'legal', 'attorney_emails');
const ATTACHMENTS_DIR = path.resolve(process.cwd(), '.data', 'legal', 'documents');

interface FullEmail {
  id: string;
  threadId: string;
  date: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  snippet: string;
  labels: string[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    localPath?: string;
  }>;
}

function shortHash(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 12);
}

async function getGmailClient() {
  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
  const acct = accounts[0];

  const oauth2Client = new google.auth.OAuth2(
    acct.client_id,
    acct.client_secret,
    'http://localhost'
  );
  oauth2Client.setCredentials({ refresh_token: acct.refresh_token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function extractBody(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';

  function processPayload(part: any) {
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === 'text/plain') {
        text += decoded;
      } else if (part.mimeType === 'text/html') {
        html += decoded;
      }
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);

  // If no plain text, try to extract from HTML
  if (!text && html) {
    text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { text, html };
}

function extractAttachments(payload: any): Array<{ filename: string; mimeType: string; size: number; attachmentId?: string }> {
  const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId?: string }> = [];

  function processPayload(part: any) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);
  return attachments;
}

async function downloadAttachment(
  gmail: any,
  messageId: string,
  attachmentId: string,
  filename: string
): Promise<string> {
  try {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    const data = attachment.data.data;
    const buffer = Buffer.from(data, 'base64');

    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
    const filePath = path.join(ATTACHMENTS_DIR, `${shortHash(messageId)}_${cleanName}`);

    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (e: any) {
    console.error(`   Failed to download ${filename}: ${e.message}`);
    return '';
  }
}

async function main() {
  console.log('📧 Syncing attorney emails with FULL body content...\n');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

  const gmail = await getGmailClient();

  // Fetch all attorney emails
  const query = 'from:moodybrown.com OR to:moodybrown.com OR from:zstarr@moodybrown.com';
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 500, // Get more emails
  });

  const messageIds = res.data.messages || [];
  console.log(`Found ${messageIds.length} attorney emails\n`);

  const emails: FullEmail[] = [];
  let attachmentCount = 0;

  for (let i = 0; i < messageIds.length; i++) {
    const msg = messageIds[i];
    process.stdout.write(`\rProcessing ${i + 1}/${messageIds.length}...`);

    try {
      // Get FULL email content
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',  // This is the key - get full content!
      });

      const headers = full.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const { text, html } = extractBody(full.data.payload);
      const attachmentMeta = extractAttachments(full.data.payload);

      // Download new attachments
      const attachments = [];
      for (const att of attachmentMeta) {
        let localPath = '';
        if (att.attachmentId && att.filename.match(/\.(pdf|doc|docx|txt|png|jpg|jpeg)$/i)) {
          const expectedPath = path.join(ATTACHMENTS_DIR, `${shortHash(msg.id!)}_${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80)}`);
          if (!fs.existsSync(expectedPath)) {
            localPath = await downloadAttachment(gmail, msg.id!, att.attachmentId, att.filename);
            if (localPath) attachmentCount++;
          } else {
            localPath = expectedPath;
          }
        }
        attachments.push({
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          localPath: localPath || undefined,
        });
      }

      emails.push({
        id: msg.id!,
        threadId: full.data.threadId || '',
        date: getHeader('Date'),
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        body: text,
        bodyHtml: html.length > 0 ? html : undefined,
        snippet: full.data.snippet || '',
        labels: full.data.labelIds || [],
        attachments,
      });

      // Rate limit
      await new Promise(r => setTimeout(r, 50));
    } catch (e: any) {
      console.error(`\n   Error on ${msg.id}: ${e.message}`);
    }
  }

  // Sort by date
  emails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Save full emails
  const outputPath = path.join(OUTPUT_DIR, 'emails_full.json');
  fs.writeFileSync(outputPath, JSON.stringify(emails, null, 2));

  // Also update the timeline version (with body!)
  const timelinePath = path.resolve(process.cwd(), '.data', 'legal', 'timeline', 'attorney_emails.json');
  fs.mkdirSync(path.dirname(timelinePath), { recursive: true });
  fs.writeFileSync(timelinePath, JSON.stringify(emails.map(e => ({
    id: e.id,
    threadId: e.threadId,
    date: new Date(e.date).toISOString(),
    from: e.from,
    to: e.to,
    subject: e.subject,
    body: e.body,
    snippet: e.snippet,
    hasAttachments: e.attachments.length > 0,
    attachments: e.attachments,
  })), null, 2));

  console.log(`\n\n✅ Synced ${emails.length} emails`);
  console.log(`   Downloaded ${attachmentCount} new attachments`);
  console.log(`   Saved to: ${outputPath}`);

  // Show recent emails
  console.log('\n📋 Recent emails:');
  for (const email of emails.slice(-10)) {
    const date = new Date(email.date).toISOString().split('T')[0];
    const bodyPreview = email.body.substring(0, 100).replace(/\n/g, ' ');
    console.log(`   ${date} | ${email.subject.substring(0, 50)}`);
    if (bodyPreview) {
      console.log(`      Body: ${bodyPreview}...`);
    }
  }
}

main().catch(console.error);
