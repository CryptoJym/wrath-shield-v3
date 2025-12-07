
import { generateInterviewQuestion } from '@/lib/hyro/forge-ai-tutor';
import { getConceptsForStandard } from '@/lib/hyro/education-store';

async function testStandard(id: string, name: string) {
    console.log(`\n=== TESTING ${name} (${id}) ===`);

    // 1. Verify Data Layer
    console.log(`[1] Verifying Data Linkage...`);
    try {
        const concepts = getConceptsForStandard(id);
        if (concepts.length === 0) {
            console.error(`❌ FAIL: No concepts found for ${id}`);
        } else {
            console.log(`✅ PASS: Linked to ${concepts.length} concepts.`);
            concepts.forEach(c => {
                console.log(`   - Concept: "${c.concept?.name}" (Layer: ${c.authenticity_layer})`);
                console.log(`   - Note: ${c.notes}`);
            });
        }
    } catch (e) {
        console.error(`❌ FAIL: Database error accessing concepts for ${id}`, e);
    }

    // 2. Verify AI Tone (Esoteric/Esoteric Polish)
    console.log(`[2] Verifying AI Tutor "Esoteric" Tone...`);
    try {
        const result = await generateInterviewQuestion(id, []);
        console.log(`\n🤖 AI GENERATED QUESTION:\n"${result.question}"`);

        // Naive context check (since context is internal to prompt, we infer from output)
        // We look for keywords that imply deep/critical thinking vs rote memory
        const keywords = ['truth', 'hidden', 'why', 'limit', 'reality', 'construct', 'universal', 'archetype'];
        const hasKeyword = keywords.some(k => result.question.toLowerCase().includes(k));

        if (hasKeyword) {
            console.log(`✅ PASS: Detected esoteric/critical keyword in output.`);
        } else {
            console.log(`⚠️ WARN: Output may be too standard. Check manually.`);
        }

    } catch (e) {
        console.error(`❌ FAIL: AI Generation Error`, e);
    }
}

async function main() {
    console.log("Initializing Authenticity Protocol Verification...");

    // Test Science (Energy)
    await testStandard('MS-PS3-1', 'Kinetic Energy');

    // Test ELA (Archetypes)
    await testStandard('6.RL.2', 'Theme/Archetypes');
}

main().catch(console.error);
