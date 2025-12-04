/**
 * HYRO FORGE: Connector Usage Examples
 * Demonstrates how to use the platform connector system
 *
 * This file is for reference only - not meant to be imported
 */

import { connectorManager, type ManualEntry } from './index';

// ============================================================================
// Example 1: Get All Platform Status
// ============================================================================

async function example1_getStatus() {
  console.log('Example 1: Get all connector status\n');

  const statuses = connectorManager.getConnectorStatus();

  console.log('Registered Connectors:');
  for (const status of statuses) {
    console.log(`  - ${status.displayName} (${status.platformId})`);
    console.log(`    Healthy: ${status.isHealthy}`);
    console.log(`    Enabled: ${status.isEnabled}`);
    console.log(`    Last Sync: ${status.lastSync ? new Date(status.lastSync * 1000).toISOString() : 'Never'}`);
    console.log(`    Errors: ${status.errorCount}`);
    console.log('');
  }
}

// ============================================================================
// Example 2: Manual Entry - Simple Progress Update
// ============================================================================

async function example2_simpleManualEntry() {
  console.log('Example 2: Simple manual entry\n');

  const entry: ManualEntry = {
    platformId: 'boost',
    displayName: 'Boost Reading',
    subject: 'reading',
    title: 'Chapter 5: Advanced Comprehension',
    description: 'Completed reading comprehension exercises',
    percentComplete: 75,
    badges: 3,
    badgesTotal: 4,
    status: 'in_progress',
  };

  const result = await connectorManager.processManualEntry(entry);

  console.log('Sync Result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Items Synced: ${result.itemsSynced}`);
  console.log(`  Progress Records: ${result.progressRecords}`);
  console.log(`  Assignment Records: ${result.assignmentRecords}`);
  console.log(`  Memory Records: ${result.memoryRecords}`);
  console.log(`  Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of result.errors) {
      console.log(`  - [${error.category}] ${error.message}`);
    }
  }
}

// ============================================================================
// Example 3: Manual Entry with Quest Generation
// ============================================================================

async function example3_manualEntryWithQuest() {
  console.log('Example 3: Manual entry with quest generation\n');

  const entry: ManualEntry = {
    platformId: 'lexia',
    displayName: 'Lexia Core5',
    subject: 'reading',
    title: 'Unit 7: Vocabulary Building',
    description: 'Complete vocabulary exercises and quiz',
    percentComplete: 50,
    dueDate: '2025-12-15',
    status: 'in_progress',
    difficulty: 'medium',
    estimatedMinutes: 30,
    generateQuest: true, // This will create a Forge quest
  };

  const result = await connectorManager.processManualEntry(entry);

  console.log('Sync Result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Items Synced: ${result.itemsSynced}`);
  console.log(`  Quests Generated: ${result.questsGenerated || 0}`);
}

// ============================================================================
// Example 4: Get Progress for All Platforms
// ============================================================================

async function example4_getAllProgress() {
  console.log('Example 4: Get all platform progress\n');

  const progressMap = await connectorManager.getAllProgress();

  console.log('Platform Progress:');
  for (const [platformId, progress] of progressMap.entries()) {
    console.log(`\n  ${progress.displayName}:`);
    console.log(`    Completion: ${progress.percentComplete || 0}%`);
    if (progress.badges && progress.badgesTotal) {
      console.log(`    Badges: ${progress.badges}/${progress.badgesTotal}`);
    }
    if (progress.currentMission) {
      console.log(`    Current: ${progress.currentMission}`);
    }
    if (progress.paceStatus) {
      console.log(`    Pace: ${progress.paceStatus.toUpperCase()}`);
    }
  }
}

// ============================================================================
// Example 5: Sync Specific Platform
// ============================================================================

async function example5_syncZearn() {
  console.log('Example 5: Sync Zearn platform\n');

  // Note: This will fail until screenshot OCR is implemented
  const result = await connectorManager.syncPlatform('zearn');

  console.log('Sync Result:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Platform: ${result.platformId}`);
  console.log(`  Items Synced: ${result.itemsSynced}`);

  if (!result.success && result.errors.length > 0) {
    console.log('\nExpected error (screenshot OCR not implemented):');
    console.log(`  ${result.errors[0].message}`);
  }
}

// ============================================================================
// Example 6: Sync All Platforms
// ============================================================================

async function example6_syncAll() {
  console.log('Example 6: Sync all platforms\n');

  const results = await connectorManager.syncAll();

  console.log('Sync Summary:');
  console.log(`  Platforms processed: ${results.size}`);

  let successCount = 0;
  let failCount = 0;
  let totalItems = 0;

  for (const [platformId, result] of results.entries()) {
    if (result.success) {
      successCount++;
      totalItems += result.itemsSynced;
    } else {
      failCount++;
    }

    console.log(`\n  ${platformId}:`);
    console.log(`    Success: ${result.success}`);
    console.log(`    Items: ${result.itemsSynced}`);
    if (result.errors.length > 0) {
      console.log(`    Errors: ${result.errors.length}`);
    }
  }

  console.log(`\n  Total Success: ${successCount}`);
  console.log(`  Total Failed: ${failCount}`);
  console.log(`  Total Items Synced: ${totalItems}`);
}

// ============================================================================
// Example 7: Handle Connector Errors
// ============================================================================

async function example7_errorHandling() {
  console.log('Example 7: Error handling and recovery\n');

  // Get initial status
  const statuses = connectorManager.getConnectorStatus();
  const zearnStatus = statuses.find((s) => s.platformId === 'zearn');

  console.log('Initial Zearn Status:');
  console.log(`  Healthy: ${zearnStatus?.isHealthy}`);
  console.log(`  Consecutive Failures: ${zearnStatus?.consecutiveFailures}`);
  console.log(`  Total Errors: ${zearnStatus?.errorCount}`);

  // Try to sync (will fail)
  await connectorManager.syncPlatform('zearn');

  // Check status after failure
  const statusesAfter = connectorManager.getConnectorStatus();
  const zearnStatusAfter = statusesAfter.find((s) => s.platformId === 'zearn');

  console.log('\nAfter Failed Sync:');
  console.log(`  Healthy: ${zearnStatusAfter?.isHealthy}`);
  console.log(`  Consecutive Failures: ${zearnStatusAfter?.consecutiveFailures}`);
  console.log(`  Total Errors: ${zearnStatusAfter?.errorCount}`);

  // Reset errors
  connectorManager.resetErrors('zearn');

  const statusesReset = connectorManager.getConnectorStatus();
  const zearnStatusReset = statusesReset.find((s) => s.platformId === 'zearn');

  console.log('\nAfter Reset:');
  console.log(`  Healthy: ${zearnStatusReset?.isHealthy}`);
  console.log(`  Consecutive Failures: ${zearnStatusReset?.consecutiveFailures}`);
  console.log(`  Total Errors: ${zearnStatusReset?.errorCount}`);
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  try {
    await example1_getStatus();
    console.log('\n' + '='.repeat(80) + '\n');

    await example2_simpleManualEntry();
    console.log('\n' + '='.repeat(80) + '\n');

    await example3_manualEntryWithQuest();
    console.log('\n' + '='.repeat(80) + '\n');

    await example4_getAllProgress();
    console.log('\n' + '='.repeat(80) + '\n');

    await example5_syncZearn();
    console.log('\n' + '='.repeat(80) + '\n');

    await example6_syncAll();
    console.log('\n' + '='.repeat(80) + '\n');

    await example7_errorHandling();
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Export for testing
export {
  example1_getStatus,
  example2_simpleManualEntry,
  example3_manualEntryWithQuest,
  example4_getAllProgress,
  example5_syncZearn,
  example6_syncAll,
  example7_errorHandling,
  runAllExamples,
};
