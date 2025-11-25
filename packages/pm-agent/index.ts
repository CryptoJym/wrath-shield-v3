/**
 * PM Agent - GitHub ↔ Motion Bi-directional Sync
 *
 * Main entry point for the PM agent.
 *
 * Usage:
 *   npx ts-node lib/pm-agent/index.ts [command] [options]
 *
 * Commands:
 *   sync          Run a sync cycle (default)
 *   init          Initialize project mappings from JSON
 *   status        Show sync status and recent logs
 *   mappings      List project mappings
 *
 * Options:
 *   --dry-run     Don't make any changes
 *   --project     Filter to specific project
 *   --verbose     Show detailed output
 *   --help        Show help
 */

import { MotionClient } from './motion-client';
import { PMAgentStore } from './store';
import { PMAgentSync, SyncResult } from './sync';
import { resolve } from 'path';

interface CLIOptions {
  command: 'sync' | 'init' | 'status' | 'mappings' | 'help';
  dryRun: boolean;
  project?: string;
  verbose: boolean;
  mappingsFile?: string;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    command: 'sync',
    dryRun: process.env.DRY_RUN === 'true',
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === 'sync' || arg === 'init' || arg === 'status' || arg === 'mappings' || arg === 'help') {
      options.command = arg;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--project' && args[i + 1]) {
      options.project = args[++i];
    } else if (arg === '--mappings' && args[i + 1]) {
      options.mappingsFile = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      options.command = 'help';
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
PM Agent - GitHub ↔ Motion Bi-directional Sync

Usage:
  npx ts-node lib/pm-agent/index.ts [command] [options]

Commands:
  sync          Run a sync cycle (default)
  init          Initialize project mappings from JSON
  status        Show sync status and recent logs
  mappings      List project mappings
  help          Show this help message

Options:
  --dry-run              Don't make any changes
  --project <name>       Filter to specific project
  --mappings <file>      Path to mappings JSON file (for init)
  --verbose, -v          Show detailed output
  --help, -h             Show help

Environment Variables:
  MOTION_API_KEY         Motion API key
  MOTION_WORKSPACE_ID    Motion workspace ID
  GITHUB_TOKEN           GitHub personal access token
  PM_AGENT_DB_PATH       Path to SQLite database
  DRY_RUN                Set to 'true' for dry-run mode

Examples:
  # Run sync in dry-run mode
  npx ts-node lib/pm-agent/index.ts sync --dry-run --verbose

  # Sync specific project
  npx ts-node lib/pm-agent/index.ts sync --project "CRO of One"

  # Initialize mappings
  npx ts-node lib/pm-agent/index.ts init --mappings motion_github_mappings.json

  # Check status
  npx ts-node lib/pm-agent/index.ts status
`);
}

async function runSync(options: CLIOptions): Promise<void> {
  console.log('🔄 PM Agent Sync');
  console.log('================');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  const sync = new PMAgentSync({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  const result = await sync.runSync({
    dryRun: options.dryRun,
    projectFilter: options.project,
    verbose: options.verbose,
  });

  printSyncResult(result);
}

function printSyncResult(result: SyncResult): void {
  console.log('\n📊 Sync Results');
  console.log('---------------');
  console.log(`Run ID:    ${result.runId}`);
  console.log(`Started:   ${result.startedAt}`);
  console.log(`Completed: ${result.completedAt}`);
  console.log('');
  console.log('Stats:');
  console.log(`  Tasks Processed: ${result.stats.tasksProcessed}`);
  console.log(`  Created:         ${result.stats.created}`);
  console.log(`  Updated:         ${result.stats.updated}`);
  console.log(`  Closed:          ${result.stats.closed}`);
  console.log(`  Skipped:         ${result.stats.skipped}`);
  console.log(`  Errors:          ${result.stats.errors}`);

  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const err of result.errors) {
      console.log(`  - ${err.entity}: ${err.error}`);
    }
  }

  if (result.stats.errors === 0) {
    console.log('\n✅ Sync completed successfully!');
  } else {
    console.log('\n⚠️  Sync completed with errors');
  }
}

async function runInit(options: CLIOptions): Promise<void> {
  const mappingsFile = options.mappingsFile || resolve(process.cwd(), 'motion_github_mappings.json');

  console.log('📥 Initializing Project Mappings');
  console.log('================================');
  console.log(`File: ${mappingsFile}\n`);

  const sync = new PMAgentSync({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  const count = await sync.initializeMappings(mappingsFile);
  console.log(`✅ Imported ${count} project mappings`);
}

async function showStatus(): Promise<void> {
  console.log('📈 PM Agent Status');
  console.log('==================\n');

  const store = new PMAgentStore();

  // Show sync stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStats = store.getSyncStats(today);
  const allTimeStats = store.getSyncStats();

  console.log('Today:');
  console.log(`  Total:   ${todayStats.total}`);
  console.log(`  Success: ${todayStats.success}`);
  console.log(`  Errors:  ${todayStats.error}`);
  console.log(`  Skipped: ${todayStats.skipped}`);

  console.log('\nAll Time:');
  console.log(`  Total:   ${allTimeStats.total}`);
  console.log(`  Success: ${allTimeStats.success}`);
  console.log(`  Errors:  ${allTimeStats.error}`);
  console.log(`  Skipped: ${allTimeStats.skipped}`);

  // Show recent logs
  const recentLogs = store.getRecentLogs(10);
  if (recentLogs.length > 0) {
    console.log('\nRecent Activity:');
    for (const log of recentLogs) {
      const icon = log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '○';
      console.log(`  ${icon} [${log.created_at}] ${log.action} ${log.entity_type} ${log.motion_id || log.github_ref}`);
    }
  }

  store.close();
}

async function showMappings(): Promise<void> {
  console.log('🗺️  Project Mappings');
  console.log('===================\n');

  const store = new PMAgentStore();
  const mappings = store.getAllProjectMappings();

  if (mappings.length === 0) {
    console.log('No mappings found. Run "init" to import mappings.\n');
    return;
  }

  for (const m of mappings) {
    const status = m.enabled ? '✓' : '○';
    console.log(`${status} ${m.motion_project_name}`);
    console.log(`    Motion: ${m.motion_project_id}`);
    console.log(`    GitHub: ${m.github_owner}/${m.github_repo}`);
    console.log(`    Confidence: ${m.confidence}`);
    console.log('');
  }

  store.close();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  try {
    switch (options.command) {
      case 'help':
        printHelp();
        break;
      case 'sync':
        await runSync(options);
        break;
      case 'init':
        await runInit(options);
        break;
      case 'status':
        await showStatus();
        break;
      case 'mappings':
        await showMappings();
        break;
      default:
        printHelp();
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Export for programmatic use
export { MotionClient, PMAgentStore, PMAgentSync };
export * from './mapper';

// Run if executed directly
if (require.main === module) {
  main();
}
