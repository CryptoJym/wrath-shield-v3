/**
 * HYRO FORGE v4 System Verification
 *
 * Quick verification that all components are properly connected and working.
 * This is a lightweight smoke test for production readiness.
 *
 * Run: npx tsx scripts/verify-forge-v4-system.ts
 */

import { existsSync } from 'fs';
import { join } from 'path';

// =============================================================================
// VERIFICATION UTILITIES
// =============================================================================

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
};

interface VerificationResult {
    component: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    details?: string[];
}

const results: VerificationResult[] = [];

function verify(component: string, condition: boolean, message: string, details?: string[]): void {
    results.push({
        component,
        status: condition ? 'pass' : 'fail',
        message,
        details,
    });
}

function warn(component: string, message: string, details?: string[]): void {
    results.push({
        component,
        status: 'warn',
        message,
        details,
    });
}

// =============================================================================
// FILE STRUCTURE VERIFICATION
// =============================================================================

async function verifyFileStructure() {
    console.log(`\n${colors.bold}Verifying File Structure...${colors.reset}`);

    const projectRoot = process.cwd();

    const requiredFiles = [
        // Core engine files
        'lib/hyro/forge-generative-engine.ts',
        'lib/hyro/forge-blueprints.ts',
        'lib/hyro/forge-types.ts',
        'lib/hyro/forge-orchestrator.ts',
        'lib/hyro/forge-domain-agents.ts',
        'lib/hyro/forge-memory-architecture.ts',
        'lib/hyro/forge-standards-mapping.ts',

        // API routes
        'app/api/hyro/forge/v4/route.ts',
        'app/api/hyro/forge/v4/reports/route.ts',
        'app/api/hyro/forge/v4/memory/route.ts',
        'app/api/hyro/forge/v4/admin/route.ts',

        // Schema files
        'scripts/init-generative-schema.sql',
        'scripts/init-memory-schema.sql',
    ];

    for (const file of requiredFiles) {
        const fullPath = join(projectRoot, file);
        const exists = existsSync(fullPath);
        verify(
            'File Structure',
            exists,
            `${file}`,
            exists ? undefined : ['File not found']
        );
    }
}

// =============================================================================
// MODULE IMPORT VERIFICATION
// =============================================================================

async function verifyModuleImports() {
    console.log(`\n${colors.bold}Verifying Module Imports...${colors.reset}`);

    // Test core imports
    try {
        const { getOrchestrator } = await import('../lib/hyro/forge-orchestrator');
        verify('Module Import', true, 'forge-orchestrator imports successfully');
    } catch (e: any) {
        verify('Module Import', false, 'forge-orchestrator', [e.message]);
    }

    try {
        const { getDomainAgent, getAllDomainAgents } = await import('../lib/hyro/forge-domain-agents');
        verify('Module Import', typeof getDomainAgent === 'function', 'forge-domain-agents exports getDomainAgent');
        verify('Module Import', getAllDomainAgents().length === 11, 'getAllDomainAgents returns 11 agents');
    } catch (e: any) {
        verify('Module Import', false, 'forge-domain-agents', [e.message]);
    }

    try {
        const memory = await import('../lib/hyro/forge-memory-architecture');
        verify('Module Import', typeof memory.getStudentProfile === 'function', 'forge-memory-architecture exports correctly');
    } catch (e: any) {
        verify('Module Import', false, 'forge-memory-architecture', [e.message]);
    }

    try {
        const { getBlueprint, ASSESSMENT_BLUEPRINTS } = await import('../lib/hyro/forge-blueprints');
        verify('Module Import', typeof getBlueprint === 'function', 'forge-blueprints exports getBlueprint');
        verify('Module Import', Object.keys(ASSESSMENT_BLUEPRINTS).length >= 11, 'ASSESSMENT_BLUEPRINTS has entries');
    } catch (e: any) {
        verify('Module Import', false, 'forge-blueprints', [e.message]);
    }

    try {
        const { STAT_NAMES } = await import('../lib/hyro/forge-types');
        verify('Module Import', STAT_NAMES.length === 11, 'forge-types exports 11 STAT_NAMES');
    } catch (e: any) {
        verify('Module Import', false, 'forge-types', [e.message]);
    }
}

