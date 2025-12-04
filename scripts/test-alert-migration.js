/**
 * Test script to verify alert system migration
 */

const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.cwd(), '.data', 'wrath-shield.db');

// Ensure .data directory exists
const dataDir = path.join(process.cwd(), '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new BetterSqlite3(dbPath);

try {
  console.log('✓ Database connection established\n');

  // Check if alert tables exist
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('hyro_alerts', 'hyro_alert_preferences', 'hyro_streak_tracker', 'hyro_alert_generation_log')
    ORDER BY name
  `).all();

  console.log('Alert system tables found:', tables.length);
  tables.forEach(t => console.log('  -', t.name));

  if (tables.length === 4) {
    console.log('\n✓ All alert tables are present!');

    // Check alert preferences
    const prefs = db.prepare('SELECT * FROM hyro_alert_preferences ORDER BY alert_type').all();
    console.log('\nAlert preferences initialized:', prefs.length);
    prefs.forEach(p => console.log(`  - ${p.alert_type}: enabled=${p.enabled}`));

    // Check views
    const views = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='view' AND name LIKE 'hyro_alerts%'
      ORDER BY name
    `).all();
    console.log('\nAlert views found:', views.length);
    views.forEach(v => console.log('  -', v.name));

    console.log('\n✓ Alert system migration successful!');
  } else {
    console.log('\n⚠ Some alert tables are missing. You may need to run migrations.');
  }

} catch (error) {
  console.error('✗ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
