
import { getCharacterSheet } from '../lib/hyro/forge-stats';

const studentId = 'hyro';
console.log(`Checking character sheet for: ${studentId}`);

try {
    const sheet = getCharacterSheet(studentId);
    console.log('Character Sheet:', sheet);
} catch (error) {
    console.error('Error fetching character sheet:', error);
}
