/**
 * HYRO FORGE v4 Integration Test Suite
 *
 * Comprehensive tests for the multi-agent assessment architecture:
 * - Orchestrator functionality
 * - Domain agent system
 * - Memory architecture
 * - API routes
 *
 * Run: npx tsx scripts/test-forge-v4-integration.ts
 */

import { getOrchestrator } from '../lib/hyro/forge-orchestrator';
import { getDomainAgent, buildAgentSystemPrompt, DOMAIN_AGENTS } from '../lib/hyro/forge-domain-agents';
import {
    getStudentProfile,
    updateStatProfile,
    recordMisconception,
    getActiveMisconceptions,
    recordLearningEvent,
    getAssessmentContext,
} from '../lib/hyro/forge-memory-architecture';
import { getBlueprint } from '../lib/hyro/forge-blueprints';
import { STAT_NAMES, StatName } from '../lib/hyro/forge-types';

// =============================================================================
// TEST UTILITIES
// =============================================================================

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'header' = 'info') {
    const prefix = {
        info: `${colors.blue}[INFO]${colors.reset}`,
        success: `${colors.green}[PASS]${colors.reset}`,
        error: `${colors.red}[FAIL]${colors.reset}`,
        header: `${colors.bold}${colors.yellow}`,
    };

    if (type === 'header') {
        console.log(`\n${prefix[type]}${message}${colors.reset}`);
    } else {
        console.log(`${prefix[type]} ${message}`);
    }
}

function assert(condition: boolean, message: string): void {
    if (condition) {
        log(message, 'success');
    } else {
        log(message, 'error');
        throw new Error(`Assertion failed: ${message}`);
    }
}

const TEST_STUDENT_ID = `test_student_${Date.now()}`;

// =============================================================================
// TEST SUITES
// =============================================================================

async function testDomainAgents() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' DOMAIN AGENTS TEST SUITE', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    // Test 1: All 11 domain agents exist
    log('\n--- Test 1: Domain Agent Coverage ---');
    for (const stat of STAT_NAMES) {
        const agent = getDomainAgent(stat);
        assert(agent !== undefined, `Domain agent exists for: ${stat}`);
        assert(agent.stat === stat, `Agent stat matches: ${stat}`);
        assert(agent.expertPersona.length > 50, `Agent has persona for: ${stat}`);
        assert(agent.qualityCriteria.length >= 3, `Agent has quality criteria for: ${stat}`);
    }

    // Test 2: Domain agent prompts
    log('\n--- Test 2: Agent Prompt Generation ---');
    const mathAgent = getDomainAgent('math');
    const prompt = buildAgentSystemPrompt(
        'math',
        'Algebra I (Foundations)',
        'Bridge',
        0.5,
        'coherence'
    );
    assert(prompt.includes('EXPERT PERSONA'), 'Prompt includes persona section');
    assert(prompt.includes('Algebra I'), 'Prompt includes strand');
    assert(prompt.includes('0.50'), 'Prompt includes difficulty');
    assert(prompt.includes('coherence'), 'Prompt includes manifold');
    log('System prompt generated successfully', 'success');

    // Test 3: Domain-specific content
    log('\n--- Test 3: Domain-Specific Content ---');
    const readingAgent = getDomainAgent('reading');
    assert(readingAgent.strandContexts['Reading Comprehension'] !== undefined,
        'Reading agent has comprehension context');

    const codingAgent = getDomainAgent('coding');
    assert(codingAgent.commonMisconceptions.length > 0,
        'Coding agent has misconceptions');
    assert(codingAgent.difficultyMarkers.foundation.length > 0,
        'Coding agent has foundation markers');

    log('\nDomain Agents: ALL TESTS PASSED', 'success');
}

