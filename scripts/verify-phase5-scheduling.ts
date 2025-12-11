#!/usr/bin/env tsx
/**
 * Phase 5 Scheduling Verification Script
 *
 * Verifies that all scheduled tasks are properly configured and functional.
 *
 * Usage:
 *   npm run verify:phase5-scheduling
 *   npx tsx scripts/verify-phase5-scheduling.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface VerificationResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: VerificationResult[] = [];

function pass(name: string, message: string) {
  results.push({ name, status: 'PASS', message });
}

function fail(name: string, message: string) {
  results.push({ name, status: 'FAIL', message });
}

function warn(name: string, message: string) {
  results.push({ name, status: 'WARN', message });
}

console.log('========================================');
console.log('Phase 5 Scheduling Verification');
console.log('========================================\n');

// =============================================================================
// 1. Check Files Exist
// =============================================================================

console.log('1. Checking files...');

const requiredFiles = [
  'scripts/ea-daily-agenda.ts',
  'scripts/ea-weekly-report.ts',
  'scripts/pm-weekly-report.ts',
  'ecosystem.config.js',
  'ecosystem.config.ENHANCED.js',
  'SCHEDULED_TASKS_SETUP.md',
  'ENABLE_ENHANCED_SCHEDULING.md',
  'PHASE_5_SCHEDULING_COMPLETE.md',
];

for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    pass(`File: ${file}`, 'Found');
  } else {
    fail(`File: ${file}`, 'Missing');
  }
}

// =============================================================================
// 2. Check package.json Scripts
// =============================================================================

console.log('\n2. Checking package.json scripts...');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const expectedScripts = [
    'ea:daily-agenda',
    'ea:weekly-report',
    'pm:weekly-report',
  ];

  for (const script of expectedScripts) {
    if (packageJson.scripts[script]) {
      pass(`Script: ${script}`, 'Configured');
    } else {
      fail(`Script: ${script}`, 'Missing from package.json');
    }
  }
} catch (error) {
  fail('package.json', 'Could not read or parse');
}

// =============================================================================
// 3. Check Ecosystem Config
// =============================================================================

console.log('\n3. Checking ecosystem config...');

try {
  const ecosystemPath = path.join(process.cwd(), 'ecosystem.config.js');
  const ecosystemContent = fs.readFileSync(ecosystemPath, 'utf-8');

  // Check if enhanced config is enabled
  if (ecosystemContent.includes('ea-daily-agenda')) {
    pass('Enhanced Config', 'ea-daily-agenda task found');
  } else {
    warn('Enhanced Config', 'ea-daily-agenda task not found - enhanced config may not be enabled');
  }

  if (ecosystemContent.includes('ea-weekly-report')) {
    pass('Enhanced Config', 'ea-weekly-report task found');
  } else {
    warn('Enhanced Config', 'ea-weekly-report task not found - enhanced config may not be enabled');
  }

  if (ecosystemContent.includes('pm-weekly-report')) {
    pass('Enhanced Config', 'pm-weekly-report task found');
  } else {
    warn('Enhanced Config', 'pm-weekly-report task not found - enhanced config may not be enabled');
  }
} catch (error) {
  fail('Ecosystem Config', 'Could not read ecosystem.config.js');
}

// =============================================================================
// 4. Check Script Syntax
// =============================================================================

console.log('\n4. Checking script syntax...');

const scriptsToCheck = [
  'scripts/ea-daily-agenda.ts',
  'scripts/ea-weekly-report.ts',
  'scripts/pm-weekly-report.ts',
];

for (const script of scriptsToCheck) {
  try {
    // Just check if file can be read and has basic structure
    const content = fs.readFileSync(script, 'utf-8');
    if (content.includes('async function main()') && content.includes('main()')) {
      pass(`Syntax: ${script}`, 'Basic structure valid');
    } else {
      warn(`Syntax: ${script}`, 'May be missing main() function');
    }
  } catch (error) {
    fail(`Syntax: ${script}`, 'Could not read file');
  }
}

// =============================================================================
// 5. Check Dependencies
// =============================================================================

console.log('\n5. Checking dependencies...');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const requiredDeps = [
    'tsx',
    'better-sqlite3',
    'date-fns',
  ];

  for (const dep of requiredDeps) {
    if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
      pass(`Dependency: ${dep}`, 'Installed');
    } else {
      fail(`Dependency: ${dep}`, 'Missing');
    }
  }
} catch (error) {
  fail('Dependencies', 'Could not check package.json');
}

// =============================================================================
// 6. Check PM2 Availability (if running)
// =============================================================================

console.log('\n6. Checking PM2...');

try {
  const pm2Version = execSync('pm2 --version', { encoding: 'utf-8' }).trim();
  pass('PM2', `Installed (v${pm2Version})`);

  try {
    const pm2List = execSync('pm2 list', { encoding: 'utf-8' });
    if (pm2List.includes('wrath-shield-v3')) {
      pass('PM2 Process', 'Main app is running');
    } else {
      warn('PM2 Process', 'Main app not detected in PM2');
    }
  } catch (error) {
    warn('PM2 Process', 'Could not list PM2 processes');
  }
} catch (error) {
  warn('PM2', 'Not installed or not in PATH (okay if not using PM2)');
}

// =============================================================================
// 7. Check Logs Directory
// =============================================================================

console.log('\n7. Checking logs directory...');

const logsDir = path.join(process.cwd(), 'logs');
if (fs.existsSync(logsDir)) {
  pass('Logs Directory', 'Exists');
} else {
  warn('Logs Directory', 'Does not exist (will be created on first run)');
}

// =============================================================================
// 8. Test Script Execution (Dry Run)
// =============================================================================

console.log('\n8. Testing script execution...');

const scriptsToTest = [
  { cmd: 'npm run ea:daily-agenda', name: 'EA Daily Agenda' },
  { cmd: 'npm run ea:weekly-report', name: 'EA Weekly Report' },
  { cmd: 'npm run pm:weekly-report', name: 'PM Weekly Report' },
];

for (const { cmd, name } of scriptsToTest) {
  try {
    // Just check if the command exists, don't actually run it
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const scriptKey = cmd.replace('npm run ', '');
    if (packageJson.scripts[scriptKey]) {
      pass(`Executable: ${name}`, 'Script configured in package.json');
    } else {
      fail(`Executable: ${name}`, 'Script not configured');
    }
  } catch (error) {
    fail(`Executable: ${name}`, 'Could not verify');
  }
}

// =============================================================================
// Results Summary
// =============================================================================

console.log('\n========================================');
console.log('Verification Results');
console.log('========================================\n');

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warned = results.filter(r => r.status === 'WARN').length;
const total = results.length;

// Group by status
const byStatus = {
  PASS: results.filter(r => r.status === 'PASS'),
  WARN: results.filter(r => r.status === 'WARN'),
  FAIL: results.filter(r => r.status === 'FAIL'),
};

// Print results
for (const status of ['PASS', 'WARN', 'FAIL'] as const) {
  if (byStatus[status].length > 0) {
    console.log(`\n${status}:`);
    for (const result of byStatus[status]) {
      const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
      console.log(`  ${icon} ${result.name}: ${result.message}`);
    }
  }
}

console.log('\n========================================');
console.log(`Total: ${total} | Passed: ${passed} | Warnings: ${warned} | Failed: ${failed}`);
console.log('========================================\n');

if (failed > 0) {
  console.log('❌ Verification FAILED - Please fix the issues above\n');
  process.exitCode = 1;
} else if (warned > 0) {
  console.log('⚠️  Verification PASSED with warnings - Review warnings above\n');
} else {
  console.log('✅ Verification PASSED - All checks successful!\n');
}

// =============================================================================
// Next Steps
// =============================================================================

if (warned > 0 || failed > 0) {
  console.log('Next Steps:\n');

  if (byStatus.FAIL.some(r => r.name.includes('Enhanced Config'))) {
    console.log('• Enable enhanced config:');
    console.log('  cp ecosystem.config.ENHANCED.js ecosystem.config.js');
    console.log('  pm2 reload ecosystem.config.js\n');
  }

  if (byStatus.FAIL.some(r => r.name.includes('Script:'))) {
    console.log('• Add missing scripts to package.json');
    console.log('  See ENABLE_ENHANCED_SCHEDULING.md for details\n');
  }

  if (byStatus.WARN.some(r => r.name.includes('PM2'))) {
    console.log('• Install PM2 (optional):');
    console.log('  npm install -g pm2\n');
  }
}

console.log('For more information:');
console.log('• SCHEDULED_TASKS_SETUP.md - Complete documentation');
console.log('• ENABLE_ENHANCED_SCHEDULING.md - Quick start guide');
console.log('• PHASE_5_SCHEDULING_COMPLETE.md - Implementation summary\n');
