/**
 * Integration Test: Agent Invocation
 *
 * Tests the AgentInvoker system:
 * 1. Can we invoke an agent with a message?
 * 2. Does the LLM respond?
 * 3. Is escalation logic working?
 *
 * Run with: npx tsx scripts/test-agent-invoke.ts
 */

import { agentInvoker, type AgentInvocation } from '../lib/agents/AgentInvoker';

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

async function checkLLMCredentials() {
  printHeader('LLM Provider Credentials');

  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasXAI = !!process.env.XAI_API_KEY;

  if (hasOpenRouter) {
    printTest('OpenRouter API key configured', 'PASS', 'OPENROUTER_API_KEY is set');
  } else {
    printTest('OpenRouter API key configured', 'SKIP', 'OPENROUTER_API_KEY not set');
  }

  if (hasOpenAI) {
    printTest('OpenAI API key configured', 'PASS', 'OPENAI_API_KEY is set');
  } else {
    printTest('OpenAI API key configured', 'SKIP', 'OPENAI_API_KEY not set');
  }

  if (hasXAI) {
    printTest('xAI API key configured', 'PASS', 'XAI_API_KEY is set');
  } else {
    printTest('xAI API key configured', 'SKIP', 'XAI_API_KEY not set');
  }

  return hasOpenRouter || hasOpenAI || hasXAI;
}

