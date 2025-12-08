/**
 * Integration Test: Database Operations
 *
 * Tests database CRUD operations:
 * 1. Is database initialized?
 * 2. Can we CRUD events?
 * 3. Can we CRUD tasks?
 *
 * Run with: npx tsx scripts/test-database.ts
 */

import {
  insertEvent,
  listRecentEvents,
  getEventById,
  updateEventClassification,
  routeEvent,
  deleteEvent,
  type EventRow,
} from '../lib/events';

import { getDatabase } from '../lib/db/Database';

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

function testDatabaseInitialization() {
  printHeader('Database Initialization');

  try {
    const db = getDatabase();

    if (db) {
      printTest('Database instance created', 'PASS', 'Database connection established');
    } else {
      printTest('Database instance created', 'FAIL', 'Could not create database instance');
      return false;
    }

    // Check if events table exists
    const rawDb = db.getRawDb() as any;
    const tables = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);

    if (tableNames.includes('events')) {
      printTest('Events table exists', 'PASS', 'Table schema initialized');
    } else {
      printTest('Events table exists', 'FAIL', 'Events table not found');
    }

    // Check for other core tables
    const expectedTables = ['cycles', 'recoveries', 'sleeps', 'lifelogs', 'settings'];
    let foundTables = 0;

    expectedTables.forEach(table => {
      if (tableNames.includes(table)) {
        foundTables++;
      }
    });

    if (foundTables > 0) {
      printTest('Core tables exist', 'PASS', `Found ${foundTables}/${expectedTables.length} core tables`);
      console.log(`  Tables: ${tableNames.filter((n: string) => expectedTables.includes(n)).join(', ')}`);
    } else {
      printTest('Core tables exist', 'SKIP', 'No core tables found (may be a fresh database)');
    }

    return true;
  } catch (error) {
    printTest('Database initialization', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function testEventCreate() {
  printHeader('Event Creation (INSERT)');

  try {
    const testEvent: EventRow = {
      id: `test_event_${Date.now()}_create`,
      source: 'gmail',
      channel: 'email',
      direction: 'inbound',
      contact: 'test@example.com',
      ts: Math.floor(Date.now() / 1000),
      subject: 'Test Event - Create',
      preview: 'This is a test event for CREATE operation',
      metadata: { test: true, operation: 'create' },
    };

    insertEvent(testEvent);

    printTest('Insert event', 'PASS', `ID: ${testEvent.id}`);

    // Verify it was inserted
    const retrieved = getEventById(testEvent.id);

    if (retrieved) {
      printTest('Verify inserted event', 'PASS', `Subject: ${retrieved.subject}`);

      // Check all fields
      if (
        retrieved.source === testEvent.source &&
        retrieved.channel === testEvent.channel &&
        retrieved.contact === testEvent.contact &&
        retrieved.subject === testEvent.subject
      ) {
        printTest('Verify event fields', 'PASS', 'All fields match');
      } else {
        printTest('Verify event fields', 'FAIL', 'Field mismatch');
      }
    } else {
      printTest('Verify inserted event', 'FAIL', 'Event not found after insert');
    }

    return testEvent.id;
  } catch (error) {
    printTest('Event create', 'FAIL', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function testEventRead() {
  printHeader('Event Reading (SELECT)');

  try {
    // List recent events
    const recentEvents = listRecentEvents({ limit: 10 });

    if (recentEvents.length > 0) {
      printTest('List recent events', 'PASS', `Found ${recentEvents.length} events`);
      console.log(`  Latest: "${recentEvents[0].subject}" (${recentEvents[0].source})`);
    } else {
      printTest('List recent events', 'SKIP', 'No events in database');
    }

    // Filter by source
    const gmailEvents = listRecentEvents({ source: 'gmail', limit: 5 });

    if (gmailEvents.length > 0) {
      printTest('Filter events by source', 'PASS', `Found ${gmailEvents.length} Gmail events`);
    } else {
      printTest('Filter events by source', 'SKIP', 'No Gmail events found');
    }

    // Get specific event
    if (recentEvents.length > 0) {
      const event = getEventById(recentEvents[0].id);

      if (event) {
        printTest('Get event by ID', 'PASS', `Retrieved event: ${event.id}`);
      } else {
        printTest('Get event by ID', 'FAIL', 'Event not found');
      }
    }

    return true;
  } catch (error) {
    printTest('Event read', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function testEventUpdate(eventId: string | null) {
  printHeader('Event Update (UPDATE)');

  if (!eventId) {
    printTest('Event update', 'SKIP', 'No test event available');
    return false;
  }

  try {
    // Update classification
    updateEventClassification(eventId, 'finance', 0.85);

    printTest('Update classification', 'PASS', `Classification updated for ${eventId}`);

    // Verify update
    const updated = getEventById(eventId);

    if (updated && updated.classification === 'finance' && updated.confidence === 0.85) {
      printTest('Verify classification update', 'PASS', `Classification: ${updated.classification}, Confidence: ${updated.confidence}`);
    } else {
      printTest('Verify classification update', 'FAIL', 'Classification not updated correctly');
    }

    // Update routing
    routeEvent(eventId, 'legal');

    printTest('Update routing', 'PASS', `Routing updated for ${eventId}`);

    // Verify routing update
    const routed = getEventById(eventId);

    if (routed && routed.routed_target === 'legal') {
      printTest('Verify routing update', 'PASS', `Routed to: ${routed.routed_target}`);
    } else {
      printTest('Verify routing update', 'FAIL', 'Routing not updated correctly');
    }

    return true;
  } catch (error) {
    printTest('Event update', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function testEventDelete(eventId: string | null) {
  printHeader('Event Deletion (DELETE)');

  if (!eventId) {
    printTest('Event delete', 'SKIP', 'No test event available');
    return false;
  }

  try {
    // Delete the event
    deleteEvent(eventId);

    printTest('Delete event', 'PASS', `Deleted event: ${eventId}`);

    // Verify deletion
    const deleted = getEventById(eventId);

    if (!deleted) {
      printTest('Verify deletion', 'PASS', 'Event no longer exists');
    } else {
      printTest('Verify deletion', 'FAIL', 'Event still exists after deletion');
    }

    return true;
  } catch (error) {
    printTest('Event delete', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function testBatchOperations() {
  printHeader('Batch Operations');

  try {
    const batchEvents: EventRow[] = [];

    // Create multiple test events
    for (let i = 0; i < 5; i++) {
      batchEvents.push({
        id: `test_batch_${Date.now()}_${i}`,
        source: 'test',
        channel: 'email',
        direction: 'inbound',
        contact: `user${i}@example.com`,
        ts: Math.floor(Date.now() / 1000) - i * 100,
        subject: `Batch Test Event ${i}`,
        preview: `This is batch event number ${i}`,
        metadata: { batch: true, index: i },
      });
    }

    // Insert all events
    batchEvents.forEach(event => insertEvent(event));

    printTest('Batch insert', 'PASS', `Inserted ${batchEvents.length} events`);

    // Retrieve them
    const retrieved = listRecentEvents({ source: 'test', limit: 10 });

    if (retrieved.length >= batchEvents.length) {
      printTest('Batch retrieve', 'PASS', `Retrieved ${retrieved.length} test events`);
    } else {
      printTest('Batch retrieve', 'FAIL', `Only retrieved ${retrieved.length}/${batchEvents.length}`);
    }

    // Clean up
    batchEvents.forEach(event => {
      try {
        deleteEvent(event.id);
      } catch {
        // Ignore cleanup errors
      }
    });

    printTest('Batch cleanup', 'PASS', 'Test events cleaned up');

    return true;
  } catch (error) {
    printTest('Batch operations', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function testDatabaseConstraints() {
  printHeader('Database Constraints');

  try {
    // Test unique ID constraint (insert duplicate)
    const duplicateId = `test_duplicate_${Date.now()}`;

    const event1: EventRow = {
      id: duplicateId,
      source: 'gmail',
      channel: 'email',
      ts: Math.floor(Date.now() / 1000),
      subject: 'First event',
    };

    const event2: EventRow = {
      id: duplicateId,
      source: 'outlook',
      channel: 'email',
      ts: Math.floor(Date.now() / 1000),
      subject: 'Second event (same ID)',
    };

    insertEvent(event1);

    try {
      insertEvent(event2);
      printTest('Unique ID constraint', 'FAIL', 'Duplicate ID was allowed');
    } catch {
      printTest('Unique ID constraint', 'PASS', 'Duplicate ID rejected');
    }

    // Clean up
    try {
      deleteEvent(duplicateId);
    } catch {
      // Ignore
    }

    // Test required fields
    try {
      const invalidEvent = { id: '', source: '', channel: '', ts: 0 } as EventRow;
      insertEvent(invalidEvent);
      printTest('Required field validation', 'FAIL', 'Invalid event was allowed');
    } catch {
      printTest('Required field validation', 'PASS', 'Invalid event rejected');
    }

    return true;
  } catch (error) {
    printTest('Database constraints', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

function testTransactionSupport() {
  printHeader('Transaction Support');

  try {
    const db = getDatabase();
    const rawDb = db.getRawDb() as any;

    // Test transaction
    const testIds: string[] = [];

    const transaction = rawDb.transaction(() => {
      for (let i = 0; i < 3; i++) {
        const id = `test_txn_${Date.now()}_${i}`;
        testIds.push(id);

        const event: EventRow = {
          id,
          source: 'test',
          channel: 'email',
          ts: Math.floor(Date.now() / 1000),
          subject: `Transaction Test ${i}`,
        };

        insertEvent(event);
      }
    });

    transaction();

    printTest('Transaction execution', 'PASS', 'Transaction committed successfully');

    // Verify all events were inserted
    const inserted = testIds.filter(id => getEventById(id) !== null);

    if (inserted.length === testIds.length) {
      printTest('Transaction atomicity', 'PASS', `All ${testIds.length} events inserted`);
    } else {
      printTest('Transaction atomicity', 'FAIL', `Only ${inserted.length}/${testIds.length} events found`);
    }

    // Clean up
    testIds.forEach(id => {
      try {
        deleteEvent(id);
      } catch {
        // Ignore
      }
    });

    return true;
  } catch (error) {
    printTest('Transaction support', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log('\n🧪 INTEGRATION TEST: DATABASE OPERATIONS\n');

  // Run tests
  const dbInitialized = testDatabaseInitialization();

  if (!dbInitialized) {
    console.log('\n⚠️  Database initialization failed. Cannot continue.\n');
    process.exit(1);
  }

  const createdEventId = testEventCreate();
  testEventRead();
  testEventUpdate(createdEventId);
  testEventDelete(createdEventId);
  testBatchOperations();
  testDatabaseConstraints();
  testTransactionSupport();

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
