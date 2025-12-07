
import { initializeStandards } from '@/lib/hyro/forge-proficiency';

async function main() {
    console.log('Initializing standards...');
    try {
        const result = await initializeStandards();
        console.log('Success:', result);
    } catch (error) {
        console.error('Failed:', error);
    }
}

main();
