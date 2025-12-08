
import { generateQuest } from '../lib/hyro/forge-ai-tutor';
import { getDatabase } from '../lib/db/Database';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function testQuestGeneration() {
    console.log('🧪 Testing Esoteric Quest Generation...');

    try {
        // 1. Generate a quest for a known standard associated with a concept
        // 'MS-PS3-1' is linked to 'Conservation of Energy'
        console.log('Calling generateQuest for MS-PS3-1...');
        const quest = await generateQuest(undefined, undefined, 'MS-PS3-1');

        console.log('\n✅ Quest Generated Successfully!');
        console.log('---------------------------------------------------');
        console.log(`Title:       ${quest.title}`);
        console.log(`Description: ${quest.description}`);
        console.log(`XP Reward:   ${quest.xp_reward}`);
        console.log(`Difficulty:  ${quest.difficulty}`);
        console.log('---------------------------------------------------');

        // 2. Validate "Esoteric" Content
        const keywords = ['truth', 'hidden', 'model', 'limited', 'simulation', 'game', 'secret'];
        const lowerDesc = (quest.description || '').toLowerCase();
        const hasEsotericTone = keywords.some(k => lowerDesc.includes(k));

        if (hasEsotericTone) {
            console.log('🌟 SUCCESS: Quest description contains "Esoteric" language.');
        } else {
            console.log('⚠️ WARNING: Quest description seems generic. Check prompt injection.');
        }

    } catch (error) {
        console.error('❌ Failed to generate quest:', error);
    }
}

testQuestGeneration();
