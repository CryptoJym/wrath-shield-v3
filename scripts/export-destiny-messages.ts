#!/usr/bin/env npx tsx
/**
 * Export all messages with Destiny from macOS Messages database
 * Outputs to .data/legal/destiny_messages.json
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const CHAT_DB_PATH = path.join(process.env.HOME || '', 'Library/Messages/chat.db');
const OUTPUT_DIR = path.join(process.cwd(), '.data/legal');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'destiny_messages.json');

// Destiny's known handles
const DESTINY_HANDLES = [
  '+18016086861',
  'destiny.brady23@icloud.com',
];

interface Message {
  id: number;
  date: string;
  text: string;
  is_from_me: boolean;
  service: string;
  handle: string;
}

function macAbsoluteTimeToDate(macTime: number): Date {
  const MAC_EPOCH_OFFSET = 978307200;
  if (macTime > 1e12) {
    macTime = macTime / 1e9;
  }
  return new Date((macTime + MAC_EPOCH_OFFSET) * 1000);
}

async function main() {
  console.log('📱 Exporting all Destiny messages...');

  if (!fs.existsSync(CHAT_DB_PATH)) {
    console.error('❌ Messages database not found at:', CHAT_DB_PATH);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const db = new Database(CHAT_DB_PATH, { readonly: true });

  // Get handle IDs for Destiny
  const handleQuery = db.prepare(`
    SELECT ROWID, id FROM handle
    WHERE ${DESTINY_HANDLES.map(() => 'id LIKE ?').join(' OR ')}
  `);

  const handles = handleQuery.all(...DESTINY_HANDLES.map(h => `%${h.replace('+', '')}%`));
  console.log(`   Found ${handles.length} handles for Destiny`);

  if (handles.length === 0) {
    console.error('❌ No handles found for Destiny');
    process.exit(1);
  }

  const handleIds = handles.map((h: any) => h.ROWID);
  const handleMap = new Map(handles.map((h: any) => [h.ROWID, h.id]));

  // Query all messages
  const messageQuery = db.prepare(`
    SELECT
      m.ROWID as id,
      m.date,
      m.text,
      m.is_from_me,
      m.service,
      m.handle_id,
      m.associated_message_type,
      m.attributedBody
    FROM message m
    WHERE m.handle_id IN (${handleIds.join(',')})
    ORDER BY m.date ASC
  `);

  const rawMessages = messageQuery.all();
  console.log(`   Found ${rawMessages.length} total messages`);

  const messages: Message[] = [];
  let withText = 0;
  let reactions = 0;
  let attachments = 0;

  for (const row of rawMessages as any[]) {
    let text = row.text || '';

    // Try to extract text from attributedBody if text is empty
    if (!text && row.attributedBody) {
      try {
        const bodyStr = row.attributedBody.toString('utf8');
        // Extract text from NSAttributedString
        const match = bodyStr.match(/NSString[^\x00]*\x00([^\x00]+)/);
        if (match) {
          text = match[1];
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Skip reactions (associated_message_type indicates a reaction)
    if (row.associated_message_type && row.associated_message_type !== 0) {
      reactions++;
      continue;
    }

    // Track stats
    if (text && text.trim().length > 0) {
      withText++;
    } else {
      attachments++;
      text = '[Attachment/Media]';
    }

    messages.push({
      id: row.id,
      date: macAbsoluteTimeToDate(row.date).toISOString(),
      text: text.trim(),
      is_from_me: row.is_from_me === 1,
      service: row.service || 'iMessage',
      handle: handleMap.get(row.handle_id) || 'unknown',
    });
  }

  // Sort by date
  messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get date range
  const oldest = messages[0]?.date;
  const newest = messages[messages.length - 1]?.date;

  // Save to file
  const output = {
    generated: new Date().toISOString(),
    handle: '+18016086861 (Destiny)',
    stats: {
      total: messages.length,
      withText,
      reactions,
      attachments,
      dateRange: { oldest, newest }
    },
    messages
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n📊 Export Summary:`);
  console.log(`   Total messages: ${messages.length}`);
  console.log(`   With text: ${withText}`);
  console.log(`   Attachments/Media: ${attachments}`);
  console.log(`   Reactions (skipped): ${reactions}`);
  console.log(`   Date range: ${oldest?.split('T')[0]} to ${newest?.split('T')[0]}`);
  console.log(`\n✅ Saved to ${OUTPUT_PATH}`);

  // Also save a condensed timeline for quick reference
  const timelinePath = path.join(OUTPUT_DIR, 'destiny_timeline.md');
  let md = `# Destiny Message Timeline\nGenerated: ${new Date().toISOString()}\n\n`;
  md += `## Stats\n- Total: ${messages.length}\n- Date Range: ${oldest?.split('T')[0]} to ${newest?.split('T')[0]}\n\n`;

  // Group by month
  const byMonth = new Map<string, Message[]>();
  for (const msg of messages) {
    const monthKey = msg.date.substring(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(msg);
  }

  // Show recent months in detail
  const sortedMonths = [...byMonth.keys()].sort().reverse();
  for (const month of sortedMonths.slice(0, 6)) {
    const monthMsgs = byMonth.get(month)!;
    md += `## ${month} (${monthMsgs.length} messages)\n\n`;

    // Show recent messages for this month (last 30)
    const recent = monthMsgs.slice(-30);
    for (const msg of recent) {
      const direction = msg.is_from_me ? '→' : '←';
      const date = msg.date.split('T')[0];
      const time = msg.date.split('T')[1].substring(0, 5);
      const text = msg.text.substring(0, 100).replace(/\n/g, ' ');
      md += `- **${date} ${time}** ${direction} ${text}${msg.text.length > 100 ? '...' : ''}\n`;
    }
    md += '\n';
  }

  fs.writeFileSync(timelinePath, md);
  console.log(`   Timeline saved to ${timelinePath}`);

  db.close();
}

main().catch(console.error);