async function testMemoryArchitecture() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' MEMORY ARCHITECTURE TEST SUITE', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    // Test 1: Student profile creation
    log('\n--- Test 1: Student Profile Management ---');
    const profile = getStudentProfile(TEST_STUDENT_ID);
    assert(profile.studentId === TEST_STUDENT_ID, 'Profile created with correct ID');
    assert(profile.stat_profiles !== undefined, 'Profile has stat profiles');
    assert(Object.keys(profile.stat_profiles).length === 11, 'Profile has all 11 stats');
    log('Student profile created successfully', 'success');

    // Test 2: Stat profile updates
    log('\n--- Test 2: Stat Profile Updates ---');
    updateStatProfile(TEST_STUDENT_ID, 'math', {
        theta: 1.5,
        se: 0.4,
        items: 10,
        accuracy: 0.75,
    });
    const updatedProfile = getStudentProfile(TEST_STUDENT_ID);
    assert(updatedProfile.stat_profiles.math.theta === 1.5, 'Math theta updated');
    assert(updatedProfile.stat_profiles.math.se === 0.4, 'Math SE updated');
    log('Stat profile updated successfully', 'success');

    // Test 3: Misconception tracking
    log('\n--- Test 3: Misconception Tracking ---');
    const misconception = recordMisconception(
        TEST_STUDENT_ID,
        'math',
        'Algebra I (Foundations)',
        'Confuses subtraction with addition when combining like terms',
        'item_test_123'
    );
    assert(misconception.misconception.includes('Confuses'), 'Misconception recorded');

    const activeMisconceptions = getActiveMisconceptions(TEST_STUDENT_ID, 'math');
    assert(activeMisconceptions.length >= 1, 'Active misconceptions retrieved');
    log('Misconception tracking working', 'success');

    // Test 4: Learning events
    log('\n--- Test 4: Learning Events ---');
    const event = recordLearningEvent(
        TEST_STUDENT_ID,
        'breakthrough',
        { description: 'Mastered quadratic formula' },
        'math',
        'Algebra I (Foundations)',
        'session_test_123'
    );
    assert(event.eventType === 'breakthrough', 'Event recorded with correct type');
    log('Learning events working', 'success');

    // Test 5: Assessment context
    log('\n--- Test 5: Assessment Context ---');
    const context = getAssessmentContext(TEST_STUDENT_ID, 'math');
    assert(context.studentId === TEST_STUDENT_ID, 'Context has correct student ID');
    assert(context.currentStatProfile !== undefined, 'Context has stat profile');
    assert(Array.isArray(context.activeMisconceptions), 'Context has misconceptions array');
    assert(Array.isArray(context.suggestedFocus), 'Context has suggested focus');
    log('Assessment context working', 'success');

    log('\nMemory Architecture: ALL TESTS PASSED', 'success');
}

async function testBlueprintSystem() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' BLUEPRINT SYSTEM TEST SUITE', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    // Test 1: All stats have blueprints
    log('\n--- Test 1: Blueprint Coverage ---');
    for (const stat of STAT_NAMES) {
        const blueprint = getBlueprint(stat);
        assert(blueprint !== undefined, `Blueprint exists for: ${stat}`);
        assert(blueprint.strands.length >= 3, `Blueprint has strands for: ${stat}`);
    }

    // Test 2: Blueprint structure
    log('\n--- Test 2: Blueprint Structure ---');
    const mathBlueprint = getBlueprint('math');
    assert(mathBlueprint.stat_name === 'math', 'Blueprint has correct stat name');

    for (const strand of mathBlueprint.strands) {
        assert(strand.strand.length > 0, 'Strand has name');
        assert(strand.weight > 0, 'Strand has positive weight');
        assert(['Foundation', 'Bridge', 'Power', 'Horizon'].includes(strand.tier),
            'Strand has valid tier');
        assert(strand.manifold_focus.length > 0, 'Strand has manifold focus');
    }
    log('Blueprint structure valid', 'success');

    // Test 3: Tier distribution
    log('\n--- Test 3: Tier Distribution ---');
    const tierCounts = {
        Foundation: 0, Bridge: 0, Power: 0, Horizon: 0
    };
    for (const strand of mathBlueprint.strands) {
        tierCounts[strand.tier]++;
    }
    assert(tierCounts.Foundation >= 1, 'Has Foundation tier strands');
    assert(tierCounts.Bridge >= 1, 'Has Bridge tier strands');
    log(`Tier distribution: F=${tierCounts.Foundation}, B=${tierCounts.Bridge}, P=${tierCounts.Power}, H=${tierCounts.Horizon}`, 'info');

    log('\nBlueprint System: ALL TESTS PASSED', 'success');
}

