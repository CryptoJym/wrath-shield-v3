#!/usr/bin/env tsx
/**
 * Phase 3 Verification Script
 * Verifies that agent subscriptions are properly configured
 */

import { getSubscriptionStats, AGENT_SUBSCRIPTIONS } from '../lib/agents/agent-subscriptions';
import { getEventBus } from '../lib/agents/life-os-event-bus';

console.log('='.repeat(60));
console.log('Phase 3: Agent Subscription Configuration - Verification');
console.log('='.repeat(60));
console.log();

// 1. Verify subscription configuration
console.log('1. Subscription Configuration:');
const stats = getSubscriptionStats();
console.log(`   ✓ Total Agents: ${stats.totalAgents}`);
console.log(`   ✓ Total Patterns: ${stats.totalPatterns}`);
console.log();

// 2. Verify each agent
console.log('2. Agent Details:');
for (const detail of stats.agentDetails) {
  console.log(`   • ${detail.agentId.padEnd(30)} ${detail.patternCount} pattern(s)`);
}
console.log();

// 3. Verify critical agents
console.log('3. Critical Agent Check:');
const criticalAgents = [
  'agent.orchestrator',
  'agent.ea',
  'agent.comms',
  'agent.finance',
  'agent.legal',
  'agent.pm'
];

for (const agentId of criticalAgents) {
  const found = AGENT_SUBSCRIPTIONS.find(a => a.agentId === agentId);
  if (found) {
    console.log(`   ✓ ${agentId}`);
  } else {
    console.log(`   ✗ ${agentId} - MISSING!`);
  }
}
console.log();

// 4. Verify event bus integration (import triggers initialization in tests)
console.log('4. Event Bus Integration:');
const bus = getEventBus();
const busStats = bus.getStats();
console.log(`   ✓ Unique patterns: ${busStats.patterns}`);
console.log(`   ✓ Total subscriptions: ${busStats.totalSubscriptions}`);
console.log(`   ✓ Recent events: ${busStats.recentEvents}`);
console.log();

// 5. Verify priority ranges
console.log('5. Priority Validation:');
let allValid = true;
for (const config of AGENT_SUBSCRIPTIONS) {
  for (const { pattern, priority } of config.patterns) {
    if (priority < 0 || priority > 100) {
      console.log(`   ✗ ${config.agentId}: ${pattern} has invalid priority ${priority}`);
      allValid = false;
    }
  }
}
if (allValid) {
  console.log('   ✓ All priorities in valid range (0-100)');
}
console.log();

// 6. Verify orchestrator has wildcard
console.log('6. Orchestrator Configuration:');
const orchestrator = AGENT_SUBSCRIPTIONS.find(a => a.agentId === 'agent.orchestrator');
if (orchestrator) {
  const hasWildcard = orchestrator.patterns.some(p => p.pattern === '*');
  if (hasWildcard) {
    console.log('   ✓ Orchestrator has wildcard pattern (*)');
  } else {
    console.log('   ✗ Orchestrator missing wildcard pattern!');
  }
} else {
  console.log('   ✗ Orchestrator agent not found!');
}
console.log();

// Summary
console.log('='.repeat(60));
console.log('Phase 3 Verification Complete');
console.log('='.repeat(60));
console.log();
console.log('Next Steps:');
console.log('  1. Run: npm test -- --testPathPatterns="agent-subscriptions"');
console.log('  2. Start server: npm run dev');
console.log('  3. Check logs for: "[Instrumentation] Life OS Event Bus initialized"');
console.log('  4. Proceed to Phase 4: AgentInvoker implementation');
console.log();
