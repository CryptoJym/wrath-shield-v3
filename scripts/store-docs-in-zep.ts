/**
 * Store extracted legal documents in Zep memory
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const EXTRACTED_DIR = path.resolve(process.cwd(), '.data', 'legal', 'extracted');
const SESSION_ID = 'legal-case-164400524';

interface DocumentRecord {
  id: string;
  emailId: string;
  emailDate: string;
  emailSubject: string;
  filename: string;
  filePath: string;
  mimeType: string;
  size: number;
  extractedText: string | null;
  category: string;
  parties?: string[];
}

async function main() {
  const ZEP_API_KEY = process.env.ZEP_API_KEY;
  if (!ZEP_API_KEY) {
    console.error('❌ ZEP_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('📚 Loading document index...');
  const indexPath = path.join(EXTRACTED_DIR, 'document_index.json');
  const documents: DocumentRecord[] = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  console.log(`   Found ${documents.length} documents in index`);

  // Group by category for organized storage
  const orders = documents.filter(d => d.category === 'order');
  const motions = documents.filter(d => d.category === 'motion');
  const notices = documents.filter(d => d.category === 'notice');
  const affidavits = documents.filter(d => d.category === 'affidavit');
  const other = documents.filter(d => !['order', 'motion', 'notice', 'affidavit'].includes(d.category));

  console.log(`\n📊 Document breakdown:`);
  console.log(`   Orders: ${orders.length}`);
  console.log(`   Motions: ${motions.length}`);
  console.log(`   Notices: ${notices.length}`);
  console.log(`   Affidavits: ${affidavits.length}`);
  console.log(`   Other: ${other.length}`);

  // Helper to load extracted text
  function getExtractedText(doc: DocumentRecord): string | null {
    // Find matching text file
    const files = fs.readdirSync(EXTRACTED_DIR);
    const textFile = files.find(f => f.endsWith('.txt') && f !== 'document_index.json');

    // Try to find by filename pattern
    const safeFilename = doc.filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
    const matchingFile = files.find(f => f.includes(safeFilename) && f.endsWith('.txt'));

    if (matchingFile) {
      const content = fs.readFileSync(path.join(EXTRACTED_DIR, matchingFile), 'utf8');
      return content;
    }
    return null;
  }

  // Store critical documents in Zep
  console.log('\n🧠 Storing documents in Zep memory...');

  // Priority order: Orders first, then motions, then others
  const priorityDocs = [...orders, ...motions, ...affidavits].filter(d => d.extractedText !== null);

  let stored = 0;
  let errors = 0;

  for (const doc of priorityDocs) {
    const extractedText = getExtractedText(doc);
    if (!extractedText || extractedText.length < 200) continue;

    // Truncate for Zep (max 8000 chars per message)
    const content = `LEGAL DOCUMENT: ${doc.filename}
Date: ${new Date(doc.emailDate).toISOString().split('T')[0]}
Category: ${doc.category.toUpperCase()}
Subject: ${doc.emailSubject}
Source: Attorney Email (Moody Brown)

=== DOCUMENT CONTENT ===
${extractedText.substring(0, 7000)}`;

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
            content,
            metadata: {
              type: 'legal_document',
              category: doc.category,
              filename: doc.filename,
              date: doc.emailDate
            }
          }]
        })
      });

      if (response.ok) {
        console.log(`   ✅ ${doc.filename.substring(0, 50)}`);
        stored++;
      } else {
        const err = await response.text();
        console.log(`   ⚠️ ${doc.filename}: ${response.status}`);
        errors++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));

    } catch (e: any) {
      console.log(`   ❌ ${doc.filename}: ${e.message}`);
      errors++;
    }
  }

  // Store document index as summary
  const indexSummary = `CASE FILE INDEX - Brady v. Brady (164400524)
Generated: ${new Date().toISOString()}

COURT ORDERS (${orders.length}):
${orders.map(d => `- ${new Date(d.emailDate).toISOString().split('T')[0]}: ${d.filename}`).join('\n')}

MOTIONS (${motions.length}):
${motions.map(d => `- ${new Date(d.emailDate).toISOString().split('T')[0]}: ${d.filename}`).join('\n')}

AFFIDAVITS (${affidavits.length}):
${affidavits.map(d => `- ${new Date(d.emailDate).toISOString().split('T')[0]}: ${d.filename}`).join('\n')}

All documents extracted and stored from attorney correspondence.`;

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
          content: indexSummary,
          metadata: { type: 'case_file_index', generated: new Date().toISOString() }
        }]
      })
    });
    console.log(`   ✅ Case file index stored`);
  } catch (e) {
    console.log(`   ⚠️ Failed to store index`);
  }

  console.log(`\n✅ Complete: ${stored} documents stored, ${errors} errors`);
}

main().catch(console.error);
