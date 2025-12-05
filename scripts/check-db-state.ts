
import { listAgenticActions } from '../lib/db/queries';
import { getLifelogsLastNDays } from '../lib/db/queries';

async function main() {
    console.log("=== Debugging Aggregator Data Source ===");

    // 1. Check Actions
    console.log("\nChecking AgenticActions...");
    try {
        const actions = listAgenticActions({ limit: 50 });
        console.log(`Found ${actions.length} total actions.`);
        if (actions.length === 0) {
            console.log("WARNING: AgenticActions table is EMPTY.");
        } else {
            console.log("Recent Actions:");
            actions.slice(0, 5).forEach(a => console.log(`- [${a.status}] ${a.title} (type: ${a.type})`));

            const queued = actions.filter(a => a.status === 'queued' || a.status === 'proposed');
            console.log(`Pending Items (queued/proposed): ${queued.length}`);
        }
    } catch (e) {
        console.error("Error listing actions:", e);
    }

    // 2. Check Lifelogs
    console.log("\nChecking Recent Lifelogs (3 days)...");
    try {
        const logs = getLifelogsLastNDays(3);
        console.log(`Found ${logs.length} lifelogs.`);
        if (logs.length > 0) {
            logs.slice(0, 3).forEach(l => console.log(`- [${l.date}] ${l.title}`));
        }
    } catch (e) {
        console.error("Error listing lifelogs:", e);
    }
}

main();
