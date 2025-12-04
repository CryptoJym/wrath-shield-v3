/**
 * Demo script to test alert generation system
 * Run with: node scripts/demo-alerts.js
 */

const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const { randomUUID } = require('crypto');

const dbPath = path.resolve(process.cwd(), '.data', 'wrath-shield.db');
const db = new BetterSqlite3(dbPath);

console.log('='.repeat(60));
console.log('HYRO FORGE ALERT SYSTEM DEMO');
console.log('='.repeat(60));

try {
  // 1. Skip creating session for now - just demonstrate alerts
  console.log('\n1. Simulating alert generation (without session creation)...');
  const sessionId = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // 2. Create session_complete alert
  const alertId = randomUUID();
  db.prepare(`
    INSERT INTO hyro_alerts (id, type, title, message, priority, action_url, metadata, alert_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alertId,
    'session_complete',
    'Session Complete!',
    'Great work! Earned 50 XP in 30 minutes.',
    'low',
    '/hyro/forge',
    JSON.stringify({ sessionId, xpEarned: 50, duration: 30 }),
    `session_complete_${sessionId}`
  );

  console.log('\n2. Session complete alert generated:', alertId);

  // 3. Create a streak milestone alert
  const milestoneAlertId = randomUUID();
  db.prepare(`
    INSERT INTO hyro_alerts (id, type, title, message, priority, action_url, metadata, alert_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    milestoneAlertId,
    'streak_milestone',
    '7-Day Streak Achieved!',
    'Incredible dedication! Maintained a 7-day learning streak.',
    'medium',
    '/hyro/forge',
    JSON.stringify({ milestone: 7, currentStreak: 7 }),
    'streak_milestone_7'
  );

  console.log('3. Streak milestone alert generated:', milestoneAlertId);

  // 4. Create a growth opportunity alert
  const growthAlertId = randomUUID();
  db.prepare(`
    INSERT INTO hyro_alerts (id, type, title, message, priority, action_url, metadata, alert_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    growthAlertId,
    'growth_opportunity',
    'Math Needs Attention',
    'Math has declined by 5 points this week. Time to focus here!',
    'high',
    '/hyro/forge/analytics',
    JSON.stringify({ statName: 'math', decline: 5, currentValue: 45 }),
    `growth_opportunity_math_${Math.floor(Date.now() / (7 * 86400))}`
  );

  console.log('4. Growth opportunity alert generated:', growthAlertId);

  // 5. Update streak tracker
  console.log('\n5. Updating streak tracker...');
  db.prepare(`
    UPDATE hyro_streak_tracker
    SET last_session_at = ?,
        current_streak_days = 7,
        longest_streak_days = 7,
        updated_at = ?
    WHERE id = 'singleton'
  `).run(now, now);

  console.log('  ✓ Streak tracker updated: 7-day streak');

  // 6. Query all alerts
  console.log('\n' + '='.repeat(60));
  console.log('CURRENT ALERTS');
  console.log('='.repeat(60));

  const alerts = db.prepare(`
    SELECT * FROM hyro_alerts
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
  `).all();

  alerts.forEach((alert, index) => {
    const priorityEmoji = alert.priority === 'high' ? '🔴' : alert.priority === 'medium' ? '🟡' : '🟢';
    const isUnread = !alert.read_at;
    const unreadBadge = isUnread ? ' [UNREAD]' : '';

    console.log(`\n${index + 1}. ${priorityEmoji} ${alert.title}${unreadBadge}`);
    console.log(`   Type: ${alert.type}`);
    console.log(`   Message: ${alert.message}`);
    console.log(`   Priority: ${alert.priority}`);
    if (alert.action_url) {
      console.log(`   Action: ${alert.action_url}`);
    }
  });

  // 7. Show preferences
  console.log('\n' + '='.repeat(60));
  console.log('ALERT PREFERENCES');
  console.log('='.repeat(60));

  const prefs = db.prepare('SELECT * FROM hyro_alert_preferences ORDER BY alert_type').all();
  prefs.forEach(p => {
    const status = p.enabled ? '✓ Enabled' : '✗ Disabled';
    const email = p.email_enabled ? '📧' : '';
    console.log(`${status} ${email} ${p.alert_type} (${p.frequency})`);
  });

  // 8. Show unread count
  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM hyro_alerts WHERE read_at IS NULL AND dismissed = 0
  `).get();

  console.log('\n' + '='.repeat(60));
  console.log(`UNREAD ALERTS: ${unreadCount.count}`);
  console.log('='.repeat(60));

  // 9. Show streak info
  const streakInfo = db.prepare("SELECT * FROM hyro_streak_tracker WHERE id = 'singleton'").get();
  if (streakInfo) {
    console.log('\nSTREAK INFO:');
    console.log(`  Current streak: ${streakInfo.current_streak_days} days`);
    console.log(`  Longest streak: ${streakInfo.longest_streak_days} days`);
    const lastSession = new Date(streakInfo.last_session_at * 1000);
    console.log(`  Last session: ${lastSession.toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✓ Alert system demo completed successfully!');
  console.log('='.repeat(60));

  console.log('\n📝 Next steps:');
  console.log('  1. Start dev server: npm run dev');
  console.log('  2. Test API: GET /api/hyro/alerts?unread_only=true');
  console.log('  3. View in UI: Add AlertBell component to navbar');
  console.log('  4. Test alert generation: POST /api/hyro/alerts {"action":"generate"}');

} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
