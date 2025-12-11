#!/usr/bin/env npx tsx
/**
 * Integration Test Script
 *
 * Tests all major integrations with real data and logs results.
 * Run with: npx tsx scripts/test-integrations.ts
 *
 * Tests:
 * 1. Finance Module (Plaid)
 * 2. Bio-Data Module (WHOOP, Limitless)
 * 3. Legal Module (MyCase)
 * 4. Communications (Gmail, Outlook)
 * 5. Memory System (Zep, SQLite)
 * 6. LLM Providers (OpenAI, xAI, Ollama)
 */

// Load environment variables from .env.local BEFORE any other imports
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') });

import { createLogger, getRecentLogs, LogEntry } from '../lib/logger';

const log = createLogger('IntegrationTest');

interface TestResult {
  module: string;
  test: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  module: string,
  testName: string,
  fn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  log.info(`Running ${module}/${testName}...`);

  try {
    await fn();
    const result: TestResult = {
      module,
      test: testName,
      status: 'pass',
      duration: Date.now() - start,
    };
    log.info(`✓ ${module}/${testName} passed`, { durationMs: result.duration });
    results.push(result);
    return result;
  } catch (error: any) {
    const result: TestResult = {
      module,
      test: testName,
      status: 'fail',
      duration: Date.now() - start,
      error: error.message || String(error),
    };
    log.error(`✗ ${module}/${testName} failed`, { error: result.error });
    results.push(result);
    return result;
  }
}

function skipTest(module: string, testName: string, reason: string): TestResult {
  const result: TestResult = {
    module,
    test: testName,
    status: 'skip',
    duration: 0,
    details: reason,
  };
  log.warn(`⊘ ${module}/${testName} skipped: ${reason}`);
  results.push(result);
  return result;
}

// ============================================================================
// Finance Module Tests
// ============================================================================

async function testFinanceModule() {
  log.info('=== Testing Finance Module ===');

  // Check Plaid configuration
  const hasPlaidConfig =
    process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET;

  if (!hasPlaidConfig) {
    skipTest('Finance', 'Plaid Configuration', 'Missing PLAID_CLIENT_ID or PLAID_SECRET');
    return;
  }

  await runTest('Finance', 'Plaid Client', async () => {
    const { getPlaidClient } = await import('../lib/finance/plaid');
    const client = getPlaidClient();
    if (!client) throw new Error('Failed to create Plaid client');
  });

  await runTest('Finance', 'List Plaid Items', async () => {
    const { listPlaidItems } = await import('../lib/finance/plaid');
    const items = await listPlaidItems();
    log.info(`Found ${items.length} connected Plaid items`);
  });

  await runTest('Finance', 'Transaction Store', async () => {
    const { listByDateRange } = await import('../lib/finance/store');
    // Get last 30 days of transactions
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const txns = listByDateRange(start, end);
    log.info(`Transaction store has ${txns.length} transactions in last 30 days`);
  });

  await runTest('Finance', 'Classification Rules', async () => {
    const { classify } = await import('../lib/finance/rules');
    const testTxn = {
      id: 'test-1',
      account: 'test',
      amount: 50.0,
      iso_currency_code: 'USD',
      date: '2024-01-01',
      vendor: 'AMAZON',
      raw_desc: '{}',
      source: 'test' as const,
    };
    const classified = classify(testTxn);
    if (!classified.bucket) {
      log.warn('Transaction not classified - rules may need updating');
    }
  });
}

// ============================================================================
// Bio-Data Module Tests
// ============================================================================

async function testBioDataModule() {
  log.info('=== Testing Bio-Data Module ===');

  // WHOOP Tests - requires all three env vars via lib/config.ts
  const hasWhoopConfig =
    process.env.WHOOP_CLIENT_ID &&
    process.env.WHOOP_CLIENT_SECRET &&
    process.env.WHOOP_REDIRECT_URI;

  if (!hasWhoopConfig) {
    skipTest('BioData', 'WHOOP Configuration', 'Missing WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, or WHOOP_REDIRECT_URI');
  } else {
    await runTest('BioData', 'WHOOP Client Init', async () => {
      const { getWhoopClient } = await import('../lib/WhoopClient');
      const client = getWhoopClient();
      if (!client) throw new Error('Failed to create WHOOP client');
    });

    await runTest('BioData', 'WHOOP Token Check', async () => {
      const { getToken } = await import('../lib/db/queries');
      const token = getToken('whoop');
      if (!token) {
        throw new Error('No WHOOP token found - user needs to authenticate via /api/whoop/auth');
      }
      log.info('WHOOP token found', { expiresAt: token.expires_at });
    });
  }

  // Limitless Tests - API key stored in DB settings, not env var
  // Check if key exists in database settings table
  await runTest('BioData', 'Limitless Config Check', async () => {
    const { getSetting } = await import('../lib/db/queries');
    const setting = getSetting('limitless_api_key');
    if (!setting || !setting.value_enc) {
      throw new Error('Limitless API key not found in DB settings. Configure via POST /api/settings');
    }
    log.info('Limitless API key found in settings');
  });

  await runTest('BioData', 'Limitless Client', async () => {
    const { LimitlessClient } = await import('../lib/LimitlessClient');
    const client = new LimitlessClient();
    if (!client) throw new Error('Failed to create Limitless client');
  });

  await runTest('BioData', 'Limitless Recent Lifelogs', async () => {
    // LimitlessClient doesn't depend on getConfig() - it gets API key from DB settings
    const { LimitlessClient } = await import('../lib/LimitlessClient');
    const client = new LimitlessClient();
    // Fetch lifelogs from the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lifelogs = await client.fetchLifelogs({
      start_date: yesterday.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });
    log.info(`Retrieved ${lifelogs.length} recent lifelogs`);
  });
}

