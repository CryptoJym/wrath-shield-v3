/**
 * Scrape and extract content from all legal documents
 * - Downloads email attachments (PDFs, DOCs)
 * - Extracts text content
 * - Stores in database with proper metadata
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// Helper to create short, unique IDs
function shortHash(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex').substring(0, 12);
}

const ACCOUNTS_PATH = path.resolve(process.cwd(), '.data', 'gmail', 'accounts.json');
const ATTACHMENTS_DIR = path.resolve(process.cwd(), '.data', 'legal', 'documents');
const EXTRACTED_DIR = path.resolve(process.cwd(), '.data', 'legal', 'extracted');

interface DocumentRecord {
  id: string;
  emailId: string;
  emailDate: Date;
  emailSubject: string;
  filename: string;
  filePath: string;
  mimeType: string;
  size: number;
  extractedText?: string;
  category: 'order' | 'motion' | 'affidavit' | 'notice' | 'correspondence' | 'other';
  parties?: string[];
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

function categorizeDocument(filename: string, subject: string): DocumentRecord['category'] {
  const lower = (filename + ' ' + subject).toLowerCase();
  if (lower.includes('order')) return 'order';
  if (lower.includes('motion')) return 'motion';
  if (lower.includes('affidavit')) return 'affidavit';
  if (lower.includes('notice')) return 'notice';
  if (lower.includes('petition')) return 'motion';
  if (lower.includes('response') || lower.includes('reply')) return 'correspondence';
  return 'other';
}

async function downloadAttachment(
  gmail: any,
  messageId: string,
  attachmentId: string,
  filename: string
): Promise<string> {
  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  const data = attachment.data.data;
  const buffer = Buffer.from(data, 'base64');

  // Clean filename - use short hash to avoid ENAMETOOLONG
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
  const filePath = path.join(ATTACHMENTS_DIR, `${shortHash(messageId)}_${cleanName}`);

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function extractPDFText(filePath: string): Promise<string> {
  try {
    // Try using pdftotext (poppler-utils) if available
    const output = execSync(`pdftotext -layout "${filePath}" -`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
    return output;
  } catch (e) {
    // Fallback: try basic extraction
    try {
      const buffer = fs.readFileSync(filePath);
      // Basic text extraction from PDF
      const text = buffer.toString('utf8');
      const matches = text.match(/\/Contents\s*\((.*?)\)/gs) || [];
      return matches.join('\n').substring(0, 50000);
    } catch {
      return '[PDF text extraction failed]';
    }
  }
}

async function fetchEmailsWithAttachments(): Promise<DocumentRecord[]> {
  console.log('📧 Fetching emails with attachments from attorney...');
  const gmail = await getGmailClient();
  const documents: DocumentRecord[] = [];

  // Search for emails with attachments from Moody Brown
  const query = '(from:moodybrown.com OR to:moodybrown.com) has:attachment';
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100,
  });

  const messageIds = res.data.messages || [];
  console.log(`   Found ${messageIds.length} emails with attachments`);

  for (const msg of messageIds) {
    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });

      const headers = full.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const emailDate = new Date(getHeader('Date'));
      const emailSubject = getHeader('Subject');
      const from = getHeader('From');

      // Find attachments in parts
      const parts = full.data.payload?.parts || [];
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          const filename = part.filename;
          const mimeType = part.mimeType || 'application/octet-stream';

          // Only process PDFs and common document types
          if (!filename.match(/\.(pdf|doc|docx|txt)$/i)) continue;

          console.log(`   📄 ${filename}`);

          const filePath = await downloadAttachment(
            gmail,
            msg.id!,
            part.body.attachmentId,
            filename
          );

          let extractedText = '';
          if (filename.toLowerCase().endsWith('.pdf')) {
            extractedText = await extractPDFText(filePath);
          } else if (filename.toLowerCase().endsWith('.txt')) {
            extractedText = fs.readFileSync(filePath, 'utf8');
          }

          documents.push({
            id: `${msg.id}_${part.body.attachmentId}`,
            emailId: msg.id!,
            emailDate,
            emailSubject,
            filename,
            filePath,
            mimeType,
            size: part.body.size || 0,
            extractedText: extractedText.substring(0, 100000), // Limit size
            category: categorizeDocument(filename, emailSubject),
            parties: [from],
          });
        }
      }
    } catch (err: any) {
      console.error(`   Error processing ${msg.id}: ${err.message}`);
    }
  }

  return documents;
}

async function saveDocuments(documents: DocumentRecord[]) {
  // Save document index
  const indexPath = path.join(EXTRACTED_DIR, 'document_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(documents.map(d => ({
    ...d,
    extractedText: d.extractedText ? `[${d.extractedText.length} chars]` : null,
  })), null, 2));

  // Save each document's extracted text
  for (const doc of documents) {
    if (doc.extractedText && doc.extractedText.length > 100) {
      // Use short hash + sanitized filename to avoid ENAMETOOLONG
      const safeFilename = doc.filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
      const textPath = path.join(EXTRACTED_DIR, `${shortHash(doc.id)}_${safeFilename}.txt`);
      fs.writeFileSync(textPath, `
=== DOCUMENT METADATA ===
Filename: ${doc.filename}
Email Date: ${doc.emailDate.toISOString()}
Email Subject: ${doc.emailSubject}
Category: ${doc.category}
File Path: ${doc.filePath}
========================

${doc.extractedText}
      `.trim());
    }
  }

  // Generate markdown summary
  const md = generateDocumentSummary(documents);
  fs.writeFileSync(path.join(EXTRACTED_DIR, 'DOCUMENTS_INDEX.md'), md);
}

function generateDocumentSummary(documents: DocumentRecord[]): string {
  let md = `# Legal Documents Index\n`;
  md += `Case: 164400524 - Brady v. Brady\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary\n`;
  md += `- Total Documents: ${documents.length}\n`;
  md += `- With Extracted Text: ${documents.filter(d => d.extractedText && d.extractedText.length > 100).length}\n\n`;

  // Group by category
  const byCategory = new Map<string, DocumentRecord[]>();
  for (const doc of documents) {
    if (!byCategory.has(doc.category)) byCategory.set(doc.category, []);
    byCategory.get(doc.category)!.push(doc);
  }

  for (const [category, docs] of byCategory) {
    md += `## ${category.toUpperCase()} (${docs.length})\n\n`;
    md += `| Date | Filename | Subject | Size |\n`;
    md += `|------|----------|---------|------|\n`;
    for (const doc of docs.sort((a, b) => b.emailDate.getTime() - a.emailDate.getTime())) {
      md += `| ${doc.emailDate.toISOString().split('T')[0]} | ${doc.filename.substring(0, 30)} | ${doc.emailSubject.substring(0, 40)} | ${Math.round(doc.size / 1024)}KB |\n`;
    }
    md += `\n`;
  }

  return md;
}

async function storeInZepMemory(documents: DocumentRecord[]) {
  const ZEP_API_KEY = process.env.ZEP_API_KEY;
  if (!ZEP_API_KEY) {
    console.log('   No ZEP_API_KEY - skipping Zep storage');
    return;
  }

  const sessionId = 'legal-case-164400524';

  // Store document content summaries
  const orders = documents.filter(d => d.category === 'order' && d.extractedText);
  const motions = documents.filter(d => d.category === 'motion' && d.extractedText);

  for (const doc of [...orders, ...motions]) {
    const content = `LEGAL DOCUMENT: ${doc.filename}
Date: ${doc.emailDate.toISOString().split('T')[0]}
Category: ${doc.category.toUpperCase()}
Subject: ${doc.emailSubject}

CONTENT:
${doc.extractedText?.substring(0, 5000)}`;

    try {
      await fetch(`https://api.getzep.com/api/v2/sessions/${sessionId}/memory`, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${ZEP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{
            role: 'system',
            content,
            metadata: { type: 'legal_document', category: doc.category, filename: doc.filename }
          }]
        })
      });
    } catch (e) {
      // Continue on error
    }
  }

  console.log(`   Stored ${orders.length + motions.length} documents in Zep memory`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  LEGAL DOCUMENT SCRAPER');
  console.log('  Downloading and extracting all court documents');
  console.log('═══════════════════════════════════════════════════════\n');

  // Create directories
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  fs.mkdirSync(EXTRACTED_DIR, { recursive: true });

  // Fetch and download attachments
  const documents = await fetchEmailsWithAttachments();

  console.log(`\n📊 Document Summary:`);
  console.log(`   Total downloaded: ${documents.length}`);
  console.log(`   Orders: ${documents.filter(d => d.category === 'order').length}`);
  console.log(`   Motions: ${documents.filter(d => d.category === 'motion').length}`);
  console.log(`   Other: ${documents.filter(d => !['order', 'motion'].includes(d.category)).length}`);

  // Save documents
  console.log('\n💾 Saving documents...');
  await saveDocuments(documents);

  // Store in Zep
  console.log('\n🧠 Storing in Zep memory...');
  await storeInZepMemory(documents);

  console.log(`\n✅ Documents saved to:`);
  console.log(`   ${ATTACHMENTS_DIR}`);
  console.log(`   ${EXTRACTED_DIR}`);
}

main().catch(console.error);