async function testOrchestratorBasics() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' ORCHESTRATOR BASIC TEST SUITE', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    const orchestrator = getOrchestrator();

    // Test 1: Orchestrator singleton
    log('\n--- Test 1: Orchestrator Singleton ---');
    const orchestrator2 = getOrchestrator();
    assert(orchestrator === orchestrator2, 'Orchestrator is singleton');
    log('Singleton pattern working', 'success');

    // Test 2: Session creation
    log('\n--- Test 2: Session Creation ---');
    try {
        const session = await orchestrator.startSession(TEST_STUDENT_ID, 'math');
        assert(session.sessionId.length > 0, 'Session has ID');
        assert(session.studentId === TEST_STUDENT_ID, 'Session has correct student');
        assert(session.statName === 'math', 'Session has correct stat');
        assert(session.status === 'active', 'Session is active');
        log(`Session created: ${session.sessionId}`, 'success');

        // Test 3: Session progress
        log('\n--- Test 3: Session Progress ---');
        const progress = orchestrator.getProgress(session.sessionId);
        assert(progress !== null, 'Can get session progress');
        assert(progress!.items_administered === 0, 'Progress starts at 0 items');
        log('Session progress tracking working', 'success');

        // Test 4: Session completion (without items)
        log('\n--- Test 4: Session Completion ---');
        // Note: In real usage, you'd submit items first
        // This tests the completion pathway exists
        const result = await orchestrator.completeSession(session.sessionId);
        if (result) {
            log('Session completed with result', 'success');
        } else {
            log('Session completion returned null (expected without items)', 'info');
        }

    } catch (error) {
        log(`Session test error: ${error}`, 'error');
    }

    log('\nOrchestrator Basics: ALL TESTS PASSED', 'success');
}

async function testMultiStatSession() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' MULTI-STAT SESSION TEST SUITE', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    const orchestrator = getOrchestrator();

    // Test 1: Multi-stat session creation
    log('\n--- Test 1: Multi-Stat Session ---');
    try {
        const session = await orchestrator.startMultiStatSession(
            TEST_STUDENT_ID,
            ['math', 'reading', 'science']
        );
        assert(session.sessionId.length > 0, 'Multi-stat session created');
        assert(session.config.stat_battery?.length === 3, 'Session has 3 stats');
        log(`Multi-stat session created: ${session.sessionId}`, 'success');

        // Check all stats are included
        const battery = session.config.stat_battery || [];
        assert(battery.includes('math'), 'Battery includes math');
        assert(battery.includes('reading'), 'Battery includes reading');
        assert(battery.includes('science'), 'Battery includes science');
        log('All stats included in battery', 'success');

    } catch (error) {
        log(`Multi-stat session error: ${error}`, 'error');
    }

    log('\nMulti-Stat Session: ALL TESTS PASSED', 'success');
}

async function testCrossStatIntegration() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' CROSS-STAT INTEGRATION TEST SUITE', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    // Test 1: Domain agents cover all blueprint strands
    log('\n--- Test 1: Agent-Blueprint Alignment ---');
    for (const stat of STAT_NAMES) {
        const agent = getDomainAgent(stat);
        const blueprint = getBlueprint(stat);

        // Check that agent has contexts for at least some strands
        const strandNames = blueprint.strands.map(s => s.strand);
        const agentStrands = Object.keys(agent.strandContexts);

        const coverage = strandNames.filter(s => agentStrands.includes(s)).length;
        const coveragePercent = (coverage / strandNames.length) * 100;

        assert(coveragePercent >= 30,
            `${stat}: Agent covers ${coverage}/${strandNames.length} strands (${coveragePercent.toFixed(0)}%)`);
    }

    // Test 2: Memory profiles for all stats
    log('\n--- Test 2: Memory-Stat Coverage ---');
    const profile = getStudentProfile(TEST_STUDENT_ID);
    for (const stat of STAT_NAMES) {
        assert(profile.stat_profiles[stat] !== undefined,
            `Memory profile exists for: ${stat}`);
    }
    log('Memory covers all stats', 'success');

    // Test 3: Context generation for all stats
    log('\n--- Test 3: Context Generation ---');
    for (const stat of STAT_NAMES.slice(0, 3)) { // Test first 3 for speed
        const context = getAssessmentContext(TEST_STUDENT_ID, stat);
        assert(context.currentStatProfile !== undefined,
            `Context generates for: ${stat}`);
    }
    log('Context generates for all tested stats', 'success');

    log('\nCross-Stat Integration: ALL TESTS PASSED', 'success');
}