// ============================================================================
// Legal Module Tests
// ============================================================================

async function testLegalModule() {
  log.info('=== Testing Legal Module ===');

  // MyCase Tests - User confirmed they don't have MyCase credentials yet
  // Skip MyCase API tests but still test the legal store functionality
  skipTest('Legal', 'MyCase Configuration', 'MyCase credentials not configured (OAuth setup required)');

  // Test local legal store functionality (doesn't require MyCase API)
  await runTest('Legal', 'Legal Context Requests', async () => {
    const { listLegalContextRequests } = await import('../lib/legal/store');
    const requests = listLegalContextRequests();
    log.info(`Legal store has ${requests.length} context requests`);
  });

  await runTest('Legal', 'Legal Pending Actions', async () => {
    const { listPendingActions } = await import('../lib/legal/store');
    const actions = listPendingActions();
    log.info(`Legal store has ${actions.length} pending actions`);
  });
}

// ============================================================================
// Memory System Tests
// ============================================================================

async function testMemorySystem() {
  log.info('=== Testing Memory System ===');

  // SQLite Database
  await runTest('Memory', 'SQLite Database', async () => {
    const { getDatabase } = await import('../lib/db/Database');
    const db = getDatabase();
    if (!db) throw new Error('Failed to get database instance');

    // Test a simple query
    const result = db.prepare('SELECT 1 as test').get();
    if (!result || (result as any).test !== 1) {
      throw new Error('Database query failed');
    }
    log.info('SQLite database operational');
  });

  // Zep Memory - accepts either ZEP_API_KEY or ZEP_LEGAL_API_KEY
  const hasZepConfig = process.env.ZEP_API_KEY || process.env.ZEP_LEGAL_API_KEY;

  if (!hasZepConfig) {
    skipTest('Memory', 'Zep Configuration', 'Missing ZEP_API_KEY or ZEP_LEGAL_API_KEY');
  } else {
    await runTest('Memory', 'Zep Memory Client', async () => {
      const { initializeZep } = await import('../lib/memory/zep');
      await initializeZep();
      log.info('Zep memory client initialized');
    });

    await runTest('Memory', 'Zep Search', async () => {
      const { searchOrgMemory } = await import('../lib/memory/zep');
      const results = await searchOrgMemory('test', 5);
      log.info(`Zep search returned ${results?.length || 0} results`);
    });
  }
}

// ============================================================================
// LLM Provider Tests
// ============================================================================

async function testLLMProviders() {
  log.info('=== Testing LLM Providers ===');

  // xAI (Grok) - Primary LLM provider for most agents
  // Check for either XAI_API_KEY or XAI_API_KEY_DIRECT
  const xaiApiKey = process.env.XAI_API_KEY || process.env.XAI_API_KEY_DIRECT;
  if (!xaiApiKey) {
    skipTest('LLM', 'xAI Configuration', 'Missing XAI_API_KEY or XAI_API_KEY_DIRECT');
  } else {
    await runTest('LLM', 'xAI API Connection', async () => {
      const response = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${xaiApiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`xAI API error: ${response.status}`);
      }
      const data = await response.json();
      log.info('xAI API connected', { models: data.data?.length || 0 });
    });
  }

  // OpenAI - Used for finance, coaching, ea, health agents
  const hasOpenAiConfig = process.env.OPENAI_API_KEY;
  if (!hasOpenAiConfig) {
    skipTest('LLM', 'OpenAI Configuration', 'Missing OPENAI_API_KEY');
  } else {
    await runTest('LLM', 'OpenAI API Connection', async () => {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      const data = await response.json();
      log.info('OpenAI API connected', { models: data.data?.length || 0 });
    });
  }

  // OpenRouter - Fallback/alternative provider
  const hasOpenRouterConfig = process.env.OPENROUTER_API_KEY;
  if (!hasOpenRouterConfig) {
    skipTest('LLM', 'OpenRouter Configuration', 'Missing OPENROUTER_API_KEY');
  } else {
    await runTest('LLM', 'OpenRouter Client', async () => {
      const { OpenRouterClient } = await import('../lib/OpenRouterClient');
      const client = new OpenRouterClient();
      if (!client) throw new Error('Failed to create OpenRouter client');
    });
  }

  // Ollama - Local LLM for classification tasks
  await runTest('LLM', 'Ollama Connection', async () => {
    const response = await fetch('http://localhost:11434/api/version', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      throw new Error(`Ollama not running: ${response.status}`);
    }
    const data = await response.json();
    log.info('Ollama is running', { version: data.version });
  });

  await runTest('LLM', 'Ollama Models', async () => {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      throw new Error(`Failed to list Ollama models: ${response.status}`);
    }
    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];
    log.info(`Available Ollama models: ${models.length}`, { models });

    // Check for deepseek-r1:32b which is required for agent.comms and agent.relationships
    const hasDeepseek = models.some((m: string) => m.includes('deepseek-r1'));
    if (!hasDeepseek) {
      log.warn('deepseek-r1:32b not found - required for local classification agents');
    }
  });
}

