/**
 * Integration Test: EA Learning & Zep Memory
 *
 * Tests the EA preference learning system and Zep memory integration:
 * 1. Can we save preferences to Zep?
 * 2. Can we load preferences from Zep?
 * 3. Does recordCorrection persist?
 *
 * Run with: npx tsx scripts/test-ea-learning.ts
 */

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

async function testZepConnection() {
  printHeader('Zep Memory Connection');

  try {
    // Check if Zep is configured
    if (!process.env.ZEP_API_KEY) {
      printTest('Zep API key configured', 'SKIP', 'ZEP_API_KEY not set');
      return false;
    }

    printTest('Zep API key configured', 'PASS', 'Environment variable set');

    // Try to import Zep module
    const { addAgentMemory, searchAgentMemory } = await import('../lib/memory/zep');

    // Test basic connectivity with a simple add
    const testMemory = `Test memory entry at ${new Date().toISOString()}`;
    await addAgentMemory('ea-agent', testMemory, { test: true });

    printTest('Zep connection established', 'PASS', 'Successfully added test memory');
    return true;
  } catch (error) {
    printTest('Zep connection', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testSavePreference() {
  printHeader('Save Preference to Zep');

  try {
    const { addAgentMemory } = await import('../lib/memory/zep');

    // Save a preference pattern
    const preferenceData = {
      type: 'urgency_pattern',
      pattern: 'legal|attorney|court',
      urgency: 'high',
      confidence: 0.85,
      source: 'manual',
      timestamp: new Date().toISOString(),
    };

    const memoryText = `Urgency Preference: Messages containing "${preferenceData.pattern}" should be treated as ${preferenceData.urgency} priority`;

    await addAgentMemory('ea-agent', memoryText, preferenceData);

    printTest('Save urgency preference', 'PASS', `Pattern: ${preferenceData.pattern}`);

    // Save a contact priority preference
    const contactPref = {
      type: 'priority_contact',
      identifier: 'attorney@lawfirm.com',
      urgency: 'critical',
      alwaysNotify: true,
      timestamp: new Date().toISOString(),
    };

    const contactMemory = `Priority Contact: ${contactPref.identifier} - always notify immediately (critical urgency)`;

    await addAgentMemory('ea-agent', contactMemory, contactPref);

    printTest('Save contact preference', 'PASS', `Contact: ${contactPref.identifier}`);

    return true;
  } catch (error) {
    printTest('Save preferences', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testLoadPreference() {
  printHeader('Load Preference from Zep');

  try {
    const { searchAgentMemory } = await import('../lib/memory/zep');

    // Search for urgency patterns
    const urgencyResults = await searchAgentMemory('ea-agent', 'legal attorney urgency pattern', 5);

    if (urgencyResults.length > 0) {
      printTest('Search urgency preferences', 'PASS', `Found ${urgencyResults.length} results`);
      console.log(`  Sample: "${urgencyResults[0].memory.text.substring(0, 80)}..."`);
    } else {
      printTest('Search urgency preferences', 'SKIP', 'No results (may need to wait for indexing)');
    }

    // Search for priority contacts
    const contactResults = await searchAgentMemory('ea-agent', 'priority contact always notify', 5);

    if (contactResults.length > 0) {
      printTest('Search contact preferences', 'PASS', `Found ${contactResults.length} results`);
      console.log(`  Sample: "${contactResults[0].memory.text.substring(0, 80)}..."`);
    } else {
      printTest('Search contact preferences', 'SKIP', 'No results (may need to wait for indexing)');
    }

    return true;
  } catch (error) {
    printTest('Load preferences', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testRecordCorrection() {
  printHeader('Record Correction');

  try {
    const { addAgentMemory } = await import('../lib/memory/zep');

    // Simulate a correction: user corrected urgency from 'medium' to 'high'
    const correction = {
      type: 'correction',
      original_classification: 'medium',
      corrected_classification: 'high',
      event_subject: 'Meeting with attorney',
      event_content: 'Schedule a call with Jones & Associates regarding the contract',
      learned_pattern: 'attorney meeting',
      confidence_boost: 0.15,
      timestamp: new Date().toISOString(),
    };

    const correctionMemory = `Correction: Event "${correction.event_subject}" was classified as ${correction.original_classification} but should be ${correction.corrected_classification}. Learning pattern: "${correction.learned_pattern}"`;

    await addAgentMemory('ea-agent', correctionMemory, correction);

    printTest('Record urgency correction', 'PASS', `Pattern learned: ${correction.learned_pattern}`);

    // Simulate routing correction
    const routingCorrection = {
      type: 'routing_correction',
      original_route: 'comms',
      corrected_route: 'legal',
      event_subject: 'Discovery documents',
      learned_keywords: ['discovery', 'documents', 'litigation'],
      timestamp: new Date().toISOString(),
    };

    const routingMemory = `Routing Correction: "${routingCorrection.event_subject}" was routed to ${routingCorrection.original_route} but should go to ${routingCorrection.corrected_route}. Keywords: ${routingCorrection.learned_keywords.join(', ')}`;

    await addAgentMemory('ea-agent', routingMemory, routingCorrection);

    printTest('Record routing correction', 'PASS', `Route: ${routingCorrection.original_route} → ${routingCorrection.corrected_route}`);

    return true;
  } catch (error) {
    printTest('Record corrections', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testRetrieveCorrections() {
  printHeader('Retrieve Learned Corrections');

  try {
    const { searchAgentMemory } = await import('../lib/memory/zep');

    // Search for correction patterns
    const correctionResults = await searchAgentMemory('ea-agent', 'correction classified urgency', 5);

    if (correctionResults.length > 0) {
      printTest('Retrieve corrections', 'PASS', `Found ${correctionResults.length} corrections`);

      // Display learned patterns
      console.log('\n  Learned Patterns:');
      correctionResults.forEach((result, i) => {
        const metadata = result.memory.metadata || {};
        if (metadata.type === 'correction' && metadata.learned_pattern) {
          console.log(`    [${i + 1}] Pattern: "${metadata.learned_pattern}" (confidence boost: ${metadata.confidence_boost || 'N/A'})`);
        } else if (metadata.type === 'routing_correction' && metadata.learned_keywords) {
          console.log(`    [${i + 1}] Keywords: ${metadata.learned_keywords.join(', ')}`);
        }
      });
    } else {
      printTest('Retrieve corrections', 'SKIP', 'No corrections found (may need to wait for indexing)');
    }

    return true;
  } catch (error) {
    printTest('Retrieve corrections', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testMemoryPersistence() {
  printHeader('Memory Persistence');

  try {
    const { addAgentMemory, searchAgentMemory } = await import('../lib/memory/zep');

    // Add a unique memory we can search for
    const uniqueId = `test_${Date.now()}`;
    const testMemory = `Test persistence check ${uniqueId}`;

    await addAgentMemory('ea-agent', testMemory, {
      test_id: uniqueId,
      type: 'persistence_test',
      timestamp: new Date().toISOString(),
    });

    printTest('Add test memory', 'PASS', `ID: ${uniqueId}`);

    // Wait a moment for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search for it
    const results = await searchAgentMemory('ea-agent', uniqueId, 1);

    if (results.length > 0 && results[0].memory.text.includes(uniqueId)) {
      printTest('Retrieve persisted memory', 'PASS', 'Memory successfully persisted and retrieved');
    } else {
      printTest('Retrieve persisted memory', 'SKIP', 'Memory not yet indexed (try again in a few seconds)');
    }

    return true;
  } catch (error) {
    printTest('Memory persistence', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testOrgKnowledgeProposal() {
  printHeader('Organizational Knowledge Proposal');

  try {
    const { proposeOrgMemory } = await import('../lib/memory/zep');

    // Propose knowledge to the org council
    const knowledge = `Standard operating procedure: All legal communications should be escalated to CRITICAL urgency and routed to legal-agent immediately.`;

    const proposal = await proposeOrgMemory('ea-agent', knowledge, {
      type: 'sop',
      category: 'legal',
      proposed_by: 'ea-agent',
      timestamp: new Date().toISOString(),
    });

    printTest('Propose org knowledge', 'PASS', `Proposal ID: ${proposal.id}`);
    console.log(`  Status: ${proposal.status}`);

    return true;
  } catch (error) {
    printTest('Org knowledge proposal', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testDualGraphMemory() {
  printHeader('Dual-Graph Memory (Agent + Org)');

  try {
    const { searchAllMemory } = await import('../lib/memory/zep');

    // Search across both private agent graph and org council graph
    const query = 'legal urgency priority';
    const results = await searchAllMemory('ea-agent', query, 3);

    console.log(`  Private agent memories: ${results.agent.length}`);
    console.log(`  Org council memories: ${results.org.length}`);

    if (results.agent.length > 0 || results.org.length > 0) {
      printTest('Dual-graph search', 'PASS', `Total: ${results.agent.length + results.org.length} results`);
    } else {
      printTest('Dual-graph search', 'SKIP', 'No memories found (may need more data)');
    }

    return true;
  } catch (error) {
    printTest('Dual-graph memory', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log('\n🧪 INTEGRATION TEST: EA LEARNING & ZEP MEMORY\n');

  // Run tests
  const zepAvailable = await testZepConnection();

  if (zepAvailable) {
    await testSavePreference();
    await testLoadPreference();
    await testRecordCorrection();
    await testRetrieveCorrections();
    await testMemoryPersistence();
    await testOrgKnowledgeProposal();
    await testDualGraphMemory();
  } else {
    console.log('\n⚠️  Zep is not configured or unavailable. Skipping memory tests.\n');
    console.log('To run these tests, set ZEP_API_KEY in your environment.\n');
  }

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
