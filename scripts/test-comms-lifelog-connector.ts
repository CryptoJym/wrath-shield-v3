/**
 * Test script for Comms Lifelog Connector
 *
 * Run with: npx tsx scripts/test-comms-lifelog-connector.ts
 */

import { processLifelogEntry, syncRecentLifelogs, detectActionItems } from '../lib/pm/connectors/comms-lifelog-connector';
import { getLifelogsForDate } from '../lib/db/queries';

// ============================================================================
// Test 1: Detection Patterns
// ============================================================================

function testDetectionPatterns() {
  console.log('\n=== Test 1: Action Item Detection Patterns ===\n');

  const testCases = [
    {
      name: 'TODO marker',
      text: 'TODO: Finish the quarterly report by Friday',
      expectedCount: 1,
      expectedType: 'task',
      expectedConfidence: 0.95,
    },
    {
      name: 'Follow-up phrase',
      text: 'Follow up with Sarah about the budget proposal next week',
      expectedCount: 1,
      expectedType: 'follow_up',
      expectedConfidence: 0.85,
    },
    {
      name: 'Multiple actions',
      text: 'TODO: Review PR #543. REMINDER: Send email to team. Follow up with John.',
      expectedCount: 3,
      expectedType: 'mixed',
    },
    {
      name: 'Meeting notes',
      text: 'Action items: 1) Update documentation, 2) Schedule follow-up meeting',
      expectedCount: 1, // "Action items:" pattern
      expectedType: 'task',
    },
    {
      name: 'Ambiguous language',
      text: 'I should maybe consider updating the docs if I have time?',
      expectedCount: 1,
      expectedConfidence: 0.4, // Low confidence due to "maybe" and "?"
    },
    {
      name: 'No action items',
      text: 'Just had a great conversation about the weather.',
      expectedCount: 0,
    },
  ];

  for (const testCase of testCases) {
    const items = detectActionItems(testCase.text, {
      lifelog_id: 'test_log',
      date: '2025-12-04',
    });

    console.log(`Test: ${testCase.name}`);
    console.log(`  Text: "${testCase.text}"`);
    console.log(`  Expected: ${testCase.expectedCount} items`);
    console.log(`  Found: ${items.length} items`);

    if (items.length > 0) {
      items.forEach((item, i) => {
        console.log(`  Item ${i + 1}:`);
        console.log(`    - Text: "${item.text}"`);
        console.log(`    - Type: ${item.type}`);
        console.log(`    - Confidence: ${item.confidence.toFixed(2)}`);
        console.log(`    - Urgency: ${item.urgency}`);
        if (item.people) console.log(`    - People: ${item.people.join(', ')}`);
      });
    }

    const passed = items.length === testCase.expectedCount;
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }
}

// ============================================================================
// Test 2: Single Lifelog Processing
// ============================================================================

async function testSingleEntry() {
  console.log('\n=== Test 2: Single Lifelog Entry Processing ===\n');

  try {
    // Get today's lifelogs
    const today = new Date().toISOString().split('T')[0];
    const lifelogs = getLifelogsForDate(today);

    if (lifelogs.length === 0) {
      console.log(`No lifelogs found for ${today}`);
      console.log('Tip: Create test lifelogs in the database first\n');
      return;
    }

    console.log(`Found ${lifelogs.length} lifelog(s) for ${today}`);
    console.log('Processing first entry...\n');

    const entry = lifelogs[0];
    console.log(`Lifelog ID: ${entry.id}`);
    console.log(`Date: ${entry.date}`);
    console.log(`Title: ${entry.title || '(none)'}`);

    const result = await processLifelogEntry(entry);

    console.log('\nProcessing Result:');
    console.log(`  - Action items found: ${result.items_found}`);
    console.log(`  - Signals created: ${result.signals_created.length}`);
    console.log(`  - Errors: ${result.errors.length}`);

    if (result.signals_created.length > 0) {
      console.log('\nCreated Signals:');
      result.signals_created.forEach((queueId, i) => {
        console.log(`  ${i + 1}. Queue ID: ${queueId}`);
      });
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    console.log();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// ============================================================================
// Test 3: Batch Sync
// ============================================================================

async function testBatchSync() {
  console.log('\n=== Test 3: Batch Sync (Last 7 Days) ===\n');

  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    console.log(`Syncing lifelogs since: ${since.toISOString().split('T')[0]}`);
    console.log('This may take a few seconds...\n');

    const result = await syncRecentLifelogs(since);

    console.log('Sync Result:');
    console.log(`  - Lifelogs processed: ${result.processed}`);
    console.log(`  - Total action items: ${result.total_items}`);
    console.log(`  - Total signals created: ${result.total_signals}`);
    console.log(`  - Skipped (no actions): ${result.skipped}`);
    console.log(`  - Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    console.log();

    // Calculate statistics
    if (result.processed > 0) {
      const avgItemsPerLog = (result.total_items / result.processed).toFixed(2);
      const actionableRate = ((result.processed - result.skipped) / result.processed * 100).toFixed(1);
      console.log('Statistics:');
      console.log(`  - Average action items per lifelog: ${avgItemsPerLog}`);
      console.log(`  - Actionable rate: ${actionableRate}%`);
      console.log();
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Comms Lifelog Connector - Test Suite                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Test 1: Pattern detection (no database needed)
  testDetectionPatterns();

  // Test 2: Single entry (requires database)
  await testSingleEntry();

  // Test 3: Batch sync (requires database)
  await testBatchSync();

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Test suite complete!                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\nNext steps:');
  console.log('1. Check created signals: curl http://localhost:4242/api/pm/queue?status=pending');
  console.log('2. Process queue: curl -X POST http://localhost:4242/api/pm/jobs/execute \\');
  console.log('                       -H "Content-Type: application/json" \\');
  console.log('                       -d \'{"job_id": "process-queue", "force": true}\'');
  console.log();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