// ============================================================================
// Event Bus Tests
// ============================================================================

async function testEventBus() {
  log.info('=== Testing Event Bus ===');

  await runTest('EventBus', 'Initialize', async () => {
    const { getEventBus } = await import('../lib/agents/life-os-event-bus');
    const bus = getEventBus();
    if (!bus) throw new Error('Failed to get event bus');
    log.info('Event bus initialized', bus.getStats());
  });

  await runTest('EventBus', 'Pub/Sub', async () => {
    const { getEventBus, generateEventId, resetEventBus } = await import(
      '../lib/agents/life-os-event-bus'
    );

    // Reset for clean test
    resetEventBus();
    const bus = getEventBus();

    let receivedEvent = false;
    const unsub = bus.subscribe(
      '*',
      async () => {
        receivedEvent = true;
      },
      100,
      'test-agent'
    );

    await bus.publish({
      id: generateEventId(),
      type: 'message',
      source: 'test',
      priority: 'normal',
      payload: { test: true },
      timestamp: new Date(),
    });

    unsub();

    if (!receivedEvent) {
      throw new Error('Event not received by subscriber');
    }
    log.info('Pub/Sub working correctly');
  });
}

// ============================================================================
// API Route Tests
// ============================================================================

async function testAPIRoutes() {
  log.info('=== Testing API Routes ===');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // First check if the server is running
  let serverRunning = false;
  try {
    const checkResponse = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(2000)
    });
    serverRunning = checkResponse.ok;
  } catch {
    // Server not running
  }

  if (!serverRunning) {
    skipTest('API', 'Health Check', 'Dev server not running (start with npm run dev)');
    skipTest('API', 'Agents Graph', 'Dev server not running (start with npm run dev)');
    return;
  }

  await runTest('API', 'Health Check', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    const data = await response.json();
    log.info('API health check passed', data);
  });

  await runTest('API', 'Agents Graph', async () => {
    const response = await fetch(`${baseUrl}/api/agents/graph`);
    if (!response.ok) {
      throw new Error(`Agents graph failed: ${response.status}`);
    }
    const data = await response.json();
    log.info(`Graph API returned ${data.nodes?.length || 0} nodes, ${data.edges?.length || 0} edges`);
  });
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  log.info('Starting Integration Tests');
  log.info('===========================');

  const startTime = Date.now();

  try {
    await testFinanceModule();
    await testBioDataModule();
    await testLegalModule();
    await testMemorySystem();
    await testLLMProviders();
    await testEventBus();
    await testAPIRoutes();
  } catch (error: any) {
    log.error('Test suite failed with unexpected error', error);
  }

  const totalDuration = Date.now() - startTime;

  // Summary
  log.info('===========================');
  log.info('Integration Test Summary');
  log.info('===========================');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║           INTEGRATION TEST RESULTS                 ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  ✓ Passed:  ${passed.toString().padEnd(39)}║`);
  console.log(`║  ✗ Failed:  ${failed.toString().padEnd(39)}║`);
  console.log(`║  ⊘ Skipped: ${skipped.toString().padEnd(39)}║`);
  console.log(`║  Total:     ${results.length.toString().padEnd(39)}║`);
  console.log(`║  Duration:  ${(totalDuration / 1000).toFixed(2)}s${''.padEnd(35)}║`);
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('\n');

  // Detailed results
  console.log('Detailed Results:');
  console.log('-'.repeat(60));

  const byModule = results.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {} as Record<string, TestResult[]>);

  for (const [module, tests] of Object.entries(byModule)) {
    console.log(`\n[${module}]`);
    for (const t of tests) {
      const icon = t.status === 'pass' ? '✓' : t.status === 'fail' ? '✗' : '⊘';
      const duration = t.duration > 0 ? ` (${t.duration}ms)` : '';
      const extra = t.error ? ` - ${t.error}` : t.details ? ` - ${t.details}` : '';
      console.log(`  ${icon} ${t.test}${duration}${extra}`);
    }
  }

  // Failed tests detail
  const failedTests = results.filter((r) => r.status === 'fail');
  if (failedTests.length > 0) {
    console.log('\n');
    console.log('Failed Tests:');
    console.log('-'.repeat(60));
    for (const t of failedTests) {
      console.log(`\n${t.module}/${t.test}:`);
      console.log(`  Error: ${t.error}`);
    }
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