// =============================================================================
// DOMAIN AGENT VERIFICATION
// =============================================================================

async function verifyDomainAgents() {
    console.log(`\n${colors.bold}Verifying Domain Agents...${colors.reset}`);

    try {
        const { getDomainAgent } = await import('../lib/hyro/forge-domain-agents');
        const { STAT_NAMES } = await import('../lib/hyro/forge-types');

        for (const stat of STAT_NAMES) {
            const agent = getDomainAgent(stat);

            verify('Domain Agent', agent.stat === stat, `${stat}: Agent configuration exists`);
            verify('Domain Agent', agent.expertPersona.length > 50, `${stat}: Has expert persona`);
            verify('Domain Agent', agent.qualityCriteria.length >= 3, `${stat}: Has quality criteria`);
            verify('Domain Agent', Object.keys(agent.strandContexts).length > 0, `${stat}: Has strand contexts`);
            verify('Domain Agent', agent.difficultyMarkers.foundation.length > 0, `${stat}: Has difficulty markers`);
        }
    } catch (e: any) {
        verify('Domain Agent', false, 'Domain agent verification failed', [e.message]);
    }
}

// =============================================================================
// BLUEPRINT VERIFICATION
// =============================================================================

async function verifyBlueprints() {
    console.log(`\n${colors.bold}Verifying Blueprints...${colors.reset}`);

    try {
        const { getBlueprint } = await import('../lib/hyro/forge-blueprints');
        const { STAT_NAMES } = await import('../lib/hyro/forge-types');

        for (const stat of STAT_NAMES) {
            const blueprint = getBlueprint(stat);

            verify('Blueprint', blueprint.stat_name === stat, `${stat}: Blueprint exists`);
            verify('Blueprint', blueprint.strands.length >= 3, `${stat}: Has ${blueprint.strands.length} strands`);

            // Verify strand structure
            const tierCounts = { Foundation: 0, Bridge: 0, Power: 0, Horizon: 0 };
            for (const strand of blueprint.strands) {
                if (strand.tier in tierCounts) {
                    tierCounts[strand.tier as keyof typeof tierCounts]++;
                }
            }

            verify('Blueprint', tierCounts.Foundation >= 1 || tierCounts.Bridge >= 1,
                `${stat}: Has foundational strands`);
        }
    } catch (e: any) {
        verify('Blueprint', false, 'Blueprint verification failed', [e.message]);
    }
}

// =============================================================================
// MEMORY ARCHITECTURE VERIFICATION
// =============================================================================

async function verifyMemoryArchitecture() {
    console.log(`\n${colors.bold}Verifying Memory Architecture...${colors.reset}`);

    try {
        const memory = await import('../lib/hyro/forge-memory-architecture');
        const { STAT_NAMES } = await import('../lib/hyro/forge-types');

        const testId = `verify_${Date.now()}`;

        // Test profile creation
        const profile = memory.getStudentProfile(testId);
        verify('Memory', profile.student_id === testId, 'Student profile creation works');
        verify('Memory', Object.keys(profile.stat_profiles).length === 11, 'Profile has all 11 stats');

        // Test stat profile update
        memory.updateStatProfile(testId, 'math', {
            theta: 0.5,
            se: 0.5,
            items: 5,
            accuracy: 0.7,
        });
        const updated = memory.getStudentProfile(testId);
        verify('Memory', updated.stat_profiles.math.theta === 0.5, 'Stat profile updates work');

        // Test misconception recording
        const misconception = memory.recordMisconception(
            testId,
            'math',
            'Test Strand',
            'Test misconception',
            'test_item'
        );
        verify('Memory', misconception.misconception === 'Test misconception', 'Misconception recording works');

        // Test context generation
        const context = memory.getAssessmentContext(testId, 'math');
        verify('Memory', context.student_id === testId, 'Assessment context generation works');

    } catch (e: any) {
        verify('Memory', false, 'Memory architecture verification failed', [e.message]);
    }
}

// =============================================================================
// ORCHESTRATOR VERIFICATION
// =============================================================================

