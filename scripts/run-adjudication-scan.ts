import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { listAgenticActions } from '../lib/db/queries';
import { adjudicateItem } from '../lib/ea/adjudicator';
import { getDatabase } from '../lib/db/Database';

async function main() {
    console.log("=== Running Adjudication Scan on Existing Items ===");
    const db = getDatabase().getRawDb();

    // 1. Fetch all pending actions (Raw Query to ensure visibility)
    const pendingActions = db.prepare("SELECT * FROM agentic_actions WHERE status = 'queued' LIMIT 50").all() as any[];
    console.log(`Found ${pendingActions.length} pending actions.`);

    if (pendingActions.length === 0) {
        console.log("No pending items to adjudicate.");
        return;
    }

    // 2. Iterate and Adjudicate
    for (const action of pendingActions) {
        console.log(`\nAdjudicating: [${action.type}] ${action.title}`);

        try {
            // Call AI Adjudicator
            const result = await adjudicateItem(
                `${action.title}\n${action.content}`,
                action.source || 'unknown'
            );

            console.log(` -> Action: ${result.action}`);
            console.log(` -> Domain: ${result.domain}`);
            console.log(` -> Reasoning: ${result.reasoning}`);

            // Update DB if action is archive/dismiss
            if (result.action === 'archive' || result.action === 'junk') {
                db.prepare("UPDATE agentic_actions SET status = 'dismissed', metadata = json_patch(COALESCE(metadata, '{}'), ?) WHERE id = ?")
                    .run(JSON.stringify({ adjudication: result }), action.id);
                console.log(" -> [UPDATED] Status set to dismissed.");
            } else {
                db.prepare("UPDATE agentic_actions SET metadata = json_patch(COALESCE(metadata, '{}'), ?) WHERE id = ?")
                    .run(JSON.stringify({ adjudication: result }), action.id);
                console.log(" -> [UPDATED] Metadata enriched.");
            }

        } catch (e) {
            console.error(` -> Failed to adjudicate:`, e);
        }
    }
}

main();
