/**
 * Temporal Search Example Usage
 *
 * This file demonstrates how to use the Temporal Search Preprocessing System
 * with the Working Memory buffer.
 *
 * Note: This is a server-side only module.
 */

import { getWorkingMemory } from './working-memory';
import { createTemporalSearchPreprocessor } from './temporal-search';
import type { EventSource } from './types';

/**
 * Example 1: Basic temporal search with natural language
 */
async function exampleBasicTemporalSearch() {
  console.log('=== Example 1: Basic Temporal Search ===\n');

  const wm = getWorkingMemory();
  const temporalSearch = createTemporalSearchPreprocessor(wm);

  // Add some test events
  await wm.addEvent({
    source: 'email',
    timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2 days ago
    content: 'Email from John: Meeting about Q4 budget planning',
    initialClassification: {
      domain: 'business',
      urgency: 'high',
      keywords: ['meeting', 'budget'],
    },
    processedBySynthesis: false,
  });

  await wm.addEvent({
    source: 'email',
    timestamp: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), // 7 days ago
    content: 'Email from Sarah: Quick sync on the legal case this Tuesday?',
    initialClassification: {
      domain: 'legal',
      urgency: 'medium',
      keywords: ['sync', 'legal'],
    },
    processedBySynthesis: false,
  });

  // Search with natural language temporal expression
  const results = await temporalSearch.search('emails from last week');

  console.log(`Found ${results.length} events from last week:`);
  for (const event of results) {
    console.log(`  [${event.source}] ${event.content.slice(0, 60)}...`);
    console.log(`  Timestamp: ${event.timestamp}`);
    console.log('');
  }
}

/**
 * Example 2: Parsing temporal expressions
 */
async function exampleParseTemporalExpressions() {
  console.log('=== Example 2: Parsing Temporal Expressions ===\n');

  const temporalSearch = createTemporalSearchPreprocessor(getWorkingMemory());

  const expressions = [
    'yesterday',
    'last Tuesday',
    '3 days ago',
    'this week',
    'December 5th',
    '2024-12-09',
    'between Monday and Friday',
  ];

  for (const expr of expressions) {
    const parsed = temporalSearch.parseExpression(expr);
    if (parsed) {
      console.log(`Expression: "${expr}"`);
      console.log(`  Type: ${parsed.type}`);
      console.log(`  Confidence: ${parsed.confidence}`);
      console.log(`  Range: ${parsed.resolved.start.toISOString()} → ${parsed.resolved.end.toISOString()}`);
      console.log('');
    }
  }
}

/**
 * Example 3: Extracting temporal context from queries
 */
async function exampleExtractTemporalContext() {
  console.log('=== Example 3: Extracting Temporal Context ===\n');

  const temporalSearch = createTemporalSearchPreprocessor(getWorkingMemory());

  const queries = [
    'show me emails from yesterday about the project',
    'what did John say last Tuesday',
    'meetings this week',
    'budget discussions from 3 days ago',
  ];

  for (const query of queries) {
    const { cleanedQuery, temporal } = temporalSearch.extractTemporalContext(query);
    console.log(`Original: "${query}"`);
    console.log(`Cleaned: "${cleanedQuery}"`);
    console.log(`Temporal: ${temporal ? 'found' : 'none'}`);
    console.log('');
  }
}

/**
 * Example 4: Finding overdue items
 */
async function exampleFindOverdueItems() {
  console.log('=== Example 4: Finding Overdue Items ===\n');

  const wm = getWorkingMemory();
  const temporalSearch = createTemporalSearchPreprocessor(wm);

  // Add event with overdue deadline
  await wm.addEvent({
    source: 'email',
    timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    content: 'Task: Submit quarterly report by December 1st',
    metadata: {
      deadline: '2024-12-01T17:00:00Z', // Past deadline
    },
    processedBySynthesis: false,
  });

  // Add event with future deadline
  await wm.addEvent({
    source: 'email',
    timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    content: 'Task: Review PR by December 15th',
    metadata: {
      deadline: '2024-12-15T17:00:00Z', // Future deadline
    },
    processedBySynthesis: false,
  });

  // Find overdue items
  const overdueItems = await temporalSearch.findOverdue();

  console.log(`Found ${overdueItems.length} overdue items:`);
  for (const item of overdueItems) {
    const deadline = item.metadata?.deadline as string;
    console.log(`  [${item.source}] ${item.content.slice(0, 60)}...`);
    console.log(`  Deadline: ${deadline}`);
    console.log('');
  }
}

/**
 * Example 5: Search with recency bias
 */
async function exampleRecencyBias() {
  console.log('=== Example 5: Search with Recency Bias ===\n');

  const wm = getWorkingMemory();
  const temporalSearch = createTemporalSearchPreprocessor(wm);

  // Add events at different times
  await wm.addEvent({
    source: 'email',
    timestamp: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), // 30 days ago
    content: 'Status update: Project alpha is progressing well',
    processedBySynthesis: false,
  });

  await wm.addEvent({
    source: 'email',
    timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), // 1 day ago
    content: 'Status update: Project alpha completed milestone 3',
    processedBySynthesis: false,
  });

  // Search without recency bias
  console.log('Without recency bias:');
  const resultsNoBias = await temporalSearch.search('status update', {
    recencyBias: 0,
    limit: 5,
  });

  for (const event of resultsNoBias) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(event.timestamp).getTime()) / (24 * 3600 * 1000)
    );
    console.log(`  ${daysAgo} days ago: ${event.content.slice(0, 50)}...`);
  }

  // Search with strong recency bias
  console.log('\nWith strong recency bias (0.8):');
  const resultsWithBias = await temporalSearch.search('status update', {
    recencyBias: 0.8,
    limit: 5,
  });

  for (const event of resultsWithBias) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(event.timestamp).getTime()) / (24 * 3600 * 1000)
    );
    console.log(`  ${daysAgo} days ago: ${event.content.slice(0, 50)}...`);
  }
  console.log('');
}

