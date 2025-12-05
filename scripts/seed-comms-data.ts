
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../lib/db/Database';

async function main() {
    console.log("=== Seeding Comms Data (AgenticActions) ===");

    // Initialize DB
    const db = getDatabase().getRawDb();

    const now = Date.now();
    const actions = [
        {
            id: uuidv4(),
            user_id: 'user_01',
            type: 'task', // mapped from email for 'actionable' items
            title: 'Invoice #9021 - Service Renewal',
            content: 'Please pay the attached invoice for $1,200 by Friday. This covers the Q4 server costs.',
            status: 'queued',
            source: 'gmail',
            // Store extra fields in metadata
            metadata: JSON.stringify({ domain: 'finance', sender: 'billing@aws.com', priority: 'high', original_type: 'email' }),
            created_at: now,
            updated_at: now
        },
        {
            id: uuidv4(),
            user_id: 'user_01',
            type: 'task',
            title: 'Contract Review: NDA for Project X',
            content: 'Can you look over this NDA? Needs checking before we sign with the new partners.',
            status: 'proposed',
            source: 'imessage',
            metadata: JSON.stringify({ domain: 'legal', sender: 'partner@firm.com', priority: 'medium', original_type: 'message' }),
            created_at: now - 3600000,
            updated_at: now
        },
        {
            id: uuidv4(),
            user_id: 'user_01',
            type: 'task',
            title: 'Approve Q1 Budget',
            content: 'Budget plan is ready for review. Please approve so we can allocate funds.',
            status: 'queued',
            source: 'system',
            metadata: JSON.stringify({ domain: 'finance', priority: 'high' }),
            created_at: now - 7200000,
            updated_at: now
        },
        {
            id: uuidv4(),
            user_id: 'user_01',
            type: 'critical_alert', // Mapping 'alert' to 'critical_alert' if allowed, getting TS error otherwise? 
            // type defined as: 'task' | 'email_draft' | 'text_message' | 'reminder' | 'calendar_event' | 'note'
            // Actually 'critical_alert' IS NOT in the type union for 'type', but it IS in 'status'.
            // So we use type='task', status='critical_alert' or similar.
            // Let's use type='task' and status='proposed' with high priority metadata.
            title: 'Health Data Missing',
            content: 'No Whoop data sync for 3 days. Check device connection.',
            status: 'critical_alert',
            source: 'agent.health',
            metadata: JSON.stringify({ domain: 'health', priority: 'critical' }),
            created_at: now - 86400000,
            updated_at: now
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO agentic_actions (id, user_id, type, title, content, status, source, metadata, created_at, updated_at)
        VALUES (@id, @user_id, @type, @title, @content, @status, @source, @metadata, @created_at, @updated_at)
    `);

    db.transaction(() => {
        for (const action of actions) {
            try {
                stmt.run(action);
                console.log(`Inserted: ${action.title}`);
            } catch (e: any) {
                // Ignore unique constraint if re-running (though UUIDs make that unlikely)
                if (!e.message.includes('UNIQUE constraint')) {
                    console.error(`Failed to insert ${action.title}:`, e);
                }
            }
        }
    })();

    console.log("Seeding Complete.");
}

main();
