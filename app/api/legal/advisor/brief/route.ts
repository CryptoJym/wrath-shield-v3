import { NextResponse } from 'next/server';
import { generateDailyBrief, LegalContext } from '@/lib/legal/LegalAdvisorLLM';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Load full case context
function loadCaseContext(): LegalContext {
  const scrapersPath = path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'scraped_data');
  const scrapersRoot = path.resolve(process.cwd(), 'packages', 'legal-scrapers');

  const context: LegalContext = {
    caseNumber: '164400524',
    nextHearing: null,
    judge: null,
    parties: [],
    recentEmails: [],
    recentTexts: [],
    timeline: [],
    strategicBrief: null,
  };

  // Load court data
  try {
    const mycaseFiles = fs.existsSync(scrapersPath)
      ? fs.readdirSync(scrapersPath)
          .filter(f => f.startsWith('mycase_data_') && f.endsWith('.json'))
          .sort()
          .reverse()
      : [];

    if (mycaseFiles.length > 0) {
      const data = JSON.parse(fs.readFileSync(path.join(scrapersPath, mycaseFiles[0]), 'utf-8'));
      const rawText = data.raw_text || '';

      const caseMatch = rawText.match(/Case Number:\s*\n?\s*(\d+)/);
      if (caseMatch) context.caseNumber = caseMatch[1];

      const judgeMatch = rawText.match(/Assigned Judge:\s*\n?\s*([A-Z\s]+?)(?:\n|$)/);
      if (judgeMatch) context.judge = judgeMatch[1].trim();

      const hearingMatch = rawText.match(/Next Hearing:\s*\n?\s*([\d-]+)\s+([\d:]+\s*[AP]M)/i);
      if (hearingMatch) {
        context.nextHearing = { date: hearingMatch[1], time: hearingMatch[2] };
      }

      if (data.table_0 && Array.isArray(data.table_0)) {
        for (let i = 1; i < data.table_0.length; i++) {
          const row = data.table_0[i];
          if (row && row.length >= 2) {
            context.parties.push({
              type: row[0] || '',
              name: row[1] || '',
              attorney: row[2] || null,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('[Brief] Failed to load court data:', e);
  }

  // Load strategic brief
  try {
    const analysisDir = path.join(scrapersPath, 'analysis');
    if (fs.existsSync(analysisDir)) {
      const briefFiles = fs.readdirSync(analysisDir)
        .filter(f => f.startsWith('strategic_brief_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (briefFiles.length > 0) {
        context.strategicBrief = JSON.parse(fs.readFileSync(path.join(analysisDir, briefFiles[0]), 'utf-8'));
      }
    }
  } catch (e) {
    console.error('[Brief] Failed to load strategic brief:', e);
  }

  // Load emails with proper timestamp handling
  try {
    const emailPatterns = ['zack_emails', 'gmail_', 'destiny_emails'];
    const files = fs.readdirSync(scrapersRoot).filter(f =>
      emailPatterns.some(p => f.toLowerCase().includes(p)) && f.endsWith('.json')
    );

    // Helper to convert various date formats to ISO
    const normalizeDate = (d: any): string => {
      if (!d) return '';
      // Unix timestamp (number)
      if (typeof d === 'number') {
        return new Date(d > 1e12 ? d : d * 1000).toISOString();
      }
      // String Unix timestamp
      if (typeof d === 'string' && /^\d+(\.\d+)?$/.test(d)) {
        const ts = parseFloat(d);
        return new Date(ts > 1e12 ? ts : ts * 1000).toISOString();
      }
      // Already a date string
      return d;
    };

    // Helper to check if email is case-relevant
    const isLegalRelevant = (from: string, subject: string, body: string): boolean => {
      const text = `${from} ${subject} ${body}`.toLowerCase();
      const legalKeywords = [
        'zstarr', 'moodybrown', 'starr', 'zachary',  // Attorney
        'destinyhyte', 'destiny', 'hyte',            // Ex-wife
        'hyro', 'custody', 'parent', 'hearing',      // Case terms
        'court', 'modification', 'child support',
        'visitation', 'divorce', 'family law',
      ];
      return legalKeywords.some(kw => text.includes(kw));
    };

    // Load ALL available emails (no cutoff - data may be stale)
    const legalEmails: typeof context.recentEmails = [];
    const otherEmails: typeof context.recentEmails = [];

    for (const file of files) {
      try {
        const emails = JSON.parse(fs.readFileSync(path.join(scrapersRoot, file), 'utf-8'));
        if (Array.isArray(emails)) {
          for (const e of emails) {
            const isoDate = normalizeDate(e.timestamp || e.date || e.ts);
            const from = e.from || e.sender || 'Unknown';
            const subject = e.subject || 'No subject';
            const body = e.body || e.snippet || '';

            const emailObj = {
              from,
              subject,
              snippet: e.snippet || body?.slice(0, 300) || '',
              date: isoDate,
            };

            if (isLegalRelevant(from, subject, body)) {
              legalEmails.push(emailObj);
            } else {
              otherEmails.push(emailObj);
            }
          }
        }
      } catch {}
    }

    // Sort both by date (newest first)
    legalEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    otherEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Prioritize legal-relevant emails (up to 25), fill remainder with others (up to 5)
    context.recentEmails = [
      ...legalEmails.slice(0, 25),
      ...otherEmails.slice(0, 5),
    ];

    console.log(`[Brief] Loaded ${context.recentEmails.length} recent emails (last 30 days)`);
  } catch (e) {
    console.error('[Brief] Failed to load emails:', e);
  }

  // Load texts with proper timestamp handling
  try {
    const textFiles = fs.readdirSync(scrapersRoot)
      .filter(f => (f.toLowerCase().includes('message') || f.toLowerCase().includes('destiny')) &&
                   (f.endsWith('.json') || f.endsWith('.jsonl')));

    // Helper to convert Unix timestamp to ISO date
    const tsToDate = (ts: number | string): string => {
      if (typeof ts === 'number') {
        // Unix timestamp (seconds)
        return new Date(ts * 1000).toISOString();
      }
      if (typeof ts === 'string' && /^\d+(\.\d+)?$/.test(ts)) {
        // String number timestamp
        return new Date(parseFloat(ts) * 1000).toISOString();
      }
      return ts as string || '';
    };

    // Load ALL available messages (no cutoff - data may be stale)
    // The AI will see the actual dates and can assess recency

    for (const textFile of textFiles) {
      try {
        const content = fs.readFileSync(path.join(scrapersRoot, textFile), 'utf-8');

        // Handle JSONL format (one JSON object per line)
        if (textFile.endsWith('.jsonl') || (content.includes('\n{') && !content.trim().startsWith('['))) {
          for (const line of content.split('\n')) {
            if (line.trim()) {
              try {
                const msg = JSON.parse(line);
                // Get timestamp - prefer 'ts' (Unix), then 'timestamp', then 'date'
                const rawTs = msg.ts || msg.timestamp || msg.date;
                const isoDate = tsToDate(rawTs);
                const msgTime = new Date(isoDate).getTime();

                // Include all messages - dates will be visible to AI
                // Skip empty messages
                if (!msg.text?.trim()) continue;

                context.recentTexts.push({
                  text: msg.text || msg.content || '',
                  date: isoDate,
                  // Determine sender: is_from_me or handle-based detection
                  from: msg.is_from_me === true || msg.is_from_me === 1 ? 'James' : 'Destiny',
                });
              } catch {}
            }
          }
        } else {
          // Handle JSON array format
          const texts = JSON.parse(content);
          if (Array.isArray(texts)) {
            for (const t of texts) {
              const rawTs = t.ts || t.timestamp || t.date;
              const isoDate = tsToDate(rawTs);
              const msgTime = new Date(isoDate).getTime();

              // Include all messages - dates will be visible to AI
              // Skip empty messages
              if (!t.text?.trim()) continue;

              context.recentTexts.push({
                text: t.text || t.content || '',
                date: isoDate,
                from: t.is_from_me === true || t.is_from_me === 1 ? 'James' : 'Destiny',
              });
            }
          }
        }
      } catch {}
    }

    // Sort by date (newest first) and limit
    context.recentTexts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    context.recentTexts = context.recentTexts.slice(0, 50);

    console.log(`[Brief] Loaded ${context.recentTexts.length} recent texts (last 30 days)`);
  } catch (e) {
    console.error('[Brief] Failed to load texts:', e);
  }

  // Build timeline from all sources
  context.timeline = [
    ...context.recentEmails.map(e => ({
      date: e.date,
      source: 'EMAIL',
      type: 'Communication',
      description: `${e.from}: ${e.subject}`,
    })),
    ...context.recentTexts.map(t => ({
      date: t.date,
      source: 'TEXT',
      type: 'Message',
      description: `${t.from}: ${t.text.slice(0, 100)}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);

  return context;
}

// Check for cached brief
function getCachedBrief(): any | null {
  const cacheDir = path.resolve(process.cwd(), '.data', 'legal');
  const cacheFile = path.join(cacheDir, 'daily_brief_cache.json');

  if (!fs.existsSync(cacheFile)) return null;

  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    // Return cached even if older; better to show stale context than an empty UI.
    return cached;
  } catch {}

  return null;
}

function saveBriefCache(brief: any) {
  const cacheDir = path.resolve(process.cwd(), '.data', 'legal');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'daily_brief_cache.json'), JSON.stringify(brief, null, 2));
}

export async function GET() {
  // Check cache first
  const cached = getCachedBrief();
  if (cached) {
    return NextResponse.json({
      ...cached,
      cached: true,
    });
  }

  // No cache, return placeholder with instruction to POST
  return NextResponse.json({
    message: 'No recent brief available. POST to generate a new one.',
    lastGenerated: null,
  });
}

export async function POST() {
  try {
    const context = loadCaseContext();

    console.log('[Brief] Generating daily brief with context:', {
      caseNumber: context.caseNumber,
      emails: context.recentEmails.length,
      texts: context.recentTexts.length,
      timeline: context.timeline.length,
    });

    const brief = await generateDailyBrief(context);

    // Cache it
    saveBriefCache(brief);

    return NextResponse.json(brief);
  } catch (error: any) {
    console.error('[Brief] Generation error:', error);

    return NextResponse.json({
      error: error.message || 'Failed to generate brief',
      hint: error.message.includes('not configured')
        ? 'Please set OPENROUTER_API_KEY in your environment'
        : 'Check server logs for details',
    }, { status: 500 });
  }
}
