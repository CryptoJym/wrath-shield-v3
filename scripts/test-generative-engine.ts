/**
 * Test the Generative Assessment Engine
 */

import {
    getGenerativeEngine,
    createInitialAbilityEstimate,
    type GeneratedItem,
} from '../lib/hyro/forge-generative-engine';
import { getBlueprint } from '../lib/hyro/forge-blueprints';

async function testGenerativeEngine() {
    console.log('='.repeat(60));
    console.log('GENERATIVE ASSESSMENT ENGINE TEST');
    console.log('='.repeat(60));
    console.log('');

    const engine = getGenerativeEngine();
    const stat = 'math';
    const blueprint = getBlueprint(stat);

    // Test 1: Generate items at different difficulties
    console.log('📝 TEST 1: Generate Items at Different Difficulties');
    console.log('-'.repeat(40));

    const testCases = [
        { strand: 'Arithmetic & Number Sense', tier: 'Foundation', difficulty: 0.2 },
        { strand: 'Algebra II & Functions', tier: 'Bridge', difficulty: 0.5 },
        { strand: 'Calculus I (Differential)', tier: 'Power', difficulty: 0.7 },
    ] as const;

    for (const testCase of testCases) {
        console.log(`\nGenerating: ${testCase.strand} (diff: ${testCase.difficulty})...`);

        try {
            const item = await engine.generateItem(
                stat,
                testCase.strand,
                testCase.tier,
                testCase.difficulty,
                'coherence',
                'multiple_choice'
            );

            console.log(`✅ Generated: "${item.prompt.slice(0, 60)}..."`);
            console.log(`   Options: A) ${item.options?.a?.slice(0, 20)}...`);
            console.log(`   Correct: ${item.correct_answer}`);
            console.log(`   Cognitive Load: ${item.cognitive_load}`);
        } catch (error) {
            console.log(`❌ Error: ${error}`);
        }
    }

    // Test 2: Evaluate a response
    console.log('\n');
    console.log('📊 TEST 2: Evaluate Response');
    console.log('-'.repeat(40));

    // Generate a simple item first
    const simpleItem = await engine.generateItem(
        'math',
        'Arithmetic & Number Sense',
        'Foundation',
        0.2,
        'coherence',
        'multiple_choice'
    );

    console.log(`Question: ${simpleItem.prompt}`);
    console.log(`Options: ${JSON.stringify(simpleItem.options)}`);
    console.log(`Correct answer: ${simpleItem.correct_answer}`);

    // Evaluate correct answer
    console.log('\nEvaluating correct answer...');
    const correctEval = await engine.evaluateResponse(simpleItem, simpleItem.correct_answer);
    console.log(`✅ Is Correct: ${correctEval.is_correct}`);
    console.log(`   Score: ${correctEval.score}`);
    console.log(`   Feedback: ${correctEval.feedback}`);

    // Evaluate wrong answer
    const wrongAnswer = simpleItem.correct_answer === 'a' ? 'b' : 'a';
    console.log('\nEvaluating wrong answer...');
    const wrongEval = await engine.evaluateResponse(simpleItem, wrongAnswer);
    console.log(`❌ Is Correct: ${wrongEval.is_correct}`);
    console.log(`   Score: ${wrongEval.score}`);
    console.log(`   Misconception: ${wrongEval.misconception_detected || 'None detected'}`);
    console.log(`   Feedback: ${wrongEval.feedback}`);

    // Test 3: Adaptive item selection
    console.log('\n');
    console.log('🎯 TEST 3: Adaptive Item Selection');
    console.log('-'.repeat(40));

    let abilityEstimate = createInitialAbilityEstimate();
    const sessionHistory: GeneratedItem[] = [];

    console.log(`Initial ability: theta=${abilityEstimate.theta.toFixed(2)}, SE=${abilityEstimate.standard_error.toFixed(2)}`);

    // Simulate 5 items
    for (let i = 0; i < 5; i++) {
        console.log(`\n--- Item ${i + 1} ---`);

        const target = await engine.selectNextItem(stat, abilityEstimate, sessionHistory);
        console.log(`Target: ${target.strand} @ difficulty ${target.difficulty.toFixed(2)}`);

        const item = await engine.generateItem(
            stat,
            target.strand,
            target.tier,
            target.difficulty,
            target.manifold,
            'multiple_choice'
        );

        console.log(`Generated: "${item.prompt.slice(0, 50)}..."`);

        // Simulate correct answer (70% of time)
        const isCorrect = Math.random() < 0.7;
        const response = isCorrect ? item.correct_answer : (item.correct_answer === 'a' ? 'b' : 'a');

        const evaluation = await engine.evaluateResponse(item, response);
        console.log(`Response: ${isCorrect ? 'CORRECT' : 'WRONG'}`);

        // Update ability
        abilityEstimate = engine.updateAbilityEstimate(abilityEstimate, item, evaluation);
        sessionHistory.push(item);

        console.log(`Updated ability: theta=${abilityEstimate.theta.toFixed(2)}, SE=${abilityEstimate.standard_error.toFixed(2)}`);
    }

    // Final summary
    console.log('\n');
    console.log('='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Final theta: ${abilityEstimate.theta.toFixed(2)}`);
    console.log(`Final SE: ${abilityEstimate.standard_error.toFixed(2)}`);
    console.log(`Items administered: ${abilityEstimate.items_administered}`);
    console.log(`Strand estimates:`);
    for (const [strand, est] of Object.entries(abilityEstimate.strand_estimates)) {
        console.log(`  - ${strand}: theta=${est.theta.toFixed(2)}, SE=${est.se.toFixed(2)}, items=${est.items}`);
    }

    console.log('\n🎉 Generative Engine Test Complete!');
}

testGenerativeEngine().catch(console.error);
