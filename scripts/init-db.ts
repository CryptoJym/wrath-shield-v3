
import { getDatabase } from '../lib/db/Database';

async function main() {
    console.log('Initializing database...');
    const db = getDatabase();
    console.log('Database initialized and migrations applied.');
    db.close();
}

main().catch(console.error);
