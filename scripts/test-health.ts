/**
 * Integration Test: Agent Health Monitoring
 *
 * Tests the agent health monitoring system:
 * 1. Does getSquadHealth return data?
 * 2. Is Zep latency check working?
 *
 * Run with: npx tsx scripts/test-health.ts
 */

import {
  getAgentHealth,
  getSquadHealth,
  getAgentsHealth,
  getQuickAgentHealth,
  type AgentHealthMetrics,
  type SquadHealthSummary,
} from '../lib/agents/health';

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

function getHealthStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy': return '🟢';
    case 'idle': return '🔵';
    case 'degraded': return '🟡';
    case 'offline': return '🔴';
    default: return '⚪';
  }
}

async function testSingleAgentHealth() {
  printHeader('Single Agent Health Check');

  try {
    const health = await getAgentHealth('agent.orchestrator');

    if (health) {
      printTest('Get agent health', 'PASS', `Agent: ${health.agentId}`);

      console.log(`\n  Health Details:`);
      console.log(`    ${getHealthStatusEmoji(health.status)} Status: ${health.status}`);
      console.log(`    Last Activity: ${health.lastActivityAgo}`);
      console.log(`    Health Score: ${health.healthScore}/100`);
      console.log(`    Memory: ${health.memoryStatus} (${health.memoryLatencyMs || 'N/A'}ms)`);
      console.log(`    Recent Calls: ${health.totalRecentCalls}`);
      console.log(`    Error Rate: ${(health.errorRate * 100).toFixed(1)}%`);
      console.log(`    Avg Latency: ${health.avgResponseLatencyMs}ms`);
      console.log(`    Avg Tokens: ${health.avgTokenUsage}`);
      console.log(`    Token Trend: ${health.tokenUsageTrend}`);

      // Verify structure
      if (
        typeof health.agentId === 'string' &&
        typeof health.status === 'string' &&
        typeof health.healthScore === 'number'
      ) {
        printTest('Health data structure', 'PASS', 'All fields present and correct types');
      } else {
        printTest('Health data structure', 'FAIL', 'Invalid data structure');
      }

      // Verify health score is in valid range
      if (health.healthScore >= 0 && health.healthScore <= 100) {
        printTest('Health score range', 'PASS', `Score: ${health.healthScore}/100`);
      } else {
        printTest('Health score range', 'FAIL', `Invalid score: ${health.healthScore}`);
      }

      return true;
    } else {
      printTest('Get agent health', 'FAIL', 'No health data returned');
      return false;
    }
  } catch (error) {
    printTest('Single agent health', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testSquadHealth() {
  printHeader('Squad Health Check');

  try {
    const squadHealth = await getSquadHealth();

    if (squadHealth) {
      printTest('Get squad health', 'PASS', `Timestamp: ${squadHealth.timestamp}`);

      console.log(`\n  Squad Overview:`);
      console.log(`    Squad Health Score: ${squadHealth.squadHealthScore}/100`);
      console.log(`    🟢 Healthy: ${squadHealth.activeAgents}`);
      console.log(`    🔵 Idle: ${squadHealth.idleAgents}`);
      console.log(`    🟡 Degraded: ${squadHealth.degradedAgents}`);
      console.log(`    🔴 Offline: ${squadHealth.offlineAgents}`);
      console.log(`    Total Agents: ${squadHealth.agents.length}`);
      console.log(`    Avg Memory Latency: ${squadHealth.avgMemoryLatencyMs}ms`);

      // List all agents with status
      console.log(`\n  Agent Status:`);
      squadHealth.agents.forEach((agent, i) => {
        const emoji = getHealthStatusEmoji(agent.status);
        console.log(`    ${emoji} ${agent.agentId} - ${agent.status} (${agent.healthScore}/100)`);
        console.log(`       Last active: ${agent.lastActivityAgo}, Memory: ${agent.memoryStatus}`);
      });

      // Verify squad health has all agents
      if (squadHealth.agents.length > 0) {
        printTest('All agents monitored', 'PASS', `${squadHealth.agents.length} agents tracked`);
      } else {
        printTest('All agents monitored', 'FAIL', 'No agents found');
      }

      // Verify totals add up
      const calculatedTotal =
        squadHealth.activeAgents +
        squadHealth.idleAgents +
        squadHealth.degradedAgents +
        squadHealth.offlineAgents;

      if (calculatedTotal === squadHealth.agents.length) {
        printTest('Status counts accurate', 'PASS', `Total matches: ${calculatedTotal}`);
      } else {
        printTest('Status counts accurate', 'FAIL', `Mismatch: ${calculatedTotal} vs ${squadHealth.agents.length}`);
      }

      return squadHealth;
    } else {
      printTest('Get squad health', 'FAIL', 'No squad health data returned');
      return null;
    }
  } catch (error) {
    printTest('Squad health', 'FAIL', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testMultipleAgentsHealth() {
  printHeader('Multiple Agents Health Check');

  try {
    const agentIds = ['agent.orchestrator', 'agent.legal', 'agent.finance', 'agent.pm'];
    const healthMetrics = await getAgentsHealth(agentIds);

    if (healthMetrics && healthMetrics.length === agentIds.length) {
      printTest('Get multiple agents health', 'PASS', `Retrieved ${healthMetrics.length} agents`);

      console.log(`\n  Results:`);
      healthMetrics.forEach((health, i) => {
        const emoji = getHealthStatusEmoji(health.status);
        console.log(`    ${emoji} ${health.agentId}: ${health.status} (${health.healthScore}/100)`);
      });

      return true;
    } else {
      printTest('Get multiple agents health', 'FAIL', `Expected ${agentIds.length}, got ${healthMetrics?.length || 0}`);
      return false;
    }
  } catch (error) {
    printTest('Multiple agents health', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testQuickHealthCheck() {
  printHeader('Quick Health Check (No Memory Latency)');

  try {
    const quickHealth = getQuickAgentHealth('agent.orchestrator');

    if (quickHealth) {
      printTest('Quick health check', 'PASS', `Status: ${quickHealth.status}`);

      console.log(`\n  Quick Check Results:`);
      console.log(`    Status: ${quickHealth.status}`);
      console.log(`    Health Score: ${quickHealth.healthScore}/100`);
      console.log(`    Memory: ${quickHealth.memoryStatus} (skipped latency check)`);
      console.log(`    Last Activity: ${quickHealth.lastActivityAgo}`);

      // Verify memory status is 'unknown' (since we skip the check)
      if (quickHealth.memoryStatus === 'unknown') {
        printTest('Memory latency skipped', 'PASS', 'Quick check skips memory latency');
      } else {
        printTest('Memory latency skipped', 'FAIL', `Expected 'unknown', got '${quickHealth.memoryStatus}'`);
      }

      return true;
    } else {
      printTest('Quick health check', 'FAIL', 'No data returned');
      return false;
    }
  } catch (error) {
    printTest('Quick health check', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testZepLatencyCheck() {
  printHeader('Zep Memory Latency Check');

  if (!process.env.ZEP_API_KEY) {
    printTest('Zep latency check', 'SKIP', 'ZEP_API_KEY not configured');
    return true;
  }

  try {
    const health = await getAgentHealth('agent.orchestrator');

    if (health) {
      console.log(`\n  Memory Status: ${health.memoryStatus}`);
      console.log(`  Memory Latency: ${health.memoryLatencyMs || 'N/A'}ms`);

      if (health.memoryStatus === 'connected') {
        printTest('Zep connected', 'PASS', `Latency: ${health.memoryLatencyMs}ms`);
      } else if (health.memoryStatus === 'latent') {
        printTest('Zep latent', 'PASS', `High latency: ${health.memoryLatencyMs}ms`);
      } else {
        printTest('Zep unavailable', 'FAIL', 'Could not connect to Zep');
      }

      // Verify latency is reasonable (under 10 seconds)
      if (health.memoryLatencyMs && health.memoryLatencyMs < 10000) {
        printTest('Latency acceptable', 'PASS', `${health.memoryLatencyMs}ms < 10s`);
      } else if (health.memoryLatencyMs) {
        printTest('Latency acceptable', 'FAIL', `${health.memoryLatencyMs}ms is too high`);
      } else {
        printTest('Latency acceptable', 'SKIP', 'No latency data available');
      }

      return true;
    } else {
      printTest('Zep latency check', 'FAIL', 'No health data');
      return false;
    }
  } catch (error) {
    printTest('Zep latency check', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testHealthStatusDetermination() {
  printHeader('Health Status Determination');

  try {
    const squadHealth = await getSquadHealth();

    if (!squadHealth) {
      printTest('Health status determination', 'SKIP', 'No squad health data');
      return true;
    }

    // Check for different status types
    const hasHealthy = squadHealth.agents.some(a => a.status === 'healthy');
    const hasIdle = squadHealth.agents.some(a => a.status === 'idle');
    const hasDegraded = squadHealth.agents.some(a => a.status === 'degraded');
    const hasOffline = squadHealth.agents.some(a => a.status === 'offline');

    const statusTypes = [
      hasHealthy ? 'healthy' : null,
      hasIdle ? 'idle' : null,
      hasDegraded ? 'degraded' : null,
      hasOffline ? 'offline' : null,
    ].filter(Boolean);

    if (statusTypes.length > 0) {
      printTest('Status variety', 'PASS', `Found statuses: ${statusTypes.join(', ')}`);
    } else {
      printTest('Status variety', 'FAIL', 'No status types found');
    }

    // Check that health scores correlate with status
    const healthyAgents = squadHealth.agents.filter(a => a.status === 'healthy');
    const offlineAgents = squadHealth.agents.filter(a => a.status === 'offline');

    if (healthyAgents.length > 0) {
      const avgHealthyScore = healthyAgents.reduce((sum, a) => sum + a.healthScore, 0) / healthyAgents.length;
      console.log(`\n  Avg Healthy Score: ${avgHealthyScore.toFixed(0)}/100`);

      if (avgHealthyScore > 70) {
        printTest('Healthy agents have high scores', 'PASS', `Avg: ${avgHealthyScore.toFixed(0)}/100`);
      } else {
        printTest('Healthy agents have high scores', 'FAIL', `Avg too low: ${avgHealthyScore.toFixed(0)}/100`);
      }
    }

    if (offlineAgents.length > 0) {
      const avgOfflineScore = offlineAgents.reduce((sum, a) => sum + a.healthScore, 0) / offlineAgents.length;
      console.log(`  Avg Offline Score: ${avgOfflineScore.toFixed(0)}/100`);

      if (avgOfflineScore < 50) {
        printTest('Offline agents have low scores', 'PASS', `Avg: ${avgOfflineScore.toFixed(0)}/100`);
      } else {
        printTest('Offline agents have low scores', 'FAIL', `Avg too high: ${avgOfflineScore.toFixed(0)}/100`);
      }
    }

    return true;
  } catch (error) {
    printTest('Health status determination', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testPerformanceMetrics() {
  printHeader('Performance Metrics Tracking');

  try {
    const health = await getAgentHealth('agent.orchestrator');

    if (!health) {
      printTest('Performance metrics', 'SKIP', 'No health data');
      return true;
    }

    console.log(`\n  Performance Metrics:`);
    console.log(`    Avg Response Latency: ${health.avgResponseLatencyMs}ms`);
    console.log(`    Avg Token Usage: ${health.avgTokenUsage}`);
    console.log(`    Token Trend: ${health.tokenUsageTrend}`);
    console.log(`    Error Rate: ${(health.errorRate * 100).toFixed(1)}%`);
    console.log(`    Recent Calls: ${health.totalRecentCalls}`);
    console.log(`    Recent Errors: ${health.recentErrorCount}`);

    // Verify metrics are tracked
    if (typeof health.avgResponseLatencyMs === 'number') {
      printTest('Latency tracked', 'PASS', `${health.avgResponseLatencyMs}ms`);
    } else {
      printTest('Latency tracked', 'FAIL', 'No latency data');
    }

    if (typeof health.avgTokenUsage === 'number') {
      printTest('Token usage tracked', 'PASS', `${health.avgTokenUsage} tokens avg`);
    } else {
      printTest('Token usage tracked', 'FAIL', 'No token data');
    }

    if (['increasing', 'stable', 'decreasing', 'unknown'].includes(health.tokenUsageTrend)) {
      printTest('Token trend calculated', 'PASS', `Trend: ${health.tokenUsageTrend}`);
    } else {
      printTest('Token trend calculated', 'FAIL', `Invalid trend: ${health.tokenUsageTrend}`);
    }

    return true;
  } catch (error) {
    printTest('Performance metrics', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log('\n🧪 INTEGRATION TEST: AGENT HEALTH MONITORING\n');

  // Run tests
  await testSingleAgentHealth();
  await testSquadHealth();
  await testMultipleAgentsHealth();
  await testQuickHealthCheck();
  await testZepLatencyCheck();
  await testHealthStatusDetermination();
  await testPerformanceMetrics();

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
