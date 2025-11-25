/**
 * Script: Backfill Limitless History
 *
 * Usage: npm run script scripts/backfill-limitless.ts
 *
 * Downloads ALL historical lifelogs from Limitless and stores them locally.
 * This does not affect the "last sync" cursor used for daily updates.
 */

// Force Node environment
process.env.NODE_ENV = 'development';

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getLimitlessClient } from '../lib/LimitlessClient';
import { getDatabase } from '../lib/db/Database';

async function main() {
  console.log('🛡️ Wrath Shield v3 - Limitless Backfill');
  console.log('=======================================');

  try {
    const db = getDatabase(); // Ensure DB is initialized
    const limitless = getLimitlessClient();

    console.log('Starting full history download...');
    const count = await limitless.backfillRangeForDb('2023-01-01'); // Arbitrary start date far back

    console.log(`\n✅ Backfill complete!`);
    console.log(`📥 Downloaded and stored ${count} lifelogs.`);

    // Verify count in DB
    const row = db.prepare('SELECT COUNT(*) as count FROM lifelogs').get() as { count: number };
    console.log(`📊 Total lifelogs in database: ${row.count}`);

  } catch (error) {
    console.error('\n❌ Error during backfill:', error);
    process.exit(1);
  }
}

main();
