
import { NextResponse } from 'next/server';
import { generateInterviewQuestion } from '@/lib/hyro/forge-ai-tutor';
import { getConceptsForStandard } from '@/lib/hyro/education-store';

export async function GET() {
    const results: any[] = [];

    async function testStandard(id: string, name: string) {
        const log: any = { standard: name, id, checks: [] };

        // 1. Verify Data Layer
        try {
            const concepts = getConceptsForStandard(id);
            if (concepts.length === 0) {
                log.checks.push({ type: 'data', status: 'fail', message: `No concepts found for ${id}` });
            } else {
                log.checks.push({
                    type: 'data',
                    status: 'pass',
                    concepts: concepts.map(c => ({ name: c.concept?.name, layer: c.authenticity_layer }))
                });
            }
        } catch (e: any) {
            log.checks.push({ type: 'data', status: 'error', message: e.message });
        }

        // 2. Verify AI Tone
        try {
            // Force evaluate in a "test" context
            const result = await generateInterviewQuestion(id, []);
            log.question = result.question;

            const keywords = ['truth', 'hidden', 'why', 'limit', 'reality', 'construct', 'universal', 'archetype', 'social', 'game'];
            const hasKeyword = keywords.some(k => result.question.toLowerCase().includes(k));

            log.checks.push({
                type: 'ai_tone',
                status: hasKeyword ? 'pass' : 'warn',
                note: hasKeyword ? 'Esoteric keywords detected' : 'No esoteric keywords found (check manual review)'
            });

        } catch (e: any) {
            log.checks.push({ type: 'ai_tone', status: 'error', message: e.message });
        }

        results.push(log);
    }

    await testStandard('MS-PS3-1', 'Kinetic Energy');
    await testStandard('6.RL.2', 'Theme/Archetypes');

    return NextResponse.json({ results });
}
