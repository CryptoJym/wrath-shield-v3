/**
 * Integration Test: Gmail/Outlook Ingestion
 *
 * Tests the unified ingest system end-to-end:
 * 1. Can we fetch from Gmail/Outlook APIs?
 * 2. Does unified ingest normalize correctly?
 * 3. Do events get stored in database?
 *
 * Run with: npx tsx scripts/test-ingestion.ts
 */

import {
  loadGmailMailboxCreds,
  loadOutlookMailboxCreds,
  ingestGmailMailbox,
  ingestOutlookMailbox,
  normalizeGmailToEvent,
  normalizeOutlookToEvent,
  unifiedIngest,
} from '../lib/inbox/unified-ingest';
import { insertEvent, listRecentEvents } from '../lib/events';

// Test result tracking
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function printHeader(text: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${text}`);
  console.log('='.repeat(60));
}

function printTest(name: string, status: 'PASS' | 'FAIL' | 'SKIP', details?: string) {
  testsRun++;
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';

  console.log(`${color}${icon} ${name}${reset}`);
  if (details) {
    console.log(`  ${details}`);
  }

  if (status === 'PASS') testsPassed++;
  if (status === 'FAIL') testsFailed++;
}

async function testGmailCredentials() {
  printHeader('Gmail Credentials');

  try {
    const creds = loadGmailMailboxCreds();

    if (creds.length === 0) {
      printTest('Gmail credentials loaded', 'SKIP', 'No Gmail credentials configured');
      return null;
    }

    printTest('Gmail credentials loaded', 'PASS', `Found ${creds.length} mailbox(es)`);
    creds.forEach((c, i) => {
      console.log(`  [${i + 1}] ${c.email} (${c.slug})`);
    });

    return creds;
  } catch (error) {
    printTest('Gmail credentials loaded', 'FAIL', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testOutlookCredentials() {
  printHeader('Outlook Credentials');

  try {
    const creds = loadOutlookMailboxCreds();

    if (creds.length === 0) {
      printTest('Outlook credentials loaded', 'SKIP', 'No Outlook credentials configured');
      return null;
    }

    printTest('Outlook credentials loaded', 'PASS', `Found ${creds.length} mailbox(es)`);
    creds.forEach((c, i) => {
      console.log(`  [${i + 1}] ${c.email} (${c.slug})`);
    });

    return creds;
  } catch (error) {
    printTest('Outlook credentials loaded', 'FAIL', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testGmailFetch() {
  printHeader('Gmail API Fetch');

  const creds = loadGmailMailboxCreds();
  if (creds.length === 0) {
    printTest('Gmail API fetch', 'SKIP', 'No Gmail credentials configured');
    return null;
  }

  try {
    const mailbox = creds[0];
    const result = await ingestGmailMailbox(mailbox, { maxEmails: 5, daysBack: 7 });

    if (result.error) {
      printTest('Gmail API fetch', 'FAIL', result.error);
      return null;
    }

    printTest('Gmail API fetch', 'PASS', `Fetched ${result.messages.length} messages`);
    if (result.messages.length > 0) {
      console.log(`  Sample: "${result.messages[0].subject}"`);
    }

    return result.messages;
  } catch (error) {
    printTest('Gmail API fetch', 'FAIL', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testOutlookFetch() {
  printHeader('Outlook API Fetch');

  const creds = loadOutlookMailboxCreds();
  if (creds.length === 0) {
    printTest('Outlook API fetch', 'SKIP', 'No Outlook credentials configured');
    return null;
  }

  try {
    const mailbox = creds[0];
    const result = await ingestOutlookMailbox(mailbox, { maxItems: 5, daysBack: 7 });

    if (result.error) {
      printTest('Outlook API fetch', 'FAIL', result.error);
      return null;
    }

    printTest('Outlook API fetch', 'PASS', `Fetched ${result.messages.length} messages`);
    if (result.messages.length > 0) {
      console.log(`  Sample: "${result.messages[0].subject}"`);
    }

    return result.messages;
  } catch (error) {
    printTest('Outlook API fetch', 'FAIL', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testNormalization() {
  printHeader('Event Normalization');

  try {
    // Test Gmail normalization
    const gmailMsg = {
      id: 'test_gmail_123',
      subject: 'Test Gmail Subject',
      from: 'John Doe <john@example.com>',
      to: 'me@example.com',
      date: new Date().toISOString(),
      snippet: 'This is a test email snippet',
    };

    const gmailEvent = normalizeGmailToEvent(gmailMsg, 'test@gmail.com');

    if (gmailEvent.id === 'gmail_test_gmail_123' && gmailEvent.source === 'gmail' && gmailEvent.channel === 'email') {
      printTest('Gmail normalization', 'PASS', `ID: ${gmailEvent.id}, Contact: ${gmailEvent.contact}`);
    } else {
      printTest('Gmail normalization', 'FAIL', 'Event structure incorrect');
    }

    // Test Outlook normalization
    const outlookMsg = {
      id: 'test_outlook_456',
      subject: 'Test Outlook Subject',
      from: 'jane@example.com',
      to: ['me@example.com'],
      received: new Date().toISOString(),
      snippet: 'This is a test outlook snippet',
    };

    const outlookEvent = normalizeOutlookToEvent(outlookMsg, 'test@outlook.com');

    if (outlookEvent.id === 'outlook_test_outlook_456' && outlookEvent.source === 'outlook' && outlookEvent.channel === 'email') {
      printTest('Outlook normalization', 'PASS', `ID: ${outlookEvent.id}, Contact: ${outlookEvent.contact}`);
    } else {
      printTest('Outlook normalization', 'FAIL', 'Event structure incorrect');
    }
  } catch (error) {
    printTest('Event normalization', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function testDatabaseStorage() {
  printHeader('Database Storage');

  try {
    // Create a test event
    const testEvent = {
      id: `test_ingest_${Date.now()}`,
      source: 'gmail',
      channel: 'email',
      direction: 'inbound' as const,
      contact: 'test@example.com',
      ts: Math.floor(Date.now() / 1000),
      subject: 'Integration Test Event',
      preview: 'This is a test event for integration testing',
      metadata: { test: true },
    };

    // Insert into database
    insertEvent(testEvent);
    printTest('Event inserted to database', 'PASS', `ID: ${testEvent.id}`);

    // Verify it was stored
    const recentEvents = listRecentEvents({ limit: 10 });
    const found = recentEvents.find(e => e.id === testEvent.id);

    if (found) {
      printTest('Event retrieved from database', 'PASS', `Subject: ${found.subject}`);
    } else {
      printTest('Event retrieved from database', 'FAIL', 'Event not found after insertion');
    }
  } catch (error) {
    printTest('Database storage', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function testUnifiedIngest() {
  printHeader('Unified Ingest Flow');

  try {
    // Test with fetchFresh=false to read from JSONL files if they exist
    const result = await unifiedIngest({ fetchFresh: false, writeJsonl: false });

    printTest('Unified ingest executed', 'PASS', `Processed ${result.summary.totalEvents} events`);

    console.log('\n  Summary:');
    console.log(`    Gmail mailboxes: ${result.summary.gmail.length}`);
    console.log(`    Outlook mailboxes: ${result.summary.outlook.length}`);
    console.log(`    Total messages: ${result.summary.totalMessages}`);
    console.log(`    Total events: ${result.summary.totalEvents}`);
    console.log(`    Errors: ${result.summary.errors.length}`);

    if (result.summary.errors.length > 0) {
      console.log('\n  Errors:');
      result.summary.errors.forEach((err, i) => {
        console.log(`    [${i + 1}] ${err}`);
      });
    }

    // Test with fetchFresh=true if credentials are available
    const gmailCreds = loadGmailMailboxCreds();
    const outlookCreds = loadOutlookMailboxCreds();

    if (gmailCreds.length > 0 || outlookCreds.length > 0) {
      console.log('\n  Testing fresh fetch...');
      const freshResult = await unifiedIngest({
        fetchFresh: true,
        writeJsonl: false,
        gmailOptions: { maxEmails: 3, daysBack: 1 },
        outlookOptions: { maxItems: 3, daysBack: 1 },
      });

      printTest('Fresh ingest executed', 'PASS', `Fetched ${freshResult.summary.totalMessages} fresh messages`);
    } else {
      printTest('Fresh ingest executed', 'SKIP', 'No credentials configured for fresh fetch');
    }
  } catch (error) {
    printTest('Unified ingest flow', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  console.log('\n🧪 INTEGRATION TEST: INGESTION PIPELINE\n');

  // Run tests
  await testGmailCredentials();
  await testOutlookCredentials();
  await testGmailFetch();
  await testOutlookFetch();
  await testNormalization();
  await testDatabaseStorage();
  await testUnifiedIngest();

  // Print summary
  printHeader('Test Summary');
  console.log(`Total tests run: ${testsRun}`);
  console.log(`Passed: ${testsPassed} ✓`);
  console.log(`Failed: ${testsFailed} ✗`);
  console.log(`Skipped: ${testsRun - testsPassed - testsFailed} ○`);

  // Exit with appropriate code
  if (testsFailed > 0) {
    console.log('\n❌ Some tests failed\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
