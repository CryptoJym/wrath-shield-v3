#!/usr/bin/env npx tsx
/**
 * Export iMessages from macOS chat.db to .data/imessage.jsonl
 *
 * This script reads from ~/Library/Messages/chat.db and exports messages
 * in the format expected by the ingest-imessage API.
 *
 * Usage: npx tsx scripts/export-imessage.ts [--days=7]
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CHAT_DB_PATH = path.join(process.env.HOME || '', 'Library/Messages/chat.db');
const OUTPUT_PATH = path.join(process.cwd(), '.data/imessage.jsonl');

interface Message {
  id: string;
  handle: string;
  text: string;
  date: string;
  is_from_me: boolean;
  service: string;
  chat_id?: string;
}

function parseDays(): number {
  const arg = process.argv.find(a => a.startsWith('--days='));
  if (arg) {
    return parseInt(arg.split('=')[1], 10) || 7;
  }
  return 7; // default to 7 days
}

function macAbsoluteTimeToDate(macTime: number): Date {
  // macOS absolute time is seconds since 2001-01-01 00:00:00 UTC
  // We need to add this to the Unix epoch offset
  const MAC_EPOCH_OFFSET = 978307200; // seconds between 1970-01-01 and 2001-01-01

  // Handle nanosecond timestamps (newer macOS)
  if (macTime > 1e12) {
    macTime = macTime / 1e9;
  }

  return new Date((macTime + MAC_EPOCH_OFFSET) * 1000);
}

function hashId(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

async function main() {
  const days = parseDays();
  console.log(`Exporting iMessages from the last ${days} days...`);

  // Check if chat.db exists
  if (!fs.existsSync(CHAT_DB_PATH)) {
    console.error(`Error: chat.db not found at ${CHAT_DB_PATH}`);
    console.error('Make sure you have Full Disk Access granted to Terminal/your IDE');
    process.exit(1);
  }

  // Ensure .data directory exists
  const dataDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    const db = new Database(CHAT_DB_PATH, { readonly: true });

    // Calculate cutoff time in Mac absolute time
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const MAC_EPOCH_OFFSET = 978307200;
    const cutoffMacTime = (cutoffDate.getTime() / 1000) - MAC_EPOCH_OFFSET;

    // Query messages with handle info
    const query = `
      SELECT
        m.ROWID as rowid,
        m.guid,
        m.text,
        m.date,
        m.is_from_me,
        m.service,
        h.id as handle_id,
        c.chat_identifier
      FROM message m
      LEFT JOIN handle h ON m.handle_id = h.ROWID
      LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
      LEFT JOIN chat c ON cmj.chat_id = c.ROWID
      WHERE m.date > ?
        AND m.text IS NOT NULL
        AND m.text != ''
      ORDER BY m.date ASC
    `;

    const messages = db.prepare(query).all(cutoffMacTime) as any[];

    console.log(`Found ${messages.length} messages`);

    // Transform and write to JSONL
    const output = fs.createWriteStream(OUTPUT_PATH);
    let count = 0;

    for (const msg of messages) {
      const record: Message = {
        id: hashId(msg.guid || `${msg.rowid}`),
        handle: msg.handle_id || msg.chat_identifier || 'unknown',
        text: msg.text,
        date: macAbsoluteTimeToDate(msg.date).toISOString(),
        is_from_me: msg.is_from_me === 1,
        service: msg.service || 'iMessage',
        chat_id: msg.chat_identifier,
      };

      output.write(JSON.stringify(record) + '\n');
      count++;
    }

    output.end();
    db.close();

    console.log(`Exported ${count} messages to ${OUTPUT_PATH}`);
    console.log('Done!');

  } catch (err: any) {
    if (err.code === 'SQLITE_CANTOPEN') {
      console.error('Error: Cannot open chat.db - Full Disk Access required');
      console.error('Go to System Preferences > Security & Privacy > Privacy > Full Disk Access');
      console.error('Add Terminal (or your IDE) to the allowed apps');
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
}

main();
