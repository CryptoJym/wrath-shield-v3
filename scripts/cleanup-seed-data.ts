
import { getDatabase } from '../lib/db/Database';

async function main() {
    console.log("=== Clearing Hallucinated Seed Data ===");
    const db = getDatabase().getRawDb();

    // The titles of the items I added
    const titlesToRemove = [
        'Invoice #9021 - Service Renewal',
        'Contract Review: NDA for Project X',
        'Approve Q1 Budget',
        'Health Data Missing'
    ];

    const placeholders = titlesToRemove.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM agentic_actions WHERE title IN (${placeholders})`);

    const result = stmt.run(...titlesToRemove);
    console.log(`Removed ${result.changes} items.`);
}

main();
