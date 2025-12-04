#!/usr/bin/env npx tsx
/**
 * Store Destiny text messages in Zep memory for legal context
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MESSAGES_PATH = path.join(process.cwd(), '.data/legal/destiny_messages.json');
const SESSION_ID = 'legal-case-164400524';

interface Message {
  date: string;
  text: string;
  is_from_me: boolean;
}

async function main() {
  const ZEP_API_KEY = process.env.ZEP_API_KEY;
  if (!ZEP_API_KEY) {
    console.error('❌ ZEP_API_KEY not found');
    process.exit(1);
  }

  console.log('📱 Loading Destiny messages...');
  const data = JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf8'));
  const messages: Message[] = data.messages;

  // Filter to actual text messages (not reactions/garbled)
  const textMessages = messages.filter(m =>
    m.text &&
    m.text.length > 10 &&
    !m.text.includes('__kIMMessagePartAttributeName') &&
    !m.text.includes('NSDictionary') &&
    !m.text.includes('NSNumber')
  );

  console.log(`   Total messages: ${messages.length}`);
  console.log(`   With actual text: ${textMessages.length}`);

  // Group by month for organized storage
  const byMonth = new Map<string, Message[]>();
  for (const msg of textMessages) {
    const month = msg.date.substring(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(msg);
  }

  // Store each month as a separate memory entry
  console.log('\n🧠 Storing in Zep memory...');

  for (const [month, msgs] of [...byMonth.entries()].sort()) {
    const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Format messages
    const formatted = msgs.map(m => {
      const dir = m.is_from_me ? 'James' : 'Destiny';
      const date = m.date.split('T')[0];
      const time = m.date.split('T')[1].substring(0, 5);
      return `[${date} ${time}] ${dir}: ${m.text.substring(0, 500)}`;
    }).join('\n\n');

    const content = `TEXT MESSAGES WITH DESTINY - ${monthName}
Case: 164400524 - Brady v. Brady
Messages: ${msgs.length}

${formatted}`;

    try {
      const response = await fetch(`https://api.getzep.com/api/v2/sessions/${SESSION_ID}/memory`, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${ZEP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{
            role: 'system',
            role_type: 'system',
            content: content.substring(0, 15000), // Limit size
            metadata: {
              type: 'text_messages',
              party: 'Destiny',
              month,
              count: msgs.length
            }
          }]
        })
      });

      if (response.ok) {
        console.log(`   ✅ ${monthName}: ${msgs.length} messages`);
      } else {
        console.log(`   ⚠️ ${monthName}: ${response.status}`);
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      console.log(`   ❌ ${monthName}: ${e.message}`);
    }
  }

  // Create a summary of key evidence
  console.log('\n📋 Creating evidence summary...');

  // Find key messages by keyword
  const keyPhrases = ['move', 'relocat', 'custody', 'schedule', 'transfer', 'school', 'late', 'court'];
  const keyMessages = textMessages.filter(m => {
    const lower = m.text.toLowerCase();
    return keyPhrases.some(p => lower.includes(p));
  });

  const evidenceSummary = `KEY TEXT MESSAGE EVIDENCE - Destiny Communications
Case: 164400524 - Brady v. Brady
Total Key Messages: ${keyMessages.length}

${keyMessages.slice(-50).map(m => {
    const dir = m.is_from_me ? 'JAMES' : 'DESTINY';
    return `[${m.date.split('T')[0]}] ${dir}: ${m.text.substring(0, 300)}`;
  }).join('\n\n')}`;

  try {
    await fetch(`https://api.getzep.com/api/v2/sessions/${SESSION_ID}/memory`, {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${ZEP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{
          role: 'system',
          role_type: 'system',
          content: evidenceSummary,
          metadata: { type: 'evidence_summary', source: 'text_messages' }
        }]
      })
    });
    console.log('   ✅ Evidence summary stored');
  } catch (e) {
    console.log('   ⚠️ Failed to store summary');
  }

  // Save key messages locally too
  const keyPath = path.join(process.cwd(), '.data/legal/destiny_key_messages.md');
  let md = `# Key Text Messages with Destiny\nGenerated: ${new Date().toISOString()}\n\n`;
  md += `## Recent Key Messages (by keyword: move, relocate, custody, schedule, etc.)\n\n`;

  for (const m of keyMessages.slice(-100)) {
    const dir = m.is_from_me ? '→' : '←';
    md += `### ${m.date.split('T')[0]} ${m.date.split('T')[1].substring(0, 5)} ${dir}\n`;
    md += `${m.text}\n\n`;
  }

  fs.writeFileSync(keyPath, md);
  console.log(`\n✅ Key messages saved to ${keyPath}`);

  console.log('\n✅ Complete!');
}

main().catch(console.error);
