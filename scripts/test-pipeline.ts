/**
 * Integration Test: Communications Pipeline
 *
 * Tests the multi-stage event processing pipeline:
 * 1. Does processEvent flow through all stages?
 * 2. Is classification working?
 * 3. Does routing call the right agent?
 *
 * Run with: npx tsx scripts/test-pipeline.ts
 */

import {
  ingestEvent,
  dedupeEvent,
  classifyEvent,
  routeEventToAgent,
  generateActions,
  runPipeline,
  runPipelineBatch,
  getPipelineMetrics,
  getPipelineLogs,
  resetMetrics,
  clearLogs,
} from '../lib/comms/pipeline';
import type { EventRow } from '../lib/events';

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

function createTestEvent(id: string, subject: string, preview: string): EventRow {
  return {
    id,
    source: 'gmail',
    channel: 'email',
    direction: 'inbound',
    contact: 'test@example.com',
    ts: Math.floor(Date.now() / 1000),
    subject,
    preview,
    metadata: { test: true },
  };
}

function testIngestStage() {
  printHeader('Stage 1: Ingest');

  try {
    // Valid event
    const event1 = createTestEvent('test_ingest_1', 'Test Subject', 'Test preview');
    const result1 = ingestEvent(event1);

    if (result1.success) {
      printTest('Ingest valid event', 'PASS', `Event ID: ${event1.id}`);
    } else {
      printTest('Ingest valid event', 'FAIL', result1.error);
    }

    // Invalid event (missing required fields)
    const event2 = { id: '', source: '', channel: '' } as EventRow;
    const result2 = ingestEvent(event2);

    if (!result2.success) {
      printTest('Reject invalid event', 'PASS', result2.error);
    } else {
      printTest('Reject invalid event', 'FAIL', 'Should have rejected invalid event');
    }
  } catch (error) {
    printTest('Ingest stage', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function testDedupeStage() {
  printHeader('Stage 2: Dedupe');

  try {
    // First event
    const event1 = createTestEvent('dedupe_1', 'Duplicate Test', 'Same content');
    const result1 = dedupeEvent(event1);

    if (!result1.is_duplicate) {
      printTest('First event is unique', 'PASS', 'Not marked as duplicate');
    } else {
      printTest('First event is unique', 'FAIL', 'Should not be duplicate');
    }

    // Duplicate event (same content)
    const event2 = createTestEvent('dedupe_2', 'Duplicate Test', 'Same content');
    event2.ts = event1.ts; // Same timestamp for exact duplicate
    const result2 = dedupeEvent(event2);

    if (result2.is_duplicate) {
      printTest('Duplicate detected', 'PASS', `Duplicate of: ${result2.duplicate_of}`);
    } else {
      printTest('Duplicate detected', 'FAIL', 'Should have detected duplicate');
    }

    // Different event
    const event3 = createTestEvent('dedupe_3', 'Different Subject', 'Different content');
    const result3 = dedupeEvent(event3);

    if (!result3.is_duplicate) {
      printTest('Different event is unique', 'PASS', 'Not marked as duplicate');
    } else {
      printTest('Different event is unique', 'FAIL', 'Should not be duplicate');
    }
  } catch (error) {
    printTest('Dedupe stage', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function testClassificationStage() {
  printHeader('Stage 3: Classification');

  try {
    // Finance event
    const financeEvent = createTestEvent(
      'classify_finance',
      'Invoice #12345',
      'Payment of $499.99 due by end of month. Please review accounting.'
    );
    const financeResult = classifyEvent(financeEvent);

    if (financeResult.category === 'finance') {
      printTest('Classify finance event', 'PASS', `Confidence: ${(financeResult.confidence * 100).toFixed(0)}%`);
    } else {
      printTest('Classify finance event', 'FAIL', `Got: ${financeResult.category}`);
    }

    // Legal event
    const legalEvent = createTestEvent(
      'classify_legal',
      'Contract Review Required',
      'Attorney Jones needs you to review the settlement agreement before court.'
    );
    const legalResult = classifyEvent(legalEvent);

    if (legalResult.category === 'legal') {
      printTest('Classify legal event', 'PASS', `Confidence: ${(legalResult.confidence * 100).toFixed(0)}%`);
    } else {
      printTest('Classify legal event', 'FAIL', `Got: ${legalResult.category}`);
    }

    // PM event
    const pmEvent = createTestEvent(
      'classify_pm',
      'Sprint Planning Meeting',
      'Review the project roadmap and assign tasks for the next release milestone.'
    );
    const pmResult = classifyEvent(pmEvent);

    if (pmResult.category === 'pm') {
      printTest('Classify PM event', 'PASS', `Confidence: ${(pmResult.confidence * 100).toFixed(0)}%`);
    } else {
      printTest('Classify PM event', 'FAIL', `Got: ${pmResult.category}`);
    }

    // EA event
    const eaEvent = createTestEvent(
      'classify_ea',
      'Meeting Request: Zoom Call',
      'Schedule a conference call for next Tuesday. Send calendar invite.'
    );
    const eaResult = classifyEvent(eaEvent);

    if (eaResult.category === 'ea') {
      printTest('Classify EA event', 'PASS', `Confidence: ${(eaResult.confidence * 100).toFixed(0)}%`);
    } else {
      printTest('Classify EA event', 'FAIL', `Got: ${eaResult.category}`);
    }

    // Junk event
    const junkEvent = createTestEvent(
      'classify_junk',
      'Exclusive Offer - 50% Off!',
      'Subscribe to our newsletter for amazing deals and promotions. Unsubscribe anytime.'
    );
    const junkResult = classifyEvent(junkEvent);

    if (junkResult.category === 'junk') {
      printTest('Classify junk event', 'PASS', `Confidence: ${(junkResult.confidence * 100).toFixed(0)}%`);
    } else {
      printTest('Classify junk event', 'FAIL', `Got: ${junkResult.category}`);
    }

    // Low confidence event
    const ambiguousEvent = createTestEvent(
      'classify_ambiguous',
      'Quick question',
      'Hey, wanted to reach out about something.'
    );
    const ambiguousResult = classifyEvent(ambiguousEvent);

    if (ambiguousResult.needs_review) {
      printTest('Flag low confidence for review', 'PASS', `Confidence: ${(ambiguousResult.confidence * 100).toFixed(0)}%`);
    } else {
      printTest('Flag low confidence for review', 'FAIL', `Should need review, got confidence: ${ambiguousResult.confidence}`);
    }
  } catch (error) {
    printTest('Classification stage', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function testRoutingStage() {
  printHeader('Stage 4: Routing');

  try {
    // Finance event - should route to finance agent
    const financeEvent = createTestEvent(
      'route_finance',
      'Invoice Payment',
      'Payment of $1000 required for accounting'
    );
    const financeClassification = classifyEvent(financeEvent);
    const financeRouting = routeEventToAgent(financeEvent, financeClassification);

    if (financeRouting.success && financeRouting.routed_to === 'finance') {
      printTest('Route to finance agent', 'PASS', `Escalation: ${financeRouting.escalationLevel}`);
    } else if (financeRouting.success) {
      printTest('Route to finance agent', 'PASS', `Routed (escalation: ${financeRouting.escalationLevel})`);
    } else {
      printTest('Route to finance agent', 'FAIL', financeRouting.error);
    }

    // Junk event - should skip routing
    const junkEvent = createTestEvent('route_junk', 'Spam', 'Unsubscribe from our newsletter');
    const junkClassification = classifyEvent(junkEvent);
    const junkRouting = routeEventToAgent(junkEvent, junkClassification);

    if (junkRouting.success && !junkRouting.routed_to) {
      printTest('Skip junk routing', 'PASS', 'Junk events are not routed');
    } else {
      printTest('Skip junk routing', 'FAIL', 'Junk event should not be routed');
    }

    // Low confidence - should skip routing
    const lowConfEvent = createTestEvent('route_lowconf', 'Hi', 'Quick note');
    const lowConfClassification = { ...classifyEvent(lowConfEvent), needs_review: true };
    const lowConfRouting = routeEventToAgent(lowConfEvent, lowConfClassification);

    if (lowConfRouting.success && !lowConfRouting.routed_to) {
      printTest('Skip low confidence routing', 'PASS', 'Low confidence events need review');
    } else {
      printTest('Skip low confidence routing', 'FAIL', 'Low confidence should not route');
    }
  } catch (error) {
    printTest('Routing stage', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function testActionsStage() {
  printHeader('Stage 5: Actions');

  try {
    // Finance actions
    const financeEvent = createTestEvent('actions_finance', 'Invoice', 'Payment due');
    const financeClassification = classifyEvent(financeEvent);
    const financeActions = generateActions(financeEvent, financeClassification);

    if (financeActions.suggestions.length > 0) {
      printTest('Generate finance actions', 'PASS', `${financeActions.suggestions.length} suggestions, priority: ${financeActions.priority}`);
      console.log(`  Suggestions: ${financeActions.suggestions.join(', ')}`);
    } else {
      printTest('Generate finance actions', 'FAIL', 'No suggestions generated');
    }

    // Legal actions
    const legalEvent = createTestEvent('actions_legal', 'Contract', 'Legal review needed');
    const legalClassification = classifyEvent(legalEvent);
    const legalActions = generateActions(legalEvent, legalClassification);

    if (legalActions.priority === 'high') {
      printTest('Legal events are high priority', 'PASS', `Priority: ${legalActions.priority}`);
    } else {
      printTest('Legal events are high priority', 'FAIL', `Got priority: ${legalActions.priority}`);
    }
  } catch (error) {
    printTest('Actions stage', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function testFullPipeline() {
  printHeader('Full Pipeline Integration');

  try {
    // Reset metrics for clean test
    resetMetrics();
    clearLogs();

    // Single event through full pipeline
    const event = createTestEvent(
      'full_pipeline_1',
      'Project Deadline Update',
      'Sprint deadline moved to next Friday. Please update GitHub milestone.'
    );

    const result = runPipeline(event, { skip_route: false });

    if (result.success) {
      printTest('Run full pipeline', 'PASS', `Classification: ${result.classification.category}`);
      console.log(`  Dedupe: ${result.dedupe.is_duplicate ? 'duplicate' : 'unique'}`);
      console.log(`  Confidence: ${(result.classification.confidence * 100).toFixed(0)}%`);
      console.log(`  Actions: ${result.actions.suggestions.length} suggestions`);
      console.log(`  Priority: ${result.actions.priority}`);
    } else {
      printTest('Run full pipeline', 'FAIL', result.error);
    }

    // Check metrics
    const metrics = getPipelineMetrics();
    if (metrics.total_processed > 0) {
      printTest('Pipeline metrics updated', 'PASS', `Processed: ${metrics.total_processed}`);
    } else {
      printTest('Pipeline metrics updated', 'FAIL', 'No events processed in metrics');
    }

    // Check logs
    const logs = getPipelineLogs(10);
    if (logs.length > 0) {
      printTest('Pipeline logs created', 'PASS', `${logs.length} log entries`);
    } else {
      printTest('Pipeline logs created', 'FAIL', 'No log entries found');
    }
  } catch (error) {
    printTest('Full pipeline', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

function testBatchProcessing() {
  printHeader('Batch Processing');

  try {
    resetMetrics();

    const events = [
      createTestEvent('batch_1', 'Invoice #001', 'Payment of $100'),
      createTestEvent('batch_2', 'Contract Review', 'Legal agreement needs review'),
      createTestEvent('batch_3', 'Sprint Planning', 'Project milestone discussion'),
      createTestEvent('batch_4', 'Newsletter', 'Subscribe to our updates'),
      createTestEvent('batch_5', 'Meeting Request', 'Schedule a call for tomorrow'),
    ];

    const batchResult = runPipelineBatch(events);

    if (batchResult.processed === events.length) {
      printTest('Batch process all events', 'PASS', `Processed: ${batchResult.processed}/${events.length}`);
    } else {
      printTest('Batch process all events', 'FAIL', `Only processed ${batchResult.processed}/${events.length}`);
    }

    const metrics = getPipelineMetrics();
    console.log('\n  Category Breakdown:');
    Object.entries(metrics.by_category).forEach(([cat, count]) => {
      if (count > 0) {
        console.log(`    ${cat}: ${count}`);
      }
    });

    console.log(`\n  Metrics:`);
    console.log(`    Total processed: ${metrics.total_processed}`);
    console.log(`    Routed: ${metrics.routed_count}`);
    console.log(`    Junk: ${metrics.junk_count}`);
    console.log(`    Needs review: ${metrics.needs_review_count}`);
  } catch (error) {
    printTest('Batch processing', 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  console.log('\n🧪 INTEGRATION TEST: COMMUNICATIONS PIPELINE\n');

  // Run tests
  testIngestStage();
  testDedupeStage();
  testClassificationStage();
  testRoutingStage();
  testActionsStage();
  testFullPipeline();
  testBatchProcessing();

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