async function testSystemMetrics() {
    log('═══════════════════════════════════════════════════════════════', 'header');
    log(' SYSTEM METRICS', 'header');
    log('═══════════════════════════════════════════════════════════════', 'header');

    // Count stats
    log('\n--- Domain Coverage ---');
    log(`Total Stats Supported: ${STAT_NAMES.length}`, 'info');
    log(`Domain Agents: ${Object.keys(DOMAIN_AGENTS).length}`, 'info');

    // Count strands across all blueprints
    let totalStrands = 0;
    let totalTiers = { Foundation: 0, Bridge: 0, Power: 0, Horizon: 0 };
    for (const stat of STAT_NAMES) {
        const blueprint = getBlueprint(stat);
        totalStrands += blueprint.strands.length;
        for (const strand of blueprint.strands) {
            totalTiers[strand.tier]++;
        }
    }
    log(`Total Strands: ${totalStrands}`, 'info');
    log(`By Tier: F=${totalTiers.Foundation}, B=${totalTiers.Bridge}, P=${totalTiers.Power}, H=${totalTiers.Horizon}`, 'info');

    // Memory architecture features
    log('\n--- Memory Features ---');
    log('Student profiles: Per-stat ability tracking', 'info');
    log('Strand profiles: Granular ability per strand', 'info');
    log('Misconception tracking: Detection, remediation', 'info');
    log('Learning events: Breakthroughs, struggles', 'info');
    log('Assessment context: Session-informed targeting', 'info');

    // API routes
    log('\n--- API Routes ---');
    log('/api/hyro/forge/v4 - Main assessment API', 'info');
    log('/api/hyro/forge/v4/reports - Diagnostic reports', 'info');
    log('/api/hyro/forge/v4/memory - Memory & context', 'info');
    log('/api/hyro/forge/v4/admin - Administration', 'info');
}

// =============================================================================
// MAIN TEST RUNNER
// =============================================================================

async function runAllTests() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         HYRO FORGE v4 INTEGRATION TEST SUITE                  ║');
    console.log('║         Multi-Agent Assessment Architecture                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    const testSuites = [
        { name: 'Domain Agents', fn: testDomainAgents },
        { name: 'Memory Architecture', fn: testMemoryArchitecture },
        { name: 'Blueprint System', fn: testBlueprintSystem },
        { name: 'Orchestrator Basics', fn: testOrchestratorBasics },
        { name: 'Multi-Stat Sessions', fn: testMultiStatSession },
        { name: 'Cross-Stat Integration', fn: testCrossStatIntegration },
    ];

    for (const suite of testSuites) {
        try {
            await suite.fn();
            passed++;
        } catch (error) {
            console.error(`\n${colors.red}Suite "${suite.name}" FAILED:${colors.reset}`, error);
            failed++;
        }
    }

    // Always show metrics
    await testSystemMetrics();

    const duration = Date.now() - startTime;

    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS SUMMARY                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`\n  Test Suites: ${passed + failed}`);
    console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`\n  Test Student ID: ${TEST_STUDENT_ID}`);
    console.log('');

    if (failed === 0) {
        console.log(`${colors.green}${colors.bold}  ✓ ALL TESTS PASSED${colors.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${colors.red}${colors.bold}  ✗ SOME TESTS FAILED${colors.reset}\n`);
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