/**
 * Example 6: Deadline-only search
 */
async function exampleDeadlineOnlySearch() {
  console.log('=== Example 6: Deadline-Only Search ===\n');

  const wm = getWorkingMemory();
  const temporalSearch = createTemporalSearchPreprocessor(wm);

  // Add events with and without deadlines
  await wm.addEvent({
    source: 'email',
    timestamp: new Date().toISOString(),
    content: 'General email: Team standup notes',
    processedBySynthesis: false,
  });

  await wm.addEvent({
    source: 'email',
    timestamp: new Date().toISOString(),
    content: 'Task: Complete code review deadline: 2024-12-20',
    metadata: {
      deadline: '2024-12-20T17:00:00Z',
    },
    processedBySynthesis: false,
  });

  await wm.addEvent({
    source: 'email',
    timestamp: new Date().toISOString(),
    content: 'Urgent: Submit report by 2024-12-10',
    metadata: {
      deadline: '2024-12-10T17:00:00Z',
    },
    processedBySynthesis: false,
  });

  // Search for items with deadlines only
  const withDeadlines = await temporalSearch.search('', {
    deadlineOnly: true,
  });

  console.log(`Found ${withDeadlines.length} items with deadlines:`);
  for (const item of withDeadlines) {
    const deadline = item.metadata?.deadline as string;
    console.log(`  ${item.content.slice(0, 60)}...`);
    console.log(`  Deadline: ${deadline}`);
    console.log('');
  }
}

/**
 * Example 7: Advanced temporal query with direction modifiers
 */
async function exampleDirectionModifiers() {
  console.log('=== Example 7: Direction Modifiers ===\n');

  const wm = getWorkingMemory();
  const temporalSearch = createTemporalSearchPreprocessor(wm);

  // Reference date
  const referenceDate = new Date('2024-12-05');

  // Add events before, during, and after reference
  await wm.addEvent({
    source: 'email',
    timestamp: new Date('2024-12-01').toISOString(),
    content: 'Event before reference date',
    processedBySynthesis: false,
  });

  await wm.addEvent({
    source: 'email',
    timestamp: new Date('2024-12-05').toISOString(),
    content: 'Event on reference date',
    processedBySynthesis: false,
  });

  await wm.addEvent({
    source: 'email',
    timestamp: new Date('2024-12-10').toISOString(),
    content: 'Event after reference date',
    processedBySynthesis: false,
  });

  // Search with different directions
  const directions: Array<'before' | 'after' | 'exact'> = ['before', 'exact', 'after'];

  for (const direction of directions) {
    console.log(`Direction: ${direction}`);
    const results = await temporalSearch.search('', {
      temporal: {
        reference: { date: referenceDate },
        direction,
      },
    });

    console.log(`  Found ${results.length} events`);
    for (const event of results) {
      console.log(`    ${event.timestamp}: ${event.content}`);
    }
    console.log('');
  }
}

/**
 * Example 8: Integration with synthesis workflow
 */
async function exampleSynthesisIntegration() {
  console.log('=== Example 8: Synthesis Integration ===\n');

  const wm = getWorkingMemory();
  const temporalSearch = createTemporalSearchPreprocessor(wm);

  // Simulate synthesis loop: get events from this week
  const thisWeekEvents = await temporalSearch.search('', {
    temporal: {
      reference: 'this_week',
      direction: 'exact',
    },
    limit: 50,
  });

  console.log(`Retrieved ${thisWeekEvents.length} events from this week for synthesis`);

  // Check for overdue items that need escalation
  const overdueItems = await temporalSearch.findOverdue();
  console.log(`Found ${overdueItems.length} overdue items requiring attention`);

  // Prioritize high-urgency recent events
  const urgentRecent = await temporalSearch.search('', {
    temporal: {
      reference: 'today',
      direction: 'exact',
    },
    recencyBias: 1.0, // Max recency bias
    limit: 10,
  });

  console.log(`Top ${urgentRecent.length} urgent recent events for immediate synthesis`);
  console.log('');
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║    Temporal Search System - Usage Examples            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    await exampleBasicTemporalSearch();
    await exampleParseTemporalExpressions();
    await exampleExtractTemporalContext();
    await exampleFindOverdueItems();
    await exampleRecencyBias();
    await exampleDeadlineOnlySearch();
    await exampleDirectionModifiers();
    await exampleSynthesisIntegration();

    console.log('✓ All temporal search examples completed successfully!\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().then(() => {
    console.log('Examples finished. Database connection will close on exit.');
  });
}

export {
  exampleBasicTemporalSearch,
  exampleParseTemporalExpressions,
  exampleExtractTemporalContext,
  exampleFindOverdueItems,
  exampleRecencyBias,
  exampleDeadlineOnlySearch,
  exampleDirectionModifiers,
  exampleSynthesisIntegration,
  runAllExamples,
};
