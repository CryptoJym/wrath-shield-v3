/**
 * End-to-End Diagnostic System Test
 * Tests the full flow: questions, blueprints, and integration
 */

import { Database } from 'bun:sqlite';
import { getBlueprint, ASSESSMENT_BLUEPRINTS } from '../lib/hyro/forge-blueprints';
import { StatName } from '../lib/hyro/forge-types';

const db = new Database('data/wrath-shield.db');

console.log('='.repeat(60));
console.log('HYRO FORGE DIAGNOSTIC SYSTEM - E2E TEST');
console.log('='.repeat(60));
console.log('');

// Test 1: Database question coverage
console.log('📊 TEST 1: Question Coverage by Stat');
console.log('-'.repeat(40));

const questionStats = db.prepare(`
    SELECT stat_name, COUNT(*) as count,
           MIN(difficulty_level) as min_diff,
           MAX(difficulty_level) as max_diff,
           AVG(difficulty_level) as avg_diff
    FROM hyro_diagnostic_questions
    WHERE is_active = 1
    GROUP BY stat_name
`).all() as any[];

let allStatsCovered = true;
const REQUIRED_STATS = ['math', 'reading', 'science', 'critical_thinking', 'social_studies'];

for (const stat of REQUIRED_STATS) {
    const found = questionStats.find(q => q.stat_name === stat);
    if (found) {
        console.log(`✅ ${stat}: ${found.count} questions (diff: ${found.min_diff.toFixed(2)} - ${found.max_diff.toFixed(2)})`);
    } else {
        console.log(`❌ ${stat}: NO QUESTIONS`);
        allStatsCovered = false;
    }
}
console.log('');

// Test 2: Blueprint-Topic Alignment
console.log('📋 TEST 2: Blueprint-Topic Alignment');
console.log('-'.repeat(40));

let alignmentOk = true;

for (const statName of REQUIRED_STATS) {
    const blueprint = getBlueprint(statName as StatName);
    const strandNames = blueprint.strands.map(s => s.strand);

    // Get topics in database for this stat
    const topics = db.prepare(`
        SELECT DISTINCT topic FROM hyro_diagnostic_questions
        WHERE stat_name = ? AND is_active = 1
    `).all(statName) as any[];

    const dbTopics = topics.map(t => t.topic);

    // Check each DB topic matches at least one strand
    const unmatchedTopics = dbTopics.filter(topic =>
        !strandNames.some(strand => strand === topic || topic.includes(strand) || strand.includes(topic))
    );

    if (unmatchedTopics.length === 0) {
        console.log(`✅ ${statName}: All ${dbTopics.length} topics align with blueprint strands`);
    } else {
        console.log(`⚠️  ${statName}: ${unmatchedTopics.length} topics don't match strands:`);
        unmatchedTopics.forEach(t => console.log(`   - "${t}"`));
        alignmentOk = false;
    }
}
console.log('');

// Test 3: 4-Tier Coverage
console.log('🏔️  TEST 3: 4-Tier Coverage (Foundation/Bridge/Power/Horizon)');
console.log('-'.repeat(40));

type StrandTier = 'Foundation' | 'Bridge' | 'Power' | 'Horizon';

for (const statName of REQUIRED_STATS) {
    const blueprint = getBlueprint(statName as StatName);
    const tierStrands: Record<StrandTier, string[]> = {
        'Foundation': [],
        'Bridge': [],
        'Power': [],
        'Horizon': []
    };

    for (const strand of blueprint.strands) {
        tierStrands[strand.tier].push(strand.strand);
    }

    // Get question topics and match to tiers
    const tierCounts: Record<StrandTier, number> = { Foundation: 0, Bridge: 0, Power: 0, Horizon: 0 };

    const questions = db.prepare(`
        SELECT topic FROM hyro_diagnostic_questions
        WHERE stat_name = ? AND is_active = 1
    `).all(statName) as any[];

    for (const q of questions) {
        for (const tier of (['Foundation', 'Bridge', 'Power', 'Horizon'] as StrandTier[])) {
            if (tierStrands[tier].some(strand => strand === q.topic)) {
                tierCounts[tier]++;
                break;
            }
        }
    }

    const coverage = Object.entries(tierCounts)
        .map(([tier, count]) => `${tier[0]}:${count}`)
        .join(' ');

    const hasCoverage = Object.values(tierCounts).some(c => c > 0);
    const status = hasCoverage ? '✅' : '⚠️';
    console.log(`${status} ${statName}: ${coverage}`);
}
console.log('');

// Test 4: Answer Uniqueness
console.log('🔢 TEST 4: Answer Uniqueness (No Duplicate Options)');
console.log('-'.repeat(40));

const allQuestions = db.prepare(`
    SELECT id, options, stat_name FROM hyro_diagnostic_questions WHERE is_active = 1
`).all() as any[];

let duplicateCount = 0;
const duplicateIds: string[] = [];

for (const q of allQuestions) {
    try {
        const options = JSON.parse(q.options);
        const values = Object.values(options);
        const uniqueValues = new Set(values);
        if (uniqueValues.size !== values.length) {
            duplicateCount++;
            duplicateIds.push(q.id);
        }
    } catch (e) {
        console.log(`⚠️  Could not parse options for ${q.id}`);
    }
}

if (duplicateCount === 0) {
    console.log(`✅ All ${allQuestions.length} questions have unique answer options`);
} else {
    console.log(`❌ ${duplicateCount} questions have duplicate answer options:`);
    duplicateIds.slice(0, 5).forEach(id => console.log(`   - ${id}`));
    if (duplicateIds.length > 5) console.log(`   ... and ${duplicateIds.length - 5} more`);
}
console.log('');

// Test 5: Manifold Dimension Coverage
console.log('🧬 TEST 5: Manifold Dimension Coverage');
console.log('-'.repeat(40));

const manifoldDimensions = ['coherence', 'fluidity', 'elasticity', 'gradient_awareness', 'entropy_intuition', 'non_dual_resolution', 'generativity'];

for (const statName of REQUIRED_STATS) {
    const blueprint = getBlueprint(statName as StatName);
    const coveredDimensions = new Set(blueprint.strands.map(s => s.manifold_focus));
    const coveragePercent = Math.round((coveredDimensions.size / manifoldDimensions.length) * 100);

    const status = coveragePercent >= 50 ? '✅' : '⚠️';
    console.log(`${status} ${statName}: ${coveredDimensions.size}/${manifoldDimensions.length} dimensions (${coveragePercent}%)`);
}
console.log('');

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

const totalQuestions = allQuestions.length;
const hasAllStats = allStatsCovered;
const noDuplicates = duplicateCount === 0;

console.log(`📚 Total Questions: ${totalQuestions}`);
console.log(`📊 All Required Stats Covered: ${hasAllStats ? '✅' : '❌'}`);
console.log(`🔢 No Duplicate Answers: ${noDuplicates ? '✅' : '❌'}`);
console.log(`📋 Blueprint-Topic Alignment: ${alignmentOk ? '✅' : '⚠️'}`);
console.log('');

if (hasAllStats && noDuplicates && totalQuestions >= 100) {
    console.log('🎉 DIAGNOSTIC SYSTEM: READY FOR PRODUCTION');
} else {
    console.log('⚠️  DIAGNOSTIC SYSTEM: NEEDS ATTENTION');
}
