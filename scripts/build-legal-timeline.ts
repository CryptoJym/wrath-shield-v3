/**
 * Build Master Legal Timeline - Paralegal-grade case file organization
 *
 * Extracts and organizes:
 * - Attorney emails with actual dates
 * - Court filings and orders (PDF content)
 * - Evidence items with citations
 * - Key deadlines and dates
 *
 * Stores in Zep memory for temporal reasoning
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

const ACCOUNTS_PATH = path.resolve(process.cwd(), '.data', 'gmail', 'accounts.json');
const ATTACHMENTS_DIR = path.resolve(process.cwd(), 'gmail_attachments');
const CONTEXT_MEMO = path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'analysis', 'context_memo.md');

const ZEP_API_KEY = process.env.ZEP_API_KEY || '';
const ZEP_API_URL = 'https://api.getzep.com';

const CASE_NUMBER = '164400524';
const CASE_NAME = 'Brady v. Brady';

interface EmailRecord {
  id: string;
  date: Date;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  hasAttachments: boolean;
  labels: string[];
}

interface CourtFiling {
  title: string;
  date: Date;
  type: 'order' | 'motion' | 'response' | 'affidavit' | 'notice' | 'stipulation';
  signedBy?: string;
  summary: string;
  filePath?: string;
}

interface TimelineEvent {
  date: Date;
  category: 'filing' | 'email' | 'event' | 'deadline' | 'violation';
  title: string;
  description: string;
  source: string;
  parties?: string[];
  attachments?: string[];
}

// ============ Gmail Functions ============

async function getGmailClient() {
  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
  const acct = accounts[0]; // Primary account

  const oauth2Client = new google.auth.OAuth2(
    acct.client_id,
    acct.client_secret,
    'http://localhost'
  );
  oauth2Client.setCredentials({ refresh_token: acct.refresh_token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function fetchAttorneyEmails(): Promise<EmailRecord[]> {
  console.log('📧 Fetching attorney emails with full metadata...');
  const gmail = await getGmailClient();

  const query = 'from:moodybrown.com OR to:moodybrown.com OR from:zstarr@moodybrown.com';
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 200
  });

  const emails: EmailRecord[] = [];
  const messageIds = res.data.messages || [];

  console.log(`   Found ${messageIds.length} attorney emails`);

  for (const msg of messageIds) {
    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'To', 'Date']
    });

    const headers = full.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const dateStr = getHeader('Date');
    const date = new Date(dateStr);

    emails.push({
      id: msg.id!,
      date,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      snippet: full.data.snippet || '',
      hasAttachments: (full.data.payload?.parts || []).some(p => p.filename),
      labels: full.data.labelIds || []
    });
  }

  // Sort by date
  emails.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log(`   Oldest: ${emails[0]?.date.toISOString()}`);
  console.log(`   Newest: ${emails[emails.length-1]?.date.toISOString()}`);

  return emails;
}

// ============ PDF Extraction ============

async function extractPDFContent(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (e: any) {
    console.error(`   Failed to parse ${filePath}: ${e.message}`);
    return '';
  }
}

async function processCourtOrders(): Promise<CourtFiling[]> {
  console.log('📄 Processing court order PDFs...');
  const filings: CourtFiling[] = [];

  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    console.log('   No attachments directory found');
    return filings;
  }

  const files = fs.readdirSync(ATTACHMENTS_DIR).filter(f =>
    f.toLowerCase().endsWith('.pdf')
  );

  for (const file of files) {
    const filePath = path.join(ATTACHMENTS_DIR, file);
    console.log(`   Processing: ${file}`);

    const content = await extractPDFContent(filePath);

    // Extract date from filename or content
    const dateMatch = file.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    let date = new Date();
    if (dateMatch) {
      date = new Date(`${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`);
    }

    // Determine type from filename/content
    let type: CourtFiling['type'] = 'order';
    const lowerFile = file.toLowerCase();
    if (lowerFile.includes('motion')) type = 'motion';
    else if (lowerFile.includes('affidavit')) type = 'affidavit';
    else if (lowerFile.includes('notice')) type = 'notice';
    else if (lowerFile.includes('response')) type = 'response';
    else if (lowerFile.includes('stipulation')) type = 'stipulation';

    // Extract signer from content
    let signedBy: string | undefined;
    if (content.includes('Commissioner')) {
      const commMatch = content.match(/Commissioner\s+([A-Za-z\s]+)/);
      signedBy = commMatch ? commMatch[1].trim() : undefined;
    }
    if (content.includes('Judge')) {
      const judgeMatch = content.match(/Judge\s+([A-Za-z\s]+)/);
      signedBy = signedBy ? `${signedBy}, ${judgeMatch?.[1]?.trim()}` : judgeMatch?.[1]?.trim();
    }

    filings.push({
      title: file.replace(/_/g, ' ').replace('.pdf', '').replace('.PDF', ''),
      date,
      type,
      signedBy,
      summary: content.substring(0, 1000),
      filePath
    });
  }

  return filings;
}

// ============ Timeline Builder ============

function buildMasterTimeline(
  emails: EmailRecord[],
  filings: CourtFiling[]
): TimelineEvent[] {
  console.log('📅 Building master timeline...');
  const events: TimelineEvent[] = [];

  // Add emails
  for (const email of emails) {
    events.push({
      date: email.date,
      category: 'email',
      title: email.subject,
      description: email.snippet,
      source: `Gmail: ${email.from}`,
      parties: [email.from, email.to].filter(Boolean),
      attachments: email.hasAttachments ? ['(has attachments)'] : undefined
    });
  }

  // Add filings
  for (const filing of filings) {
    events.push({
      date: filing.date,
      category: 'filing',
      title: filing.title,
      description: `${filing.type.toUpperCase()}${filing.signedBy ? ` - Signed by: ${filing.signedBy}` : ''}`,
      source: filing.filePath || 'Court filing',
      attachments: filing.filePath ? [filing.filePath] : undefined
    });
  }

  // Add known case events from context memo
  const keyEvents: TimelineEvent[] = [
    { date: new Date('2025-06-24'), category: 'event', title: 'Stipulation Signed', description: 'Parties stipulated to new order in open court', source: 'Context Memo' },
    { date: new Date('2025-07-04'), category: 'violation', title: 'July 4 Holiday Denied', description: 'Mother refused Father court-ordered holiday parent-time', source: 'Motion to Enforce' },
    { date: new Date('2025-07-07'), category: 'violation', title: 'Late Drop-off #1', description: 'Nearly 2 hours late (5:52pm instead of 4pm)', source: 'Motion to Enforce' },
    { date: new Date('2025-07-11'), category: 'violation', title: 'Late Drop-off #2', description: '1 hour late (5pm instead of 4pm)', source: 'Motion to Enforce' },
    { date: new Date('2025-07-14'), category: 'filing', title: 'Order of Modification Entered', description: 'Court order based on June 24 stipulation', source: 'Court Record' },
    { date: new Date('2025-07-28'), category: 'filing', title: 'Motion to Enforce Filed', description: 'Zack files verified ex parte motion documenting violations', source: 'Court Record' },
    { date: new Date('2025-08-15'), category: 'event', title: 'Canyon Grove Enrollment', description: 'Mother enrolls child in school without consulting Father', source: 'Text Messages' },
    { date: new Date('2025-09-12'), category: 'filing', title: 'Notice of Intent to Relocate', description: 'Mother files relocation notice via court', source: 'Court Record' },
    { date: new Date('2025-09-17'), category: 'filing', title: 'Objection to Relocation', description: 'Zack files objection citing Ross v. Ross and statutory violations', source: 'Court Record' },
    { date: new Date('2025-10-01'), category: 'filing', title: "Mother's Affidavit", description: 'Contains material misrepresentations about school', source: 'Court Record' },
    { date: new Date('2025-10-21'), category: 'event', title: 'Relocation Hearing', description: 'Commissioner rules: if Mother relocates, custody transfers to Father', source: 'Hearing' },
    { date: new Date('2025-10-28'), category: 'filing', title: 'Order Signed - Commissioner Ito', description: 'October 21 ruling formalized', source: 'Court Order' },
    { date: new Date('2025-10-30'), category: 'filing', title: 'Order Signed - Judge Pullan', description: 'Final signature on relocation order', source: 'Court Order' },
    { date: new Date('2025-11-17'), category: 'event', title: 'Physical Custody Transfer', description: 'Mother transferred Hyro to Father\'s care - per email "She transferred my son to my care"', source: 'Email to Attorney (Nov 17, 2025)' },
  ];

  events.push(...keyEvents);

  // Sort all by date
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return events;
}

// ============ Zep Memory Storage ============

async function storeInZepMemory(timeline: TimelineEvent[], emails: EmailRecord[], filings: CourtFiling[]) {
  console.log('🧠 Storing in Zep memory...');

  if (!ZEP_API_KEY) {
    console.log('   No ZEP_API_KEY - skipping Zep storage');
    return;
  }

  const sessionId = `legal-case-${CASE_NUMBER}`;

  // Create session if needed
  try {
    await fetch(`${ZEP_API_URL}/api/v2/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${ZEP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        metadata: {
          case_number: CASE_NUMBER,
          case_name: CASE_NAME,
          type: 'legal_case_file'
        }
      })
    });
  } catch (e) {
    // Session may already exist
  }

  // Store timeline as memories
  const memories = [];

  // Group events by month for better organization
  const byMonth = new Map<string, TimelineEvent[]>();
  for (const event of timeline) {
    const key = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(event);
  }

  for (const [month, events] of byMonth) {
    const content = events.map(e =>
      `[${e.date.toISOString().split('T')[0]}] [${e.category.toUpperCase()}] ${e.title}: ${e.description}`
    ).join('\n');

    memories.push({
      role: 'system',
      content: `CASE ${CASE_NUMBER} - ${month} Events:\n${content}`,
      metadata: {
        type: 'timeline',
        month,
        event_count: events.length
      }
    });
  }

  // Store filing index
  const filingIndex = filings.map(f =>
    `[${f.date.toISOString().split('T')[0]}] ${f.type.toUpperCase()}: ${f.title}${f.signedBy ? ` (${f.signedBy})` : ''}`
  ).join('\n');

  memories.push({
    role: 'system',
    content: `CASE ${CASE_NUMBER} - Court Filing Index:\n${filingIndex}`,
    metadata: { type: 'filing_index' }
  });

  // Store attorney correspondence summary
  const emailsByMonth = new Map<string, EmailRecord[]>();
  for (const email of emails) {
    const key = `${email.date.getFullYear()}-${String(email.date.getMonth() + 1).padStart(2, '0')}`;
    if (!emailsByMonth.has(key)) emailsByMonth.set(key, []);
    emailsByMonth.get(key)!.push(email);
  }

  for (const [month, monthEmails] of emailsByMonth) {
    const content = monthEmails.map(e =>
      `[${e.date.toISOString().split('T')[0]}] ${e.from.split('<')[0].trim()}: ${e.subject}`
    ).join('\n');

    memories.push({
      role: 'system',
      content: `CASE ${CASE_NUMBER} - Attorney Correspondence ${month}:\n${content}`,
      metadata: { type: 'correspondence', month }
    });
  }

  // Add memories to Zep
  for (const mem of memories) {
    try {
      await fetch(`${ZEP_API_URL}/api/v2/sessions/${sessionId}/memory`, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${ZEP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: [mem] })
      });
    } catch (e: any) {
      console.error(`   Failed to store memory: ${e.message}`);
    }
  }

  console.log(`   Stored ${memories.length} memory blocks in Zep session: ${sessionId}`);
}

// ============ Local Storage (Backup) ============

function saveLocalTimeline(timeline: TimelineEvent[], emails: EmailRecord[], filings: CourtFiling[]) {
  const outputDir = path.resolve(process.cwd(), '.data', 'legal', 'timeline');
  fs.mkdirSync(outputDir, { recursive: true });

  // Save full timeline
  fs.writeFileSync(
    path.join(outputDir, 'master_timeline.json'),
    JSON.stringify(timeline, null, 2)
  );

  // Save emails with dates
  fs.writeFileSync(
    path.join(outputDir, 'attorney_emails.json'),
    JSON.stringify(emails, null, 2)
  );

  // Save filings
  fs.writeFileSync(
    path.join(outputDir, 'court_filings.json'),
    JSON.stringify(filings, null, 2)
  );

  // Generate markdown summary
  const md = generateMarkdownSummary(timeline, emails, filings);
  fs.writeFileSync(
    path.join(outputDir, 'CASE_FILE_INDEX.md'),
    md
  );

  console.log(`📁 Saved local files to ${outputDir}`);
}

function generateMarkdownSummary(
  timeline: TimelineEvent[],
  emails: EmailRecord[],
  filings: CourtFiling[]
): string {
  let md = `# Case ${CASE_NUMBER} - ${CASE_NAME}\n`;
  md += `## Master Case File Index\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  md += `## Statistics\n`;
  md += `- Total Timeline Events: ${timeline.length}\n`;
  md += `- Attorney Emails: ${emails.length}\n`;
  md += `- Court Filings: ${filings.length}\n\n`;

  md += `## Court Filings\n\n`;
  md += `| Date | Type | Title | Signed By |\n`;
  md += `|------|------|-------|----------|\n`;
  for (const f of filings) {
    md += `| ${f.date.toISOString().split('T')[0]} | ${f.type} | ${f.title.substring(0, 40)} | ${f.signedBy || '-'} |\n`;
  }

  md += `\n## Key Events Timeline\n\n`;
  const keyEvents = timeline.filter(e => e.category !== 'email');
  for (const e of keyEvents) {
    md += `### ${e.date.toISOString().split('T')[0]} - ${e.title}\n`;
    md += `**Category:** ${e.category} | **Source:** ${e.source}\n`;
    md += `${e.description}\n\n`;
  }

  md += `## Attorney Correspondence (by date)\n\n`;
  const sortedEmails = [...emails].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const e of sortedEmails.slice(0, 50)) {
    md += `- **${e.date.toISOString().split('T')[0]}** - ${e.subject.substring(0, 60)}${e.subject.length > 60 ? '...' : ''}\n`;
  }

  return md;
}

// ============ Main ============

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  MASTER LEGAL TIMELINE BUILDER');
  console.log(`  Case: ${CASE_NUMBER} - ${CASE_NAME}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Fetch emails with real dates
  const emails = await fetchAttorneyEmails();

  // 2. Process court order PDFs
  const filings = await processCourtOrders();

  // 3. Build master timeline
  const timeline = buildMasterTimeline(emails, filings);

  console.log(`\n📊 Timeline Summary:`);
  console.log(`   Total events: ${timeline.length}`);
  console.log(`   Date range: ${timeline[0]?.date.toISOString().split('T')[0]} to ${timeline[timeline.length-1]?.date.toISOString().split('T')[0]}`);

  // 4. Store in Zep memory
  await storeInZepMemory(timeline, emails, filings);

  // 5. Save local backup
  saveLocalTimeline(timeline, emails, filings);

  console.log('\n✅ Master timeline built and stored');
}

main().catch(console.error);