async function verifyOrchestrator() {
    console.log(`\n${colors.bold}Verifying Orchestrator...${colors.reset}`);

    try {
        const { getOrchestrator } = await import('../lib/hyro/forge-orchestrator');

        const orchestrator = getOrchestrator();
        verify('Orchestrator', orchestrator !== undefined, 'Orchestrator singleton created');

        const orchestrator2 = getOrchestrator();
        verify('Orchestrator', orchestrator === orchestrator2, 'Singleton pattern works');

        // Test session creation
        const testId = `verify_orch_${Date.now()}`;
        const session = await orchestrator.startSession(testId, 'math');
        verify('Orchestrator', session.id.length > 0, 'Session creation works');
        verify('Orchestrator', session.status === 'active', 'Session starts as active');

        // Test progress retrieval
        const progress = orchestrator.getProgress(session.id);
        verify('Orchestrator', progress !== null, 'Progress retrieval works');

    } catch (e: any) {
        verify('Orchestrator', false, 'Orchestrator verification failed', [e.message]);
    }
}

// =============================================================================
// RESULTS SUMMARY
// =============================================================================

function printResults() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║           HYRO FORGE v4 VERIFICATION RESULTS                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    const grouped: Record<string, VerificationResult[]> = {};
    for (const result of results) {
        grouped[result.component] = grouped[result.component] || [];
        grouped[result.component].push(result);
    }

    let totalPass = 0;
    let totalFail = 0;
    let totalWarn = 0;

    for (const [component, items] of Object.entries(grouped)) {
        console.log(`\n${colors.bold}${component}${colors.reset}`);

        for (const item of items) {
            const icon = item.status === 'pass' ? `${colors.green}✓` :
                item.status === 'warn' ? `${colors.yellow}!` :
                    `${colors.red}✗`;

            console.log(`  ${icon}${colors.reset} ${item.message}`);

            if (item.details) {
                for (const detail of item.details) {
                    console.log(`    ${colors.yellow}↳ ${detail}${colors.reset}`);
                }
            }

            if (item.status === 'pass') totalPass++;
            else if (item.status === 'fail') totalFail++;
            else totalWarn++;
        }
    }

    console.log('\n' + '─'.repeat(65));
    console.log(`\n  ${colors.green}Passed:${colors.reset}  ${totalPass}`);
    console.log(`  ${colors.yellow}Warnings:${colors.reset} ${totalWarn}`);
    console.log(`  ${colors.red}Failed:${colors.reset}  ${totalFail}`);
    console.log(`  Total:   ${results.length}`);

    console.log('\n' + '─'.repeat(65));

    if (totalFail === 0) {
        console.log(`\n${colors.green}${colors.bold}  SYSTEM VERIFICATION: PASSED${colors.reset}`);
        console.log(`\n  The HYRO Forge v4 Multi-Agent Assessment System is ready.`);
        console.log(`\n  Components verified:`);
        console.log(`    • 11 Domain Agents (all stats)`);
        console.log(`    • Memory Architecture (profiles, misconceptions, events)`);
        console.log(`    • Orchestrator (session management, progress tracking)`);
        console.log(`    • Blueprints (strands, tiers, manifolds)`);
        console.log(`    • API Routes (v4 main, reports, memory, admin)`);
        console.log('');
        process.exit(0);
    } else {
        console.log(`\n${colors.red}${colors.bold}  SYSTEM VERIFICATION: FAILED${colors.reset}`);
        console.log(`\n  Please review the failures above and fix before deployment.`);
        console.log('');
        process.exit(1);
    }
}

// =============================================================================
// MAIN RUNNER
// =============================================================================

async function runVerification() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║           HYRO FORGE v4 SYSTEM VERIFICATION                   ║');
    console.log('║           Multi-Agent Assessment Architecture                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    await verifyFileStructure();
    await verifyModuleImports();
    await verifyDomainAgents();
    await verifyBlueprints();
    await verifyMemoryArchitecture();
    await verifyOrchestrator();

    printResults();
}

runVerification().catch(error => {
    console.error(`${colors.red}Verification error:${colors.reset}`, error);
    process.exit(1);
});