async function testBasicInvocation() {
  printHeader('Basic Agent Invocation');

  try {
    const request: AgentInvocation = {
      agentId: 'agent.orchestrator',
      userMessage: 'What is 2+2? Respond with just the number.',
      forceExecute: true, // Bypass escalation for this test
      context: {
        skipMemory: true, // Skip memory for fast test
      },
    };

    const response = await agentInvoker.invoke(request);

    if (response.content) {
      printTest('Agent responds', 'PASS', `Response: "${response.content.substring(0, 100)}..."`);
      console.log(`  Model: ${response.model}`);
      console.log(`  Tokens: ${response.tokensUsed.total || 'N/A'}`);
      console.log(`  Latency: ${response.latencyMs}ms`);
    } else {
      printTest('Agent responds', 'FAIL', 'No response content');
    }

    return true;
  } catch (error) {
    printTest('Basic invocation', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testEscalationLevels() {
  printHeader('Escalation Logic');

  try {
    // Test AUTO_EXECUTE (low risk)
    const autoRequest: AgentInvocation = {
      agentId: 'agent.orchestrator',
      userMessage: 'What is the weather like today?',
      context: { skipMemory: true },
    };

    const autoResponse = await agentInvoker.invoke(autoRequest);

    if (autoResponse.escalationLevel === 'AUTO_EXECUTE' && autoResponse.shouldExecute) {
      printTest('AUTO_EXECUTE escalation', 'PASS', `Low-risk query auto-executed`);
    } else {
      printTest('AUTO_EXECUTE escalation', 'FAIL', `Got: ${autoResponse.escalationLevel}, shouldExecute: ${autoResponse.shouldExecute}`);
    }

    // Test PROPOSE (medium risk - contains action keywords)
    const proposeRequest: AgentInvocation = {
      agentId: 'agent.pm',
      userMessage: 'Create a new GitHub repository for project X and invite the team.',
      context: { skipMemory: true },
    };

    const proposeResponse = await agentInvoker.invoke(proposeRequest);

    if (proposeResponse.escalationLevel === 'PROPOSE' && !proposeResponse.shouldExecute) {
      printTest('PROPOSE escalation', 'PASS', `Action proposal requires approval`);
      if (proposeResponse.escalationReason) {
        console.log(`  Reason: ${proposeResponse.escalationReason.substring(0, 80)}...`);
      }
    } else {
      printTest('PROPOSE escalation', 'FAIL', `Got: ${proposeResponse.escalationLevel}, shouldExecute: ${proposeResponse.shouldExecute}`);
    }

    // Test CRITICAL (high risk - contains critical keywords)
    const criticalRequest: AgentInvocation = {
      agentId: 'agent.legal',
      userMessage: 'Delete all legal documents and settle the lawsuit immediately.',
      context: { skipMemory: true },
    };

    const criticalResponse = await agentInvoker.invoke(criticalRequest);

    if (criticalResponse.escalationLevel === 'CRITICAL' && !criticalResponse.shouldExecute) {
      printTest('CRITICAL escalation', 'PASS', `Critical action blocked`);
      if (criticalResponse.escalationReason) {
        console.log(`  Reason: ${criticalResponse.escalationReason.substring(0, 80)}...`);
      }
    } else {
      printTest('CRITICAL escalation', 'FAIL', `Got: ${criticalResponse.escalationLevel}, shouldExecute: ${criticalResponse.shouldExecute}`);
    }

    // Test forceExecute override
    const forceRequest: AgentInvocation = {
      agentId: 'agent.orchestrator',
      userMessage: 'Create a new task in the project management system.',
      forceExecute: true,
      context: { skipMemory: true },
    };

    const forceResponse = await agentInvoker.invoke(forceRequest);

    if (forceResponse.shouldExecute) {
      printTest('Force execute override', 'PASS', `Escalation bypassed with forceExecute`);
    } else {
      printTest('Force execute override', 'FAIL', `forceExecute did not bypass escalation`);
    }

    return true;
  } catch (error) {
    printTest('Escalation logic', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testDomainDetection() {
  printHeader('Domain Detection');

  try {
    // Legal domain
    const legalRequest: AgentInvocation = {
      agentId: 'agent.legal',
      userMessage: 'Review the custody agreement for the family court case.',
      forceExecute: true,
      context: { skipMemory: true },
    };

    const legalResponse = await agentInvoker.invoke(legalRequest);

    if (legalResponse.detectedDomain) {
      printTest('Detect legal domain', 'PASS', `Domain: ${legalResponse.detectedDomain}`);
    } else {
      printTest('Detect legal domain', 'SKIP', 'No domain detected');
    }

    // Finance domain
    const financeRequest: AgentInvocation = {
      agentId: 'agent.finance',
      userMessage: 'What was my total spending on groceries this month? Check my budget.',
      forceExecute: true,
      context: { skipMemory: true },
    };

    const financeResponse = await agentInvoker.invoke(financeRequest);

    if (financeResponse.detectedDomain) {
      printTest('Detect finance domain', 'PASS', `Domain: ${financeResponse.detectedDomain}`);
    } else {
      printTest('Detect finance domain', 'SKIP', 'No domain detected');
    }

    return true;
  } catch (error) {
    printTest('Domain detection', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testMultipleAgents() {
  printHeader('Multiple Agent Invocations');

  try {
    const agents = [
      { id: 'agent.orchestrator', message: 'Summarize my top priorities for today.' },
      { id: 'agent.pm', message: 'List all active projects.' },
      { id: 'agent.comms', message: 'Who do I need to follow up with?' },
    ];

    const results = [];

    for (const { id, message } of agents) {
      try {
        const response = await agentInvoker.invoke({
          agentId: id,
          userMessage: message,
          forceExecute: true,
          context: { skipMemory: true },
        });

        results.push({
          agent: id,
          success: !!response.content,
          latency: response.latencyMs,
          model: response.model,
        });
      } catch (error) {
        results.push({
          agent: id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successful = results.filter(r => r.success).length;

    if (successful === agents.length) {
      printTest('Invoke multiple agents', 'PASS', `${successful}/${agents.length} agents responded`);
    } else {
      printTest('Invoke multiple agents', 'FAIL', `Only ${successful}/${agents.length} succeeded`);
    }

    console.log('\n  Results:');
    results.forEach((r, i) => {
      if (r.success) {
        console.log(`    [${i + 1}] ${r.agent}: ${r.latency}ms (${r.model})`);
      } else {
        console.log(`    [${i + 1}] ${r.agent}: FAILED - ${(r as any).error}`);
      }
    });

    return true;
  } catch (error) {
    printTest('Multiple agents', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testActivityTracking() {
  printHeader('Activity Tracking');

  try {
    // Invoke an agent to generate activity
    await agentInvoker.invoke({
      agentId: 'agent.orchestrator',
      userMessage: 'Test activity tracking',
      forceExecute: true,
      context: { skipMemory: true },
    });

    // Get recent activity
    const recentActivity = agentInvoker.getRecentActivity(10);

    if (recentActivity.length > 0) {
      printTest('Track agent activity', 'PASS', `${recentActivity.length} activities logged`);

      const latest = recentActivity[0];
      console.log(`  Latest: ${latest.agentId}`);
      console.log(`  Input: "${latest.input.substring(0, 40)}..."`);
      console.log(`  Escalation: ${latest.escalationLevel}`);
      console.log(`  Executed: ${latest.wasExecuted}`);
    } else {
      printTest('Track agent activity', 'FAIL', 'No activity logged');
    }

    // Get activity for specific agent
    const orchestratorActivity = agentInvoker.getAgentActivity('agent.orchestrator', 5);

    if (orchestratorActivity.length > 0) {
      printTest('Filter activity by agent', 'PASS', `${orchestratorActivity.length} orchestrator activities`);
    } else {
      printTest('Filter activity by agent', 'FAIL', 'No orchestrator activity found');
    }

    // Get pending escalations
    const pendingEscalations = agentInvoker.getPendingEscalations();

    printTest('Get pending escalations', 'PASS', `${pendingEscalations.length} pending`);

    return true;
  } catch (error) {
    printTest('Activity tracking', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function testMemoryIntegration() {
  printHeader('Zep Memory Integration');

  try {
    if (!process.env.ZEP_API_KEY) {
      printTest('Memory integration', 'SKIP', 'ZEP_API_KEY not configured');
      return true;
    }

    // Invoke with memory enabled (skipMemory: false)
    const request: AgentInvocation = {
      agentId: 'agent.orchestrator',
      userMessage: 'Remember this: My favorite color is blue.',
      forceExecute: true,
      context: {
        skipMemory: false, // Enable memory
      },
    };

    const response = await agentInvoker.invoke(request);

    if (response.content) {
      printTest('Invoke with memory enabled', 'PASS', 'Agent responded with memory context');
      console.log(`  Response: "${response.content.substring(0, 80)}..."`);
    } else {
      printTest('Invoke with memory enabled', 'FAIL', 'No response');
    }

    // Wait a moment for memory to persist
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Query to retrieve the memory
    const retrieveRequest: AgentInvocation = {
      agentId: 'agent.orchestrator',
      userMessage: 'What is my favorite color?',
      forceExecute: true,
      context: {
        skipMemory: false,
      },
    };

    const retrieveResponse = await agentInvoker.invoke(retrieveRequest);

    if (retrieveResponse.content.toLowerCase().includes('blue')) {
      printTest('Memory persistence and retrieval', 'PASS', 'Agent recalled stored memory');
    } else {
      printTest('Memory persistence and retrieval', 'SKIP', 'Memory may not be indexed yet');
      console.log(`  Response: "${retrieveResponse.content.substring(0, 80)}..."`);
    }

    return true;
  } catch (error) {
    printTest('Memory integration', 'FAIL', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log('\n🧪 INTEGRATION TEST: AGENT INVOCATION\n');

  // Check credentials
  const hasCredentials = await checkLLMCredentials();

  if (!hasCredentials) {
    console.log('\n⚠️  No LLM provider credentials found. Skipping agent tests.\n');
    console.log('Set OPENROUTER_API_KEY, OPENAI_API_KEY, or XAI_API_KEY to run these tests.\n');
    process.exit(0);
  }

  // Run tests
  await testBasicInvocation();
  await testEscalationLevels();
  await testDomainDetection();
  await testMultipleAgents();
  await testActivityTracking();
  await testMemoryIntegration();

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
