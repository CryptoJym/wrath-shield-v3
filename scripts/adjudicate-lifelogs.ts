
import { getLifelogsLastNDays } from '../lib/db/queries';
import { getDatabase } from '../lib/db/Database';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log("=== Converting Recent Lifelogs to Adjudicatable Items ===");
    const db = getDatabase().getRawDb();

    // 1. Get ALL logs for debugging
    const logs = db.prepare('SELECT * FROM lifelogs LIMIT 50').all() as any[];
    console.log(`Found ${logs.length} recent lifelogs.`);

    if (logs.length === 0) {
        console.log("No recent lifelogs found in DB.");
        return;
    }

    // 2. Filter for actionable content (simple heuristic for now)
    // In reality, this would be more complex. We'll pick logs with "manipulation_count > 0" or specific keywords.
    const candidates = logs.filter(l => l.manipulation_count > 0 || (l.title && l.title.length > 10));
    console.log(`Selected ${candidates.length} candidates for adjudication.`);

    const stmt = db.prepare(`
        INSERT INTO agentic_actions (id, user_id, type, title, content, status, source, metadata, created_at, updated_at)
        VALUES (@id, @user_id, @type, @title, @content, @status, @source, @metadata, @created_at, @updated_at)
    `);

    let added = 0;
    db.transaction(() => {
        for (const log of candidates.slice(0, 10)) { // Limit to 10 for safety
            const exists = db.prepare('SELECT id FROM agentic_actions WHERE title = ?').get(`[Log] ${log.title || 'Untitled'}`);
            if (exists) continue;

            const action = {
                id: uuidv4(),
                user_id: 'user_01',
                type: 'task',
                title: `[Log] ${log.title || 'Untitled Segment'}`,
                content: log.raw_json || 'No content available.',
                status: 'queued', // Queue for adjudication
                source: 'limitless',
                metadata: JSON.stringify({ priority: 'medium', original_id: log.id, manipulation: log.manipulation_count }),
                created_at: Date.now(),
                updated_at: Date.now()
            };

            try {
                stmt.run(action);
                added++;
            } catch (e) {
                console.error("Insert error:", e);
            }
        }
    })();

    console.log(`Successfully added ${added} items from Lifelogs to Inbox.`);
}

main();
